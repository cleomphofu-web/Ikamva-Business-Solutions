import { ScheduleService } from '../services/ScheduleService.js';

/**
 * Small process runtime for polling WorkerEngine.
 * Persistence and task transitions remain owned by repositories/services.
 */
export class WorkerRuntime {
  constructor({
    engine,
    queueRepository,
    auditService,
    chainService,
    employeeRepository,
    tenantId,
    workerId = `worker-${process.pid}`,
    taskTypes = [],
    pollIntervalMs = 1000,
    lockTimeoutMinutes = 5,
    logger = console,
    telemetry,
    clock = () => new Date(),
  } = {}) {
    if (!engine?.processNext) throw new Error('WorkerRuntime requires a WorkerEngine.');
    if (!queueRepository?.claimNext) throw new Error('WorkerRuntime requires a queue repository.');
    this.engine = engine;
    this.queueRepository = queueRepository;
    this.auditService = auditService;
    this.chainService = chainService;
    this.employeeRepository = employeeRepository;
    this.tenantId = tenantId;
    this.workerId = workerId;
    this.taskTypes = taskTypes;
    this.pollIntervalMs = pollIntervalMs;
    this.lockTimeoutMinutes = lockTimeoutMinutes;
    this.logger = logger;
    this.telemetry = telemetry;
    this.clock = clock;
    this.running = false;
    this.timer = null;
    this.recoveryInFlight = false;
    this.lastTickAt = null;
    this.lastRecoveryAt = null;
  }

  async tick() {
    if (!this.running) return null;
    if (!this.recoveryInFlight && typeof this.queueRepository.recoverExpiredLocks === 'function') {
      this.recoveryInFlight = true;
      try {
        const recovered = await this.queueRepository.recoverExpiredLocks({ timeoutMinutes: this.lockTimeoutMinutes, tenantId: this.tenantId });
        for (const task of (Array.isArray(recovered) ? recovered : [])) {
          await this.auditService?.emit({ task, eventType: 'TASK_RECOVERED', fromStatus: 'processing', toStatus: task.status, message: 'Recovered an orphaned task after its processing lock expired.', metadata: { retry_count: task.retry_count ?? 0 } });
        }
        this.telemetry?.recordRecovery(recovered?.length || 0);
        this.lastRecoveryAt = new Date().toISOString();
        await this.chainService?.recoverStalledChains({ employeeRepository: this.employeeRepository });
      } finally {
        this.recoveryInFlight = false;
      }
    }
    this.lastTickAt = new Date().toISOString();
    this.telemetry?.recordTick();

    // Check employee schedule window before polling new work from queue
    if (this.employeeRepository) {
      try {
        const employee = await this.employeeRepository.findByTenant(this.tenantId);
        const schedule = employee?.schedule || employee?.configuration?.job_spec?.schedule || {};
        if (schedule.start && schedule.end) {
          const evaluation = ScheduleService.evaluate(schedule, this.clock());
          if (!evaluation.isWithinShift) {
            this.telemetry?.recordIdle();
            return null;
          }
        }
      } catch (err) {
        this.logger.warn?.('schedule_evaluation_failed', { message: err?.message });
      }
    }

    const result = await this.engine.processNext({ tenantId: this.tenantId, workerId: this.workerId, taskTypes: this.taskTypes });
    result ? this.telemetry?.recordProcessed() : this.telemetry?.recordIdle();
    return result;
  }

  start() {
    if (this.running) return this;
    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try {
        await this.tick();
      } catch (error) {
        this.telemetry?.recordError(error);
        this.logger.error?.('worker_tick_failed', { error_message: error?.message || String(error) });
      } finally {
        if (this.running) this.timer = setTimeout(loop, this.pollIntervalMs);
      }
    };
    void loop();
    return this;
  }

  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

import http from 'node:http';
import { createExecutionContainer, createTenantExecutionContainer } from '../container/createExecutionContainer.js';
import supabaseAdmin from '../lib/supabase-admin.js';
import { WorkerRuntime } from './WorkerRuntime.js';
import { WorkerTelemetry, createStructuredLogger } from './WorkerTelemetry.js';
import { readWorkerEnvironment } from '../config/runtime-env.js';
import { ScheduleService } from '../services/ScheduleService.js';

const config = readWorkerEnvironment();
const { tenantId, workerId, healthHost, healthPort, pollIntervalMs, lockTimeoutMinutes } = config;
const telemetry = new WorkerTelemetry();
const logger = createStructuredLogger({ workerId, tenantId });

const rootContainer = createExecutionContainer({ supabaseAdmin });
const tenantContainer = createTenantExecutionContainer({ tenantId, rootContainer });
const runtime = new WorkerRuntime({
  engine: tenantContainer.resolve('workerEngine'),
  queueRepository: tenantContainer.resolve('repositories').taskQueue,
  auditService: tenantContainer.resolve('auditService'),
  chainService: tenantContainer.resolve('taskChainService'),
  employeeRepository: tenantContainer.resolve('repositories').employees,
  tenantId,
  workerId,
  pollIntervalMs,
  lockTimeoutMinutes,
  logger,
  telemetry,
});

const healthServer = http.createServer(async (req, res) => {
  if (req.url !== '/healthz') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  let metrics = {};
  try {
    metrics = await tenantContainer.resolve('repositories').taskQueue.getOperationalMetrics();
  } catch (error) {
    metrics = { error: error.message };
  }

  const healthy = runtime.running && !metrics.error;
  res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: healthy ? 'ok' : 'degraded',
    worker_id: workerId,
    tenant_id: tenantId,
    running: runtime.running,
    last_tick_at: runtime.lastTickAt,
    last_recovery_at: runtime.lastRecoveryAt,
    telemetry: telemetry.snapshot(),
    queue: metrics,
  }));
});

const scheduleEmailTriage = async () => {
  try {
    const repos = tenantContainer.resolve('repositories');
    const employee = await repos.employees.findByTenant();
    const integration = await repos.tenantIntegrations.findByProvider('gmail');
    if (employee?.lifecycle_status !== 'active' || integration?.status !== 'connected' || !integration.credential_reference) return;

    // Check shift window deterministically via ScheduleService
    const schedule = employee?.schedule || employee?.configuration?.job_spec?.schedule || {};
    const evaluation = ScheduleService.evaluate(schedule, new Date());
    if (!evaluation.isWithinShift) {
      logger.info('email_triage_outside_shift_skipped', { tenantId, currentTime: evaluation.currentTime, timezone: evaluation.timezone });
      return;
    }

    // Push is active when push_expiry is set and not expired. The poll is a
    // fallback — it runs even when push is working, but it's harmless because
    // the per-message idempotency key (email_triage_<messageId>) prevents
    // double-processing.
    if (integration.push_expiry && new Date(integration.push_expiry) > new Date()) {
      logger.info('email_triage_poll_fallback_active_push_configured', { tenantId });
    }

    const profile = await repos.tenants.findByClientProfileId ? await repos.tenants.findByClientProfileId(employee.client_profile_id) : await repos.tenants.findByTenantId(tenantId);
    await repos.sops.ensureDefaultEmailWorkflow({ clientProfileId: profile?.id, taskType: 'email_triage' });
    await repos.sops.ensureDefaultEmailWorkflow({ clientProfileId: profile?.id, taskType: 'email_response' });
    await tenantContainer.resolve('queueService').enqueueTask({ tenant_id: tenantId, client_profile_id: profile?.id ?? null, task_type: 'email_triage', idempotency_key: `email_triage_${tenantId}_${Math.floor(Date.now() / 300000)}`, payload: { credential_reference: integration.credential_reference, message: '' } });
    logger.info('email_triage_enqueued', { tenantId });
  } catch (error) { logger.error('email_triage_schedule_failed', { message: error.message }); }
};

let lastShiftKey = null;
const scheduleShiftStart = async () => {
  try {
    const repos = tenantContainer.resolve('repositories');
    const employee = await repos.employees.findByTenant();
    if (employee?.lifecycle_status !== 'active') return;

    const schedule = employee?.schedule || employee?.configuration?.job_spec?.schedule || {};
    const now = new Date();
    const evaluation = ScheduleService.evaluate(schedule, now);

    if (!evaluation.isStartMinute) return;

    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: evaluation.timezone }).format(now);
    const key = `${employee.id}:${dateKey}:${schedule.start}`;
    if (lastShiftKey === key) return;
    lastShiftKey = key;

    const profile = await repos.tenants.findByTenantId(tenantId);
    await tenantContainer.resolve('queueService').enqueueTask({
      tenant_id: tenantId,
      client_profile_id: profile?.id ?? null,
      task_type: 'shift_start',
      idempotency_key: `shift_start_${key}`,
      payload: { message: 'Begin scheduled work and review pending tasks.' },
    });
    logger.info('shift_start_enqueued', { tenantId, employeeId: employee.id });
  } catch (error) { logger.error('shift_start_schedule_failed', { message: error.message }); }
};

/**
 * Attempt to register or renew the Gmail push watch on startup.
 * If PUBSUB_TOPIC is not configured, this is a no-op and polling handles triage.
 * If the watch is healthy (expiry > 24 h away), renewWatchIfNeeded skips the API call.
 */
const renewGmailWatch = async () => {
  if (!process.env.PUBSUB_TOPIC) return;
  try {
    const repos = tenantContainer.resolve('repositories');
    const integration = await repos.tenantIntegrations.findByProvider('gmail');
    if (!integration || integration.status !== 'connected' || !integration.credential_reference) return;
    const watchService = tenantContainer.resolve('gmailWatchService');
    const renewed = await watchService.renewWatchIfNeeded(integration, integration.credential_reference, tenantId);
    if (renewed) logger.info('gmail_watch_renewed_on_startup', { tenantId });
    else logger.info('gmail_watch_still_valid', { tenantId, push_expiry: integration.push_expiry });
  } catch (err) {
    logger.error('gmail_watch_startup_failed', { message: err?.message });
  }
};
let triageTimer;
let shiftTimer;

const shutdown = async signal => {
  logger.info('shutdown_requested', { signal });
  await runtime.stop();
  if (triageTimer) clearInterval(triageTimer);
  if (shiftTimer) clearInterval(shiftTimer);
  await new Promise(resolve => healthServer.close(resolve));
  process.exit(0);
};

healthServer.listen(healthPort, healthHost, () => {
  runtime.start();
  void scheduleEmailTriage();
  void scheduleShiftStart();
  void renewGmailWatch();
  triageTimer = setInterval(() => void scheduleEmailTriage(), 5 * 60 * 1000);
  shiftTimer = setInterval(() => void scheduleShiftStart(), 60 * 1000);
  logger.info('worker_started', { health_url: `http://${healthHost}:${healthPort}/healthz` });
});

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

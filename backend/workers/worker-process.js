import http from 'node:http';
import { createExecutionContainer, createTenantExecutionContainer } from '../container/createExecutionContainer.js';
import supabaseAdmin from '../lib/supabase-admin.js';
import { WorkerRuntime } from './WorkerRuntime.js';
import { WorkerTelemetry, createStructuredLogger } from './WorkerTelemetry.js';
import { readWorkerEnvironment } from '../config/runtime-env.js';

const config = readWorkerEnvironment();
const { tenantId, workerId, healthHost, healthPort, pollIntervalMs, lockTimeoutMinutes } = config;
const telemetry = new WorkerTelemetry();
const logger = createStructuredLogger({ workerId, tenantId });

const rootContainer = createExecutionContainer({ supabaseAdmin });
const tenantContainer = createTenantExecutionContainer({ tenantId, rootContainer });
const runtime = new WorkerRuntime({
  engine: tenantContainer.resolve('workerEngine'),
  queueRepository: tenantContainer.resolve('repositories').taskQueue,
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
    const profile = await repos.tenants.findByTenantId(tenantId);
    await repos.sops.ensureDefaultEmailWorkflow({ clientProfileId: profile?.id, taskType: 'email_triage' });
    await repos.sops.ensureDefaultEmailWorkflow({ clientProfileId: profile?.id, taskType: 'email_response' });
    await tenantContainer.resolve('queueService').enqueueTask({ tenant_id: tenantId, client_profile_id: profile?.id ?? null, task_type: 'email_triage', idempotency_key: `email_triage_${tenantId}_${Math.floor(Date.now() / 300000)}`, payload: { credential_reference: integration.credential_reference, message: '' } });
    logger.info('email_triage_enqueued', { tenantId });
  } catch (error) { logger.error('email_triage_schedule_failed', { message: error.message }); }
};
let lastShiftKey = null;
const scheduleShiftStart = async () => {
  try {
    const repos = tenantContainer.resolve('repositories'); const employee = await repos.employees.findByTenant(); const schedule = employee?.schedule || {};
    const now = new Date(); const timezone = schedule.timezone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const localPart = type => parts.find(part => part.type === type)?.value || ''; const day = localPart('weekday'); const time = `${localPart('hour')}:${localPart('minute')}`;
    if (employee?.lifecycle_status !== 'active' || !schedule.start || time !== schedule.start || (Array.isArray(schedule.days) && !schedule.days.includes(day))) return;
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now); const key = `${employee.id}:${dateKey}:${schedule.start}`; if (lastShiftKey === key) return; lastShiftKey = key;
    const profile = await repos.tenants.findByTenantId(tenantId);
    await tenantContainer.resolve('queueService').enqueueTask({ tenant_id: tenantId, client_profile_id: profile?.id ?? null, task_type: 'shift_start', idempotency_key: `shift_start_${key}`, payload: { message: 'Begin scheduled work and review pending tasks.' } });
    logger.info('shift_start_enqueued', { tenantId, employeeId: employee.id });
  } catch (error) { logger.error('shift_start_schedule_failed', { message: error.message }); }
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
  triageTimer = setInterval(() => void scheduleEmailTriage(), 5 * 60 * 1000);
  shiftTimer = setInterval(() => void scheduleShiftStart(), 60 * 1000);
  logger.info('worker_started', { health_url: `http://${healthHost}:${healthPort}/healthz` });
});

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

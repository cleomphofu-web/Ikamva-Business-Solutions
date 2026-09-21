import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const base = path.resolve(__dirname, '..');
const url = (rel) => pathToFileURL(path.join(base, rel)).href;

const { TaskChainService } = await import(url('backend/services/TaskChainService.js'));
const { QueueService } = await import(url('backend/services/QueueService.js'));
const { AuditService } = await import(url('backend/services/AuditService.js'));
const { InMemoryTaskQueueRepository } = await import(url('backend/repositories/InMemoryTaskQueueRepository.js'));
const { InMemoryTaskLogRepository } = await import(url('backend/repositories/InMemoryTaskLogRepository.js'));
const { InMemoryTenantRepository } = await import(url('backend/repositories/InMemoryTenantRepository.js'));
const { QuotaService } = await import(url('backend/services/QuotaService.js'));

const clientProfileId = 'profile-concurrent';
const tenantId = 'tenant-concurrent';
const tenantRepo = new InMemoryTenantRepository([
  { id: clientProfileId, tenant_id: tenantId, pack_size: 5, tasks_used_this_cycle: 0 },
]);
const taskQueueRepo = new InMemoryTaskQueueRepository();
const taskLogsRepo = new InMemoryTaskLogRepository();
const auditService = new AuditService({ taskLogRepository: taskLogsRepo });
const queueService = new QueueService({ taskQueueRepository: taskQueueRepo, auditService });
const quotaService = new QuotaService({ tenantRepository: tenantRepo });
const chainConfig = {
  name: 'Test',
  steps: [{ name: 'Step A', task_type: 'email_read' }, { name: 'Step B', task_type: 'email_send' }],
};
const svc = new TaskChainService({
  queueService,
  taskQueueRepository: taskQueueRepo,
  auditService,
  quotaService,
  tenantRepository: tenantRepo,
});

const { firstStepTaskId } = await svc.createChain(tenantId, clientProfileId, chainConfig, { emailId: 'e1' });
const step1 = await svc.advanceChain(firstStepTaskId, { output: { text: 'read' } });

// Fire final-step advance twice concurrently — same step, same output
await Promise.all([
  svc.advanceChain(step1.id, { output: { sent: true } }),
  svc.advanceChain(step1.id, { output: { sent: true } }),
]);

const profile = await tenantRepo.findClientProfileById(clientProfileId);
console.log('tasks_used_this_cycle after concurrent advance:', profile.tasks_used_this_cycle);
if (profile.tasks_used_this_cycle === 1) {
  console.log('RESULT: PASS — idempotent (1 increment)');
} else {
  console.log('RESULT: FAIL — double increment detected (' + profile.tasks_used_this_cycle + ' increments)');
  process.exit(1);
}

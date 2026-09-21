import crypto from 'node:crypto';
import supabaseAdmin from '../backend/lib/supabase-admin.js';
import { createExecutionContainer, createTenantExecutionContainer } from '../backend/container/createExecutionContainer.js';

async function main() {
  const root = createExecutionContainer({ supabaseAdmin });
  const tenantId = process.env.IKAMVA_TENANT_ID || '45022903-1067-4f7b-8d1a-84329af38825';
  const scoped = createTenantExecutionContainer({ tenantId, rootContainer: root });

  const workerEngine = scoped.resolve('workerEngine');
  const queueService = scoped.resolve('queueService');
  const taskQueueRepo = scoped.resolve('repositories').taskQueue;
  const taskLogsRepo = scoped.resolve('repositories').taskLogs;
  const sopRepo = scoped.resolve('repositories').sops;
  const empRepo = scoped.resolve('repositories').employees;
  
  // Look up client profile directly from supabaseAdmin to get the exact ID
  const { data: clientProfile } = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const employee = await empRepo.findByTenant();

  console.log('Client Profile ID:', clientProfile?.id, 'Employee:', employee?.name);

  if (typeof sopRepo.ensureDefaultChat === 'function') {
    await sopRepo.ensureDefaultChat({ tenantId, clientProfileId: clientProfile?.id });
  }

  // 1. Submit a 'hi' chat task with valid client_profile_id
  const hiIdempotency = crypto.randomUUID();
  const hiTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfile?.id,
    task_type: 'chat',
    idempotency_key: hiIdempotency,
    payload: {
      message: 'hi',
      employee_id: employee?.id,
      audience: 'internal',
    }
  });

  console.log('Enqueued hiTask:', hiTask.id);
  const hiProcessed = await workerEngine.processTask(hiTask, { workerId: 'test-worker' });
  console.log('Processed hiTask result status:', hiProcessed?.status);

  const hiLogs = await taskLogsRepo.listByTaskId(hiTask.id);
  const hiCompletion = [...hiLogs].reverse().find(log => log.to_status === 'completed' && log.metadata?.result);
  console.log('\n================ LITERAL RESPONSE FOR "hi" ================');
  console.log(JSON.stringify(hiCompletion?.metadata?.result, null, 2));

  // 2. Submit 'how\'s my team doing'
  const teamIdempotency = crypto.randomUUID();
  const teamTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfile?.id,
    task_type: 'chat',
    idempotency_key: teamIdempotency,
    payload: {
      message: "how's my team doing",
      employee_id: employee?.id,
      audience: 'internal',
    }
  });

  console.log('\nEnqueued teamTask:', teamTask.id);
  const teamProcessed = await workerEngine.processTask(teamTask, { workerId: 'test-worker' });
  console.log('Processed teamTask result status:', teamProcessed?.status);

  const teamLogs = await taskLogsRepo.listByTaskId(teamTask.id);
  const teamCompletion = [...teamLogs].reverse().find(log => log.to_status === 'completed' && log.metadata?.result);
  console.log('\n================ LITERAL RESPONSE FOR "how\'s my team doing" ================');
  console.log(JSON.stringify(teamCompletion?.metadata?.result, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('Error running test script:', err);
  process.exit(1);
});

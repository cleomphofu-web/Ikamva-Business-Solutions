import crypto from 'node:crypto';
import supabaseAdmin from '../backend/lib/supabase-admin.js';
import { createExecutionContainer, createTenantExecutionContainer } from '../backend/container/createExecutionContainer.js';

async function main() {
  const root = createExecutionContainer({ supabaseAdmin });
  const tenantId = process.env.IKAMVA_TENANT_ID || '45022903-1067-4f7b-8d1a-84329af38825';
  const scoped = createTenantExecutionContainer({ tenantId, rootContainer: root });

  const workerEngine = scoped.resolve('workerEngine');
  const queueService = scoped.resolve('queueService');
  const taskLogsRepo = scoped.resolve('repositories').taskLogs;
  const empRepo = scoped.resolve('repositories').employees;
  const sopRepo = scoped.resolve('repositories').sops;

  const { data: clientProfile } = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const employee = await empRepo.findByTenant();

  if (typeof sopRepo.ensureDefaultEmailWorkflow === 'function') {
    await sopRepo.ensureDefaultEmailWorkflow({ tenantId, clientProfileId: clientProfile?.id, taskType: 'email_response' });
  }

  console.log('=== 1. Live Account Owner Chat Task (audience: account_owner) ===');
  const chatTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfile?.id,
    task_type: 'chat',
    idempotency_key: crypto.randomUUID(),
    payload: {
      message: 'status check on my account',
      employee_id: employee?.id,
      audience: 'internal',
    }
  });

  await workerEngine.processTask(chatTask, { workerId: 'live-audience-verifier' });
  const chatLogs = await taskLogsRepo.listByTaskId(chatTask.id);
  const chatCompletion = [...chatLogs].reverse().find(log => log.to_status === 'completed' && log.metadata?.result);
  const chatPrompt = chatCompletion?.metadata?.result?.prompt || '';
  const chatHasMemory = chatPrompt.includes('RECENT MEMORY:');
  console.log('Chat Task ID:', chatTask.id);
  console.log('Chat Prompt has RECENT MEMORY section?:', chatHasMemory);
  if (chatHasMemory) {
    const memoryPart = chatPrompt.split('RECENT MEMORY:')[1]?.split('\n\n')[0] || '';
    console.log('Chat Recalled Memory snippet:\n', memoryPart.slice(0, 300));
  }

  console.log('\n=== 2. Live Fresh Customer Email Task (audience: end_customer, no thread_id) ===');
  const emailTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfile?.id,
    task_type: 'email_response',
    idempotency_key: crypto.randomUUID(),
    payload: {
      message: 'Hello, I am a new customer inquiring about your pricing.',
      sender: 'newcustomer@example.com',
      to: 'sales@example.com',
      subject: 'Inquiry on pricing',
      thread_id: null,
      employee_id: employee?.id,
    }
  });

  await workerEngine.processTask(emailTask, { workerId: 'live-audience-verifier' });
  const emailLogs = await taskLogsRepo.listByTaskId(emailTask.id);
  const emailCompletion = [...emailLogs].reverse().find(log => (log.to_status === 'completed' || log.to_status === 'awaiting_human' || log.to_status === 'processing') && log.metadata?.result);
  const emailPrompt = emailCompletion?.metadata?.result?.prompt || '';
  const emailHasMemory = emailPrompt.includes('RECENT MEMORY:');
  console.log('Email Task ID:', emailTask.id);
  console.log('Customer Email Prompt has RECENT MEMORY section?:', emailHasMemory);
  if (emailHasMemory) {
    console.error('LEAK DETECTED: Customer email contained RECENT MEMORY!');
    console.error(emailPrompt.split('RECENT MEMORY:')[1]?.slice(0, 300));
  } else {
    console.log('CONFIRMED: Customer email prompt contained ZERO recalled chat memories.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

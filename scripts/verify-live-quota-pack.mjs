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

  // 1. Fetch current client profile & employee
  const { data: clientProfile } = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const employee = await empRepo.findByTenant();

  console.log('--- Initial Profile State ---');
  console.log('Tenant ID:', tenantId);
  console.log('Client Profile ID:', clientProfile?.id);
  console.log('Pack Size:', clientProfile?.pack_size);
  console.log('Tasks Used This Cycle:', clientProfile?.tasks_used_this_cycle);
  console.log('Employee Lifecycle Status:', employee?.lifecycle_status);

  // 2. Ask Manager about task quota status
  console.log('\n=== Asking Manager: "How much quota do we have left?" ===');
  const chatTask = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfile?.id,
    task_type: 'chat',
    idempotency_key: crypto.randomUUID(),
    payload: {
      message: 'How much quota do we have left this cycle?',
      employee_id: employee?.id,
      audience: 'internal',
    }
  });

  const chatResult = await workerEngine.processTask(chatTask, { workerId: 'live-quota-verifier' });
  const chatLogs = await taskLogsRepo.listByTaskId(chatTask.id);
  const chatCompletion = [...chatLogs].reverse().find(log => log.to_status === 'completed' && log.metadata?.result);
  const chatPrompt = chatCompletion?.metadata?.result?.prompt || '';
  const chatOutput = chatResult?.payload?.result?.output?.content || chatCompletion?.metadata?.result?.output?.content || '';

  const hasQuotaGrounding = chatPrompt.includes('LIVE TASK QUOTA STATUS:');
  console.log('Prompt contains LIVE TASK QUOTA STATUS?:', hasQuotaGrounding);
  if (hasQuotaGrounding) {
    const quotaSection = chatPrompt.split('LIVE TASK QUOTA STATUS:')[1]?.split('\n\n')[0] || '';
    console.log('Injected Grounding Block:\n' + quotaSection.trim());
  }
  console.log('\nLiteral Manager Response:\n', chatOutput.trim());

  // 3. Re-check profile state to confirm account_owner chat did not increment quota
  const { data: profileAfterChat } = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  console.log('\n--- Profile State After Manager Chat ---');
  console.log('Tasks Used This Cycle:', profileAfterChat?.tasks_used_this_cycle);
  console.log('Quota unchanged for account_owner chat?:', profileAfterChat?.tasks_used_this_cycle === clientProfile?.tasks_used_this_cycle);
}

main().catch(err => {
  console.error('Verification script failed:', err);
  process.exit(1);
});

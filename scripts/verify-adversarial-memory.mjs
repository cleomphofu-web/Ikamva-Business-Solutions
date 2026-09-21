import crypto from 'node:crypto';
import supabaseAdmin from '../backend/lib/supabase-admin.js';
import { createExecutionContainer, createTenantExecutionContainer } from '../backend/container/createExecutionContainer.js';

async function testPrompt(message) {
  const root = createExecutionContainer({ supabaseAdmin });
  const tenantId = process.env.IKAMVA_TENANT_ID || '45022903-1067-4f7b-8d1a-84329af38825';
  const scoped = createTenantExecutionContainer({ tenantId, rootContainer: root });

  const workerEngine = scoped.resolve('workerEngine');
  const queueService = scoped.resolve('queueService');
  const taskLogsRepo = scoped.resolve('repositories').taskLogs;
  const empRepo = scoped.resolve('repositories').employees;

  const { data: clientProfile } = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const employee = await empRepo.findByTenant();

  const task = await queueService.enqueueTask({
    tenant_id: tenantId,
    client_profile_id: clientProfile?.id,
    task_type: 'chat',
    idempotency_key: crypto.randomUUID(),
    payload: {
      message,
      employee_id: employee?.id,
      audience: 'internal',
    }
  });

  await workerEngine.processTask(task, { workerId: 'adversarial-tester' });

  const logs = await taskLogsRepo.listByTaskId(task.id);
  const completion = [...logs].reverse().find(log => log.to_status === 'completed' && log.metadata?.result);
  console.log(`\n================ QUESTION: "${message}" ================`);
  console.log('LITERAL RESPONSE:');
  console.log(completion?.metadata?.result?.output?.content);
}

async function main() {
  console.log('Running Adversarial Grounding Tests against live Groq model...');
  await testPrompt("what's our SLA compliance");
  await testPrompt("when's the next review");
  await testPrompt("what's our onboarding completion rate");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * workforce.js
 *
 * POST /api/v1/workforce/tasks (and /api/v1/workforce/chat for chat interactions)
 *
 * Authenticated HTTP entry point into the WorkerEngine.
 * Flow:
 *   1. Verify Supabase JWT
 *   2. Resolve tenant from client_profiles
 *   3. Validate payload
 *   4. Enqueue task via QueueService
 *   5. Execute synchronously via WorkerEngine (inline for MVP)
 *   6. Return { task_id, status, result }
 *
 * This handler is mounted by api/router.js into the Vite dev server or a
 * future standalone Node HTTP server.
 */
import supabaseAdmin from '../lib/supabase-admin.js';
import { createExecutionContainer, createTenantExecutionContainer } from '../container/createExecutionContainer.js';
import crypto from 'node:crypto';
import { buildStoredEmployeePrompt } from '../services/EmployeePromptService.js';
import { extractDocumentText } from '../services/PdfTextExtractor.js';

// Root container — created once, shared across requests.
let _rootContainer = null;

export function getRootContainer() {
  if (!_rootContainer) {
    _rootContainer = createExecutionContainer({ supabaseAdmin });
  }
  return _rootContainer;
}

// ─── Request Handler ──────────────────────────────────────────────────────────

export async function handleTaskSubmit(req, res) {
  // 1. Authenticate via Supabase JWT from Authorization header
  const authHeader = req.headers['authorization'] ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    return sendError(res, 401, 'Missing Authorization header');
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) {
    return sendError(res, 401, 'Invalid or expired token');
  }

  // 2. Resolve client profile / tenant
  const { data: tenantUser, error: membershipError } = await supabaseAdmin
    .from('tenant_users')
    .select('id, tenant_id, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    console.error('Failed to resolve tenant membership:', membershipError);
    return sendError(res, 500, 'Failed to resolve client profile');
  }

  if (!tenantUser) {
    return sendError(res, 403, 'No client profile found. Complete onboarding first.');
  }

  const { data: clientProfile, error: profileError } = await supabaseAdmin
    .from('client_profiles')
    .select('*')
    .eq('tenant_user_id', tenantUser.id)
    .maybeSingle();

  if (profileError) {
    console.error('Failed to load client profile:', profileError);
    return sendError(res, 500, 'Failed to resolve client profile');
  }

  if (!clientProfile || clientProfile.status !== 'active') {
    return sendError(res, 403, `Account is not active. Status: ${clientProfile?.status ?? 'missing'}`);
  }

  // 3. Parse and validate payload
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendError(res, 400, 'Invalid JSON body');
  }

  const { message, task_type = 'chat' } = body ?? {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return sendError(res, 400, 'Request body must include a non-empty "message" string');
  }

  const allowedTaskTypes = new Set(['chat', 'email', 'job']);
  if (!allowedTaskTypes.has(task_type)) {
    return sendError(res, 400, `Unsupported task_type: ${task_type}`);
  }

  const tenantId = tenantUser.tenant_id;
  const idempotencyKey = body.idempotency_key || crypto
    .createHash('sha256')
    .update(`${user.id}:${task_type}:${message.trim()}`)
    .digest('hex');

  // 4. Enqueue task
  const rootContainer = getRootContainer();
  const tenantContainer = createTenantExecutionContainer({ tenantId, rootContainer });
  const queueService = tenantContainer.resolve('queueService');
  const sopRepository = tenantContainer.resolve('repositories').sops;
  if (typeof sopRepository.ensureDefaultChat === 'function') {
    await sopRepository.ensureDefaultChat({ tenantId, clientProfileId: clientProfile.id });
  }

  let task;
  try {
    task = await queueService.enqueueTask({
      tenant_id: tenantId,
      task_type,
      client_profile_id: clientProfile.id,
      idempotency_key: idempotencyKey,
      payload: { message: message.trim() },
    });
  } catch (enqueueError) {
    console.error('Failed to enqueue task:', enqueueError);
    return sendError(res, 500, 'Failed to enqueue task');
  }

  // 5. Enqueue and return immediately; the worker owns long-running provider work.
  const workerEngine = tenantContainer.resolve('workerEngine');
  void workerEngine.processTask(task, { workerId: 'api-worker' }).catch(error => {
    console.error('WorkerEngine execution error:', error);
  });
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ task_id: task.id }));
}

async function tenantFromRequest(req) {
  const jwt = (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw Object.assign(new Error('Missing Authorization header'), { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !user) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  const { data, error: membershipError } = await supabaseAdmin.from('tenant_users').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (membershipError) throw Object.assign(new Error('Failed to resolve client profile'), { status: 500 });
  if (!data) throw Object.assign(new Error('No active client profile found.'), { status: 403 });
  return { tenantId: data.tenant_id, user };
}

export async function handleEmployeeRequest(req, res) {
  try {
    const { tenantId } = await tenantFromRequest(req);
    const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
    const employees = scoped.resolve('repositories').employees;
    const path = req.url.split('?')[0];
    if (req.method === 'GET' && path.endsWith('/me')) return json(res, 200, { employee: await employees.findByTenant() });
    if (req.method === 'POST') return json(res, 201, { employee: await employees.create(await readBody(req)) });
    const action = path.split('/').at(-1);
    const id = ['activate', 'regenerate-prompt', 'memory'].includes(action) ? path.split('/').at(-2) : action;
    const employee = await employees.findById(id);
    if (!employee) return json(res, 404, { error: 'Employee not found' });
    if (req.method === 'GET' && action === 'memory') {
      const page = Math.max(0, Number(new URL(req.url, 'http://localhost').searchParams.get('page') || 0));
      const limit = Math.min(100, Math.max(1, Number(new URL(req.url, 'http://localhost').searchParams.get('limit') || 20)));
      const memories = await scoped.resolve('repositories').employeeMemory.listByEmployee(id, { limit, offset: page * limit });
      return json(res, 200, { memories, page, limit });
    }
    if (req.method === 'PATCH' && path.endsWith('/regenerate-prompt')) {
      const refreshed = await employees.update(id, { configuration: { ...(employee.configuration || {}), system_prompt: buildStoredEmployeePrompt(employee) } });
      return json(res, 200, { employee: refreshed });
    }
    if (req.method === 'PATCH' && path.endsWith('/activate')) {
      const updated = await employees.update(id, { configuration: { ...(employee.configuration || {}), system_prompt: buildStoredEmployeePrompt(employee) } });
      const activated = await employees.activate(id);
      return json(res, 200, { employee: activated || updated });
    }
    if (req.method === 'PATCH' || (req.method === 'POST' && req.url.endsWith('/decision'))) {
      const fields = await readBody(req);
      const merged = { ...employee, ...fields, configuration: { ...(employee.configuration || {}), ...(fields.configuration || {}) } };
      if (employee.lifecycle_status === 'active') merged.configuration.system_prompt = buildStoredEmployeePrompt(merged);
      return json(res, 200, { employee: await employees.update(id, { ...fields, configuration: merged.configuration }) });
    }
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) { console.error('[API] Employee request failed:', error); return json(res, error.status || 500, { error: error.message || 'Employee request failed' }); }
}

export async function handleKnowledgeIngest(req, res) {
  try {
    // Parse and validate the small request envelope before auth/database work.
    // Binary documents use content_base64; plain uploads must provide content.
    const body = await readBody(req);
    const suppliedContent = body.content ?? body.document ?? body.file;
    if (typeof suppliedContent !== 'string' || !suppliedContent.trim()) return json(res, 400, { error: 'Request must include document content.' });
    const { tenantId } = await tenantFromRequest(req);
    const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
    const sourceFile = String(body.source_file || body.filename || body.title || 'uploaded-document.txt');
    const binaryType = String(body.fileType || body.mime_type || '').toLowerCase();
    let content = suppliedContent;
    if (['pdf', 'doc', 'docx', 'xlsx'].includes(binaryType.replace(/^.*\//, '')) || /\.(pdf|doc|docx|xlsx)$/i.test(sourceFile)) {
      if (suppliedContent.length > 14_000_000) return json(res, 400, { error: 'Document upload is too large or invalid.' });
      let buffer;
      try { buffer = Buffer.from(suppliedContent, 'base64'); } catch { return json(res, 400, { error: 'Invalid document upload.' }); }
      try { content = await extractDocumentText(buffer, { filename: sourceFile, mimeType: body.mime_type || '' }); } catch (error) { return json(res, error.status || 400, { error: error.message }); }
    }
    if (!content.trim()) return json(res, 400, { error: 'Request must include document content.' });
    const employee = await scoped.resolve('repositories').employees.findByTenant();
    if (!employee) return json(res, 409, { error: 'Create an Employee before ingesting knowledge.' });
    const words = content.trim().split(/\s+/);
    const chunks = [];
    for (let index = 0; index < words.length; index += 500) chunks.push({ logical_key: `${employee.id}:${sourceFile}:${chunks.length}`, title: sourceFile, category: 'company_brain', source: sourceFile, content: words.slice(index, index + 500).join(' '), author_id: null, source_type: 'upload', ingestion_status: 'complete' });
    const rows = await scoped.resolve('repositories').companyKnowledge.createChunks(chunks);
    const embeddingService = getRootContainer().resolve('embeddingService');
    if (embeddingService.apiKey) {
      await Promise.all(rows.map(async row => {
        const embedding = await embeddingService.embed(row.content);
        await scoped.resolve('repositories').companyKnowledge.updateEmbedding(row.id, embedding);
      }));
    }
    return json(res, 200, { chunks: rows.map(row => ({ id: row.id, chunk_index: chunks.findIndex(chunk => chunk.logical_key === row.logical_key), source_file: sourceFile })) });
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Knowledge ingestion failed' }); }
}
export async function handleKnowledgeList(req, res) {
  try { const { tenantId } = await tenantFromRequest(req); const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() }); return json(res, 200, { sources: await scoped.resolve('repositories').companyKnowledge.list() }); }
  catch (error) { return json(res, error.status || 500, { error: error.message || 'Knowledge listing failed' }); }
}

export async function handleActivityLogs(req, res) {
  try {
    const { tenantId } = await tenantFromRequest(req);
    const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
    const limit = Math.min(100, Math.max(1, Number(new URL(req.url, 'http://localhost').searchParams.get('limit') || 50)));
    const logs = await scoped.resolve('repositories').employeeActivityLogs.list({ tenantId, limit });
    return json(res, 200, { logs });
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Activity logs unavailable' }); }
}

export async function handleApprovals(req, res) {
  try {
    const { tenantId, user } = await tenantFromRequest(req);
    const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
    const repos = scoped.resolve('repositories');
    const approvalRepo = repos.approvals;
    if (req.method === 'GET') return json(res, 200, { approvals: await approvalRepo.list() });
    if (req.method === 'PATCH' || (req.method === 'POST' && req.url.includes('/decision'))) {
      const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
      const isDecision = urlParts.at(-1) === 'decision';
      const id = isDecision ? urlParts.at(-2) : urlParts.at(-1);
      const body = await readBody(req);
      if (!['approved', 'rejected'].includes(body.status)) return json(res, 400, { error: 'Invalid approval status' });
      
      const existingApproval = await approvalRepo.findById(id);
      if (!existingApproval) return json(res, 404, { error: 'Approval not found' });

      const updated = await approvalRepo.updateStatus(id, body.status, user.id, body.review_note || null);

      if (existingApproval.task_id) {
        const task = await repos.taskQueue.findById(existingApproval.task_id);
        if (task && task.status === 'awaiting_human') {
          const workerEngine = scoped.resolve('workerEngine');
          if (body.status === 'approved') {
            const integration = await repos.tenantIntegrations.findByProvider('gmail');
            const credentialReference = integration?.credential_reference || null;
            await workerEngine.resumeApprovedTask(task, { ...existingApproval, ...updated }, {
              reviewedBy: user.id,
              credentialReference,
            });
          } else if (body.status === 'rejected') {
            await workerEngine.rejectTask(task, { ...existingApproval, ...updated }, {
              reviewedBy: user.id,
              reviewNote: body.review_note || '',
              credentialReference,
            });
          }
        }
      }

      return json(res, 200, { approval: updated });
    }
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Approvals unavailable' }); }
}

export async function handleIntegrations(req, res) {
  try {
    const { tenantId } = await tenantFromRequest(req);
    const scoped = createTenantExecutionContainer({ tenantId, rootContainer: getRootContainer() });
    return json(res, 200, { integrations: await scoped.resolve('repositories').tenantIntegrations.list() });
  } catch (error) { return json(res, error.status || 500, { error: error.message || 'Integrations unavailable' }); }
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export async function handleChatStatus(req, res) {
  const jwt = (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return sendError(res, 401, 'Missing Authorization header');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !user) return sendError(res, 401, 'Invalid or expired token');
  const membership = await supabaseAdmin.from('tenant_users').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (membership.error) return sendError(res, 500, 'Failed to resolve client profile');
  if (!membership.data) return sendError(res, 403, 'No active client profile found.');
  const taskId = req.url.split('/').filter(Boolean).at(-2);
  const rootContainer = getRootContainer();
  const scoped = createTenantExecutionContainer({ tenantId: membership.data.tenant_id, rootContainer });
  const repos = scoped.resolve('repositories');
  const task = await repos.taskQueue.findById(taskId);
  if (!task) return sendError(res, 404, 'Task not found');
  const logs = await repos.taskLogs.listByTaskId(taskId);
  const completion = [...logs].reverse().find(log => log.to_status === 'completed' && log.metadata?.result);
  const failed = [...logs].reverse().find(log => log.to_status === 'failed');
  const payload = { task_id: task.id, status: task.status };
  if (completion) payload.result = completion.metadata.result;
  if (failed) payload.error = 'The Employee could not complete that request.';
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export async function handleChatHistory(req, res) {
  const jwt = (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return sendError(res, 401, 'Missing Authorization header');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !user) return sendError(res, 401, 'Invalid or expired token');
  const membership = await supabaseAdmin.from('tenant_users').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (membership.error) return sendError(res, 500, 'Failed to resolve client profile');
  if (!membership.data) return sendError(res, 403, 'No active client profile found.');
  const { data: tasks, error: taskError } = await supabaseAdmin
    .from('task_queue')
    .select('id, payload, status, created_at')
    .eq('tenant_id', membership.data.tenant_id)
    .eq('task_type', 'chat')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);
  if (taskError) return sendError(res, 500, 'Failed to load chat history');
  const exchanges = [];
  for (const task of tasks ?? []) {
    const { data: logs, error: logError } = await supabaseAdmin
      .from('task_logs')
      .select('metadata, created_at')
      .eq('task_id', task.id)
      .eq('to_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);
    if (logError) return sendError(res, 500, 'Failed to load chat history');
    const content = logs?.[0]?.metadata?.result?.output?.content;
    const message = task.payload?.message;
    if (typeof message === 'string' && typeof content === 'string' && content.trim()) {
      exchanges.push({ task_id: task.id, created_at: task.created_at, message, response: content });
    }
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ exchanges: exchanges.reverse() }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

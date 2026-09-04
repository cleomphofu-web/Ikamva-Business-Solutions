/**
 * api-client.js
 *
 * Authenticated fetch wrapper for /api/v1.
 * Injects the current Supabase session JWT into every request.
 * Never exposes the service-role key — uses the anon session token only.
 */
import { supabase } from '@/lib/supabase-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function getAuthHeader({ refresh = false, token } = {}) {
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  const response = refresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  const { data: { session } } = response;
  if (!session?.access_token) {
    throw new Error('Not authenticated. Sign in before calling the API.');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request(path, { method = 'GET', body, signal, auth = true, token } = {}) {
  let authHeader = auth ? await getAuthHeader({ token }) : {};
  let res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // A browser can retain a stale access token while Supabase still has a
  // refresh token. Refresh once, then retry the same request. Never retry
  // non-auth failures or requests without authentication.
  if (auth && res.status === 401) {
    try {
      authHeader = await getAuthHeader({ refresh: true });
    } catch (refreshError) {
      refreshError.status = 401;
      throw refreshError;
    }
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(data?.error || `API error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─── Workforce API ─────────────────────────────────────────────────────────────

export const workforceApi = {
  /**
   * Send a message to the AI employee via the WorkerEngine.
   * @param {string} message
   * @param {{ task_type?: string, idempotency_key?: string, signal?: AbortSignal }} options
   * @returns {{ task_id: string, status: string, result: object }}
   */
  async sendMessage(message, { task_type = 'chat', idempotency_key, signal } = {}) {
    return request(task_type === 'chat' ? '/workforce/chat' : '/workforce/tasks', {
      method: 'POST',
      body: { message, task_type, idempotency_key: idempotency_key || (task_type === 'chat' ? crypto.randomUUID() : undefined) },
      signal,
    });
  },
  async getChatStatus(taskId, { signal } = {}) {
    return request(`/workforce/chat/${encodeURIComponent(taskId)}/status`, { signal });
  },
  async getChatHistory({ signal } = {}) {
    return request('/workforce/chat/history', { signal });
  },
  async ingestKnowledge({ content = null, content_base64 = null, mime_type, source_file, title, fileType, metadata }) { return request('/workforce/knowledge/ingest', { method: 'POST', body: { content: content ?? content_base64, title, fileType, metadata, source_file, mime_type } }); },
  async listKnowledge() { return request('/workforce/knowledge'); },
  async listActivityLogs({ limit = 50, signal } = {}) { return request(`/workforce/activity-logs?limit=${limit}`, { signal }); },
  async listApprovals({ signal } = {}) { return request('/workforce/approvals', { signal }); },
  async decideApproval(id, status) { return request(`/workforce/approvals/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { status } }); },
  async listIntegrations({ signal } = {}) { return request('/workforce/integrations', { signal }); },
  async connectGmail(returnTo = '/dashboard/tools') { return request(`/integrations/gmail/connect?return_to=${encodeURIComponent(returnTo)}`); },
  async disconnectGmail() { return request('/integrations/gmail/disconnect', { method: 'POST' }); },
};

export const employeeApi = {
  async getMine({ signal } = {}) { return request('/workforce/employees/me', { signal }); },
  async create(fields) { return request('/workforce/employees', { method: 'POST', body: fields }); },
  async update(id, fields) { return request(`/workforce/employees/${encodeURIComponent(id)}`, { method: 'PATCH', body: fields }); },
  async activate(id) { return request(`/workforce/employees/${encodeURIComponent(id)}/activate`, { method: 'PATCH' }); },
  async memory(id, { page = 0, limit = 20 } = {}) { return request(`/workforce/employees/${encodeURIComponent(id)}/memory?page=${page}&limit=${limit}`); },
};

// ─── Access / Applications API ────────────────────────────────────────────────

export const accessApi = {
  async getState({ signal, token } = {}) {
    return request('/access', { signal, token });
  },
};

export const applicationsApi = {
  async createApplication(payload) {
    return request('/applications', {
      method: 'POST',
      body: payload,
    });
  },

  async list({ status, signal } = {}) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/applications${query}`, { signal });
  },

  async review(id, body) {
    return request(`/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  },
};

export const crmContactsApi = {
  async list({ signal } = {}) {
    return request('/crm/contacts', { signal });
  },

  async upsert(contact) {
    return request('/crm/contacts', { method: 'POST', body: contact });
  },
};

export const crmContactNotesApi = {
  async list(contactId, { signal } = {}) { return request(`/crm/contacts/${encodeURIComponent(contactId)}/notes`, { signal }); },
  async create(contactId, note) { return request(`/crm/contacts/${encodeURIComponent(contactId)}/notes`, { method: 'POST', body: note }); },
  async remove(contactId, noteId) { return request(`/crm/contacts/${encodeURIComponent(contactId)}/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' }); },
};
export const crmLeadsApi = {
  async list({ signal } = {}) { return request('/crm/leads', { signal }); },
  async upsert(lead) { return request('/crm/leads', { method: 'POST', body: lead }); },
  async remove(id) { return request(`/crm/leads/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
};
export const crmAccountsApi = { async summary({ signal } = {}) { return request('/crm/accounts/summary', { signal }); } };
export const crmProjectsApi = { async list({ signal } = {}) { return request('/crm/projects', { signal }); }, async create(project) { return request('/crm/projects', { method: 'POST', body: project }); }, async update(id, project) { return request(`/crm/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: project }); }, async remove(id) { return request(`/crm/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }); } };

export default workforceApi;

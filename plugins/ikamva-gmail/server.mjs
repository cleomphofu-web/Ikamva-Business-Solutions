import readline from 'node:readline';

const env = process.env;
const clientId = env.GMAIL_CLIENT_ID;
const clientSecret = env.GMAIL_CLIENT_SECRET;
const refreshToken = env.GMAIL_REFRESH_TOKEN;
const api = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function accessToken() {
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || 'Gmail OAuth token refresh failed.');
  return data.access_token;
}

async function gmail(path, options = {}) { const token = await accessToken(); const response = await fetch(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Gmail API request failed.'); return data; }
async function call(method, params = {}) {
  if (method === 'tools/list') return { tools: [{ name: 'gmail_list_messages', description: 'List recent Gmail messages for client triage.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } } } }, { name: 'gmail_get_message', description: 'Read one Gmail message.', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } ] };
  if (method === 'tools/call') { const { name, arguments: args = {} } = params; if (name === 'gmail_list_messages') return gmail(`/messages?q=${encodeURIComponent(args.query || 'in:inbox newer_than:7d')}&maxResults=${Math.min(args.maxResults || 10, 25)}`); if (name === 'gmail_get_message') return gmail(`/messages/${encodeURIComponent(args.id)}?format=metadata`); }
  if (method === 'initialize') return { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'ikamva-gmail', version: '0.1.0' } };
  return {};
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => { try { const request = JSON.parse(line); const result = await call(request.method, request.params); process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`); } catch (error) { const request = JSON.parse(line); process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error.message } })}\n`); } });

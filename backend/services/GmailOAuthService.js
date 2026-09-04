import crypto from 'node:crypto';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.compose'];
const key = () => {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is required for Gmail OAuth.');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return decoded;
};
const b64 = value => Buffer.from(value).toString('base64url');
const unb64 = value => Buffer.from(value, 'base64url');

export function encryptRefreshToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ciphertext)}`;
}
export function decryptRefreshToken(envelope) {
  const [, iv, tag, ciphertext] = String(envelope).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), unb64(iv));
  decipher.setAuthTag(unb64(tag));
  return Buffer.concat([decipher.update(unb64(ciphertext)), decipher.final()]).toString('utf8');
}
export function createOAuthState(tenantId, returnPath = '/dashboard/tools') {
  const safeReturnPath = typeof returnPath === 'string' && returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/dashboard/tools';
  const payload = b64(JSON.stringify({ tenantId, returnPath: safeReturnPath, exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() }));
  const signature = b64(crypto.createHmac('sha256', key()).update(payload).digest());
  return `${payload}.${signature}`;
}
export function readOAuthState(state) {
  const [payload, signature] = String(state).split('.');
  const expected = crypto.createHmac('sha256', key()).update(payload).digest();
  if (!crypto.timingSafeEqual(unb64(signature), expected)) throw new Error('Invalid OAuth state.');
  const value = JSON.parse(unb64(payload));
  if (!value.tenantId || value.exp < Date.now()) throw new Error('Expired OAuth state.');
  return value;
}
export function gmailConsentUrl(tenantId, returnPath) {
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', redirect_uri: process.env.GOOGLE_REDIRECT_URI || '', response_type: 'code', access_type: 'offline', prompt: 'consent', scope: SCOPES.join(' '), state: createOAuthState(tenantId, returnPath) });
  if (!params.get('client_id') || !params.get('redirect_uri')) throw new Error('Google OAuth configuration is incomplete.');
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function exchangeCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', redirect_uri: process.env.GOOGLE_REDIRECT_URI || '', grant_type: 'authorization_code' }) });
  const body = await response.json();
  if (!response.ok || !body.refresh_token) throw new Error('Google OAuth token exchange failed.');
  return body;
}

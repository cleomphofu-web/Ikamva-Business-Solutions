import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const localEnv = (() => {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
      const separator = line.indexOf('=');
      return separator === -1 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
    }));
})();

const required = (name, value) => {
  if (!value || !String(value).trim()) throw new Error(`Missing required backend environment variable: ${name}`);
  return String(value).trim();
};

export const readWorkerEnvironment = (env = { ...localEnv, ...process.env }) => ({
  supabaseUrl: required('SUPABASE_URL', env.SUPABASE_URL || env.VITE_SUPABASE_URL),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY),
  tenantId: required('IKAMVA_TENANT_ID', env.IKAMVA_TENANT_ID),
  workerId: env.IKAMVA_WORKER_ID || `worker-${process.pid}`,
  healthHost: env.IKAMVA_WORKER_HEALTH_HOST || '0.0.0.0',
  healthPort: Number(env.IKAMVA_WORKER_HEALTH_PORT || 4190),
  pollIntervalMs: Number(env.IKAMVA_WORKER_POLL_INTERVAL_MS || 1000),
  lockTimeoutMinutes: Number(env.IKAMVA_WORKER_LOCK_TIMEOUT_MINUTES || 10),
  aiProvider: env.AI_PROVIDER || 'groq',
  groqApiKey: env.GROQ_API_KEY || '',
});

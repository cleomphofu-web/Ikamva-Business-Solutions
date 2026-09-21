/**
 * supabase-admin.js
 *
 * Backend-only Supabase client using the service-role key.
 * This file MUST NEVER be imported into any frontend/browser bundle.
 * It lives in backend/ which is never included in the Vite build.
 */
import { createClient } from '@supabase/supabase-js';
import { setDefaultResultOrder } from 'node:dns';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

setDefaultResultOrder('ipv4first');

function readLocalEnv() {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=');
        if (separator === -1) return [line, ''];
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

const localEnv = readLocalEnv();
// The API is also launched as a child of Vite. Load backend-only provider
// settings from the same local environment file so provider selection is
// deterministic regardless of the parent process environment.
for (const key of ['GEMINI_API_KEY', 'GEMINI_EMBEDDING_MODEL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL', 'OPENAI_API_KEY', 'AI_provider_chatGPT_API', 'OPENAI_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'AI_PROVIDER', 'EMAIL_PROVIDER_API_KEY', 'EMAIL_PROVIDER_URL', 'EMAIL_FROM', 'REPOSITORY_PROVIDER', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'ENCRYPTION_KEY']) {
  if (!process.env[key] && localEnv[key]) process.env[key] = localEnv[key];
}
const supabaseUrl = localEnv.SUPABASE_URL || localEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = localEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing backend Supabase environment variables. ' +
    'Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabaseAdmin;

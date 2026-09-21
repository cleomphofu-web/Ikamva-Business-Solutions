/**
 * Tier 0 verification: 10 consecutive sign-in attempts via the API.
 * This tests the exact code path clients use: POST /api/v1/access
 * after a successful signInWithPassword().
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqoesfyafwakfpawufok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xb2VzZnlhZndha2ZwYXd1Zm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjkyMDQsImV4cCI6MjEwMDIwNTIwNH0.YwdT79Ax84gv_IcCOajYZfQCHEkJr-rxSqhRQOEMICk';
const API_BASE = 'http://127.0.0.1:4178/api/v1';
const EMAIL = 'cleoautomations@gmail.com';
const PASSWORD = 'Password123!';

let passed = 0;
let failed = 0;

for (let run = 1; run <= 10; run++) {
  // Fresh Supabase client per run (simulates fresh browser session)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Step 1: Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

  if (authError || !authData?.session?.access_token) {
    console.error(`Run ${run}: FAILED — signInWithPassword error: ${authError?.message || 'no session'}`);
    failed++;
    continue;
  }

  // Step 2: Hit /api/v1/access with the access token (the exact call the frontend makes)
  const token = authData.session.access_token;
  let status, body;
  try {
    const res = await fetch(`${API_BASE}/access`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    status = res.status;
    body = await res.json().catch(() => ({}));
  } catch (fetchErr) {
    console.error(`Run ${run}: FAILED — fetch error: ${fetchErr.message}`);
    failed++;
    continue;
  }

  if (status === 200) {
    console.log(`Run ${run}: SUCCESS — status=${status}, tenant=${body?.tenant_id || '?'}`);
    passed++;
  } else {
    console.error(`Run ${run}: FAILED — status=${status}, body=${JSON.stringify(body)}`);
    failed++;
  }

  // Brief pause to avoid hammering
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\n--- TIER 0 RESULT ---`);
console.log(`Passed: ${passed}/10`);
console.log(`Failed: ${failed}/10`);
if (passed === 10) {
  console.log('TIER 0 VERIFIED: 10/10 sign-ins succeeded with zero 401s.');
} else {
  console.log('TIER 0 FAILED: See individual run results above.');
  process.exit(1);
}

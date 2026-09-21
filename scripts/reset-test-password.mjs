import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nqoesfyafwakfpawufok.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xb2VzZnlhZndha2ZwYXd1Zm9rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYyOTIwNCwiZXhwIjoyMTAwMjA1MjA0fQ.s3DOA3rm111km8NPumueo076jgDhqXJhRFxboMCn8BE'
);

const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
if (listError) { console.error('listUsers error:', listError.message); process.exit(1); }

const user = users.find(u => u.email === 'cleoautomations@gmail.com');
if (!user) { console.error('User not found'); process.exit(1); }

console.log('Found user:', user.id, user.email);

const { error } = await supabase.auth.admin.updateUserById(user.id, { password: 'Password123!' });
if (error) { console.error('Reset error:', error.message); process.exit(1); }
console.log('Password successfully reset to: Password123!');

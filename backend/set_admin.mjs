import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqoesfyafwakfpawufok.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xb2VzZnlhZndha2ZwYXd1Zm9rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYyOTIwNCwiZXhwIjoyMTAwMjA1MjA0fQ.s3DOA3rm111km8NPumueo076jgDhqXJhRFxboMCn8BE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndSetAdmin() {
  const email = 'cleoautomations@gmail.com';
  const newPassword = 'SamAdmin44#';

  console.log(`Checking user: ${email}`);
  
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  let user = users.find(u => u.email === email);

  if (!user) {
    console.log(`User not found. Creating ${email}...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: newPassword,
      email_confirm: true,
      app_metadata: { role: 'admin' }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    console.log('User created as admin with specified password.');
  } else {
    console.log(`User found (ID: ${user.id}). Updating password and admin role...`);
    
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        app_metadata: { ...user.app_metadata, role: 'admin' }
      }
    );

    if (updateError) {
      console.error('Error updating user:', updateError);
    } else {
      console.log('User successfully updated to admin role and password reset.');
    }
  }
}

checkAndSetAdmin();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword() {
  const email = 'rishabhkapoor1@atomicmail.io';
  const newPassword = 'Rishabhkapoor';

  console.log(`Resetting password for ${email}...`);

  const { data, error } = await supabase.auth.admin.updateUserById(
    'b525c62e-8066-4268-b9ba-1c022ed7e315', // ID from previous creation
    { password: newPassword }
  );

  if (error) {
    console.error('Error resetting password:', error.message);
  } else {
    console.log('Password successfully reset to:', newPassword);
  }
}

resetPassword();

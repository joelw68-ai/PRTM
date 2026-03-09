import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghqvfgurdkjkouucbpde.supabase.co';
const supabaseKey = 'sb_publishable_xo6sL4dKVHnj9GecyDbIyg_6VGjNFEz';

let supabase: SupabaseClient;

try {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Use PKCE flow for secure email confirmation & password reset links
      flowType: 'pkce',
      // Storage key to avoid conflicts
      storageKey: 'promod-logbook-auth',
    },
  });
} catch (e) {
  console.error('Failed to create Supabase client:', e);
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };

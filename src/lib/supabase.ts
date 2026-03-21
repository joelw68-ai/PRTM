import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isMissingEnv = !supabaseUrl || !supabaseKey;

if (isMissingEnv) {
  console.warn(
    'Missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or deployment dashboard. ' +
    'The app will run in offline/demo mode.'
  );
}

// Use a valid placeholder URL when env vars are missing so createClient doesn't throw.
// The app will operate in a degraded/demo mode without real database connectivity.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

const supabase: SupabaseClient = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseKey || PLACEHOLDER_KEY,
  {
    auth: {
      autoRefreshToken: !isMissingEnv,
      persistSession: !isMissingEnv,
      detectSessionInUrl: !isMissingEnv,
      // Use PKCE flow for secure email confirmation & password reset links
      flowType: 'pkce',
      // Storage key to avoid conflicts
      storageKey: 'promod-logbook-auth',
    },
  }
);

export { supabase };

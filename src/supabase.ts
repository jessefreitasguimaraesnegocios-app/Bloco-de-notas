import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[CyberVault] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (veja .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});

export function handleSupabaseError(error: unknown, operation: string, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Supabase Error:', JSON.stringify({ error: message, operation, path }));
  throw new Error(message);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient<Database>;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables. UI elements relying on this will be non-functional, but no crash will occur.');
  // Create a dummy client to avoid throwing errors and breaking the entire application flow.
  client = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      setSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: new Error('Not configured') }),
      signUp: async () => ({ data: null, error: new Error('Not configured') }),
      signInWithOAuth: async () => ({ data: null, error: new Error('Not configured') }),
      resetPasswordForEmail: async () => ({ data: null, error: new Error('Not configured') }),
      updateUser: async () => ({ data: null, error: new Error('Not configured') }),
    }
  } as any;
} else {
  client = createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = client;

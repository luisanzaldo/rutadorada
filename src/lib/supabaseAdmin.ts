import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

let client: SupabaseClient | null = null;

if (supabaseUrl && serviceRoleKey) {
    client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
} else {
    console.warn(
        'Supabase admin client missing config (PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY). Dashboard data will be empty.'
    );
}

export const supabaseAdmin = client;

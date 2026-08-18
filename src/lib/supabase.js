import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Verifica si Supabase está configurado y disponible.
 * Si no hay credenciales, la app funciona 100% en modo local.
 */
export function isSupabaseConfigured() {
  return supabase !== null;
}

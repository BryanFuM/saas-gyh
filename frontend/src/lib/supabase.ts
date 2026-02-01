/**
 * Supabase Client Configuration
 * 
 * Este archivo configura el cliente de Supabase para el frontend.
 * Asegúrate de tener las variables de entorno configuradas en .env.local
 */
import { createClient } from '@supabase/supabase-js';

// Variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// DEBUG: Verificar variables de entorno (quitar en producción)
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase Config:', {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ MISSING',
    keyPresent: supabaseAnonKey ? '✅ Present' : '❌ MISSING',
  });
}

// Validación de variables de entorno
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.'
  );
}

/**
 * Cliente de Supabase
 * Nota: Usando cliente sin tipos estrictos hasta sincronizar con `supabase gen types`
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Helper para obtener el usuario actual
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Helper para obtener la sesión actual
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export default supabase;

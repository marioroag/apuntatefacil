import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // En dev avisamos claro en vez de fallar con un error críptico.
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y rellénalos (o ejecuta "supabase status").',
  )
}

export const supabase = createClient(url ?? 'http://127.0.0.1:54321', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** ¿Está configurado el backend? (para mensajes de ayuda en dev) */
export const supabaseConfigured = Boolean(url && anonKey)

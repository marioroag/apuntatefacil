import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // En dev avisamos claro en vez de fallar con un error críptico.
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y rellénalos (o ejecuta "supabase status").',
  )
}

// "Recordarme": si está activo (por defecto), la sesión vive en localStorage y
// sobrevive al cerrar el navegador; si no, en sessionStorage y se borra al cerrar.
const REMEMBER_KEY = 'af.remember'

/** Llamar antes de iniciar sesión para elegir si la sesión se recuerda o no. */
export function setRememberMe(remember: boolean) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch { /* almacenamiento no disponible */ }
}

// Storage de la sesión: lee de donde esté; al escribir, elige local o session
// según "Recordarme" (por defecto, recordar, para no desloguear a nadie al cambiar).
const sessionStorageAdapter = {
  getItem: (k: string): string | null => {
    try {
      return window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k: string, v: string) => {
    try {
      const remember = window.localStorage.getItem(REMEMBER_KEY) !== '0'
      if (remember) {
        window.localStorage.setItem(k, v)
        window.sessionStorage.removeItem(k)
      } else {
        window.sessionStorage.setItem(k, v)
        window.localStorage.removeItem(k)
      }
    } catch { /* almacenamiento no disponible */ }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k)
      window.sessionStorage.removeItem(k)
    } catch { /* almacenamiento no disponible */ }
  },
}

export const supabase = createClient(url ?? 'http://127.0.0.1:54321', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE y no el flujo implícito (que es el que supabase-js usa si no se
    // dice nada): con el implícito, el access token y el REFRESH token vuelven
    // de Google y del enlace de reset en el fragmento de la URL, y se quedan en
    // el historial del navegador y al alcance de cualquier extensión. Con PKCE
    // solo viaja un `code` de un uso, que se canjea con el verificador guardado
    // en este mismo storage. Consecuencia que hay que saber: el enlace de reset
    // tiene que abrirse en el navegador que lo pidió, porque el verificador vive
    // aquí. (Auditoría de seguridad, sep 2026.)
    flowType: 'pkce',
    storage: sessionStorageAdapter,
  },
})

/** ¿Está configurado el backend? (para mensajes de ayuda en dev) */
export const supabaseConfigured = Boolean(url && anonKey)

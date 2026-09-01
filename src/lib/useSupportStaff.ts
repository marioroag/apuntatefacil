import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ¿El usuario actual es del equipo de soporte de Apúntate Fácil? Lo decide el backend
// (RPC is_support_staff, allowlist en la migración). Cacheamos el resultado a nivel de
// módulo: una sola llamada por sesión, compartida entre el menú y la pantalla. Se
// invalida al cambiar de sesión (login/logout) para no arrastrar el valor anterior.
let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

function check(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached)
  const p =
    inflight ??
    (inflight = (async () => {
      try {
        const { data } = await supabase.rpc('is_support_staff')
        cached = data === true
      } catch {
        cached = false
      }
      inflight = null
      return cached as boolean
    })())
  return p
}

supabase.auth.onAuthStateChange(() => {
  cached = null
  inflight = null
})

/**
 * Igual pero en TRES estados: `null` mientras se pregunta, y luego sí o no.
 *
 * Hace falta para una PUERTA. Con el booleano de siempre, que arranca en `false`,
 * quien SÍ es del equipo se comería el rechazo en el primer render, antes de que la
 * respuesta llegue del servidor; y adivinar que sí mientras se pregunta sería enseñar
 * un instante lo que hay detrás a quien no debe verlo. La única salida honesta es
 * decir "todavía no lo sé" y que quien pregunta decida qué pinta mientras tanto.
 *
 * Tras la primera llamada, el valor está cacheado a nivel de módulo, así que las
 * siguientes puertas de la misma sesión abren sin esperar.
 */
export function useSoporte(): boolean | null {
  const [staff, setStaff] = useState<boolean | null>(cached)
  useEffect(() => {
    let on = true
    check().then((v) => on && setStaff(v))
    return () => {
      on = false
    }
  }, [])
  return staff
}

export function useIsSupportStaff(): boolean {
  return useSoporte() === true
}

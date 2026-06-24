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

export function useIsSupportStaff(): boolean {
  const [staff, setStaff] = useState(cached ?? false)
  useEffect(() => {
    let on = true
    check().then((v) => on && setStaff(v))
    return () => {
      on = false
    }
  }, [])
  return staff
}

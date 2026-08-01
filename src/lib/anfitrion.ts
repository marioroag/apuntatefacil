import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { InterviewMode } from './types'

/**
 * Cómo y dónde entrevista esta persona, para prerrellenarlo al invitar.
 *
 * Sale de su configuración (Ajustes > Calendario). El sitio NO sale de la
 * ubicación del puesto, que es la zona del anuncio ("Las Palmas") y no una
 * dirección: mandarla como sitio de la cita es decirle al candidato que se
 * presente en una ciudad entera. Antes se usaba esa, y por eso la confirmación
 * acababa sin dirección.
 *
 * Es solo para ENSEÑARLO. Quien decide de verdad qué se guarda es
 * `resolver_lugar_entrevista` en la base, para que los caminos que crean
 * entrevistas no puedan discrepar.
 */
export function useAnfitrion(): { modo: InterviewMode; sitio: string; cargando: boolean } {
  const { company, user } = useAuth()
  const [modo, setModo] = useState<InterviewMode>('presencial')
  const [sitio, setSitio] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    const leer = async () => {
      if (!company?.id || !user?.id || company.id === 'demo') {
        if (vivo) setCargando(false)
        return
      }
      const { data } = await supabase.rpc('interview_host_config', {
        p_company: company.id, p_user: user.id,
      })
      if (!vivo) return
      const c = data as { defaultLocation?: string; defaultMode?: string } | null
      setSitio((c?.defaultLocation ?? '').trim())
      // Solo se acepta una modalidad conocida: si un día se añade una cuarta en
      // la base y esta pantalla es más vieja, mejor caer en presencial que
      // dejar un selector sin ninguna opción marcada.
      if (c?.defaultMode === 'telefonica' || c?.defaultMode === 'videollamada') setModo(c.defaultMode)
      setCargando(false)
    }
    void leer()
    return () => { vivo = false }
  }, [company?.id, user?.id])

  return { modo, sitio, cargando }
}

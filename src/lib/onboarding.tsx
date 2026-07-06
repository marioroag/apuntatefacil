import { useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { useStore } from './store'
import { useAppBase } from './useAppBase'
import type { Campaign } from './types'

// ----------------------------------------------------------------------------
// Guía de primer uso (onboarding). El progreso NO se persiste: se DERIVA de los
// datos reales (¿hay puesto? ¿hay candidatura?), así se retoma solo en cualquier
// dispositivo y no puede desincronizarse. Lo único persistido es "guía cerrada
// o terminada" (companies.onboarding_done_at, null = activa).
//
// Fases (pasos 2-4 del wizard; el paso 1 es la pantalla de crear empresa):
//   'puesto'      aún no hay ningún puesto -> crear el primero
//   'formulario'  hay puesto y estamos en su Builder -> "esto verá tu candidato"
//   'probar'      hay puesto, sin candidaturas -> "pruébalo tú mismo"
//   'hecho'       hay al menos una candidatura -> cierre
// ----------------------------------------------------------------------------

export type OnboardingPhase = 'puesto' | 'formulario' | 'probar' | 'hecho'

export interface OnboardingState {
  /** La guía puede mostrarse: sesión real (no demo), dueño, datos cargados. */
  eligible: boolean
  /** El dueño la cerró (X / "Ahora no") o la terminó. */
  dismissed: boolean
  /** eligible && !dismissed: la guía está viva. */
  active: boolean
  phase: OnboardingPhase
  /** El primer puesto (el del onboarding; en Prueba solo puede haber uno). */
  campaign: Campaign | null
}

export function useOnboarding(): OnboardingState {
  const { company, role } = useAuth()
  const { campaigns, candidates, loading } = useStore()
  const base = useAppBase()
  const { pathname } = useLocation()

  // Solo el DUEÑO en /app: los invitados (member/encargado) entran a un equipo
  // ya montado y no deben ver la guía; la demo ya es la visita guiada.
  const eligible = base === '/app' && !!company && role === 'owner' && !loading
  const dismissed = (company?.onboarding_done_at ?? null) != null

  const phase: OnboardingPhase =
    campaigns.length === 0
      ? 'puesto'
      : candidates.length > 0
        ? 'hecho'
        : /\/formulario$/.test(pathname)
          ? 'formulario'
          : 'probar'

  return {
    eligible,
    dismissed,
    active: eligible && !dismissed,
    phase,
    campaign: campaigns[0] ?? null,
  }
}

import { useCallback, useMemo } from 'react'
import { useAuth } from './auth'
import { useStore } from './store'
import { useAppBase } from './useAppBase'
import { estadoDeLaTorre, type Deducido, type EstadoTorre, type Marca, type PasoId } from './primerosPasos'
import type { Campaign, Candidate } from './types'

// ----------------------------------------------------------------------------
// Guía de primer uso: la TORRE de pasos de Vista general (sep 2026; antes, una
// tarjeta flotante con cuatro fases derivadas de la URL). Qué pasos hay y en cuál
// estás lo decide `lib/primerosPasos.ts` con dos entradas: las MARCAS que la
// empresa tiene escritas (`companies.onboarding_pasos`, la verdad y el latch) y
// lo que los DATOS dicen (el detector). Lo único que este hook añade es quién
// puede verla y con qué puesto habla.
// ----------------------------------------------------------------------------

export interface OnboardingState {
  /** La guía puede mostrarse: sesión real (no demo), dueño, datos cargados. */
  eligible: boolean
  /** El dueño la cerró ("Saltar la guía") o la terminó. */
  dismissed: boolean
  /** eligible && !dismissed: la torre está viva en Vista general. */
  active: boolean
  torre: EstadoTorre
  /** Lo que los datos dicen hoy; la memoria de la torre lo escribe como marca. */
  deducido: Deducido
  /** El primer puesto (el de la guía; en Prueba solo puede haber uno). */
  campaign: Campaign | null
  /** La candidatura que el dueño se envió a sí mismo al probar su enlace. */
  testCandidate: Candidate | null
  /** Apunta un paso. No hace nada fuera de la guía (demo, miembro). */
  marcar: (id: PasoId, valor: Marca) => void
}

export function useOnboarding(): OnboardingState {
  const { company, role, marcarPasos } = useAuth()
  const { campaigns, candidates, members, brands, loading } = useStore()
  const base = useAppBase()

  // Solo el DUEÑO en /app: los invitados (member/encargado) entran a un equipo
  // ya montado y no deben ver la guía; la demo ya es la visita guiada.
  const eligible = base === '/app' && !!company && role === 'owner' && !loading
  const dismissed = (company?.onboarding_done_at ?? null) != null

  const marcas = company?.onboarding_pasos
  const deducido: Deducido = useMemo(
    () => ({
      hayPuesto: campaigns.length > 0,
      hayCandidatura: candidates.length > 0,
      hayCandidaturaReal: candidates.some((c) => c.source !== 'prueba'),
      hayEquipo: members.length > 1,
      hayLogo: brands.some((b) => !!b.logoPath),
    }),
    [campaigns.length, candidates, members.length, brands],
  )
  const torre = useMemo(() => estadoDeLaTorre(marcas ?? {}, deducido), [marcas, deducido])

  const marcar = useCallback(
    (id: PasoId, valor: Marca) => {
      if (!eligible) return
      void marcarPasos({ [id]: valor })
    },
    [eligible, marcarPasos],
  )

  return {
    eligible,
    dismissed,
    active: eligible && !dismissed,
    torre,
    deducido,
    campaign: campaigns[0] ?? null,
    testCandidate: candidates.find((c) => c.source === 'prueba') ?? null,
    marcar,
  }
}

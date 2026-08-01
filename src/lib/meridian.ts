// -----------------------------------------------------------------------------
// Meridian: la capa de IA de Apúntate Fácil. Primera pieza = triaje de candidaturas
// (resumen + puntos a favor/confirmar + ajuste al puesto). Ver src/lib/types.ts
// (CandidateAI) y la edge function supabase/functions/analyze-candidate.
//
// "Meridian" es un nombre PLACEHOLDER. Este es el único sitio donde se escribe:
// cámbialo aquí y cambia en toda la app (igual que la marca vive solo en brand.ts).
// -----------------------------------------------------------------------------

import { planHas } from './pricing'

/** Nombre visible del asistente. Placeholder, renómbralo solo aquí. */
export const MERIDIAN_NAME = 'Meridian'

/**
 * El HILO conversacional (`/app/meridian`: parte diario, chat, Actividad) está
 * apagado a propósito (Mario, jul 2026): de Meridian se usan de momento las otras
 * capacidades (triaje de cada candidatura, ajuste al puesto, orden por encaje),
 * que no dependen de esto. Ponlo en true y vuelve entero: la pantalla, su ruta y
 * sus dos entradas (menú lateral y tarjeta de la Vista general) siguen escritas.
 */
export const MERIDIAN_CHAT_ENABLED: boolean = false

/** Disponible como diferenciador de Pro/Multi (espejo del gating de servidor en la
 *  edge function, que no analiza para planes por debajo de Pro). */
export function hasMeridian(plan: string | undefined | null): boolean {
  return planHas(plan, 'meridian')
}

/** Cota inferior de "ajuste alto" para dar énfasis discreto (nunca color de estado). */
export const MERIDIAN_FIT_STRONG = 75

// Etiqueta cualitativa del ajuste. Mario: se muestra la ETIQUETA, no la nota cruda,
// para que no se sienta como "calificar" a personas. "A valorar" (no "encaja poco"):
// descartar es rutina y reversible, nunca un veredicto. Umbrales tunables aquí.
export type FitTierKey = 'bien' | 'puede' | 'valorar'

export interface FitTier {
  key: FitTierKey
  label: string
}

export function fitTier(fit: number): FitTier {
  if (fit >= 70) return { key: 'bien', label: 'Encaja bien' }
  if (fit >= 45) return { key: 'puede', label: 'Puede encajar' }
  return { key: 'valorar', label: 'A valorar' }
}

/** Ajuste utilizable de una candidatura, o null si no está analizada (o falló). */
export function candidateFit(ai: { fit: number; error?: string } | null | undefined): number | null {
  return ai && !ai.error ? ai.fit : null
}

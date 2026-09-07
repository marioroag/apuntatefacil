// -----------------------------------------------------------------------------
// Meridian: la capa de IA de Apúntate Fácil. Primera pieza = triaje de candidaturas
// (resumen + puntos a favor/confirmar + ajuste al puesto). Ver src/lib/types.ts
// (CandidateAI) y la edge function supabase/functions/analyze-candidate.
//
// "Meridian" es un nombre PLACEHOLDER. Este es el único sitio donde se escribe:
// cámbialo aquí y cambia en toda la app (igual que la marca vive solo en brand.ts).
// -----------------------------------------------------------------------------

import type { CandidateAI } from './types'


/** Nombre visible del asistente. Placeholder, renómbralo solo aquí. */
export const MERIDIAN_NAME = 'Meridian'


/**
 * EL ANILLO DE AJUSTE ALREDEDOR DE LA CARA, apagado por ahora (Mario, ago 2026).
 *
 * Una sola bandera, como `MERIDIAN_CHAT_ENABLED`: el código del
 * anillo (carril reservado, barrido al medir por primera vez, `reduced-motion`) se
 * queda entero y en un solo sitio, así que devolverlo es poner `true`. Apagado,
 * `MeridianAvatar` delega en `ui/Avatar`, la primitiva única de las caras, que es
 * donde debería haber estado siempre la parte de "pintar una cara".
 *
 * Lo que NO se apaga: el triaje sigue funcionando y su lectura se sigue viendo,
 * en la columna Encaje de la tabla (en PALABRAS) y en el informe de la ficha. Se
 * ha quitado un canal de la misma información, no la información.
 */
export const ANILLO_AJUSTE: boolean = false

/** Con el pago por proceso (ago 2026) Meridian está incluido para todo el
 *  mundo: se cobra por procesos abiertos, no por capacidades. Espejo del
 *  gating de servidor (_shared/plans.ts), que sigue fail-closed: un plan
 *  desconocido no llama a OpenAI. */
export function hasMeridian(plan: string | undefined | null): boolean {
  return typeof plan === 'string' && ['trial', 'proceso', 'esencial', 'pro', 'multi'].includes(plan)
}

// Etiqueta cualitativa del ajuste. Mario: se muestra la ETIQUETA, no la nota cruda,
// para que no se sienta como "calificar" a personas.
//
// CUATRO NIVELES DESDE SEP 2026: **Bajo · Medio · Bueno · Excelente** (Mario). Eran
// tres y con frase ("Encaja bien / Puede encajar / A valorar"), y el cambio no es
// solo de número: una escala se lee mejor cuando sus peldaños son UNA palabra del
// mismo tipo, porque entonces se comparan sin leerlas enteras. Es el mismo
// paralelismo que esta casa ya exige en el menú de estado de un puesto.
//
// "Bajo" y no "encaja poco" ni un rojo: sigue siendo una LECTURA, no un veredicto.
// Descartar es una decisión de la persona, siempre, y ningún nivel descarta a nadie.
//
// Los cortes son ESPEJO de FIT_EXCELENTE/FIT_BIEN/FIT_PUEDE en _shared/triaje.ts (el
// servidor, que es quien fabrica el número): si se mueven, se mueven en los dos
// sitios. Los dos viejos no se tocaron al añadir el cuarto nivel, porque están
// calibrados contra candidaturas reales; el 85 es nuevo y parte en dos lo que era
// una banda de treinta puntos.
export type FitTierKey = 'bajo' | 'medio' | 'bueno' | 'excelente'

export interface FitTier {
  key: FitTierKey
  label: string
}

export function fitTier(fit: number): FitTier {
  if (fit >= 85) return { key: 'excelente', label: 'Excelente' }
  if (fit >= 70) return { key: 'bueno', label: 'Bueno' }
  if (fit >= 45) return { key: 'medio', label: 'Medio' }
  return { key: 'bajo', label: 'Bajo' }
}

/** Ajuste utilizable de una candidatura, o null si no está analizada (o falló). */
export function candidateFit(ai: { fit: number; error?: string } | null | undefined): number | null {
  return ai && !ai.error ? ai.fit : null
}

// ---------------------------------------------------------------------------
// Vocabulario de los criterios del baremo (la ficha los pinta desde ago 2026).
// Palabras llanas, sin jerga de selección: las lee alguien que no es reclutador.
// ---------------------------------------------------------------------------

export type CriterioValor = 'cumple' | 'parcial' | 'no_consta' | 'no_cumple'

export const CRITERIO_VALOR_LABEL: Record<CriterioValor, string> = {
  cumple: 'Cumple',
  parcial: 'A medias',
  no_consta: 'Sin dato',
  no_cumple: 'No cumple',
}

/** Nombres visibles de los 5 criterios genéricos de los análisis anteriores a la
 *  triada (ago 2026), que guardaban solo la clave. Los nuevos traen `nombre`. */
export const CRITERIO_NOMBRE_LEGADO: Record<string, string> = {
  experiencia: 'Experiencia en el puesto',
  disponibilidad: 'Disponibilidad',
  desplazamiento: 'Desplazamiento al puesto',
  requisitos: 'Requisitos del formulario',
  continuidad: 'Continuidad laboral',
}

/** Nombre visible de un criterio, venga de un análisis nuevo o de uno viejo. */
export function criterioNombre(c: { clave: string; nombre?: string }): string {
  return c.nombre || CRITERIO_NOMBRE_LEGADO[c.clave] || c.clave
}

// ---------------------------------------------------------------------------
// Las citas del CV de un análisis: lo que el visor del documento puede
// localizar y subrayar. UNA sola fuente para el visor y para el informe (que
// enlaza cada juicio con su subrayado por el mismo id): dos listas de la misma
// verdad se separan al primer retoque.
// ---------------------------------------------------------------------------

export interface CitaCv {
  id: string
  /** La cita literal, tal cual la guardó el análisis. */
  texto: string
  /** Qué juicio la usa ("Carnet de carretillas"), para el aria-label del subrayado. */
  etiqueta: string
}

export const idCitaCriterio = (clave: string) => `crit:${clave}`
export const idCitaContraste = (i: number) => `contraste:${i}`

/**
 * Solo con `cvLeido === 'texto'` hay algo que subrayar: una transcripción de
 * visión no se puede localizar en el documento, y un análisis viejo no dice de
 * dónde salió cada cita. Devolver vacío ES el comportamiento correcto ahí.
 */
export function citasDelAnalisis(ai: CandidateAI | null | undefined): CitaCv[] {
  if (!ai || ai.error || ai.cvLeido !== 'texto') return []
  const out: CitaCv[] = []
  for (const c of ai.criterios ?? []) {
    if (c.evidencia && c.fuente === 'cv') {
      out.push({ id: idCitaCriterio(c.clave), texto: c.evidencia, etiqueta: criterioNombre(c) })
    }
  }
  ;(ai.contrastes ?? []).forEach((c, i) => {
    out.push({ id: idCitaContraste(i), texto: c.cv, etiqueta: 'Contraste con una respuesta' })
  })
  return out
}

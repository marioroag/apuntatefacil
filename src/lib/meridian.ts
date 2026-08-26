// -----------------------------------------------------------------------------
// Meridian: la capa de IA de Apúntate Fácil. Primera pieza = triaje de candidaturas
// (resumen + puntos a favor/confirmar + ajuste al puesto). Ver src/lib/types.ts
// (CandidateAI) y la edge function supabase/functions/analyze-candidate.
//
// "Meridian" es un nombre PLACEHOLDER. Este es el único sitio donde se escribe:
// cámbialo aquí y cambia en toda la app (igual que la marca vive solo en brand.ts).
// -----------------------------------------------------------------------------


/** Nombre visible del asistente. Placeholder, renómbralo solo aquí. */
export const MERIDIAN_NAME = 'Meridian'

/**
 * El HILO conversacional (`/app/meridian`: parte diario, chat, Actividad) está
 * apagado a propósito (Mario, jul 2026): de Meridian se usan de momento las otras
 * capacidades (triaje de cada candidatura, ajuste al puesto, orden por encaje),
 * que no dependen de esto. Ponlo en true y vuelve entero: la pantalla, su ruta y
 * sus dos entradas (menú lateral y tarjeta de Vista general) siguen escritas.
 */
export const MERIDIAN_CHAT_ENABLED: boolean = false

/**
 * EL ANILLO DE AJUSTE ALREDEDOR DE LA CARA, apagado por ahora (Mario, ago 2026).
 *
 * Una sola bandera, como `MERIDIAN_CHAT_ENABLED` y `WHATSAPP_LISTO`: el código del
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
// para que no se sienta como "calificar" a personas. "A valorar" (no "encaja poco"):
// descartar es rutina y reversible, nunca un veredicto.
//
// Los cortes 70/45 son ESPEJO de FIT_BIEN/FIT_PUEDE en _shared/triaje.ts (el
// servidor, que es quien fabrica el número): si se mueven, se mueven en los dos
// sitios. Desde la triada (ago 2026) el significado del número cambió sin tocar
// los cortes: "no_consta" ya no diluye (sale del denominador) y cada criterio
// pesa según su nivel; un criterio clave incumplido hunde el número por peso,
// nunca por una categoría eliminatoria (que Mario vetó por subjetiva).
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

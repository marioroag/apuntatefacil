// -----------------------------------------------------------------------------
// Pricing de Apúntate Fácil. Modelo: PAGO POR PROCESO ABIERTO (Mario, ago 2026;
// sustituye a los tres planes Esencial/Pro/Multi).
//
//  - 49 €/mes + IVA por proceso abierto. Todos los procesos al mismo precio
//    (Mario descartó el descuento del segundo y siguientes). El IVA se comunica
//    SIEMPRE al lado del precio ("+ IVA"): somos B2B.
//  - Sin tiers y sin features de pago: TODO el producto está incluido. Se cobra
//    por escala real (nº de procesos abiertos), nunca por capacidades.
//  - Prueba: el PRIMER proceso es gratis 15 días, SIN tope de candidaturas
//    (Mario, ago 2026; antes eran "15 días o 25 candidaturas, lo que llegue
//    antes"). El cupo se retiró porque castigaba justo al puesto que mejor
//    funcionaba: un anuncio de peón se come 25 candidaturas en una tarde, así
//    que a quien más valor estaba viendo era a quien antes se le apagaba la
//    demo, y encima el día 2 de una prueba de 15. Con un solo freno, lo que se
//    prueba es el producto durante dos semanas. La prueba sigue cubriendo UN
//    solo proceso abierto: abrir un segundo pasa por pagarlo. Sin tarjeta al
//    empezar: se pide al final. Una sola prueba por empresa.
//  - Cerrar un proceso es un clic y deja de cobrarse; el proceso cerrado no
//    acepta candidaturas pero se conserva entero y exportable ("tus candidatos
//    siguen siendo tuyos"). Mes empezado, mes cobrado: al cerrar no hay
//    devolución parcial, y por eso reabrirlo dentro del ciclo ya pagado es
//    gratis hasta que el ciclo termine (anti-truco de cerrar y reabrir).
//
// Cambia aquí los importes y todo se actualiza en la landing y en /app/plan.
// El importe REAL de cobro vive en el price de Stripe (STRIPE_PRICE_PROCESO):
// al cambiar este número hay que recrear el price con el importe nuevo.
// Los planes viejos (esencial/pro/multi) ya no se venden; sus constantes de
// compatibilidad viven abajo mientras queden suscripciones antiguas activas.
// -----------------------------------------------------------------------------
import type { Campaign } from './types'

/** €/mes + IVA por cada proceso abierto. Espejo del price de Stripe. */
export const PRECIO_PROCESO = 49

/** Días de prueba del primer proceso. Espejo del trigger start_trial_clock. */
export const PRUEBA_DIAS = 15

/** Un proceso ABIERTO (el que se cobra) es el que no está cerrado: activo o
 *  pausado. Pausar detiene el enlace pero el proceso sigue abierto y contando;
 *  cerrar es lo que detiene el cobro. */
export const procesoAbierto = (c: Pick<Campaign, 'status'>): boolean => c.status !== 'cerrada'
export const procesosAbiertos = (campaigns: Pick<Campaign, 'status'>[]): number =>
  campaigns.filter(procesoAbierto).length

/** Reassurance de la prueba en hero y CTAs. Derivada del tope real, que ya es
 *  uno solo: los días. "Sin límite de candidaturas" se dice a propósito, porque
 *  es la duda que traía el modelo viejo y la diferencia con un portal. */
export const TRIAL_REASSURANCE = `Tu primer proceso gratis ${PRUEBA_DIAS} días. Sin límite de candidaturas y sin tarjeta.`

/** La frase completa del modelo, para la landing y el formulario de precios. */
export const PRECIO_FRASE = `${PRECIO_PROCESO} €/mes + IVA por proceso abierto. Primer proceso gratis. Sin permanencia: ciérralo cuando quieras y tus candidatos siguen siendo tuyos.`

/** Días de prueba restantes (0 si agotada o sin empezar el reloj). */
export function diasDePruebaRestantes(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null // el reloj arranca al abrir el primer proceso
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

// -----------------------------------------------------------------------------
// Compatibilidad con los planes por tiers, YA RETIRADOS de la venta (ago 2026).
// Quedan suscripciones antiguas activas (esencial/pro/multi) que conservan sus
// límites de procesos en servidor; estas etiquetas y topes solo se usan para
// pintarlas. 'proceso' es el plan del modelo nuevo; 'trial' la prueba.
// -----------------------------------------------------------------------------
export const PLAN_LABEL: Record<string, string> = {
  trial: 'Prueba',
  proceso: 'Pago por proceso',
  esencial: 'Esencial',
  pro: 'Pro',
  multi: 'Multi',
}

// Espejo de plan_process_limit en servidor (solo aplica a trial y a los tiers
// antiguos; en 'proceso' el tope real es paid_processes, los procesos pagados).
export const PLAN_PROCESS_LIMIT: Record<string, number> = {
  trial: 1,
  proceso: Infinity,
  esencial: 2,
  pro: 10,
  multi: Infinity,
}

// Tope de marcas (espejo del trigger enforce_brand_limit en servidor). Quien
// paga tiene las que su operación pida (caso ETT/cadena); la prueba se queda
// con una, la identidad de su casa. Mantener sincronizado con plan_brand_limit.
export const PLAN_BRAND_LIMIT: Record<string, number> = {
  trial: 1,
  proceso: Infinity,
  esencial: 1,
  pro: 1,
  multi: Infinity,
}

// Números con separador de miles español (2370 -> "2.370").
export const fmtEs = (n: number): string => n.toLocaleString('es-ES')

// Las Etiquetas son una primitiva de clasificación (como el favorito), no algo
// que se cobre: disponibles siempre. Único punto de configuración: si algún día
// se quisiera gatear, este flag es el sitio donde cambiarlo.
export const TAGS_ENABLED = true

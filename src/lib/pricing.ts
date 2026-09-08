// -----------------------------------------------------------------------------
// Pricing de Apúntate Fácil. Modelo: PAGO POR PROCESO ABIERTO (Mario, ago 2026;
// sustituye a los tres planes Esencial/Pro/Multi).
//
//  - 49 €/mes por proceso abierto, impuestos no incluidos. Todos los procesos
//    al mismo precio (Mario descartó el descuento del segundo y siguientes).
//    Los impuestos se dicen SIEMPRE al lado del precio (lo exige la LSSI), pero
//    como "impuestos no incluidos" y no "+ IVA" (sep 2026): somos canarios y
//    no cobramos IVA a nadie (IGIC a Canarias, inversión del sujeto pasivo a
//    la Península). Dónde está el cliente decide el impuesto: ver
//    _shared/impuestos.ts.
//  - Sin tiers y sin features de pago: TODO el producto está incluido. Se cobra
//    por escala real (nº de procesos abiertos), nunca por capacidades.
//  - Prueba: el PRIMER proceso es gratis 15 días, SIN tope de candidaturas
//    (Mario, ago 2026; antes eran "15 días o 25 candidaturas, lo que llegue
//    antes"). El cupo se retiró porque castigaba justo al puesto que mejor
//    funcionaba: un anuncio de peón se come 25 candidaturas en una tarde, así
//    que a quien más valor estaba viendo era a quien antes se le apagaba la
//    demo, y encima el día 2 de una prueba de 15. Con un solo freno, lo que se
//    prueba es el producto durante dos semanas. La prueba cubre UN solo
//    puesto, EL PRIMERO que se abre (Mario, sep 2026): ese se puede pausar,
//    cerrar y reabrir gratis; cualquier otro pasa por pagarlo, aunque el
//    primero esté cerrado. Sin tarjeta al empezar: se pide al final, y darla
//    NO quema los días que queden (la suscripción nace en `trialing` hasta
//    `trial_ends_at`: ver `finDePrueba`). Una sola prueba por empresa.
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

/**
 * Un puesto que NUNCA ha llegado a abrirse: el asistente lo crea cerrado a la
 * espera del pago y Checkout lo abre al completarse. Si el cliente cierra la
 * página de Stripe sin pagar, se queda así, y hasta sep 2026 se pintaba como
 * "Cerrado" igual que uno que se cerró a propósito. Lo distingue `closed_at`,
 * que el servidor estampa solo al pasar a cerrado.
 */
export const pendienteDePago = (c: Pick<Campaign, 'status' | 'closedAt'>): boolean =>
  c.status === 'cerrada' && !c.closedAt

export type ModoProceso = 'libre' | 'cobrar' | 'checkout' | 'bloqueado'

/**
 * Qué le espera a un proceso NUEVO (crear o duplicar), espejo en cliente del
 * tope del servidor. En el pago por proceso nunca hay muro: o hay hueco pagado
 * libre ('libre'), o se cobra uno más a la suscripción ('cobrar'), o falta el
 * método de pago y se pasa por Stripe Checkout ('checkout'). El muro solo
 * queda para los tiers antiguos, que tienen tope fijo. Se declara UNA vez
 * porque lo preguntan dos puertas (Crear puesto y Duplicar) y tienen que
 * contestar lo mismo.
 */
export function modoProceso(
  company: { id: string; plan: string; paid_processes: number; subscription_status?: string | null; trial_campaign_id?: string | null } | null | undefined,
  campaigns: Pick<Campaign, 'status'>[],
  /** El puesto que se va a ABRIR, si ya existe (reabrir). Sin id, es uno nuevo. */
  campaignId?: string | null,
): ModoProceso {
  if (!company || company.id === 'demo') return 'libre'
  const abiertos = procesosAbiertos(campaigns)
  if (company.plan === 'proceso') {
    if (abiertos < company.paid_processes) return 'libre'
    return hayPagoActivo(company) ? 'cobrar' : 'checkout'
  }
  // LA PRUEBA ES EL PRIMER PUESTO, Y SOLO ESE (Mario, sep 2026): el que abrió
  // el reloj se puede pausar, cerrar y reabrir gratis; cualquier otro, aunque
  // el primero esté cerrado, pasa por el pago. Sin puesto de prueba todavía
  // (no se ha abierto ninguno), el primero que se abra es el de la prueba.
  if (company.plan === 'trial') {
    if (!company.trial_campaign_id) return 'libre'
    return campaignId && campaignId === company.trial_campaign_id ? 'libre' : 'checkout'
  }
  const activos = campaigns.filter((c) => c.status === 'activa').length
  return activos < (PLAN_PROCESS_LIMIT[company.plan] ?? 0) ? 'libre' : 'bloqueado'
}

/**
 * DÓNDE ESTÁ EL CLIENTE decide el impuesto de su factura, porque somos una
 * empresa CANARIA (fuera del territorio del IVA). Espejo de
 * supabase/functions/_shared/impuestos.ts, que es quien lo aplica en Stripe.
 */
export type RegionFiscal = 'canarias' | 'peninsula' | 'ceuta_melilla'
export const REGIONES_FISCALES: { value: RegionFiscal; label: string; impuesto: string }[] = [
  { value: 'peninsula', label: 'Península o Baleares', impuesto: 'sin IVA en la factura (inversión del sujeto pasivo: lo declara tu empresa)' },
  { value: 'canarias', label: 'Canarias', impuesto: 'más IGIC (7 %)' },
  { value: 'ceuta_melilla', label: 'Ceuta o Melilla', impuesto: 'sin IVA' },
]

/** La coletilla del impuesto para escribir detrás de "X € al mes, ": "más IGIC
 *  (7 %)", "sin IVA en la factura (...)". Sin región conocida, la fórmula
 *  genérica del producto, "más IVA". */
export function impuestoTexto(region: RegionFiscal | null | undefined): string {
  return REGIONES_FISCALES.find((x) => x.value === region)?.impuesto ?? 'más IVA'
}

/** Reassurance de la prueba en hero y CTAs. Derivada del tope real, que ya es
 *  uno solo: los días. "Sin límite de candidaturas" se dice a propósito, porque
 *  es la duda que traía el modelo viejo y la diferencia con un portal. */
export const TRIAL_REASSURANCE = `Tu primer proceso gratis ${PRUEBA_DIAS} días. Sin límite de candidaturas y sin tarjeta.`

/** La frase completa del modelo, para la landing y el formulario de precios. */
export const PRECIO_FRASE = `${PRECIO_PROCESO} €/mes por proceso abierto, impuestos no incluidos. Primer proceso gratis. Sin permanencia: ciérralo cuando quieras y tus candidatos siguen siendo tuyos.`

/**
 * Estados en los que Stripe está cobrando de verdad. 'past_due' cuenta como
 * viva: los reintentos siguen en curso y hay un método de pago detrás. No
 * cuentan 'canceled', 'unpaid', 'incomplete_expired' ni la AUSENCIA de
 * suscripción (null), que es donde cae una empresa cuyo plan se puso a mano.
 */
const SUSCRIPCION_VIVA = ['active', 'trialing', 'past_due']

/**
 * ¿Hay una suscripción viva detrás de esta empresa? Se pregunta por el ESTADO
 * de la suscripción y NUNCA por el nombre del plan, porque las dos cosas se
 * pueden separar: una empresa con `plan = 'pro'` puesto a mano no ha pasado
 * nunca por Stripe, así que "gestionar pago y facturas" y "cancelar
 * suscripción" son dos botones que solo pueden dar error. Pasó en producción
 * (sep 2026): un cliente con un plan antiguo sin suscripción detrás abría
 * Facturación y no tenía NINGUNA forma de empezar a pagar.
 */
export function hayPagoActivo(
  company: { subscription_status?: string | null } | null | undefined,
): boolean {
  return SUSCRIPCION_VIVA.includes(company?.subscription_status ?? '')
}

/**
 * ACTIVAR EL PAGO NO QUEMA LOS DÍAS DE PRUEBA QUE QUEDEN (sep 2026). Espejo de
 * `supabase/functions/_shared/prueba.ts`, que es quien lo aplica en Stripe;
 * aquí se usa para escribir la frase de Facturación, que tiene que decir lo
 * mismo que va a pasar. Los cuadra el guardián `prueba.test.ts`.
 *
 * Devuelve la FECHA del primer cobro, o `null` si se cobra al momento: no hay
 * prueba, el reloj no ha arrancado, el pago cubre más de un proceso (la prueba
 * cubre el primero y solo el primero) o queda menos del margen que Stripe
 * exige para poder posponer.
 */
export const MARGEN_PRUEBA_MS = 49 * 60 * 60 * 1000

export function finDePrueba(
  plan: string | null | undefined,
  trialEndsAt: string | null | undefined,
  procesos: number,
  ahora: number = Date.now(),
): Date | null {
  if (plan !== 'trial' || !trialEndsAt) return null
  if (procesos > 1) return null
  const fin = new Date(trialEndsAt).getTime()
  if (!Number.isFinite(fin)) return null
  if (fin - ahora < MARGEN_PRUEBA_MS) return null
  return new Date(fin)
}

/**
 * Días de prueba restantes, **redondeando HACIA ABAJO** (Mario, sep 2026).
 *
 * Estaba en `Math.ceil`, y con 9 días y 17 horas por delante decía "quedan 10"
 * mientras la página de Stripe, en la misma sesión de pago, decía "9 días
 * gratis". Dos cuentas distintas del mismo plazo, y la que manda es la de
 * Stripe, porque es la que factura. Hacia abajo significa "te quedan AL MENOS
 * estos días", que además es la lectura prudente: nadie se lleva la sorpresa de
 * que se acabe un día antes de lo que le dijimos.
 *
 * OJO AL CONSUMIRLO: con `floor`, **`0` es el ÚLTIMO DÍA y no el final**. Con
 * `ceil` las dos cosas coincidían y por eso medio producto leía `dias === 0`
 * como "se acabó"; eso ahora diría que la prueba ha terminado con el puesto
 * todavía abierto. Quién ha terminado lo dice `pruebaAgotada`.
 */
export function diasDePruebaRestantes(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null // el reloj arranca al abrir el primer proceso
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/** ¿Se acabó ya la prueba? Pregunta aparte desde que los días se redondean
 *  hacia abajo: ver el aviso de arriba. */
export function pruebaAgotada(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false
  const fin = new Date(trialEndsAt).getTime()
  return Number.isFinite(fin) && fin <= Date.now()
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

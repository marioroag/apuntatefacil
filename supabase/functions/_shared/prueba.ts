// -----------------------------------------------------------------------------
// CUÁNDO EL PRIMER COBRO SE POSPONE AL FIN DE LA PRUEBA (sep 2026).
//
// Hasta hoy, activar el pago durante la prueba creaba la suscripción SIN
// `trial_end`: el ciclo arrancaba ese mismo día y se cobraba en la propia
// página de Stripe, así que quien pagaba el día 3 de 15 tiraba doce días
// gratis. El incentivo iba al revés de lo que el modelo quiere: durante la
// prueba no hay muro (el producto funciona entero los 15 días), así que quien
// paga antes es quien más valor está viendo, y era justo a quien se le cobraba
// el mes completo renunciando a lo que le quedaba. Lo racional era esperar al
// último día, que es cuando el cliente está más frío y más cerca de irse.
//
// Ahora la suscripción nace en `trialing` con `trial_end = trial_ends_at`: el
// método de pago queda dado, las candidaturas en espera se desbloquean al
// momento y la primera factura cae el día que le tocaba.
//
// LO QUE ESTO NO PUEDE ROMPER: "la prueba es el primer puesto, y SOLO ese"
// (Mario, sep 2026, después de probarlo él y no entender la versión laxa). El
// trial de Stripe es de la SUSCRIPCIÓN ENTERA, no de una unidad: con la
// cantidad a 2 los dos procesos saldrían gratis hasta el día 15, que es
// literalmente el agujero que aquella regla cerró (abrir uno el día 1 y cinco
// más el día 2, todos gratis). De ahí las dos mitades de este módulo:
//   - `finDePrueba` solo pospone cuando la suscripción cubre UN proceso.
//   - `acabarPrueba` termina la prueba en cuanto se abre uno más, que es el
//     mismo dinero que se cobra hoy por ese segundo proceso.
//
// Espejo en cliente: `finDePrueba` / `acabarPrueba` en `src/lib/pricing.ts`,
// que es de donde salen las frases de Facturación. Los dos los cuadra el
// guardián `src/lib/prueba.test.ts`.
// -----------------------------------------------------------------------------

/**
 * Margen exigido para poder posponer. Stripe: "trial_end [...] Has to be at
 * least 48 hours in the future" en `subscription_data`. Se pide una hora más
 * que el mínimo porque entre que se calcula y llega la petición pasa tiempo, y
 * un rechazo aquí deja al cliente sin poder pagar. Por debajo de esto se cobra
 * al momento, que es lo de siempre: lo que se pierde es media jornada de
 * prueba y a cambio el pago nunca falla por un límite de la API.
 */
export const MARGEN_PRUEBA_MS = 49 * 60 * 60 * 1000

/**
 * Fin de la prueba en segundos Unix (lo que espera `trial_end` de Stripe), o
 * `null` si este pago se cobra al momento.
 *
 * @param plan       plan de la empresa; solo 'trial' pospone nada.
 * @param trialEndsAt `companies.trial_ends_at`; null = el reloj no ha arrancado
 *                   (no se ha abierto ningún puesto), así que no hay prueba que
 *                   respetar y se cobra.
 * @param procesos   cuántos procesos va a cubrir la suscripción. Más de uno es
 *                   capacidad que la prueba no cubre: se cobra.
 */
export function finDePrueba(
  plan: string | null | undefined,
  trialEndsAt: string | null | undefined,
  procesos: number,
  ahora: number = Date.now(),
): number | null {
  if (plan !== 'trial' || !trialEndsAt) return null
  if (procesos > 1) return null
  const fin = new Date(trialEndsAt).getTime()
  if (!Number.isFinite(fin)) return null
  if (fin - ahora < MARGEN_PRUEBA_MS) return null
  return Math.floor(fin / 1000)
}

/**
 * ¿Hay que terminar la prueba en esta operación? Sí en cuanto la suscripción
 * pasa a cubrir más de un proceso: la prueba cubre el primero y solo el
 * primero, así que abrir otro es lo que la cierra. Lo preguntan el cobro y su
 * previsualización, que tienen que decir lo mismo.
 *
 * @param estado   estado de la suscripción en Stripe.
 * @param procesos cuántos procesos va a cubrir después de esta operación.
 */
export function acabarPrueba(estado: string | null | undefined, procesos: number): boolean {
  return estado === 'trialing' && procesos > 1
}

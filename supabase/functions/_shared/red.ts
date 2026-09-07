// ============================================================================
// PLAZOS PARA HABLAR CON FUERA (auditoría de seguridad, sep 2026).
//
// Ninguna llamada de red de las funciones llevaba timeout: una respuesta
// colgada de OpenAI, Resend, Google o Meta mantenía la invocación viva hasta
// el límite de la plataforma, retenía el reclamo del análisis y ocupaba un
// slot del latido de la cola. Cada proveedor tiene su plazo, declarado aquí y
// no repartido por diez ficheros: el modelo tarda lo que tarda un análisis con
// un CV dentro; un correo o una API de calendario contestan en segundos o no
// contestan.
// ============================================================================

export const PLAZO = {
  /** OpenAI: un análisis con CV y visión puede rondar el minuto. */
  modelo: 120_000,
  /** Resend, Google, Meta, Stripe y nuestras propias funciones. */
  api: 15_000,
} as const

/** La señal para `fetch`: `{ signal: plazo(PLAZO.api) }`. */
export function plazo(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

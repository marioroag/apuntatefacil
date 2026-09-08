/**
 * El motivo REAL de un fallo de una edge function. `supabase.functions.invoke`
 * deja la respuesta 4xx/5xx envuelta en `error.context` sin leerle el cuerpo,
 * así que sin esto cualquier causa conocida ("Solo el propietario puede
 * gestionar la facturación", "ya tienes una suscripción de un plan anterior")
 * se leía en pantalla como un "inténtalo de nuevo" que no lleva a ninguna
 * parte. Lo usan Facturación y el store: un aviso de facturación dice lo que
 * dijo el servidor, y solo cae al genérico cuando el servidor no dio motivo.
 */
export async function motivo(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown })?.context
  if (!(ctx instanceof Response)) return null
  try {
    const cuerpo = await ctx.clone().json()
    return typeof cuerpo?.error === 'string' && cuerpo.error ? cuerpo.error : null
  } catch {
    return null // el cuerpo no era JSON
  }
}

/** Lo único que hace falta del cliente: llamar a un RPC. Tipado por forma y no
 *  importando de jsr, como el resto de módulos de _shared, que no dependen de
 *  nada externo. */
interface ConRpc {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

/**
 * Quién de estos quiere de verdad este aviso por correo.
 *
 * Las preferencias viven en profiles.email_prefs y la regla está en la función
 * `email_recipients` de la base: aquí solo se pregunta. Un único sitio decide,
 * así que ningún aviso se salta el ajuste por olvido.
 *
 * Las claves son las de `src/lib/settings.tsx` (EMAIL_KEYS). Si cambia una allí,
 * cambia aquí: sin la clave común, el interruptor deja de gobernar en silencio.
 *
 * FAIL-CLOSED: si la consulta falla, no se manda nada. Mandar un correo que
 * alguien ha apagado es peor que no mandarlo, y el aviso no se pierde: sigue
 * apareciendo en el timbre de la app, que no depende de esto.
 */
export async function conPreferencia<T extends { user_id: string }>(
  admin: ConRpc,
  recipients: T[],
  key: string,
): Promise<T[]> {
  if (recipients.length === 0) return []
  const { data, error } = await admin.rpc('email_recipients', {
    p_user_ids: recipients.map((r) => r.user_id),
    p_key: key,
  })
  if (error) {
    console.error('email_recipients falló, no se envía nada:', error.message)
    return []
  }
  const quieren = new Set(((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id))
  return recipients.filter((r) => quieren.has(r.user_id))
}

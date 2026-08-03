import type { CompanyMember } from './types'

/**
 * Menciones `@alguien` en el chat de equipo.
 *
 * El identificador es el correo sin el dominio (`laura.gil@empresa.es` ->
 * `@laura.gil`). No hay tabla de perfiles ni nombres reales en este backend, y
 * un identificador con espacios ("@Laura Gil") no se puede delimitar dentro de
 * un texto libre: haría falta adivinar dónde acaba el nombre.
 */

// Dos regex a propósito: la global lleva `lastIndex`, así que usar la MISMA para
// `match()` y para `test()` dentro de un bucle da resultados alternos (una
// mención sí, la siguiente no). La de comprobar no puede ser global.
export const MENTION_RE = /@[\w.+-]+/g
export const ES_MENCION = /^@[\w.+-]+$/
/**
 * La misma gramática, con grupo de captura, para partir un cuerpo en trozos y
 * pintar las menciones. SOLO para `split()`: es global, así que `test()` sobre
 * ella arrastraría `lastIndex` (para comprobar está `ES_MENCION`).
 */
export const MENTION_SPLIT_RE = /(@[\w.+-]+)/g

export function mentionHandle(email: string | null | undefined): string {
  return (email ?? '').split('@')[0]?.trim().toLowerCase() ?? ''
}

/**
 * Los `user_id` que se van a avisar, resueltos del texto al enviar. Se resuelve
 * al final y no al insertar: así también cuenta el `@laura` escrito a mano, y un
 * identificador que se rompe editando deja de avisar, que es justo lo que el
 * autor está viendo en pantalla.
 *
 * El servidor vuelve a filtrar por pertenencia al equipo: esto es comodidad,
 * no seguridad.
 */
export function resolveMentions(body: string, members: CompanyMember[]): string[] {
  const porHandle = new Map(members.map((m) => [mentionHandle(m.email), m]))
  const out = new Set<string>()
  for (const token of body.match(MENTION_RE) ?? []) {
    const m = porHandle.get(token.slice(1).toLowerCase())
    if (m && !m.isSelf) out.add(m.userId)
  }
  return [...out]
}

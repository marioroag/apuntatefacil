import type { CompanyMember } from './types'

/**
 * Menciones `@alguien` en el chat de equipo.
 *
 * El identificador es el correo sin el dominio (`laura.gil@empresa.es` ->
 * `@laura.gil`): un identificador con espacios ("@Laura Gil") no se puede
 * delimitar dentro de un texto libre, haría falta adivinar dónde acaba el
 * nombre.
 *
 * Dos formas del mismo identificador, y no son intercambiables:
 * `mentionHandle` es la CLAVE (siempre en minúscula, para buscar y comparar) y
 * `mentionToken` es lo que se ESCRIBE (con las mayúsculas de la persona). El
 * chat resuelve siempre en minúscula, así que las dos avisan igual.
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

/** Sin acentos y en minúscula: la forma con la que se comparan dos palabras. */
const plano = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/** Copia el patrón de mayúsculas de `palabra` sobre `trozo`, letra a letra. */
function conElCasoDe(trozo: string, palabra: string): string {
  if (palabra.length !== trozo.length) return trozo
  return [...trozo].map((c, i) => (palabra[i] === palabra[i].toUpperCase() ? c.toUpperCase() : c)).join('')
}

/**
 * Cómo se ESCRIBE la mención en el texto. El identificador es el mismo (el
 * correo sin dominio, que es lo único delimitable dentro de una frase), pero
 * con las mayúsculas de la persona: "Laura Gil" + laura.gil@empresa.es ->
 * "@Laura.Gil". Escribir "@Laura" y que la app te lo baje a "@laura" al elegir
 * de la lista es corregirle el nombre a alguien.
 *
 * Solo cambia el CASO de las letras, nunca las letras: el identificador tiene
 * que seguir resolviendo, y la búsqueda ignora las mayúsculas pero no los
 * acentos ("José" deja "jose" en "Jose", no en "josé", que no avisaría a
 * nadie). Un trozo que no está en su nombre se queda como está: no hay nada a
 * lo que adaptarse y ponerle una mayúscula sería inventarla.
 */
export function mentionToken(name: string | null | undefined, email: string | null | undefined): string {
  const handle = mentionHandle(email)
  const palabras = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!handle || !palabras.length) return handle
  return handle
    // Con grupo de captura, `split` conserva los separadores en el array.
    .split(/([._+-])/)
    .map((trozo) => {
      const palabra = palabras.find((p) => plano(p) === trozo)
      return palabra ? conElCasoDe(trozo, palabra) : trozo
    })
    .join('')
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

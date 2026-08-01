// Leer un enlace de mapa. Dominio puro: SIN imports, para que lo carguen igual
// Deno (la función `resolver-lugar`) y vitest (las pruebas). Mismo criterio que
// `ritmo.ts` y `guion.ts`.
//
// Es troceo de URLs, o sea la clase de código que parece trivial y falla en el
// caso quince. Por eso vive aquí y no dentro del `Deno.serve`: separado se puede
// probar, y hay que probarlo.

/** Un punto del mapa, tal y como lo necesita el pin de WhatsApp. */
export interface Punto { lat: number; lng: number }

/**
 * Solo se sigue una redirección si el destino está aquí.
 *
 * `resolver-lugar` acepta una URL de un usuario autenticado y la pide DESDE
 * NUESTRO SERVIDOR. Sin esta lista sería un SSRF de manual: bastaría pasarle
 * una dirección interna para que se la trajéramos y se la enseñáramos.
 */
export const HOSTS_PERMITIDOS = new Set([
  'maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com', 'google.com',
  'maps.google.es', 'www.google.es', 'maps.apple.com',
])

export function hostPermitido(url: string): boolean {
  let u: URL
  try { u = new URL(url) } catch { return false }
  return u.protocol === 'https:' && HOSTS_PERMITIDOS.has(u.hostname.toLowerCase())
}

export function puntoValido(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    // 0,0 es el Golfo de Guinea. Nunca es la respuesta correcta: siempre es un
    // parámetro vacío que se ha colado como número.
    && !(lat === 0 && lng === 0)
}

/**
 * Saca el punto de una URL de mapa. El orden de los intentos importa:
 *
 *   !3d..!4d..  es el MARCADOR del sitio. Lo más fiable que hay.
 *   q= / ll=    es lo que alguien pidió explícitamente.
 *   @..,..      es la CÁMARA: dónde estaba mirando el mapa al copiar el enlace.
 *               Suele coincidir, pero puede estar desplazada, así que va última.
 */
export function puntoDe(url: string): Punto | null {
  const intentos: RegExp[] = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|sll|daddr|center)=(-?\d+\.\d+)%2C\s*(-?\d+\.\d+)/i,
    /[?&](?:q|query|ll|sll|daddr|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ]
  for (const re of intentos) {
    const m = url.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (puntoValido(lat, lng)) return { lat, lng }
  }
  return null
}

/** Coordenadas escritas a pelo: "28.1235, -15.4302". Es lo que pega quien ya
 *  las tiene, y no hay razón para obligarle al rodeo del enlace. */
export function coordenadasSueltas(texto: string): Punto | null {
  const m = texto.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return puntoValido(lat, lng) ? { lat, lng } : null
}

/** El nombre del sitio, si el enlace lo trae: "/maps/place/Nave+4+Marina/..." */
export function nombreDe(url: string): string | null {
  const m = url.match(/\/maps\/place\/([^/@?]+)/)
  if (!m) return null
  try {
    const n = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
    return n && n.length <= 120 ? n : null
  } catch {
    // Un %ZZ suelto revienta decodeURIComponent. El nombre es un adorno: si no
    // se puede leer, se va sin él.
    return null
  }
}

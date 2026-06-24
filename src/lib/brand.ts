// -----------------------------------------------------------------------------
// Marca. "Apúntate Fácil": el candidato se apunta sin fricción y a la empresa
// le llegan las respuestas ordenadas. Dominio apuntatefacil.com.
// -----------------------------------------------------------------------------
export const BRAND = 'Apúntate Fácil'
export const TAGLINE = 'Apúntate fácil, contrata fácil.'
export const DOMAIN = 'apuntatefacil.com'

// Buzón de soporte. FUENTE ÚNICA: cuando el buzón real esté operativo, cambiar solo
// esta línea y todos los enlaces "Ayuda"/"Contacto" apuntan al sitio correcto.
export const SUPPORT_EMAIL = `soporte@${DOMAIN}`

/** Construye un enlace `mailto:` al soporte. Rellena el asunto y, si se pasa, unas
 *  líneas de contexto (empresa, plan) para que la respuesta sea más rápida. Es solo
 *  un borrador: quien escribe puede editarlo o borrarlo entero antes de enviar. */
export function supportMailto(opts?: { subject?: string; body?: string }): string {
  const params = [`subject=${encodeURIComponent(opts?.subject ?? `Ayuda con ${BRAND}`)}`]
  if (opts?.body) params.push(`body=${encodeURIComponent(opts.body)}`)
  return `mailto:${SUPPORT_EMAIL}?${params.join('&')}`
}

// Tramos legibles que NO pueden ser el primer segmento del enlace: chocarían con rutas
// reales del SPA. Si la marca/empresa cae aquí (o queda vacía), el primer tramo vuelve a
// "a". Mantener en sync con las rutas de main.tsx.
const RESERVED = new Set(['a', 'app', 'demo', 'login', 'restablecer', 'invitacion', 'privacidad', 'terminos'])

/** Pasa un nombre (marca, empresa, título) a un tramo url-safe para MOSTRAR en el enlace.
 *  Solo decorativo: el backend nunca lo usa (busca por el slug). Por eso no lleva sufijo
 *  aleatorio, a diferencia del slug real (ver newSlug en store.tsx). */
export function kebab(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Primer tramo del enlace: marca del puesto si la tiene, si no el nombre de la empresa.
 *  Cae a "a" si el resultado queda vacío o es una palabra reservada. */
function formPrefix(label?: string | null): string {
  const k = label ? kebab(label) : ''
  return k && !RESERVED.has(k) ? k : 'a'
}

/** Enlace CANÓNICO que se comparte (el que copia el merchant): ESTABLE, no incluye el
 *  título, así renombrar el puesto NO cambia el enlace. Dos tramos: /<marca-o-empresa>/<slug>.
 *  El slug es el id real que resuelve el RPC; el primer tramo es decorativo. */
export function publicFormPath(slug: string, brandLabel?: string | null): string {
  return `/${formPrefix(brandLabel)}/${slug}`
}

/** Versión legible que se muestra en la barra al ABRIR el formulario (NO se comparte): añade
 *  el título como tercer tramo. Se construye con el título ACTUAL, así nunca queda caduco.
 *  Decorativo: el backend lo ignora. Ver el replaceState en PublicForm. */
export function publicFormPathPretty(slug: string, brandLabel?: string | null, title?: string | null): string {
  const name = (title ? kebab(title) : '') || 'formulario'
  return `${publicFormPath(slug, brandLabel)}/${name}`
}

/** URL pública (canónica, estable) del formulario, sobre el origen real (local o prod). */
export function publicFormUrl(slug: string, brandLabel?: string | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : `https://${DOMAIN}`
  return `${origin}${publicFormPath(slug, brandLabel)}`
}

/** Igual que publicFormUrl pero sin el protocolo, para mostrar más limpio. */
export function publicFormUrlDisplay(slug: string, brandLabel?: string | null): string {
  return publicFormUrl(slug, brandLabel).replace(/^https?:\/\//, '')
}

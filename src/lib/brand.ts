// -----------------------------------------------------------------------------
// Marca. "Apúntate Fácil": el candidato se apunta sin fricción y a la empresa
// le llegan las respuestas ordenadas. Dominio apuntatefacil.com.
// -----------------------------------------------------------------------------
export const BRAND = 'Apúntate Fácil'
export const TAGLINE = 'Apúntate fácil, contrata fácil.'
export const DOMAIN = 'apuntatefacil.com'

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

/** Ruta del formulario público: /<marca-o-empresa>/<slug>/<nombre-del-puesto>. El tramo
 *  del medio (slug) es el identificador real que resuelve el RPC; el primero y el último
 *  son legibles y el backend los ignora. */
export function publicFormPath(slug: string, brandLabel?: string | null, title?: string | null): string {
  const name = (title ? kebab(title) : '') || 'formulario'
  return `/${formPrefix(brandLabel)}/${slug}/${name}`
}

/** URL pública del formulario de un puesto, basada en el origen real (local o prod). */
export function publicFormUrl(slug: string, brandLabel?: string | null, title?: string | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : `https://${DOMAIN}`
  return `${origin}${publicFormPath(slug, brandLabel, title)}`
}

/** Igual que publicFormUrl pero sin el protocolo, para mostrar más limpio. */
export function publicFormUrlDisplay(slug: string, brandLabel?: string | null, title?: string | null): string {
  return publicFormUrl(slug, brandLabel, title).replace(/^https?:\/\//, '')
}

// -----------------------------------------------------------------------------
// NOMBRE PLACEHOLDER. Cámbialo aquí (un solo sitio) cuando decidas la marca.
// "Criba" = cribar candidatos. Es neutro y multisector.
// -----------------------------------------------------------------------------
export const BRAND = 'Criba'
export const TAGLINE = 'Contrata sin perder ninguna respuesta'
export const DOMAIN = 'criba.app'

/** URL pública del formulario de un puesto, basada en el origen real (local o prod). */
export function publicFormUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : `https://${DOMAIN}`
  return `${origin}/a/${slug}`
}

/** Igual que publicFormUrl pero sin el protocolo, para mostrar más limpio. */
export function publicFormUrlDisplay(slug: string): string {
  return publicFormUrl(slug).replace(/^https?:\/\//, '')
}

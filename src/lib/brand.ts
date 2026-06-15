// -----------------------------------------------------------------------------
// Marca. "Apúntate Fácil": el candidato se apunta sin fricción y a la empresa
// le llegan las respuestas ordenadas. Dominio apuntatefacil.com.
// -----------------------------------------------------------------------------
export const BRAND = 'Apúntate Fácil'
export const TAGLINE = 'El candidato se apunta fácil. Tú eliges sin perderte en mil chats.'
export const DOMAIN = 'apuntatefacil.com'

/** URL pública del formulario de un puesto, basada en el origen real (local o prod). */
export function publicFormUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : `https://${DOMAIN}`
  return `${origin}/a/${slug}`
}

/** Igual que publicFormUrl pero sin el protocolo, para mostrar más limpio. */
export function publicFormUrlDisplay(slug: string): string {
  return publicFormUrl(slug).replace(/^https?:\/\//, '')
}

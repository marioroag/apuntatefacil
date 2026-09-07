/**
 * LO QUE NO VIAJA A LA ANALÍTICA: las rutas con un token dentro.
 *
 * Vercel Analytics y Speed Insights mandan la URL de cada página vista. Dos
 * páginas públicas llevan un token de un solo uso en la URL: la respuesta de
 * interés (`/respuesta/<token>`) y la invitación (`/invitacion?token=`). Un
 * token que sirve para unirse a un equipo o para contestar por un candidato
 * no puede acabar en un panel de analítica de un tercero. Aquí se descarta el
 * evento entero (devolver null), que es más simple y más seguro que
 * reescribir la URL. (Auditoría de seguridad, sep 2026.)
 */
export function sinTokens<T extends { url: string }>(evento: T): T | null {
  let url: URL
  try {
    url = new URL(evento.url, 'https://apuntatefacil.com')
  } catch {
    return null
  }
  if (url.pathname.startsWith('/respuesta/')) return null
  if (url.pathname.startsWith('/invitacion')) return null
  if (url.searchParams.has('token') || url.searchParams.has('code')) return null
  return evento
}

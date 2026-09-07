// Todo lo que sabe hablar con Google Calendar, y nada más. Sin base de datos y
// sin decidir nada: quien llama sabe de quién es el calendario y qué quiere
// hacer con él.
//
// TRES DECISIONES QUE NO SON DE ESTILO:
//
//   1. LOS PERMISOS SON LOS MÍNIMOS QUE HACEN EL TRABAJO. `calendar.events`
//      para poner, mover y quitar NUESTROS eventos, y `calendar.freebusy` para
//      saber cuándo está ocupado (que devuelve horas, nunca con quién ni de
//      qué). Con `calendar` a secas tendríamos permiso para leer y reescribir
//      la agenda entera de una persona, que es más de lo que hace falta y más
//      de lo que nadie debería concedernos. También es lo que decide cuánto
//      cuesta la verificación de Google: cuanto más estrecho, más fácil.
//
//   2. NO SE GUARDA EL ACCESS TOKEN. Se pide uno con el refresh en cada
//      operación. Cachearlo ahorra una llamada de 150 ms a cambio de tener una
//      credencial viva escrita en una columna.
//
//   3. `invalid_grant` NO ES UN FALLO PASAJERO: significa que ese refresh token
//      ya no vale (lo revocaron desde la cuenta de Google, o caducó). Se
//      distingue del resto porque la respuesta es otra: reintentar no arregla
//      nada, hay que decirle a la persona que vuelva a conectar.

import { cuerpoEvento, enlaceMeet, type EventoEntrevista } from './evento.ts'
import type { Ocupado } from '../schedule/slots.ts'
import { PLAZO, plazo } from '../red.ts'

export type { EventoEntrevista, Ocupado }

const OAUTH = 'https://oauth2.googleapis.com/token'
const CONSENTIMIENTO = 'https://accounts.google.com/o/oauth2/v2/auth'
const API = 'https://www.googleapis.com/calendar/v3'
const REVOCAR = 'https://oauth2.googleapis.com/revoke'

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid',
  'email',
]

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
/** El de producción sale del propio proyecto; se puede pisar para el local. */
export const REDIRECT_URI =
  Deno.env.get('GOOGLE_REDIRECT_URI') ??
  `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/google-calendar-callback`

/** Sin credenciales no se ofrece el botón. Fail-closed, como el resto. */
export const configurado = (): boolean => Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI)

export class ErrorGoogle extends Error {
  /** El permiso ya no existe: reintentar no sirve, hay que reconectar. */
  readonly permisoRetirado: boolean
  constructor(mensaje: string, permisoRetirado = false) {
    super(mensaje)
    this.name = 'ErrorGoogle'
    this.permisoRetirado = permisoRetirado
  }
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function urlConsentimiento(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // Las dos hacen falta para que llegue un REFRESH token. `offline` lo pide,
    // y `consent` obliga a la pantalla aunque la persona ya haya dicho que sí
    // otra vez: sin él, Google devuelve solo un access token en la segunda
    // conexión y nos quedaríamos sin nada que guardar. Es el fallo clásico de
    // esta integración, y solo se ve al RECONECTAR, nunca la primera vez.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${CONSENTIMIENTO}?${p}`
}

async function pedirToken(cuerpo: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(OAUTH, {
    signal: plazo(PLAZO.api),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...cuerpo }),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const codigo = String(data.error ?? res.status)
    throw new ErrorGoogle(`${codigo}: ${String(data.error_description ?? '')}`.trim(), codigo === 'invalid_grant')
  }
  return data
}

export interface Canje {
  refreshToken: string
  accessToken: string
  scopes: string[]
  sub: string
  email: string
}

/**
 * El `code` que devuelve Google por un refresh token.
 *
 * El `id_token` se lee sin comprobar su firma A PROPÓSITO, y es lo que Google
 * documenta para este caso: no viene del navegador, viene de una respuesta
 * nuestra al endpoint de token por TLS. Solo se usa para saber QUÉ cuenta es
 * (el `sub`) y cómo se llama (el correo), que es lo que Ajustes enseña.
 */
export async function canjearCodigo(code: string): Promise<Canje> {
  const data = await pedirToken({ code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' })
  const refreshToken = String(data.refresh_token ?? '')
  if (!refreshToken) {
    // Pasa cuando Google decide que ya dio uno y no repite. Con `prompt=consent`
    // no debería ocurrir, y si ocurre hay que decirlo en vez de guardar media
    // conexión que fallará más tarde y lejos de aquí.
    throw new ErrorGoogle('Google no ha devuelto el permiso permanente. Vuelve a intentarlo.')
  }
  const { sub, email } = leerIdToken(String(data.id_token ?? ''))
  return {
    refreshToken,
    accessToken: String(data.access_token ?? ''),
    scopes: String(data.scope ?? '').split(' ').filter(Boolean),
    sub,
    email,
  }
}

function leerIdToken(idToken: string): { sub: string; email: string } {
  try {
    const cuerpo = idToken.split('.')[1]
    if (!cuerpo) return { sub: '', email: '' }
    const json = JSON.parse(
      atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(cuerpo.length / 4) * 4, '=')),
    )
    return { sub: String(json.sub ?? ''), email: String(json.email ?? '') }
  } catch {
    return { sub: '', email: '' }
  }
}

export async function accessTokenDe(refreshToken: string): Promise<string> {
  const data = await pedirToken({ refresh_token: refreshToken, grant_type: 'refresh_token' })
  const token = String(data.access_token ?? '')
  if (!token) throw new ErrorGoogle('Google no ha devuelto un token de acceso')
  return token
}

/** Retira el permiso en Google, no solo en nuestra base. */
export async function revocar(refreshToken: string): Promise<void> {
  // Un fallo aquí no puede impedir desconectar: lo importante es que dejemos de
  // tener la llave, y eso lo hace el borrado de nuestra fila.
  await fetch(REVOCAR, {
    signal: plazo(PLAZO.api),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  }).catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------

async function llamar(
  accessToken: string,
  ruta: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${ruta}`, {
    signal: plazo(PLAZO.api),
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (res.status === 204) return {}
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = (data.error ?? {}) as Record<string, unknown>
    const msg = String(err.message ?? res.statusText)
    // 401 con un token recién pedido significa que el permiso se retiró entre
    // medias; 403 puede ser cuota, que sí es pasajero.
    throw new ErrorGoogle(`${res.status} ${msg}`, res.status === 401)
  }
  return data
}

/**
 * Lo que el anfitrión tiene ocupado. Devuelve HORAS y nada más: `freeBusy` no
 * cuenta con quién ni de qué, y eso es justo lo que queremos. Para decidir si
 * un hueco está libre no hace falta saber con quién come.
 */
export async function freeBusy(
  accessToken: string,
  calendarId: string,
  desde: Date,
  hasta: Date,
): Promise<Ocupado[]> {
  const data = await llamar(accessToken, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      items: [{ id: calendarId }],
    }),
  })
  const cal = ((data.calendars ?? {}) as Record<string, { busy?: Array<{ start: string; end: string }> }>)[calendarId]
  // Sin fundir: eso lo hace `fundirOcupado` en quien lo consume, que es donde
  // se junta con lo nuestro y hay que fundirlo TODO junto de una vez.
  return (cal?.busy ?? [])
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
}

export interface EventoCreado {
  id: string
  meetUrl: string | null
}

export async function crearEvento(
  accessToken: string,
  calendarId: string,
  ev: EventoEntrevista,
): Promise<EventoCreado> {
  const q = ev.conMeet ? '?conferenceDataVersion=1' : ''
  const data = await llamar(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events${q}`, {
    method: 'POST',
    body: JSON.stringify(cuerpoEvento(ev)),
  })
  return { id: String(data.id ?? ''), meetUrl: enlaceMeet(data) }
}

export async function actualizarEvento(
  accessToken: string,
  calendarId: string,
  eventId: string,
  ev: EventoEntrevista,
): Promise<EventoCreado> {
  const q = ev.conMeet ? '?conferenceDataVersion=1' : ''
  const data = await llamar(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${q}`,
    { method: 'PATCH', body: JSON.stringify(cuerpoEvento(ev)) },
  )
  return { id: String(data.id ?? eventId), meetUrl: enlaceMeet(data) }
}

export async function borrarEvento(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await llamar(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    })
  } catch (e) {
    // Ya no está: el objetivo era que no estuviera. Un 410 (borrado) o un 404
    // (nunca llegó a existir, o lo quitó la persona a mano desde su calendario)
    // es exactamente el resultado que se buscaba, no un fallo que reintentar.
    const msg = e instanceof ErrorGoogle ? e.message : ''
    if (msg.startsWith('404') || msg.startsWith('410')) return
    throw e
  }
}


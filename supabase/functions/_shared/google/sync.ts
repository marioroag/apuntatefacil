// Poner, mover o quitar el evento de una entrevista en el calendario de su
// anfitrión. Lo llama el latido (`interview-tick`) cuando le toca el trabajo
// `sincronizar_calendario`, que encola un trigger de la base.
//
// Vuelve a LEER la entrevista en vez de fiarse de lo que dijo el trigger: entre
// que se encoló y que se ejecuta pueden haberla movido dos veces, y lo que hay
// que escribir en el calendario es el estado final, no cada paso.
//
// El vocabulario de vuelta es el mismo que ya usan los trabajos de canal, para
// que el latido no tenga que aprender un segundo: `hecho` cuenta como éxito,
// `fallo` reintenta y `obsoleto` cierra sin ruido (ni éxito ni fallo: dejó de
// proceder, que no es lo mismo que haber salido mal).

import {
  ErrorGoogle, accessTokenDe, actualizarEvento, borrarEvento, crearEvento,
} from './calendar.ts'
import { construirEvento } from './evento.ts'

export type Resultado =
  | { tipo: 'hecho' }
  | { tipo: 'obsoleto'; motivo: string }
  | { tipo: 'fallo'; motivo: string }

interface Cliente {
  rpc(nombre: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
}

interface Payload {
  id: string
  companyId: string
  hostUserId: string
  accion: 'poner' | 'quitar' | 'nada'
  inicio: string | null
  fin: string | null
  timezone: string
  modo: 'presencial' | 'videollamada'
  lugar: string
  meetingUrl: string | null
  eventId: string | null
  candidato: string
  puesto: string
  campaignId: string
  candidateId: string
}

const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

export async function sincronizarCalendario(admin: Cliente, interviewId: string): Promise<Resultado> {
  const { data: crudo, error: e1 } = await admin.rpc('interview_calendar_payload', { p_interview: interviewId })
  if (e1) return { tipo: 'fallo', motivo: `payload: ${e1.message}` }
  if (!crudo) return { tipo: 'obsoleto', motivo: 'la entrevista ya no existe' }
  const p = crudo as Payload

  if (p.accion === 'nada') return { tipo: 'obsoleto', motivo: 'ya realizada' }

  const { data: secreto } = await admin.rpc('calendar_connection_secret', {
    p_company: p.companyId, p_user: p.hostUserId,
  })
  const conexion = secreto as { refreshToken?: string; calendarId?: string } | null

  if (!conexion?.refreshToken) {
    // Sin permiso no se puede tocar su calendario, ni siquiera para quitar. Se
    // suelta el puntero al evento para no reintentar eternamente algo que no se
    // puede hacer. LO QUE SE PAGA: si desconectó con una cita puesta y luego la
    // cancela, ese evento se queda en su calendario. Es lo mismo que ya se le
    // dice al desconectar ("lo que ya está en tu calendario se queda"), y la
    // alternativa (guardarnos la llave por si acaso) es peor.
    await admin.rpc('interview_calendar_cleared', { p_interview: p.id })
    return { tipo: 'obsoleto', motivo: 'sin calendario conectado' }
  }

  const calendarId = conexion.calendarId || 'primary'

  try {
    const token = await accessTokenDe(conexion.refreshToken)

    if (p.accion === 'quitar') {
      if (p.eventId) await borrarEvento(token, calendarId, p.eventId)
      const { error } = await admin.rpc('interview_calendar_cleared', { p_interview: p.id })
      if (error) return { tipo: 'fallo', motivo: error.message }
      return { tipo: 'hecho' }
    }

    if (!p.inicio || !p.fin) return { tipo: 'obsoleto', motivo: 'sin hora' }

    const evento = construirEvento({
      candidato: p.candidato,
      puesto: p.puesto,
      inicio: p.inicio,
      fin: p.fin,
      timezone: p.timezone,
      modo: p.modo,
      lugar: p.lugar,
      meetingUrl: p.meetingUrl,
      fichaUrl: APP_URL ? `${APP_URL}/app/puestos/${p.campaignId}?candidato=${p.candidateId}` : '',
    })

    let creado
    if (p.eventId) {
      try {
        creado = await actualizarEvento(token, calendarId, p.eventId, evento)
      } catch (e) {
        // Lo borró a mano desde su calendario. Mover algo que no está no es un
        // fallo que reintentar: hay que volver a ponerlo, porque la entrevista
        // sigue en pie.
        const msg = e instanceof ErrorGoogle ? e.message : ''
        if (!msg.startsWith('404') && !msg.startsWith('410')) throw e
        creado = await crearEvento(token, calendarId, evento)
      }
    } else {
      creado = await crearEvento(token, calendarId, evento)
    }

    const { error } = await admin.rpc('interview_calendar_done', {
      p_interview: p.id, p_event_id: creado.id, p_meet_url: creado.meetUrl,
    })
    if (error) return { tipo: 'fallo', motivo: error.message }
    return { tipo: 'hecho' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    if (e instanceof ErrorGoogle && e.permisoRetirado) {
      // Reintentar no arregla un permiso retirado. Se anota en la conexión
      // (Ajustes lo dice: "vuelve a conectarlo") y en la entrevista, y el
      // trabajo se cierra sin gastar los seis intentos en algo imposible.
      await admin.rpc('calendar_connection_error', {
        p_company: p.companyId, p_user: p.hostUserId, p_error: msg,
      })
      await admin.rpc('interview_calendar_failed', { p_interview: p.id })
      return { tipo: 'obsoleto', motivo: `permiso retirado: ${msg}` }
    }

    return { tipo: 'fallo', motivo: msg }
  }
}

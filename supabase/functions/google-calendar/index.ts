// Conectar y desconectar el Google Calendar de quien llama. verify_jwt = true.
//
// TRES COSAS QUE NO SON NEGOCIABLES AQUÍ:
//
//   1. La conexión es SIEMPRE la de quien llama. El `user_id` sale del JWT y
//      nunca del cuerpo de la petición: si viniera de fuera, cualquiera podría
//      desconectar el calendario de un compañero pasando su id.
//   2. Sin credenciales de Google no se ofrece nada. `estado` devuelve
//      `configurado: false` y la pantalla no pinta un botón que iba a fallar.
//      Es lo mismo que hace `WHATSAPP_LISTO` con lo que no puede salir.
//   3. El token no pasa por aquí más que de camino a Google. Se pide, se usa
//      para revocar y se olvida; nunca se devuelve al navegador.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET (y GOOGLE_REDIRECT_URI solo para desarrollo local).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { accessTokenDe, configurado, freeBusy, revocar, urlConsentimiento } from '../_shared/google/calendar.ts'
import { fundirOcupado, type Ocupado } from '../_shared/schedule/slots.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

/** 32 bytes al azar en base64url. Es lo único que ata la vuelta de Google a
 *  esta persona, así que sale del generador criptográfico y no de Math.random. */
function nonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { accion, companyId } = body as { accion?: string; companyId?: string }
    if (!companyId) return json({ error: 'Falta la empresa' }, 400)

    // Identidad del llamante: el JWT explícito a getUser (sin sesión, el
    // getUser() implícito falla según la versión de supabase-js).
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: auth } = await userClient.auth.getUser(jwt)
    const uid = auth?.user?.id
    if (!uid) return json({ error: 'No autorizado' }, 401)

    // Pertenencia al equipo. La comprueban también las RPC, pero aquí se corta
    // antes de tocar nada y con un mensaje que se entiende.
    const { data: miembro } = await admin
      .from('memberships').select('user_id').eq('company_id', companyId).eq('user_id', uid).maybeSingle()
    if (!miembro) return json({ error: 'No autorizado' }, 401)

    if (accion === 'estado') {
      const { data, error } = await userClient.rpc('calendar_connection_status', { p_company: companyId })
      if (error) return json({ error: error.message }, 400)
      return json({ configurado: configurado(), conexion: data })
    }

    if (accion === 'conectar') {
      if (!configurado()) return json({ error: 'sin_configurar' }, 503)
      const state = nonce()
      const { error } = await admin.rpc('calendar_oauth_state_new', {
        p_company: companyId, p_user: uid, p_nonce: state,
      })
      if (error) return json({ error: error.message }, 400)
      return json({ url: urlConsentimiento(state) })
    }

    if (accion === 'ocupado') {
      // Lo que el anfitrión ELEGIDO tiene cogido en un rango. Se contestan las
      // DOS fuentes en la misma llamada (nuestras entrevistas y su Google), y
      // eso no es comodidad: con solo una, el diálogo avisaría de una cita de
      // Google y se callaría ante otra entrevista nuestra a la misma hora, o al
      // revés. Un aviso que solo funciona a veces enseña a no hacerle caso.
      //
      // Solo horas. Ni el título del evento, ni con quién: para saber si un
      // hueco está libre no hace falta, y lo que no se pide no se puede filtrar.
      const host = (body.hostUserId as string) || uid
      const desde = new Date(String(body.desde ?? ''))
      const hasta = new Date(String(body.hasta ?? ''))
      if (!Number.isFinite(desde.getTime()) || !Number.isFinite(hasta.getTime())) {
        return json({ error: 'Rango no válido' }, 400)
      }
      // El anfitrión tiene que ser del equipo: si no, esto contaría la agenda de
      // cualquiera a quien se le pase el id.
      const { data: esDelEquipo } = await admin
        .from('memberships').select('user_id').eq('company_id', companyId).eq('user_id', host).maybeSingle()
      if (!esDelEquipo) return json({ error: 'No autorizado' }, 401)

      const { data: nuestroRaw } = await admin.rpc('interview_busy', {
        p_host: host, p_desde: desde.toISOString(), p_hasta: hasta.toISOString(),
      })
      let nuestro: Ocupado[] = ((nuestroRaw ?? []) as Array<{ start_at: string; end_at: string }>)
        .map((o) => ({ start: new Date(o.start_at), end: new Date(o.end_at) }))

      // UNA CITA QUE SE ESTÁ MOVIENDO NO SE CHOCA CONSIGO MISMA. Sin esto, al
      // abrir "Cambiar la cita" el aviso salta SIEMPRE, porque la hora que
      // viene puesta es justo la que esa entrevista tiene ocupada. Un aviso que
      // salta por construcción enseña a ignorarlo, y entonces deja de avisar el
      // día que el choque es de verdad.
      const excluir = body.excluirInterviewId as string | undefined
      if (excluir) {
        const { data: suya } = await admin
          .from('interviews').select('starts_at,ends_at,buffer_minutes').eq('id', excluir).maybeSingle()
        if (suya?.starts_at && suya?.ends_at) {
          // El mismo rango que calcula el trigger `interviews_fill_range`:
          // [inicio - buffer, fin + buffer]. Se compara exacto porque
          // `interview_busy` devuelve ese rango tal cual, no uno derivado.
          const ms = (suya.buffer_minutes ?? 0) * 60_000
          const ini = new Date(suya.starts_at).getTime() - ms
          const fin = new Date(suya.ends_at).getTime() + ms
          nuestro = nuestro.filter((o) => o.start.getTime() !== ini || o.end.getTime() !== fin)
        }
      }

      let deGoogle: Ocupado[] = []
      let calendario = false
      try {
        const { data } = await admin.rpc('calendar_connection_secret', { p_company: companyId, p_user: host })
        const conexion = data as { refreshToken?: string; calendarId?: string } | null
        if (conexion?.refreshToken) {
          const token = await accessTokenDe(conexion.refreshToken)
          deGoogle = await freeBusy(token, conexion.calendarId || 'primary', desde, hasta)
          calendario = true
        }
      } catch (e) {
        // Como en la agenda del agente: falla hacia abierto. Lo que se pierde es
        // un aviso, no la posibilidad de citar a nadie.
        console.error(`[google-calendar] freebusy: ${e instanceof Error ? e.message : String(e)}`)
        await admin.rpc('calendar_connection_error', {
          p_company: companyId, p_user: host, p_error: e instanceof Error ? e.message : String(e),
        }).catch(() => undefined)
      }

      // La zona del ANFITRIÓN viaja con la respuesta. Sin ella, quien pinta el
      // aviso compararía la hora que has escrito (que es la hora de pared del
      // anfitrión) con instantes UTC usando la zona del NAVEGADOR, y el aviso
      // saldría una hora movido en una empresa de Canarias mirada desde Madrid.
      const { data: cfg } = await admin.rpc('interview_host_config', {
        p_company: companyId, p_user: host,
      })
      const tz = (cfg as { timezone?: string } | null)?.timezone || 'Europe/Madrid'

      return json({
        calendario,
        tz,
        tramos: fundirOcupado([...nuestro, ...deGoogle])
          .map((t) => ({ start: t.start.toISOString(), end: t.end.toISOString() })),
      })
    }

    if (accion === 'desconectar') {
      // Se retira el permiso EN GOOGLE, no solo en nuestra base: si solo
      // borráramos la fila, la llave seguiría viva en su cuenta y en la lista
      // de aplicaciones con acceso, que es donde alguien va a mirar.
      const { data: secreto } = await admin.rpc('calendar_connection_secret', {
        p_company: companyId, p_user: uid,
      })
      const refresh = (secreto as { refreshToken?: string } | null)?.refreshToken
      if (refresh) await revocar(refresh)

      const { error } = await admin.rpc('calendar_connection_delete', { p_company: companyId, p_user: uid })
      if (error) return json({ error: error.message }, 400)
      // LO QUE YA ESTÁ PUESTO EN SU CALENDARIO SE QUEDA. Sin permiso no
      // podríamos borrarlo aunque quisiéramos, y aunque pudiéramos: vaciarle la
      // agenda a alguien porque ha desconectado una integración es lo último
      // que espera. Las entrevistas siguen enteras en el panel.
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[google-calendar] ${msg}`)
    return json({ error: msg }, 500)
  }
})

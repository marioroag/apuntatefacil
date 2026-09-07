// La vuelta de Google tras el consentimiento. verify_jwt = FALSE, y no es un
// descuido: quien llama aquí es el navegador redirigido por Google, sin nuestra
// cabecera de sesión. Por eso toda la autorización la carga el `state`, que es
// de un solo uso, caduca a los quince minutos y solo lo pudo crear una sesión
// autenticada (`calendar_oauth_state_new`).
//
// No devuelve JSON: devuelve a la persona a Ajustes, con el resultado en la
// URL. Una pantalla en blanco con un error de API es el peor sitio donde dejar
// a alguien que acaba de dar permiso a su calendario.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { canjearCodigo } from '../_shared/google/calendar.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

/** Siempre a la misma pantalla, con el resultado dicho en el parámetro. */
function volver(resultado: string): Response {
  const destino = `${APP_URL}/app/ajustes/whatsapp?calendario=${encodeURIComponent(resultado)}`
  return new Response(null, { status: 302, headers: { Location: destino } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  const error = url.searchParams.get('error')

  // Pulsar "Cancelar" en la pantalla de Google no es un fallo: es una respuesta.
  if (error === 'access_denied') return volver('cancelado')
  if (error) return volver('error')
  if (!code || !state) return volver('error')

  try {
    const { data: dueño, error: e1 } = await admin.rpc('calendar_oauth_state_claim', { p_nonce: state })
    if (e1) throw new Error(e1.message)
    // Sin dueño: el `state` no existe, ya se usó o caducó. No se dice cuál de
    // las tres, porque para quien lo intenta la respuesta es la misma y decirlo
    // solo ayuda a quien esté probando.
    if (!dueño) return volver('caducado')
    const { companyId, userId } = dueño as { companyId: string; userId: string }

    const canje = await canjearCodigo(code)

    // Que Google haya dicho que sí no significa que haya dado los permisos que
    // pedimos: en su pantalla se pueden desmarcar uno a uno. Sin el de
    // escritura no podríamos poner la cita, y sin el de ocupado no podríamos
    // restar: guardar la conexión igual sería prometer algo que no va a pasar.
    const falta = ['calendar.events', 'calendar.freebusy'].filter(
      (s) => !canje.scopes.some((c) => c.endsWith(s)),
    )
    if (falta.length) return volver('permisos')

    const { error: e2 } = await admin.rpc('calendar_connection_save', {
      p_company: companyId,
      p_user: userId,
      p_sub: canje.sub,
      p_email: canje.email,
      p_refresh: canje.refreshToken,
      p_scopes: canje.scopes,
    })
    if (e2) throw new Error(e2.message)

    return volver('ok')
  } catch (e) {
    console.error(`[google-calendar-callback] ${e instanceof Error ? e.message : String(e)}`)
    return volver('error')
  }
})

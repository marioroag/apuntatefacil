// El correo de FIN DE PRUEBA, en dos momentos: tres días antes ("te quedan 3
// días") y al terminar ("tu prueba ha terminado: vuelve cuando quieras"). Lo
// llama la cola (interview-tick, con service_role) a partir de los trabajos
// que encola `encolar_avisos_prueba` cada mañana. Ver la migración
// 20260908140000_aviso_fin_de_prueba.sql.
//
// Reglas, las mismas que notify-new-candidate:
//  * Solo el servidor lo llama (service_role): un correo a un cliente no puede
//    dispararse desde un navegador con un id de empresa.
//  * Quien ya no está en prueba no recibe nada: si pagó entre que se encoló y
//    se ejecutó, el trabajo se cancela con su motivo.
//  * Un correo por tipo y empresa: el reclamo es atómico (la marca en la
//    empresa se pone solo si estaba vacía) y se suelta si Resend no responde,
//    por los dos caminos (rechazo y red caída), para que la cola reintente.
//  * Toda salida que no envía dice por qué (`skipped`), y un fallo del
//    proveedor viene con `error` y un 502, para que la cola distinga cancelar
//    de reintentar.
//
// No pasa por las preferencias de correo a propósito: es el aviso de que
// empieza a cobrarse o de que ha terminado lo gratis, como los correos de
// acceso, y eso no se apaga. Está apuntado en CORREOS_SIN_AJUSTE.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { esc, renderEmail } from '../_shared/email.ts'
import { PLAZO, plazo } from '../_shared/red.ts'
import { finDePrueba } from '../_shared/prueba.ts'

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE_KEY)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''
const PRECIO = 49

type Tipo = 'previo' | 'fin'

function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!SERVICE_ROLE_KEY || !igualSeguro(bearer, SERVICE_ROLE_KEY)) return json({ error: 'Solo la cola puede mandar este correo' }, 403)

    const { company_id, tipo } = await req.json()
    if (typeof company_id !== 'string' || (tipo !== 'previo' && tipo !== 'fin')) return json({ error: 'Faltan company_id o tipo' }, 400)
    const t = tipo as Tipo
    const marca = t === 'previo' ? 'trial_aviso_previo_at' : 'trial_aviso_fin_at'

    const { data: co } = await admin
      .from('companies')
      .select('id,name,plan,trial_ends_at,trial_campaign_id,trial_aviso_previo_at,trial_aviso_fin_at')
      .eq('id', company_id)
      .maybeSingle()
    if (!co) return json({ ok: true, sent: false, skipped: 'empresa no encontrada' })
    // Quien ya paga (o ya no está en prueba por lo que sea) no recibe esto.
    if (co.plan !== 'trial') return json({ ok: true, sent: false, skipped: 'ya no está en prueba' })
    if (!co.trial_ends_at) return json({ ok: true, sent: false, skipped: 'la prueba no ha empezado' })
    if (t === 'previo' && new Date(co.trial_ends_at).getTime() <= Date.now()) {
      return json({ ok: true, sent: false, skipped: 'la prueba ya terminó: el aviso previo no procede' })
    }
    if (!RESEND_API_KEY) return json({ ok: true, sent: false, skipped: 'sin clave de Resend' })

    const { data: emailRow } = await admin.rpc('get_company_owner_email', { p_company: co.id })
    const ownerEmail = emailRow as string | null
    if (!ownerEmail) return json({ ok: true, sent: false, skipped: 'sin email del dueño' })

    const { data: camp } = co.trial_campaign_id
      ? await admin.from('campaigns').select('id,title').eq('id', co.trial_campaign_id).maybeSingle()
      : { data: null }
    const puesto = camp?.title ?? 'tu puesto'
    // ACTIVAR EL PAGO AHORA NO QUEMA LOS DÍAS QUE QUEDAN, y este correo es el
    // mejor sitio donde decirlo: es lo único que quita el motivo para esperar
    // al último día, que es cuando el cliente está más frío. Pero solo se
    // promete si de verdad va a pasar, y eso depende de cuántos procesos
    // cubriría el pago (la prueba cubre uno): se pregunta a la MISMA función
    // que lo aplica en Stripe, no a una copia de la regla.
    const { count: aCubrir } = await admin
      .from('campaigns').select('id', { count: 'exact', head: true })
      .eq('company_id', co.id).or('status.neq.cerrada,closed_at.is.null')
    const sinCobroHoy = finDePrueba(co.plan, co.trial_ends_at, aCubrir ?? 1) !== null
    const { count: esperando } = await admin
      .from('candidates').select('id', { count: 'exact', head: true }).eq('company_id', co.id).eq('locked', true)

    const planLink = APP_URL ? `${APP_URL}/app/plan` : ''
    const puestoLink = APP_URL && camp ? `${APP_URL}/app/puestos/${camp.id}` : ''
    const fecha = fechaLarga(co.trial_ends_at)
    const strong = (s: string) => `<strong style="font-weight:600;color:#131822">${s}</strong>`
    const condiciones = `${PRECIO} € al mes por cada proceso abierto, impuestos aparte, sin permanencia: lo cierras cuando quieras y tus candidatos siguen siendo tuyos.`

    let subject: string
    let html: string
    if (t === 'previo') {
      subject = `Tu prueba termina el ${fecha}`
      html = renderEmail({
        preview: `${puesto} sigue en línea hasta el ${fecha}`,
        heading: 'Te quedan tres días de prueba',
        bodyHtml:
          `Tu puesto ${strong(esc(puesto))} sigue en línea y recibiendo candidaturas hasta el ${strong(esc(fecha))}. ` +
          `A partir de ahí no se pierde ninguna: las nuevas quedan guardadas en espera y las ves todas en cuanto actives el pago.<br><br>` +
          (sinCobroHoy
            ? `Puedes dejar tu método de pago hoy sin perder lo que te queda: ${strong('no se te cobra nada hasta el ' + esc(fecha))}, ` +
              `cuando acabe la prueba.<br><br>`
            : '') +
          esc(condiciones),
        buttons: [
          ...(planLink ? [{ label: 'Activar el pago', href: planLink }] : []),
          ...(puestoLink ? [{ label: 'Ver mis candidaturas', href: puestoLink }] : []),
        ],
        footnote: 'Si no quieres seguir, no tienes que hacer nada: no se cobra nada sin que añadas tu método de pago.',
      })
    } else {
      const n = esperando ?? 0
      subject = 'Tu prueba ha terminado: vuelve cuando quieras'
      html = renderEmail({
        preview: n > 0 ? `Tienes ${n} candidaturas esperando` : 'Tus candidatos siguen aquí',
        heading: 'Tu prueba ha terminado',
        bodyHtml:
          `Gracias por probar Apúntate Fácil. Tu puesto ${strong(esc(puesto))} sigue publicado, y todo lo que ya tenías sigue aquí.<br><br>` +
          (n > 0
            ? `Desde que terminó la prueba han entrado ${strong(`${n} ${n === 1 ? 'candidatura' : 'candidaturas'}`)} que están esperando: `
            : 'Las candidaturas que lleguen a partir de ahora quedan guardadas en espera: ') +
          `en cuanto actives el pago las ves todas, sin perder ninguna.<br><br>` +
          esc(condiciones),
        button: planLink ? { label: n > 0 ? 'Activar el pago y ver las candidaturas' : 'Activar el pago', href: planLink } : undefined,
        footnote: 'Si prefieres no seguir, no tienes que hacer nada. Puedes exportar a Excel lo que ya tienes cuando quieras.',
      })
    }

    // Reclamo atómico: un correo por tipo y empresa.
    const { data: claimed } = await admin
      .from('companies')
      .update({ [marca]: new Date().toISOString() })
      .eq('id', co.id)
      .is(marca, null)
      .select('id')
    if (!claimed || claimed.length === 0) return json({ ok: true, sent: false, skipped: 'ya avisado' })
    const soltarReclamo = () => admin.from('companies').update({ [marca]: null }).eq('id', co.id)

    let res: Response
    try {
      res = await fetch('https://api.resend.com/emails', {
        signal: plazo(PLAZO.api),
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: ownerEmail, subject, html }),
      })
    } catch (e) {
      await soltarReclamo()
      return json({ ok: false, sent: false, error: `Resend inalcanzable: ${e instanceof Error ? e.message : e}` }, 502)
    }
    if (res.ok) return json({ ok: true, sent: true })
    await soltarReclamo()
    return json({ ok: false, sent: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }, 502)
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

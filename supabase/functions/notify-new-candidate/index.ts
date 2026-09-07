// Avisa por email al dueño de la empresa cuando entra una candidatura nueva.
// Lo invoca el formulario público tras enviar (con el candidate_id). verify_jwt = false.
// Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFY_FROM (ej. "Apúntate Fácil <avisos@apuntatefacil.com>"),
// APP_URL (ej. https://apuntatefacil.com) para el enlace al panel.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { esc, renderEmail } from '../_shared/email.ts'
import { conPreferencia } from '../_shared/prefs.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { candidate_id } = await req.json()
    if (!candidate_id) return json({ error: 'Falta candidate_id' }, 400)

    const { data: cand } = await admin
      .from('candidates').select('id,campaign_id,company_id,answers,locked').eq('id', candidate_id).single()
    if (!cand) return json({ ok: true, skipped: 'candidato no encontrado' })

    const { data: camp } = await admin
      .from('campaigns').select('title,slug,notify_new').eq('id', cand.campaign_id).single()
    // El puesto puede tener los avisos por email desactivados: no enviamos nada.
    if (camp && camp.notify_new === false) return json({ ok: true, sent: false, skipped: 'avisos desactivados' })
    // Dos filtros distintos y los dos mandan: el PUESTO puede tener los avisos
    // apagados (arriba) y la PERSONA puede no querer este aviso en su bandeja.
    const { data: ownerRow } = await admin.rpc('company_owner_id', { p_company: cand.company_id })
    const ownerId = ownerRow as string | null
    const quieren = ownerId
      ? await conPreferencia(admin, [{ user_id: ownerId, email: '' }], 'candidato_nuevo')
      : []
    if (ownerId && quieren.length === 0) return json({ ok: true, sent: false, skipped: 'aviso desactivado' })
    const { data: emailRow } = await admin.rpc('get_company_owner_email', { p_company: cand.company_id })
    const ownerEmail = emailRow as string | null

    if (!RESEND_API_KEY || !ownerEmail) {
      // Sin clave o sin email: no-op silencioso (queda listo para enchufar la clave).
      return json({ ok: true, sent: false })
    }

    const puesto = camp?.title ?? 'tu puesto'
    const puestoLink = APP_URL ? `${APP_URL}/app/puestos/${cand.campaign_id}` : ''
    const planLink = APP_URL ? `${APP_URL}/app/plan` : ''

    let subject: string
    let html: string
    if (cand.locked) {
      // Candidato BLOQUEADO (superado el tope del plan de Prueba): teaser SIN datos
      // personales (no revelamos nombre ni teléfono). Avisa del tope alcanzado y de
      // cuántas candidaturas reales esperan ya en este puesto (la actual incluida),
      // e invita a mejorar el plan. Si el recuento fallara, cae al copy singular.
      const { count } = await admin
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', cand.campaign_id)
        .eq('locked', true)
      const n = count ?? 1
      const strong = (s: string) => `<strong style="font-weight:600;color:#131822">${s}</strong>`
      if (n > 1) {
        subject = `Tienes ${n} candidaturas esperando: ${puesto}`
        html = renderEmail({
          preview: `Ya son ${n} las candidaturas esperando en ${puesto}`,
          heading: `${n} candidaturas te esperan`,
          bodyHtml:
            `Ha entrado otra candidatura en ${strong(esc(puesto))}, ` +
            `pero has alcanzado el tope del plan de Prueba. ` +
            `Ya son ${strong(String(n))} las candidaturas esperando. ` +
            `Mejora tu plan para verlas y no perder ninguna.`,
          button: planLink ? { label: 'Mejorar plan', href: planLink } : undefined,
        })
      } else {
        subject = `Tienes una candidatura esperando: ${puesto}`
        html = renderEmail({
          preview: `Una nueva candidatura espera en ${puesto}`,
          heading: 'Una candidatura te espera',
          bodyHtml:
            `Ha entrado una nueva candidatura en ${strong(esc(puesto))}, ` +
            `pero has alcanzado el tope del plan de Prueba. ` +
            `Mejora tu plan para verla y no perder ninguna.`,
          button: planLink ? { label: 'Mejorar plan', href: planLink } : undefined,
        })
      }
    } else {
      const nombre = (cand.answers?.nombre as string) ?? 'Alguien'
      const tel = (cand.answers?.telefono as string) ?? ''
      subject = `Nueva candidatura: ${puesto}`
      html = renderEmail({
        preview: `${nombre} acaba de apuntarse a ${puesto}`,
        heading: 'Nueva candidatura',
        bodyHtml:
          `<strong style="font-weight:600;color:#131822">${esc(nombre)}</strong> acaba de apuntarse a ` +
          `<strong style="font-weight:600;color:#131822">${esc(puesto)}</strong>.` +
          (tel ? `<br><span style="color:#6f727c">Tel.</span> ${esc(tel)}` : ''),
        button: puestoLink ? { label: 'Ver candidatura', href: puestoLink } : undefined,
      })
    }

    // Idempotencia: reclama el aviso de forma atómica (solo si aún no se notificó).
    // Al ser un endpoint público, esto impide reenviar el email en bucle con un
    // candidate_id conocido (email-bombing) y cierra el oráculo de existencia.
    const { data: claimed } = await admin
      .from('candidates')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', candidate_id)
      .is('notified_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      return json({ ok: true, sent: false, skipped: 'ya notificado' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: ownerEmail,
        subject,
        html,
      }),
    })
    return json({ ok: true, sent: res.ok })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

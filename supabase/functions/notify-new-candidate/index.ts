// Avisa por email al dueño de la empresa cuando entra una candidatura nueva.
// Lo invoca el formulario público tras enviar (con el candidate_id). verify_jwt = false.
// Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFY_FROM (ej. "Criba <avisos@tudominio>"),
// APP_URL (ej. https://criba.app) para el enlace al panel.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Criba <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { candidate_id } = await req.json()
    if (!candidate_id) return json({ error: 'Falta candidate_id' }, 400)

    const { data: cand } = await admin
      .from('candidates').select('id,campaign_id,company_id,answers').eq('id', candidate_id).single()
    if (!cand) return json({ ok: true, skipped: 'candidato no encontrado' })

    const { data: camp } = await admin
      .from('campaigns').select('title,slug').eq('id', cand.campaign_id).single()
    const { data: emailRow } = await admin.rpc('get_company_owner_email', { p_company: cand.company_id })
    const ownerEmail = emailRow as string | null

    if (!RESEND_API_KEY || !ownerEmail) {
      // Sin clave o sin email: no-op silencioso (queda listo para enchufar la clave).
      return json({ ok: true, sent: false })
    }

    const nombre = (cand.answers?.nombre as string) ?? 'Alguien'
    const tel = (cand.answers?.telefono as string) ?? ''
    const link = APP_URL ? `${APP_URL}/app/puestos/${cand.campaign_id}` : ''
    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;color:#0f172a">
        <h2 style="margin:0 0 8px">Nueva candidatura para ${camp?.title ?? 'tu puesto'}</h2>
        <p style="color:#475569;margin:0 0 12px"><strong>${nombre}</strong>${tel ? ` · ${tel}` : ''} acaba de enviar su candidatura.</p>
        ${link ? `<a href="${link}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:12px;font-weight:600">Ver en Criba</a>` : ''}
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: ownerEmail,
        subject: `Nueva candidatura: ${camp?.title ?? 'puesto'}`,
        html,
      }),
    })
    return json({ ok: true, sent: res.ok })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

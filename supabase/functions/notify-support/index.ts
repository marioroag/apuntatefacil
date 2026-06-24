// Avisa por email al equipo de soporte cuando entra una consulta nueva.
// Lo invoca el formulario de soporte (panel y landing) tras enviar, con el ticket_id.
// verify_jwt = false (la landing es anónima). No-op silencioso si falta RESEND_API_KEY.
// Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFY_FROM, SUPPORT_TO (buzón
// de soporte, ej. "soporte@apuntatefacil.com"), APP_URL (para el enlace al panel).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const SUPPORT_TO = Deno.env.get('SUPPORT_TO') ?? 'soporte@apuntatefacil.com'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { ticket_id } = await req.json()
    if (!ticket_id) return json({ error: 'Falta ticket_id' }, 400)

    const { data: t } = await admin
      .from('support_tickets')
      .select('email,name,message,source,plan,page,company_id')
      .eq('id', ticket_id)
      .single()
    if (!t) return json({ ok: true, skipped: 'consulta no encontrada' })

    if (!RESEND_API_KEY) {
      // Sin clave: no-op silencioso. La consulta ya quedó guardada en la tabla.
      return json({ ok: true, sent: false })
    }

    const quien = (t.name as string) || (t.email as string)
    const origen = t.source === 'landing' ? 'desde la web' : 'desde el panel'
    const meta = [t.plan ? `Plan: ${t.plan}` : null, t.page ? `Pantalla: ${t.page}` : null]
      .filter(Boolean)
      .join(' · ')
    const html = `
      <div style="font-family:system-ui,sans-serif;color:#131822">
        <h2 style="margin:0 0 8px">Nueva consulta de soporte (${esc(origen)})</h2>
        <p style="color:#50545e;margin:0 0 12px"><strong>${esc(quien)}</strong> &lt;${esc(t.email as string)}&gt;${meta ? ` · ${esc(meta)}` : ''}</p>
        <div style="white-space:pre-wrap;border-left:3px solid #e5e7eb;padding:4px 0 4px 12px;color:#131822">${esc(t.message as string)}</div>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: SUPPORT_TO,
        reply_to: t.email,
        subject: `Soporte (${t.source}): ${quien}`,
        html,
      }),
    })
    return json({ ok: true, sent: res.ok })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

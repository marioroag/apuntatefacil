// Avisa por email a soporte (Mario) cuando entra una consulta nueva.
// Lo invoca el formulario de soporte (panel y landing) tras enviar, con el ticket_id.
// verify_jwt = false (la landing es anónima). No-op silencioso si falta RESEND_API_KEY.
// Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFY_FROM, SUPPORT_TO (opcional,
// sobreescribe el destinatario por defecto), APP_URL (para el enlace al panel).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { renderEmail, esc, SUPPORT_INBOX } from '../_shared/email.ts'

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
    const origen =
      t.source === 'landing' ? 'desde la web' : t.source === 'email' ? 'por email' : 'desde el panel'
    const meta = [t.plan ? `Plan ${t.plan}` : null, t.page ? `Pantalla: ${t.page}` : null]
      .filter(Boolean)
      .join(' · ')
    const msg = (t.message as string) || ''
    const html = renderEmail({
      preview: `${quien}: ${msg.slice(0, 90)}`,
      heading: 'Nueva consulta de soporte',
      bodyHtml: `
        <p style="margin:0"><strong>${esc(quien)}</strong> &lt;${esc(t.email as string)}&gt; · ${esc(origen)}</p>
        ${meta ? `<p style="margin:6px 0 0;font-size:13px;color:#6f727c">${esc(meta)}</p>` : ''}
        <div style="margin:14px 0 0;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;white-space:pre-wrap;color:#131822">${esc(msg)}</div>`,
      button: APP_URL ? { label: 'Abrir la bandeja', href: `${APP_URL}/app/soporte` } : undefined,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: SUPPORT_INBOX,
        reply_to: t.email,
        subject: `Soporte: ${quien}`,
        html,
      }),
    })
    return json({ ok: true, sent: res.ok })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

// Avisa por email a soporte (Mario) cuando entra una consulta nueva.
// Lo invoca el formulario de soporte (panel y landing) tras enviar, con el ticket_id.
// verify_jwt = false (la landing es anónima). No-op silencioso si falta RESEND_API_KEY.
// Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NOTIFY_FROM, SUPPORT_TO (opcional,
// sobreescribe el destinatario por defecto), APP_URL (para el enlace al panel).
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { renderPlainEmail, esc, SUPPORT_INBOX } from '../_shared/email.ts'
import { PLAZO, plazo } from '../_shared/red.ts'

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
    const link = APP_URL ? `${APP_URL}/app/soporte` : ''
    const html = renderPlainEmail(
      `${quien}: ${msg.slice(0, 90)}`,
      `<p style="margin:0">Nueva consulta de <strong>${esc(quien)}</strong> &lt;${esc(t.email as string)}&gt; · ${esc(origen)}.</p>
        ${meta ? `<p style="margin:6px 0 0;font-size:13px;color:#6f727c">${esc(meta)}</p>` : ''}
        <div style="margin:14px 0 0;white-space:pre-wrap">${esc(msg)}</div>
        ${link ? `<p style="margin:18px 0 0"><a href="${link}" style="color:#374cce;text-decoration:none">Abrir la bandeja &rarr;</a></p>` : ''}`,
    )

    // Idempotencia: reclama el aviso de forma atómica (solo si aún no se
    // notificó). Es un endpoint público que recibe el ticket_id del cliente,
    // así que sin esto un id conocido reenviaba el correo al buzón de soporte
    // tantas veces como se llamara (auditoría, sep 2026; mismo patrón que
    // candidates.notified_at en notify-new-candidate).
    const { data: claimed } = await admin
      .from('support_tickets')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', ticket_id)
      .is('notified_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      return json({ ok: true, sent: false, skipped: 'ya notificado' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      signal: plazo(PLAZO.api),
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

// Responder a una consulta de soporte DESDE la app. verify_jwt = true (lo llama el
// operario logueado). Comprueba que es staff, guarda el mensaje saliente en el hilo y
// envía el email al cliente por Resend, con un reply-to que lleva el token del ticket
// (soporte+<reply_token>@dominio) para que su respuesta vuelva al mismo hilo.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (auto), RESEND_API_KEY,
// SUPPORT_TO (buzón base, ej. soporte@apuntatefacil.com).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { renderEmail, esc } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPPORT_TO = Deno.env.get('SUPPORT_TO') ?? 'soporte@apuntatefacil.com'
const FROM = `Apúntate Fácil <${SUPPORT_TO}>`
const SUBJECT = 'Tu consulta a Apúntate Fácil' // estable por hilo: agrupa en el cliente
const SIGN = 'Equipo de Apúntate Fácil'

// El texto del operario, con saltos de línea preservados y escapado para HTML.
function bodyToHtml(text: string): string {
  return esc(text).replace(/\n/g, '<br>')
}

// soporte@dominio + token -> soporte+token@dominio
function plusAddress(base: string, token: string): string {
  const [local, domain] = base.split('@')
  return `${local}+${token}@${domain}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // Cliente con el JWT del usuario para comprobar staff con su propia identidad.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: isStaff } = await userClient.rpc('is_support_staff')
    if (!isStaff) return json({ error: 'No autorizado' }, 403)
    const { data: userData } = await userClient.auth.getUser()
    const authorId = userData?.user?.id ?? null

    const { ticket_id, body } = await req.json()
    const text = typeof body === 'string' ? body.trim() : ''
    if (!ticket_id || !text) return json({ error: 'Faltan datos' }, 400)

    const { data: ticket } = await admin
      .from('support_tickets')
      .select('id,email,reply_token')
      .eq('id', ticket_id)
      .single()
    if (!ticket) return json({ error: 'Ticket no encontrado' }, 404)

    // Último saliente con id de Resend, para hilar (In-Reply-To / References).
    const { data: lastOut } = await admin
      .from('support_messages')
      .select('resend_email_id')
      .eq('ticket_id', ticket_id)
      .eq('direction', 'out')
      .not('resend_email_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Enviar por Resend. Si falta la clave, no-op de envío: el mensaje igual se guarda.
    let resendId: string | null = null
    let sent = false
    if (RESEND_API_KEY) {
      const headers = lastOut?.resend_email_id
        ? { 'In-Reply-To': `<${lastOut.resend_email_id}>`, References: `<${lastOut.resend_email_id}>` }
        : undefined
      // Sin saludo automático: el operario escribe el "Hola ...," él mismo al responder.
      const html = renderEmail({
        preview: text.slice(0, 90),
        bodyHtml: `
          <div style="white-space:pre-wrap">${bodyToHtml(text)}</div>
          <p style="margin:20px 0 0">Un saludo,<br><strong>${esc(SIGN)}</strong></p>`,
        footnote: 'Puedes responder a este correo y seguimos la conversación por aquí.',
      })
      const plain = `${text}\n\nUn saludo,\n${SIGN}\n\n— Puedes responder a este correo y seguimos la conversación por aquí.`
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: ticket.email,
          reply_to: plusAddress(SUPPORT_TO, ticket.reply_token),
          subject: SUBJECT,
          html,
          text: plain,
          headers,
        }),
      })
      if (res.ok) {
        const j = await res.json()
        resendId = (j.id as string) ?? null
        sent = true
      }
    }

    const { data: msg, error } = await admin
      .from('support_messages')
      .insert({ ticket_id, direction: 'out', body: text, author_user_id: authorId, resend_email_id: resendId })
      .select()
      .single()
    if (error) return json({ error: error.message }, 500)

    await admin.from('support_tickets').update({
      last_message_at: new Date().toISOString(),
      awaiting: 'cliente',
      status: 'abierto',
    }).eq('id', ticket_id)

    return json({ ok: true, sent, message: msg })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

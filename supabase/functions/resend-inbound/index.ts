// Webhook de Resend (email.received): mete las respuestas entrantes de los clientes
// en el hilo del ticket correcto. verify_jwt = false (lo llama Resend, no un usuario).
//
// Enrutado: cuando el equipo responde, el reply-to lleva un token en el plus-address
// (soporte+<reply_token>@apuntatefacil.com). Aquí leemos ese token del `to[]` y
// resolvemos el ticket. Sin token reconocible => ticket nuevo (source 'email').
//
// El webhook NO trae el cuerpo, solo metadatos: el texto se pide a la Received Emails
// API (GET /emails/receiving/{id}). En local, sin RESEND_API_KEY, se acepta un `text`
// en el propio payload para poder probar con peticiones sintéticas.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_WEBHOOK_SECRET (firma Svix),
// RESEND_API_KEY, NOTIFY_FROM, SUPPORT_TO, APP_URL.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Webhook } from 'npm:svix'
import { corsHeaders, json } from '../_shared/cors.ts'
import { renderEmail, esc, SUPPORT_INBOX } from '../_shared/email.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

const stripHtml = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// Recorta la cita de una respuesta de email (top-posting): nos quedamos con el texto
// nuevo y tiramos la conversación citada que el cliente arrastra debajo. Cubre Gmail y
// Outlook, en español e inglés. Si no hay cita reconocible, devuelve el texto entero.
function stripQuotedReply(raw: string): string {
  const text = (raw ?? '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const markers = [
    /^\s*>/, // línea citada
    /^\s*El\b.*\bescribi[oó]:\s*$/i, // Gmail ES: "El <fecha>, X escribió:"
    /^\s*On\b.*\bwrote:\s*$/i, // Gmail EN: "On <date>, X wrote:"
    /^\s*-{2,}\s*(Mensaje original|Original Message)\s*-{2,}/i,
    /^\s*(De|From):\s.+\S+@\S+/i, // cabecera de reenvío
    /^\s*_{5,}\s*$/, // separador Outlook
  ]
  let cut = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (markers.some((re) => re.test(lines[i]))) {
      cut = i
      break
    }
  }
  const reply = lines.slice(0, cut).join('\n').trim()
  return reply || text.trim()
}

// "Nombre <correo@dominio>" -> "correo@dominio"
function bareEmail(from: string): string {
  const m = String(from).match(/<([^>]+)>/)
  return (m ? m[1] : String(from)).trim().toLowerCase()
}

// token del plus-address: soporte+<token>@dominio
function tokenFromRecipients(to: unknown): string | null {
  const arr = Array.isArray(to) ? to : [to]
  for (const addr of arr) {
    const m = String(addr).match(/\+([^@]+)@/)
    if (m) return m[1].trim()
  }
  return null
}

// Cuerpo del email entrante. Rama de test: si el payload ya trae texto, se usa tal cual
// (para pruebas locales). En prod se pide a la Received Emails API con el email_id.
async function fetchBody(data: Record<string, unknown>): Promise<string> {
  if (typeof data.text === 'string' && data.text.trim()) return data.text as string
  if (!RESEND_API_KEY || !data.email_id) return ''
  const res = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  })
  if (!res.ok) return ''
  const body = await res.json()
  return (body.text as string) || stripHtml((body.html as string) ?? '') || ''
}

async function notifyTeam(fromEmail: string, body: string) {
  if (!RESEND_API_KEY) return
  const link = APP_URL ? `${APP_URL}/app/soporte` : ''
  const quien = fromEmail || 'Un cliente'
  const html = renderEmail({
    preview: `${quien}: ${body.slice(0, 90)}`,
    heading: 'Nueva respuesta de soporte',
    bodyHtml: `
      <p style="margin:0 0 12px"><strong>${esc(quien)}</strong> ha respondido a una consulta.</p>
      <div style="padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;white-space:pre-wrap;color:#131822">${esc(body)}</div>`,
    button: link ? { label: 'Abrir la bandeja', href: link } : undefined,
  })
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: SUPPORT_INBOX,
      reply_to: fromEmail || undefined,
      subject: `Respuesta de soporte de ${quien}`,
      html,
    }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const raw = await req.text()

  // Verificación Svix. En prod el secret SIEMPRE está y se exige firma; en local, sin
  // secret, se acepta sin verificar para poder probar con payloads sintéticos.
  let evt: { type?: string; data?: Record<string, unknown> }
  if (WEBHOOK_SECRET) {
    try {
      evt = new Webhook(WEBHOOK_SECRET).verify(raw, {
        'svix-id': req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      }) as typeof evt
    } catch (e) {
      return json({ error: `Firma no válida: ${e instanceof Error ? e.message : e}` }, 400)
    }
  } else {
    try {
      evt = JSON.parse(raw)
    } catch {
      return json({ error: 'JSON inválido' }, 400)
    }
  }

  if (evt?.type !== 'email.received') return json({ ok: true, skipped: evt?.type ?? 'sin tipo' })

  const data = evt.data ?? {}
  try {
    const fromEmail = bareEmail((data.from as string) ?? '')
    const body = stripQuotedReply(await fetchBody(data)) || '(sin contenido)'
    const resendId = (data.message_id as string) ?? (data.email_id as string) ?? null
    const token = tokenFromRecipients(data.to)

    // Resolver el ticket por el token del plus-address.
    let ticketId: string | null = null
    if (token) {
      const { data: t } = await admin.from('support_tickets').select('id').eq('reply_token', token).maybeSingle()
      ticketId = t?.id ?? null
    }

    if (ticketId) {
      // Respuesta dentro de un hilo existente.
      await admin.from('support_messages').insert({
        ticket_id: ticketId,
        direction: 'in',
        body,
        from_email: fromEmail || null,
        resend_email_id: resendId,
      })
      await admin.from('support_tickets').update({
        last_message_at: new Date().toISOString(),
        awaiting: 'equipo',
        status: 'abierto',
      }).eq('id', ticketId)
      notifyTeam(fromEmail, body).catch(() => {})
      return json({ ok: true, ticket: ticketId })
    }

    // Sin token reconocible: email directo a soporte@ => ticket nuevo. El cuerpo es la
    // cabecera del hilo (igual que un alta por formulario); defaults dan abierto/equipo.
    const { data: nt, error } = await admin.from('support_tickets').insert({
      email: fromEmail || 'desconocido@desconocido',
      message: body,
      source: 'email',
    }).select('id').single()
    if (error) return json({ error: error.message }, 500)
    notifyTeam(fromEmail).catch(() => {})
    return json({ ok: true, ticket: nt?.id, created: true })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

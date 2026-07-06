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
import { renderPlainEmail, esc, SUPPORT_INBOX } from '../_shared/email.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET')
// Solo para pruebas LOCALES con payloads sintéticos: acepta inbound sin firma. NUNCA
// se define en producción; sin firma ni este flag, la función rechaza el evento.
const ALLOW_UNSIGNED = Deno.env.get('ALLOW_UNSIGNED_INBOUND') === 'true'
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
  const isQuoted = (l: string) => /^\s*>/.test(l) // línea citada
  // Inicio de cabecera de cita de Gmail ("El ... escribió:" / "On ... wrote:"). La
  // cabecera puede partirse en varias líneas, así que confirmamos mirando el bloque.
  const startsAttribution = (l: string) => /^\s*(El|On)\b/.test(l)
  const attributionEnds = (s: string) => /(escrib(i[oó])|wrote)\s*:/i.test(s)
  // Separadores duros (Outlook, reenvíos): cortan por sí solos.
  const hardSeparator = (l: string) =>
    /^\s*-{2,}\s*(Mensaje original|Original Message)\s*-{2,}/i.test(l) ||
    /^\s*(De|From):\s.+\S+@\S+/i.test(l) ||
    /^\s*_{5,}\s*$/.test(l)

  let cut = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (isQuoted(lines[i]) || hardSeparator(lines[i])) {
      cut = i
      break
    }
    if (startsAttribution(lines[i]) && attributionEnds(lines.slice(i, i + 3).join(' '))) {
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
  const html = renderPlainEmail(
    `${quien}: ${body.slice(0, 90)}`,
    `<p style="margin:0"><strong>${esc(quien)}</strong> ha respondido a una consulta.</p>
      <div style="margin:14px 0 0;white-space:pre-wrap">${esc(body)}</div>
      ${link ? `<p style="margin:18px 0 0"><a href="${link}" style="color:#374cce;text-decoration:none">Abrir la bandeja &rarr;</a></p>` : ''}`,
  )
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

  // Verificación Svix, FAIL-CLOSED: si no hay secret configurado, se RECHAZA el evento
  // (salvo el flag explícito de pruebas locales). Así una config incompleta en prod no
  // deja el webhook abierto a inbound forjado (inyección de mensajes/tickets de soporte).
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
  } else if (ALLOW_UNSIGNED) {
    try {
      evt = JSON.parse(raw)
    } catch {
      return json({ error: 'JSON inválido' }, 400)
    }
  } else {
    // Sin secret y sin el flag de pruebas: no procesamos nada.
    return json({ error: 'Webhook no configurado' }, 500)
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

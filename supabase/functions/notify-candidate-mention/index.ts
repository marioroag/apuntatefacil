// Aviso por email cuando te mencionan en el chat de un candidato. verify_jwt = true.
// Lo invoca el detalle del candidato (miembro autenticado) tras enviar el
// mensaje, best-effort: si esto falla, el mensaje ya está guardado y llega en
// vivo por realtime.
//
// Autoriza dentro: el llamante debe ser miembro de la empresa del comentario.
// Idempotente: reclama notified_at de forma atómica (patrón notify-team-board),
// así un reintento no manda el aviso dos veces.
//
// Los mencionados los pone el TRIGGER de la base de datos, no el cliente: ya
// vienen filtrados a miembros reales de esa empresa y sin el propio autor. Aquí
// solo se traducen a direcciones de correo.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, NOTIFY_FROM, APP_URL.
// Sin RESEND_API_KEY es no-op silencioso.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { esc, renderEmail } from '../_shared/email.ts'
import { conPreferencia } from '../_shared/prefs.ts'
import { PLAZO, plazo } from '../_shared/red.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

function excerpt(s: string, max = 180): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return t.slice(0, max).replace(/\s+\S*$/, '') + '...'
}

/** Cómo se llama alguien cuando solo tenemos su correo. Espejo de `personLabel`. */
function personLabel(email: string): string {
  const local = email.split('@')[0]?.trim()
  return local ? local.replace(/[._-]+/g, ' ') : 'Alguien de tu equipo'
}

/** Nombre del candidato desde sus respuestas, como en el panel. */
function candidateName(answers: Record<string, unknown> | null): string {
  const part = (k: string) => (typeof answers?.[k] === 'string' ? (answers[k] as string).trim() : '')
  return [part('nombre'), part('apellidos')].filter(Boolean).join(' ') || 'un candidato'
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
      signal: plazo(PLAZO.api),
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { comment_id } = await req.json()
    if (!comment_id) return json({ error: 'Petición inválida' }, 400)

    // Identidad del llamante: el JWT se pasa explícito a getUser (sin sesión, el
    // getUser() implícito falla según la versión de supabase-js).
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: auth } = await userClient.auth.getUser(jwt)
    const uid = auth?.user?.id
    if (!uid) return json({ error: 'No autorizado' }, 401)

    const { data: comment } = await admin
      .from('candidate_comments')
      .select('id,candidate_id,company_id,author_user_id,author_email,body,mentions,notified_at')
      .eq('id', comment_id)
      .single()
    if (!comment) return json({ ok: true, sent: false, skipped: 'mensaje no encontrado' })

    // Autorización: el llamante debe ser miembro de la empresa del mensaje.
    const { data: mem } = await admin
      .from('memberships')
      .select('role')
      .eq('company_id', comment.company_id)
      .eq('user_id', uid)
      .maybeSingle()
    if (!mem) return json({ error: 'No autorizado' }, 403)

    const mentions = (comment.mentions as string[] | null) ?? []
    if (mentions.length === 0) return json({ ok: true, sent: false, skipped: 'sin menciones' })
    if (!RESEND_API_KEY) return json({ ok: true, sent: false })

    // Claim atómico: solo el primer invocador envía.
    const { data: claimed } = await admin
      .from('candidate_comments')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', comment.id)
      .is('notified_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) return json({ ok: true, sent: false, skipped: 'ya notificado' })

    const { data: rows } = await admin.rpc('mention_emails', {
      p_company: comment.company_id,
      p_users: mentions,
    })
    const mencionados = (rows as { user_id: string; email: string }[] | null) ?? []
    // Quien haya apagado este aviso en sus ajustes no lo recibe.
    const recipients = await conPreferencia(admin, mencionados, 'mencion')
    if (recipients.length === 0) return json({ ok: true, sent: false, skipped: 'sin destinatarios' })

    // Contexto: de quién se está hablando y en qué puesto.
    const { data: candidate } = await admin
      .from('candidates')
      .select('id,answers,campaign_id')
      .eq('id', comment.candidate_id)
      .single()
    const { data: campaign } = candidate
      ? await admin.from('campaigns').select('id,title').eq('id', candidate.campaign_id).single()
      : { data: null }

    const nombre = candidateName((candidate?.answers as Record<string, unknown>) ?? null)
    const puesto = campaign?.title ?? ''
    const quien = personLabel(comment.author_email ?? '')

    // Enlace directo a SU ficha: es lo único que hace útil el aviso.
    const link =
      APP_URL && campaign?.id ? `${APP_URL}/app/puestos/${campaign.id}?candidato=${comment.candidate_id}` : ''
    const button = link ? { label: 'Ver la conversación', href: link } : undefined

    const subject = `${quien} te ha mencionado sobre ${nombre}`
    const html = renderEmail({
      preview: `${quien} te ha mencionado en la ficha de ${nombre}`,
      heading: 'Te han mencionado',
      bodyHtml:
        `<strong style="font-weight:600;color:#131822">${esc(quien)}</strong> te ha mencionado en la ficha de ` +
        `<strong style="font-weight:600;color:#131822">${esc(nombre)}</strong>` +
        (puesto ? ` (${esc(puesto)})` : '') +
        '.' +
        (comment.body ? `<br><span style="color:#6f727c">${esc(excerpt(comment.body))}</span>` : ''),
      button,
    })

    // Un email por persona, nunca en copia: las direcciones del equipo no se
    // exponen entre sí.
    const results = await Promise.all(recipients.map((r) => sendEmail(r.email, subject, html)))
    return json({ ok: true, sent: results.some(Boolean), recipients: recipients.length })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

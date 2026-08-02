// Avisos por email del tablón de peticiones de equipo. verify_jwt = true.
// Lo invoca el panel (miembro autenticado) tras publicar, best-effort:
//   * kind 'peticion': aviso a los DEMÁS miembros de la empresa.
//   * kind 'respuesta': aviso solo al autor de la petición (si no responde él mismo).
// Autoriza dentro: el llamante debe ser miembro de la empresa de la fila.
// Idempotente: reclama notified_at de forma atómica (patrón notify-new-candidate).
// Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, NOTIFY_FROM, APP_URL.
// Sin RESEND_API_KEY es no-op silencioso: el aviso en vivo llega igual por realtime.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { esc, renderEmail } from '../_shared/email.ts'
import { conPreferencia } from '../_shared/prefs.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

// Primeras palabras de un texto para el cuerpo del email (sin cortar palabras).
function excerpt(s: string, max = 140): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return t.slice(0, max).replace(/\s+\S*$/, '') + '...'
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { kind, id } = await req.json()
    if ((kind !== 'peticion' && kind !== 'respuesta') || !id) {
      return json({ error: 'Petición inválida' }, 400)
    }

    // Identidad del llamante: el JWT se pasa explícito a getUser (sin sesión,
    // el getUser() implícito falla según la versión de supabase-js).
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: auth } = await userClient.auth.getUser(jwt)
    const uid = auth?.user?.id
    if (!uid) return json({ error: 'No autorizado' }, 401)

    // La fila (petición o respuesta) y su petición madre.
    let requestId = id as string
    let commentBody = ''
    let commentAuthor: string | null = null
    if (kind === 'respuesta') {
      const { data: comment } = await admin
        .from('team_request_comments')
        .select('id,request_id,body,author_user_id,notified_at')
        .eq('id', id)
        .single()
      if (!comment) return json({ ok: true, sent: false, skipped: 'respuesta no encontrada' })
      requestId = comment.request_id
      commentBody = comment.body ?? ''
      commentAuthor = comment.author_user_id
    }
    const { data: request } = await admin
      .from('team_requests')
      .select('id,company_id,title,body,author_user_id,author_email,notified_at')
      .eq('id', requestId)
      .single()
    if (!request) return json({ ok: true, sent: false, skipped: 'petición no encontrada' })

    // Autorización: el llamante debe ser miembro de la empresa del tablón.
    const { data: mem } = await admin
      .from('memberships')
      .select('role')
      .eq('company_id', request.company_id)
      .eq('user_id', uid)
      .maybeSingle()
    if (!mem) return json({ error: 'No autorizado' }, 403)

    if (!RESEND_API_KEY) return json({ ok: true, sent: false })

    const link = APP_URL ? `${APP_URL}/app/equipo?peticion=${request.id}` : ''
    const button = link ? { label: 'Ver petición', href: link } : undefined

    if (kind === 'peticion') {
      // Claim atómico: solo el primer invocador envía (reintentos no duplican).
      const { data: claimed } = await admin
        .from('team_requests')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', request.id)
        .is('notified_at', null)
        .select('id')
      if (!claimed || claimed.length === 0) return json({ ok: true, sent: false, skipped: 'ya notificado' })

      // A todos los miembros menos el autor, un email por persona (sin exponer
      // las direcciones de los compañeros entre sí).
      const { data: rows } = await admin.rpc('team_board_emails', { p_company: request.company_id })
      const team = (rows as { user_id: string; email: string }[] | null) ?? []
      const otros = team.filter((r) => r.user_id !== request.author_user_id)
      // Quien haya apagado los avisos del tablón en sus ajustes no lo recibe.
      const recipients = await conPreferencia(admin, otros, 'tablon')
      if (recipients.length === 0) return json({ ok: true, sent: false, skipped: 'sin destinatarios' })

      const subject = `Nueva petición de tu equipo: ${request.title}`
      const html = renderEmail({
        preview: `${request.author_email} necesita ayuda con: ${request.title}`,
        heading: 'Nueva petición de tu equipo',
        bodyHtml:
          `<strong style="font-weight:600;color:#131822">${esc(request.author_email)}</strong> ha publicado ` +
          `<strong style="font-weight:600;color:#131822">${esc(request.title)}</strong> en el tablón del equipo.` +
          (request.body ? `<br><span style="color:#6f727c">${esc(excerpt(request.body))}</span>` : ''),
        button,
      })
      const results = await Promise.all(recipients.map((r) => sendEmail(r.email, subject, html)))
      return json({ ok: true, sent: results.some(Boolean), recipients: recipients.length })
    }

    // kind === 'respuesta': solo al autor de la petición, y no si se responde a sí mismo.
    if (!request.author_user_id || !request.author_email || commentAuthor === request.author_user_id) {
      return json({ ok: true, sent: false, skipped: 'sin destinatario' })
    }
    const { data: claimed } = await admin
      .from('team_request_comments')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', id)
      .is('notified_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) return json({ ok: true, sent: false, skipped: 'ya notificado' })

    // Email del que responde, para dar contexto en el cuerpo.
    const { data: replier } = await admin
      .from('team_request_comments')
      .select('author_email')
      .eq('id', id)
      .single()
    const replierEmail = replier?.author_email || 'Un miembro del equipo'

    // Si la respuesta es solo candidatos (body vacío), el copy lo dice claro.
    const { data: proposed } = await admin
      .from('team_request_candidates')
      .select('candidate_id')
      .eq('comment_id', id)
    const proposedCount = proposed?.length ?? 0
    const proposalOnly = !commentBody.trim() && proposedCount > 0
    const proposalLabel =
      proposedCount === 1 ? 'un candidato' : `${proposedCount} candidatos`

    const preview = proposalOnly
      ? `${replierEmail} ha propuesto ${proposalLabel} en: ${request.title}`
      : `${replierEmail} ha respondido a: ${request.title}`
    const heading = proposalOnly ? 'Candidatos propuestos en tu petición' : 'Nueva respuesta a tu petición'
    const bodyHtml = proposalOnly
      ? `<strong style="font-weight:600;color:#131822">${esc(replierEmail)}</strong> ha propuesto ` +
        `<strong style="font-weight:600;color:#131822">${esc(proposalLabel)}</strong> en ` +
        `<strong style="font-weight:600;color:#131822">${esc(request.title)}</strong>.`
      : `<strong style="font-weight:600;color:#131822">${esc(replierEmail)}</strong> ha respondido a ` +
        `<strong style="font-weight:600;color:#131822">${esc(request.title)}</strong>.` +
        (commentBody ? `<br><span style="color:#6f727c">${esc(excerpt(commentBody))}</span>` : '')
    const subject = proposalOnly
      ? `Candidatos propuestos en tu petición: ${request.title}`
      : `Nueva respuesta a tu petición: ${request.title}`

    const html = renderEmail({ preview, heading, bodyHtml, button })
    // El autor de la petición también puede haber apagado este aviso.
    const quiere = await conPreferencia(
      admin,
      [{ user_id: request.author_user_id, email: request.author_email }],
      'tablon',
    )
    if (quiere.length === 0) return json({ ok: true, sent: false, skipped: 'aviso desactivado' })
    const sent = await sendEmail(request.author_email, subject, html)
    return json({ ok: true, sent })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

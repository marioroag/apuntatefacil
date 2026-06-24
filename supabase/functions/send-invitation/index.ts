// Envía el email de invitación al equipo (con el enlace para unirse).
// Lo invoca el panel (owner autenticado) tras crear la invitación. verify_jwt = true.
// Autoriza dentro: el llamante debe ser OWNER de la empresa de la invitación.
// Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, NOTIFY_FROM, APP_URL.
// Sin RESEND_API_KEY es no-op silencioso: el panel siempre muestra el enlace copiable.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { renderEmail } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { invitation_id } = await req.json()
    if (!invitation_id) return json({ error: 'Falta invitation_id' }, 400)

    // Identidad del llamante (a partir de su JWT).
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: auth } = await userClient.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return json({ error: 'No autorizado' }, 401)

    const { data: inv } = await admin
      .from('invitations')
      .select('email,token,status,company_id')
      .eq('id', invitation_id)
      .single()
    if (!inv || inv.status !== 'pending') return json({ ok: true, sent: false, skipped: 'invitación no disponible' })

    // Autorización: el llamante debe ser OWNER de la empresa de la invitación.
    const { data: mem } = await admin
      .from('memberships')
      .select('role')
      .eq('company_id', inv.company_id)
      .eq('user_id', uid)
      .maybeSingle()
    if (!mem || mem.role !== 'owner') return json({ error: 'No autorizado' }, 403)

    const { data: company } = await admin.from('companies').select('name').eq('id', inv.company_id).single()
    const companyName = company?.name ?? 'un equipo'
    const link = APP_URL ? `${APP_URL}/invitacion?token=${inv.token}` : ''

    if (!RESEND_API_KEY || !link) {
      // Sin clave o sin APP_URL: no-op. El panel muestra el enlace para enviarlo a mano.
      return json({ ok: true, sent: false })
    }

    const html = renderEmail({
      preview: 'Únete al equipo en Apúntate Fácil',
      heading: `Te han invitado a ${companyName}`,
      bodyHtml: 'Únete al equipo en Apúntate Fácil para gestionar candidatos juntos.',
      button: { label: 'Unirme al equipo', href: link },
      footnote: 'Si no esperabas esta invitación, puedes ignorar este correo.',
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: inv.email, subject: `Te han invitado a ${companyName}`, html }),
    })
    return json({ ok: true, sent: res.ok })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

// Envía una comprobación manual de interés a candidatos seleccionados.
// verify_jwt = true. Autoriza candidatos con el JWT y escribe con service_role
// solo después de que RLS haya confirmado su visibilidad.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { esc, renderEmail } from '../_shared/email.ts'
import { whatsappMeta } from '../_shared/channels/whatsappMeta.ts'
import * as R from '../_shared/whatsapp/render.ts'
import { PLAZO, plazo } from '../_shared/red.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('NOTIFY_FROM') ?? 'Apúntate Fácil <onboarding@resend.dev>'
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')

const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MODE_PRIORITY = { initial: 1, recheck: 2, reminder: 3 } as const

type Mode = keyof typeof MODE_PRIORITY
type Channel = 'email' | 'whatsapp'
type Omission =
  | 'missing_email' | 'missing_phone' | 'no_consent'
  | 'wait_reminder' | 'wait_recheck' | 'not_interested' | 'reminder_used'
  | 'duplicate' | 'not_visible'
type Field = { id: string; type: string }
type CandidateRow = {
  id: string
  answers: Record<string, unknown>
  campaign_id: string
  consent_at: string | null
}
type CheckRow = {
  id: string
  batch_id: string
  /** Null en las de WhatsApp: la respuesta vuelve por el botón, no por un enlace. */
  token_hash: string | null
  expires_at: string
  response: 'interested' | 'not_interested' | null
  sent_at: string
  responded_at: string | null
  reminder_sent_at: string | null
  created_at: string
}
// `to` es un correo o un wa_id según el canal. Lo que sigue (agrupar por
// destinatario, elegir el modo, el tope de 200) no distingue: los plazos y el
// "ya dijo que no" son de la PREGUNTA, no del canal.
type Eligible = { candidate: CandidateRow; to: string; mode: Mode; previous?: CheckRow }

function firstName(answers: Record<string, unknown>): string | null {
  const raw = typeof answers.nombre === 'string' ? answers.nombre.trim() : ''
  return raw ? raw.split(/\s+/)[0] : null
}

function candidateEmail(fields: Field[], answers: Record<string, unknown>): string | null {
  for (const field of fields) {
    if (field.type !== 'email') continue
    const raw = answers[field.id]
    if (typeof raw !== 'string') continue
    const normalized = raw.trim().toLowerCase()
    if (EMAIL_RE.test(normalized)) return normalized
  }
  return null
}

/**
 * El teléfono, normalizado igual que `wa_id_de` en SQL. Aquí solo se usa para
 * DECIDIR y contar: quien manda es la base de datos, que lo vuelve a calcular
 * dentro de `start_interest_conversation`. Por eso basta con la forma, no con
 * la lista de casos raros.
 */
function candidatePhone(answers: Record<string, unknown>): string | null {
  const raw = typeof answers.telefono === 'string' ? answers.telefono : ''
  if (!raw.trim()) return null
  // Dos números distintos en la casilla es ambiguo, y adivinar es lo que no se
  // puede hacer: escribirle a quien no toca es peor que no escribir.
  const trozos = raw.match(/\+?\d[\d \-().]{6,}\d/g) ?? [raw]
  const validos = new Set<string>()
  for (const trozo of trozos) {
    let intl = /^\s*\+/.test(trozo)
    let d = trozo.replace(/\D/g, '')
    if (d.startsWith('00')) { d = d.slice(2); intl = true }
    if (d.length === 9 && /^[6789]/.test(d)) validos.add(`34${d}`)
    else if (d.length === 11 && d.startsWith('34') && /^[6789]/.test(d.slice(2))) validos.add(d)
    else if (d.startsWith('34')) continue
    else if (intl && d.length >= 8 && d.length <= 15) validos.add(d)
  }
  return validos.size === 1 ? [...validos][0] : null
}

/**
 * A quién se puede escribir por este canal. Es lo ÚNICO que cambia entre los
 * dos. WhatsApp pide dos cosas donde el correo pide una: el teléfono, y el
 * CONSENTIMIENTO que dio al enviar la candidatura.
 *
 * El permiso se comprueba ANTES que el teléfono: a quien no nos dejó
 * escribirle, lo que le falta no es un dato, es el permiso.
 */
function recipientFor(
  channel: Channel, fields: Field[], candidate: CandidateRow,
): { to?: string; reason?: Omission } {
  if (channel === 'email') {
    const email = candidateEmail(fields, candidate.answers ?? {})
    return email ? { to: email } : { reason: 'missing_email' }
  }
  if (!candidate.consent_at) return { reason: 'no_consent' }
  const phone = candidatePhone(candidate.answers ?? {})
  return phone ? { to: phone } : { reason: 'missing_phone' }
}

/**
 * Por qué no se ha podido abrir el hilo, en cristiano. Son los estados que
 * devuelve `start_interest_conversation`, que es quien decide de verdad: aquí
 * solo se traducen. Cualquiera que no esté en esta lista sale por su código, no
 * inventado.
 */
const MOTIVO_CONVERSACION: Record<string, string> = {
  sin_consentimiento: 'No aceptó que le escribamos por WhatsApp',
  sin_telefono: 'No tiene un teléfono que podamos usar',
  baja: 'Pidió no recibir más mensajes',
  sin_remitente: 'No hay un número de WhatsApp configurado',
  sin_candidato: 'La candidatura ya no existe',
}

function daysSince(iso: string | null, now: number): number {
  return iso ? (now - Date.parse(iso)) / DAY_MS : 0
}

function eligibleMode(check: CheckRow | undefined, now: number): { mode?: Mode; reason?: Omission } {
  if (!check) return { mode: 'initial' }
  if (check.response === 'not_interested') return { reason: 'not_interested' }
  if (check.response === 'interested') {
    return daysSince(check.responded_at, now) >= 30 ? { mode: 'recheck' } : { reason: 'wait_recheck' }
  }
  if (check.reminder_sent_at) return { reason: 'reminder_used' }
  return daysSince(check.sent_at, now) >= 7 ? { mode: 'reminder' } : { reason: 'wait_reminder' }
}

function tokenHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function safeError(value: unknown): string {
  const text = String(value instanceof Error ? value.message : value)
  return text.replace(/[\r\n]+/g, ' ').slice(0, 500)
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      out[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: auth } = await userClient.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return json({ error: 'No autorizado' }, 401)

    const body = await req.json()
    const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id : ''
    const candidateIds = Array.isArray(body.candidate_ids)
      ? [...new Set(body.candidate_ids.filter((id: unknown): id is string => typeof id === 'string'))]
      : []
    const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : ''
    const channel: Channel = body.channel === 'whatsapp' ? 'whatsapp' : 'email'
    if (!campaignId || !idempotencyKey || candidateIds.length === 0 || candidateIds.length > 1000) {
      return json({ error: 'Solicitud no válida' }, 400)
    }

    // RLS decide si el usuario puede ver el puesto y cada candidato, incluidas
    // sedes de encargado y candidaturas bloqueadas.
    if (channel === 'email' && (!RESEND_API_KEY || !APP_URL)) {
      return json({ error: 'El envío de emails no está configurado' }, 503)
    }
    if (channel === 'whatsapp' && !Deno.env.get('WHATSAPP_TOKEN')) {
      return json({ error: 'WhatsApp no está configurado' }, 503)
    }

    const { data: visibleCampaign } = await userClient
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .maybeSingle()
    if (!visibleCampaign) return json({ error: 'No autorizado' }, 403)

    const { data: visibleRows, error: candidateError } = await userClient
      .from('candidates')
      .select('id,answers,campaign_id,consent_at')
      .eq('campaign_id', campaignId)
      .in('id', candidateIds)
    if (candidateError) return json({ error: 'No se pudieron validar los candidatos' }, 400)
    const candidates = (visibleRows ?? []) as CandidateRow[]

    const { data: campaign } = await admin
      .from('campaigns')
      .select('id,company_id,title,fields,brand_id')
      .eq('id', campaignId)
      .single()
    if (!campaign) return json({ error: 'Puesto no encontrado' }, 404)

    const { data: priorBatch } = await admin
      .from('candidate_interest_batches')
      .select('id')
      .eq('company_id', campaign.company_id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (priorBatch) return json({ ok: true, duplicate: true, sent: 0, failed: 0, omitted: {} })

    const visibleIds = new Set(candidates.map((c) => c.id))
    const omitted: Record<Omission, number> = {
      missing_email: 0,
      missing_phone: 0,
      no_consent: 0,
      wait_reminder: 0,
      wait_recheck: 0,
      not_interested: 0,
      reminder_used: 0,
      duplicate: 0,
      not_visible: candidateIds.filter((id) => !visibleIds.has(id)).length,
    }

    const { data: links } = await admin
      .from('candidate_interest_check_candidates')
      .select('candidate_id,check_id')
      .in('candidate_id', candidates.map((c) => c.id))
    const checkIds = [...new Set((links ?? []).map((l) => l.check_id as string))]
    const { data: checks } = checkIds.length
      ? await admin
          .from('candidate_interest_checks')
          .select('id,batch_id,token_hash,expires_at,response,sent_at,responded_at,reminder_sent_at,created_at')
          .in('id', checkIds)
          .eq('delivery_status', 'sent')
          .not('sent_at', 'is', null)
          .order('created_at', { ascending: false })
      : { data: [] }
    const checksById = new Map(((checks ?? []) as CheckRow[]).map((c) => [c.id, c]))
    const latestByCandidate = new Map<string, CheckRow>()
    for (const link of links ?? []) {
      const candidateId = link.candidate_id as string
      const check = checksById.get(link.check_id as string)
      const current = latestByCandidate.get(candidateId)
      if (check && (!current || check.created_at > current.created_at)) latestByCandidate.set(candidateId, check)
    }

    const fields = (campaign.fields ?? []) as Field[]
    const eligible: Eligible[] = []
    const now = Date.now()
    for (const candidate of candidates) {
      const { to, reason } = recipientFor(channel, fields, candidate)
      if (!to) {
        omitted[reason!]++
        continue
      }
      const previous = latestByCandidate.get(candidate.id)
      const decision = eligibleMode(previous, now)
      if (!decision.mode) {
        omitted[decision.reason!]++
        continue
      }
      eligible.push({ candidate, to, mode: decision.mode, previous })
    }

    // Se agrupa por DESTINATARIO, no por candidato: dos candidaturas de la
    // misma persona a puestos distintos comparten correo y teléfono, y recibir
    // la misma pregunta dos veces es lo que hace que se den de baja.
    const byRecipient = new Map<string, Eligible[]>()
    for (const item of eligible) byRecipient.set(item.to, [...(byRecipient.get(item.to) ?? []), item])
    if (byRecipient.size > 200) return json({ error: 'Puedes enviar un máximo de 200 mensajes cada vez' }, 400)

    const groups: { items: Eligible[]; mode: Mode }[] = []
    for (const items of byRecipient.values()) {
      const chosenMode = items.reduce<Mode>((best, item) =>
        MODE_PRIORITY[item.mode] > MODE_PRIORITY[best] ? item.mode : best, items[0].mode)
      omitted.duplicate += items.length - 1
      groups.push({ items, mode: chosenMode })
    }
    if (groups.length === 0) return json({ ok: true, sent: 0, failed: 0, omitted })

    const { data: batch, error: batchError } = await admin
      .from('candidate_interest_batches')
      .insert({
        company_id: campaign.company_id,
        campaign_id: campaignId,
        initiated_by: uid,
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single()
    if (batchError || !batch) {
      if (batchError?.code === '23505') return json({ ok: true, duplicate: true, sent: 0, failed: 0, omitted })
      throw batchError ?? new Error('No se pudo crear el lote')
    }

    const [{ data: company }, { data: brand }] = await Promise.all([
      admin.from('companies').select('name').eq('id', campaign.company_id).single(),
      campaign.brand_id
        ? admin.from('brands').select('name').eq('id', campaign.brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const displayName = brand?.name ?? company?.name ?? 'La empresa'

    const results = await mapLimit(groups, 5, async ({ items, mode }) => {
      const primary = items[0]
      const reminder = mode === 'reminder'
      const expiresAt = new Date(Date.now() + 60 * DAY_MS).toISOString()
      let checkId: string
      let oldReminder: { token_hash: string; expires_at: string } | null = null

      // WhatsApp: el hilo por el que va a salir. Se resuelve ANTES de crear
      // nada, porque aquí es donde se cae el que no dio permiso, no tiene un
      // teléfono utilizable o pidió la baja, y entonces no hay comprobación que
      // guardar. Reutiliza la conversación viva si la hay: en el móvil del
      // candidato solo existe un hilo con este número.
      let conversationId: string | null = null
      let phoneNumberId: string | null = null
      if (channel === 'whatsapp') {
        const { data: conv, error: convError } = await admin
          .rpc('start_interest_conversation', { p_candidate: primary.candidate.id })
        const estado = (conv as { status?: string } | null)?.status
        if (convError || estado !== 'ok') {
          return { ok: false, error: MOTIVO_CONVERSACION[estado ?? ''] ?? safeError(convError ?? estado) }
        }
        const ok = conv as { conversation_id: string; phone_number_id: string | null }
        conversationId = ok.conversation_id
        phoneNumberId = ok.phone_number_id
      }

      // El token existe para que un ENLACE público identifique la comprobación
      // sin sesión. Un botón de WhatsApp vuelve por el webhook con nuestra
      // propia carga dentro, así que ahí no hay token que guardar.
      const token = channel === 'email' ? tokenHex() : null
      const hash = token ? await tokenHash(token) : null

      if (reminder) {
        // La comprobación más nueva representa a la dirección compartida.
        const previous = items
          .map((item) => item.previous)
          .filter((check): check is CheckRow => Boolean(check))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        if (!previous) return { ok: false, error: 'No se encontró la comprobación anterior' }
        checkId = previous.id
        oldReminder = channel === 'email'
          ? { token_hash: previous.token_hash!, expires_at: previous.expires_at }
          : null
        const { data: claimed, error } = await admin
          .from('candidate_interest_checks')
          .update({
            expires_at: expiresAt,
            reminder_batch_id: batch.id,
            reminder_delivery_error: null,
            // El enlace del correo se renueva; el hilo de WhatsApp puede haber
            // cambiado (si el anterior se cerró, arriba se ha abierto otro).
            ...(channel === 'email' ? { token_hash: hash } : { conversation_id: conversationId }),
          })
          .eq('id', checkId)
          .is('reminder_sent_at', null)
          .select('id')
          .maybeSingle()
        if (error || !claimed) return { ok: false, error: safeError(error ?? 'El recordatorio ya se estaba enviando') }
        const extraLinks = items.filter((item) => item.previous?.id !== checkId)
        if (extraLinks.length) {
          await admin.from('candidate_interest_check_candidates').upsert(
            extraLinks.map((item) => ({ check_id: checkId, candidate_id: item.candidate.id })),
            { onConflict: 'check_id,candidate_id', ignoreDuplicates: true },
          )
        }
      } else {
        const { data: check, error } = await admin
          .from('candidate_interest_checks')
          .insert({
            batch_id: batch.id,
            company_id: campaign.company_id,
            campaign_id: campaignId,
            channel,
            expires_at: expiresAt,
            ...(channel === 'email'
              ? { recipient_email: primary.to, token_hash: hash }
              : { recipient_phone: primary.to, conversation_id: conversationId }),
          })
          .select('id')
          .single()
        if (error || !check) return { ok: false, error: safeError(error ?? 'No se creó la comprobación') }
        checkId = check.id
        const { error: linkError } = await admin.from('candidate_interest_check_candidates').insert(
          items.map((item) => ({ check_id: checkId, candidate_id: item.candidate.id })),
        )
        if (linkError) {
          await admin.from('candidate_interest_checks').delete().eq('id', checkId)
          return { ok: false, error: safeError(linkError) }
        }
      }

      const name = firstName(primary.candidate.answers ?? {})

      // ---- WhatsApp -------------------------------------------------------
      // La MISMA pregunta que el correo, por plantilla aprobada: fuera de la
      // ventana de 24 h es lo único que Meta deja mandar, y aquí la ventana
      // está cerrada casi siempre (al candidato no se le ha escrito hoy).
      if (channel === 'whatsapp') {
        const sender = {
          phoneNumberId: phoneNumberId || (Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''),
          token: Deno.env.get('WHATSAPP_TOKEN') ?? '',
        }
        // Una variable vacía tumba la plantilla entera en Meta (132000), así
        // que el saludo nunca puede quedarse sin nada. `nombre` es obligatorio
        // en el formulario, o sea que esto es un cinturón, no un caso real.
        const saludo = name ?? 'buenas'
        const cuerpo = R.textoInteres(saludo, displayName, campaign.title)
        const res = await whatsappMeta.enviar(sender, primary.to, {
          plantilla: {
            nombre: R.PLANTILLAS.interes,
            idioma: R.IDIOMA,
            variables: [saludo, displayName, campaign.title],
            botonesPayload: R.botonesInteres(conversationId!),
          },
        })
        // Queda escrito en el hilo pase lo que pase, como hace el agente: el
        // empresario tiene que poder ver lo que se intentó, no solo lo que llegó.
        await admin.rpc('record_outbound_message', {
          p_conversation: conversationId,
          p_author: 'agente',
          p_body: cuerpo,
          p_provider_id: res.ok ? (res.providerMessageId ?? null) : null,
          p_template: R.PLANTILLAS.interes,
          p_payload: { comprobacion_interes: true },
          p_delivery: res.ok ? 'enviado' : 'fallido',
          p_error_code: res.ok ? null : (res.fallo?.codigo ?? null),
          p_error_text: res.ok ? null : (res.fallo?.detalle ?? null),
        })
        if (!res.ok) {
          const message = safeError(`${res.fallo?.clase}: ${res.fallo?.detalle ?? 'envío rechazado'}`)
          await admin.from('candidate_interest_checks')
            .update(reminder
              ? { reminder_batch_id: null, reminder_delivery_error: message }
              : { delivery_status: 'failed', delivery_error: message })
            .eq('id', checkId)
          return { ok: false, error: message }
        }
        const sentAt = new Date().toISOString()
        if (reminder) {
          await admin.from('candidate_interest_checks').update({
            reminder_sent_at: sentAt,
            reminder_provider_message_id: res.providerMessageId ?? null,
            reminder_delivery_error: null,
          }).eq('id', checkId)
        } else {
          await admin.from('candidate_interest_checks').update({
            delivery_status: 'sent',
            sent_at: sentAt,
            provider_message_id: res.providerMessageId ?? null,
            delivery_error: null,
          }).eq('id', checkId)
          const previousIds = [...new Set(items.map((item) => item.previous?.id).filter(Boolean))] as string[]
          if (previousIds.length) {
            await admin.from('candidate_interest_checks').update({ superseded_at: sentAt }).in('id', previousIds)
          }
        }
        return { ok: true }
      }

      // ---- Correo ---------------------------------------------------------
      const yes = `${APP_URL}/respuesta/${token}?respuesta=interested`
      const no = `${APP_URL}/respuesta/${token}?respuesta=not_interested`
      const greeting = name ? `Hola, ${esc(name)}.` : 'Hola.'
      const subject = reminder
        ? `Recordatorio: ¿sigues interesado/a en el puesto de ${campaign.title}?`
        : `¿Sigues interesado/a en el puesto de ${campaign.title}?`
      const bodyHtml = reminder
        ? `${greeting}<br><br>Hace unos días, <strong style="font-weight:600;color:#131822">${esc(displayName)}</strong> te preguntó si sigues interesado/a en el puesto de <strong style="font-weight:600;color:#131822">${esc(campaign.title)}</strong>. Como todavía no hemos recibido respuesta, puedes indicarlo con una de estas opciones.`
        : `${greeting}<br><br><strong style="font-weight:600;color:#131822">${esc(displayName)}</strong> está revisando las candidaturas para el puesto de <strong style="font-weight:600;color:#131822">${esc(campaign.title)}</strong> y quiere saber si sigues interesado/a.`
      const html = renderEmail({
        preview: `Confirma si sigues interesado/a en ${campaign.title}`,
        heading: '¿Sigues interesado/a?',
        bodyHtml,
        buttons: [
          { label: 'Sí, sigo interesado/a', href: yes },
          { label: 'No, ya no me interesa', href: no },
        ],
        footnote: 'Recibes este correo porque enviaste una candidatura para este puesto.',
      })

      try {
        const response = await fetch('https://api.resend.com/emails', {
      signal: plazo(PLAZO.api),
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: primary.to, subject, html }),
        })
        const payload = await response.json().catch(() => ({})) as { id?: string; message?: string }
        if (!response.ok) throw new Error(payload.message ?? `Resend ${response.status}`)
        const sentAt = new Date().toISOString()
        if (reminder) {
          await admin.from('candidate_interest_checks').update({
            reminder_sent_at: sentAt,
            reminder_provider_message_id: payload.id ?? null,
            reminder_delivery_error: null,
          }).eq('id', checkId)
        } else {
          await admin.from('candidate_interest_checks').update({
            delivery_status: 'sent',
            sent_at: sentAt,
            provider_message_id: payload.id ?? null,
            delivery_error: null,
          }).eq('id', checkId)
          const previousIds = [...new Set(items.map((item) => item.previous?.id).filter(Boolean))] as string[]
          if (previousIds.length) {
            await admin.from('candidate_interest_checks').update({ superseded_at: sentAt }).in('id', previousIds)
          }
        }
        return { ok: true }
      } catch (error) {
        const message = safeError(error)
        if (reminder && oldReminder) {
          await admin.from('candidate_interest_checks').update({
            token_hash: oldReminder.token_hash,
            expires_at: oldReminder.expires_at,
            reminder_batch_id: null,
            reminder_delivery_error: message,
          }).eq('id', checkId)
        } else {
          await admin.from('candidate_interest_checks').update({
            delivery_status: 'failed',
            delivery_error: message,
          }).eq('id', checkId)
        }
        return { ok: false, error: message }
      }
    })

    const sent = results.filter((result) => result.ok).length
    const failed = results.length - sent
    return json({ ok: true, batch_id: batch.id, sent, failed, omitted })
  } catch (error) {
    return json({ error: safeError(error) }, 500)
  }
})

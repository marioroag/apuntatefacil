import { extractCandidatePhone } from './phone'
import type {
  Candidate,
  CandidateInterestState,
  CandidateInterestSummary,
  FormField,
  InterestChannel,
} from './types'

export const INTEREST_REMINDER_DAYS = 7
export const INTEREST_RECHECK_DAYS = 30
export const INTEREST_TOKEN_DAYS = 60
export const INTEREST_BATCH_LIMIT = 200

export const INTEREST_STATE_LABEL: Record<CandidateInterestState, string> = {
  never: 'Sin comprobar',
  sent: 'Comprobación enviada',
  no_response: 'Sin respuesta',
  interested: 'Sigue interesado/a',
  not_interested: 'Ya no le interesa',
  unavailable: 'Sin correo',
}

const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCandidateEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validCandidateEmail(value: string): boolean {
  return EMAIL_RE.test(normalizeCandidateEmail(value))
}

/** Primer campo email no vacío, respetando el orden del formulario. */
export function extractCandidateEmail(
  fields: FormField[],
  answers: Candidate['answers'],
): string | null {
  for (const field of fields) {
    if (field.type !== 'email') continue
    const raw = answers[field.id]
    if (typeof raw !== 'string') continue
    const normalized = normalizeCandidateEmail(raw)
    if (normalized && validCandidateEmail(normalized)) return normalized
  }
  return null
}

function elapsedDays(iso: string | null | undefined, now: number): number {
  if (!iso) return 0
  return (now - Date.parse(iso)) / DAY_MS
}

export function deriveInterestState(
  email: string | null,
  interest: CandidateInterestSummary | undefined,
  now = Date.now(),
): CandidateInterestState {
  if (!email) return 'unavailable'
  if (!interest) return 'never'
  if (interest.response === 'interested') return 'interested'
  if (interest.response === 'not_interested') return 'not_interested'
  const lastSend = interest.reminderSentAt ?? interest.sentAt
  return elapsedDays(lastSend, now) >= INTEREST_REMINDER_DAYS ? 'no_response' : 'sent'
}

export function candidateInterestState(campaign: { fields: FormField[] }, candidate: Candidate): CandidateInterestState {
  return deriveInterestState(extractCandidateEmail(campaign.fields, candidate.answers), candidate.interest)
}

export type InterestSendMode = 'initial' | 'reminder' | 'recheck'
export type InterestOmissionReason =
  | 'missing_email'
  | 'missing_phone'
  | 'no_consent'
  | 'wait_reminder'
  | 'wait_recheck'
  | 'not_interested'
  | 'reminder_used'

/**
 * A quién se puede escribir por este canal, y con qué.
 *
 * Es lo ÚNICO que cambia entre correo y WhatsApp. Los plazos, el recordatorio y
 * el "ya dijo que no" son de la pregunta, no del canal: si alguien contestó que
 * no por correo, tampoco se le vuelve a preguntar por WhatsApp. Por eso esto
 * devuelve el destinatario y el resto del cálculo sigue siendo uno solo.
 *
 * WhatsApp pide dos cosas donde el correo pide una: el teléfono, y el
 * CONSENTIMIENTO que dio al enviar la candidatura. Sin él no se le escribe,
 * aunque tengamos el número: es la misma puerta que gatea toda la entrevista
 * (`start_interview_invitation` se niega igual) y aquí no se puede rodear.
 */
export function interestRecipient(
  channel: InterestChannel,
  fields: FormField[],
  candidate: Pick<Candidate, 'answers' | 'consentAt'>,
): { to: string | null; reason?: InterestOmissionReason } {
  if (channel === 'email') {
    const email = extractCandidateEmail(fields, candidate.answers)
    return email ? { to: email } : { to: null, reason: 'missing_email' }
  }
  if (!candidate.consentAt) return { to: null, reason: 'no_consent' }
  const phone = extractCandidatePhone(candidate.answers)
  return phone ? { to: phone } : { to: null, reason: 'missing_phone' }
}

export type InterestEligibility =
  | { eligible: true; mode: InterestSendMode }
  | { eligible: false; reason: InterestOmissionReason }

export function interestEligibility(
  email: string | null,
  interest: CandidateInterestSummary | undefined,
  now = Date.now(),
): InterestEligibility {
  if (!email) return { eligible: false, reason: 'missing_email' }
  if (!interest) return { eligible: true, mode: 'initial' }
  if (interest.response === 'not_interested') {
    return { eligible: false, reason: 'not_interested' }
  }
  if (interest.response === 'interested') {
    return elapsedDays(interest.respondedAt, now) >= INTEREST_RECHECK_DAYS
      ? { eligible: true, mode: 'recheck' }
      : { eligible: false, reason: 'wait_recheck' }
  }
  if (interest.reminderSentAt) return { eligible: false, reason: 'reminder_used' }
  return elapsedDays(interest.sentAt, now) >= INTEREST_REMINDER_DAYS
    ? { eligible: true, mode: 'reminder' }
    : { eligible: false, reason: 'wait_reminder' }
}

export interface InterestCandidatePreview {
  candidateId: string
  /** Destinatario por el canal elegido: un correo, o un wa_id. */
  to: string | null
  /** Por qué no hay destinatario. Solo cuando `to` es null. */
  missing?: InterestOmissionReason
  eligibility: InterestEligibility
}

export interface InterestSendResult {
  ok: boolean
  sent: number
  failed: number
  duplicate?: boolean
  omitted: Partial<Record<InterestOmissionReason | 'duplicate' | 'not_visible', number>>
  error?: string
}

export function previewInterestCandidates(
  candidates: Candidate[],
  fields: FormField[],
  channel: InterestChannel = 'email',
  now = Date.now(),
): InterestCandidatePreview[] {
  return candidates.map((candidate) => {
    const { to, reason } = interestRecipient(channel, fields, candidate)
    return {
      candidateId: candidate.id,
      to,
      missing: reason,
      // Los plazos se calculan igual con o sin destinatario: `interestEligibility`
      // ya devuelve `missing_email` cuando no lo hay, y aquí se sustituye por el
      // motivo REAL de este canal (sin teléfono, sin permiso). Sin esto, elegir
      // WhatsApp diría "sin correo" de alguien que sí lo tiene.
      eligibility: to
        ? interestEligibility(to, candidate.interest, now)
        : { eligible: false, reason: reason ?? 'missing_email' },
    }
  })
}

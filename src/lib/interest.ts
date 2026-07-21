import type {
  Candidate,
  CandidateInterestState,
  CandidateInterestSummary,
  FormField,
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
  | 'wait_reminder'
  | 'wait_recheck'
  | 'not_interested'
  | 'reminder_used'

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
  email: string | null
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
  now = Date.now(),
): InterestCandidatePreview[] {
  return candidates.map((candidate) => {
    const email = extractCandidateEmail(fields, candidate.answers)
    return {
      candidateId: candidate.id,
      email,
      eligibility: interestEligibility(email, candidate.interest, now),
    }
  })
}

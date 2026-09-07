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
  // Se pregunta por correo y solo por correo (el canal de WhatsApp se retiró en
  // sep 2026), así que no poder preguntarle es no tener su correo. Se dice por
  // el HECHO y no por la consecuencia: "sin forma de preguntarle" obligaba a
  // adivinar qué dato falta.
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

/**
 * En qué punto está la comprobación de este candidato.
 *
 * Lo que ya dijo va PRIMERO, antes de mirar si hoy se le puede escribir, y eso
 * NO es un detalle de orden: calculándolo desde el correo, alguien que contestó
 * "sigo interesado" y luego se quedó sin correo utilizable aparecía en el panel
 * como si nunca se le hubiera podido preguntar. La respuesta estaba guardada y
 * la pantalla la tapaba.
 *
 * `alcanzable` solo decide entre "aún no se le ha preguntado" y "no hay por
 * dónde preguntarle", que es lo único para lo que hace falta.
 */
export function deriveInterestState(
  alcanzable: boolean,
  interest: CandidateInterestSummary | undefined,
  now = Date.now(),
): CandidateInterestState {
  if (interest) {
    if (interest.response === 'interested') return 'interested'
    if (interest.response === 'not_interested') return 'not_interested'
    const lastSend = interest.reminderSentAt ?? interest.sentAt
    return elapsedDays(lastSend, now) >= INTEREST_REMINDER_DAYS ? 'no_response' : 'sent'
  }
  return alcanzable ? 'never' : 'unavailable'
}

/**
 * Si hoy se le puede preguntar. Con el canal de WhatsApp retirado (sep 2026) la
 * pregunta sale por correo y solo por correo, así que esto es tener un correo
 * utilizable en sus respuestas.
 */
export function candidateReachable(fields: FormField[], candidate: Candidate): boolean {
  return Boolean(extractCandidateEmail(fields, candidate.answers))
}

export function candidateInterestState(campaign: { fields: FormField[] }, candidate: Candidate): CandidateInterestState {
  return deriveInterestState(candidateReachable(campaign.fields, candidate), candidate.interest)
}

export type InterestSendMode = 'initial' | 'reminder' | 'recheck'
export type InterestOmissionReason =
  | 'missing_email'
  | 'wait_reminder'
  | 'wait_recheck'
  | 'not_interested'
  | 'reminder_used'

/**
 * A quién se le escribe, y con qué.
 *
 * Llegó a recibir un CANAL, porque la pregunta podía salir por correo o por
 * WhatsApp y el destinatario era lo único que cambiaba entre los dos: los
 * plazos, el recordatorio y el "ya dijo que no" son de la PREGUNTA y no del
 * canal. Retirado el asistente de WhatsApp (sep 2026) queda el correo, así que
 * la función se queda sin parámetro; lo que no cambia es el reparto, que sigue
 * siendo el bueno el día que haya un segundo canal: aquí el destinatario, y el
 * resto del cálculo uno solo.
 */
export function interestRecipient(
  fields: FormField[],
  candidate: Pick<Candidate, 'answers'>,
): { to: string | null; reason?: InterestOmissionReason } {
  const email = extractCandidateEmail(fields, candidate.answers)
  return email ? { to: email } : { to: null, reason: 'missing_email' }
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
  /** El correo al que se le escribiría. */
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
  now = Date.now(),
): InterestCandidatePreview[] {
  return candidates.map((candidate) => {
    const { to, reason } = interestRecipient(fields, candidate)
    return {
      candidateId: candidate.id,
      to,
      missing: reason,
      eligibility: to
        ? interestEligibility(to, candidate.interest, now)
        : { eligible: false, reason: reason ?? 'missing_email' },
    }
  })
}

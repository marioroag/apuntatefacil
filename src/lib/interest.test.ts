import { describe, expect, it } from 'vitest'
import {
  candidateInterestState,
  candidateReachable,
  deriveInterestState,
  extractCandidateEmail,
  interestEligibility,
  interestRecipient,
  normalizeCandidateEmail,
  previewInterestCandidates,
} from './interest'
import type { Candidate, CandidateInterestSummary, FormField } from './types'

const fields: FormField[] = [
  { id: 'nombre', type: 'text', label: 'Nombre', required: true },
  { id: 'email_alt', type: 'email', label: 'Email alternativo', required: false },
  { id: 'email', type: 'email', label: 'Email', required: true },
]

const at = (days: number) => new Date(Date.UTC(2026, 6, 21 - days, 12)).toISOString()
const now = Date.UTC(2026, 6, 21, 12)

function summary(patch: Partial<CandidateInterestSummary> = {}): CandidateInterestSummary {
  return {
    checkId: 'check-1',
    batchId: 'batch-1',
    response: null,
    sentAt: at(2),
    respondedAt: null,
    reminderSentAt: null,
    expiresAt: at(-58),
    ...patch,
  }
}

function candidato(patch: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-1',
    campaignId: 'camp-1',
    answers: { email: 'ana@example.com', telefono: '612345678' },
    status: 'nuevo',
    submittedAt: at(1),
    statusChangedAt: '2026-08-01T10:00:00.000Z',
    source: 'enlace',
    favorito: false,
    notes: '',
    tagIds: [],
    consentAt: at(1),
    ...patch,
  }
}

describe('candidate email', () => {
  it('normaliza espacios y mayúsculas sin reescribir el proveedor', () => {
    expect(normalizeCandidateEmail('  Mario.Test+Obra@Example.COM ')).toBe('mario.test+obra@example.com')
  })

  it('usa el primer campo email válido con valor', () => {
    expect(extractCandidateEmail(fields, {
      email_alt: ' primero@ejemplo.com ',
      email: 'segundo@ejemplo.com',
    })).toBe('primero@ejemplo.com')
  })

  it('salta emails vacíos o inválidos y continúa por orden', () => {
    expect(extractCandidateEmail(fields, {
      email_alt: 'no-es-email',
      email: 'valido@ejemplo.com',
    })).toBe('valido@ejemplo.com')
  })
})

describe('interest state', () => {
  it('separa no poder preguntarle de no haberle preguntado', () => {
    expect(deriveInterestState(false, undefined, now)).toBe('unavailable')
    expect(deriveInterestState(true, undefined, now)).toBe('never')
  })

  it('pasa a sin respuesta siete días después del último envío', () => {
    expect(deriveInterestState(true, summary({ sentAt: at(6) }), now)).toBe('sent')
    expect(deriveInterestState(true, summary({ sentAt: at(7) }), now)).toBe('no_response')
    expect(deriveInterestState(true, summary({ sentAt: at(20), reminderSentAt: at(2) }), now)).toBe('sent')
  })

  it('prioriza la respuesta explícita', () => {
    expect(deriveInterestState(true, summary({ response: 'interested' }), now)).toBe('interested')
    expect(deriveInterestState(true, summary({ response: 'not_interested' }), now)).toBe('not_interested')
  })

  // EL FALLO que motivó todo esto. Lo que alguien te dijo no deja de ser verdad
  // porque hoy no puedas volver a escribirle.
  it('no tapa una respuesta por no poder volver a preguntar', () => {
    for (const r of ['interested', 'not_interested'] as const) {
      expect(deriveInterestState(false, summary({ response: r, respondedAt: at(1) }), now)).toBe(r)
    }
    expect(deriveInterestState(false, summary({ sentAt: at(2) }), now)).toBe('sent')
  })
})

describe('a quién se le puede preguntar', () => {
  it('con correo, sí', () => {
    expect(candidateReachable(fields, candidato({ answers: { email: 'ana@example.com' } }))).toBe(true)
  })

  // Con el canal de WhatsApp retirado (sep 2026) el teléfono ya no alcanza a
  // nadie: la pregunta sale por correo y solo por correo.
  it('con teléfono pero sin correo, no', () => {
    expect(candidateReachable(fields, candidato({ answers: { telefono: '612345678' } }))).toBe(false)
  })

  it('sin nada, no', () => {
    expect(candidateReachable(fields, candidato({ answers: {} }))).toBe(false)
  })

  // LO QUE YA DIJO MANDA SOBRE SI HOY SE LE PUEDE ESCRIBIR, y esto no es un
  // detalle de orden: calculando el estado desde el correo, quien contestó
  // "sigo interesado" y hoy no tiene correo utilizable se pintaba como si nunca
  // se le hubiera podido preguntar. La respuesta estaba guardada y la pantalla
  // la tapaba.
  it('una respuesta guardada gana a no poder escribirle hoy', () => {
    const sinCorreo = candidato({
      answers: { telefono: '612345678' },
      interest: summary({ response: 'interested', respondedAt: at(1) }),
    })
    expect(candidateInterestState({ fields }, sinCorreo)).toBe('interested')
  })
})

describe('interest eligibility', () => {
  it('permite un primer envío y un recordatorio tras siete días', () => {
    expect(interestEligibility('a@b.com', undefined, now)).toEqual({ eligible: true, mode: 'initial' })
    expect(interestEligibility('a@b.com', summary({ sentAt: at(7) }), now)).toEqual({ eligible: true, mode: 'reminder' })
  })

  it('bloquea el recordatorio temprano y un segundo recordatorio', () => {
    expect(interestEligibility('a@b.com', summary({ sentAt: at(6) }), now)).toEqual({ eligible: false, reason: 'wait_reminder' })
    expect(interestEligibility('a@b.com', summary({ sentAt: at(20), reminderSentAt: at(8) }), now)).toEqual({ eligible: false, reason: 'reminder_used' })
  })

  it('permite volver a comprobar una respuesta positiva a los treinta días', () => {
    expect(interestEligibility('a@b.com', summary({ response: 'interested', respondedAt: at(29) }), now)).toEqual({ eligible: false, reason: 'wait_recheck' })
    expect(interestEligibility('a@b.com', summary({ response: 'interested', respondedAt: at(30) }), now)).toEqual({ eligible: true, mode: 'recheck' })
  })

  it('no vuelve a contactar una respuesta negativa', () => {
    expect(interestEligibility('a@b.com', summary({ response: 'not_interested', respondedAt: at(90) }), now)).toEqual({ eligible: false, reason: 'not_interested' })
  })
})

describe('a quién se le escribe', () => {
  it('basta el correo', () => {
    expect(interestRecipient(fields, candidato())).toEqual({ to: 'ana@example.com' })
  })

  it('sin correo no hay destinatario, aunque haya teléfono', () => {
    const soloTelefono = candidato({ answers: { telefono: '612345678' } })
    expect(interestRecipient(fields, soloTelefono)).toEqual({ to: null, reason: 'missing_email' })
  })
})

describe('la vista previa', () => {
  it('sin correo no es elegible, y lo dice', () => {
    const sinCorreo = candidato({ answers: { telefono: '612345678' } })
    const [fila] = previewInterestCandidates([sinCorreo], fields, now)
    expect(fila.to).toBeNull()
    expect(fila.eligibility).toEqual({ eligible: false, reason: 'missing_email' })
  })

  it('un "ya no me interesa" corta el envío', () => {
    const dijoQueNo = candidato({ interest: summary({ response: 'not_interested', respondedAt: at(90) }) })
    expect(previewInterestCandidates([dijoQueNo], fields, now)[0].eligibility)
      .toEqual({ eligible: false, reason: 'not_interested' })
  })

  it('y los plazos también', () => {
    const reciente = candidato({ interest: summary({ sentAt: at(6) }) })
    expect(previewInterestCandidates([reciente], fields, now)[0].eligibility)
      .toEqual({ eligible: false, reason: 'wait_reminder' })
  })
})

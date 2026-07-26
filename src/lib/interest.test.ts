import { describe, expect, it } from 'vitest'
import {
  deriveInterestState,
  extractCandidateEmail,
  interestEligibility,
  normalizeCandidateEmail,
} from './interest'
import type { CandidateInterestSummary, FormField } from './types'

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
  it('separa ausencia de email de nunca comprobado', () => {
    expect(deriveInterestState(null, undefined, now)).toBe('unavailable')
    expect(deriveInterestState('a@b.com', undefined, now)).toBe('never')
  })

  it('pasa a sin respuesta siete días después del último envío', () => {
    expect(deriveInterestState('a@b.com', summary({ sentAt: at(6) }), now)).toBe('sent')
    expect(deriveInterestState('a@b.com', summary({ sentAt: at(7) }), now)).toBe('no_response')
    expect(deriveInterestState('a@b.com', summary({ sentAt: at(20), reminderSentAt: at(2) }), now)).toBe('sent')
  })

  it('prioriza la respuesta explícita', () => {
    expect(deriveInterestState('a@b.com', summary({ response: 'interested' }), now)).toBe('interested')
    expect(deriveInterestState('a@b.com', summary({ response: 'not_interested' }), now)).toBe('not_interested')
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

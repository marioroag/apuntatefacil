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
    channel: 'email',
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

describe('a quién se le puede preguntar por algún sitio', () => {
  it('con correo, sí', () => {
    expect(candidateReachable(fields, candidato({ answers: { email: 'ana@example.com' } }))).toBe(true)
  })

  // El caso que se perdía: teléfono y permiso, sin correo. En construcción y
  // logística mucha gente rellena el teléfono y deja el correo en blanco.
  it('sin correo pero con teléfono y permiso, también', () => {
    expect(candidateReachable(fields, candidato({ answers: { telefono: '612345678' } }))).toBe(true)
  })

  it('con teléfono pero sin permiso, no', () => {
    expect(candidateReachable(fields, candidato({ answers: { telefono: '612345678' }, consentAt: null }))).toBe(false)
  })

  it('sin nada, no', () => {
    expect(candidateReachable(fields, candidato({ answers: {} }))).toBe(false)
  })

  it('y el estado que pinta el panel lo respeta', () => {
    const soloWhatsapp = candidato({
      answers: { telefono: '612345678' },
      interest: summary({ channel: 'whatsapp', response: 'interested', respondedAt: at(1) }),
    })
    // Antes decía 'unavailable' ("Sin correo") y se comía el "sigo interesado".
    expect(candidateInterestState({ fields }, soloWhatsapp)).toBe('interested')
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

describe('a quién se puede escribir por cada canal', () => {
  it('por correo basta el correo', () => {
    expect(interestRecipient('email', fields, candidato())).toEqual({ to: 'ana@example.com' })
  })

  it('por WhatsApp hace falta teléfono Y permiso', () => {
    expect(interestRecipient('whatsapp', fields, candidato())).toEqual({ to: '34612345678' })
  })

  // La puerta que gatea todo el canal. Tener el número no da derecho a usarlo.
  it('sin consentimiento no se escribe, aunque tengamos el número', () => {
    expect(interestRecipient('whatsapp', fields, candidato({ consentAt: null })))
      .toEqual({ to: null, reason: 'no_consent' })
  })

  it('se comprueba el permiso ANTES que el teléfono', () => {
    // Si no ha dado permiso, que además falte el número no es lo que hay que
    // contarle al empresario: lo que le falta a esa candidatura es el permiso.
    expect(interestRecipient('whatsapp', fields, candidato({ consentAt: null, answers: {} })))
      .toEqual({ to: null, reason: 'no_consent' })
  })

  it('distingue no tener teléfono de tenerlo ilegible', () => {
    expect(interestRecipient('whatsapp', fields, candidato({ answers: {} })))
      .toEqual({ to: null, reason: 'missing_phone' })
    expect(interestRecipient('whatsapp', fields, candidato({ answers: { telefono: '612345678 / 698765432' } })))
      .toEqual({ to: null, reason: 'missing_phone' })
  })

  it('cada canal ignora lo que le falta al otro', () => {
    const soloTelefono = candidato({ answers: { telefono: '612345678' } })
    expect(interestRecipient('email', fields, soloTelefono).reason).toBe('missing_email')
    expect(interestRecipient('whatsapp', fields, soloTelefono).to).toBe('34612345678')
  })
})

describe('la vista previa por canal', () => {
  it('dice el motivo real del canal elegido, no "sin correo"', () => {
    const sinCorreo = candidato({ answers: { telefono: '612345678' } })
    const [fila] = previewInterestCandidates([sinCorreo], fields, 'whatsapp', now)
    expect(fila.to).toBe('34612345678')
    expect(fila.eligibility).toEqual({ eligible: true, mode: 'initial' })
  })

  it('sin permiso no es elegible por WhatsApp y sí por correo', () => {
    const sinPermiso = candidato({ consentAt: null })
    expect(previewInterestCandidates([sinPermiso], fields, 'whatsapp', now)[0].eligibility)
      .toEqual({ eligible: false, reason: 'no_consent' })
    expect(previewInterestCandidates([sinPermiso], fields, 'email', now)[0].eligibility)
      .toEqual({ eligible: true, mode: 'initial' })
  })

  // Lo que NO cambia con el canal: la pregunta es la misma, así que un "no"
  // dicho por correo tampoco se vuelve a preguntar por WhatsApp.
  it('un "ya no me interesa" vale para los dos canales', () => {
    const dijoQueNo = candidato({ interest: summary({ response: 'not_interested', respondedAt: at(90) }) })
    for (const canal of ['email', 'whatsapp'] as const) {
      expect(previewInterestCandidates([dijoQueNo], fields, canal, now)[0].eligibility)
        .toEqual({ eligible: false, reason: 'not_interested' })
    }
  })

  it('los plazos tampoco dependen del canal', () => {
    const reciente = candidato({ interest: summary({ sentAt: at(6) }) })
    for (const canal of ['email', 'whatsapp'] as const) {
      expect(previewInterestCandidates([reciente], fields, canal, now)[0].eligibility)
        .toEqual({ eligible: false, reason: 'wait_reminder' })
    }
  })
})

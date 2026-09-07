import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Campaign, Candidate, CandidateInterestResponse } from '../lib/types'
import { InterestOutcomeIcon, InterestSignal } from './InterestSignal'

const campaign = {
  fields: [{ id: 'email', type: 'email', label: 'Correo', required: true }],
} as Campaign

function candidate(response: CandidateInterestResponse | null, withCheck = true): Candidate {
  return {
    id: 'candidate-1',
    campaignId: 'campaign-1',
    answers: { email: 'candidato@ejemplo.com' },
    status: 'nuevo',
    submittedAt: '2026-07-21T10:00:00.000Z',
    statusChangedAt: '2026-08-01T10:00:00.000Z',
    source: 'enlace',
    favorito: false,
    notes: '',
    tagIds: [],
    interest: withCheck ? {
      checkId: 'check-1',
      batchId: 'batch-1',
      response,
      sentAt: '2026-07-20T10:00:00.000Z',
      respondedAt: response ? '2026-07-21T11:00:00.000Z' : null,
      reminderSentAt: null,
      expiresAt: '2026-09-19T10:00:00.000Z',
    } : undefined,
  }
}

describe('InterestOutcomeIcon', () => {
  it('no ocupa espacio para estados no concluyentes', () => {
    expect(renderToStaticMarkup(<InterestOutcomeIcon campaign={campaign} candidate={candidate(null, false)} />)).toBe('')
    expect(renderToStaticMarkup(<InterestOutcomeIcon campaign={campaign} candidate={candidate(null)} />)).toBe('')
  })

  it('muestra una señal accesible para una respuesta positiva', () => {
    const html = renderToStaticMarkup(<InterestOutcomeIcon campaign={campaign} candidate={candidate('interested')} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('Sigue interesado/a')
    expect(html).toContain('text-emerald-600')
    expect(html).toContain('lucide-thumbs-up')
  })

  it('muestra una señal neutra, nunca roja, para una respuesta negativa', () => {
    const html = renderToStaticMarkup(<InterestOutcomeIcon campaign={campaign} candidate={candidate('not_interested')} />)
    expect(html).toContain('Ya no le interesa')
    expect(html).toContain('text-slate-500')
    expect(html).toContain('lucide-thumbs-down')
    expect(html).not.toContain('red')
  })
})

describe('InterestSignal', () => {
  // LO QUE YA CONTESTÓ GANA A SI HOY SE LE PUEDE ESCRIBIR. El fallo que motivó
  // esto: calculando la chapa desde el correo, quien ya había dicho "sigo
  // interesado" y no tiene correo utilizable se pintaba como "Sin correo". La
  // respuesta estaba en la base de datos y la pantalla la tapaba.
  it('enseña la respuesta de quien no dejó correo', () => {
    const sinCorreo: Candidate = {
      ...candidate('interested'),
      answers: { telefono: '612345678' },
    }
    const html = renderToStaticMarkup(<InterestSignal campaign={campaign} candidate={sinCorreo} />)
    expect(html).toContain('Sigue interesado/a')
    expect(html).not.toContain('Sin correo')
  })

  // El sobre se reserva para "no contesta", que es lo único que lleva a hacer
  // algo: perseguir un correo. Esperando manda el reloj.
  it('el sobre sale cuando no contesta, no mientras se espera', () => {
    const base = candidate(null)
    // El estado se deriva contra el reloj de verdad, así que "esperando" tiene
    // que enviarse AHORA: con una fecha fija, el test se convierte en
    // "sin respuesta" en cuanto pasan los 7 días del recordatorio.
    const recien = new Date().toISOString()
    const esperando = renderToStaticMarkup(
      <InterestSignal campaign={campaign} candidate={{ ...base, interest: { ...base.interest!, sentAt: recien } }} />)
    const sinRespuesta = renderToStaticMarkup(
      <InterestSignal
        campaign={campaign}
        candidate={{ ...base, interest: { ...base.interest!, sentAt: '2026-01-01T10:00:00.000Z' } }}
      />)
    expect(esperando).toContain('lucide-clock')
    expect(esperando).not.toContain('lucide-mail')
    expect(sinRespuesta).toContain('lucide-mail')
  })

  it('sin correo al que escribir, lo dice', () => {
    const nadie: Candidate = { ...candidate(null, false), answers: {}, consentAt: null }
    const html = renderToStaticMarkup(<InterestSignal campaign={campaign} candidate={nadie} />)
    expect(html).toContain('Sin correo')
    expect(html).toContain('lucide-user-x')
  })
})

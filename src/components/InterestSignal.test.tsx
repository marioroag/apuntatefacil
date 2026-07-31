import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Campaign, Candidate, CandidateInterestResponse } from '../lib/types'
import { InterestOutcomeIcon } from './InterestSignal'

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

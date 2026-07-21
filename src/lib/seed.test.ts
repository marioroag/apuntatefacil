import { describe, expect, it } from 'vitest'
import { SEED } from './seed'

describe('demo email coverage', () => {
  it('requires email in every demo form', () => {
    for (const campaign of SEED.campaigns) {
      const emailFields = campaign.fields.filter((field) => field.type === 'email')
      expect(emailFields, campaign.title).toHaveLength(1)
      expect(emailFields[0]?.required, campaign.title).toBe(true)
    }
  })

  it('gives every demo candidate a unique valid email', () => {
    const emails = SEED.candidates.map((candidate) => candidate.answers.email)

    expect(emails).toHaveLength(SEED.candidates.length)
    expect(emails.every((email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))).toBe(true)
    expect(new Set(emails).size).toBe(emails.length)
  })
})

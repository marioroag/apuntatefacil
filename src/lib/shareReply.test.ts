import { describe, expect, it } from 'vitest'
import {
  editableReplyBody,
  replyBodyForCampaign,
  replyForCampaign,
} from './shareReply'

describe('respuesta compartida', () => {
  it('crea un mensaje base con el puesto actual', () => {
    expect(replyBodyForCampaign({ title: 'Carretillero/a' })).toContain('Carretillero/a')
  })

  it('mantiene un mensaje personalizado como texto normal', () => {
    expect(editableReplyBody({ body: 'Hola,\n\n¿Te interesa?', title: 'Puesto' })).toBe('Hola,\n\n¿Te interesa?')
  })

  it('convierte las fichas antiguas sin mostrar sintaxis interna', () => {
    expect(
      editableReplyBody({
        body: 'Hola {{puesto}}\n{{enlace}}',
        title: 'Peón de albañil',
      }),
    ).toBe('Hola Peón de albañil')
  })

  it('añade siempre el enlace al copiar', () => {
    expect(
      replyForCampaign({
        body: 'Gracias por escribir.',
        title: 'Puesto',
        url: 'https://apuntatefacil.com/a/puesto',
      }),
    ).toBe(
      'Gracias por escribir.\nhttps://apuntatefacil.com/a/puesto',
    )
  })

  it('usa el mensaje base cuando no hay personalización', () => {
    expect(replyForCampaign({ title: 'Mozo/a', url: 'https://example.com', body: null })).toBe(
      `${replyBodyForCampaign({ title: 'Mozo/a' })}\nhttps://example.com`,
    )
  })
})

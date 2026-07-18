import { describe, expect, it } from 'vitest'
import {
  SHARE_LINK_TOKEN,
  SHARE_POSITION_TOKEN,
  defaultReplyTemplate,
  normalizeReplyTemplate,
  resolveReplyTemplate,
  serializeReplySegments,
  tokenizeReplyTemplate,
} from './shareReply'

describe('plantillas de respuesta compartida', () => {
  it('crea una plantilla base con puesto y enlace', () => {
    expect(defaultReplyTemplate()).toContain(SHARE_POSITION_TOKEN)
    expect(defaultReplyTemplate()).toContain(SHARE_LINK_TOKEN)
  })

  it('migra una plantilla antigua sin alterar sus saltos de línea', () => {
    expect(normalizeReplyTemplate('Hola,\n\nte interesa este puesto')).toBe(
      `Hola,\n\nte interesa este puesto\n${SHARE_LINK_TOKEN}`,
    )
  })

  it('mantiene solo un enlace aunque la plantilla tenga duplicados', () => {
    expect(normalizeReplyTemplate(`${SHARE_LINK_TOKEN}\nHola\n${SHARE_LINK_TOKEN}`)).toBe(
      `${SHARE_LINK_TOKEN}\nHola\n`,
    )
  })

  it('mantiene un único puesto dinámico', () => {
    expect(normalizeReplyTemplate(`${SHARE_POSITION_TOKEN} y ${SHARE_POSITION_TOKEN}\n${SHARE_LINK_TOKEN}`)).toBe(
      `${SHARE_POSITION_TOKEN} y \n${SHARE_LINK_TOKEN}`,
    )
  })

  it('serializa segmentos y recupera la ficha obligatoria si falta', () => {
    expect(serializeReplySegments([{ type: 'text', value: 'Gracias por escribir.' }])).toBe(
      `Gracias por escribir.\n${SHARE_LINK_TOKEN}`,
    )
  })

  it('tokeniza una plantilla manteniendo texto y fichas en orden', () => {
    expect(tokenizeReplyTemplate(`Hola ${SHARE_POSITION_TOKEN}\n${SHARE_LINK_TOKEN}`)).toEqual([
      { type: 'text', value: 'Hola ' },
      { type: 'token', value: SHARE_POSITION_TOKEN },
      { type: 'text', value: '\n' },
      { type: 'token', value: SHARE_LINK_TOKEN },
    ])
  })

  it('resuelve el puesto y enlace con los datos vigentes', () => {
    expect(
      resolveReplyTemplate({
        template: `Hola ${SHARE_POSITION_TOKEN}\n${SHARE_LINK_TOKEN}`,
        title: 'Carretillero/a',
        url: 'https://apuntatefacil.com/a/carretillero',
      }),
    ).toBe('Hola Carretillero/a\nhttps://apuntatefacil.com/a/carretillero')
  })
})

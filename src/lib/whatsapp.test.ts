import { describe, it, expect } from 'vitest'
// Se prueban desde vitest por el mismo motivo que schedule/: estos módulos no
// importan nada de `jsr:` ni de `npm:`, así que los cargan los dos runtimes, y
// Deno no está instalado en esta máquina. Ver la cabecera de schedule.test.ts.
import { clasificar, whatsappMeta } from '../../supabase/functions/_shared/channels/whatsappMeta'

describe('clasificar', () => {
  it('separa lo que hay que hacer, no lo que ha pasado', () => {
    expect(clasificar(131047).clase).toBe('ventana_cerrada')
    expect(clasificar(131026).clase).toBe('no_entregable')
    expect(clasificar(130429).clase).toBe('limite')
    expect(clasificar(132000).clase).toBe('config')
    expect(clasificar(190).clase).toBe('config')
    expect(clasificar(132015).clase).toBe('cuenta')
  })

  // Lo peligroso es al revés: dar por terminal un hipo de red pierde a un
  // candidato de verdad y nadie se entera. Reintentar de más solo cuesta que la
  // cola se agote a los 6 intentos y lo coja una persona.
  it('lo desconocido se reintenta, no se da por perdido', () => {
    expect(clasificar(999999).clase).toBe('transitorio')
    expect(clasificar(0).clase).toBe('transitorio')
  })
})

describe('normalizarWebhook', () => {
  const sobre = (value: unknown) =>
    JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'W1', changes: [{ value, field: 'messages' }] }] })
  const meta = { metadata: { display_phone_number: '34999', phone_number_id: 'PN1' } }

  it('un mensaje de texto', () => {
    const { entrantes } = whatsappMeta.normalizarWebhook(sobre({
      ...meta,
      messages: [{ from: '34612345678', id: 'wamid.A', timestamp: '1754000000', type: 'text', text: { body: 'el martes mejor' } }],
    }))
    expect(entrantes).toHaveLength(1)
    expect(entrantes[0]).toMatchObject({
      tipo: 'texto', texto: 'el martes mejor', waId: '34612345678',
      providerMessageId: 'wamid.A', destinoPhoneNumberId: 'PN1',
    })
  })

  it('una fila de lista pulsada trae NUESTRO id', () => {
    const { entrantes } = whatsappMeta.normalizarWebhook(sobre({
      ...meta,
      messages: [{
        from: '34612345678', id: 'wamid.B', timestamp: '1754000001', type: 'interactive',
        interactive: { type: 'list_reply', list_reply: { id: 'c:abc:s:2', title: 'mar 4, 10:00' } },
      }],
    }))
    expect(entrantes[0]).toMatchObject({ tipo: 'opcion', opcionId: 'c:abc:s:2' })
  })

  // Camino distinto del anterior, y es por donde entra la respuesta a la
  // invitación: el caso más importante de todos. Un botón de PLANTILLA no trae
  // id, trae la carga que pusimos al enviar.
  it('un botón de plantilla trae la carga, no un id', () => {
    const { entrantes } = whatsappMeta.normalizarWebhook(sobre({
      ...meta,
      messages: [{
        from: '34612345678', id: 'wamid.C', timestamp: '1754000002', type: 'button',
        button: { payload: 'c:abc:ver', text: 'Ver horarios' },
      }],
    }))
    expect(entrantes[0]).toMatchObject({ tipo: 'opcion', opcionId: 'c:abc:ver' })
  })

  it('un audio no se interpreta jamás', () => {
    const { entrantes } = whatsappMeta.normalizarWebhook(sobre({
      ...meta,
      messages: [{ from: '34612345678', id: 'wamid.D', timestamp: '3', type: 'audio', audio: { id: 'x' } }],
    }))
    expect(entrantes[0].tipo).toBe('no_soportado')
  })

  it('los estados de entrega, con su error si lo hay', () => {
    const { estados } = whatsappMeta.normalizarWebhook(sobre({
      ...meta,
      statuses: [
        { id: 'wamid.A', status: 'delivered', timestamp: '1', recipient_id: '34612345678' },
        { id: 'wamid.B', status: 'failed', timestamp: '2', errors: [{ code: 131026, title: 'Message undeliverable' }] },
        { id: 'wamid.C', status: 'deleted', timestamp: '3' },
      ],
    }))
    // 'deleted' no es un estado nuestro: se ignora en vez de inventarlo.
    expect(estados).toHaveLength(2)
    expect(estados[0]).toMatchObject({ providerMessageId: 'wamid.A', estado: 'entregado' })
    expect(estados[1]).toMatchObject({ estado: 'fallido', codigo: 131026 })
  })

  it('un cuerpo que no es JSON no revienta el webhook', () => {
    expect(whatsappMeta.normalizarWebhook('no soy json')).toEqual({ entrantes: [], estados: [] })
    expect(whatsappMeta.normalizarWebhook('{}')).toEqual({ entrantes: [], estados: [] })
  })

  it('varias entradas en un solo envío, que Meta agrupa', () => {
    const cuerpo = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        { id: 'W1', changes: [{ value: { ...meta, messages: [{ from: '34600000001', id: 'w1', type: 'text', text: { body: 'sí' } }] }, field: 'messages' }] },
        { id: 'W1', changes: [{ value: { ...meta, messages: [{ from: '34600000002', id: 'w2', type: 'text', text: { body: 'no' } }] }, field: 'messages' }] },
      ],
    })
    expect(whatsappMeta.normalizarWebhook(cuerpo).entrantes).toHaveLength(2)
  })
})

import { describe, it, expect } from 'vitest'
// Se prueban desde vitest por el mismo motivo que schedule/: estos módulos no
// importan nada de `jsr:` ni de `npm:`, así que los cargan los dos runtimes, y
// Deno no está instalado en esta máquina. Ver la cabecera de schedule.test.ts.
import { clasificar, whatsappMeta } from '../../supabase/functions/_shared/channels/whatsappMeta'
import { WHATSAPP_WIP } from './whatsapp'

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

/**
 * EL GUARDIÁN DEL CANAL APAGADO.
 *
 * Mientras no haya número de alta en Meta, la app no puede escribirle a un
 * candidato (ver `lib/whatsapp.ts`). Apagar los botones no basta: lo que impide
 * de verdad que salga un mensaje es que TODOS los caminos hasta el servidor
 * pasen por `WHATSAPP_LISTO`, y eso se pudre solo. Dentro de dos meses alguien
 * añade una pantalla que llama al RPC directamente, la bandera sigue en `false`
 * y el candidato recibe un WhatsApp desde un número que no es el de la empresa.
 *
 * Por eso esto no comprueba comportamiento: comprueba que las puertas sigan
 * siendo las mismas y que sigan teniendo cerradura. Cuando falle, hay dos
 * salidas honestas: llamar desde el store como los demás, o poner la guarda.
 */
describe('el canal apagado', () => {
  // Los ficheros se leen con los globs de Vite, como el guardián de los ajustes:
  // el tsconfig de la app no tiene los tipos de node. Ojo con las claves: las de
  // esta misma carpeta llegan como `./store.tsx` y no como `../lib/store.tsx`,
  // así que se busca por el final del nombre y no por la ruta entera.
  const FUENTES = import.meta.glob('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  const fuente = (nombre: string): string | undefined =>
    Object.entries(FUENTES).find(([ruta]) => ruta.endsWith(`/${nombre}`) || ruta === `./${nombre}`)?.[1]

  /** Lo que le pide al servidor que escriba a alguien. */
  const PUERTAS = ['start_interview_invitation', 'kickoff_invitation', 'whatsapp-send', 'send-interest-check']

  it('solo el store llama a lo que manda un mensaje', () => {
    for (const [ruta, texto] of Object.entries(FUENTES)) {
      if (ruta.endsWith('store.tsx') || ruta.includes('.test.')) continue
      for (const puerta of PUERTAS) {
        expect(
          texto.includes(`'${puerta}'`),
          `${ruta} llama a "${puerta}" por su cuenta. Esa llamada va en store.tsx, ` +
          'que es donde está la guarda de WHATSAPP_LISTO: si no, el botón se apaga ' +
          'pero el mensaje sale igual.',
        ).toBe(false)
      }
    }
  })

  it('cada puerta del store tiene su guarda', () => {
    const store = fuente('store.tsx') ?? ''
    expect(store, 'no se encuentra store.tsx').toBeTruthy()
    // Las guardas, literales. Si cambia una, que falle aquí y no en producción.
    const GUARDAS = [
      "if (!WHATSAPP_LISTO) return { status: 'wip' }",       // invitar
      "if (channel === 'whatsapp' && !WHATSAPP_LISTO) {",    // comprobar interés
      'if (!WHATSAPP_LISTO) return false',                   // escribir en el hilo
    ]
    for (const guarda of GUARDAS) {
      expect(
        store.includes(guarda),
        `Falta la guarda \`${guarda}\` en store.tsx. Mientras WHATSAPP_LISTO sea ` +
        'false no puede salir ni un mensaje: la interfaz decide qué se ofrece, ' +
        'esta línea decide qué se manda.',
      ).toBe(true)
    }
  })

  it('lo que se le dice al cliente no lleva guion largo', () => {
    for (const texto of Object.values(WHATSAPP_WIP)) {
      expect(texto).not.toContain('—')
    }
  })
})

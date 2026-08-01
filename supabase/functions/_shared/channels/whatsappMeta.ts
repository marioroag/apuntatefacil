// El único fichero que sabe que detrás hay Meta.
//
// Traduce en las dos direcciones: de nuestro vocabulario al Graph API, y del
// webhook de Meta a nuestro vocabulario. Fuera de aquí no aparece un `wamid`,
// ni un código de error de Meta, ni la palabra "interactive".
//
// Sin imports de red ni de Deno más allá de fetch, para poder probar
// `clasificar` y `normalizarWebhook` (que es donde están los fallos de verdad)
// sin levantar nada.

import type {
  ClaseFallo, EstadoEntrega, EventoEntrante, FalloCanal,
  MensajeSaliente, MessagingProvider, ResultadoEnvio, Sender,
} from './types.ts'

/**
 * Solo se cambia en pruebas locales, para ejercitar el agente entero contra un
 * doble sin gastar mensajes de Meta ni escribirle a nadie de verdad. En
 * producción no se define. Es el mismo recurso que `OPENAI_BASE_URL`.
 *
 * Se lee perezosamente y a través de `globalThis` a propósito: este fichero lo
 * cargan también las pruebas de vitest, donde `Deno` no existe. Un
 * `Deno.env.get` en el cuerpo del módulo lo rompería al importarlo.
 */
function graph(): string {
  const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno
  return deno?.env?.get('WHATSAPP_GRAPH_BASE') || 'https://graph.facebook.com/v21.0'
}

/**
 * Códigos de Meta -> qué hacer. Esta tabla es la razón de ser del fichero: el
 * dominio decide con la CLASE, no con el número, y así una clasificación nueva
 * de Meta se arregla aquí y en ningún sitio más.
 *
 * Documentación de referencia: "Cloud API error codes".
 */
export function clasificar(codigo: number, detalle = ''): FalloCanal {
  const f = (clase: ClaseFallo): FalloCanal => ({ clase, codigo, detalle })

  switch (codigo) {
    // La ventana de 24 h se cerró. NO es un fallo nuestro ni del candidato: es
    // la regla. Manda la respuesta de Meta por encima de nuestro reloj, que
    // puede ir desfasado.
    case 131047: return f('ventana_cerrada')
    case 131051: return f('ventana_cerrada') // tipo de mensaje no permitido ahora

    // Ese número no recibe WhatsApp. Terminal: reintentar no lo arregla nunca,
    // y hay que decírselo al cliente para que llame por teléfono.
    case 131026: return f('no_entregable')
    case 131052: return f('no_entregable')

    // Demasiado deprisa. Reintentar más tarde, sin tocar nada.
    case 130429: return f('limite')
    case 131048: return f('limite')  // spam rate limit
    case 133016: return f('limite')

    // Culpa NUESTRA: plantilla mal escrita, parámetros que no cuadran, token
    // caducado. El cliente no tiene nada que arreglar y no hay que molestarle
    // con esto: el aviso es para nosotros.
    case 132000: return f('config')  // número de parámetros no coincide
    case 132001: return f('config')  // plantilla no existe
    case 132005: return f('config')  // texto traducido demasiado largo
    case 132007: return f('config')  // formato de parámetro no válido
    case 132012: return f('config')
    // El destinatario no está en la lista de pruebas. Solo pasa mientras la app
    // está en desarrollo, y no se arregla reintentando: hay que darlo de alta.
    case 131030: return f('config')
    case 190:    return f('config')  // token caducado o revocado
    case 200:    return f('config')  // permisos
    case 10:     return f('config')

    // La cuenta de WhatsApp tiene un problema (calidad, restricción, pago).
    case 131031: return f('cuenta')
    case 132015: return f('cuenta')  // plantilla pausada por calidad
    case 132016: return f('cuenta')  // plantilla deshabilitada
    case 133004: return f('cuenta')  // servicio no disponible para la cuenta
    case 368:    return f('cuenta')  // bloqueo temporal por incumplir políticas

    // Lo desconocido se trata como pasajero A PROPÓSITO: reintenta, y si de
    // verdad no tenía arreglo, la cola se agota a los 6 intentos y lo coge una
    // persona. Al revés (dar por terminal algo que era un hipo de red) se
    // pierde un candidato de verdad y nadie se entera.
    default: return f('transitorio')
  }
}

function cuerpoDe(msg: MensajeSaliente, destino: string): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: destino }

  if (msg.plantilla) {
    const p = msg.plantilla
    const components: Record<string, unknown>[] = []
    if (p.variables.length) {
      components.push({
        type: 'body',
        parameters: p.variables.map((text) => ({ type: 'text', text })),
      })
    }
    // Un componente por botón, cada uno con su índice: es lo que hace que al
    // pulsarlo vuelva NUESTRA carga y sepamos de quién es la respuesta.
    ;(p.botonesPayload ?? []).forEach((payload, i) => {
      components.push({
        type: 'button', sub_type: 'quick_reply', index: String(i),
        parameters: [{ type: 'payload', payload }],
      })
    })
    return {
      ...base, type: 'template',
      template: { name: p.nombre, language: { code: p.idioma }, components },
    }
  }

  // Antes que las opciones: un pin no lleva botones, y si algún día llevara
  // texto sería el pie del mapa, no un mensaje aparte.
  if (msg.ubicacion) {
    const u = msg.ubicacion
    return {
      ...base, type: 'location',
      location: {
        latitude: u.lat,
        longitude: u.lng,
        // Meta recorta en silencio: mejor cortar aquí, donde se ve.
        ...(u.nombre ? { name: u.nombre.slice(0, 100) } : {}),
        ...(u.direccion ? { address: u.direccion.slice(0, 200) } : {}),
      },
    }
  }

  if (msg.opciones?.length) {
    const cuerpo = msg.texto ?? ''
    // Hasta 3 caben como botones, que se ven de un vistazo y se pulsan sin
    // abrir nada. Más, obligatoriamente lista.
    if (msg.opciones.length <= 3) {
      return {
        ...base, type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: cuerpo },
          action: {
            buttons: msg.opciones.map((o) => ({
              type: 'reply', reply: { id: o.id, title: o.titulo.slice(0, 20) },
            })),
          },
        },
      }
    }
    return {
      ...base, type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: cuerpo },
        action: {
          button: msg.cabecera?.slice(0, 20) || 'Ver opciones',
          sections: [{
            title: 'Horarios',
            rows: msg.opciones.slice(0, 10).map((o) => ({
              id: o.id,
              title: o.titulo.slice(0, 24),
              ...(o.descripcion ? { description: o.descripcion.slice(0, 72) } : {}),
            })),
          }],
        },
      },
    }
  }

  return { ...base, type: 'text', text: { preview_url: false, body: msg.texto ?? '' } }
}

export const whatsappMeta: MessagingProvider = {
  async enviar(sender: Sender, destinoWaId: string, msg: MensajeSaliente): Promise<ResultadoEnvio> {
    let res: Response
    try {
      res = await fetch(`${graph()}/${sender.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sender.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuerpoDe(msg, destinoWaId)),
      })
    } catch (e) {
      // Ni siquiera salió la petición: red. Pasajero, sin duda.
      return { ok: false, fallo: { clase: 'transitorio', codigo: 0, detalle: String(e).slice(0, 200) } }
    }

    const texto = await res.text()
    let datos: Record<string, unknown> = {}
    try { datos = JSON.parse(texto) } catch { /* Meta devolvió algo que no es JSON */ }

    if (!res.ok) {
      const err = (datos.error ?? {}) as Record<string, unknown>
      const codigo = Number(err.code ?? 0)
      const detalle = String(
        (err.error_data as Record<string, unknown> | undefined)?.details ?? err.message ?? texto,
      ).slice(0, 400)
      // Un 5xx sin código reconocible es de Meta, no nuestro.
      if (!codigo && res.status >= 500) {
        return { ok: false, fallo: { clase: 'transitorio', codigo: res.status, detalle } }
      }
      return { ok: false, fallo: clasificar(codigo, detalle) }
    }

    const mensajes = (datos.messages ?? []) as Array<{ id?: string }>
    const contactos = (datos.contacts ?? []) as Array<{ wa_id?: string }>
    return {
      ok: true,
      providerMessageId: mensajes[0]?.id,
      // El wa_id que Meta dice que es. Puede no ser el que mandamos, y a partir
      // de aquí manda el suyo: es el que vendrá en los entrantes.
      waId: contactos[0]?.wa_id,
    }
  },

  normalizarWebhook(cuerpoCrudo: string) {
    const entrantes: EventoEntrante[] = []
    const estados: EstadoEntrega[] = []

    let raiz: Record<string, unknown>
    try { raiz = JSON.parse(cuerpoCrudo) } catch { return { entrantes, estados } }

    for (const entry of (raiz.entry ?? []) as Array<Record<string, unknown>>) {
      for (const change of (entry.changes ?? []) as Array<Record<string, unknown>>) {
        const value = (change.value ?? {}) as Record<string, unknown>
        const meta = (value.metadata ?? {}) as Record<string, string>
        const destino = meta.phone_number_id ?? ''

        for (const m of (value.messages ?? []) as Array<Record<string, unknown>>) {
          const comun = {
            providerMessageId: String(m.id ?? ''),
            waId: String(m.from ?? ''),
            destinoPhoneNumberId: destino,
            timestamp: String(m.timestamp ?? ''),
          }
          const tipo = String(m.type ?? '')

          if (tipo === 'text') {
            entrantes.push({ ...comun, tipo: 'texto', texto: String((m.text as Record<string, string>)?.body ?? '') })
          } else if (tipo === 'interactive') {
            // Respuesta a una lista o a unos botones nuestros.
            const it = (m.interactive ?? {}) as Record<string, unknown>
            const r = (it.button_reply ?? it.list_reply ?? {}) as Record<string, string>
            entrantes.push({ ...comun, tipo: 'opcion', opcionId: String(r.id ?? ''), texto: String(r.title ?? '') })
          } else if (tipo === 'button') {
            // Botón de una PLANTILLA. Aquí no viene un id, viene la carga que
            // pusimos al enviar. Es un camino distinto del anterior y hay que
            // tratarlo aparte: es justo por donde entra la respuesta a la
            // invitación, o sea, el caso más importante de todos.
            const b = (m.button ?? {}) as Record<string, string>
            entrantes.push({ ...comun, tipo: 'opcion', opcionId: String(b.payload ?? ''), texto: String(b.text ?? '') })
          } else {
            // Audio, imagen, documento, ubicación, contacto. No se procesan
            // nunca: fingir que se ha entendido un audio es peor que decir que
            // lo mire una persona.
            entrantes.push({ ...comun, tipo: 'no_soportado', texto: tipo })
          }
        }

        for (const s of (value.statuses ?? []) as Array<Record<string, unknown>>) {
          const errores = (s.errors ?? []) as Array<Record<string, unknown>>
          const bruto = String(s.status ?? '')
          const estado = bruto === 'sent' ? 'enviado'
            : bruto === 'delivered' ? 'entregado'
            : bruto === 'read' ? 'leido'
            : bruto === 'failed' ? 'fallido'
            : null
          if (!estado) continue
          estados.push({
            providerMessageId: String(s.id ?? ''),
            estado,
            codigo: errores[0] ? Number(errores[0].code ?? 0) : undefined,
            detalle: errores[0] ? String(errores[0].title ?? '').slice(0, 300) : undefined,
          })
        }
      }
    }
    return { entrantes, estados }
  },
}

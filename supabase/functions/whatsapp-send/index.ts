// Un mensaje escrito A MANO por alguien del equipo, al WhatsApp del candidato.
//
// Existe porque el número de WhatsApp es NUESTRO, no del cliente: si el agente
// se aparta y aquí no hay por dónde escribir, la conversación se queda muerta y
// el empresario no tiene ningún otro sitio desde el que contestar.
//
// Escribir ES tomar el control: antes de enviar nada se pasa el volante a la
// persona y sube el epoch, que es lo que invalida los trabajos del agente que
// estuvieran en vuelo. Al revés (enviar primero) habría una ventana en la que
// el agente y la persona escriben a la vez.
//
// verify_jwt = true. Quién puede escribir en qué conversación lo decide RLS con
// el JWT del usuario; el service_role solo entra DESPUÉS, para leer el contexto
// de envío y dejar constancia.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { whatsappMeta } from '../_shared/channels/whatsappMeta.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// El límite de un texto de WhatsApp es 4096; `candidate_messages.body` guarda
// 4000. Se corta por el menor de los dos para que lo enviado y lo registrado
// sean lo mismo.
const MAX = 4000

type Contexto = {
  conversation_id: string
  wa_id: string
  phone_number_id: string | null
  handover: string
  agent_state: string
  opted_out: boolean
  ventana_abierta: boolean
}

/**
 * El motivo del fallo en cristiano. Lo que devuelve Meta es un código y una
 * frase en inglés, y quien está mirando la pantalla necesita saber si esto lo
 * arregla él, si tiene que esperar o si tiene que llamar por teléfono.
 */
function motivoDe(clase: string, detalle: string): string {
  switch (clase) {
    case 'ventana_cerrada':
      return 'Han pasado más de 24 horas desde su último mensaje y WhatsApp ya no deja escribirle.'
    case 'no_entregable':
      return 'Ese número no recibe WhatsApp. Tendrás que llamarle por teléfono.'
    case 'limite':
      return 'WhatsApp está limitando los envíos ahora mismo. Prueba dentro de un rato.'
    case 'transitorio':
      return 'No hemos podido conectar con WhatsApp. Prueba otra vez.'
    default:
      // 'config' y 'cuenta' son culpa nuestra: no se le pide al cliente que
      // arregle nada, pero sí se le dice que no ha salido.
      console.error(`[whatsapp-send] ${clase}: ${detalle}`)
      return 'No hemos podido enviarlo. Es un problema nuestro y ya lo estamos viendo.'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const body = await req.json().catch(() => ({})) as { conversation_id?: string; body?: string }
    const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : ''
    const texto = (typeof body.body === 'string' ? body.body : '').trim().slice(0, MAX)
    if (!conversationId) return json({ error: 'Falta la conversación' }, 400)
    if (!texto) return json({ error: 'El mensaje está vacío' }, 400)

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: auth } = await userClient.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return json({ error: 'No autorizado' }, 401)

    // La autorización es esta línea: si RLS no le deja ver la conversación, no
    // existe para él. Nada de comprobar la empresa a mano.
    const { data: visible } = await userClient
      .from('candidate_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle()
    if (!visible) return json({ error: 'No autorizado' }, 403)

    const { data: raw, error: ctxError } = await admin.rpc('conversation_context', {
      p_conversation: conversationId,
    })
    if (ctxError) return json({ error: ctxError.message }, 500)
    const ctx = raw as Contexto | null
    if (!ctx) return json({ error: 'La conversación ya no existe' }, 404)

    // Pidió la baja: no se le vuelve a escribir ni a mano. Es lo único que no
    // puede saltarse una persona del equipo.
    if (ctx.opted_out) {
      return json({ error: 'Este candidato pidió no recibir más mensajes.' }, 409)
    }
    // Fuera de la ventana de 24 h Meta solo acepta plantillas aprobadas. Se dice
    // aquí para no fabricar un mensaje que va a rebotar.
    if (!ctx.ventana_abierta) {
      return json({
        error: 'Han pasado más de 24 horas desde su último mensaje. WhatsApp no deja escribirle texto libre hasta que él vuelva a escribir.',
      }, 409)
    }

    // El volante, antes que el envío. Va con el JWT del usuario porque el RPC
    // ya comprueba por su cuenta que la conversación es suya.
    // Solo si no lo tenía ya: el RPC deja una línea en el hilo cada vez que se
    // llama, y repetirla en cada mensaje llenaría la conversación de "alguien de
    // tu equipo tomó el control".
    if (ctx.handover !== 'persona') {
      const { error: handoverError } = await userClient.rpc('conversation_set_handover', {
        p_conversation: conversationId,
        p_handover: 'persona',
      })
      if (handoverError) return json({ error: handoverError.message }, 403)
    }

    const token = Deno.env.get('WHATSAPP_TOKEN') ?? ''
    const pid = ctx.phone_number_id || (Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '')
    if (!token || !pid) return json({ error: 'WhatsApp no está configurado' }, 503)

    const res = await whatsappMeta.enviar({ phoneNumberId: pid, token }, ctx.wa_id, { texto })

    // Salga o no salga, queda escrito: el empresario tiene que ver lo que
    // intentó mandar, no solo lo que llegó. Es la misma regla que sigue el agente.
    const { data: messageId } = await admin.rpc('record_outbound_message', {
      p_conversation: conversationId,
      p_author: 'persona',
      p_body: texto,
      p_provider_id: res.ok ? res.providerMessageId ?? null : null,
      p_template: null,
      p_payload: {},
      p_delivery: res.ok ? 'enviado' : 'fallido',
      p_error_code: res.ok ? null : res.fallo?.codigo ?? null,
      p_error_text: res.ok ? null : res.fallo?.detalle ?? null,
      p_author_user: uid,
    })

    if (!res.ok) {
      const f = res.fallo!
      // La ventana se pudo cerrar entre la comprobación y el envío. Se anota en
      // la base para que la pantalla deje de ofrecer la caja de texto.
      if (f.clase === 'ventana_cerrada') {
        await admin.from('candidate_conversations')
          .update({ window_expires_at: new Date().toISOString() })
          .eq('id', conversationId)
      }
      return json({ error: motivoDe(f.clase, f.detalle), message_id: messageId }, 502)
    }

    // La alarma se apaga sola al contestar: pedía que entrase una persona, y ha
    // entrado. El volante sigue siendo suyo (`handover` no se toca), así que
    // puede seguir en manual todo lo que quiera sin una chapa ámbar encendida
    // para siempre. El motivo no se pierde: está escrito en el hilo.
    if (ctx.agent_state === 'necesita_intervencion') {
      await admin.from('candidate_conversations')
        .update({ agent_state: 'esperando_respuesta', attention_reason: null })
        .eq('id', conversationId)
        .eq('agent_state', 'necesita_intervencion')
    }

    return json({ ok: true, message_id: messageId })
  } catch (e) {
    console.error('[whatsapp-send]', e)
    return json({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})

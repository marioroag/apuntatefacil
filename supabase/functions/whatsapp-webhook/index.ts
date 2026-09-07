// Webhook de WhatsApp (Meta Cloud API). verify_jwt = false: lo llama Meta.
//
// Dos verbos:
//   GET  -> el apretón de manos de alta. Meta manda un reto y espera que se lo
//           devuelvas si conoces el verify token.
//   POST -> mensajes entrantes y estados de entrega.
//
// Tres decisiones que no son de estilo:
//
//   1. NO HACE TRABAJO. Comprueba la firma, deduplica, encola y contesta. Todo
//      lo que tarde va a la cola. Meta reintenta lo que no contesta rápido, y
//      un webhook lento se convierte en una avalancha de duplicados.
//   2. Contesta 200 A TODO salvo firma inválida. Al revés que el de Stripe: un
//      500 hace que Meta reintente, y el reintento amplifica la carga justo
//      cuando ya estás roto. Si algo falla, ya está guardado en la cola.
//   3. La firma se comprueba sobre el cuerpo CRUDO, antes de parsear nada.
//      Volver a serializar un objeto ya cambia el orden de las claves y la
//      firma deja de cuadrar.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { json } from '../_shared/cors.ts'
import { whatsappMeta } from '../_shared/channels/whatsappMeta.ts'
import { NORMAL, esperaSegundos } from '../_shared/interviews/ritmo.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
// Solo para el simulador LOCAL. Nunca se define en producción: una firma que no
// se comprueba no protege de nada, y este webhook escribe en la base.
const ALLOW_UNSIGNED = Deno.env.get('ALLOW_UNSIGNED_WHATSAPP') === 'true'

function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

async function firmaValida(crudo: string, cabecera: string | null): Promise<boolean> {
  if (!APP_SECRET) return false // fail-closed: sin secreto no se acepta nada
  if (!cabecera?.startsWith('sha256=')) return false

  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(crudo))
  const esperado = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return igualSeguro(esperado, cabecera.slice(7))
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // --- Alta del webhook -----------------------------------------------------
  if (req.method === 'GET') {
    const modo = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token') ?? ''
    const reto = url.searchParams.get('hub.challenge') ?? ''
    if (modo === 'subscribe' && VERIFY_TOKEN && igualSeguro(token, VERIFY_TOKEN)) {
      // Texto plano y tal cual: Meta compara el cuerpo carácter a carácter.
      return new Response(reto, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return new Response('No autorizado', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  const crudo = await req.text()
  if (!(await firmaValida(crudo, req.headers.get('x-hub-signature-256')))) {
    if (!ALLOW_UNSIGNED) {
      // El ÚNICO caso que no es 200. Aquí sí interesa que Meta lo note.
      console.error('[whatsapp-webhook] firma no válida')
      return new Response('Firma no válida', { status: 401 })
    }
    console.warn('[whatsapp-webhook] sin firma, aceptado por ALLOW_UNSIGNED_WHATSAPP (solo local)')
  }

  const { entrantes, estados } = whatsappMeta.normalizarWebhook(crudo)
  let hayTrabajo = false
  // Cuánto falta para que toque contestar. `null` = ya toca (un botón).
  let despertarEn: number | null = null

  for (const e of entrantes) {
    try {
      const { data, error } = await admin.rpc('process_whatsapp_inbound', {
        p_phone_number_id: e.destinoPhoneNumberId,
        p_wa_id: e.waId,
        p_provider_id: e.providerMessageId,
        p_tipo: e.tipo,
        p_texto: e.texto ?? null,
        p_opcion_id: e.opcionId ?? null,
        // La espera la decide el TEXTO, no un número fijo: un "hola" suelto casi
        // seguro que trae continuación, y "¿qué horas tienes el jueves?" no.
        p_espera_s: e.tipo === 'texto' ? esperaSegundos(e.texto ?? '') : NORMAL,
      })
      if (error) throw new Error(error.message)
      const r = (data as { status?: string; falta_ms?: number } | null)
      const estado = r?.status
      if (estado && !['duplicado', 'sin_conversacion', 'sender_desconocido'].includes(estado)) {
        hayTrabajo = true
        // Si varios mensajes vienen en el mismo lote, manda el que más tarda:
        // es el que fija cuándo se contesta a todos juntos.
        const falta = Number(r?.falta_ms ?? 0)
        if (falta > 0) despertarEn = Math.max(despertarEn ?? 0, falta)
      }
      console.log(`[whatsapp-webhook] entrante ${e.tipo} -> ${estado}`)
    } catch (err) {
      // Se traga y se sigue: el resto del lote no tiene la culpa, y un 500 aquí
      // haría que Meta reenviara TODO el lote, incluido lo ya procesado.
      console.error(`[whatsapp-webhook] entrante ${e.providerMessageId}: ${err}`)
    }
  }

  for (const s of estados) {
    try {
      await admin.rpc('update_delivery_status', {
        p_provider_id: s.providerMessageId,
        p_estado: s.estado,
        p_codigo: s.codigo ?? null,
        p_detalle: s.detalle ?? null,
      })
    } catch (err) {
      console.error(`[whatsapp-webhook] estado ${s.providerMessageId}: ${err}`)
    }
  }

  // Y aquí es donde se gana la mitad del tiempo de respuesta.
  //
  // El trabajo se ejecuta cuando vence su espera, y quien lo reclama es el
  // latido. Con el latido cada 10 s, a la espera había que sumarle hasta 10
  // segundos de nada, y en la medición real eran 6 de media. Así que en vez de
  // dejarlo al latido, esta misma función se despierta en el MOMENTO justo.
  //
  // `waitUntil` mantiene viva la tarea después de haber respondido a Meta (que
  // recibe su 200 al instante, que es lo que le importa). Si el runtime se
  // llevara la instancia por delante, el latido sigue ahí de red: se pierde
  // precisión, no el mensaje.
  //
  // Se llama al latido POR HTTP y no por la RPC `interview_tick_kick`. Esa RPC
  // existe para pg_cron, que vive dentro de la base y necesita pg_net y el
  // vault para salir. Desde aquí ya estamos fuera: ir por la base sería dar un
  // rodeo, y además el rodeo no funciona en local (el vault no está puesto), que
  // es justo donde hace falta poder medir esto.
  const kick = async () => {
    try {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/interview-tick`, {
        method: 'POST',
        headers: {
          'x-interview-tick-secret': Deno.env.get('INTERVIEW_TICK_SECRET') ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ origen: 'webhook' }),
      })
      if (!r.ok) console.error(`[whatsapp-webhook] latido ${r.status}`)
    } catch (e) {
      // El latido de pg_cron sigue detrás: se pierde precisión, no el mensaje.
      console.error(`[whatsapp-webhook] latido: ${e}`)
    }
  }
  if (hayTrabajo) {
    if (despertarEn === null) {
      kick() // un botón: se atiende ya
    } else {
      const tarea = new Promise<void>((listo) => {
        setTimeout(() => { kick().finally(listo) }, despertarEn + 250)
      })
      const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
      if (rt?.waitUntil) rt.waitUntil(tarea)
      else kick() // sin runtime que lo sostenga, que lo coja el latido
    }
  }

  return json({ ok: true, entrantes: entrantes.length, estados: estados.length })
})

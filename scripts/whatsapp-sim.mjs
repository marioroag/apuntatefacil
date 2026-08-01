#!/usr/bin/env node
// Simulador de WhatsApp para probar en local sin Meta.
//
// Manda al webhook REAL payloads con la forma exacta de Meta y FIRMADOS con el
// mismo secreto. Eso es lo que le da valor: ejercita el 100% del código que va
// a producción, incluida la comprobación de firma. Un simulador que se salta la
// firma no prueba la parte que más importa.
//
// Uso (desde la raíz del proyecto, con `supabase functions serve` levantado):
//
//   node scripts/whatsapp-sim.mjs texto  34612345678 "el martes me viene mejor"
//   node scripts/whatsapp-sim.mjs boton  34612345678 "c:<conversation_id>:ver"
//   node scripts/whatsapp-sim.mjs lista  34612345678 "c:<conversation_id>:s:1"
//   node scripts/whatsapp-sim.mjs audio  34612345678
//   node scripts/whatsapp-sim.mjs estado wamid.LOQUESEA entregado
//   node scripts/whatsapp-sim.mjs baja   34612345678
//
// El id de conversación sale de la base:
//   docker exec -i supabase_db_apuntatefacil psql -U postgres -d postgres \
//     -c "select id, wa_id from candidate_conversations order by created_at desc limit 3;"

import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const ENV_PATH = 'supabase/functions/.env'
const URL_WEBHOOK = process.env.WEBHOOK_URL ?? 'http://127.0.0.1:54321/functions/v1/whatsapp-webhook'

function leerEnv() {
  const out = {}
  try {
    for (const linea of readFileSync(ENV_PATH, 'utf8').split('\n')) {
      const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim()
    }
  } catch {
    console.error(`No encuentro ${ENV_PATH}. Ejecuta esto desde la raíz del proyecto.`)
    process.exit(1)
  }
  return out
}

const env = leerEnv()
const SECRET = env.WHATSAPP_APP_SECRET
const PHONE_ID = env.WHATSAPP_PHONE_NUMBER_ID || 'PN_LOCAL'

if (!SECRET) {
  console.error(
    'Falta WHATSAPP_APP_SECRET en supabase/functions/.env.\n' +
    'En local vale cualquier cadena (es la que firma estas pruebas).\n' +
    'La de verdad está en Meta: Configuración de la app -> Información básica -> Clave secreta.',
  )
  process.exit(1)
}

const [modo, arg1, arg2] = process.argv.slice(2)
if (!modo) {
  console.error('Uso: node scripts/whatsapp-sim.mjs <texto|boton|lista|audio|estado|baja> ...')
  process.exit(1)
}

const wamid = `wamid.SIM${randomUUID().replace(/-/g, '').slice(0, 20)}`
const ts = String(Math.floor(Date.now() / 1000))
const meta = { display_phone_number: '34900000000', phone_number_id: PHONE_ID }

let value
switch (modo) {
  case 'texto':
    value = { messaging_product: 'whatsapp', metadata: meta,
      messages: [{ from: arg1, id: wamid, timestamp: ts, type: 'text', text: { body: arg2 ?? 'hola' } }] }
    break
  case 'baja':
    value = { messaging_product: 'whatsapp', metadata: meta,
      messages: [{ from: arg1, id: wamid, timestamp: ts, type: 'text', text: { body: 'BAJA' } }] }
    break
  case 'boton':
    // Botón de PLANTILLA: no trae id, trae la carga que pusimos al enviar.
    value = { messaging_product: 'whatsapp', metadata: meta,
      messages: [{ from: arg1, id: wamid, timestamp: ts, type: 'button',
        button: { payload: arg2, text: 'Ver horarios' } }] }
    break
  case 'lista':
    value = { messaging_product: 'whatsapp', metadata: meta,
      messages: [{ from: arg1, id: wamid, timestamp: ts, type: 'interactive',
        interactive: { type: 'list_reply', list_reply: { id: arg2, title: 'un horario' } } }] }
    break
  case 'audio':
    value = { messaging_product: 'whatsapp', metadata: meta,
      messages: [{ from: arg1, id: wamid, timestamp: ts, type: 'audio', audio: { id: 'media-sim' } }] }
    break
  case 'estado': {
    const mapa = { enviado: 'sent', entregado: 'delivered', leido: 'read', fallido: 'failed' }
    value = { messaging_product: 'whatsapp', metadata: meta,
      statuses: [{ id: arg1, status: mapa[arg2] ?? arg2, timestamp: ts, recipient_id: '34612345678' }] }
    break
  }
  default:
    console.error(`Modo desconocido: ${modo}`)
    process.exit(1)
}

const cuerpo = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ id: env.WHATSAPP_WABA_ID || 'WABA_LOCAL', changes: [{ value, field: 'messages' }] }],
})
const firma = 'sha256=' + createHmac('sha256', SECRET).update(cuerpo).digest('hex')

const res = await fetch(URL_WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': firma },
  body: cuerpo,
})
console.log(`${res.status} ${await res.text()}`)
if (modo !== 'estado') console.log(`(el id de este mensaje es ${wamid})`)

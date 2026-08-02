#!/usr/bin/env node
// Crea en Meta las plantillas que el código usa, y las manda a revisión.
//
// Se hace por API y no a mano en el panel a propósito: los botones tienen que
// estar en un orden EXACTO (el código los identifica por posición) y el nombre
// tiene que coincidir carácter a carácter con lo que manda `render.ts`. Un
// dedazo ahí no da error: da un 132000 semanas después, cuando un candidato se
// queda sin invitación y nadie se entera.
//
// Uso:
//   node scripts/whatsapp-templates.mjs           -> mira qué hay (no toca nada)
//   node scripts/whatsapp-templates.mjs --crear   -> crea las que falten
//
// Necesita WHATSAPP_TOKEN y WHATSAPP_WABA_ID en supabase/functions/.env.
// Vale el token temporal de la pantalla de configuración: para crear plantillas
// no hace falta el permanente.

import { readFileSync } from 'node:fs'

const GRAPH = 'https://graph.facebook.com/v21.0'
const CREAR = process.argv.includes('--crear')

function leerEnv() {
  const out = {}
  try {
    for (const l of readFileSync('supabase/functions/.env', 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim()
    }
  } catch {
    console.error('Ejecuta esto desde la raíz del proyecto.')
    process.exit(1)
  }
  return out
}

const env = leerEnv()
const TOKEN = env.WHATSAPP_TOKEN
const WABA = env.WHATSAPP_WABA_ID
if (!TOKEN || !WABA) {
  console.error('Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID en supabase/functions/.env')
  process.exit(1)
}

// Todas las que usa el código. El texto es el que está en docs/whatsapp-meta.md
// y el que espera _shared/whatsapp/render.ts: si cambias uno, cambia los tres.
const PLANTILLAS = [
  {
    name: 'invitacion_entrevista',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        // Se presenta como IA en la primera línea: lo exige el artículo 50 del
        // Reglamento europeo de IA (en vigor desde el 2 de agosto de 2026), y
        // decir QUÉ es lo automático evita que enterarse se lea como desprecio.
        // Espejo exacto de R.textoInvitacion() en _shared/whatsapp/render.ts.
        text: 'Hola {{1}}. Soy el asistente de IA de {{2}} y te escribo por tu candidatura a {{3}}. Me encargo de cuadrar la cita: vamos a buscar un horario que te venga bien.',
        example: { body_text: [['Rubén', 'Construcciones Ledesma', 'Peón de albañil']] },
      },
      {
        // ORDEN CRÍTICO: el código manda la carga de cada botón por su índice.
        // Cambiarlos de sitio hace que "No me interesa" se lea como "Ver horarios".
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Ver horarios' },
          { type: 'QUICK_REPLY', text: 'No me interesa' },
          { type: 'QUICK_REPLY', text: 'Tengo una pregunta' },
        ],
      },
    ],
  },
  {
    name: 'retomar_eleccion',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}}. Seguimos con tu entrevista de {{3}} en {{2}}. ¿Quieres ver los horarios disponibles?',
        example: { body_text: [['Rubén', 'Construcciones Ledesma', 'Peón de albañil']] },
      },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Ver horarios' }] },
    ],
  },
  {
    // El aviso de la víspera. La usa `avisarVispera` desde el 1 de agosto y
    // faltaba aquí: sin ella ese envío falla con un 132000 y el candidato no
    // recibe nada la noche antes de su entrevista.
    name: 'recordatorio_vispera',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        // Una sola línea a propósito, aunque sea larga: la prueba de deriva la
        // lee con una expresión regular y una cadena partida en trozos se le
        // escaparía a medias. Espejo de R.textoVispera().
        type: 'BODY',
        text: 'Hola {{1}}. Mañana es tu entrevista para el puesto de {{2}}.\n\nQueda el {{3}}.\n{{4}}.\n\nDinos si sigue en pie o si prefieres que busquemos otro hueco.',
        example: {
          body_text: [['Rubén', 'Peón de albañil', 'lunes, 3 de agosto a las 11:00',
            'Calle Marina 32, nave 4, 35008 Las Palmas']],
        },
      },
      {
        // ORDEN CRÍTICO: `botonesVispera` manda [:ok, :mover] por posición.
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Ahí estaré' },
          { type: 'QUICK_REPLY', text: 'Cambiar cita' },
        ],
      },
    ],
  },
  {
    name: 'recordatorio_entrevista',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        // Meta exige texto fijo suficiente en proporción a las variables: la
        // primera versión, más corta, la rechazó por eso mismo. No es capricho,
        // evita plantillas que en la práctica son un mensaje libre disfrazado.
        type: 'BODY',
        text: 'Hola {{1}}. Te recordamos tu entrevista para el puesto de {{2}}. ' +
          'Queda el {{3}}. Dónde: {{4}}. Si te surge algo y no puedes venir, ' +
          'contéstanos por aquí y buscamos otro hueco.',
        example: {
          body_text: [['Rubén', 'Peón de albañil', 'martes 4 de agosto a las 10:00',
            'Calle Mayor 3, Valencia']],
        },
      },
    ],
  },
  {
    name: 'entrevista_cancelada',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}}. Tu entrevista de {{2}} del {{3}} se ha cancelado. Sentimos el cambio.',
        example: { body_text: [['Rubén', 'Peón de albañil', 'martes 4 de agosto']] },
      },
    ],
  },
  {
    // La comprobación de interés por WhatsApp. El código todavía no la usa: se
    // pide ANTES porque lo que tarda es la aprobación, no el envío.
    // Los dos botones dicen exactamente lo mismo que las dos opciones del correo
    // (`src/lib/interestEmail.ts`): es la misma pregunta por otro canal, y si
    // cada uno la formula a su manera deja de poder compararse la respuesta.
    name: 'interes_sigue_activo',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        // Una sola línea: la prueba de deriva lo lee con una expresión regular.
        // Espejo de R.textoInteres().
        type: 'BODY',
        text: 'Hola {{1}}. Te escribimos de {{2}} por tu candidatura a {{3}}. Estamos revisando los perfiles y queremos saber si sigues interesado/a en el puesto antes de seguir adelante.',
        example: { body_text: [['Rubén', 'Construcciones Ledesma', 'Peón de albañil']] },
      },
      {
        // ORDEN CRÍTICO: el sí es el índice 0 y el no el 1.
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Sí, sigo interesado/a' },
          { type: 'QUICK_REPLY', text: 'No, ya no me interesa' },
        ],
      },
    ],
  },
]

const ESTADO = {
  APPROVED: 'aprobada, lista para usar',
  PENDING: 'en revisión (Meta está mirándola)',
  REJECTED: 'RECHAZADA',
  PAUSED: 'pausada por calidad',
  DISABLED: 'deshabilitada',
}

async function graph(ruta, opciones) {
  const res = await fetch(`${GRAPH}${ruta}`, opciones)
  const txt = await res.text()
  let datos = {}
  try { datos = JSON.parse(txt) } catch { /* respuesta no JSON */ }
  return { ok: res.ok, status: res.status, datos, txt }
}

const listado = await graph(`/${WABA}/message_templates?limit=100&access_token=${TOKEN}`)
if (!listado.ok) {
  const e = listado.datos.error ?? {}
  console.error(`\nNo he podido consultar tus plantillas (${listado.status}).`)
  console.error(`Meta dice: ${e.message ?? listado.txt.slice(0, 300)}`)
  if (Number(e.code) === 190) {
    console.error('\nEse error es el token: ha caducado o no vale. Coge uno nuevo y')
    console.error('vuelve a meterlo con  ./scripts/whatsapp-secrets.sh local')
  }
  process.exit(1)
}

const existentes = new Map((listado.datos.data ?? []).map((t) => [`${t.name}:${t.language}`, t]))

console.log('\nPlantillas que ya tienes en Meta:')
if (!existentes.size) console.log('  (ninguna todavía)')
for (const t of existentes.values()) {
  console.log(`  ${t.name} [${t.language}] -> ${ESTADO[t.status] ?? t.status}`)
  if (t.status === 'REJECTED') {
    console.log(`     motivo: ${t.rejected_reason ?? 'no lo dice'}`)
  }
}

const faltan = PLANTILLAS.filter((p) => !existentes.has(`${p.name}:${p.language}`))

if (!faltan.length) {
  console.log('\nNo falta ninguna. Cuando estén todas en "aprobada", el canal puede enviar.')
  process.exit(0)
}

console.log(`\nFaltan ${faltan.length}: ${faltan.map((p) => p.name).join(', ')}`)
if (!CREAR) {
  console.log('\nEsto solo ha mirado, no ha tocado nada.')
  console.log('Para crearlas y mandarlas a revisión:')
  console.log('  node scripts/whatsapp-templates.mjs --crear')
  process.exit(0)
}

for (const p of faltan) {
  const r = await graph(`/${WABA}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  })
  if (r.ok) {
    console.log(`  ${p.name}: creada y mandada a revisión (${r.datos.status ?? 'PENDING'})`)
  } else {
    const e = r.datos.error ?? {}
    console.log(`  ${p.name}: NO se ha creado. ${e.error_user_msg ?? e.message ?? r.txt.slice(0, 200)}`)
  }
}

console.log('\nMeta tarda de unas horas a unos días. Para ver cómo van:')
console.log('  node scripts/whatsapp-templates.mjs')

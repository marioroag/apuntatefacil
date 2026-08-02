// Lo que el agente hace cuando le toca mandar algo.
//
// Vive aparte del latido porque el latido es un repartidor (reclama, despacha,
// cierra) y esto es el contenido. Y porque así se lee entero de una sentada,
// que es lo que hace falta para confiar en un agente que le escribe a personas.
//
// EL REPARTO CON LA IA, que es lo que hay que tener claro al leer esto: la IA
// REDACTA, este fichero ACTÚA. Ningún estado, ninguna reserva y ninguna
// cancelación depende de que el modelo acierte: lo único que puede hacer es
// proponer, y aquí se comprueba. Y antes de que salga una sola palabra suya,
// `revisar()` verifica que no haya escrito una hora, un día, un enlace o una
// cantidad que no le hayamos dado. Lo que no pasa, se sustituye por la frase
// fija de `render.ts`.
//
// Tres guardas antes de CUALQUIER envío, siempre, sin excepción:
//   * El epoch. Si una persona tomó el control mientras el trabajo viajaba, no
//     se manda nada en su nombre.
//   * La baja. Un número dado de baja no recibe nada de nadie, nunca.
//   * El puesto. Si lo pausaron o lo cerraron, se para: seguir citando gente
//     para un puesto que ya no existe es peor que no hacer nada.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { whatsappMeta } from '../channels/whatsappMeta.ts'
import type { MensajeSaliente, Sender } from '../channels/types.ts'
import {
  generarAgenda, recortarAgenda, repartir,
  type DiaHuecos, type Hueco, type ReglaDisponibilidad,
} from '../schedule/slots.ts'
import * as R from './render.ts'
import { conversar } from '../interviews/conversar.ts'
import {
  citaPrometida, conAntecedentes, revisar,
  type DiaFicha, type Hechos, type Turno,
} from '../interviews/guion.ts'

export interface Contexto {
  conversation_id: string
  company_id: string
  campaign_id: string
  candidate_id: string
  interview_id: string | null
  wa_id: string
  phone_number_id: string | null
  handover: string
  agent_state: string
  agent_epoch: number
  opted_out: boolean
  ventana_abierta: boolean
  nudges_sent: number
  /** Con 'Hola' de reserva: sirve para encabezar una frase, no para la ficha. */
  candidato: string
  /** El nombre de verdad, o null si no lo tenemos. */
  candidato_nombre: string | null
  puesto: string
  ubicacion: string
  anfitrion: string | null
  empresa: string
  interview_status: string | null
  offered_slots: Hueco[]
  offer_round: number
  starts_at: string | null
  timezone: string
  mode: string
  location: string
  /** El punto del mapa, si el cliente nos lo dio. Los dos o ninguno. */
  place_lat: number | null
  place_lng: number | null
  meeting_url: string | null
  host_user_id: string | null
  duration: number
  buffer: number
  campaign_status: string
}

export interface Job {
  id: number
  kind: string
  company_id: string | null
  interview_id: string | null
  conversation_id: string | null
  agent_epoch: number | null
  payload: Record<string, unknown>
}

/** Lo que el agente decide hacer con un trabajo. */
export type Desenlace =
  | { tipo: 'hecho' }
  | { tipo: 'obsoleto'; motivo: string }   // no es un fallo: ya no procede
  | { tipo: 'fallo'; motivo: string }      // reintentar
  | { tipo: 'intervencion'; motivo: string }

const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function senderDeEntorno(phoneNumberId: string | null): Sender | null {
  const token = Deno.env.get('WHATSAPP_TOKEN') ?? ''
  const pid = phoneNumberId || (Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '')
  if (!token || !pid) return null
  return { phoneNumberId: pid, token }
}

async function contextoDe(conversationId: string): Promise<Contexto | null> {
  const { data, error } = await admin.rpc('conversation_context', { p_conversation: conversationId })
  if (error) throw new Error(`conversation_context: ${error.message}`)
  return (data as Contexto | null) ?? null
}

/**
 * Envía y deja constancia. Todo mensaje que sale queda escrito en el hilo del
 * candidato, incluido el que falla: el empresario tiene que poder ver lo que se
 * intentó, no solo lo que llegó.
 */
async function enviarYRegistrar(
  ctx: Contexto, msg: MensajeSaliente, cuerpoVisible: string, plantilla?: string,
  marca: Record<string, unknown> = {},
): Promise<Desenlace> {
  const sender = senderDeEntorno(ctx.phone_number_id)
  if (!sender) return { tipo: 'fallo', motivo: 'WhatsApp sin configurar (falta token o número)' }

  const res = await whatsappMeta.enviar(sender, ctx.wa_id, msg)

  if (res.ok) {
    await admin.rpc('record_outbound_message', {
      p_conversation: ctx.conversation_id,
      p_author: 'agente',
      p_body: cuerpoVisible,
      p_provider_id: res.providerMessageId ?? null,
      p_template: plantilla ?? null,
      p_payload: marca,
      p_delivery: 'enviado',
    })
    return { tipo: 'hecho' }
  }

  const f = res.fallo!
  // Queda escrito aunque haya fallado, con el motivo en cristiano.
  await admin.rpc('record_outbound_message', {
    p_conversation: ctx.conversation_id,
    p_author: 'agente',
    p_body: cuerpoVisible,
    p_provider_id: null,
    p_template: plantilla ?? null,
    p_payload: { clase: f.clase },
    p_delivery: 'fallido',
    p_error_code: f.codigo,
    p_error_text: f.detalle,
  })

  switch (f.clase) {
    case 'no_entregable':
      // Terminal de verdad. Reintentar no lo arregla nunca y hay que decirlo.
      await admin.rpc('escalar_conversacion', {
        p_conversation: ctx.conversation_id,
        p_motivo: 'Este número no recibe WhatsApp. Tendrás que llamarle por teléfono.',
      })
      if (ctx.interview_id) {
        await admin.from('interviews').update({ status: 'fallida' })
          .eq('id', ctx.interview_id).in('status', ['invitada', 'proponiendo'])
      }
      return { tipo: 'obsoleto', motivo: 'número sin WhatsApp' }

    case 'ventana_cerrada':
      // Meta manda sobre nuestro reloj. Se cierra la ventana en la base y se
      // vuelve a intentar por plantilla, que es lo único permitido ahí.
      await admin.from('candidate_conversations')
        .update({ window_expires_at: new Date().toISOString() })
        .eq('id', ctx.conversation_id)
      return { tipo: 'fallo', motivo: 'ventana cerrada, hay que ir por plantilla' }

    case 'config':
    case 'cuenta':
      // Culpa nuestra. El cliente no tiene nada que arreglar, pero su candidato
      // sí se queda parado, así que la conversación pasa a una persona.
      console.error(`[agente] fallo de configuración ${f.codigo}: ${f.detalle}`)
      return { tipo: 'intervencion', motivo: 'No hemos podido enviar el mensaje. Sigue tú desde aquí.' }

    default:
      return { tipo: 'fallo', motivo: `${f.clase} ${f.codigo}: ${f.detalle}` }
  }
}

/** Las tres guardas. Devuelve null si se puede seguir. */
function guardas(ctx: Contexto, job: Job): Desenlace | null {
  if (job.agent_epoch != null && ctx.agent_epoch !== job.agent_epoch) {
    return { tipo: 'obsoleto', motivo: 'alguien tomó el control mientras tanto' }
  }
  if (ctx.handover === 'persona') {
    return { tipo: 'obsoleto', motivo: 'la lleva una persona' }
  }
  if (ctx.opted_out) {
    return { tipo: 'obsoleto', motivo: 'el candidato pidió la baja' }
  }
  if (ctx.agent_state === 'cerrada') {
    return { tipo: 'obsoleto', motivo: 'la conversación ya está cerrada' }
  }
  if (ctx.campaign_status !== 'activa') {
    return { tipo: 'obsoleto', motivo: `el puesto está ${ctx.campaign_status}` }
  }
  return null
}

// ---------------------------------------------------------------------------
// Los huecos
// ---------------------------------------------------------------------------

interface ConfigHost {
  timezone: string
  durMin: number
  bufferMin: number
  minNoticeHoras: number
  horizonteDias: number
  maxPorDia: number
  granularidadMin: number
  reglas: ReglaDisponibilidad[]
}

/**
 * La agenda del anfitrión, en las formas que hacen falta a la vez.
 *
 * Son vistas de lo MISMO y se calculan juntas a propósito: los números que ve el
 * modelo son posiciones en `todos`, así que si alguien recalculara la agenda
 * entre que el modelo elige y el código reserva, el 3 dejaría de ser el 3. Por
 * eso se hace una vez por turno y se pasea.
 */
interface Agenda {
  /** Plana y cronológica. El índice de aquí es el que ve el modelo. */
  todos: Hueco[]
  /** Agrupada por día del anfitrión. Es el primer paso de la elección. */
  dias: DiaHuecos[]
  /** Ya agrupada y escrita para la ficha, con los mismos índices. */
  ficha: DiaFicha[]
  /** La zona del anfitrión, que es la que manda al hablar de días y horas. */
  tz: string
  /** Cuántas horas de un día se le proponen. Es el ajuste "Opciones por día". */
  porDia: number
}

const VACIA: Agenda = { todos: [], dias: [], ficha: [], tz: 'Europe/Madrid', porDia: 4 }

async function calcularAgenda(ctx: Contexto): Promise<Agenda> {
  if (!ctx.host_user_id) return VACIA

  // Alta con horario de oficina por defecto si es la primera vez. Nadie debería
  // tener que configurar nada para que esto funcione.
  await admin.rpc('ensure_interview_host', { p_company: ctx.company_id, p_user: ctx.host_user_id })

  const { data: cfgRaw, error: e1 } = await admin.rpc('interview_host_config', {
    p_company: ctx.company_id, p_user: ctx.host_user_id,
  })
  if (e1) throw new Error(`interview_host_config: ${e1.message}`)
  const cfg = cfgRaw as ConfigHost | null
  if (!cfg) return VACIA

  const ahora = new Date()
  const hasta = new Date(ahora.getTime() + cfg.horizonteDias * 86_400_000)
  const { data: busyRaw, error: e2 } = await admin.rpc('interview_busy', {
    p_host: ctx.host_user_id, p_desde: ahora.toISOString(), p_hasta: hasta.toISOString(),
  })
  if (e2) throw new Error(`interview_busy: ${e2.message}`)
  const ocupado = ((busyRaw ?? []) as Array<{ start_at: string; end_at: string }>)
    .map((o) => ({ start: new Date(o.start_at), end: new Date(o.end_at) }))

  const config = {
    ahora, tz: cfg.timezone, reglas: cfg.reglas,
    durMin: cfg.durMin, bufferMin: cfg.bufferMin, granularidadMin: cfg.granularidadMin,
    minNoticeHoras: cfg.minNoticeHoras, horizonteDias: cfg.horizonteDias,
    maxPorDia: cfg.maxPorDia, ocupado,
  }

  // El recorte va ANTES de numerar: el número que lea el modelo tiene que ser
  // una posición real de esta misma lista.
  const dias = recortarAgenda(generarAgenda(config))
  const todos: Hueco[] = []
  const ficha: DiaFicha[] = dias.map((d) => ({
    // Con las palabras de la calle delante ("mañana", "el lunes que viene"),
    // que es lo único que le permite entender "este lunes". Esto solo lo lee el
    // modelo: al candidato le siguen llegando las fechas de siempre.
    dia: R.diaConContexto(d.huecos[0].starts_at, cfg.timezone, ahora),
    horas: d.huecos.map((h) => {
      todos.push(h)
      return { indice: todos.length - 1, hora: R.hora(h.starts_at, cfg.timezone) }
    }),
  }))

  return { todos, dias, ficha, tz: cfg.timezone, porDia: cfg.maxPorDia }
}

/**
 * Agrupa una lista plana de huecos en la forma que lee el modelo, numerando
 * desde cero. Se usa para estrechar la ficha a la tanda que va a salir debajo
 * de un mensaje.
 */
function fichaDe(huecos: Hueco[], tz: string): DiaFicha[] {
  const out: DiaFicha[] = []
  huecos.forEach((h, i) => {
    const dia = R.diaLargo(h.starts_at, tz)
    const ultimo = out[out.length - 1]
    const fila = { indice: i, hora: R.hora(h.starts_at, tz) }
    if (ultimo && ultimo.dia === dia) ultimo.horas.push(fila)
    else out.push({ dia, horas: [fila] })
  })
  return out
}

/**
 * Lo que la IA propone escribir encima de la lista, sin revisar todavía.
 *
 * Sin revisar A PROPÓSITO: la cabecera se escribe ANTES de saber qué horarios
 * van a salir, así que solo se puede comprobar aquí, contra la tanda de verdad.
 * Es lo que permite que diga "ese martes solo me queda esta hora" cuando es
 * cierto, sin poder prometer un día que no está entre los botones.
 */
interface Cabecera {
  texto: string
  hechos: Hechos
  /** Lo que él acaba de escribir: puede devolvérselo sin inventar nada. */
  dichoPorEl: string[]
}

interface Oferta {
  agenda: Agenda
  reoferta: boolean
  /** Índices de agenda que ha pedido el modelo. Vacío = los elige el código. */
  mostrar?: number[]
  propuesta?: Cabecera
  /** Qué se manda si lo que escribió la IA no cuadra con lo que sale debajo. */
  respaldo?: string
}

/**
 * ELEGIR ES EN DOS PASOS: primero el día, después la hora.
 *
 * Un botón que dice "mar 4 ago, 17:30" mete dos decisiones dentro: si el día te
 * vale pero la hora no, ese botón no te sirve y no tienes forma de decirlo sin
 * ponerte a escribir. Pasó de verdad ("me viene bien el martes pero no a esa
 * hora"), y el día es además la decisión que de verdad bloquea: la hora casi
 * siempre es negociable dentro del día.
 *
 * Con la agenda por defecto hay ~18 huecos al día. Enseñar tres sueltos parecía
 * que no había disponibilidad; enseñar el día y luego sus horas dice la verdad.
 */
async function ofrecerHorarios(ctx: Contexto, o: Oferta): Promise<Desenlace> {
  if (!ctx.interview_id) return { tipo: 'obsoleto', motivo: 'sin entrevista' }

  const { todos } = o.agenda
  if (!todos.length) {
    return await aUnaPersona(ctx,
      'No hay horarios libres en tu agenda para ofrecerle. Ajusta tu disponibilidad o quédalo tú a mano.')
  }

  // `mostrar` dice QUÉ le interesa; el PASO lo decide el código, contando días.
  //
  // Sin esto, la IA no tenía forma de influir en qué días se enseñaban: `mostrar`
  // solo servía para horas, así que a "a partir del viernes" se le contestaba
  // tres veces seguidas con lunes, martes y miércoles. Entendía la frase y no
  // podía hacer nada con ella.
  const elegidos = (o.mostrar ?? []).map((i) => todos[i]).filter(Boolean)
  const dias = [...new Set(elegidos.map((h) => R.diaISO(h.starts_at, o.agenda.tz)))]

  if (!dias.length) return await ofrecerDias(ctx, o)          // sin preferencia
  if (dias.length > 1) return await ofrecerDias(ctx, o, dias) // varios días: que elija día
  return await enviarTanda(ctx, o, elegidos.slice(0, 10), elegidos[0].starts_at)
}

/**
 * Juzga la cabecera que ha escrito la IA contra lo que de verdad va a salir
 * DEBAJO, no contra la agenda entera. Es lo que impide que el texto y los
 * botones digan cosas distintas.
 */
function cabeceraDe(o: Oferta, agenda: DiaFicha[], huecos: { indice: number; cuando: string }[]): string {
  if (!o.propuesta?.texto) return ''
  const estrechada: Hechos = { ...o.propuesta.hechos, agenda, huecos }
  const rev = revisar(o.propuesta.texto, estrechada, { dichoPorEl: o.propuesta.dichoPorEl })
  if (rev.ok) return o.propuesta.texto
  console.warn(`[agente] cabecera descartada (${rev.motivo}): ${o.propuesta.texto.slice(0, 160)}`)
  return ''
}

/** Paso 1: los tres días próximos con hueco, y la puerta abierta a pedir otro. */
async function ofrecerDias(ctx: Contexto, o: Oferta, soloEstos?: string[]): Promise<Desenlace> {
  // Con días pedidos, esos; sin ellos, los tres próximos. En los dos casos como
  // mucho tres: son botones, y un botón por día es lo que se lee de un vistazo.
  const candidatos = soloEstos?.length
    ? o.agenda.dias.filter((d) => soloEstos.includes(R.diaISO(d.huecos[0].starts_at, o.agenda.tz)))
    : o.agenda.dias
  const proximos = candidatos.slice(0, 3)
  if (!proximos.length) {
    // Ha pedido unos días que ya no existen. No se le repiten los de siempre sin
    // más: se le enseñan los que quedan, que es una respuesta y no un bucle.
    if (soloEstos?.length) return await ofrecerDias(ctx, o)
    return await aUnaPersona(ctx,
      'No hay días libres en tu agenda para ofrecerle. Ajusta tu disponibilidad o quédalo tú a mano.')
  }
  if (!ctx.ventana_abierta) return await mandarRetomar(ctx)

  // Los días SIN sus horas: en este paso todavía no hay ninguna hora debajo, así
  // que si la IA nombra una, el filtro la tumba. Los días sí puede nombrarlos.
  const soloDias: DiaFicha[] = proximos.map((d) => ({
    dia: R.diaLargo(d.huecos[0].starts_at, o.agenda.tz), horas: [],
  }))
  const texto = cabeceraDe(o, soloDias, []) || o.respaldo || R.textoDias(ctx.candidato)

  const msg: MensajeSaliente = {
    texto,
    opciones: R.filasDias(ctx.conversation_id,
      proximos.map((d) => ({ primero: d.huecos[0].starts_at, cuantos: d.huecos.length })),
      o.agenda.tz),
    cabecera: 'Ver días',
  }
  const visible = texto + '\n' +
    proximos.map((d) => R.diaLargo(d.huecos[0].starts_at, o.agenda.tz)).join('\n')
  const r = await enviarYRegistrar(ctx, msg, visible)
  if (r.tipo === 'hecho') {
    await admin.from('candidate_conversations')
      .update({ agent_state: 'proponiendo_horarios' }).eq('id', ctx.conversation_id)
  }
  return r
}

/** Paso 2: las horas de un día concreto, repartidas de mañana y tarde. */
async function ofrecerHorasDe(ctx: Contexto, o: Oferta, diaISO: string): Promise<Desenlace> {
  const dia = o.agenda.dias.find((d) => R.diaISO(d.huecos[0].starts_at, o.agenda.tz) === diaISO)
  if (!dia) {
    // Se le llenó entre que se lo enseñamos y lo pulsó. No se calla: se le dice
    // y se le enseñan los días que quedan.
    return await ofrecerDias(ctx, {
      ...o, propuesta: undefined,
      respaldo: R.textoDiaSinHueco(`${diaISO}T12:00:00.000Z`, o.agenda.tz),
    })
  }
  // Tantas como diga su ajuste "Opciones por día", repartidas de mañana y tarde
  // y con el tope de 10 filas que admite una lista de WhatsApp. Cuando es el
  // modelo quien elige (porque le han preguntado por ese día) puede enseñar
  // hasta 10: ahí está contestando a una pregunta concreta.
  const cuantas = Math.min(Math.max(o.agenda.porDia, 2), 10)
  return await enviarTanda(ctx, o, repartir(dia.huecos, cuantas), dia.huecos[0].starts_at)
}

/** El envío en sí, común a los dos pasos de la hora. */
async function enviarTanda(
  ctx: Contexto, o: Oferta, oferta: Hueco[], diaElegido?: string,
): Promise<Desenlace> {
  if (!ctx.interview_id) return { tipo: 'obsoleto', motivo: 'sin entrevista' }
  if (!oferta.length) {
    return await aUnaPersona(ctx, 'No hemos sabido qué horarios enseñarle. Sigue tú desde aquí.')
  }

  const { data: guardado, error } = await admin.rpc('set_offered_slots', {
    p_interview: ctx.interview_id, p_slots: oferta,
  })
  if (error) throw new Error(`set_offered_slots: ${error.message}`)
  if ((guardado as { status: string }).status !== 'ok') {
    // Esto era un `obsoleto`, o sea SILENCIO, y costó cuatro mensajes sin
    // respuesta a un candidato de verdad. "La entrevista no admite oferta" es
    // un problema NUESTRO, no una señal de que él haya dejado de esperar.
    const estado = (guardado as { estado?: string }).estado ?? 'desconocido'
    return await aUnaPersona(ctx,
      `No hemos podido ofrecerle horarios (la entrevista está ${estado}). Sigue tú desde aquí.`)
  }

  // Fuera de la ventana no se puede mandar una lista: solo plantilla. Se manda
  // la de retomar, que trae el botón, y al pulsarlo se reabre la ventana y esto
  // vuelve a pasar. No es un rodeo nuestro, es cómo funciona WhatsApp.
  if (!ctx.ventana_abierta) return await mandarRetomar(ctx)

  // La ficha se ESTRECHA a la tanda, agenda incluida: si solo se estrechara la
  // lista de ofrecidos, la agenda entera seguiría avalando horarios que ya no
  // están entre los botones.
  const intro = cabeceraDe(o, fichaDe(oferta, ctx.timezone),
    oferta.map((x, i) => ({ indice: i, cuando: R.fechaLarga(x.starts_at, ctx.timezone) })))

  const texto = intro || o.respaldo
    || (diaElegido ? R.textoHorasDelDia(diaElegido, ctx.timezone)
      : o.reoferta ? R.textoReoferta() : R.textoHorarios(ctx.candidato))
  const msg: MensajeSaliente = {
    texto,
    opciones: R.filasHorarios(ctx.conversation_id, oferta, ctx.timezone, ctx.duration),
    cabecera: 'Ver horas',
  }
  const visible = texto + '\n' + oferta.map((o) => R.fechaCorta(o.starts_at, ctx.timezone)).join('\n')
  const r = await enviarYRegistrar(ctx, msg, visible)
  // El estado se mueve DESPUÉS de que la lista salga de verdad. Antes se movía
  // antes de intentarlo, así que una oferta fallida dejaba la conversación
  // diciendo "proponiendo horarios" sin haber propuesto ninguno.
  if (r.tipo === 'hecho') {
    await admin.from('candidate_conversations')
      .update({ agent_state: 'proponiendo_horarios' }).eq('id', ctx.conversation_id)
  }
  return r
}

/**
 * Pasarle la conversación a una persona SIN dejar al candidato mirando el
 * techo. Callarse es la peor respuesta posible: él no sabe que hemos parado, y
 * lo único que ve es que preguntó y nadie contestó.
 */
async function aUnaPersona(ctx: Contexto, motivo: string): Promise<Desenlace> {
  if (ctx.ventana_abierta) {
    const texto = R.textoEspera()
    await enviarYRegistrar(ctx, { texto }, texto)
  }
  return { tipo: 'intervencion', motivo }
}

async function mandarRetomar(ctx: Contexto): Promise<Desenlace> {
  const msg: MensajeSaliente = {
    plantilla: {
      nombre: R.PLANTILLAS.retomar, idioma: R.IDIOMA,
      variables: [ctx.candidato, ctx.empresa, ctx.puesto],
      botonesPayload: [`c:${ctx.conversation_id}:ver`],
    },
  }
  return await enviarYRegistrar(
    ctx, msg,
    `Seguimos con tu entrevista para ${ctx.puesto} en ${ctx.empresa}.`,
    R.PLANTILLAS.retomar,
  )
}

// ---------------------------------------------------------------------------
// El repartidor
// ---------------------------------------------------------------------------

export async function ejecutarTrabajoDeCanal(job: Job): Promise<Desenlace> {
  if (!job.conversation_id) return { tipo: 'obsoleto', motivo: 'sin conversación' }

  const ctx = await contextoDe(job.conversation_id)
  if (!ctx) return { tipo: 'obsoleto', motivo: 'la conversación ya no existe' }

  const parar = guardas(ctx, job)
  if (parar) return parar

  switch (job.kind) {
    case 'enviar_invitacion': {
      // Siempre plantilla: es el primer contacto y la ventana está cerrada por
      // definición (solo la abre un mensaje del candidato).
      const msg: MensajeSaliente = {
        plantilla: {
          nombre: R.PLANTILLAS.invitacion, idioma: R.IDIOMA,
          variables: [ctx.candidato, ctx.empresa, ctx.puesto],
          botonesPayload: R.botonesInvitacion(ctx.conversation_id),
        },
      }
      const r = await enviarYRegistrar(
        ctx, msg,
        R.textoInvitacion(ctx.candidato, ctx.empresa, ctx.puesto),
        R.PLANTILLAS.invitacion,
      )
      if (r.tipo === 'hecho') {
        await admin.from('candidate_conversations')
          .update({ agent_state: 'esperando_respuesta' }).eq('id', ctx.conversation_id)
      }
      return r
    }

    // Vienen de pulsar un botón, sin pasar por el modelo: no hay `mostrar` ni
    // cabecera que revisar, así que la agenda se calcula aquí.
    case 'enviar_horarios':
      return await ofrecerHorarios(ctx, { agenda: await calcularAgenda(ctx), reoferta: false })

    // Ha pulsado un día. Paso 2: sus horas.
    case 'enviar_horas': {
      const dia = String(job.payload?.dia ?? '')
      if (!dia) return { tipo: 'obsoleto', motivo: 'sin día' }
      return await ofrecerHorasDe(ctx, { agenda: await calcularAgenda(ctx), reoferta: false }, dia)
    }

    // Alguien le quitó el hueco. Se le vuelven a enseñar las horas DE SU DÍA, que
    // es el que ya había elegido, no una tanda cualquiera.
    case 'reofertar_horarios': {
      const agenda = await calcularAgenda(ctx)
      const suDia = (ctx.offered_slots ?? [])[0]
      const o = { agenda, reoferta: true }
      return suDia
        ? await ofrecerHorasDe(ctx, o, R.diaISO(suDia.starts_at, agenda.tz))
        : await ofrecerHorarios(ctx, o)
    }

    case 'responder_duda': {
      // Ha pulsado "tengo una duda" y todavía no sabemos cuál. No hay nada que
      // consultarle a un modelo: se le abre la puerta, y lo que escriba entra
      // ya por el camino de conversación.
      if (!ctx.ventana_abierta) return { tipo: 'obsoleto', motivo: 'ventana cerrada' }
      const texto = R.textoDuda()
      return await enviarYRegistrar(ctx, { texto }, texto)
    }

    // Ya no se encola: los audios y las fotos entran por la espera como todo lo
    // demás, para poder contestarlos JUNTO a lo que haya escrito. Se atiende
    // por los que quedaran en vuelo al desplegar.
    case 'mensaje_no_leible': {
      if (!ctx.ventana_abierta) return { tipo: 'obsoleto', motivo: 'ventana cerrada' }
      const texto = R.textoNoLeible(String(job.payload?.clase ?? ''))
      return await enviarYRegistrar(ctx, { texto }, texto)
    }

    // Los dos nombres: el de la víspera ya no se encola, pero puede quedar
    // alguno en vuelo de antes de la migración.
    case 'recordatorio_2h':
    case 'recordatorio_24h': return await recordarCandidato(ctx)

    case 'recordatorio_vispera': return await avisarVispera(ctx)

    case 'enviar_confirmacion': {
      if (!ctx.starts_at) return { tipo: 'obsoleto', motivo: 'sin hora confirmada' }
      const punto = puntoDe(ctx)
      const texto = R.textoConfirmacion(
        ctx.candidato, ctx.empresa, ctx.starts_at, ctx.timezone,
        ctx.mode, ctx.location, ctx.meeting_url, punto !== null,
      )
      // Aquí la ventana está abierta seguro: acaba de pulsar un horario.
      const r = await enviarYRegistrar(ctx, { texto }, texto)
      // El pin va DESPUÉS y aparte, como lo manda una persona: primero te digo
      // dónde, luego te paso la ubicación. Y va en su propio envío para que un
      // fallo suyo no se lleve por delante la confirmación, que es el mensaje
      // que de verdad importa. Si el pin no sale, la dirección ya está escrita.
      if (r.tipo === 'hecho' && punto) await mandarUbicacion(ctx, punto)
      return r
    }

    case 'acuse_asistencia': {
      // Ha pulsado "Ahí estaré" en el aviso de la víspera. Se le contesta y se
      // acabó: insistir después de que alguien te ha confirmado es lo que hace
      // que la gente silencie el número.
      if (!ctx.starts_at) return { tipo: 'obsoleto', motivo: 'sin hora confirmada' }
      const texto = R.textoAsistenciaConfirmada(ctx.starts_at, ctx.timezone)
      return await enviarYRegistrar(ctx, { texto }, texto)
    }

    case 'acuse_interes': {
      // Ha contestado a la comprobación de interés. Es una pregunta cerrada de
      // una sola respuesta: se le acusa recibo y no se abre conversación.
      //
      // La ventana está abierta seguro (acaba de pulsar), pero se comprueba
      // igual: si por lo que fuera no lo estuviera, mandar aquí una plantilla
      // sería gastar un envío en cortesía. Que se quede sin el acuse.
      if (!ctx.ventana_abierta) return { tipo: 'obsoleto', motivo: 'ventana cerrada' }
      const texto = R.textoAcuseInteres(job.payload?.respuesta === 'interested')
      return await enviarYRegistrar(ctx, { texto }, texto)
    }

    case 'enviar_despedida': {
      const texto = R.textoDespedida(ctx.empresa)
      if (!ctx.ventana_abierta) return { tipo: 'obsoleto', motivo: 'ventana cerrada, no insistimos' }
      return await enviarYRegistrar(ctx, { texto }, texto)
    }

    case 'enviar_texto': {
      // Lo que escribe una persona del equipo desde el panel. No lleva pie de
      // agente: lo firma quien lo escribe.
      const texto = String(job.payload?.texto ?? '').slice(0, 4000)
      if (!texto) return { tipo: 'obsoleto', motivo: 'mensaje vacío' }
      if (!ctx.ventana_abierta) {
        return { tipo: 'intervencion', motivo: 'Han pasado 24 h desde su último mensaje y WhatsApp ya no deja escribirle texto libre.' }
      }
      const sender = senderDeEntorno(ctx.phone_number_id)
      if (!sender) return { tipo: 'fallo', motivo: 'WhatsApp sin configurar' }
      const res = await whatsappMeta.enviar(sender, ctx.wa_id, { texto })
      await admin.rpc('record_outbound_message', {
        p_conversation: ctx.conversation_id,
        p_author: 'persona',
        p_body: texto,
        p_provider_id: res.providerMessageId ?? null,
        p_delivery: res.ok ? 'enviado' : 'fallido',
        p_error_code: res.fallo?.codigo ?? null,
        p_error_text: res.fallo?.detalle ?? null,
        p_author_user: (job.payload?.author_user as string) ?? null,
      })
      return res.ok ? { tipo: 'hecho' } : { tipo: 'fallo', motivo: res.fallo?.detalle ?? 'no enviado' }
    }

    // 'clasificar_texto' es el nombre viejo del mismo trabajo. Se atiende por
    // los que quedaran encolados al desplegar.
    case 'conversar':
    case 'clasificar_texto': return await hablar(ctx)

    default:
      return { tipo: 'fallo', motivo: `Trabajo de canal desconocido: ${job.kind}` }
  }
}

/**
 * El punto del mapa de esta entrevista, o null. Los dos números o ninguno: la
 * base ya lo obliga con un check, y aquí se vuelve a comprobar porque una
 * latitud sin longitud mandaría el pin al meridiano de Greenwich.
 */
function puntoDe(ctx: Contexto): { lat: number; lng: number } | null {
  if (ctx.mode !== 'presencial') return null
  const { place_lat: lat, place_lng: lng } = ctx
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return { lat, lng }
}

/** El pin, como mensaje aparte. Se registra en el hilo para que el empresario
 *  vea en su panel exactamente lo que recibió el candidato. */
async function mandarUbicacion(
  ctx: Contexto, punto: { lat: number; lng: number },
): Promise<Desenlace> {
  return await enviarYRegistrar(
    ctx,
    { ubicacion: { ...punto, nombre: ctx.empresa, direccion: ctx.location || undefined } },
    R.textoUbicacion(ctx.location),
  )
}

/**
 * El aviso de la víspera, con botones para confirmar o mover la cita.
 *
 * Va por plantilla y no como texto libre: a un día vista la ventana de 24 h
 * está cerrada casi siempre, y una plantilla es lo único que entra. Por eso los
 * botones viajan como `botonesPayload`, igual que en la invitación: es lo que
 * hace que al pulsarlos vuelva NUESTRA carga y sepamos de quién es la respuesta.
 */
async function avisarVispera(ctx: Contexto): Promise<Desenlace> {
  // La cita puede haberse movido o caído entre que se programó esto y hoy.
  if (!ctx.starts_at || ctx.interview_status !== 'confirmada') {
    return { tipo: 'obsoleto', motivo: 'la entrevista ya no está en pie' }
  }
  const cuando = R.fechaLarga(ctx.starts_at, ctx.timezone)
  const donde = R.dondeODecirlo(ctx.mode, ctx.location, ctx.meeting_url)
  const msg: MensajeSaliente = {
    plantilla: {
      nombre: R.PLANTILLAS.vispera, idioma: R.IDIOMA,
      variables: [ctx.candidato, ctx.puesto, cuando, donde],
      botonesPayload: R.botonesVispera(ctx.conversation_id),
    },
  }
  return await enviarYRegistrar(
    ctx, msg,
    R.textoVispera(ctx.candidato, ctx.puesto, ctx.starts_at, ctx.timezone, donde),
    R.PLANTILLAS.vispera,
  )
}

/** El recordatorio va por plantilla: a dos horas vista la ventana suele estar cerrada. */
async function recordarCandidato(ctx: Contexto): Promise<Desenlace> {
  if (!ctx.starts_at || ctx.interview_status !== 'confirmada') {
    return { tipo: 'obsoleto', motivo: 'la entrevista ya no está en pie' }
  }
  const cuando = R.fechaLarga(ctx.starts_at, ctx.timezone)
  // Aquí SÍ hace falta texto sí o sí: una variable vacía tumba la plantilla
  // entera en Meta, y el recordatorio no llegaría en absoluto.
  const donde = R.dondeODecirlo(ctx.mode, ctx.location, ctx.meeting_url)
  const msg: MensajeSaliente = {
    plantilla: {
      nombre: R.PLANTILLAS.recordatorio, idioma: R.IDIOMA,
      variables: [ctx.candidato, ctx.puesto, cuando, donde],
    },
  }
  return await enviarYRegistrar(
    ctx, msg,
    R.textoRecordatorio(ctx.candidato, ctx.puesto, ctx.starts_at, ctx.timezone, donde),
    R.PLANTILLAS.recordatorio,
  )
}

// ---------------------------------------------------------------------------
// La conversación
// ---------------------------------------------------------------------------

/** La ficha del agente: TODO lo que se le deja afirmar, y nada más. */
function hechosDe(ctx: Contexto, agenda: Agenda): Hechos {
  // `offered_slots` no se vacía nunca: guarda la última terna que se ofreció,
  // aunque ya la haya usado o aunque la entrevista se haya movido. Solo son
  // "los horarios que tiene delante" mientras estemos esperando que elija uno.
  //
  // No es un detalle. Con la condición floja de antes (todo lo que no fuera
  // 'confirmada'), a un candidato que pidió cambiar el día se le contestó
  // citando un hueco de la ronda anterior mientras el sistema le pegaba debajo
  // tres botones distintos. El texto y los botones decían cosas diferentes.
  const esperandoQueElija = ctx.agent_state === 'proponiendo_horarios'
    && ['invitada', 'proponiendo', 'reprogramando'].includes(ctx.interview_status ?? '')
  const vigentes = esperandoQueElija ? (ctx.offered_slots ?? []) : []
  return {
    empresa: ctx.empresa,
    puesto: ctx.puesto,
    ubicacion: ctx.ubicacion ?? '',
    candidato: ctx.candidato_nombre,
    anfitrion: ctx.anfitrion,
    estado: ctx.agent_state,
    hoy: R.diaLargo(new Date().toISOString(), ctx.timezone),
    citaTexto: ctx.starts_at ? R.fechaLarga(ctx.starts_at, ctx.timezone) : null,
    // El sitio va en la ficha SIEMPRE, no solo con la cita ya cerrada. "¿Dónde
    // es?" es de las primeras cosas que se preguntan, muchas veces antes de
    // elegir hora (si está a 40 km importa para decidir el día), y hasta ahora
    // el agente no lo tenía delante: solo la ciudad del anuncio.
    donde: R.donde(ctx.mode, ctx.location, ctx.meeting_url) || null,
    duracion: ctx.duration,
    agenda: agenda.ficha,
    // Los índices son los de la AGENDA, no 0..2. Es lo que hace que "el 3" y "el
    // 3" signifiquen lo mismo en la ficha, en lo que tiene delante y al reservar.
    // Un ofrecido que ya no esté libre se cae: no se le puede volver a proponer.
    huecos: vigentes.flatMap((h) => {
      const indice = agenda.todos.findIndex((x) => x.starts_at === h.starts_at)
      return indice < 0 ? [] : [{ indice, cuando: R.fechaLarga(h.starts_at, ctx.timezone) }]
    }),
    // Sin punto de mapa, el enlace de búsqueda es lo único tocable que tenemos,
    // así que se le deja decirlo. Con punto no hace falta: el pin lo manda el
    // código, y un enlace además sería lo mismo dicho dos veces.
    enlaces: [
      ...(ctx.meeting_url ? [ctx.meeting_url] : []),
      ...(ctx.mode === 'presencial' && ctx.location && puntoDe(ctx) === null
        ? [R.enlaceMapa(ctx.location)]
        : []),
    ],
  }
}

/** `tipo` es cómo entró (texto, opción, no_soportado) y `clase`, si no es
 *  legible, qué era: audio, image, document. */
interface Pendiente { texto: string; tipo: string; clase: string | null }
interface Dialogo { hilo: Turno[]; pendientes: Pendiente[] }

/**
 * Lo de antes y lo que falta por contestar, de una sola lectura.
 *
 * Los pendientes NO vienen en el trabajo: se leen aquí. Es lo que hace que dé
 * igual cuántos mensajes haya mandado ni cómo se hayan solapado los trabajos.
 */
async function dialogoDe(ctx: Contexto): Promise<Dialogo> {
  const { data, error } = await admin.rpc('conversation_dialogo', {
    p_conversation: ctx.conversation_id, p_limit: 12,
  })
  if (error) throw new Error(`conversation_dialogo: ${error.message}`)
  const d = (data ?? {}) as { hilo?: Array<{ quien: string; texto: string }>; pendientes?: Pendiente[] }
  return {
    hilo: (d.hilo ?? []).map((t) => ({
      quien: t.quien === 'candidato' ? 'candidato' : t.quien === 'persona' ? 'persona' : 'agente',
      texto: t.texto,
    })),
    pendientes: d.pendientes ?? [],
  }
}

/** ¿El último mensaje nuestro ya fue un "no te he entendido"? */
async function veniamosDePreguntar(ctx: Contexto): Promise<boolean> {
  const { data } = await admin.from('candidate_messages')
    .select('payload')
    .eq('conversation_id', ctx.conversation_id)
    .eq('direction', 'saliente')
    .eq('author', 'agente')
    .order('created_at', { ascending: false })
    .limit(1)
  const p = data?.[0]?.payload as Record<string, unknown> | undefined
  return p?.aclaracion === true
}

/**
 * El candidato ha escrito algo. Aquí es donde el agente conversa de verdad.
 *
 * El modelo lee el hilo entero y devuelve dos cosas: QUÉ dice y QUÉ quiere
 * hacer. Se tratan muy distinto y esa asimetría es todo el diseño:
 *
 *   * Lo que DICE se filtra por `revisar()` y, si nombra algo que no le hemos
 *     dado, se tira y sale la frase de siempre.
 *   * Lo que quiere HACER no lo hace él. Lo hacen las funciones de la base, con
 *     su vallado y sus guardas, exactamente igual que si hubiera pulsado un
 *     botón. Proponer una reserva imposible no reserva nada.
 *
 * Y no se para nunca por no entender a la primera: se pregunta. Solo si ya
 * habíamos preguntado una vez pasa a una persona, para no dejar a nadie en un
 * bucle de "¿me lo repites?".
 */
async function hablar(ctx: Contexto): Promise<Desenlace> {
  const [{ hilo, pendientes }, insistiendo, agenda] = await Promise.all([
    dialogoDe(ctx),
    veniamosDePreguntar(ctx),
    // Va en el mismo viaje que lo demás, así que conocer la agenda entera no
    // cuesta ni un milisegundo de espera al candidato.
    calcularAgenda(ctx),
  ])

  // Otro trabajo llegó antes y ya contestó a todo. No es un fallo: es que dos
  // esperas se solaparon, que es justo lo que la espera viene a resolver.
  if (!pendientes.length) return { tipo: 'obsoleto', motivo: 'ya le hemos contestado' }

  // Solo audios o fotos, sin una palabra escrita. No hay nada que interpretar,
  // así que no se gasta una llamada al modelo: se le dice la verdad y ya está.
  const legibles = pendientes.filter((p) => p.tipo === 'texto' || p.tipo === 'opcion')
  if (!legibles.length) {
    if (!ctx.ventana_abierta) return { tipo: 'obsoleto', motivo: 'ventana cerrada' }
    const texto = R.textoNoLeible(pendientes[pendientes.length - 1].clase ?? '')
    return await enviarYRegistrar(ctx, { texto }, texto)
  }

  const hechos = hechosDe(ctx, agenda)
  const cruda = await conversar(hechos, hilo, pendientes.map((p) => p.texto))
  // Sin modelo no se improvisa: se reintenta. El trabajo vuelve a la cola con
  // espera creciente y solo acaba en una persona si se agotan los intentos, o
  // sea más de una hora después. Un hipo de OpenAI no puede costar un candidato.
  if (!cruda) return { tipo: 'fallo', motivo: 'la IA no ha contestado' }

  const r = conAntecedentes(cruda, insistiendo)

  // Con la entrevista ya cerrada, "enséñale horarios" solo puede significar una
  // cosa: quiere moverla. El modelo se equivoca de nombre a menudo aquí, y el
  // código sí sabe en qué estado está la entrevista, así que lo corrige en vez
  // de intentar una oferta que la base va a rechazar. Es la misma regla de
  // siempre: el modelo propone, el código decide qué se puede hacer.
  const accionBase = r.accion.tipo === 'ofrecer_horarios' && ctx.interview_status === 'confirmada'
    ? ({ tipo: 'reprogramar', mostrar: r.accion.mostrar } as const)
    : r.accion

  // El filtro de hechos. Lo que no pasa no se corrige, se sustituye.
  //
  // Puede devolverle las palabras que él acaba de usar: contestarle "el sábado
  // no tenemos hueco" no es inventarse un sábado, es contestarle. Las horas no
  // se relajan ni así.
  const dichoPorEl = pendientes.map((x) => x.texto)
  const filtro = revisar(r.mensaje, hechos, { dichoPorEl })
  if (!filtro.ok && r.mensaje) {
    console.warn(`[agente] texto descartado (${filtro.motivo}): ${r.mensaje.slice(0, 160)}`)
  }
  const suyo = filtro.ok ? r.mensaje : ''
  const marca = r.aclaracion ? { aclaracion: true } : {}
  // Las cabeceras de lista no se juzgan aquí: se juzgan dentro de
  // `ofrecerHorarios`, contra los horarios que de verdad van a salir.
  const cabecera = (): Cabecera => ({ texto: r.mensaje, hechos, dichoPorEl })

  // COHERENCIA entre lo que dice y lo que pone debajo. Si en el texto ha
  // prometido un día y una hora que tenemos libres, se le ofrece ESA, sola, en
  // vez de la lista que hubiera tocado. Pasó en producción: escribió "te la
  // cambio al lunes 3 a las 17:00" y el sistema le pegó debajo tres botones de
  // día, o sea que le dio una hora y acto seguido se la pidió; eligió el día y
  // entonces le preguntó la hora, y las 17:00 no llegaron nunca.
  //
  // Se cambia lo que se ENSEÑA, no se reserva por su cuenta: que el agente
  // prometa algo no es que el candidato haya dicho que sí.
  const accion = (() => {
    if (!filtro.ok) return accionBase
    if (accionBase.tipo !== 'ofrecer_horarios' && accionBase.tipo !== 'reprogramar') return accionBase
    const prometido = citaPrometida(r.mensaje, hechos)
    return prometido === null ? accionBase : { ...accionBase, mostrar: [prometido] }
  })()

  switch (accion.tipo) {
    case 'contestar': {
      // Si su texto no pasó el filtro, cae la respuesta honesta de siempre:
      // soy el asistente, ese dato no lo tengo, te lo resuelven en la
      // entrevista. Nunca se queda callado.
      const texto = suyo || R.textoPregunta(ctx.empresa, ctx.starts_at, ctx.timezone)
      if (!ctx.ventana_abierta) return { tipo: 'obsoleto', motivo: 'ventana cerrada' }
      return await enviarYRegistrar(ctx, { texto }, texto, undefined, marca)
    }

    case 'ofrecer_horarios':
      return await ofrecerHorarios(ctx,
        { agenda, reoferta: false, mostrar: accion.mostrar, propuesta: cabecera() })

    case 'reservar': {
      // Su mensaje se descarta a propósito: detrás va la confirmación con la
      // hora y el sitio, y dos mensajes seguidos diciendo lo mismo sobran.
      const elegido = agenda.todos[accion.hueco]
      if (!elegido || !ctx.interview_id) return await ofrecerHorarios(ctx, { agenda, reoferta: true })

      // Si ha pedido una hora que no le habíamos enseñado, se le da igual: es lo
      // que hace cualquiera al quedar. Se AÑADE al final de la tanda en vez de
      // sustituirla, para que los botones que ya tiene delante sigan apuntando a
      // la misma hora si pulsa uno mientras esto viaja.
      let slot = (ctx.offered_slots ?? []).findIndex((h) => h.starts_at === elegido.starts_at)
      if (slot < 0) {
        const tanda = [...(ctx.offered_slots ?? []).slice(-9), elegido]
        const { data: g, error: e } = await admin.rpc('set_offered_slots', {
          p_interview: ctx.interview_id, p_slots: tanda,
        })
        if (e) return { tipo: 'fallo', motivo: `set_offered_slots: ${e.message}` }
        if ((g as { status: string }).status !== 'ok') {
          const est = (g as { estado?: string }).estado ?? 'desconocido'
          return await aUnaPersona(ctx, `Te ha pedido una hora y no hemos podido dársela (la entrevista está ${est}).`)
        }
        slot = tanda.length - 1
      }

      const { data, error } = await admin.rpc('book_interview_slot', {
        p_conversation: ctx.conversation_id, p_slot: slot, p_epoch: ctx.agent_epoch,
      })
      if (error) return { tipo: 'fallo', motivo: `book_interview_slot: ${error.message}` }
      const estado = (data as { status: string }).status
      // 'ocupado' ya deja encolada la re-oferta dentro de la propia RPC.
      if (estado === 'ok' || estado === 'ocupado' || estado === 'ya_confirmada') return { tipo: 'hecho' }
      // El modelo ha propuesto algo que la base no acepta. Se vuelve a ofrecer,
      // que es lo único seguro, en vez de molestar a nadie.
      return await ofrecerHorarios(ctx, { agenda, reoferta: true })
    }

    case 'rechazar': {
      // La despedida la encola la propia RPC, así que aquí no se manda nada:
      // sería el segundo mensaje seguido.
      const { error } = await admin.rpc('conversation_rechazar', {
        p_conversation: ctx.conversation_id, p_epoch: ctx.agent_epoch,
      })
      if (error) return { tipo: 'fallo', motivo: `conversation_rechazar: ${error.message}` }
      return { tipo: 'hecho' }
    }

    case 'reprogramar': {
      // Suelta el compromiso viejo y vuelve a ofrecer, EN UN SOLO MENSAJE: lo
      // que ha escrito la IA hace de cabecera de la lista. `reprogramando`
      // conserva el hueco anterior hasta que elija otro, que es lo que evita el
      // peor resultado: soltarlo y quedarse sin ninguno.
      if (ctx.interview_id) {
        await admin.from('interviews').update({ status: 'reprogramando' })
          .eq('id', ctx.interview_id).eq('status', 'confirmada')
      }
      return await ofrecerHorarios(
        { ...ctx, interview_status: 'reprogramando' },
        {
          agenda, reoferta: false, mostrar: accion.mostrar,
          propuesta: cabecera(), respaldo: R.textoReprogramar(),
        },
      )
    }

    case 'cancelar': {
      const { error } = await admin.rpc('conversation_cancelar', {
        p_conversation: ctx.conversation_id, p_epoch: ctx.agent_epoch,
      })
      if (error) return { tipo: 'fallo', motivo: `conversation_cancelar: ${error.message}` }
      if (ctx.ventana_abierta) {
        const texto = suyo || R.textoCancelada(ctx.empresa)
        await enviarYRegistrar(ctx, { texto }, texto)
      }
      return { tipo: 'hecho' }
    }

    default:
      // Aquí solo llega `a_una_persona`, y también avisa: pasar la conversación
      // a alguien no puede significar que el candidato no reciba nada.
      return await aUnaPersona(ctx, accion.motivo)
  }
}

export const TRABAJOS_DE_CANAL = new Set([
  'enviar_invitacion', 'enviar_horarios', 'reofertar_horarios',
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'conversar', 'clasificar_texto', 'responder_duda', 'mensaje_no_leible',
  'enviar_horas',
  // Los recordatorios dejaron de ser un correo al empresario: ahora son un
  // WhatsApp al candidato, así que los lleva el agente.
  'recordatorio_2h', 'recordatorio_24h',
  'recordatorio_vispera', 'acuse_asistencia',
  // Contestar a quien pulsa en la comprobación de interés. Es el único trabajo
  // que corre en conversaciones SIN entrevista.
  'acuse_interes',
])

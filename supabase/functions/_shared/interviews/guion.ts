// El guion del agente: qué sabe, cómo habla, y qué se le deja decir.
//
// Dominio puro: SIN imports, para que lo carguen igual Deno (las edge
// functions) y vitest (las pruebas).
//
// AQUÍ ESTÁ EL CAMBIO IMPORTANTE del agente, y conviene entenderlo bien antes
// de tocar nada. Antes el modelo solo CLASIFICABA y todo el texto salía de
// `render.ts`: era imposible que se inventara algo porque no escribía. A cambio,
// al candidato le llegaba la misma frase enlatada dijera lo que dijera, y eso se
// nota; al otro lado hay una persona buscando trabajo, no un formulario.
//
// Ahora el modelo ESCRIBE. La garantía se muda de sitio, no desaparece:
//
//   1. El modelo redacta, pero NO ACTÚA. Reservar, cancelar o cerrar sigue
//      siendo cosa de las funciones de la base, con sus guardas y su vallado.
//      Lo peor que puede proponer es una acción que el código rechace.
//   2. Todo lo concreto que diga tiene que estar en su ficha. `revisar()` es
//      determinista: si el mensaje nombra una hora, un día, un enlace o una
//      cantidad que no le hemos dado, no sale. Y si no sale, se manda la frase
//      de `render.ts` de siempre, que sigue ahí de red.
//
// O sea: la prosa es del modelo, los hechos son nuestros.

// ---------------------------------------------------------------------------
// La ficha
// ---------------------------------------------------------------------------

/**
 * TODO lo que el agente puede afirmar. Si un dato no está aquí, para el agente
 * no existe, y `revisar()` lo hace cumplir sobre el texto que devuelva.
 *
 * Las fechas vienen ya escritas ("martes 4 de agosto a las 10:00") y no en ISO
 * a propósito: así lo que el modelo lee es EXACTAMENTE lo que se le permite
 * repetir, y la comprobación no depende de volver a formatear igual.
 */
export interface Hechos {
  empresa: string
  puesto: string
  /** Dónde está el puesto. '' si el puesto no lo dice. */
  ubicacion: string
  /** Su nombre de pila, o null si no lo tenemos. */
  candidato: string | null
  /** Quién le va a entrevistar, si lo sabemos. */
  anfitrion: string | null
  /** El `agent_state` de la conversación. */
  estado: string
  /** Qué día es hoy, escrito: "sábado, 2 de agosto". Sin esto no puede
   *  entender "este lunes", "mañana" ni "la semana que viene". */
  hoy: string
  /** La cita ya cerrada: "martes 4 de agosto a las 10:00". */
  citaTexto: string | null
  /** "En Calle Mayor 3" / "Te llamamos por teléfono" / "Videollamada: ...". */
  donde: string | null
  duracion: number
  /**
   * LA AGENDA DE VERDAD del anfitrión, agrupada por día.
   *
   * Es la pieza que faltaba. Con solo los tres huecos ofrecidos, el agente no
   * podía contestar a ninguna pregunta de agenda sin mentir: a "¿qué horas
   * tienes el miércoles?" respondió "no tengo ningún hueco el miércoles", que
   * era falso. Ahora ve lo que hay, y los números son el idioma con el que
   * elige: son índices en esta misma lista, aplanada por días en orden.
   */
  agenda: DiaFicha[]
  /** Los horarios ofrecidos ahora mismo. `indice` es el de la agenda. */
  huecos: { indice: number; cuando: string }[]
  /** Enlaces que sí puede repetir (la sala de la videollamada). */
  enlaces: string[]
}

export interface DiaFicha {
  /** "jueves 6 de agosto", ya escrito, como el resto de la ficha. */
  dia: string
  horas: { indice: number; hora: string }[]
}

/** Cuántos huecos tiene la agenda. Es el rango válido de los índices. */
export function totalAgenda(h: Hechos): number {
  return h.agenda.reduce((n, d) => n + d.horas.length, 0)
}

/** Un turno de la conversación, para que el agente lea el hilo y no un mensaje suelto. */
export interface Turno {
  quien: 'candidato' | 'agente' | 'persona'
  texto: string
}

// ---------------------------------------------------------------------------
// Lo que el agente puede querer hacer
// ---------------------------------------------------------------------------

export type AccionAgente =
  | { tipo: 'contestar' }                    // solo habla: ni estados ni citas
  /** `mostrar` son índices de agenda. Vacío = que los elija el código. */
  | { tipo: 'ofrecer_horarios'; mostrar: number[] }
  | { tipo: 'reservar'; hueco: number }
  | { tipo: 'rechazar' }
  | { tipo: 'cancelar' }
  /** Mover una cita ya cerrada. Detrás va una oferta, así que lleva `mostrar`. */
  | { tipo: 'reprogramar'; mostrar: number[] }
  | { tipo: 'a_una_persona'; motivo: string }

export interface Respuesta {
  accion: AccionAgente
  /** Lo que se le manda al candidato. Vacío = que escriba el código. */
  mensaje: string
  confianza: 'alta' | 'media' | 'baja'
  /** El mensaje es "no te he entendido, ¿me lo repites?". Se cuenta aparte. */
  aclaracion: boolean
}

/** El esquema estricto que se le pide a OpenAI. Es dato, así que vive aquí. */
export const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    accion: {
      type: 'string',
      enum: ['contestar', 'ofrecer_horarios', 'reservar', 'rechazar',
        'cancelar', 'reprogramar', 'persona'],
    },
    /** Índice de agenda que quiere reservarle. */
    hueco: { type: ['integer', 'null'] },
    /** Índices de agenda que quiere ENSEÑARLE. null o vacío = los elige el código. */
    mostrar: { type: ['array', 'null'], items: { type: 'integer' } },
    mensaje: { type: 'string' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    aclaracion: { type: 'boolean' },
  },
  // Con `strict: true` TODO tiene que estar en `required` (por eso `mostrar` es
  // `['array','null']` y no un opcional), y no se admiten `minItems`/`maxItems`:
  // el tope de 10 lo pone `normalizarRespuesta`, no el esquema.
  required: ['accion', 'hueco', 'mostrar', 'mensaje', 'confianza', 'aclaracion'],
} as const

// ---------------------------------------------------------------------------
// Las instrucciones
// ---------------------------------------------------------------------------

function fichaDe(h: Hechos): string {
  const l: string[] = []
  l.push(`Hoy es ${h.hoy}`)
  l.push(`Empresa: ${h.empresa}`)
  l.push(`Puesto: ${h.puesto}${h.ubicacion ? ` (${h.ubicacion})` : ''}`)
  l.push(h.candidato
    ? `Candidato: ${h.candidato}`
    : 'Candidato: no sabemos su nombre, así que no lo uses.')
  if (h.anfitrion) l.push(`Le entrevista: ${h.anfitrion}`)
  l.push(`Duración de la entrevista: ${h.duracion} minutos`)

  if (h.citaTexto) {
    l.push(`Entrevista cerrada: ${h.citaTexto}`)
  } else {
    l.push('Entrevista: todavía sin día ni hora.')
  }

  // El sitio va aquí fuera y no dentro del `if` a propósito: "¿dónde es?" se
  // pregunta muchas veces ANTES de elegir hora, porque si está a 40 km eso
  // cambia qué día te viene bien.
  if (h.donde) {
    l.push(`Dónde es la entrevista: ${h.donde}`)
  } else {
    l.push('Dónde es la entrevista: TODAVÍA NO LO SABES. Si te lo preguntan, dilo tal cual')
    l.push('  y añade que se lo confirmamos por aquí antes de la cita. No te inventes una')
    l.push('  dirección ni le mandes a la dirección del anuncio.')
  }

  // La agenda con el número pegado a cada hora, y sin rangos: así el modelo no
  // tiene que calcular nada para elegir, solo copiar un número.
  if (h.agenda.length) {
    l.push('Tu agenda libre (número: hora). Solo existen estos números y estas horas:')
    for (const d of h.agenda) {
      l.push(`  ${d.dia}: ${d.horas.map((x) => `${x.indice} ${x.hora}`).join(', ')}`)
    }
  } else {
    l.push('No tienes ningún hueco libre en los próximos días.')
  }

  if (h.huecos.length) {
    l.push(`Horarios que tiene delante ahora mismo: ${h.huecos.map((x) => x.indice).join(', ')}`)
  } else {
    l.push('Ahora mismo no tiene ningún horario delante.')
  }
  return l.join('\n')
}

export function construirSistema(h: Hechos): string {
  return [
    `Eres el asistente de ${h.empresa}. Escribes por WhatsApp a alguien que se apuntó`,
    `a "${h.puesto}". ${h.empresa} te ha encargado UNA cosa: cuadrar el día y la hora`,
    'de su entrevista. Nada más.',
    '',
    '## Cómo escribes',
    '- Español de España, tuteo, cercano y normal. Como escribe una persona por',
    '  WhatsApp, no como un formulario ni como una carta.',
    '- Corto: dos o tres frases. Es un chat, no un correo.',
    '- Sin emojis. Sin mayúsculas de grito. Sin guion largo, usa comas o puntos.',
    '- Nunca repitas una frase que ya has dicho en este hilo. Si tienes que',
    '  insistir en algo, dilo de otra manera.',
    '- Nada de urgencia falsa ("plazas limitadas", "última oportunidad"). Jamás.',
    '- Puede que te haya escrito VARIOS mensajes seguidos, como se habla por',
    '  chat. Léelos como una sola cosa y contesta UNA vez a todo, no uno por uno.',
    '- Si entre sus mensajes ves algo entre paréntesis como "(te ha mandado un',
    '  audio)", es que nos ha mandado algo que no sabemos leer. Pídeselo por',
    '  escrito sin darle importancia, y contesta igual a lo demás que haya dicho.',
    '',
    '## Quién eres',
    `Eres el asistente de IA de ${h.empresa} y te encargas de cuadrar sus entrevistas.`,
    'Ya te presentaste como tal en el primer mensaje, así que no hace falta',
    'repetirlo en cada respuesta. Pero si te preguntan si eres una persona o una',
    'máquina, dilo claro y a la primera: eres un asistente de IA. No finjas ser',
    'alguien que no eres, ni te inventes un nombre propio.',
    'La entrevista NO la haces tú: la hará alguien del equipo. Tú cuadras la cita.',
    '',
    '## Lo que sabes (y es TODO lo que sabes)',
    fichaDe(h),
    '',
    '## Lo que NO sabes',
    'Sueldo, tipo de contrato, jornada, horario de trabajo, requisitos, quién más',
    'se ha apuntado, cómo sigue el proceso después de la entrevista, y cualquier',
    'otro detalle del puesto o de la empresa.',
    '',
    'Cuando te pregunten algo de eso: dilo sin rodeos, que no lo tienes, y que se',
    'lo resuelven en la entrevista. No lo adivines, no lo supongas, no digas "creo',
    'que" ni "normalmente". Y no te disculpes tres veces: una frase honesta y',
    'sigues.',
    '',
    'Otra confusión, la del sitio: lo que va entre paréntesis al lado del puesto es',
    'la zona del anuncio, no una dirección. No la uses nunca para contestar a dónde',
    'tiene que ir: para eso está "Dónde es la entrevista", y si ahí pone que no lo',
    'sabes, es que no lo sabes.',
    '',
    'OJO con una confusión fácil: el horario DEL PUESTO (a qué hora se trabaja) no',
    'lo sabes. El horario de LA ENTREVISTA sí, lo tienes en tu agenda. "Dame hora",',
    '"cuándo sería", "qué horas tienes", "¿para cuándo?" son peticiones de cita:',
    'enséñale horarios, no le contestes que no tienes el dato.',
    '',
    'NUNCA escribas una hora, un día, una dirección, un enlace, un teléfono ni una',
    'cantidad de dinero que no esté en la ficha de arriba. Si no está, no existe.',
    '',
    '## Tu agenda',
    '- Los números de la agenda son los únicos horarios que existen.',
    '- Cada día lleva delante cómo lo diría él ("mañana", "este lunes", "el lunes',
    '  que viene"). NO calcules fechas tú: si te dice "este lunes", es el día que',
    '  pone "este lunes", y si dice "el lunes que viene" es el otro. Hay dos lunes',
    '  en tu agenda y confundirlos es mandar a alguien una semana tarde.',
    '- Si escribes una hora concreta en el texto, es un COMPROMISO: el sistema le',
    '  ofrecerá ESA y nada más. Así que dila solo si de verdad se la quieres dar.',
    '  Nunca prometas una hora y a la vez le pidas que elija.',
    '- ELEGIR ES EN DOS PASOS: primero el día, después la hora. En "mostrar" pones',
    '  los números que le vengan bien, y el sistema decide cómo enseñárselos:',
    '    * números de UN SOLO día -> le enseña esas horas.',
    '    * números de VARIOS días -> le enseña esos días, para que elija uno.',
    '    * "mostrar" vacío -> le enseña los tres días próximos. Es lo normal al',
    '      empezar, cuando todavía no sabes qué le viene bien.',
    '  Tú no escribas los horarios en el texto: el sistema pega la lista debajo.',
    '- Si te dice un día ("el miércoles", "el jueves por la tarde"), pon los',
    '  números de ESE día. Si te dice un tramo ("a partir del viernes", "la',
    '  semana que viene", "solo por las tardes"), pon uno de cada día que le',
    '  encaje: verá esos días y elegirá.',
    '- Si te pide una hora concreta y la tienes libre, RESÉRVASELA: accion',
    '  "reservar" y su número en "hueco". Da igual que no se la hubieras ofrecido.',
    '- Si te pide algo que no tienes (un sábado, un día lleno, una hora ocupada),',
    '  dilo con naturalidad y enséñale lo más cercano que sí tengas. Esto lo',
    '  resuelves tú: no es motivo para pasarle la conversación a nadie.',
    '',
    '## Lo que quieres conseguir',
    h.citaTexto
      ? [
        'La entrevista ya está cerrada. Resuelve lo que te pregunte.',
        'OJO, el error más fácil aquí: si lo que quiere es MOVERLA ("ponmela",',
        '"mejor otro día", "cámbiamela", "no puedo ese día", "¿y el lunes?"), eso',
        'es reprogramar, NO confirmarle que sigue en pie. Confirmar es lo que se',
        'hace cuando pregunta si sigue, no cuando pide otro día.',
      ].join('\n')
      : 'Que elija uno de los horarios. Contéstale primero a lo que te diga, y luego vuelve a ello con naturalidad, sin agobiar y sin decirlo dos veces igual.',
    '',
    '## Qué haces (elige UNA acción)',
    '- contestar: solo hablas. Es lo normal.',
    '- ofrecer_horarios: quieres enseñarle horarios libres, con "mostrar".',
    '- reservar: te ha dicho una hora que tienes libre, esté o no en la lista que',
    '  le enseñaste. Pon su número de agenda en "hueco". Si no está clarísimo',
    '  cuál, usa ofrecer_horarios.',
    '- rechazar: dice que no le interesa el puesto.',
    '- cancelar: quiere anular una entrevista que ya estaba cerrada.',
    '- reprogramar: quiere moverla a otro momento.',
    '- persona: pide hablar con alguien del equipo, o hay algo serio que no te',
    '  toca a ti (una queja, algo delicado, algo que se sale del proceso). NO',
    '  incluye que te pida un día que no tienes: eso lo resuelves tú.',
    '',
    '"confianza" es lo seguro que estás de haberle entendido. Si dudas, pon baja',
    'y escribe una pregunta corta para que te lo aclare, con aclaracion=true.',
    'Preguntar está bien. Adivinar no.',
  ].join('\n')
}

/**
 * @param pendientes Todo lo que ha escrito desde la última vez que hablamos, en
 *   orden. Van juntos y no de uno en uno a propósito: en un chat la gente suelta
 *   la idea a trozos ("hola", "vi el anuncio", "¿sigue abierto?"), y contestar
 *   a cada trozo por separado es lo que hace que parezca una máquina.
 */
export function construirConversacion(turnos: Turno[], pendientes: string[]): string {
  const hilo = turnos.length
    ? turnos.map((t) => `${t.quien === 'candidato' ? 'ÉL' : 'TÚ'}: ${t.texto}`).join('\n')
    : '(no hay nada anterior)'
  const suyos = pendientes.filter((p) => p.trim())
  const cabecera = suyos.length > 1
    ? `Sus ${suyos.length} últimos mensajes, seguidos. Contéstalos JUNTOS, con un solo mensaje:`
    : 'Su último mensaje, al que tienes que responder:'
  return [
    'Conversación hasta ahora:',
    hilo,
    '',
    cabecera,
    `"""\n${suyos.join('\n')}\n"""`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Lo que se hace con lo que conteste
// ---------------------------------------------------------------------------

/**
 * Nunca se confía en la forma de la respuesta, aunque el esquema sea estricto.
 * Un índice fuera de rango tiene que morir aquí y no llegar a reservar un hueco
 * que no existe.
 */
export function normalizarRespuesta(crudo: Record<string, unknown>, nAgenda: number): Respuesta {
  const mensaje = typeof crudo.mensaje === 'string' ? crudo.mensaje.trim().slice(0, 1500) : ''
  const confianza = ['alta', 'media', 'baja'].includes(crudo.confianza as string)
    ? (crudo.confianza as Respuesta['confianza'])
    : 'baja'
  const aclaracion = crudo.aclaracion === true

  const enRango = (x: unknown): x is number =>
    typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < nAgenda

  const hueco = enRango(crudo.hueco) ? crudo.hueco : null

  // Los índices que no valen se tiran EN SILENCIO, no rompen la respuesta:
  // degradar aquí es enseñarle menos horarios, no dejarle sin contestación. El
  // tope de 10 es el de las filas de una lista de WhatsApp.
  const mostrar = Array.isArray(crudo.mostrar)
    ? [...new Set(crudo.mostrar.filter(enRango))].sort((a, b) => a - b).slice(0, 10)
    : []

  // Con dudas NO se actúa, pero tampoco se para: se pregunta. Es la diferencia
  // entre un agente prudente y uno que deja al candidato colgado. Lo único que
  // se le quita es la capacidad de mover cosas mientras no ha entendido.
  if (confianza === 'baja') {
    return { accion: { tipo: 'contestar' }, mensaje, confianza, aclaracion: true }
  }

  switch (crudo.accion) {
    case 'contestar':
      return { accion: { tipo: 'contestar' }, mensaje, confianza, aclaracion }
    case 'ofrecer_horarios':
      return { accion: { tipo: 'ofrecer_horarios', mostrar }, mensaje, confianza, aclaracion }
    case 'reservar':
      // "Reservo uno" sin decir cuál no es reservar. Se degrada a volver a
      // ofrecer, conservando los que quisiera enseñar: si dijo "uno de estos"
      // sin decidirse, enseñarle ESOS es mejor que enseñarle otros distintos.
      return hueco === null
        ? { accion: { tipo: 'ofrecer_horarios', mostrar }, mensaje, confianza, aclaracion }
        : { accion: { tipo: 'reservar', hueco }, mensaje, confianza, aclaracion }
    case 'rechazar':
      return { accion: { tipo: 'rechazar' }, mensaje, confianza, aclaracion }
    case 'cancelar':
      return { accion: { tipo: 'cancelar' }, mensaje, confianza, aclaracion }
    case 'reprogramar':
      return { accion: { tipo: 'reprogramar', mostrar }, mensaje, confianza, aclaracion }
    case 'persona':
      return {
        accion: { tipo: 'a_una_persona', motivo: 'Te ha pedido hablar con alguien del equipo.' },
        mensaje, confianza, aclaracion,
      }
    default:
      // Un enum inventado es una respuesta rota, no una intención rara.
      return {
        accion: { tipo: 'a_una_persona', motivo: 'No hemos sabido seguir la conversación. Sigue tú desde aquí.' },
        mensaje: '', confianza: 'baja', aclaracion: false,
      }
  }
}

/**
 * Preguntar una vez es atender. Preguntar dos veces seguidas es marear.
 *
 * Sin esto, un candidato que escribe de una forma que el modelo no pilla se
 * queda en un bucle de "¿me lo repites?" hasta que se cansa y se va. Que es
 * exactamente el candidato que más falta hace no perder.
 */
export function conAntecedentes(r: Respuesta, yaSePidioAclaracion: boolean): Respuesta {
  if (r.aclaracion && yaSePidioAclaracion) {
    return {
      ...r,
      accion: { tipo: 'a_una_persona', motivo: 'Nos ha escrito dos veces y no le hemos entendido. Sigue tú desde aquí.' },
      mensaje: '',
    }
  }
  return r
}

// ---------------------------------------------------------------------------
// El filtro de hechos
// ---------------------------------------------------------------------------

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Sin acentos y en minúsculas, para comparar "miércoles" con "miercoles". */
function plano(s: string): string {
  // ̀-ͯ son los acentos ya sueltos por NFD. Escapados y no literales:
  // un fichero con marcas combinantes sueltas se rompe al copiarlo o al pasarlo
  // por una herramienta que normalice.
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** "09:00" y "9:00" son la misma hora escrita de dos maneras. */
function horaPlana(s: string): string {
  const [h, m] = s.split(':')
  return `${Number(h)}:${m}`
}

/** Todo lo que le hemos contado, en un solo texto contra el que comparar. */
function fichaPlana(h: Hechos): string {
  return plano([
    h.empresa, h.puesto, h.ubicacion, h.candidato ?? '', h.anfitrion ?? '',
    h.citaTexto ?? '', h.donde ?? '', String(h.duracion), h.hoy,
    ...h.agenda.map((d) => `${d.dia} ${d.horas.map((x) => x.hora).join(' ')}`),
    ...h.huecos.map((x) => x.cuando), ...h.enlaces,
  ].join(' | '))
}

// Extractores. Se crean nuevas en cada llamada: una expresión regular global
// lleva estado (`lastIndex`) y compartirla entre comprobaciones se salta
// coincidencias.
const horasDe = (s: string) => [...s.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map((m) => m[0])
const fechasDe = (s: string) =>
  [...s.matchAll(new RegExp(`\\b\\d{1,2}\\s+de\\s+(${MESES.join('|')})\\b`, 'g'))].map((m) => m[0])
const diasDe = (s: string) => DIAS.filter((d) => new RegExp(`\\b${d}\\b`).test(s))

/**
 * Los días de los que sabemos algo: la agenda libre MÁS el de la cita ya
 * cerrada, que no sale en la agenda precisamente porque su hueco lo ocupa ella.
 *
 * Van juntos y no como una excepción suelta porque la excepción era el fallo:
 * antes la hora de la cita se admitía hablando de CUALQUIER día, y con la cita
 * cerrada el lunes 10 a las 17:00 el agente escribió "te la cambio al lunes 3 a
 * las 17:00" y coló, porque esas 17:00 estaban en la ficha... pero del otro
 * lunes. Aquí cada hora va pegada a su día y no hay nada que eximir.
 *
 * La hora de la cita entra con índice -1: se puede DECIR, pero no es un hueco
 * que se le pueda dar a nadie, porque ya es suyo.
 */
function diasConocidos(h: Hechos): DiaFicha[] {
  const cita = plano(h.citaTexto ?? '')
  const fecha = fechasDe(cita)[0]
  if (!cita || !fecha) return h.agenda
  const suyas = horasDe(cita).map((hora) => ({ indice: -1, hora }))
  const i = h.agenda.findIndex((d) => plano(d.dia).includes(fecha))
  return i < 0
    ? [...h.agenda, { dia: h.citaTexto as string, horas: suyas }]
    : h.agenda.map((d, j) => (j === i ? { ...d, horas: [...d.horas, ...suyas] } : d))
}

/**
 * A qué día apunta un mensaje. LA FECHA MANDA SOBRE EL NOMBRE, y ese orden es
 * todo el arreglo.
 *
 * Con un horizonte de diez días, cada día de la semana sale DOS VECES en la
 * agenda ("lunes 3" y "lunes 10"). Buscando por nombre, un mensaje que dijera
 * "lunes" señalaba los dos, y con dos días señalados el emparejamiento hora-día
 * se desactivaba solo, justo en las conversaciones de mover una cita, que son
 * las que más lo necesitan. Si el mensaje dice "3 de agosto", ese día manda y
 * el otro lunes no pinta nada.
 */
function diasSenalados(p: string, dias: DiaFicha[]): DiaFicha[] {
  const porFecha = dias.filter((d) => {
    const dp = plano(d.dia)
    const fecha = fechasDe(dp)[0]
    if (!fecha) return false
    if (p.includes(fecha)) return true
    // Nadie escribe el mes al hablar. Lo que salió en producción fue "al lunes
    // 3 a las 17:00", sin "de agosto", y buscando la fecha entera eso no
    // señalaba nada: se caía al nombre, había dos lunes, y la comprobación se
    // desactivaba sola justo en el mensaje que había que parar.
    const numero = parseInt(fecha, 10)
    const nombre = diasDe(dp)[0]
    if (nombre && new RegExp(`\\b${nombre}\\s+(dia\\s+)?${numero}\\b`).test(p)) return true
    return new RegExp(`\\bdia\\s+${numero}\\b`).test(p)
  })
  if (porFecha.length) return porFecha
  return dias.filter((d) => {
    const nombre = diasDe(plano(d.dia))[0]
    return !!nombre && diasDe(p).includes(nombre)
  })
}

/**
 * El día y la hora que el mensaje PROMETE, si promete uno solo y lo tenemos
 * libre. Devuelve su número de agenda, o null.
 *
 * Existe por una incoherencia que se vio en producción: el agente escribió "te
 * la cambio al lunes 3 a las 17:00" y el sistema le pegó debajo tres botones de
 * DÍA para que eligiera. O sea, le dio una hora y acto seguido se la pidió. El
 * candidato eligió el día y entonces le preguntó la hora, y las 17:00
 * prometidas no llegaron nunca.
 *
 * De las dos salidas posibles (que no prometa, o que cumpla) se coge cumplir:
 * si ha dicho una hora concreta y la tenemos, esa es LA que se le ofrece, sola.
 * Así el texto y lo que hay debajo dicen lo mismo, y aceptar le da exactamente
 * la hora que leyó. No se reserva por su cuenta: prometer no es que él haya
 * dicho que sí, y "¿te viene bien el lunes a las 17:00?" es una pregunta.
 */
export function citaPrometida(mensaje: string, h: Hechos): number | null {
  const p = plano(mensaje)
  const horas = [...new Set(horasDe(mensaje).map(horaPlana))]
  if (horas.length !== 1) return null          // ninguna hora, o varias: no es una promesa

  const dias = diasSenalados(p, diasConocidos(h))
  if (dias.length !== 1) return null           // sin saber de qué día habla, no se toca nada

  const fila = dias[0].horas.find((x) => horaPlana(x.hora) === horas[0])
  // Índice -1 es la hora de la cita que ya tiene. Repetírsela ("sí, sigue el
  // lunes a las 17:00") no es prometerle nada nuevo, y no hay hueco que ofrecer.
  return fila && fila.indice >= 0 ? fila.indice : null
}

export type Revision = { ok: true } | { ok: false; motivo: string }

export interface OpcionesRevision {
  /**
   * Lo que ACABA DE ESCRIBIR él. Repetirle una palabra suya no es inventar: si
   * pregunta "¿puedes el sábado?", la respuesta honesta ("el sábado no tenemos
   * hueco, mira estos") tiene que poder decir "sábado". Sin esto, el agente se
   * quedaba mudo ante su pregunta y soltaba la frase enlatada de siempre, dos
   * veces seguidas y sin contestar a nada. Solo abre días y fechas: las horas,
   * el dinero y los enlaces siguen saliendo únicamente de la ficha.
   */
  dichoPorEl?: string[]
}

/**
 * La regla, entera, en una línea: **el agente no puede escribir ningún dato
 * concreto que no le hayamos dado**.
 *
 * No intenta detectar si "miente" (eso no se puede comprobar), sino algo mucho
 * más estrecho y que sí se puede: que cada hora, día, fecha, cantidad, enlace o
 * teléfono que aparezca en su mensaje esté en su ficha. Es lo que convierte una
 * instrucción del prompt (que un modelo puede ignorar) en una propiedad del
 * sistema (que no).
 *
 * Lo que no pasa el filtro no se corrige: se tira y se manda la frase fija de
 * `render.ts`. Preferimos sonar sosos un mensaje antes que citar a alguien un
 * día que no es.
 */
export function revisar(mensaje: string, h: Hechos, op: OpcionesRevision = {}): Revision {
  const texto = mensaje.trim()
  if (!texto) return { ok: false, motivo: 'mensaje vacío' }
  // Un WhatsApp de más de 700 caracteres no lo lee nadie, y es además la señal
  // típica de que el modelo se ha puesto a redactar por su cuenta.
  if (texto.length > 700) return { ok: false, motivo: 'demasiado largo' }

  const ficha = fichaPlana(h)
  const p = plano(texto)
  const horas = horasDe
  const fechas = fechasDe
  const dias = diasDe

  // 1. Horas. La peor mentira posible: citar a alguien a una hora que no es.
  //    Nunca se relajan, ni siquiera con lo que él haya dicho.
  const deLaFicha = horas(ficha).map(horaPlana)
  for (const hh of horas(texto)) {
    if (!deLaFicha.includes(horaPlana(hh))) return { ok: false, motivo: `hora inventada: ${hh}` }
  }

  // 2. Días de la semana y fechas, contra la ficha MÁS lo que él acaba de
  //    escribir. Devolverle su propia palabra no es inventarse nada.
  const suyas = plano((op.dichoPorEl ?? []).join(' '))
  const conocido = (s: string) => ficha.includes(s) || suyas.includes(s)
  for (const dia of dias(p)) {
    if (!conocido(dia)) return { ok: false, motivo: `día inventado: ${dia}` }
  }
  for (const f of fechas(p)) {
    if (!conocido(f)) return { ok: false, motivo: `fecha inventada: ${f}` }
  }

  // 2b. EMPAREJAMIENTO día-hora. Sin esto, meter la agenda entera en la ficha
  //     abriría un agujero: la ficha es una bolsa plana, así que "el jueves te
  //     doy las 16:00" pasaría por tener el jueves en un sitio y unas 16:00 en
  //     otro, aunque las 16:00 sean del viernes. Y esa es exactamente la mentira
  //     que hace que alguien se plante un día equivocado.
  //
  //     Solo se aplica cuando el mensaje señala UN día sin ambigüedad. Con cero
  //     o con varios se vuelve a la comprobación de unión de arriba: preferimos
  //     dejar pasar una respuesta correcta a tumbarla por no saber a cuál se
  //     refería.
  //
  //     Las horas de la tanda ofrecida no se eximen, aunque tentaba: salen de la
  //     agenda, así que ya están cubiertas por su día, y eximirlas dejaba pasar
  //     "el martes te doy las 16:30" cuando esas 16:30 eran del miércoles.
  const señalados = diasSenalados(p, diasConocidos(h))
  if (señalados.length === 1) {
    const suyasDelDia = new Set(señalados[0].horas.map((x) => horaPlana(x.hora)))
    for (const hh of horas(texto)) {
      if (!suyasDelDia.has(horaPlana(hh))) {
        return { ok: false, motivo: `${hh} no es de ${señalados[0].dia}` }
      }
    }
  }

  // 3. Dinero. Nunca tenemos el sueldo, así que cualquier cifra con euros es
  //    inventada por definición. Decir "no sé el sueldo" sí se puede: lo que se
  //    prohíbe es la cantidad, no la palabra.
  for (const m of p.matchAll(/(\d[\d.,]*)\s*(€|eur\b|euros\b)|(€)\s*(\d[\d.,]*)/g)) {
    if (!ficha.includes(m[0].trim())) return { ok: false, motivo: `cantidad inventada: ${m[0].trim()}` }
  }

  // 4. Enlaces y correos. Un enlace inventado en un WhatsApp de trabajo es,
  //    para quien lo recibe, indistinguible de una estafa.
  for (const m of p.matchAll(/https?:\/\/[^\s)]+|\bwww\.[^\s)]+/g)) {
    if (!ficha.includes(m[0].replace(/[.,;]+$/, ''))) return { ok: false, motivo: 'enlace inventado' }
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(p)) return { ok: false, motivo: 'correo inventado' }

  // 5. Teléfonos y números largos sueltos.
  for (const m of p.matchAll(/\+?\d[\d\s.()-]{7,}\d/g)) {
    if (!ficha.includes(m[0].trim())) return { ok: false, motivo: 'número inventado' }
  }

  return { ok: true }
}

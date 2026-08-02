// Las frases de la casa: las plantillas de Meta y la RED DE SEGURIDAD del
// agente.
//
// Esto era, hasta agosto de 2026, todo el texto que salía por WhatsApp: el
// agente no podía inventarse nada porque no escribía nada. Ahora escribe la IA
// (ver `interviews/guion.ts`), y esto pasa a ser el suelo:
//
//   * Las plantillas aprobadas por Meta, que son literales por obligación y no
//     las toca ningún modelo.
//   * La frase que sale cuando lo que ha escrito el modelo NO pasa el filtro de
//     hechos, o cuando no hay modelo (sin clave, red caída). Preferimos sonar
//     sosos un mensaje antes que citar a alguien un día que no es.
//
// Reglas de copy de la casa: tuteo, sin guion largo, sentence case, y cero
// urgencia falsa (que en un WhatsApp a alguien que busca trabajo sería
// especialmente feo).

import type { Opcion } from '../channels/types.ts'

export interface Cita {
  starts_at: string
  ends_at: string
}

/** "martes 4 de agosto a las 10:00", en la zona de la entrevista. */
export function fechaLarga(iso: string, tz: string): string {
  return `${diaLargo(iso, tz)} a las ${hora(iso, tz)}`
}

/** "martes, 4 de agosto". Es `fechaLarga` sin la hora, para la agenda. */
export function diaLargo(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(iso))
}

/**
 * El día con las palabras que usa la gente: "mañana, este lunes 3 de agosto",
 * "el lunes que viene, 10 de agosto".
 *
 * Solo lo lee el modelo, nunca sale por WhatsApp. Existe porque el agente no
 * tenía ni idea de qué día es hoy: a "este lunes" contestó "sí, este lunes 10
 * de agosto" cuando ese lunes era el de la semana siguiente y el de verdad
 * estaba en su propia agenda. No es un fallo de listeza, es que le faltaba el
 * dato. Y se calcula aquí, en código, para que no tenga que restar fechas:
 * cuando un modelo hace aritmética de calendario, se equivoca.
 *
 * El corte entre "este" y "que viene" está en los 7 días, no en el domingo:
 * "este lunes" dicho un sábado es el de dentro de dos días, no el de dentro de
 * nueve, y eso vale igual sea cual sea el día de la semana en que se hable.
 */
export function diaConContexto(iso: string, tz: string, ahora: Date): string {
  const largo = diaLargo(iso, tz)                 // "lunes, 3 de agosto"
  const corte = largo.indexOf(', ')
  if (corte < 0) return largo
  const nombre = largo.slice(0, corte)            // "lunes"
  const fecha = largo.slice(corte + 2)            // "3 de agosto"
  const dias = diasCivilesEntre(ahora.toISOString(), iso, tz)

  if (dias === 0) return `hoy, ${nombre} ${fecha}`
  // Hasta seis días vista se nombran las dos maneras. "Mañana" y "este lunes"
  // son el mismo día y le puede decir cualquiera de las dos.
  if (dias === 1) return `mañana, este ${nombre} ${fecha}`
  if (dias === 2) return `pasado mañana, este ${nombre} ${fecha}`
  if (dias <= 6) return `este ${nombre} ${fecha}`
  if (dias <= 13) return `el ${nombre} que viene, ${fecha}`
  return largo
}

/**
 * Días de calendario entre dos instantes, contados en la zona dada.
 *
 * Se comparan las FECHAS civiles, no las horas: de las 23:00 del lunes a la
 * 01:00 del martes hay dos horas y un día. Restar milisegundos daría cero, que
 * es lo que convierte "mañana" en "hoy" a última hora de la tarde.
 */
function diasCivilesEntre(desde: string, hasta: string, tz: string): number {
  const a = Date.parse(`${diaISO(desde, tz)}T00:00:00Z`)
  const b = Date.parse(`${diaISO(hasta, tz)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/**
 * "2026-08-04": el día CIVIL del anfitrión, para meterlo en el id de un botón.
 *
 * `en-CA` da directamente el formato ISO, que es la manera de sacar la fecha
 * local de una zona sin ponerse a restar husos a mano.
 */
export function diaISO(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

/** "jue 6 ago". Cabe en los 20 caracteres de un botón. */
export function diaCorto(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(iso)).replace(/\./g, '').replace(',', '')
}

export function hora(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/** "mar 4 ago, 10:00". Cabe en los 24 caracteres de una fila de lista. */
export function fechaCorta(iso: string, tz: string): string {
  const d = new Date(iso)
  const dia = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
  }).format(d).replace(/\./g, '')
  return `${dia}, ${hora(iso, tz)}`
}

/**
 * Dónde es, en una línea.
 *
 * Devuelve CADENA VACÍA cuando es presencial y no sabemos la dirección, y ese
 * hueco es deliberado. Antes devolvía 'Presencial', que es la respuesta a otra
 * pregunta: dice CÓMO es la entrevista fingiendo decir DÓNDE. Un candidato que
 * lee "Dónde: Presencial" sabe exactamente lo mismo que antes de leerlo, y
 * encima cree que ya se lo hemos dicho. Ahora quien llama tiene que decidir qué
 * hacer con el vacío, que es justo lo que hay que obligar a decidir.
 */
export function donde(mode: string, location: string, meetingUrl: string | null): string {
  if (mode === 'videollamada') return meetingUrl ? `Videollamada: ${meetingUrl}` : 'Por videollamada'
  if (mode === 'telefonica') return 'Te llamamos por teléfono'
  return location.trim()
}

/**
 * Lo mismo, pero garantizando texto. Las variables de una plantilla de Meta no
 * pueden ir vacías (la rechaza entera, con un 132000 que no ve nadie hasta que
 * un candidato se queda sin recordatorio), así que aquí el hueco se rellena
 * diciendo la verdad en vez de con una palabra de relleno.
 */
export function dondeODecirlo(mode: string, location: string, meetingUrl: string | null): string {
  return donde(mode, location, meetingUrl) || 'Te confirmamos la dirección por aquí'
}

/**
 * Enlace de mapa para una dirección escrita a mano. Es el plan B de cuando no
 * hay punto: no pinta el mapa dentro del chat, pero al menos se toca y abre en
 * el Maps del candidato en vez de obligarle a copiar la calle a mano.
 */
export function enlaceMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion.trim())}`
}

// ---------------------------------------------------------------------------
// Plantillas aprobadas por Meta
// ---------------------------------------------------------------------------
// Fuera de la ventana de 24 h esto es lo ÚNICO que se puede mandar. Los nombres
// y el número de variables tienen que coincidir exactamente con lo aprobado en
// el panel de Meta: si no, Meta responde 132000 y no se entera nadie hasta que
// un candidato se queda sin invitación. El texto exacto de cada una está en
// docs/whatsapp-meta.md, que es lo que se copia y pega al darlas de alta.

export const PLANTILLAS = {
  invitacion: 'invitacion_entrevista',
  retomar: 'retomar_eleccion',
  recordatorio: 'recordatorio_entrevista',
  vispera: 'recordatorio_vispera',
  cancelada: 'entrevista_cancelada',
  // Todavía sin usar: la comprobación de interés por WhatsApp. El nombre vive
  // aquí desde que se pide a Meta para que el día que se enchufe no dependa de
  // que alguien lo teclee igual en otro sitio.
  interes: 'interes_sigue_activo',
} as const

export const IDIOMA = 'es'

/**
 * La comprobación de interés. Es la MISMA pregunta que hace el correo
 * (`src/lib/interestEmail.ts`), a propósito: si cada canal la formulara a su
 * manera, las respuestas dejarían de poder compararse entre sí, y la señal de
 * "sigue interesado" valdría distinto según por dónde se preguntó.
 *
 * Esta función la usa el envío Y la pinta el diálogo de la app, que es lo que
 * ve el empresario antes de mandar: la vista previa no es una versión bonita
 * aparte, es el texto que sale.
 */
export function textoInteres(nombre: string, empresa: string, puesto: string): string {
  return `Hola ${nombre}. Te escribimos de ${empresa} por tu candidatura a ` +
    `${puesto}. Estamos revisando los perfiles y queremos saber si sigues ` +
    'interesado/a en el puesto antes de seguir adelante.'
}

/** Los dos botones de la comprobación de interés, en el orden aprobado. */
export function botonesInteres(conversationId: string): string[] {
  return [`c:${conversationId}:i:si`, `c:${conversationId}:i:no`]
}

/**
 * Lo que se le contesta al que pulsa. Preguntar y quedarse callado es lo que
 * enseña a la gente a no contestar la próxima vez.
 *
 * No promete nada que no dependa de nosotros. "Te escriben si siguen adelante"
 * es condicional a propósito: quien decide seguir con un candidato es el
 * empresario, y este mensaje sale antes de que lo haya decidido. Y al que dice
 * que no, no se le dice que queda descartado, porque no lo queda: su estado lo
 * cambia una persona, no un botón.
 */
export function textoAcuseInteres(sigueInteresado: boolean): string {
  return sigueInteresado
    ? 'Gracias, queda anotado. Si el equipo sigue adelante contigo, te escriben por aquí.'
    : 'Gracias por decírnoslo, queda anotado. Mucha suerte con la búsqueda.'
}

/** Los tres botones de la invitación, en el orden en que están aprobados. */
export function botonesInvitacion(conversationId: string): string[] {
  return [
    `c:${conversationId}:ver`,
    `c:${conversationId}:no`,
    `c:${conversationId}:pregunta`,
  ]
}

/**
 * Los dos botones del aviso de la víspera, en el orden aprobado.
 *
 * Las cargas no chocan con las que ya existen: `:s:` y `:d:` llevan dos puntos
 * detrás de la letra, y `:no` no es prefijo de ninguna de estas. Conviene
 * comprobarlo cada vez que se añade una, porque el enrutado son `like` y un
 * choque mandaría al candidato por otro camino sin avisar a nadie.
 */
export function botonesVispera(conversationId: string): string[] {
  return [`c:${conversationId}:ok`, `c:${conversationId}:mover`]
}

// ---------------------------------------------------------------------------
// Mensajes libres (solo dentro de la ventana)
// ---------------------------------------------------------------------------

export function textoHorarios(nombre: string): string {
  return `Estos son los horarios que tenemos, ${nombre}. Elige el que mejor te venga.`
}

/**
 * El primer paso: el DÍA.
 *
 * Se pregunta antes que la hora porque es la decisión que de verdad bloquea
 * ("el martes no puedo, trabajo"), mientras que la hora casi siempre es
 * negociable dentro del día. Juntar las dos en un botón obligaba a aceptar las
 * dos a la vez, y quien tenía bien el día pero mal la hora se quedaba sin forma
 * de decirlo. Pasó de verdad: "me viene bien el martes pero no a esa hora".
 */
export function textoDias(nombre: string): string {
  return `Vamos a buscarte hueco, ${nombre}. ¿Qué día te viene mejor? ` +
    'Luego te paso las horas. Si te encaja otro día, dímelo y lo miro.'
}

/** Las filas del paso del día. El id lleva la fecha dentro: `c:<id>:d:<fecha>`. */
export function filasDias(
  conversationId: string,
  dias: { primero: string; cuantos: number }[],
  tz: string,
): Opcion[] {
  return dias.map((d) => ({
    id: `c:${conversationId}:d:${diaISO(d.primero, tz)}`,
    titulo: diaCorto(d.primero, tz),
    descripcion: d.cuantos === 1 ? '1 hora libre' : `${d.cuantos} horas libres`,
  }))
}

/** Ya ha elegido el día: ahora las horas de ESE día. */
export function textoHorasDelDia(iso: string, tz: string): string {
  return `Estas son las horas que tengo el ${diaLargo(iso, tz)}. Dime cuál te va bien.`
}

/** Ha pedido un día en el que no queda nada. Se dice y se sigue. */
export function textoDiaSinHueco(iso: string, tz: string): string {
  return `El ${diaLargo(iso, tz)} lo tengo completo. Estos son los días que me quedan.`
}

export function textoReoferta(): string {
  return 'Ese horario lo acaban de coger. Estos siguen libres.'
}

/**
 * Las filas de la lista. El id lleva DENTRO la conversación y la posición del
 * hueco, así que al volver no hay que adivinar a qué contestaba: `c:<id>:s:<n>`.
 */
export function filasHorarios(
  conversationId: string,
  citas: Cita[],
  tz: string,
  duracion: number,
): Opcion[] {
  // Cuando le enseñamos las horas de UN día concreto (porque preguntó por él),
  // diez filas diciendo "mié 5 ago, 09:00 / mié 5 ago, 09:30..." desperdician los
  // 24 caracteres del título repitiendo la misma fecha. El día se dice una vez,
  // en la descripción, y el título queda para lo único que cambia: la hora.
  const mismoDia = citas.length > 1
    && citas.every((c) => diaLargo(c.starts_at, tz) === diaLargo(citas[0].starts_at, tz))

  return citas.map((c, i) => ({
    id: `c:${conversationId}:s:${i}`,
    titulo: mismoDia ? hora(c.starts_at, tz) : fechaCorta(c.starts_at, tz),
    descripcion: mismoDia
      ? `${diaLargo(c.starts_at, tz)}, ${duracion} minutos`
      : `${duracion} minutos`,
  }))
}

/**
 * El mensaje de "ya está". Después de la hora, lo único que le falta saber al
 * candidato es a dónde va, así que esa línea no puede faltar nunca ni resolverse
 * con una palabra que no es una dirección.
 *
 * `tienePunto` dice si detrás va el pin del mapa. Si va, la dirección se escribe
 * a secas y ya está: el pin ES el enlace, y pegar además una URL sería decir lo
 * mismo dos veces en dos mensajes seguidos.
 */
export function textoConfirmacion(
  nombre: string, empresa: string, startsAt: string, tz: string,
  mode: string, location: string, meetingUrl: string | null,
  tienePunto = false,
): string {
  const l = [`Hecho, ${nombre}. Tu entrevista con ${empresa} queda el ${fechaLarga(startsAt, tz)}.`]
  const sitio = donde(mode, location, meetingUrl)

  if (mode === 'presencial') {
    if (sitio) {
      l.push(tienePunto ? `Dónde: ${sitio}` : `Dónde: ${sitio}\n${enlaceMapa(sitio)}`)
    } else {
      // Sin dirección no se calla ni se rellena: se dice que falta y cuándo
      // llega. Es lo único honesto, y además deja constancia en el hilo de que
      // la empresa tiene algo pendiente.
      l.push('Es presencial. Te decimos la dirección exacta por aquí antes de la cita.')
    }
  } else if (sitio) {
    l.push(sitio)
  }

  l.push('Si te surge algo y no puedes, escríbenos por aquí y lo cambiamos.')
  return l.join('\n\n')
}

/** Lo que se ve en el hilo cuando además del texto se manda el pin del mapa. */
export function textoUbicacion(direccion: string): string {
  return direccion ? `(ubicación: ${direccion})` : '(ubicación)'
}

export function textoDespedida(empresa: string): string {
  return `Gracias por decírnoslo. No te escribiremos más sobre este puesto de ${empresa}. ` +
    'Mucha suerte con la búsqueda.'
}

/**
 * Lo que el agente contesta cuando le preguntan algo que no sabe: sueldo,
 * contrato, requisitos, lo que sea.
 *
 * Aquí está la promesa entera del producto, y conviene no confundir dos cosas
 * que se parecen: NO INVENTAR no es lo mismo que NO CONTESTAR. El agente
 * contesta siempre, y contesta la verdad: quién es, que ese dato no lo tiene, y
 * cuándo se lo van a resolver. Lo que no hace nunca es rellenar el hueco.
 *
 * Por eso esto no corta la automatización ni deja al candidato esperando: se
 * responde en el momento y la conversación sigue su curso.
 */
export function textoPregunta(empresa: string, startsAt: string | null, tz: string): string {
  const quien = `Soy el asistente de ${empresa} y me encargo solo de cuadrar la entrevista, ` +
    'así que ese dato no lo tengo.'
  return startsAt
    ? `${quien} Te lo resuelven en la entrevista, el ${fechaLarga(startsAt, tz)}.`
    : `${quien} Te lo resuelven en la entrevista, cuando cerremos el día.`
}

/** Cuando quiere cambiar la hora. Se le vuelve a ofrecer, sin drama. */
export function textoReprogramar(): string {
  return 'Sin problema, buscamos otro momento. Estos son los horarios que tenemos ahora.'
}

/** Cuando cancela una entrevista ya cerrada. */
export function textoCancelada(empresa: string): string {
  return `Hecho, he cancelado la entrevista y aviso a ${empresa}. ` +
    'Si más adelante te vuelve a interesar, escríbenos por aquí.'
}

/**
 * Ha pulsado "tengo una duda" en la invitación, así que todavía no sabemos cuál
 * es. Se le abre la puerta y ya está: lo que escriba entra por el camino de
 * conversación como cualquier otro mensaje.
 */
export function textoDuda(): string {
  return 'Claro, dime. Si es algo del puesto que no sepa te lo digo, y si no, te lo resuelven en la entrevista.'
}

/**
 * Un audio, una foto o un documento. No se sabe leer y se dice, que es lo que
 * haría cualquiera. Lo que no se hace es callarse ni fingir que se ha
 * entendido.
 */
export function textoNoLeible(clase: string): string {
  const qué = clase === 'audio' ? 'los audios'
    : clase === 'image' ? 'las fotos'
    : clase === 'document' ? 'los archivos'
    : 'eso'
  return `Perdona, por aquí no puedo abrir ${qué}. ¿Me lo escribes y seguimos?`
}

/**
 * Cuando la conversación pasa a una persona. No promete un plazo que no
 * controlamos, pero tampoco lo deja en el aire: lo que no puede pasar es que
 * el candidato pregunte y no reciba absolutamente nada.
 */
export function textoEspera(): string {
  return 'Te leo. Esto prefiero que te lo confirme alguien del equipo, les aviso y te escriben.'
}

/**
 * El primer mensaje, el que abre la conversación. Sale por plantilla aprobada,
 * así que esto es lo que se ve en el hilo del empresario: tiene que decir
 * EXACTAMENTE lo mismo que el cuerpo dado de alta en Meta.
 *
 * Se presenta como asistente de IA en la primera línea, y no solo cuando se lo
 * preguntan. Lo pide el artículo 50 del Reglamento europeo de IA, en vigor
 * desde el 2 de agosto de 2026: quien habla con una máquina tiene derecho a
 * saberlo sin tener que averiguarlo.
 *
 * Y dice qué es lo automático: la CITA. Sin ese límite, enterarte de que te
 * escribe una máquina se lee como que no han querido dedicarte ni un minuto.
 * Con él se lee como lo que es, un trámite resuelto rápido.
 *
 * Lo que NO dice es quién hace la entrevista. Lo decía ("la harás con una
 * persona del equipo") y se quitó a propósito: es una promesa que caduca sola
 * el día que se automaticen las primeras entrevistas, y nadie se acordaría de
 * volver aquí a corregirla. Cuando ese día llegue, avisar de que al otro lado
 * hay una IA le toca a la propia llamada, no a un mensaje de hace dos semanas.
 */
export function textoInvitacion(nombre: string, empresa: string, puesto: string): string {
  return `Hola ${nombre}. Soy el asistente de IA de ${empresa} y te escribo por tu ` +
    `candidatura a ${puesto}. Me encargo de cuadrar la cita: vamos a buscar un ` +
    'horario que te venga bien.'
}

/**
 * El aviso de la víspera, con sus dos botones. Lo que se ve en el hilo: el
 * mensaje sale por plantilla, porque a un día vista la ventana de 24 h está
 * cerrada casi siempre.
 *
 * No es el mismo mensaje que el de las 2 horas y por eso existen los dos. Este
 * PREGUNTA (sigue en pie o lo movemos) con tiempo de sobra para reorganizar el
 * día; el de un rato antes solo AVISA, cuando ya no da tiempo a nada. Un
 * candidato al que le ha surgido algo puede decirlo aquí en vez de no
 * presentarse, que es de lo que se queja todo el mundo que contrata.
 */
export function textoVispera(
  nombre: string, puesto: string, startsAt: string, tz: string, donde: string,
): string {
  // El sitio va en su propia línea y SIN preposición delante. `dondeODecilo`
  // no siempre devuelve una calle: también "Te llamamos por teléfono" o "Por
  // videollamada", y un "En" delante las deja rotas. Espejo exacto del cuerpo
  // dado de alta en Meta (scripts/whatsapp-templates.mjs), que lo comprueba
  // una prueba: si divergen, el candidato y el hilo dejan de decir lo mismo.
  return `Hola ${nombre}. Mañana es tu entrevista para el puesto de ${puesto}.\n\n` +
    `Queda el ${fechaLarga(startsAt, tz)}.\n${donde}.\n\n` +
    'Dinos si sigue en pie o si prefieres que busquemos otro hueco.'
}

/** Ha pulsado "Ahí estaré". Se le contesta corto y no se le da más la lata. */
export function textoAsistenciaConfirmada(startsAt: string, tz: string): string {
  return `Perfecto, te esperamos el ${fechaLarga(startsAt, tz)}. ` +
    'Si al final te surge algo, escríbenos por aquí.'
}

/** Lo que se ve en el hilo del recordatorio, que sale por plantilla aprobada. */
export function textoRecordatorio(
  nombre: string, puesto: string, startsAt: string, tz: string, donde: string,
): string {
  return `Hola ${nombre}. Te recordamos tu entrevista para el puesto de ${puesto}. ` +
    `Queda el ${fechaLarga(startsAt, tz)}. Dónde: ${donde}.`
}

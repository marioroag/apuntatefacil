// Formato locale ES: fechas dd/mm/aaaa (relativas < 7 días), miles con '.'.

import type { Candidate } from './types'

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function relativeDate(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const diff = now - d.getTime()
  const min = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  if (hours < 24) return `hace ${hours} h`
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  // Absoluta a partir de 7 días
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * LA FECHA DE UNA COLUMNA: "Hoy", "Ayer" y, a partir de ahí, "19 Ago, 2026"
 * (Mario, ago 2026).
 *
 * Es la hermana de `relativeDate` para cuando la fecha va SOLA, en su propia
 * columna, y no metida en una frase. Por eso empieza en mayúscula y por eso no
 * cuenta minutos ni horas: en una lista de candidaturas lo que se compara es el
 * DÍA, y "hace 20 min" contra "hace 3 h" obliga a hacer la cuenta para saber si
 * las dos son de hoy. La hora exacta no se pierde: va en el `title` de la celda y
 * en el `datetime` del `<time>`.
 *
 * `relativeDate` se queda igual y sigue siendo la buena dentro de una frase
 * ("Actualizado hace 2 h", "respondió ayer"): allí una mayúscula en medio se lee
 * como un error, y ahí sí importan los minutos.
 *
 * El día se compara por CALENDARIO y no restando 86.400.000 milisegundos: en el
 * cambio de hora de octubre un día dura 25, y "ayer" se convertiría en "hoy" para
 * todo lo que hubiera entrado por la mañana.
 */
export function fechaCorta(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hoy = new Date(now)
  hoy.setHours(0, 0, 0, 0)
  const suyo = new Date(d)
  suyo.setHours(0, 0, 0, 0)
  if (suyo.getTime() === hoy.getTime()) return 'Hoy'
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)
  if (suyo.getTime() === ayer.getTime()) return 'Ayer'
  // El mes sale de `MESES` y se capitaliza aquí: una sola lista de meses en toda
  // la app, y la mayúscula la pone quien la necesita.
  const mes = MESES[d.getMonth()]
  return `${d.getDate()} ${mes[0].toUpperCase()}${mes.slice(1)}, ${d.getFullYear()}`
}

export function fullDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function fullDateTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${fullDate(iso)} a las ${hh}:${mi}`
}

/** Hora corta HH:mm para meta dentro de burbujas de chat. */
export function clockTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

// ---------------------------------------------------------------------------
// Fechas EN LA ZONA DE LA ENTREVISTA, no en la del navegador.
//
// Todo lo de arriba pinta en la zona local de quien mira, que es lo correcto
// para "hace 2 h" o para cuándo entró una candidatura. Para una entrevista NO:
// una cita a las 10:00 en Las Palmas es a las 10:00 allí, la mire quien la mire.
// Sin librería de fechas (el proyecto no tiene ninguna): Intl basta.
// ---------------------------------------------------------------------------

/** Partes civiles (año, mes, día, hora, minuto) de un instante en una zona. */
function partesEnZona(iso: string, tz: string): Record<string, string> {
  const partes: Record<string, string> = {}
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  for (const p of fmt.formatToParts(new Date(iso))) partes[p.type] = p.value
  // hourCycle h23 devuelve '24' para medianoche en algunos motores.
  if (partes.hour === '24') partes.hour = '00'
  return partes
}

/** Clave de día civil (aaaa-mm-dd) en una zona. Para agrupar la agenda. */
export function dayKeyInZone(iso: string, tz: string): string {
  const p = partesEnZona(iso, tz)
  return `${p.year}-${p.month}-${p.day}`
}

/** Hora HH:mm en la zona de la entrevista. */
export function clockTimeInZone(iso: string, tz: string): string {
  const p = partesEnZona(iso, tz)
  return `${p.hour}:${p.minute}`
}

/** Minutos desde medianoche en la zona de la entrevista. Sitúa el bloque en la rejilla. */
export function minutesInZone(iso: string, tz: string): number {
  const p = partesEnZona(iso, tz)
  return Number(p.hour) * 60 + Number(p.minute)
}

/** Fecha y hora completas en la zona de la entrevista. */
export function fullDateTimeInZone(iso: string, tz: string): string {
  const p = partesEnZona(iso, tz)
  return `${p.day}/${p.month}/${p.year} a las ${p.hour}:${p.minute}`
}

/** Etiqueta corta para una cabecera de día: "Hoy", "Mañana" o "mar 12 sep". */
export function dayLabelInZone(iso: string, tz: string, now = Date.now()): string {
  const clave = dayKeyInZone(iso, tz)
  const hoy = dayKeyInZone(new Date(now).toISOString(), tz)
  if (clave === hoy) return 'Hoy'
  const manana = dayKeyInZone(new Date(now + 86400000).toISOString(), tz)
  if (clave === manana) return 'Mañana'
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(iso))
  // Intl mete puntos y comas según motor ("mar., 12 sept"): se normaliza.
  return dia.replace(/\./g, '').replace(/,/g, '')
}

/** Etiqueta corta para el botón de la ficha: "mar 12, 10:00". */
export function shortWhenInZone(iso: string, tz: string): string {
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'short', day: 'numeric' })
    .format(new Date(iso))
    .replace(/\./g, '')
    .replace(/,/g, '')
  return `${dia}, ${clockTimeInZone(iso, tz)}`
}

export function miles(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}

// Teléfono SOLO para mostrar: agrupa los dígitos de 3 en 3 (XXX XXX XXX) aunque
// el candidato los escriba pegados. Reconoce el prefijo español (+34 / 0034, con
// o sin espacio) y formatea los 9 dígitos nacionales; otro prefijo internacional
// conserva el '+'. NO usar para enlaces tel:/wa.me, que quieren los dígitos crudos.
export function formatPhone(raw: string): string {
  if (!raw) return raw
  const trimmed = raw.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  let prefix = ''
  if (digits.length === 11 && digits.startsWith('34')) {
    prefix = '+34 '
    digits = digits.slice(2)
  } else if (digits.length === 13 && digits.startsWith('0034')) {
    prefix = '+34 '
    digits = digits.slice(4)
  } else if (trimmed.startsWith('+')) {
    prefix = '+' // otro país: conserva el '+' y agrupa el resto
  }
  return prefix + (digits.match(/\d{1,3}/g) ?? []).join(' ')
}

// Partículas de apellidos españoles que van en minúscula salvo al inicio del nombre
// ("Juan de la Torre", pero "De la Torre" si es lo primero que se muestra).
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

// Capitaliza cada palabra (primera letra mayúscula, resto minúscula) respetando
// guiones y apóstrofes ("maria-jose" -> "Maria-Jose", "o'connor" -> "O'Connor").
// El candidato puede escribir su nombre en cualquier caja (todo minúsculas, todo
// mayúsculas...); se muestra siempre bien capitalizado.
export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && PARTICULAS.has(word)) return word
      return word.replace(/(^|[-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase())
    })
    .join(' ')
}

// Nombre a mostrar del candidato. Combina el campo base 'nombre' con 'apellidos'
// cuando el formulario los pide por separado; si no hay 'apellidos', devuelve solo
// el nombre. Compatible con candidaturas antiguas (sin 'apellidos'). Se capitaliza
// siempre, aunque el candidato lo haya escrito en minúsculas o en mayúsculas.
/**
 * Los campos del formulario cuyo valor el producto YA pinta por su cuenta, así
 * que repetirlos como una respuesta más es el mismo dato dos veces: el nombre
 * es el título de la ficha y el encabezado de su fila, y el teléfono tiene
 * columna propia en la tabla y apartado propio en la ficha.
 *
 * Vive aquí, junto a `candidateName`, porque este es el módulo que sabe de qué
 * campos sale la identidad de una persona. Estaba escrito a mano en la tabla y
 * lo pide ahora también la ficha: dos listas de la misma verdad se separan al
 * primer formulario nuevo.
 */
export const CAMPOS_YA_PINTADOS = ['nombre', 'apellidos', 'telefono']

/**
 * Una respuesta del formulario, como TEXTO. Vive aquí y no en una pantalla
 * porque la pintan dos superficies que no se hablan (la celda de la tabla y la
 * línea de la tarjeta del tablero), y dos copias de la misma verdad se separan
 * al primer retoque.
 */
export function answerStr(c: { answers: Record<string, unknown> }, fieldId: string): string {
  const v = c.answers[fieldId]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

export function candidateName(c: Candidate): string {
  const part = (id: string) => {
    const v = c.answers[id]
    return typeof v === 'string' ? v.trim() : ''
  }
  const raw = [part('nombre'), part('apellidos')].filter(Boolean).join(' ')
  return raw ? toTitleCase(raw) : raw
}

/**
 * Cómo se llama una persona del equipo cuando solo tenemos su email. No hay
 * tabla de perfiles: la identidad se deriva del correo en toda la app (hilos del
 * tablón, chat del candidato, lista de miembros), así que la regla vive aquí y
 * no repetida en cada pantalla. 'laura.gil@empresa.es' -> 'Laura Gil'.
 */
export function personLabel(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0]?.trim()
  if (!local) return 'Alguien del equipo'
  return toTitleCase(local.replace(/[._-]+/g, ' '))
}

/**
 * Texto de una respuesta del formulario. Un dato que el candidato no dio se dice
 * "No disponible", nunca en blanco: en una ficha, el hueco vacío se lee como un
 * fallo de la app y no como una pregunta sin contestar.
 */
export function answerText(v: Candidate['answers'][string] | undefined): string {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return 'No disponible'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/**
 * La letra de una cara. **UNA sola, al estilo Gmail** (Mario, ago 2026; antes eran
 * dos, "MR").
 *
 * Una letra se lee de un vistazo a cualquier tamaño; dos hay que descifrarlas, y a
 * 20px (el avatar del hilo del tablón) ya no caben legibles. No se pierde nada
 * porque **la cara nunca informa sola**: el nombre va siempre escrito al lado, y
 * quien mira una lista distingue por la posición y el color, no por leer siglas.
 *
 * Se queda con la primera letra del nombre, no con la del apellido: es por la que
 * la gente busca y por la que ordenan las listas.
 */
export function initials(name: string): string {
  const limpio = name.trim()
  if (!limpio) return '?'
  return limpio[0].toUpperCase()
}

/**
 * COLOR ESTABLE POR MIEMBRO DEL EQUIPO (semilla: su email o su id).
 * Misma semilla → mismo tono en el tablón, en el hilo, en la lista de miembros y
 * en la agenda. Paleta fija, sin el ultramarine de marca (ese va solo a acción).
 *
 * **UNA ENTRADA SIRVE A DOS SUPERFICIES, y por eso trae cuatro clases.** `bg` +
 * `text` pintan el DISCO de la cara (tono oscuro, inicial en blanco); `suave` +
 * `canto` pintan un RELLENO CLARO del mismo hue, que es lo que necesita el bloque
 * de una cita en el calendario (ago 2026). Es el mismo reparto que ya hace
 * `STATUS_META`: un hue, dos pesos según dónde se pinte. Lo que NO puede pasar es
 * que sean dos tablas: el filtro de anfitrión de la agenda pinta las caras justo
 * encima de la rejilla, así que las caras SON la leyenda de los bloques, y dos
 * listas de la misma verdad se separan al primer retoque.
 *
 * **EL GRAFITO SALIÓ DE LA TABLA al entrar la segunda superficie.** Era el único
 * que no era un color de identidad sino el NEUTRO de la app, el mismo gris con el
 * que se dice "esto está apagado", y en un calendario ese gris ya significa algo:
 * es el relleno de una cita caída, o sea un hueco libre otra vez. Como cara
 * pasaba desapercibido; como bloque haría que las citas vivas de una persona se
 * leyeran como canceladas. En su sitio va lima, que es el único hue distinto que
 * quedaba libre (fuera el rojo y el rosa por reservados, el azul y el índigo por
 * vecinos de la marca, y el resto por ser el mismo color que otra entrada).
 * Cuesta que quien hoy tiene la cara en grafito la vea cambiar: el color no está
 * guardado en ninguna parte, sale del hash, así que es solo eso, un repinte.
 *
 * El rosa SÍ se queda, y no contradice al "fuera el rojo y el rosa" de las
 * etiquetas: aquella regla es para un chip suelto en una tabla gris, donde el
 * rosa se lee como un problema. Aquí TODOS los bloques van teñidos, así que uno
 * rosa es otra persona más y no una alarma.
 *
 * **ESTA TABLA ES DEL EQUIPO Y NO DE LOS CANDIDATOS** (sep 2026). La silueta con
 * volumen de un candidato tiene su propia rueda, mucho más ancha, porque no le
 * debe nada a ninguna otra superficie: ver `siluetaHue` más abajo. Aquí las diez
 * entradas están limitadas por lo que sí tienen que hacer, que es existir también
 * como clases de Tailwind para teñir un bloque del calendario.
 */
const MEMBER_AVATAR_TONES = [
  { bg: 'bg-lime-700', text: 'text-white', name: 'text-lime-700', suave: 'bg-lime-100', canto: 'ring-lime-200' },
  { bg: 'bg-sky-700', text: 'text-white', name: 'text-sky-700', suave: 'bg-sky-100', canto: 'ring-sky-200' },
  { bg: 'bg-teal-700', text: 'text-white', name: 'text-teal-700', suave: 'bg-teal-100', canto: 'ring-teal-200' },
  { bg: 'bg-violet-700', text: 'text-white', name: 'text-violet-700', suave: 'bg-violet-100', canto: 'ring-violet-200' },
  { bg: 'bg-amber-700', text: 'text-white', name: 'text-amber-800', suave: 'bg-amber-100', canto: 'ring-amber-200' },
  { bg: 'bg-rose-700', text: 'text-white', name: 'text-rose-700', suave: 'bg-rose-100', canto: 'ring-rose-200' },
  { bg: 'bg-emerald-700', text: 'text-white', name: 'text-emerald-700', suave: 'bg-emerald-100', canto: 'ring-emerald-200' },
  { bg: 'bg-orange-700', text: 'text-white', name: 'text-orange-700', suave: 'bg-orange-100', canto: 'ring-orange-200' },
  { bg: 'bg-cyan-800', text: 'text-white', name: 'text-cyan-800', suave: 'bg-cyan-100', canto: 'ring-cyan-200' },
  { bg: 'bg-fuchsia-800', text: 'text-white', name: 'text-fuchsia-800', suave: 'bg-fuchsia-100', canto: 'ring-fuchsia-200' },
] as const

/** Lo que un tono de miembro sabe pintar: la cara (bg/text/name) y un relleno claro. */
export type MemberTone = (typeof MEMBER_AVATAR_TONES)[number]

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function memberAvatarTone(seed: string | null | undefined): MemberTone {
  const key = (seed ?? '').trim().toLowerCase()
  if (!key) return MEMBER_AVATAR_TONES[0]
  return MEMBER_AVATAR_TONES[hashSeed(key) % MEMBER_AVATAR_TONES.length]
}

/**
 * EL TONO DE UN CANDIDATO: UNA RUEDA DE 79, NO LAS DIEZ DEL EQUIPO (Mario, sep
 * 2026: "¿podríamos tener más variedad de colores?").
 *
 * **Puede ser mucho más ancha porque no le debe nada a nadie.** La tabla de
 * arriba tiene diez entradas por un motivo que aquí no existe: cada una tiene que
 * ser además una clase de Tailwind, porque el mismo tono tiñe el bloque de una
 * cita en el calendario. El color de un candidato tiene UN solo consumidor, su
 * silueta, que se pinta con degradados dentro de un SVG. Con diez tonos, una
 * lista de seiscientas personas repetía color cada seis filas.
 *
 * **VA EN OKLCH Y NO EN HSL, y no es preciosismo.** En HSL la misma luminosidad
 * pesa distinto según el hue (un amarillo al 72% deslumbra y un azul al 72% se
 * queda a media luz), así que una rueda entera saldría con unas caras lavadas y
 * otras plomizas. En OKLCH la L es perceptual: se fija una vez y las 79 salen con
 * el mismo peso. Es la escala en la que ya están las rampas de Tailwind v4.
 *
 * **LOS ARCOS VETADOS ESTÁN MEDIDOS EN OKLCH, y esa es la parte que se olvida:**
 * el ultramarine de marca está en el hue **270** y el rojo de error en el **27**,
 * mientras que en HSL esos mismos colores caen en 232 y en 0. Un veto escrito con
 * los números de HSL habría dejado pasar avatares del color de la marca creyendo
 * que los estaba prohibiendo (pasó, y lo cazó medirlo antes de aplicarlo). Fuera,
 * entonces, 252-290 y 20-35. Los extremos se afinaron con el guardián delante:
 * el arco frío empezaba en 288 y eso deja el primer tono a 17,9 grados del
 * ultramarine, o sea dentro del margen que la propia prueba exige. Su guardián lee el
 * acento de `colors.ts` y vuelve a hacer la cuenta, así que el día que la marca
 * cambie de color la prueba avisa de que la rueda se le ha metido dentro.
 *
 * **CADA ARCO SE MUESTREA A SU PASO, y esto se cazó en pantalla.** Con un paso
 * único de 4 grados, las primeras doce filas de la lista salían casi todas entre
 * el 90 y el 175, o sea verdes y turquesas, y no era mala suerte: **en OKLCH esa
 * familia sola ocupa unos 90 grados del círculo**, casi un tercio de lo que
 * queda tras los vetos, mientras que los azules o los naranjas caben en la mitad.
 * Un muestreo uniforme en GRADOS no es un muestreo uniforme en COLORES. La banda
 * verde va a 7 grados de paso y el resto a 4, así que las familias salen
 * repartidas y no proporcionales a su trozo de rueda. Por debajo de 4 grados dos
 * tonos vecinos ya no se distinguen y la variedad sería solo aritmética.
 */
const SILUETA_ARCOS = [
  [35, 110, 4], // naranjas, ámbares y olivas
  [110, 200, 7], // verdes y turquesas: la familia más ancha, muestreada más suelta
  [200, 252, 4], // azules, hasta donde empieza el veto de la marca
  [290, 380, 4], // violetas, magentas y rosas (cruza el 360)
] as const
export const SILUETA_TONOS: readonly number[] = SILUETA_ARCOS.flatMap(([desde, hasta, paso]) => {
  const tramo: number[] = []
  for (let h = desde; h < hasta; h += paso) tramo.push(h % 360)
  return tramo
})

/** El hue OKLCH de una persona. Misma semilla, mismo color, siempre. */
export function siluetaHue(seed: string | null | undefined): number {
  const key = (seed ?? '').trim().toLowerCase()
  if (!key) return SILUETA_TONOS[0]
  return SILUETA_TONOS[hashSeed(key) % SILUETA_TONOS.length]
}

/**
 * TONO DE UNA ETIQUETA. El color que la hace reconocible de un vistazo.
 *
 * **La semilla es el ID, nunca el nombre.** Renombrar "Recontactar" a "Volver a
 * llamar" tiene que dejar la etiqueta del mismo color: es la misma etiqueta. Con
 * el nombre de semilla, cada corrección de una errata repintaría la columna.
 *
 * **Y por eso no hay columna `color` en la base de datos.** El color sale del id,
 * así que no hay migración, ni relleno de las etiquetas que ya existen, ni riesgo
 * de que dos clientes pinten distinto lo mismo. Si algún día se quiere ELEGIR el
 * color, se añade una columna que pise a esta, no que la sustituya.
 *
 * **Un hash a secas NO vale, y esto se vio en pantalla.** Con 8 tonos y 6
 * etiquetas, la probabilidad de que dos caigan en el mismo es del 78% (es el
 * problema del cumpleaños), y en la demo pasó a la primera: "Cerca de la obra" y
 * "Documentación OK" salieron del mismo azul, juntas en la misma fila. Dos
 * etiquetas del mismo color no son reconocibles de un vistazo, que es lo único
 * para lo que existe el color. Así que el hash PROPONE y el reparto DISPONE: si el
 * tono preferido está cogido, se avanza al siguiente libre. Con 8 o menos
 * etiquetas quedan todas distintas; a partir de ahí se repite, que es inevitable.
 *
 * El reparto se hace sobre el vocabulario entero ordenado por ID (no por nombre,
 * que cambia). Crear una etiqueta puede, en el peor caso, mover el tono de UNA
 * vecina; se prefirió eso a un choque permanente.
 *
 * Las clases van escritas ENTERAS, nunca compuestas (`bg-${color}-100`): Tailwind
 * lee el código fuente como texto y una clase que solo existe al ejecutarse no
 * llega nunca al CSS compilado. Es el mismo fallo que dejó al `<select>` sin
 * flecha.
 *
 * Fuera de la paleta a propósito: **el rojo y el rosa**, porque el rojo está
 * reservado a errores y acciones destructivas y una etiqueta rosa se leería como
 * un problema; y el **ultramarine de marca**, que es acción. El resto de tonos SÍ
 * coinciden con los de los estados (ámbar es "entrevista", verde "contratado"), y
 * no chocan porque se distinguen por FORMA: un estado es siempre una cápsula
 * redonda con punto y palabra, una etiqueta es siempre un rectángulo de 4px sin
 * punto. Es la misma salida que ya resolvió la estrella dorada contra el ámbar.
 *
 * El orden del array no es alfabético ni casual: **tonos consecutivos son hues muy
 * separados**, porque avanzar al siguiente libre es justo lo que hace el reparto
 * al resolver un choque. Así el desempate cae en un color que no se parece.
 */
const TAG_TONES = [
  { bg: 'bg-sky-100', text: 'text-sky-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' },
  { bg: 'bg-lime-100', text: 'text-lime-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-orange-100', text: 'text-orange-800' },
] as const

export type TagTone = { bg: string; text: string }

/**
 * Reparte tonos sobre TODO el vocabulario, sin choques mientras haya tonos libres.
 * Puro: mismas etiquetas, mismo reparto, en cualquier dispositivo.
 */
function repartirTonos(ids: readonly string[]): Map<string, TagTone> {
  const asignado = new Map<string, TagTone>()
  const cogidos = new Set<number>()
  // Por id: es lo único que no cambia cuando el usuario edita sus etiquetas.
  for (const id of [...ids].sort()) {
    const preferido = hashSeed(id.trim().toLowerCase()) % TAG_TONES.length
    let i = preferido
    // Si la vuelta entera está cogida (más etiquetas que tonos), se queda el
    // preferido y se repite: mejor un choque honesto que dejar una sin color.
    for (let paso = 0; paso < TAG_TONES.length && cogidos.has(i); paso++) {
      i = (i + 1) % TAG_TONES.length
    }
    cogidos.add(i)
    asignado.set(id, TAG_TONES[i])
  }
  return asignado
}

// Memoria de un solo hueco: el vocabulario de una empresa cambia muy de vez en
// cuando, pero `tagTone` se llama una vez por chip y hay cientos en una tabla.
// La clave es la lista de ids, así que cualquier alta o baja lo recalcula solo.
let tonosClave = ''
let tonosCache = new Map<string, TagTone>()

/**
 * El tono de una etiqueta dentro de su vocabulario. Sin vocabulario (un chip
 * suelto, una vista previa) cae al hash pelado, que es lo mejor que se puede hacer
 * sin saber contra quién compite.
 */
export function tagTone(id: string | null | undefined, vocabulario?: readonly { id: string }[]): TagTone {
  const key = (id ?? '').trim().toLowerCase()
  if (!key) return TAG_TONES[0]
  if (!vocabulario) return TAG_TONES[hashSeed(key) % TAG_TONES.length]
  const clave = vocabulario.map((t) => t.id).join('|')
  if (clave !== tonosClave) {
    tonosClave = clave
    tonosCache = repartirTonos(vocabulario.map((t) => t.id))
  }
  return tonosCache.get(id ?? '') ?? TAG_TONES[hashSeed(key) % TAG_TONES.length]
}

/** Candidato en estado "nuevo" recibido en las últimas 48 h (prioridad de contacto). */
export function isFreshNuevo(c: Pick<Candidate, 'status' | 'submittedAt'>, now = Date.now()): boolean {
  if (c.status !== 'nuevo') return false
  return now - new Date(c.submittedAt).getTime() < 48 * 60 * 60 * 1000
}

// Pluralización mínima en español
export function plural(n: number, singular: string, plural: string): string {
  return `${miles(n)} ${n === 1 ? singular : plural}`
}

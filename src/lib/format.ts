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
 * Color estable por miembro del equipo (email o id).
 * Misma semilla → mismo tono en tablón, hilo y lista de miembros.
 * Paleta fija, sin el ultramarine de marca (ese va solo a acción).
 */
const MEMBER_AVATAR_TONES = [
  { bg: 'bg-slate-800', text: 'text-white', name: 'text-slate-800' },
  { bg: 'bg-sky-700', text: 'text-white', name: 'text-sky-700' },
  { bg: 'bg-teal-700', text: 'text-white', name: 'text-teal-700' },
  { bg: 'bg-violet-700', text: 'text-white', name: 'text-violet-700' },
  { bg: 'bg-amber-700', text: 'text-white', name: 'text-amber-800' },
  { bg: 'bg-rose-700', text: 'text-white', name: 'text-rose-700' },
  { bg: 'bg-emerald-700', text: 'text-white', name: 'text-emerald-700' },
  { bg: 'bg-orange-700', text: 'text-white', name: 'text-orange-700' },
  { bg: 'bg-cyan-800', text: 'text-white', name: 'text-cyan-800' },
  { bg: 'bg-fuchsia-800', text: 'text-white', name: 'text-fuchsia-800' },
] as const

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function memberAvatarTone(seed: string | null | undefined): {
  bg: string
  text: string
  name: string
} {
  const key = (seed ?? '').trim().toLowerCase()
  if (!key) return MEMBER_AVATAR_TONES[0]
  return MEMBER_AVATAR_TONES[hashSeed(key) % MEMBER_AVATAR_TONES.length]
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

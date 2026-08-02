// Lógica pura del calendario de la agenda: semanas, franja horaria y solapes.
// Sin IO y sin React (como interviews.ts), para poder probarla sola.
//
// La aritmética de días se hace sobre claves civiles (aaaa-mm-dd) a MEDIODÍA
// UTC: sumar 24 horas sobre las 00:00 se come un día entero cuando entra o sale
// el horario de verano, y la semana saldría corrida.

import type { Interview } from './types'
import { dayKeyInZone, minutesInZone, MESES } from './format'

/** Duración cuando la entrevista no trae fin. La misma que Ajustes > Calendario. */
export const DURACION_POR_DEFECTO = 30

/** Franja que se pinta siempre, aunque no haya nada: la jornada reconocible. */
export const FRANJA_MINIMA = { desde: 8, hasta: 20 }

const DIA_MS = 86400000
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const aFecha = (clave: string) => new Date(`${clave}T12:00:00.000Z`)
const aClave = (d: Date) => d.toISOString().slice(0, 10)

export function sumarDias(clave: string, dias: number): string {
  return aClave(new Date(aFecha(clave).getTime() + dias * DIA_MS))
}

export interface PartesClave {
  dia: number
  /** Índice 0-11, para indexar MESES. */
  mes: number
  anio: number
  /** 0 = domingo, como getDay(). */
  dow: number
  diaCorto: string
  diaLargo: string
}

export function partesClave(clave: string): PartesClave {
  const d = aFecha(clave)
  const dow = d.getUTCDay()
  return {
    dia: d.getUTCDate(),
    mes: d.getUTCMonth(),
    anio: d.getUTCFullYear(),
    dow,
    diaCorto: DIAS_CORTOS[dow],
    diaLargo: DIAS_LARGOS[dow],
  }
}

/** Lunes de esa semana. En España la semana empieza en lunes, no en domingo. */
export function lunesDe(clave: string): string {
  const dow = partesClave(clave).dow
  return sumarDias(clave, dow === 0 ? -6 : 1 - dow)
}

/** Los siete días de la semana a la que pertenece la clave, de lunes a domingo. */
export function semanaDe(clave: string): string[] {
  const lunes = lunesDe(clave)
  return [0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(lunes, i))
}

/** Hoy, en la zona de quien mira (la del navegador salvo que se pase otra). */
export function claveDeHoy(tz = Intl.DateTimeFormat().resolvedOptions().timeZone, now = Date.now()): string {
  return dayKeyInZone(new Date(now).toISOString(), tz)
}

export interface Bloque {
  entrevista: Interview
  /** Minutos desde medianoche, en la zona de la entrevista. */
  desde: number
  hasta: number
  /** Columna dentro del grupo de solapadas, y cuántas hay. */
  columna: number
  columnas: number
}

/**
 * Las entrevistas de un día, ya colocadas.
 *
 * El día es el CIVIL de cada entrevista en SU zona, igual que en la lista: una
 * cita a las 10:00 en Las Palmas se pinta a las 10:00, la mire quien la mire.
 * Trasladarla a la zona del navegador movería el bloque a una hora que no es la
 * que dice su propia etiqueta.
 */
export function bloquesDelDia(lista: Interview[], dia: string): Bloque[] {
  const bloques: Bloque[] = []
  for (const entrevista of lista) {
    const inicio = entrevista.startsAt
    if (!inicio || dayKeyInZone(inicio, entrevista.timezone) !== dia) continue
    const desde = minutesInZone(inicio, entrevista.timezone)
    const fin = entrevista.endsAt ? minutesInZone(entrevista.endsAt, entrevista.timezone) : 0
    // Un fin que no va por delante del inicio (cruza la medianoche, o está mal
    // guardado) no puede dar un bloque de altura cero ni negativa.
    const hasta = Math.min(fin > desde ? fin : desde + DURACION_POR_DEFECTO, 24 * 60)
    bloques.push({ entrevista, desde, hasta, columna: 0, columnas: 1 })
  }
  bloques.sort((a, b) => a.desde - b.desde || a.hasta - b.hasta || a.entrevista.id.localeCompare(b.entrevista.id))
  repartirColumnas(bloques)
  return bloques
}

/**
 * Reparte en columnas las que se pisan. Dos entrevistas a la misma hora existen
 * (dos encargados entrevistando a la vez) y una encima de otra escondería una.
 * Se agrupan en cadena: A pisa a B y B pisa a C reparte las tres, aunque A y C
 * no se toquen, para que las tres tengan el mismo ancho.
 */
function repartirColumnas(bloques: Bloque[]): void {
  let grupo: Bloque[] = []
  let finGrupo = -1
  const cerrar = () => {
    const columnas = grupo.reduce((max, b) => Math.max(max, b.columna + 1), 1)
    for (const b of grupo) b.columnas = columnas
    grupo = []
  }
  for (const b of bloques) {
    if (grupo.length && b.desde >= finGrupo) cerrar()
    const ocupadas = new Set(grupo.filter((o) => o.hasta > b.desde).map((o) => o.columna))
    let columna = 0
    while (ocupadas.has(columna)) columna++
    b.columna = columna
    finGrupo = grupo.length ? Math.max(finGrupo, b.hasta) : b.hasta
    grupo.push(b)
  }
  if (grupo.length) cerrar()
}

/**
 * Qué horas se pintan. Siempre la jornada de referencia, estirada hasta cubrir
 * lo que haya: una cita a las 7:00 no puede quedarse fuera de la rejilla.
 */
export function franja(bloques: Bloque[], minima = FRANJA_MINIMA): { desde: number; hasta: number } {
  let desde = minima.desde * 60
  let hasta = minima.hasta * 60
  for (const b of bloques) {
    desde = Math.min(desde, Math.floor(b.desde / 60) * 60)
    hasta = Math.max(hasta, Math.ceil(b.hasta / 60) * 60)
  }
  return { desde, hasta: Math.max(hasta, desde + 60) }
}

/**
 * El primer día CON entrevista a partir de una clave (incluida). Es lo que
 * evita la semana vacía y el "siguiente" pulsado seis veces para encontrar la
 * única cita del mes.
 */
export function proximoDiaCon(lista: Interview[], desde: string): string | null {
  let mejor: string | null = null
  for (const i of lista) {
    if (!i.startsAt) continue
    const clave = dayKeyInZone(i.startsAt, i.timezone)
    if (clave < desde) continue
    if (!mejor || clave < mejor) mejor = clave
  }
  return mejor
}

/** El último día CON entrevista antes de una clave, para el salto hacia atrás. */
export function anteriorDiaCon(lista: Interview[], antes: string): string | null {
  let mejor: string | null = null
  for (const i of lista) {
    if (!i.startsAt) continue
    const clave = dayKeyInZone(i.startsAt, i.timezone)
    if (clave >= antes) continue
    if (!mejor || clave > mejor) mejor = clave
  }
  return mejor
}

/**
 * El rótulo del tramo que se está mirando. Sin guion largo y sin repetir lo que
 * ya se sabe: el mes y el año solo se dicen dos veces cuando el tramo los cruza.
 */
export function rotuloRango(dias: string[], hoy?: string): string {
  const a = partesClave(dias[0])
  const b = partesClave(dias[dias.length - 1])
  if (dias.length === 1) {
    const fecha = `${a.diaLargo} ${a.dia} ${MESES[a.mes]} ${a.anio}`
    if (hoy === dias[0]) return `Hoy, ${fecha}`
    return fecha.charAt(0).toUpperCase() + fecha.slice(1)
  }
  if (a.anio !== b.anio) return `${a.dia} ${MESES[a.mes]} ${a.anio} - ${b.dia} ${MESES[b.mes]} ${b.anio}`
  if (a.mes !== b.mes) return `${a.dia} ${MESES[a.mes]} - ${b.dia} ${MESES[b.mes]} ${a.anio}`
  return `${a.dia}-${b.dia} ${MESES[a.mes]} ${a.anio}`
}

/** "10:00" a partir de minutos desde medianoche. Para las horas de la rejilla. */
export function reloj(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

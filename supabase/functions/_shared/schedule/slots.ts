// Generación de huecos de entrevista. Dominio puro: sin IO, sin base de datos
// y sin red, para poder probarlo entero. Quien lo llama le pasa YA resueltos el
// ocupado del calendario externo y las entrevistas confirmadas.
//
// Vive en el servidor y no en `src/` porque los huecos dependen del freebusy
// del calendario del anfitrión y de las entrevistas de TODOS los anfitriones, y
// ninguna de las dos cosas es accesible desde el navegador sin abrir la RLS o
// exponer credenciales. El navegador pinta lo que el servidor propone.

import { diaSemana, fechaCivilDe, masDias, paredAUtc, type FechaCivil } from './zone.ts'

export interface ReglaDisponibilidad {
  /** 0 = domingo, 6 = sábado. */
  weekday: number
  /** Minutos desde medianoche, hora local del anfitrión. */
  startMin: number
  endMin: number
}

export interface Ocupado {
  start: Date
  end: Date
}

export interface Hueco {
  starts_at: string // ISO UTC
  ends_at: string
}

export interface ConfigHuecos {
  ahora: Date
  tz: string
  reglas: ReglaDisponibilidad[]
  durMin: number
  bufferMin: number
  granularidadMin: number
  minNoticeHoras: number
  horizonteDias: number
  /** Cuántos huecos se PROPONEN de cada día. No es un tope de entrevistas. */
  maxPorDia: number
  ocupado: Ocupado[]
  /** Guardia de memoria de la agenda completa. Nada que ver con maxPorDia. */
  maxAgenda?: number
}

/**
 * Varios tramos ocupados, en uno por bloque continuo.
 *
 * Fundir no es cosmético. Lo ocupado llega de dos sitios (nuestras entrevistas
 * y el calendario del anfitrión) y el segundo trae un tramo POR EVENTO, así que
 * una mañana con seis reuniones seguidas son seis intervalos que se tocan, y
 * `generarAgenda` los compara uno a uno contra cada hueco candidato. Fundidos
 * son uno: se descarta lo mismo, pero la cuenta deja de crecer con la agenda de
 * nadie.
 *
 * Y tira lo ilegible en vez de dejarlo pasar. Un intervalo con NaN dentro no
 * choca con NADA, así que colarlo no deja un hueco raro: deja un hueco OCUPADO
 * ofrecido como libre, que es el fallo que acaba con dos personas presentándose
 * a la vez.
 */
export function fundirOcupado(tramos: Ocupado[]): Ocupado[] {
  const buenos = tramos
    .filter((t) => Number.isFinite(t.start.getTime()) && Number.isFinite(t.end.getTime()) && t.end > t.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const out: Ocupado[] = []
  for (const t of buenos) {
    const ultimo = out[out.length - 1]
    // `<=` y no `<`: dos tramos que se TOCAN (10:00-11:00 y 11:00-12:00) son un
    // solo bloque ocupado, aunque no se solapen.
    if (ultimo && t.start.getTime() <= ultimo.end.getTime()) {
      if (t.end > ultimo.end) ultimo.end = t.end
    } else {
      // Copia: fundir no puede reescribir lo que le pasan.
      out.push({ start: new Date(t.start), end: new Date(t.end) })
    }
  }
  return out
}

/** Un día del anfitrión con todo lo que tiene libre. */
export interface DiaHuecos {
  /** Día civil del ANFITRIÓN, no el de UTC ni el del navegador. */
  fecha: FechaCivil
  huecos: Hueco[]
}

/**
 * n de m, repartidos por igual y con los dos extremos dentro.
 *
 * Se usa en dos sitios que son la misma pregunta: enseñarle `maxPorDia` horas
 * del día que ha elegido, y recortar un día muy largo para el prompt. En los
 * dos, la respuesta correcta es "enséñame estas n BIEN REPARTIDAS", nunca "las
 * n primeras" (que es lo que hacía antes, y por eso no existían las tardes).
 */
export function repartir<T>(xs: T[], n: number): T[] {
  if (n <= 0) return []
  if (xs.length <= n) return xs
  // Con uno solo, el más pronto: es el que más vale y el que menos se cae.
  if (n === 1) return [xs[0]]
  const out: T[] = []
  // El paso (m-1)/(n-1) es > 1 siempre que m > n, así que los índices salen
  // estrictamente crecientes y no hay que deduplicar.
  for (let i = 0; i < n; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (n - 1))])
  return out
}

/**
 * LA AGENDA DE VERDAD: todos los huecos libres del horizonte, por día.
 *
 * `maxPorDia` NO se aplica aquí, y es el cambio importante de este fichero. Lo
 * que el anfitrión tiene libre y lo que le proponemos a un candidato son dos
 * cosas distintas, y confundirlas costó caro: el agente le decía a un candidato
 * "no tengo hueco el miércoles por la tarde" y era cierto sobre una agenda
 * falsa, porque el generador cortaba el día al llegar al tope y las tardes no
 * llegaban a existir.
 *
 * Tres detalles que se rompen si te descuidas:
 *   1. Avanzar de día con masDias(), no sumando 24 h en milisegundos.
 *   2. El fin del hueco es inicio + duración, que es tiempo TRANSCURRIDO y por
 *      tanto correcto también el día del cambio de hora.
 *   3. El buffer se aplica a los dos lados al comparar con lo ocupado. Es la
 *      misma cuenta que hace la constraint de exclusión de la base: aquí evita
 *      OFRECER un hueco malo, y allí impide RESERVARLO. Doble red, a propósito.
 */
export function generarAgenda(cfg: ConfigHuecos): DiaHuecos[] {
  const desde = new Date(cfg.ahora.getTime() + cfg.minNoticeHoras * 3600_000)
  const hasta = new Date(cfg.ahora.getTime() + cfg.horizonteDias * 86_400_000)
  const tope = cfg.maxAgenda ?? 400
  const dias: DiaHuecos[] = []
  const bufferMs = cfg.bufferMin * 60_000
  let total = 0

  let fecha = fechaCivilDe(desde, cfg.tz)
  for (let i = 0; i <= cfg.horizonteDias && total < tope; i++, fecha = masDias(fecha, 1)) {
    const wd = diaSemana(fecha)
    const delDia = cfg.reglas
      .filter((r) => r.weekday === wd && r.endMin > r.startMin)
      .sort((a, b) => a.startMin - b.startMin)

    // Dos tramos del mismo día pueden solaparse (una jornada partida mal
    // configurada: 9 a 18 y 16 a 20). Sin esto, las horas de la zona común
    // saldrían DOS VECES en la lista que ve el candidato, que es de las cosas
    // que más cutre dejan un producto. La interfaz también lo avisa al guardar,
    // pero la disponibilidad puede venir de otro sitio y aquí es barato.
    const vistos = new Set<number>()
    const huecos: Hueco[] = []

    for (const regla of delDia) {
      for (let t = regla.startMin; t + cfg.durMin <= regla.endMin; t += cfg.granularidadMin) {
        if (total >= tope) break
        if (vistos.has(t)) continue
        vistos.add(t)

        const ini = paredAUtc(fecha, Math.floor(t / 60), t % 60, cfg.tz)
        if (!ini) continue // hora que no existe (salto de primavera)
        const fin = new Date(ini.getTime() + cfg.durMin * 60_000)
        if (ini < desde || fin > hasta) continue

        const choca = cfg.ocupado.some(
          (o) => !(fin.getTime() + bufferMs <= o.start.getTime() || ini.getTime() - bufferMs >= o.end.getTime()),
        )
        if (choca) continue

        huecos.push({ starts_at: ini.toISOString(), ends_at: fin.toISOString() })
        total++
      }
    }
    if (huecos.length) dias.push({ fecha, huecos })
  }
  return dias
}

/**
 * La agenda que cabe en un prompt.
 *
 * Recorta ANTES de que nadie numere, porque el número que ve el modelo tiene que
 * ser una posición real de esta misma lista. Los días se recortan por la cola
 * (los primeros son los que sirven) y un día demasiado largo se REPARTE, que es
 * la misma regla de siempre.
 */
export function recortarAgenda(
  dias: DiaHuecos[],
  tope: { dias: number; porDia: number; total: number } = { dias: 7, porDia: 20, total: 100 },
): DiaHuecos[] {
  const out: DiaHuecos[] = []
  let total = 0
  for (const dia of dias.slice(0, tope.dias)) {
    if (total >= tope.total) break
    const huecos = repartir(dia.huecos, Math.min(tope.porDia, tope.total - total))
    if (!huecos.length) continue
    out.push({ fecha: dia.fecha, huecos })
    total += huecos.length
  }
  return out
}

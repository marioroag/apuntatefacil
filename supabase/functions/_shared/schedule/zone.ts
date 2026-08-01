// Zonas horarias sin librería de fechas. El proyecto no tiene ninguna (ni
// date-fns ni dayjs) y para esto no hace falta: `Intl` ya sabe de husos y de
// cambios de hora, solo hay que preguntarle bien.
//
// Sin imports A PROPÓSITO: este módulo lo carga Deno (las edge functions) y
// también vitest (las pruebas). Cualquier import de `jsr:` o `npm:` rompería
// uno de los dos, y duplicar el cálculo de fechas en dos sitios es justo el
// tipo de cosa que acaba divergiendo en el cambio de hora de octubre.

export interface FechaCivil {
  y: number
  m: number // 1-12
  d: number
}

/**
 * Desfase de una zona respecto de UTC, en minutos y positivo al este, para un
 * INSTANTE concreto. Depende del instante porque el mismo sitio cambia de
 * desfase dos veces al año.
 */
export function offsetZona(instante: Date, tz: string): number {
  const p: Record<string, string> = {}
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  for (const x of fmt.formatToParts(instante)) p[x.type] = x.value
  // Algunos motores devuelven '24' para la medianoche con hourCycle h23.
  const hora = Number(p.hour) % 24
  const comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hora, Number(p.minute), Number(p.second))
  return Math.round((comoUtc - instante.getTime()) / 60000)
}

/** Fecha civil (la del calendario de pared) de un instante en una zona. */
export function fechaCivilDe(instante: Date, tz: string): FechaCivil {
  const p: Record<string, string> = {}
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  for (const x of fmt.formatToParts(instante)) p[x.type] = x.value
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) }
}

/**
 * Instante UTC de una hora de PARED en una zona.
 *
 * Dos pasadas porque el desfase que hay que aplicar depende del propio
 * resultado: justo en el salto de hora, la primera conjetura usa el desfase
 * equivocado y cae una hora fuera.
 *
 * Devuelve null si esa hora NO EXISTE. El último domingo de marzo, en España,
 * la madrugada salta de las 02:00 a las 03:00: las 02:30 de ese día no
 * ocurren. Devolver null y saltarse el hueco es mejor que ofrecerle al
 * candidato una hora imposible.
 */
export function paredAUtc(f: FechaCivil, hh: number, mm: number, tz: string): Date | null {
  const conjetura = Date.UTC(f.y, f.m - 1, f.d, hh, mm)
  let ts = conjetura - offsetZona(new Date(conjetura), tz) * 60000
  ts = conjetura - offsetZona(new Date(ts), tz) * 60000
  const r = new Date(ts)

  // Verificación de ida y vuelta: si al volver a pared no sale lo mismo que
  // pedimos, esa hora de pared no existe en esa zona.
  const p: Record<string, string> = {}
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  for (const x of fmt.formatToParts(r)) p[x.type] = x.value
  if (Number(p.hour) % 24 !== hh || Number(p.minute) !== mm || Number(p.day) !== f.d) return null
  return r
}

/**
 * Avanzar días es una operación de CALENDARIO, no de milisegundos. Sumar
 * 86.400.000 ms el día del cambio de hora desplaza el horario una hora y las
 * entrevistas del martes salen a las 9:00 en vez de a las 10:00.
 */
export function masDias(f: FechaCivil, n: number): FechaCivil {
  const t = new Date(Date.UTC(f.y, f.m - 1, f.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Día de la semana (0 = domingo), función pura del calendario. */
export function diaSemana(f: FechaCivil): number {
  return new Date(Date.UTC(f.y, f.m - 1, f.d)).getUTCDay()
}

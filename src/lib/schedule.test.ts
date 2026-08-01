import { describe, it, expect } from 'vitest'
// Se prueban desde aquí, y no con `deno test`, a propósito.
//
// vite.config.ts excluye supabase/functions/** de vitest porque las edge
// functions importan de `jsr:`/`npm:` y vitest no los resuelve. El subárbol
// _shared/schedule NO importa nada (está escrito así para que lo carguen los
// dos runtimes), así que ese motivo no le aplica y puede probarse con la
// herramienta que el proyecto tiene instalada. Deno no está en esta máquina, y
// un cálculo de fechas sin pruebas es exactamente lo que no se puede dejar
// pasar: los fallos de cambio de hora aparecen dos veces al año, en producción.
import { diaSemana, fechaCivilDe, masDias, offsetZona, paredAUtc } from '../../supabase/functions/_shared/schedule/zone'
import {
  generarAgenda, recortarAgenda, repartir,
  type Hueco, type ReglaDisponibilidad,
} from '../../supabase/functions/_shared/schedule/slots'

// Lo que de verdad se le enseña a un candidato son las horas de UN día ya
// elegido, adelgazadas a su ajuste. Estos dos ayudantes son ese recorrido, para
// que las pruebas ejerciten lo que corre y no una composición inventada.
const todosLosHuecos = (cfg: Parameters<typeof generarAgenda>[0]) =>
  generarAgenda(cfg).flatMap((d) => d.huecos)
const horasDelDia = (cfg: Parameters<typeof generarAgenda>[0], n: number) =>
  generarAgenda(cfg).flatMap((d) => repartir(d.huecos, n))

const MADRID = 'Europe/Madrid'
const CANARIAS = 'Atlantic/Canary'

// Laborables de 9:00 a 14:00.
const LABORABLES: ReglaDisponibilidad[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMin: 9 * 60,
  endMin: 14 * 60,
}))

describe('offsetZona', () => {
  it('conoce el horario de invierno y el de verano', () => {
    expect(offsetZona(new Date('2026-01-15T12:00:00Z'), MADRID)).toBe(60)
    expect(offsetZona(new Date('2026-07-15T12:00:00Z'), MADRID)).toBe(120)
    expect(offsetZona(new Date('2026-01-15T12:00:00Z'), CANARIAS)).toBe(0)
    expect(offsetZona(new Date('2026-07-15T12:00:00Z'), CANARIAS)).toBe(60)
  })
})

describe('paredAUtc', () => {
  it('convierte hora de pared al instante correcto', () => {
    expect(paredAUtc({ y: 2026, m: 7, d: 15 }, 10, 0, MADRID)?.toISOString())
      .toBe('2026-07-15T08:00:00.000Z')
    expect(paredAUtc({ y: 2026, m: 1, d: 15 }, 10, 0, MADRID)?.toISOString())
      .toBe('2026-01-15T09:00:00.000Z')
    // La misma hora de pared, una hora más tarde en Canarias.
    expect(paredAUtc({ y: 2026, m: 7, d: 15 }, 10, 0, CANARIAS)?.toISOString())
      .toBe('2026-07-15T09:00:00.000Z')
  })

  it('devuelve null en la hora que no existe del salto de primavera', () => {
    // En España, el último domingo de marzo de 2026 (día 29) la madrugada
    // salta de las 02:00 a las 03:00: las 02:30 no ocurren.
    expect(paredAUtc({ y: 2026, m: 3, d: 29 }, 2, 30, MADRID)).toBeNull()
    // Y la de al lado sí existe.
    expect(paredAUtc({ y: 2026, m: 3, d: 29 }, 4, 0, MADRID)).not.toBeNull()
  })
})

describe('masDias', () => {
  it('avanza por calendario, no por milisegundos', () => {
    // Cruzando el cambio de hora de octubre (día 25 de 2026): sumar 24 h en ms
    // daría el día correcto pero desplazaría la hora. Aquí se comprueba lo que
    // importa: que el día civil avanza de uno en uno.
    expect(masDias({ y: 2026, m: 10, d: 24 }, 1)).toEqual({ y: 2026, m: 10, d: 25 })
    expect(masDias({ y: 2026, m: 10, d: 25 }, 1)).toEqual({ y: 2026, m: 10, d: 26 })
    // Y cambia de mes y de año sin ayuda.
    expect(masDias({ y: 2026, m: 12, d: 31 }, 1)).toEqual({ y: 2027, m: 1, d: 1 })
    expect(masDias({ y: 2028, m: 2, d: 28 }, 1)).toEqual({ y: 2028, m: 2, d: 29 }) // bisiesto
  })
})

describe('fechaCivilDe y diaSemana', () => {
  it('usa el día de la zona, no el del navegador', () => {
    // 23:30 UTC del 15 ya es día 16 en Madrid.
    expect(fechaCivilDe(new Date('2026-07-15T23:30:00Z'), MADRID)).toEqual({ y: 2026, m: 7, d: 16 })
    expect(fechaCivilDe(new Date('2026-07-15T23:30:00Z'), CANARIAS)).toEqual({ y: 2026, m: 7, d: 16 })
  })

  it('domingo es 0', () => {
    expect(diaSemana({ y: 2026, m: 7, d: 12 })).toBe(0) // domingo
    expect(diaSemana({ y: 2026, m: 7, d: 13 })).toBe(1) // lunes
  })
})

const base = {
  tz: MADRID,
  reglas: LABORABLES,
  durMin: 30,
  bufferMin: 15,
  granularidadMin: 30,
  minNoticeHoras: 4,
  horizonteDias: 10,
  maxPorDia: 4,
  ocupado: [],
}

describe('generarAgenda', () => {
  it('respeta el aviso mínimo', () => {
    // Miércoles 15 de julio de 2026, 09:00 de Madrid (07:00 UTC).
    const huecos = todosLosHuecos({ ...base, ahora: new Date('2026-07-15T07:00:00Z') })
    // Con 4 h de aviso mínimo, nada antes de las 13:00 de Madrid.
    const hoy = huecos.filter((h) => h.starts_at.startsWith('2026-07-15'))
    expect(hoy.length).toBeGreaterThan(0)
    for (const h of hoy) expect(h.starts_at >= '2026-07-15T11:00:00.000Z').toBe(true)
  })

  it('no ofrece nada en fin de semana si no hay reglas', () => {
    const huecos = todosLosHuecos({ ...base, ahora: new Date('2026-07-15T07:00:00Z') })
    for (const h of huecos) {
      const wd = new Date(h.starts_at).getUTCDay()
      expect(wd).not.toBe(0)
      expect(wd).not.toBe(6)
    }
  })

  // `maxPorDia: 30` aquí no es un detalle: el sujeto de esta prueba es el
  // BUFFER, no el adelgazado de la oferta. Con el tope por defecto, el reparto
  // se lleva por delante huecos que esta prueba nombra, y entonces falla por un
  // motivo que no tiene nada que ver con lo que quiere comprobar.
  it('el buffer bloquea el hueco contiguo a lo ocupado', () => {
    const ahora = new Date('2026-07-15T05:00:00Z') // 07:00 Madrid
    const todos = { ...base, maxPorDia: 30 }
    const sinOcupar = todosLosHuecos({ ...todos, ahora, minNoticeHoras: 1 })
    // Ocupamos 10:00-10:30 de Madrid.
    const ocupado = [{ start: new Date('2026-07-15T08:00:00Z'), end: new Date('2026-07-15T08:30:00Z') }]
    const conOcupado = todosLosHuecos({ ...todos, ahora, minNoticeHoras: 1, ocupado })

    const libres = new Set(conOcupado.map((h) => h.starts_at))
    // El propio hueco desaparece...
    expect(sinOcupar.some((h) => h.starts_at === '2026-07-15T08:00:00.000Z')).toBe(true)
    expect(libres.has('2026-07-15T08:00:00.000Z')).toBe(false)
    // ...y el de las 10:30, que empieza dentro del buffer de 15 min, también.
    expect(libres.has('2026-07-15T08:30:00.000Z')).toBe(false)
    // El de las 9:00 (termina a las 9:30, con 30 min de margen) sigue libre.
    expect(libres.has('2026-07-15T07:00:00.000Z')).toBe(true)
  })

  it('de cada día se proponen como mucho `maxPorDia`, y separadas', () => {
    const huecos = horasDelDia({
      ...base, ahora: new Date('2026-07-15T05:00:00Z'), minNoticeHoras: 0,
    }, 2)
    const porDia = new Map<string, Hueco[]>()
    for (const h of huecos) {
      const dia = h.starts_at.slice(0, 10)
      porDia.set(dia, [...(porDia.get(dia) ?? []), h])
    }
    for (const del of porDia.values()) {
      expect(del.length).toBeLessThanOrEqual(2)
      // Y no son dos seguidos: los dos que se ofrecen del día tienen que estar
      // separados, o el candidato solo ve una franja.
      if (del.length === 2) {
        expect(Date.parse(del[1].starts_at) - Date.parse(del[0].starts_at)).toBeGreaterThan(30 * 60_000)
      }
    }
  })

  // LA prueba que no habría dejado pasar el fallo. El generador cortaba el día
  // al llegar al tope, así que con 9:00-18:00 y maxPorDia 4 emitía 09:00, 09:30,
  // 10:00 y 10:30 y paraba: las tardes NO EXISTÍAN. A un candidato de verdad se
  // le dijo "no tengo hueco el miércoles por la tarde" y era cierto sobre una
  // agenda falsa.
  it('reparte el día entero, con tardes incluidas', () => {
    const jornada: ReglaDisponibilidad[] = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday, startMin: 9 * 60, endMin: 18 * 60,
    }))
    const cfg = {
      ...base, reglas: jornada, ahora: new Date('2026-07-15T05:00:00Z'),
      minNoticeHoras: 0, horizonteDias: 1, maxPorDia: 4,
    }
    const delDia = horasDelDia(cfg, 4).filter((h) => h.starts_at.startsWith('2026-07-15'))
    expect(delDia).toHaveLength(4)
    // 9:00 y 17:30 de Madrid, o sea los dos extremos de la jornada.
    expect(delDia[0].starts_at).toBe('2026-07-15T07:00:00.000Z')
    expect(delDia[3].starts_at).toBe('2026-07-15T15:30:00.000Z')
    // Y al menos uno de tarde, que es lo que faltaba.
    expect(delDia.some((h) => h.starts_at >= '2026-07-15T12:00:00.000Z')).toBe(true)
  })

  it('la semana del cambio de hora mantiene la hora local', () => {
    // El cambio de octubre de 2026 es el domingo 25. El lunes 26 la
    // disponibilidad empieza a las 9:00 de Madrid, que ya es CET (+1) = 08:00 UTC.
    const huecos = todosLosHuecos({
      ...base, ahora: new Date('2026-10-23T05:00:00Z'), minNoticeHoras: 0, horizonteDias: 5, maxPorDia: 1,
    })
    const viernes = huecos.find((h) => h.starts_at.startsWith('2026-10-23'))
    const lunes = huecos.find((h) => h.starts_at.startsWith('2026-10-26'))
    // Viernes 23 en CEST (+2): 9:00 local = 07:00 UTC.
    expect(viernes?.starts_at).toBe('2026-10-23T07:00:00.000Z')
    // Lunes 26 en CET (+1): 9:00 local = 08:00 UTC. Distinto UTC, MISMA hora local.
    expect(lunes?.starts_at).toBe('2026-10-26T08:00:00.000Z')
  })

  it('un día sin reglas no produce huecos', () => {
    const huecos = todosLosHuecos({
      ...base, ahora: new Date('2026-07-15T05:00:00Z'), reglas: [], horizonteDias: 5,
    })
    expect(huecos).toHaveLength(0)
  })

  // Una jornada partida mal puesta (9 a 18 y 16 a 20) no puede hacer que las
  // 16:00 y las 17:00 aparezcan DOS VECES en la lista que ve el candidato.
  it('dos tramos solapados del mismo día no repiten hueco', () => {
    const partida: ReglaDisponibilidad[] = [
      { weekday: 3, startMin: 9 * 60, endMin: 18 * 60 },
      { weekday: 3, startMin: 16 * 60, endMin: 20 * 60 },
    ]
    const huecos = todosLosHuecos({
      ...base, reglas: partida, ahora: new Date('2026-07-15T05:00:00Z'),
      minNoticeHoras: 0, horizonteDias: 1, maxPorDia: 30,
    })
    const inicios = huecos.map((h) => h.starts_at)
    expect(new Set(inicios).size).toBe(inicios.length)
  })

  it('el fin del hueco es inicio más duración', () => {
    const huecos = todosLosHuecos({ ...base, ahora: new Date('2026-07-15T05:00:00Z'), minNoticeHoras: 0 })
    for (const h of huecos.slice(0, 5)) {
      expect(Date.parse(h.ends_at) - Date.parse(h.starts_at)).toBe(30 * 60_000)
    }
  })
})

describe('repartir', () => {
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('coge los dos extremos y reparte por el medio', () => {
    expect(repartir(xs, 4)).toEqual([0, 3, 6, 9])
    expect(repartir(xs, 2)).toEqual([0, 9])
  })

  it('con uno solo devuelve el más pronto', () => {
    expect(repartir(xs, 1)).toEqual([0])
  })

  it('con n mayor o igual que el largo los devuelve todos', () => {
    expect(repartir(xs, 10)).toEqual(xs)
    expect(repartir(xs, 99)).toEqual(xs)
    expect(repartir([], 3)).toEqual([])
  })

  it('nunca repite y siempre va creciendo', () => {
    for (let m = 2; m <= 40; m++) {
      const ys = Array.from({ length: m }, (_, i) => i)
      for (let n = 1; n <= m; n++) {
        const r = repartir(ys, n)
        expect(new Set(r).size).toBe(r.length)
        for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1])
      }
    }
  })

  it('n cero o negativo no devuelve nada', () => {
    expect(repartir(xs, 0)).toEqual([])
    expect(repartir(xs, -1)).toEqual([])
  })
})

describe('generarAgenda', () => {
  const jornada: ReglaDisponibilidad[] = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday, startMin: 9 * 60, endMin: 18 * 60,
  }))

  // La distinción entera del rediseño: la agenda es lo que el anfitrión tiene
  // libre; la oferta es lo que le proponemos. Confundirlas hacía que el agente
  // contestara con verdad sobre una agenda falsa.
  it('devuelve la rejilla entera, sin adelgazar', () => {
    const cfg = {
      ...base, reglas: jornada, ahora: new Date('2026-07-15T05:00:00Z'),
      minNoticeHoras: 0, horizonteDias: 1, maxPorDia: 4,
    }
    const dias = generarAgenda(cfg)
    const miercoles = dias.find((d) => d.huecos[0].starts_at.startsWith('2026-07-15'))
    expect(miercoles?.huecos).toHaveLength(18) // 9:00 a 17:30 cada 30 min
    expect(horasDelDia(cfg, 4).filter((h) => h.starts_at.startsWith('2026-07-15'))).toHaveLength(4)
  })

  it('agrupa por el día del anfitrión, no por el de UTC', () => {
    // En Canarias 9:00 local son las 08:00 UTC en verano: mismo día. Pero el
    // reparto por día tiene que salir de la fecha civil, no de la cadena ISO.
    const dias = generarAgenda({
      ...base, tz: CANARIAS, reglas: jornada, ahora: new Date('2026-07-13T00:00:00Z'),
      minNoticeHoras: 0, horizonteDias: 2, maxPorDia: 99,
    })
    for (const d of dias) {
      const fechas = new Set(d.huecos.map((h) => h.starts_at.slice(0, 10)))
      expect(fechas.size).toBe(1)
      expect([...fechas][0]).toBe(`${d.fecha.y}-${String(d.fecha.m).padStart(2, '0')}-${String(d.fecha.d).padStart(2, '0')}`)
    }
  })

  it('un día sin huecos no aparece', () => {
    const dias = generarAgenda({
      ...base, ahora: new Date('2026-07-17T05:00:00Z'), minNoticeHoras: 0, horizonteDias: 2,
    })
    // 18 y 19 de julio de 2026 son sábado y domingo: no salen en la lista.
    for (const d of dias) expect([6, 0]).not.toContain(new Date(d.huecos[0].starts_at).getUTCDay())
  })
})

describe('recortarAgenda', () => {
  const dia = (d: number, n: number) => ({
    fecha: { y: 2026, m: 7, d },
    huecos: Array.from({ length: n }, (_, i) => ({
      starts_at: `2026-07-${String(d).padStart(2, '0')}T${String(7 + i).padStart(2, '0')}:00:00.000Z`,
      ends_at: `2026-07-${String(d).padStart(2, '0')}T${String(7 + i).padStart(2, '0')}:30:00.000Z`,
    })),
  })

  it('respeta los tres topes', () => {
    const dias = Array.from({ length: 12 }, (_, i) => dia(13 + i, 8))
    const r = recortarAgenda(dias, { dias: 3, porDia: 4, total: 100 })
    expect(r).toHaveLength(3)
    for (const d of r) expect(d.huecos).toHaveLength(4)

    const porTotal = recortarAgenda(dias, { dias: 10, porDia: 8, total: 10 })
    expect(porTotal.reduce((n, d) => n + d.huecos.length, 0)).toBeLessThanOrEqual(10)
  })

  it('al recortar un día reparte, no trunca', () => {
    const [r] = recortarAgenda([dia(13, 10)], { dias: 7, porDia: 3, total: 100 })
    expect(r.huecos.map((h) => h.starts_at.slice(11, 16))).toEqual(['07:00', '12:00', '16:00'])
  })
})

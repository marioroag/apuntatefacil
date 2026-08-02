import { describe, it, expect } from 'vitest'
import {
  sumarDias, lunesDe, semanaDe, bloquesDelDia, franja, proximoDiaCon, anteriorDiaCon,
  rotuloRango, reloj, partesClave, DURACION_POR_DEFECTO,
} from './agenda'
import type { Interview } from './types'

function iv(over: Partial<Interview> = {}): Interview {
  return {
    id: 'i1',
    campaignId: 'c1',
    candidateId: 'p1',
    hostUserId: 'u1',
    status: 'confirmada',
    origin: 'manual',
    startsAt: '2026-09-15T08:00:00.000Z',
    endsAt: '2026-09-15T08:30:00.000Z',
    timezone: 'Europe/Madrid',
    mode: 'presencial',
    locationText: '',
    meetingUrl: null,
    reconfirmedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...over,
  }
}

describe('aritmética de días', () => {
  it('suma días sin comerse ninguno al cambiar la hora', () => {
    // Último domingo de octubre de 2026: en Madrid se atrasa el reloj.
    expect(sumarDias('2026-10-24', 1)).toBe('2026-10-25')
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26')
    // Y en marzo, cuando se adelanta.
    expect(sumarDias('2026-03-28', 1)).toBe('2026-03-29')
    expect(sumarDias('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('cruza meses y años', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('la semana empieza en lunes, también si es domingo', () => {
    expect(lunesDe('2026-09-16')).toBe('2026-09-14') // miércoles
    expect(lunesDe('2026-09-14')).toBe('2026-09-14') // lunes
    expect(lunesDe('2026-09-20')).toBe('2026-09-14') // domingo, no salta a la siguiente
    const semana = semanaDe('2026-09-20')
    expect(semana).toHaveLength(7)
    expect(semana[0]).toBe('2026-09-14')
    expect(semana[6]).toBe('2026-09-20')
  })

  it('sabe el día de la semana de una clave', () => {
    expect(partesClave('2026-09-14').diaLargo).toBe('lunes')
    expect(partesClave('2026-09-20').diaCorto).toBe('dom')
  })
})

describe('bloques del día', () => {
  it('coloca cada bloque en la hora de SU zona, no en la del navegador', () => {
    // 08:00 UTC son las 10:00 en Madrid y las 09:00 en Canarias.
    const madrid = iv({ id: 'a' })
    const canarias = iv({ id: 'b', timezone: 'Atlantic/Canary' })
    const [m] = bloquesDelDia([madrid], '2026-09-15')
    const [c] = bloquesDelDia([canarias], '2026-09-15')
    expect(m.desde).toBe(10 * 60)
    expect(c.desde).toBe(9 * 60)
  })

  it('deja fuera las de otro día y las que no tienen hora', () => {
    const lista = [iv({ id: 'a' }), iv({ id: 'b', startsAt: null, endsAt: null, status: 'invitada' })]
    expect(bloquesDelDia(lista, '2026-09-15').map((b) => b.entrevista.id)).toEqual(['a'])
    expect(bloquesDelDia(lista, '2026-09-16')).toEqual([])
  })

  it('da una duración por defecto si no hay fin, y nunca una altura negativa', () => {
    const sinFin = bloquesDelDia([iv({ endsAt: null })], '2026-09-15')[0]
    expect(sinFin.hasta - sinFin.desde).toBe(DURACION_POR_DEFECTO)
    // Fin anterior al inicio (dato roto): se trata como si no lo hubiera.
    const roto = bloquesDelDia([iv({ endsAt: '2026-09-15T07:00:00.000Z' })], '2026-09-15')[0]
    expect(roto.hasta - roto.desde).toBe(DURACION_POR_DEFECTO)
  })

  it('reparte en columnas lo que se pisa y deja a ancho completo lo que no', () => {
    const a = iv({ id: 'a', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T09:00:00.000Z' })
    const b = iv({ id: 'b', startsAt: '2026-09-15T08:30:00.000Z', endsAt: '2026-09-15T09:30:00.000Z' })
    const suelta = iv({ id: 'c', startsAt: '2026-09-15T11:00:00.000Z', endsAt: '2026-09-15T11:30:00.000Z' })
    const bloques = bloquesDelDia([a, b, suelta], '2026-09-15')
    expect(bloques.map((x) => [x.entrevista.id, x.columna, x.columnas])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 1],
    ])
  })

  it('agrupa en cadena: A pisa a B y B pisa a C, así que las tres miden igual', () => {
    const a = iv({ id: 'a', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T09:00:00.000Z' })
    const b = iv({ id: 'b', startsAt: '2026-09-15T08:30:00.000Z', endsAt: '2026-09-15T09:30:00.000Z' })
    const c = iv({ id: 'c', startsAt: '2026-09-15T09:15:00.000Z', endsAt: '2026-09-15T10:00:00.000Z' })
    const bloques = bloquesDelDia([a, b, c], '2026-09-15')
    // Dos columnas, no tres: C no pisa a A, así que hereda su hueco en vez de
    // estrechar a las tres. Pero comparte ancho con ellas, que es lo que evita
    // el escalón feo de media columna.
    expect(bloques.map((x) => x.columnas)).toEqual([2, 2, 2])
    expect(bloques.map((x) => x.columna)).toEqual([0, 1, 0])
  })

  it('tres a la misma hora se reparten en tres columnas', () => {
    const misma = (id: string) => iv({ id, startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T09:00:00.000Z' })
    const bloques = bloquesDelDia([misma('a'), misma('b'), misma('c')], '2026-09-15')
    expect(bloques.map((x) => x.columna)).toEqual([0, 1, 2])
    expect(bloques.map((x) => x.columnas)).toEqual([3, 3, 3])
  })

  it('una que acaba justo cuando empieza la siguiente no se considera solape', () => {
    const a = iv({ id: 'a', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T08:30:00.000Z' })
    const b = iv({ id: 'b', startsAt: '2026-09-15T08:30:00.000Z', endsAt: '2026-09-15T09:00:00.000Z' })
    expect(bloquesDelDia([a, b], '2026-09-15').map((x) => x.columnas)).toEqual([1, 1])
  })
})

describe('franja horaria', () => {
  it('pinta la jornada de referencia aunque el día esté vacío', () => {
    expect(franja([])).toEqual({ desde: 8 * 60, hasta: 20 * 60 })
  })

  it('se estira para que nada quede fuera de la rejilla', () => {
    const temprano = bloquesDelDia([iv({ startsAt: '2026-09-15T05:10:00.000Z', endsAt: '2026-09-15T05:40:00.000Z' })], '2026-09-15')
    const tarde = bloquesDelDia([iv({ startsAt: '2026-09-15T19:30:00.000Z', endsAt: '2026-09-15T20:15:00.000Z' })], '2026-09-15')
    expect(franja(temprano).desde).toBe(7 * 60) // 07:10 en Madrid -> la hora en punto
    expect(franja(tarde).hasta).toBe(23 * 60) // 22:15 -> sube a las 23:00
  })
})

describe('saltos a lo que hay', () => {
  const lista = [
    iv({ id: 'a', startsAt: '2026-09-15T08:00:00.000Z' }),
    iv({ id: 'b', startsAt: '2026-10-02T08:00:00.000Z' }),
    iv({ id: 'c', startsAt: null, endsAt: null }),
  ]
  it('encuentra el próximo día con algo, incluido el de hoy', () => {
    expect(proximoDiaCon(lista, '2026-09-15')).toBe('2026-09-15')
    expect(proximoDiaCon(lista, '2026-09-16')).toBe('2026-10-02')
    expect(proximoDiaCon(lista, '2026-10-03')).toBeNull()
  })
  it('encuentra el anterior sin contar el propio día', () => {
    expect(anteriorDiaCon(lista, '2026-10-02')).toBe('2026-09-15')
    expect(anteriorDiaCon(lista, '2026-09-15')).toBeNull()
  })
})

describe('rótulos', () => {
  it('no repite mes ni año cuando no hace falta', () => {
    expect(rotuloRango(semanaDe('2026-09-16'))).toBe('14-20 sep 2026')
  })
  it('dice los dos meses si la semana los cruza', () => {
    expect(rotuloRango(semanaDe('2026-10-01'))).toBe('28 sep - 4 oct 2026')
  })
  it('dice los dos años si la semana los cruza', () => {
    expect(rotuloRango(semanaDe('2026-12-31'))).toBe('28 dic 2026 - 3 ene 2027')
  })
  it('en un solo día dice el día de la semana, y "Hoy" si lo es', () => {
    expect(rotuloRango(['2026-09-16'])).toBe('Miércoles 16 sep 2026')
    expect(rotuloRango(['2026-09-16'], '2026-09-16')).toBe('Hoy, miércoles 16 sep 2026')
  })
  it('no usa guion largo en ningún rótulo', () => {
    const rotulos = [rotuloRango(semanaDe('2026-09-16')), rotuloRango(semanaDe('2026-10-01')), rotuloRango(['2026-09-16'])]
    for (const r of rotulos) expect(r).not.toMatch(/[—–]/)
  })
  it('pinta la hora de la rejilla con dos cifras', () => {
    expect(reloj(0)).toBe('00:00')
    expect(reloj(9 * 60 + 5)).toBe('09:05')
    expect(reloj(23 * 60 + 30)).toBe('23:30')
  })
})

import { describe, it, expect } from 'vitest'
import { splitInterviews, groupByDay, currentInterview, isLive } from './interviews'
import { dayKeyInZone, clockTimeInZone, fullDateTimeInZone, shortWhenInZone } from './format'
import type { Interview, InterviewStatus } from './types'

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

describe('formato en la zona de la entrevista', () => {
  it('pinta la hora de la zona, no la del navegador', () => {
    // 08:00 UTC en verano son las 10:00 en Madrid y las 09:00 en Canarias.
    const iso = '2026-09-15T08:00:00.000Z'
    expect(clockTimeInZone(iso, 'Europe/Madrid')).toBe('10:00')
    expect(clockTimeInZone(iso, 'Atlantic/Canary')).toBe('09:00')
  })

  it('respeta el cambio de hora: la misma hora local en invierno y en verano', () => {
    // Julio (CEST, +2) y enero (CET, +1) sobre el mismo 08:00 UTC.
    expect(clockTimeInZone('2026-07-15T08:00:00.000Z', 'Europe/Madrid')).toBe('10:00')
    expect(clockTimeInZone('2026-01-15T08:00:00.000Z', 'Europe/Madrid')).toBe('09:00')
  })

  it('agrupa por el día civil de la zona, no por el del navegador', () => {
    // 23:30 UTC del día 15 ya es el día 16 en Madrid, pero sigue siendo el 15
    // en Canarias. Agrupar mal partiría la agenda en dos.
    const iso = '2026-09-15T23:30:00.000Z'
    expect(dayKeyInZone(iso, 'Europe/Madrid')).toBe('2026-09-16')
    expect(dayKeyInZone(iso, 'Atlantic/Canary')).toBe('2026-09-16')
    // Y a las 23:30 hora de Canarias (22:30 UTC) todavía es día 15 allí.
    expect(dayKeyInZone('2026-09-15T22:30:00.000Z', 'Atlantic/Canary')).toBe('2026-09-15')
  })

  it('formatea fecha completa y etiqueta corta', () => {
    expect(fullDateTimeInZone('2026-09-15T08:00:00.000Z', 'Europe/Madrid')).toBe('15/09/2026 a las 10:00')
    expect(shortWhenInZone('2026-09-15T08:00:00.000Z', 'Europe/Madrid')).toMatch(/^mar 15, 10:00$/)
  })
})

describe('splitInterviews', () => {
  const ahora = Date.parse('2026-09-15T09:00:00.000Z') // 11:00 en Madrid

  it('una entrevista en curso cuenta como próxima hasta que termina', () => {
    // Empezó a las 10:00 y acaba a las 10:30 (Madrid). A las 11:00 ya pasó.
    const { proximas, pasadas } = splitInterviews([iv()], ahora)
    expect(proximas).toHaveLength(0)
    expect(pasadas).toHaveLength(1)

    // La misma, mirada a las 10:15: sigue siendo la de ahora.
    const enCurso = splitInterviews([iv()], Date.parse('2026-09-15T08:15:00.000Z'))
    expect(enCurso.proximas).toHaveLength(1)
  })

  it('las que aún se negocian van a "en marcha", no a pasadas', () => {
    const { enMarcha, pasadas } = splitInterviews(
      [iv({ status: 'invitada', startsAt: null, endsAt: null })],
      ahora,
    )
    expect(enMarcha).toHaveLength(1)
    expect(pasadas).toHaveLength(0)
  })

  it('una cancelada sin hora es pasado, no negociación abierta', () => {
    const { enMarcha, pasadas } = splitInterviews(
      [iv({ status: 'rechazada', startsAt: null, endsAt: null })],
      ahora,
    )
    expect(enMarcha).toHaveLength(0)
    expect(pasadas).toHaveLength(1)
  })

  it('una cancelada CON hora futura no ocupa la agenda', () => {
    const { proximas, pasadas } = splitInterviews(
      [iv({ status: 'cancelada', startsAt: '2026-09-20T08:00:00.000Z', endsAt: '2026-09-20T08:30:00.000Z' })],
      ahora,
    )
    expect(proximas).toHaveLength(0)
    expect(pasadas).toHaveLength(1)
  })

  it('ordena las próximas de antes a después', () => {
    const { proximas } = splitInterviews(
      [
        iv({ id: 'b', startsAt: '2026-09-20T08:00:00.000Z', endsAt: '2026-09-20T08:30:00.000Z' }),
        iv({ id: 'a', startsAt: '2026-09-16T08:00:00.000Z', endsAt: '2026-09-16T08:30:00.000Z' }),
      ],
      ahora,
    )
    expect(proximas.map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('groupByDay', () => {
  it('junta el mismo día y ordena los días', () => {
    const grupos = groupByDay(
      [
        iv({ id: 'tarde', startsAt: '2026-09-16T14:00:00.000Z', endsAt: '2026-09-16T14:30:00.000Z' }),
        iv({ id: 'antes', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T08:30:00.000Z' }),
        iv({ id: 'manana', startsAt: '2026-09-16T08:00:00.000Z', endsAt: '2026-09-16T08:30:00.000Z' }),
      ],
      Date.parse('2026-09-01T00:00:00.000Z'),
    )
    expect(grupos.map((g) => g.key)).toEqual(['2026-09-15', '2026-09-16'])
    expect(grupos[1].items).toHaveLength(2)
  })

  it('etiqueta Hoy y Mañana', () => {
    const ahora = Date.parse('2026-09-15T09:00:00.000Z')
    const grupos = groupByDay(
      [
        iv({ startsAt: '2026-09-15T15:00:00.000Z', endsAt: '2026-09-15T15:30:00.000Z' }),
        iv({ startsAt: '2026-09-16T08:00:00.000Z', endsAt: '2026-09-16T08:30:00.000Z' }),
      ],
      ahora,
    )
    expect(grupos.map((g) => g.label)).toEqual(['Hoy', 'Mañana'])
  })

  it('ignora las que no tienen hora', () => {
    expect(groupByDay([iv({ startsAt: null, endsAt: null })])).toHaveLength(0)
  })
})

describe('currentInterview', () => {
  it('prefiere la viva aunque haya una posterior cerrada', () => {
    const lista = [
      iv({ id: 'cancelada', status: 'cancelada', createdAt: '2026-09-10T00:00:00.000Z' }),
      iv({ id: 'viva', status: 'confirmada', createdAt: '2026-09-02T00:00:00.000Z' }),
    ]
    expect(currentInterview(lista, 'p1')?.id).toBe('viva')
  })

  it('si no hay viva, la primera de la lista (que llega ya ordenada)', () => {
    const lista = [iv({ id: 'ultima', status: 'cancelada' }), iv({ id: 'vieja', status: 'realizada' })]
    expect(currentInterview(lista, 'p1')?.id).toBe('ultima')
  })

  it('no mezcla candidatos', () => {
    expect(currentInterview([iv({ candidateId: 'otro' })], 'p1')).toBeNull()
  })
})

describe('isLive', () => {
  it('vivas y cerradas', () => {
    const vivas: InterviewStatus[] = ['invitada', 'proponiendo', 'confirmada', 'reprogramando']
    const cerradas: InterviewStatus[] = ['realizada', 'cancelada', 'rechazada', 'sin_respuesta', 'fallida']
    for (const s of vivas) expect(isLive(s)).toBe(true)
    for (const s of cerradas) expect(isLive(s)).toBe(false)
  })
})

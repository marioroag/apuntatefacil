import { describe, expect, it } from 'vitest'
import {
  meridianTasks,
  planInterestSend,
  sendPlanVoice,
  taskOpen,
  taskPending,
  unreadEvents,
} from './meridianTasks'
import type { Campaign, Candidate, CandidateInterestSummary, FormField } from './types'

const fields: FormField[] = [
  { id: 'nombre', type: 'text', label: 'Nombre', required: true },
  { id: 'email', type: 'email', label: 'Email', required: true },
]

const iso = (day: number, hour = 12) => new Date(Date.UTC(2026, 6, day, hour)).toISOString()
const now = Date.UTC(2026, 6, 25, 12)

function campaign(id: string, title: string): Campaign {
  return {
    id, slug: id, title, sector: 'construccion', location: 'Las Palmas',
    status: 'activa', milanunciosUrl: '', fields, branding: { accent: '#3b4fe4' },
    createdAt: iso(1), brandId: null, siteId: null,
  } as Campaign
}

function candidate(
  id: string,
  campaignId: string,
  interest?: Partial<CandidateInterestSummary> | null,
  email = `${id}@ejemplo.com`,
): Candidate {
  return {
    id, campaignId,
    answers: email ? { nombre: id, email } : { nombre: id },
    status: 'nuevo', submittedAt: iso(20), source: 'enlace', favorito: false, notes: '', tagIds: [],
    interest: interest === undefined || interest === null ? undefined : {
      checkId: `check-${id}`,
      batchId: 'batch-1',
      response: null,
      sentAt: iso(22),
      respondedAt: null,
      reminderSentAt: null,
      expiresAt: iso(80),
      ...interest,
    },
  } as Candidate
}

describe('meridianTasks', () => {
  it('agrupa por lote y no inventa tareas sin envío', () => {
    const tasks = meridianTasks([
      candidate('a', 'c1', { batchId: 'b1' }),
      candidate('b', 'c1', { batchId: 'b1' }),
      candidate('c', 'c1', { batchId: 'b2', sentAt: iso(24) }),
      candidate('d', 'c1', null), // nunca se le escribió
    ])
    expect(tasks).toHaveLength(2)
    // Lo más reciente primero.
    expect(tasks[0].batchId).toBe('b2')
    expect(tasks[1].candidateIds).toEqual(['a', 'b'])
  })

  it('cuenta como evento solo a quien ha respondido de verdad', () => {
    const [task] = meridianTasks([
      candidate('a', 'c1', { batchId: 'b1', response: 'interested', respondedAt: iso(23) }),
      candidate('b', 'c1', { batchId: 'b1', response: 'not_interested', respondedAt: iso(24) }),
      candidate('c', 'c1', { batchId: 'b1' }),
    ])
    expect(task.events.map((e) => e.candidateId)).toEqual(['b', 'a']) // más reciente primero
    expect(task.events[0].outcome).toBe('not_interested')
    expect(taskPending(task)).toEqual(['c'])
    expect(taskOpen(task)).toBe(true)
    expect(task.lastEventAt).toBe(iso(24))
  })

  it('una tarea contestada por todos deja de estar en marcha', () => {
    const [task] = meridianTasks([
      candidate('a', 'c1', { batchId: 'b1', response: 'interested', respondedAt: iso(23) }),
    ])
    expect(taskOpen(task)).toBe(false)
  })

  it('sin marca de visto todo cuenta como nuevo, y luego solo lo posterior', () => {
    const tasks = meridianTasks([
      candidate('a', 'c1', { batchId: 'b1', response: 'interested', respondedAt: iso(23) }),
      candidate('b', 'c1', { batchId: 'b1', response: 'interested', respondedAt: iso(24) }),
    ])
    expect(unreadEvents(tasks, null)).toBe(2)
    expect(unreadEvents(tasks, iso(23))).toBe(1)
    expect(unreadEvents(tasks, iso(24))).toBe(0)
  })
})

describe('planInterestSend', () => {
  const campaigns = [campaign('c1', 'Peón de albañil'), campaign('c2', 'Mozo/a de almacén')]

  it('agrupa por puesto porque el envío es por puesto', () => {
    const plan = planInterestSend(['a', 'b', 'c'], [
      candidate('a', 'c1'), candidate('b', 'c1'), candidate('c', 'c2'),
    ], campaigns, now)
    expect(plan.groups).toHaveLength(2)
    expect(plan.sendable).toHaveLength(3)
    expect(plan.omittedTotal).toBe(0)
  })

  it('aparta a quien no dejó correo y lo explica', () => {
    const plan = planInterestSend(['a', 'b'], [
      candidate('a', 'c1'),
      candidate('b', 'c1', undefined, ''), // sin email
    ], campaigns, now)
    expect(plan.sendable).toEqual(['a'])
    expect(plan.omitted.missing_email).toBe(1)
    expect(sendPlanVoice(plan)).toBe(
      'De 2 puedo escribir a 1: uno no dejó correo. Este es el correo que va a salir:',
    )
  })

  it('respeta la ventana de recordatorio y quien ya dijo que no', () => {
    const plan = planInterestSend(['a', 'b'], [
      candidate('a', 'c1', { sentAt: iso(24) }), // escrito hace 1 día
      candidate('b', 'c1', { response: 'not_interested', respondedAt: iso(23) }),
    ], campaigns, now)
    expect(plan.sendable).toEqual([])
    expect(sendPlanVoice(plan)).toBe(
      'No puedo escribir a ninguno de los 2: a uno ya le escribí y sigo esperando su respuesta y uno ya me dijo que no le interesa.',
    )
  })

  it('concuerda en singular y en plural', () => {
    const uno = planInterestSend(['a'], [candidate('a', 'c1')], campaigns, now)
    expect(sendPlanVoice(uno)).toBe('Le pregunto si sigue interesado. Este es el correo que va a salir:')
    const dos = planInterestSend(['a', 'b'], [candidate('a', 'c1'), candidate('b', 'c1')], campaigns, now)
    expect(sendPlanVoice(dos)).toBe('Les pregunto si siguen interesados. Este es el correo que va a salir:')
  })

  it('avisa de que hará un envío por puesto cuando cruzan puestos', () => {
    const plan = planInterestSend(['a', 'c'], [candidate('a', 'c1'), candidate('c', 'c2')], campaigns, now)
    expect(sendPlanVoice(plan)).toContain('Son de 2 puestos, así que hago un envío por puesto.')
  })

  it('no se inventa nada si no hay a quién escribir', () => {
    expect(sendPlanVoice(planInterestSend([], [], campaigns, now)))
      .toBe('No tengo a nadie a quien escribir.')
  })

  // "No puedo escribir a ninguno de los 1" era el bug: cuando es una sola
  // persona, la frase va en singular y sin contar.
  it('habla en singular cuando solo hay una persona y no es elegible', () => {
    const plan = planInterestSend(['a'], [candidate('a', 'c1', { sentAt: iso(24) })], campaigns, now)
    expect(sendPlanVoice(plan)).toBe('No puedo escribirle: ya le escribí y sigo esperando su respuesta.')
    const sinCorreo = planInterestSend(['a'], [candidate('a', 'c1', undefined, '')], campaigns, now)
    expect(sendPlanVoice(sinCorreo)).toBe('No puedo escribirle: no dejó correo.')
  })
})

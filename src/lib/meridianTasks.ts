// Lo que Meridian tiene "en marcha", derivado de datos REALES.
//
// Una tarea de Meridian no es un objeto inventado: es un LOTE de comprobación de
// interés (`candidate_interest_batches`), el mismo que crea `send-interest-check`.
// Así el progreso, las respuestas y los avisos salen de que un candidato haya
// pulsado de verdad un enlace real, no de un setTimeout.
import type { Campaign, Candidate } from './types'
import {
  extractCandidateEmail,
  interestEligibility,
  type InterestOmissionReason,
  type InterestSendMode,
} from './interest'

export interface MeridianTaskEvent {
  candidateId: string
  /** interested = sigue disponible. Nunca en rojo: es información, no un juicio. */
  outcome: 'interested' | 'not_interested'
  at: string
}

export interface MeridianTask {
  batchId: string
  campaignId: string
  /** Envío más antiguo del lote. */
  sentAt: string
  candidateIds: string[]
  /** Solo quienes han contestado, lo más reciente primero. */
  events: MeridianTaskEvent[]
  lastEventAt: string | null
}

/**
 * Agrupa las candidaturas por lote de comprobación. Solo entran las que tienen
 * un envío registrado, así que una empresa que nunca ha escrito no tiene tareas.
 */
export function meridianTasks(candidates: Candidate[]): MeridianTask[] {
  const byBatch = new Map<string, MeridianTask>()
  for (const candidate of candidates) {
    const interest = candidate.interest
    if (!interest?.batchId) continue
    let task = byBatch.get(interest.batchId)
    if (!task) {
      task = {
        batchId: interest.batchId,
        campaignId: candidate.campaignId,
        sentAt: interest.sentAt,
        candidateIds: [],
        events: [],
        lastEventAt: null,
      }
      byBatch.set(interest.batchId, task)
    }
    task.candidateIds.push(candidate.id)
    if (interest.sentAt < task.sentAt) task.sentAt = interest.sentAt
    if (interest.response && interest.respondedAt) {
      task.events.push({
        candidateId: candidate.id,
        outcome: interest.response,
        at: interest.respondedAt,
      })
    }
  }
  const tasks = [...byBatch.values()]
  for (const task of tasks) {
    task.events.sort((a, b) => b.at.localeCompare(a.at))
    task.lastEventAt = task.events[0]?.at ?? null
  }
  return tasks.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

export const taskPending = (task: MeridianTask): string[] => {
  const answered = new Set(task.events.map((e) => e.candidateId))
  return task.candidateIds.filter((id) => !answered.has(id))
}

/** Sigue esperando a alguien. Lo que va a "En marcha" en Actividad. */
export const taskOpen = (task: MeridianTask): boolean => taskPending(task).length > 0

/** Novedades posteriores a la última vez que se miró Actividad. */
export function unreadEvents(tasks: MeridianTask[], since: string | null): number {
  if (!since) return tasks.reduce((n, t) => n + t.events.length, 0)
  return tasks.reduce((n, t) => n + t.events.filter((e) => e.at > since).length, 0)
}

// --- Planificar un envío ----------------------------------------------------

export interface SendPlanGroup {
  campaignId: string
  campaignTitle: string
  /** Elegibles, en el orden en que llegaron. */
  sendable: string[]
  mode: InterestSendMode
}

export interface SendPlan {
  groups: SendPlanGroup[]
  sendable: string[]
  omitted: Partial<Record<InterestOmissionReason, number>>
  omittedTotal: number
  total: number
}

/**
 * Decide a quién se le puede escribir de verdad, agrupado por puesto (el envío
 * es por puesto, y las recetas de Meridian cruzan varios). Reutiliza la
 * elegibilidad real de `interest.ts`, que es la misma que aplica el servidor.
 */
export function planInterestSend(
  ids: string[],
  candidates: Candidate[],
  campaigns: Campaign[],
  now = Date.now(),
): SendPlan {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const campaignById = new Map(campaigns.map((c) => [c.id, c]))
  const groups = new Map<string, SendPlanGroup>()
  const omitted: SendPlan['omitted'] = {}
  let omittedTotal = 0

  for (const id of ids) {
    const candidate = byId.get(id)
    const campaign = candidate && campaignById.get(candidate.campaignId)
    if (!candidate || !campaign) continue
    const email = extractCandidateEmail(campaign.fields, candidate.answers)
    const decision = interestEligibility(email, candidate.interest, now)
    if (!decision.eligible) {
      omitted[decision.reason] = (omitted[decision.reason] ?? 0) + 1
      omittedTotal++
      continue
    }
    let group = groups.get(campaign.id)
    if (!group) {
      group = { campaignId: campaign.id, campaignTitle: campaign.title, sendable: [], mode: decision.mode }
      groups.set(campaign.id, group)
    }
    group.sendable.push(id)
  }

  const list = [...groups.values()]
  return {
    groups: list,
    sendable: list.flatMap((g) => g.sendable),
    omitted,
    omittedTotal,
    total: ids.length,
  }
}

// Por qué no puedo escribirle, en la voz de Meridian. Cláusula completa por
// motivo, con singular y plural: "1 candidatos" canta, y "a uno no dejó correo"
// también. Sin guion largo, tuteo, glosario congelado.
const OMISSION_COPY: Record<InterestOmissionReason, (n: number) => string> = {
  missing_email: (n) => (n === 1 ? 'uno no dejó correo' : `${n} no dejaron correo`),
  // Sin "hace unos días": la ventana puede tener 5 minutos o 6 días, y decir un
  // plazo que no es cierto es justo lo que no queremos.
  wait_reminder: (n) => (n === 1 ? 'a uno ya le escribí y sigo esperando su respuesta' : `a ${n} ya les escribí y sigo esperando su respuesta`),
  reminder_used: (n) => (n === 1 ? 'a uno ya le insistí una vez' : `a ${n} ya les insistí una vez`),
  wait_recheck: (n) => (n === 1 ? 'uno ya me dijo que sigue interesado' : `${n} ya me dijeron que siguen interesados`),
  not_interested: (n) => (n === 1 ? 'uno ya me dijo que no le interesa' : `${n} ya me dijeron que no les interesa`),
}

// El mismo motivo, para hablar de UNA sola persona: sin contar, porque "a uno" en
// una frase que ya va de uno solo suena a plantilla ("a ninguno de los 1").
const OMISSION_SOLO: Record<InterestOmissionReason, string> = {
  missing_email: 'no dejó correo',
  wait_reminder: 'ya le escribí y sigo esperando su respuesta',
  reminder_used: 'ya le insistí una vez',
  wait_recheck: 'ya me dijo que sigue interesado',
  not_interested: 'ya me dijo que no le interesa',
}

/** Explica el plan antes de enviar. Meridian nunca finge poder escribir a todos. */
export function sendPlanVoice(plan: SendPlan): string {
  const { total, sendable, omitted, omittedTotal, groups } = plan
  if (sendable.length === 0) {
    if (total === 0) return 'No tengo a nadie a quien escribir.'
    if (total === 1) {
      const reason = (Object.keys(omitted) as InterestOmissionReason[])[0]
      return reason
        ? `No puedo escribirle: ${OMISSION_SOLO[reason]}.`
        : 'No puedo escribirle todavía.'
    }
    return `No puedo escribir a ninguno de los ${total}: ${describeOmissions(omitted)}.`
  }

  const puestos = groups.length > 1
    ? ` Son de ${groups.length} puestos, así que hago un envío por puesto.`
    : ''
  const uno = sendable.length === 1
  if (omittedTotal === 0) {
    return `${uno ? 'Le' : 'Les'} pregunto si sigue${uno ? '' : 'n'} interesado${uno ? '' : 's'}.${puestos} Este es el correo que va a salir:`
  }
  return `De ${total} puedo escribir a ${sendable.length}: ${describeOmissions(omitted)}.${puestos} Este es el correo que va a salir:`
}

function describeOmissions(omitted: SendPlan['omitted']): string {
  const parts = (Object.entries(omitted) as [InterestOmissionReason, number][])
    .filter(([, n]) => n > 0)
    .map(([reason, n]) => OMISSION_COPY[reason](n))
  if (parts.length === 0) return 'no hay nadie elegible'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

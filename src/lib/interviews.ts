// Lógica pura de la agenda de entrevistas: repartir, agrupar y ordenar.
// Sin IO y sin React, para poder probarla sola.
//
// La generación de huecos NO vive aquí: depende del freebusy del calendario y
// de las entrevistas de todos los anfitriones, y ninguna de las dos cosas es
// accesible desde el navegador sin abrir la RLS. Está en
// supabase/functions/_shared/schedule/.

import { INTERVIEW_LIVE, type Interview, type InterviewStatus } from './types'
import { dayKeyInZone, dayLabelInZone } from './format'

export function isLive(status: InterviewStatus): boolean {
  return INTERVIEW_LIVE.includes(status)
}

/** ¿Sigue esperando algo del candidato? (invitada o eligiendo horario) */
export function isNegotiating(status: InterviewStatus): boolean {
  return status === 'invitada' || status === 'proponiendo'
}

/**
 * La entrevista que representa a un candidato en su ficha. Hay como mucho una
 * viva (lo garantiza el índice único de la base); si no, la más reciente, para
 * que la ficha siga contando lo que pasó.
 */
export function currentInterview(list: Interview[], candidateId: string): Interview | null {
  const suyas = list.filter((i) => i.candidateId === candidateId)
  return suyas.find((i) => isLive(i.status)) ?? suyas[0] ?? null
}

export interface InterviewBuckets {
  /** Sin hora todavía: se está negociando con el candidato. */
  enMarcha: Interview[]
  /** Con hora, de ahora en adelante. */
  proximas: Interview[]
  /** Con hora, ya pasadas, y las cerradas sin cita. */
  pasadas: Interview[]
}

/**
 * Reparte la agenda en tres montones. El corte de "pasada" es el FIN de la
 * entrevista, no su inicio: una cita de 10:00 a 10:30 sigue siendo la de ahora
 * a las 10:15, que es justo cuando alguien mira la pantalla para consultarla.
 */
export function splitInterviews(list: Interview[], now = Date.now()): InterviewBuckets {
  const enMarcha: Interview[] = []
  const proximas: Interview[] = []
  const pasadas: Interview[] = []

  for (const i of list) {
    if (!i.startsAt) {
      if (isNegotiating(i.status)) enMarcha.push(i)
      else pasadas.push(i)
      continue
    }
    const fin = Date.parse(i.endsAt ?? i.startsAt)
    if (Number.isFinite(fin) && fin >= now && isLive(i.status)) proximas.push(i)
    else pasadas.push(i)
  }

  enMarcha.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  proximas.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
  // Las pasadas, de más reciente a más antigua: lo último es lo que se consulta.
  pasadas.sort((a, b) => (b.startsAt ?? b.createdAt).localeCompare(a.startsAt ?? a.createdAt))
  return { enMarcha, proximas, pasadas }
}

export interface DayGroup {
  key: string
  label: string
  items: Interview[]
}

/**
 * Agrupa por día CIVIL en la zona de cada entrevista. Agrupar por la zona del
 * navegador partiría en dos un día de Canarias visto desde Madrid.
 */
export function groupByDay(list: Interview[], now = Date.now()): DayGroup[] {
  const grupos = new Map<string, DayGroup>()
  for (const i of list) {
    if (!i.startsAt) continue
    const key = dayKeyInZone(i.startsAt, i.timezone)
    const grupo = grupos.get(key)
    if (grupo) grupo.items.push(i)
    else grupos.set(key, { key, label: dayLabelInZone(i.startsAt, i.timezone, now), items: [i] })
  }
  return [...grupos.values()].sort((a, b) => a.key.localeCompare(b.key))
}

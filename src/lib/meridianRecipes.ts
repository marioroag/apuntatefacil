// Recetas de Meridian (PROTOTIPO, solo demo): tareas de alto valor calculadas con
// reglas simples sobre los datos en memoria. Son "cosas que a mano no harías": una
// ronda de llamadas priorizada cruzando puestos, quién se está enfriando, los
// mejores de cada puesto, y el material para comparar finalistas. Nada de backend.

import type { Campaign, Candidate, FormField } from './types'
import { candidateName } from './format'
import { candidateFit } from './meridian'

export interface RecipeResult {
  key: string
  title: string
  voice: string // línea de Meridian en primera persona
  ids: string[]
  reasons?: Record<string, string> // motivo por candidato (por qué está aquí)
}

const daysSince = (iso: string, now = Date.now()) => Math.floor((now - new Date(iso).getTime()) / 86400000)
const fit = (c: Candidate) => candidateFit(c.ai) ?? -1

// Ronda de llamadas de hoy: a quién llamar ya, cruzando todos los puestos. Prioriza
// candidaturas nuevas que encajan, y dentro de eso, las que llevan más esperando.
export function callRound(candidates: Candidate[]): RecipeResult {
  const pool = candidates.filter((c) => c.status === 'nuevo' && fit(c) >= 55)
  pool.sort((a, b) => {
    const byFit = fit(b) - fit(a)
    if (Math.abs(byFit) > 8) return byFit
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime() // más viejo antes
  })
  const ids = pool.slice(0, 12).map((c) => c.id)
  const reasons: Record<string, string> = {}
  for (const c of pool.slice(0, 12)) {
    const d = daysSince(c.submittedAt)
    // Sin repetir "Encaja bien": la etiqueta ya sale junto al nombre.
    reasons[c.id] = d >= 2
      ? `Lleva ${d} ${d === 1 ? 'día' : 'días'} esperando`
      : 'Entró hace nada, llámale de los primeros'
  }
  return {
    key: 'call-round',
    title: 'Ronda de llamadas de hoy',
    voice: ids.length
      ? `Te he ordenado ${ids.length === 1 ? 'la llamada' : `las ${ids.length} llamadas`} de hoy: empieza por arriba, son quienes más encajan y llevan más esperando.`
      : 'Hoy no hay llamadas urgentes. Vas al día.',
    ids,
    reasons,
  }
}

// ¿Quién se está enfriando?: destacados (encajan bien) que siguen sin revisar y
// llevan días parados. Oportunidades que se pierden solas.
export function coolingDown(candidates: Candidate[]): RecipeResult {
  const pool = candidates.filter((c) => c.status === 'nuevo' && fit(c) >= 70 && daysSince(c.submittedAt) >= 2)
  pool.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
  const ids = pool.slice(0, 12).map((c) => c.id)
  const reasons: Record<string, string> = {}
  for (const c of pool.slice(0, 12)) {
    const d = daysSince(c.submittedAt)
    reasons[c.id] = `Lleva ${d} ${d === 1 ? 'día' : 'días'} sin contactar`
  }
  return {
    key: 'cooling',
    title: 'Se están enfriando',
    voice: ids.length
      ? `Ojo: ${ids.length} ${ids.length === 1 ? 'candidatura que destaqué sigue' : 'candidaturas que destaqué siguen'} sin contactar desde hace días. Yo las rescataría hoy.`
      : 'Nada enfriándose. Estás siguiendo bien a los que encajan.',
    ids,
    reasons,
  }
}

// Los mejores de cada puesto: el/los que más encajan por puesto, de un vistazo.
export function bestPerJob(candidates: Candidate[], campaigns: Campaign[]): RecipeResult {
  const ids: string[] = []
  const reasons: Record<string, string> = {}
  for (const camp of campaigns) {
    const top = candidates
      .filter((c) => c.campaignId === camp.id && fit(c) >= 0)
      .sort((a, b) => fit(b) - fit(a))
      .slice(0, 2)
    for (const c of top) {
      ids.push(c.id)
      reasons[c.id] = camp.title
    }
  }
  return {
    key: 'best-per-job',
    title: 'Los mejores de cada puesto',
    voice: 'Estos son los que mejor encajan en cada puesto ahora mismo.',
    ids,
    reasons,
  }
}

// Respuestas "clave" de un candidato para la vista de comparación: campos con
// significado (select/boolean/number), no textos largos ni el nombre/teléfono.
export function keyAnswers(candidate: Candidate, campaign: Campaign | undefined): { label: string; value: string }[] {
  if (!campaign) return []
  const out: { label: string; value: string }[] = []
  for (const f of campaign.fields as FormField[]) {
    if (f.system) continue
    if (!['select', 'multiselect', 'boolean', 'number'].includes(f.type)) continue
    const v = candidate.answers[f.id]
    if (v === undefined || v === '') continue
    out.push({ label: f.label.replace(/[¿?]/g, '').trim(), value: typeof v === 'boolean' ? (v ? 'Sí' : 'No') : Array.isArray(v) ? v.join(', ') : String(v) })
    if (out.length >= 5) break
  }
  return out
}

export function shortName(c: Candidate): string {
  return (candidateName(c) || 'Sin nombre').split(' ').slice(0, 2).join(' ')
}

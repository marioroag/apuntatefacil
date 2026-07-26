// Cerebro del panel conversacional de Meridian (PROTOTIPO, frontend puro).
// NO es un LLM: es un intérprete HEURÍSTICO de intención que convierte una frase en
// una respuesta con voz de asistente + tarjetas + acciones, operando sobre los datos
// demo. Suficiente para que se sienta como hablar con un compañero de equipo que
// sabe de tus candidatos y puede actuar. El día que haya backend, esto se sustituye
// por una llamada real a un modelo con herramientas (tool calling) equivalentes.

import type { Campaign, Candidate, CandidateStatus } from './types'
import { STATUS_META } from './types'
import { candidateName } from './format'
import { candidateFit, fitTier } from './meridian'
import { parseMeridianQuery, type ValueFilterLite } from './meridianSearch'
import type { NumberFilter } from './types'

// --- Tipos de respuesta -----------------------------------------------------

export type MeridianCard =
  | { kind: 'candidates'; ids: string[]; hiddenCount?: number }
  | { kind: 'insight'; items: { label: string; value: string; hint?: string }[] }
  | { kind: 'draft'; channel: 'email' | 'whatsapp'; subject?: string; body: string; to: string }

// Acción que requiere confirmación del usuario antes de ejecutarse (humano decide).
export type MeridianAction =
  | { type: 'setStatus'; ids: string[]; status: CandidateStatus }
  | { type: 'sendInterest'; ids: string[] }
  | { type: 'export'; ids: string[] }

export interface MeridianResponse {
  text: string
  cards: MeridianCard[]
  suggestions: string[]
  action?: MeridianAction
  actionLabel?: string
  /** ids del conjunto de candidatos que esta respuesta "trae a la mesa" (memoria de
   *  contexto: la siguiente orden tipo "mándales un correo" se refiere a estos). */
  resultIds?: string[]
}

export interface AgentContext {
  candidates: Candidate[]
  campaigns: Campaign[]
  /** Último conjunto mostrado, para resolver "estos / esos / ellos". */
  lastResultIds: string[]
}

// --- Utilidades -------------------------------------------------------------

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:()"']/g, ' ').replace(/\s+/g, ' ').trim()

const has = (q: string, re: RegExp) => re.test(q)

function campaignsById(ctx: AgentContext): Map<string, Campaign> {
  return new Map(ctx.campaigns.map((c) => [c.id, c]))
}

function nameOf(c: Candidate): string {
  return candidateName(c) || 'Sin nombre'
}

// Resuelve a qué puesto se refiere la frase (por su título), si lo menciona.
// Trocea por cualquier no-alfanumérico (así "Mozo/a" da "mozo") y compara por prefijo
// de 4 letras, para que "mozos" case con "mozo" y "albañiles" con "albañil".
function resolveScope(q: string, campaigns: Campaign[]): Campaign | null {
  const qWords = q.split(' ').filter((w) => w.length >= 4)
  let best: Campaign | null = null
  let bestScore = 0
  for (const c of campaigns) {
    const toks = norm(c.title).split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
    let score = 0
    for (const t of toks) {
      const p = t.slice(0, 4)
      if (qWords.some((w) => w.startsWith(p) || t.startsWith(w.slice(0, 4)))) score++
    }
    if (score > bestScore) { bestScore = score; best = c }
  }
  return bestScore > 0 ? best : null
}

function referencesPrevious(q: string): boolean {
  return has(q, /\b(estos|esos|esas|estas|ellos|ellas|los anteriores|la lista|esa lista|los de antes|a esos|a estos|les|selecci)/)
}

function extractLimit(q: string): number | null {
  const words: Record<string, number> = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }
  const w = q.match(/\b(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/)
  if (w) return words[w[1]]
  const d = q.match(/\b(\d{1,3})\b/)
  return d ? Number(d[1]) : null
}

// Matching de filtros (mismo criterio que la tabla del puesto).
function matchesValue(c: Candidate, vfs: ValueFilterLite[]): boolean {
  const byField = new Map<string, string[]>()
  for (const vf of vfs) byField.set(vf.fieldId, [...(byField.get(vf.fieldId) ?? []), vf.value])
  for (const [fid, vals] of byField) {
    const cv = c.answers[fid]
    const ok = vals.some((val) => {
      if (typeof cv === 'boolean') return (cv ? 'Sí' : 'No') === val
      if (Array.isArray(cv)) return cv.includes(val)
      return cv === val
    })
    if (!ok) return false
  }
  return true
}
function matchesNumber(c: Candidate, nfs: NumberFilter[]): boolean {
  for (const nf of nfs) {
    const raw = c.answers[nf.fieldId]
    const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
    if (Number.isNaN(n)) return false
    if (nf.min != null && n < nf.min) return false
    if (nf.max != null && n > nf.max) return false
  }
  return true
}

const STATUS_WORDS: [CandidateStatus, RegExp][] = [
  ['contratado', /contratad/],
  ['descartado', /descartad|rechaza|descarta/],
  ['entrevista', /entrevista/],
  ['contactado', /contactad|contacta/],
  ['nuevo', /\bnuevos?\b|sin revisar/],
]
function statusFromQuery(q: string): CandidateStatus[] {
  return STATUS_WORDS.filter(([, re]) => re.test(q)).map(([s]) => s)
}

interface FindResult {
  ids: string[]
  total: number
  scope: Campaign | null
  /** Estados, que se leen como adjetivo: "2 candidatos NUEVOS". */
  statusWords: string[]
  /** Filtros de formulario, que van con preposición: "con carnet". */
  filterWords: string[]
}

// Núcleo: encuentra candidatos según la frase (puesto + filtros + estado), rankeados
// por ajuste de Meridian. Filtra por candidato contra los campos de SU puesto, así
// funciona también sin acotar a un puesto.
function findCandidates(q: string, ctx: AgentContext, opts: { onlyNew?: boolean; limit?: number | null } = {}): FindResult {
  const byId = campaignsById(ctx)
  const scope = resolveScope(q, ctx.campaigns)
  const statuses = statusFromQuery(q)
  const onlyNew = opts.onlyNew ?? statuses.includes('nuevo')

  const understood: string[] = []
  const parseCache = new Map<string, { vf: ValueFilterLite[]; nf: NumberFilter[] }>()
  const parseFor = (camp: Campaign) => {
    let p = parseCache.get(camp.id)
    if (!p) {
      const r = parseMeridianQuery(q, camp.fields)
      p = { vf: r.valueFilters, nf: r.numberFilters }
      parseCache.set(camp.id, p)
      for (const u of r.understood) if (!understood.includes(u)) understood.push(u)
    }
    return p
  }

  let pool = ctx.candidates.filter((c) => byId.has(c.campaignId))
  if (scope) pool = pool.filter((c) => c.campaignId === scope.id)
  if (onlyNew) pool = pool.filter((c) => c.status === 'nuevo')
  else if (statuses.length) pool = pool.filter((c) => statuses.includes(c.status))

  const matched = pool.filter((c) => {
    const camp = byId.get(c.campaignId)!
    const { vf, nf } = parseFor(camp)
    return matchesValue(c, vf) && matchesNumber(c, nf)
  })

  matched.sort((a, b) => (candidateFit(b.ai) ?? -1) - (candidateFit(a.ai) ?? -1))
  const limit = opts.limit ?? extractLimit(q)
  const ids = (limit && limit > 0 ? matched.slice(0, limit) : matched).map((c) => c.id)

  // El estado lo contamos NOSOTROS, así que quitamos el que ya haya metido el
  // parser: si no, sale "con nuevos, Estado: Nuevo" (el mismo criterio dos veces).
  const filterWords = understood.filter((u) => !u.startsWith('Estado:'))
  const statusWords = onlyNew
    ? ['nuevos']
    : statuses.map((s) => STATUS_META[s].label.toLowerCase())

  return { ids, total: matched.length, scope, statusWords, filterWords }
}

// Resuelve el conjunto objetivo de una ACCIÓN: los anteriores si los referencia, o
// una búsqueda fresca.
function actionTargets(q: string, ctx: AgentContext): string[] {
  if (referencesPrevious(q) && ctx.lastResultIds.length) return ctx.lastResultIds
  const r = findCandidates(q, ctx)
  if (r.ids.length) return r.ids
  return ctx.lastResultIds
}

function listNames(ids: string[], ctx: AgentContext, max = 3): string {
  const names = ids.map((id) => ctx.candidates.find((c) => c.id === id)).filter(Boolean).map((c) => nameOf(c as Candidate))
  if (names.length === 0) return ''
  if (names.length <= max) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
  return `${names.slice(0, max).join(', ')} y ${names.length - max} más`
}

const CAND = (n: number, s = 'candidato', p = 'candidatos') => `${n} ${n === 1 ? s : p}`

// Sugerencias de arranque, ancladas a un puesto real con candidatos nuevos.
export function starterSuggestions(ctx: AgentContext): string[] {
  const withNew = ctx.campaigns
    .map((c) => ({ c, n: ctx.candidates.filter((x) => x.campaignId === c.id && x.status === 'nuevo').length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  const top = withNew[0]?.c
  const s: string[] = []
  if (top) s.push(`¿Quién encaja mejor para ${top.title}?`)
  s.push('Enséñame los nuevos con carnet y experiencia')
  s.push('¿Cómo va la contratación esta semana?')
  return s
}

// --- Intérprete principal ---------------------------------------------------

export function interpret(raw: string, ctx: AgentContext): MeridianResponse {
  const q = norm(raw)
  if (!q) return help(ctx)

  // Saludo / ayuda / capacidades
  if (has(q, /^(hola|buenas|hey|que tal|holi)\b/) || has(q, /(que puedes|qué puedes|en que me ayudas|ayuda|capacidad|para que sirves|qué haces|que haces)/)) {
    return help(ctx)
  }
  if (has(q, /(gracias|genial|perfecto|vale)/) && q.length < 16) {
    return { text: 'A mandar. ¿Seguimos?', cards: [], suggestions: starterSuggestions(ctx) }
  }

  // Exportar
  if (has(q, /(exporta|excel|descarga|descárga)/)) {
    const ids = actionTargets(q, ctx)
    if (!ids.length) return { text: '¿Qué candidatos quieres exportar? Dime un puesto o unos filtros y los preparo.', cards: [], suggestions: starterSuggestions(ctx) }
    return {
      text: `Te preparo un Excel con ${CAND(ids.length)}. Incluye sus respuestas, estado, valoración y el ajuste que he calculado.`,
      cards: [{ kind: 'candidates', ids: ids.slice(0, 5), hiddenCount: Math.max(0, ids.length - 5) }],
      action: { type: 'export', ids },
      actionLabel: `Exportar ${ids.length} a Excel`,
      suggestions: [],
      resultIds: ids,
    }
  }

  // Avisar / seguimiento. El aviso no es una feature aparte: avisar es lo que ya
  // hace Actividad en cuanto se envía una comprobación. Así que en vez de fingir
  // una "vigilancia" que no existe, esto reconduce al envío real.
  if (has(q, /(avisa|avísame|avisame|recuerda|recuérdame|recuerdame|seguimiento|cuando respondan|estate atento|vigila)/)) {
    const ids = actionTargets(q, ctx)
    if (!ids.length) return { text: 'Claro. ¿A quién le sigo la pista? Dime un puesto o unos candidatos primero.', cards: [], suggestions: starterSuggestions(ctx) }
    return {
      text: `Para poder avisarte necesito escribirles: les pregunto si siguen interesados y, en cuanto contesten, te lo cuento aquí y en Actividad. ¿Les escribo a ${CAND(ids.length)}?`,
      cards: [{ kind: 'candidates', ids: ids.slice(0, 4), hiddenCount: Math.max(0, ids.length - 4) }],
      suggestions: ['Sí, escríbeles', 'Márcalos como contactados'],
      resultIds: ids,
    }
  }

  // Contactar (correo / interés)
  if (has(q, /(correo|email|mail|escrib|manda|env[ií]a|contacta|pregunta.*interes|pregúntales|preguntales|sigue.*interesad|siguen interesad)/) && !has(q, /whatsapp/)) {
    const ids = actionTargets(q, ctx)
    if (!ids.length) return { text: '¿A quién quieres escribir? Enséñame primero un grupo, por ejemplo "los mozos con carnet".', cards: [], suggestions: starterSuggestions(ctx) }
    // Sin texto ni borrador: el panel lo replantea con la elegibilidad real y
    // enseña el correo que sale de verdad (interestEmailPreview). Aquí solo se
    // reconoce la intención y a quién afecta.
    return {
      text: '',
      cards: [],
      action: { type: 'sendInterest', ids },
      suggestions: [],
      resultIds: ids,
    }
  }

  // WhatsApp / redactar mensaje individual
  if (has(q, /(whatsapp|wasap|mensaje para|redacta|redáctame|escribe un mensaje|un mensaje para)/)) {
    const target = ctx.candidates.find((c) => q.includes(norm(nameOf(c)).split(' ')[0])) ?? ctx.candidates.find((c) => ctx.lastResultIds.includes(c.id))
    const name = target ? nameOf(target).split(' ')[0] : 'el candidato'
    return {
      text: `Aquí tienes un mensaje de WhatsApp para ${name}. Cópialo y ajústalo a tu tono:`,
      cards: [{ kind: 'draft', channel: 'whatsapp', body: whatsappDraft(name), to: name }],
      suggestions: ['Escríbeme uno más formal', 'Prepárame también un correo'],
    }
  }

  // Cambiar estado
  const statusIntent = statusChangeIntent(q)
  if (statusIntent) {
    const ids = actionTargets(q, ctx)
    if (!ids.length) return { text: `¿A qué candidatos los marco como ${STATUS_META[statusIntent].label.toLowerCase()}? Enséñame un grupo primero.`, cards: [], suggestions: starterSuggestions(ctx) }
    return {
      text: `¿Marco a ${CAND(ids.length)} (${listNames(ids, ctx)}) como ${STATUS_META[statusIntent].label.toLowerCase()}?`,
      cards: [{ kind: 'candidates', ids: ids.slice(0, 5), hiddenCount: Math.max(0, ids.length - 5) }],
      action: { type: 'setStatus', ids, status: statusIntent },
      actionLabel: `Marcar ${ids.length} como ${STATUS_META[statusIntent].label.toLowerCase()}`,
      suggestions: [],
      resultIds: ids,
    }
  }

  // Insights / cómo va
  if (has(q, /(como va|cómo va|cuantos|cuántos|resumen|informe|balance|semana|contrataci|que puesto|qué puesto|mas atencion|más atención|estado de|pulso)/)) {
    return insights(q, ctx)
  }

  // Buscar candidatos (por defecto si menciona puesto, filtros o "quién/enséñame")
  return findResponse(q, raw, ctx)
}

// --- Constructores de respuesta --------------------------------------------

function help(ctx: AgentContext): MeridianResponse {
  return {
    text:
      'Soy Meridian, tu mano derecha para contratar. Puedo buscarte candidatos por lo que necesites, ' +
      'resumírtelos y ordenarlos por lo bien que encajan, escribirles para ver si siguen interesados, ' +
      'cambiarles el estado, avisarte cuando respondan y darte el pulso de cada puesto. Pídemelo con tus palabras.',
    cards: [],
    suggestions: starterSuggestions(ctx),
  }
}

// El estado se lee como adjetivo ("2 candidatos nuevos") y los filtros del
// formulario con preposición ("con carnet"). Mezclarlos daba "con nuevos".
const estado = (r: FindResult) => (r.statusWords.length ? ` ${r.statusWords.join(' y ')}` : '')
const filtros = (r: FindResult) => (r.filterWords.length ? ` con ${r.filterWords.join(', ')}` : '')
const criterios = (r: FindResult) => `${estado(r)}${filtros(r)}`

function findResponse(q: string, _raw: string, ctx: AgentContext): MeridianResponse {
  const r = findCandidates(q, ctx)
  if (r.total === 0) {
    const what = criterios(r)
    const donde = r.scope ? ` en ${r.scope.title}` : ''
    return {
      text: `No he encontrado candidatos${what}${donde}. Prueba a aflojar algún filtro, o dime otro puesto.`,
      cards: [],
      suggestions: starterSuggestions(ctx),
    }
  }
  const shown = r.ids.slice(0, 6)
  const hidden = r.total - shown.length
  const donde = r.scope ? ` de ${r.scope.title}` : ''

  const bien = r.ids.filter((id) => (candidateFit(ctx.candidates.find((c) => c.id === id)?.ai) ?? -1) >= 70).length
  const destaco = bien > 0 ? ` ${bien === 1 ? 'Uno encaja' : `${bien} encajan`} bien.` : ''
  return {
    text: `He encontrado ${CAND(r.total)}${estado(r)}${donde}${filtros(r)}, ordenados por lo bien que encajan.${destaco}`,
    cards: [{ kind: 'candidates', ids: shown, hiddenCount: Math.max(0, hidden) }],
    suggestions: ['Mándales un correo', 'Márcalos como contactados', 'Expórtalos a Excel', 'Avísame cuando respondan'],
    resultIds: r.ids,
  }
}

function insights(_q: string, ctx: AgentContext): MeridianResponse {
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const nuevaSemana = ctx.candidates.filter((c) => new Date(c.submittedAt).getTime() >= weekAgo).length
  const nuevos = ctx.candidates.filter((c) => c.status === 'nuevo').length
  const contratados = ctx.candidates.filter((c) => c.status === 'contratado').length
  const entrevista = ctx.candidates.filter((c) => c.status === 'entrevista').length

  // Puesto que más atención pide: más nuevos sin revisar.
  const porPuesto = ctx.campaigns
    .map((c) => ({ c, nuevos: ctx.candidates.filter((x) => x.campaignId === c.id && x.status === 'nuevo').length }))
    .sort((a, b) => b.nuevos - a.nuevos)
  const foco = porPuesto[0]

  const items = [
    { label: 'Nuevas esta semana', value: String(nuevaSemana) },
    { label: 'Sin revisar', value: String(nuevos) },
    { label: 'En entrevista', value: String(entrevista) },
    { label: 'Contratados', value: String(contratados) },
  ]
  const focoTxt = foco && foco.nuevos > 0
    ? ` El que más atención pide es ${foco.c.title}, con ${CAND(foco.nuevos, 'candidatura nueva', 'candidaturas nuevas')} sin revisar.`
    : ' Vas al día con las revisiones.'
  return {
    text: `Esta semana han entrado ${CAND(nuevaSemana, 'candidatura', 'candidaturas')}. Tienes ${nuevos} sin revisar y ${contratados} contratados.${focoTxt}`,
    cards: [{ kind: 'insight', items }],
    suggestions: foco && foco.nuevos > 0 ? [`Enséñame los mejores de ${foco.c.title}`, 'Los nuevos con carnet'] : starterSuggestions(ctx),
  }
}

function statusChangeIntent(q: string): CandidateStatus | null {
  if (!has(q, /(marca|márcalos|marcalos|pon|ponlos|cambia|mover|pasa a|descarta|rechaza)/)) return null
  if (has(q, /contratad/)) return 'contratado'
  if (has(q, /descartad|rechaza|descarta/)) return 'descartado'
  if (has(q, /entrevista/)) return 'entrevista'
  if (has(q, /contactad|contacta/)) return 'contactado'
  if (has(q, /\bnuevos?\b/)) return 'nuevo'
  return null
}

function whatsappDraft(name: string): string {
  return `Hola ${name}, te escribo por tu candidatura. Nos ha encajado tu perfil y nos gustaría hablar contigo. ¿Cuándo te viene bien una llamada rápida?`
}

export { fitTier }

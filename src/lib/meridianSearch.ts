// Búsqueda en lenguaje natural de Meridian (PROTOTIPO, frontend puro).
// NO es NLP real: es un parser HEURÍSTICO que mapea una frase a los filtros que ya
// existen (valueFilters / numberFilters / estados), leyendo los campos del puesto.
// Es suficiente para que en la demo se sienta que "escribes en cristiano y entiende".
// El día que exista backend, esto se sustituye por una llamada real al modelo.

import type { CandidateStatus, FormField, NumberFilter } from './types'
import { STATUS_META } from './types'

export interface ValueFilterLite {
  fieldId: string
  label: string
  value: string
}

export interface MeridianQuery {
  valueFilters: ValueFilterLite[]
  numberFilters: NumberFilter[]
  statuses: CandidateStatus[]
  /** Frases legibles de lo que Meridian aplicó ("Carnet de conducir B: Sí"). */
  understood: string[]
  /** Palabras notables que no supo traducir a un filtro ("cerca"). */
  unmatched: string[]
  empty: boolean
}

const STOP = new Set([
  'de', 'la', 'el', 'los', 'las', 'para', 'por', 'en', 'con', 'y', 'o', 'un', 'una',
  'tu', 'tus', 'que', 'tienes', 'tiene', 'del', 'al', 'su', 'sus', 'me', 'ensena',
  'ensename', 'muestra', 'muestrame', 'dame', 'quiero', 'ver', 'busca', 'buscar',
  'candidatos', 'candidato', 'gente', 'personas', 'sea', 'sean', 'esten', 'estan',
  'mas', 'menos', 'anos', 'ano',
])

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Tokens con significado de una etiqueta (para detectar si la frase menciona el campo).
function labelTokens(label: string): string[] {
  return norm(label)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOP.has(w))
}

function mentions(queryTokens: string[], tokens: string[]): boolean {
  return tokens.some((t) => queryTokens.includes(t))
}

// Polaridad para un boolean: "sin X" o "no X" -> No; si no, Sí.
function polarity(queryWords: string[], tokens: string[]): 'Sí' | 'No' {
  for (let i = 0; i < queryWords.length; i++) {
    if (!tokens.includes(queryWords[i])) continue
    const prev = queryWords.slice(Math.max(0, i - 2), i)
    if (prev.includes('sin') || prev.includes('no')) return 'No'
  }
  return 'Sí'
}

function parseRange(q: string, mentioned: boolean): { min: number | null; max: number | null } | null {
  const between = q.match(/entre\s+(\d+)\s+y\s+(\d+)/)
  if (between) return { min: Number(between[1]), max: Number(between[2]) }
  const min = q.match(/(?:mas de|min(?:imo)?|al menos|desde|a partir de)\s*(\d+)/) || q.match(/\+\s*(\d+)/) || q.match(/(\d+)\s*(?:o mas|\+)/)
  if (min) return { min: Number(min[1]), max: null }
  const max = q.match(/(?:menos de|hasta|maximo|como mucho)\s*(\d+)/)
  if (max) return { min: null, max: Number(max[1]) }
  // Campo mencionado + un número suelto: se interpreta como "al menos N".
  if (mentioned) {
    const bare = q.match(/(\d+)/)
    if (bare) return { min: Number(bare[1]), max: null }
  }
  return null
}

const STATUS_WORDS: [CandidateStatus, string[]][] = [
  ['nuevo', ['nuevo', 'nuevos', 'sin revisar']],
  ['contactado', ['contactado', 'contactados']],
  ['entrevista', ['entrevista', 'entrevistas', 'entrevistados']],
  ['contratado', ['contratado', 'contratados']],
  ['descartado', ['descartado', 'descartados']],
]

export function parseMeridianQuery(raw: string, fields: FormField[]): MeridianQuery {
  const q = norm(raw)
  const words = q.split(' ').filter(Boolean)
  const qTokens = new Set(words)
  const queryTokens = [...qTokens]

  const valueFilters: ValueFilterLite[] = []
  const numberFilters: NumberFilter[] = []
  const statuses: CandidateStatus[] = []
  const understood: string[] = []
  const consumed = new Set<string>() // palabras ya explicadas por algún filtro

  const markConsumed = (...ws: string[]) => ws.forEach((w) => consumed.add(w))

  // Estados
  for (const [st, kws] of STATUS_WORDS) {
    if (kws.some((k) => (k.includes(' ') ? q.includes(k) : qTokens.has(k)))) {
      statuses.push(st)
      understood.push(`Estado: ${STATUS_META[st].label}`)
      kws.forEach((k) => k.split(' ').forEach((w) => markConsumed(w)))
    }
  }

  for (const f of fields) {
    const tokens = labelTokens(f.label)
    const mentioned = mentions(queryTokens, tokens)

    if (f.type === 'boolean') {
      if (mentioned) {
        const val = polarity(words, tokens)
        valueFilters.push({ fieldId: f.id, label: f.label, value: val })
        understood.push(`${cleanLabel(f.label)}: ${val}`)
        markConsumed(...tokens)
      }
    } else if (f.type === 'select' || f.type === 'multiselect') {
      for (const opt of f.options ?? []) {
        const on = norm(opt)
        if (on && (q.includes(on) || on.split(' ').every((w) => qTokens.has(w)))) {
          valueFilters.push({ fieldId: f.id, label: f.label, value: opt })
          understood.push(`${cleanLabel(f.label)}: ${opt}`)
          on.split(' ').forEach((w) => markConsumed(w))
        }
      }
    } else if (f.type === 'number') {
      const range = parseRange(q, mentioned)
      if (mentioned && range) {
        numberFilters.push({ fieldId: f.id, label: f.label, min: range.min, max: range.max })
        const txt = range.min != null && range.max != null
          ? `${range.min} a ${range.max}`
          : range.min != null ? `≥ ${range.min}` : `≤ ${range.max}`
        understood.push(`${cleanLabel(f.label)} ${txt}`)
        markConsumed(...tokens)
        words.filter((w) => /^\d+$/.test(w)).forEach((w) => markConsumed(w))
      }
    }
  }

  // Palabras notables que no se tradujeron a ningún filtro.
  const unmatched = queryTokens.filter(
    (w) => w.length >= 4 && !STOP.has(w) && !consumed.has(w) && !/^\d+$/.test(w),
  )

  return {
    valueFilters,
    numberFilters,
    statuses,
    understood,
    unmatched,
    empty: understood.length === 0,
  }
}

// Quita signos de interrogación y recorta la etiqueta para el resumen de "entendido".
function cleanLabel(label: string): string {
  return label.replace(/[¿?]/g, '').trim()
}

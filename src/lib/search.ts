// Búsqueda tolerante de candidatos en cliente. La usa la demo (sin BD) y también el
// panel real como resultado INSTANTÁNEO mientras llega la respuesta del RPC (o si falla).
// Espeja la lógica de search_candidates: normaliza (minúsculas, sin acentos/ñ), tolera
// coincidencia parcial/prefijo, erratas (trigramas) y teléfono por dígitos.
import type { Candidate } from './types'
import { candidateName } from './format'

const COMBINING = /[̀-ͯ]/g

/** Minúsculas y sin acentos/ñ. NFD descompone "ñ"->"n"+tilde y los acentos; se quitan
 *  las marcas combinantes. Igual que la normalización del RPC (lower + unaccent). */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING, '').trim()
}

/** Solo los dígitos (para teléfono: ignora espacios, guiones, +34...). */
export function digitsOf(s: string): string {
  return s.replace(/\D/g, '')
}

function phoneOf(c: Candidate): string {
  const v = c.answers['telefono']
  return typeof v === 'string' ? v : ''
}

/** Texto de búsqueda del candidato: nombre + apellidos normalizados, y dígitos del tel. */
function candidateText(c: Candidate): string {
  return `${normalizeSearch(candidateName(c))} ${digitsOf(phoneOf(c))}`.trim()
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `
  const out = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  return out
}

function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0
  const A = trigrams(a)
  const B = trigrams(b)
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

/** Puntuación 0..n de cómo de bien coincide el candidato con la query (0 = no coincide).
 *  Mayor = mejor coincidencia, para ordenar por relevancia. */
export function searchScore(c: Candidate, query: string): number {
  const nq = normalizeSearch(query)
  if (!nq) return 0
  const text = candidateText(c)
  const dq = digitsOf(query)
  // Teléfono por dígitos (la coincidencia más fuerte).
  if (dq.length >= 3 && digitsOf(phoneOf(c)).includes(dq)) return 2
  // Substring / prefijo del nombre.
  if (text.includes(nq)) return text.startsWith(nq) ? 1.6 : 1.2
  // Por palabras: prefijo de palabra, o similitud por trigramas (erratas).
  let best = 0
  for (const w of text.split(/\s+/)) {
    if (w.startsWith(nq)) return 1.1
    best = Math.max(best, trigramSim(nq, w))
  }
  return best >= 0.35 ? best : 0
}

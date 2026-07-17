// Formato locale ES: fechas dd/mm/aaaa (relativas < 7 días), miles con '.'.

import type { Candidate } from './types'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function relativeDate(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const diff = now - d.getTime()
  const min = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  if (hours < 24) return `hace ${hours} h`
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  // Absoluta a partir de 7 días
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export function fullDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function fullDateTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${fullDate(iso)} a las ${hh}:${mi}`
}

/** Hora corta HH:mm para meta dentro de burbujas de chat. */
export function clockTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

export function miles(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}

// Teléfono SOLO para mostrar: agrupa los dígitos de 3 en 3 (XXX XXX XXX) aunque
// el candidato los escriba pegados. Reconoce el prefijo español (+34 / 0034, con
// o sin espacio) y formatea los 9 dígitos nacionales; otro prefijo internacional
// conserva el '+'. NO usar para enlaces tel:/wa.me, que quieren los dígitos crudos.
export function formatPhone(raw: string): string {
  if (!raw) return raw
  const trimmed = raw.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  let prefix = ''
  if (digits.length === 11 && digits.startsWith('34')) {
    prefix = '+34 '
    digits = digits.slice(2)
  } else if (digits.length === 13 && digits.startsWith('0034')) {
    prefix = '+34 '
    digits = digits.slice(4)
  } else if (trimmed.startsWith('+')) {
    prefix = '+' // otro país: conserva el '+' y agrupa el resto
  }
  return prefix + (digits.match(/\d{1,3}/g) ?? []).join(' ')
}

// Partículas de apellidos españoles que van en minúscula salvo al inicio del nombre
// ("Juan de la Torre", pero "De la Torre" si es lo primero que se muestra).
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

// Capitaliza cada palabra (primera letra mayúscula, resto minúscula) respetando
// guiones y apóstrofes ("maria-jose" -> "Maria-Jose", "o'connor" -> "O'Connor").
// El candidato puede escribir su nombre en cualquier caja (todo minúsculas, todo
// mayúsculas...); se muestra siempre bien capitalizado.
export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && PARTICULAS.has(word)) return word
      return word.replace(/(^|[-'])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase())
    })
    .join(' ')
}

// Nombre a mostrar del candidato. Combina el campo base 'nombre' con 'apellidos'
// cuando el formulario los pide por separado; si no hay 'apellidos', devuelve solo
// el nombre. Compatible con candidaturas antiguas (sin 'apellidos'). Se capitaliza
// siempre, aunque el candidato lo haya escrito en minúsculas o en mayúsculas.
export function candidateName(c: Candidate): string {
  const part = (id: string) => {
    const v = c.answers[id]
    return typeof v === 'string' ? v.trim() : ''
  }
  const raw = [part('nombre'), part('apellidos')].filter(Boolean).join(' ')
  return raw ? toTitleCase(raw) : raw
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Candidato en estado "nuevo" recibido en las últimas 48 h (prioridad de contacto). */
export function isFreshNuevo(c: Pick<Candidate, 'status' | 'submittedAt'>, now = Date.now()): boolean {
  if (c.status !== 'nuevo') return false
  return now - new Date(c.submittedAt).getTime() < 48 * 60 * 60 * 1000
}

// Pluralización mínima en español
export function plural(n: number, singular: string, plural: string): string {
  return `${miles(n)} ${n === 1 ? singular : plural}`
}

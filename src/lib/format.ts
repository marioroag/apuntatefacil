// Formato locale ES: fechas dd/mm/aaaa (relativas < 7 días), miles con '.'.

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

export function miles(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Pluralización mínima en español
export function plural(n: number, singular: string, plural: string): string {
  return `${miles(n)} ${n === 1 ? singular : plural}`
}

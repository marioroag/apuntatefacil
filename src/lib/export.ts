import type { Campaign, Candidate } from './types'
import { STATUS_META, SOURCE_META } from './types'
import { fullDateTime } from './format'

// xlsx es pesado (~400 KB) y solo hace falta al exportar. Se carga bajo demanda
// con import() dinámico para que no entre en el bundle inicial del panel.

function answerToCell(v: Candidate['answers'][string] | undefined): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/**
 * Exporta los candidatos (ya filtrados) de un puesto a un .xlsx real.
 * Las columnas salen de los campos del formulario, en su orden, más metadatos.
 */
export async function exportCandidatesToExcel(campaign: Campaign, candidates: Candidate[]): Promise<string> {
  const XLSX = await import('xlsx')
  const header = [
    ...campaign.fields.map((f) => f.label),
    'Estado',
    'Valoración',
    'Origen',
    'Recibida',
    'Notas',
  ]

  const rows = candidates.map((c) => [
    ...campaign.fields.map((f) => answerToCell(c.answers[f.id])),
    STATUS_META[c.status].label,
    c.rating ? '★'.repeat(c.rating) : '',
    SOURCE_META[c.source].label,
    fullDateTime(c.submittedAt),
    c.notes ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  // Anchos de columna razonables
  ws['!cols'] = header.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 12), 40) }
  })
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  const sheetName = campaign.title.slice(0, 28).replace(/[\\/?*[\]:]/g, '')
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Candidatos')

  const today = new Date()
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`
  const filename = `candidatos-${campaign.slug}-${stamp}.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}

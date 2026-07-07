import type { Campaign, Candidate, Tag } from './types'
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
 * Filas señuelo de las candidaturas BLOQUEADAS (plan gratuito, sobre el tope).
 * Salen en el .xlsx con la MISMA estructura de columnas que una candidatura real,
 * pero sin ningún dato personal: nombre = "Candidatura bloqueada", el resto de
 * campos redactados (•••) y la fecha de entrada real visible. El objetivo es que
 * el registro esté completo y tiente a mejorar el plan, nunca filtrar datos
 * (la RLS ya impide leer la fila real; aquí solo hay la fecha).
 */
function lockedRows(campaign: Campaign, lockedDates: string[], colCount: number): string[][] {
  return lockedDates.map((iso) => {
    const row = new Array<string>(colCount).fill('')
    // Campos del formulario: el primero rotula el bloqueo, el resto va redactado
    // para que se vean los apartados que te estás perdiendo.
    campaign.fields.forEach((_, i) => {
      row[i] = i === 0 ? 'Candidatura bloqueada' : '•••'
    })
    const estadoCol = campaign.fields.length
    row[estadoCol] = 'Bloqueada' // Estado
    row[estadoCol + 4] = fullDateTime(iso) // Recibida (la fecha sí es real)
    row[estadoCol + 5] = 'Mejora tu plan para ver esta candidatura.' // Notas
    return row
  })
}

/**
 * Exporta los candidatos (ya filtrados) de un puesto a un .xlsx real.
 * Las columnas salen de los campos del formulario, en su orden, más metadatos.
 * `lockedDates` (opcional): fechas de entrada de las candidaturas bloqueadas del
 * plan gratuito; salen como filas señuelo arriba del todo (las más recientes).
 */
export async function exportCandidatesToExcel(
  campaign: Campaign,
  candidates: Candidate[],
  tags: Tag[] = [],
  lockedDates: string[] = [],
): Promise<string> {
  const XLSX = await import('xlsx')
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const header = [
    ...campaign.fields.map((f) => f.label),
    'Estado',
    'Valoración',
    'Etiquetas',
    'Origen',
    'Recibida',
    'Notas',
  ]

  const realRows = candidates.map((c) => [
    ...campaign.fields.map((f) => answerToCell(c.answers[f.id])),
    STATUS_META[c.status].label,
    c.rating ? '★'.repeat(c.rating) : '',
    c.tagIds.map((id) => tagName.get(id)).filter(Boolean).join('; '),
    SOURCE_META[c.source].label,
    fullDateTime(c.submittedAt),
    c.notes ?? '',
  ])

  // Las bloqueadas son las más recientes: van arriba, como en el panel.
  const rows = [...lockedRows(campaign, lockedDates, header.length), ...realRows]

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

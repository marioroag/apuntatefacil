import type { Campaign, Candidate, CandidateComment, Tag } from './types'
import { STATUS_META, SOURCE_META } from './types'
import { fullDateTime, personLabel } from './format'

// xlsx es pesado (~400 KB) y solo hace falta al exportar. Se carga bajo demanda
// con import() dinámico para que no entre en el bundle inicial del panel.

function answerToCell(v: Candidate['answers'][string] | undefined): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/**
 * El hilo de equipo en una celda: una línea por mensaje, con quién y cuándo. En
 * Excel los saltos de línea se ven si la celda tiene ajuste de texto; aun sin él
 * el contenido está, que es lo que importa para no perder nada al exportar.
 */
function threadToCell(comments: CandidateComment[] | undefined): string {
  if (!comments?.length) return ''
  return comments
    .map((c) => `${c.isNote ? 'Nota anterior' : personLabel(c.authorEmail)} (${fullDateTime(c.createdAt)}): ${c.body}`)
    .join('\n')
}

/**
 * Filas señuelo de las candidaturas BLOQUEADAS (plan gratuito, sobre el tope).
 * Salen en el .xlsx con la MISMA estructura de columnas que una candidatura real,
 * pero sin ningún dato personal: nombre = "Candidatura bloqueada", el resto de
 * campos redactados (•••) y la fecha de entrada real visible. El objetivo es que
 * el registro esté completo y tiente a mejorar el plan, nunca filtrar datos
 * (la RLS ya impide leer la fila real; aquí solo hay la fecha).
 */
function lockedRows(campaign: Campaign, lockedDates: string[], header: string[]): string[][] {
  // Por NOMBRE de columna, no por desplazamiento: la versión anterior escribía en
  // `estadoCol + 4` y `+ 5`, y cualquier columna que se añadiera o quitara
  // descolocaba estas filas en silencio, sin error y sin test que lo viera.
  const col = (name: string) => header.indexOf(name)
  return lockedDates.map((iso) => {
    const row = new Array<string>(header.length).fill('')
    // Campos del formulario: el primero rotula el bloqueo, el resto va redactado
    // para que se vean los apartados que te estás perdiendo.
    campaign.fields.forEach((_, i) => {
      row[i] = i === 0 ? 'Candidatura bloqueada' : '•••'
    })
    row[col('Estado')] = 'Bloqueada'
    row[col('Recibida')] = fullDateTime(iso) // la fecha sí es real
    row[col('Conversación')] = 'Añade tu método de pago para ver esta candidatura.'
    return row
  })
}

/**
 * Exporta los candidatos (ya filtrados) de un puesto a un .xlsx real.
 * Las columnas salen de los campos del formulario, en su orden, más metadatos.
 * `lockedDates` (opcional): fechas de entrada de las candidaturas bloqueadas del
 * plan gratuito; salen como filas señuelo arriba del todo (las más recientes).
 */
/**
 * La hoja como matriz (cabecera + filas). Separado del volcado a fichero para
 * poder comprobarlo con un test: es donde se rompe en silencio, sin error y sin
 * que nadie lo vea hasta que abre el Excel.
 */
export function buildSheet(
  campaign: Campaign,
  candidates: Candidate[],
  tags: Tag[] = [],
  lockedDates: string[] = [],
  comments: Record<string, CandidateComment[]> = {},
): { header: string[]; rows: string[][] } {
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const header = [
    ...campaign.fields.map((f) => f.label),
    'Estado',
    'Favorito',
    'Etiquetas',
    'Origen',
    'Recibida',
    'Conversación',
  ]

  const realRows = candidates.map((c) => [
    ...campaign.fields.map((f) => answerToCell(c.answers[f.id])),
    STATUS_META[c.status].label,
    c.favorito ? 'Sí' : '',
    c.tagIds.map((id) => tagName.get(id)).filter(Boolean).join('; '),
    SOURCE_META[c.source].label,
    fullDateTime(c.submittedAt),
    // Lo que escribió el equipo. Antes era el campo de notas; ahora es el hilo,
    // y sigue saliendo en el Excel: es su trabajo, y un export que se lo dejara
    // dentro sería una pérdida de datos silenciosa.
    threadToCell(comments[c.id]),
  ])

  // Las bloqueadas son las más recientes: van arriba, como en el panel.
  return { header, rows: [...lockedRows(campaign, lockedDates, header), ...realRows] }
}

export async function exportCandidatesToExcel(
  campaign: Campaign,
  candidates: Candidate[],
  tags: Tag[] = [],
  lockedDates: string[] = [],
  comments: Record<string, CandidateComment[]> = {},
): Promise<string> {
  const XLSX = await import('xlsx')
  const { header, rows } = buildSheet(campaign, candidates, tags, lockedDates, comments)

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

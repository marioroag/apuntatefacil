import type { Campaign, Candidate, CandidateComment, CandidateDocument, Tag } from './types'
import { STATUS_META, SOURCE_META } from './types'
import { fullDateTime, personLabel, candidateName } from './format'
import { supabase } from './supabase'
import { crearZip, nombreSeguro, nombreUnico } from './zip'

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

/* ---------------------------------------------------------------------------
   TRES FORMAS DE SACAR LO MISMO, Y LAS TRES DE LA MISMA FUENTE.
   ---------------------------------------------------------------------------
   XLSX, CSV y el zip de documentos salen de `buildSheet`, que es quien decide QUÉ
   columnas hay y en qué orden. Escribir las columnas otra vez para el CSV era la
   forma segura de que dentro de tres meses el Excel y el CSV tuvieran datos
   distintos, que es justo el fallo que nadie mira hasta que un cliente lo dice.
--------------------------------------------------------------------------- */

/** `candidatos-<puesto>-<fecha>.<ext>`, igual para los tres formatos. */
function nombreFichero(campaign: Campaign, ext: string): string {
  const hoy = new Date()
  const stamp = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return `candidatos-${campaign.slug}-${stamp}.${ext}`
}

/** Baja un blob con el nombre dado. Lo comparten el CSV y el zip. */
function descargar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sin revocar, cada exportación deja el fichero entero retenido en memoria.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Una celda de CSV: se entrecomilla solo si hace falta y las comillas de dentro
 * se duplican, que es lo que dice el RFC 4180. Los saltos de línea NO se quitan
 * (el hilo del equipo tiene varios): entre comillas son válidos y cualquier
 * lector serio los entiende.
 */
export function celdaCsv(v: string): string {
  // INYECCIÓN DE FÓRMULAS. Lo que va en estas celdas lo escribe el candidato
  // anónimo (sus respuestas) y el equipo (las notas), y Excel, LibreOffice y
  // Google Sheets evalúan como fórmula cualquier celda de un CSV que empiece
  // por `=`, `+`, `-` o `@` (y por tabulador o retorno, que son la forma de
  // colar el prefijo). Con `=HYPERLINK(...)` o un DDE eso es sacar datos de la
  // hoja o ejecutar un comando en el ordenador de la empresa al abrir el
  // fichero. Se neutraliza con una comilla simple delante, que es lo que hacen
  // los propios programas de hoja de cálculo para "esto es texto", y la celda
  // se entrecomilla siempre en ese caso. El XLSX no lo necesita: SheetJS
  // escribe las cadenas como texto, nunca como fórmula. (Auditoría, sep 2026.)
  const peligrosa = /^[=+\-@\t\r]/.test(v)
  const texto = peligrosa ? `'${v}` : v
  return peligrosa || /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * CSV, PARA LLEVARSE LOS DATOS A OTRO SITIO.
 *
 * SEPARADO POR COMAS, que es el estándar de intercambio, y **eso tiene una
 * consecuencia que hay que saber**: el Excel en español espera punto y coma, así
 * que abriendo este fichero de dos clics lo mete todo en una columna. No se
 * arregla cambiando el separador, se arregla eligiendo bien el formato: para
 * Excel está el XLSX, que es la fila de encima del menú y sale ya con anchos y
 * filtros. El CSV es para meter la lista en OTRO programa (un ATS, un CRM, una
 * hoja de Google), y ahí la coma es lo que se espera.
 *
 * Con BOM de UTF-8: sin él, cualquier "ñ" o "í" llega rota a media Europa.
 */
export function exportCandidatesToCsv(
  campaign: Campaign,
  candidates: Candidate[],
  tags: Tag[] = [],
  lockedDates: string[] = [],
  comments: Record<string, CandidateComment[]> = {},
): string {
  const { header, rows } = buildSheet(campaign, candidates, tags, lockedDates, comments)
  const texto = [header, ...rows].map((fila) => fila.map((c) => celdaCsv(String(c ?? ''))).join(',')).join('\r\n')
  const filename = nombreFichero(campaign, 'csv')
  descargar(new Blob([`\uFEFF${texto}`], { type: 'text/csv;charset=utf-8' }), filename)
  return filename
}

/** Techo del zip en memoria: por encima, se pide exportar en dos partes. */
export const ZIP_MAX_BYTES_EXPORT = 1024 * 1024 * 1024
export const ZIP_MAX_ENTRADAS_EXPORT = 20000

/** Lo que devuelve el zip de documentos, para que quien llama pueda contarlo. */
export type ResultadoDocs = { filename: string; incluidos: number; fallidos: number }

/** Cómo se llama un documento DENTRO de la carpeta de su persona. El `nombre` de
 *  la fila ya es su tipo ("Carnet C.pdf", "Contrato firmado"), así que se le quita
 *  la extensión que traiga y se le pone la de la RUTA, que es la del fichero de
 *  verdad: sin ella el sistema no sabría con qué abrirlo. */
function nombreEnCarpeta(nombre: string, path: string): { base: string; ext: string } {
  return {
    base: nombreSeguro(nombre.replace(/\.[a-z0-9]+$/i, '')),
    ext: (path.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase(),
  }
}

/**
 * TODOS LOS DOCUMENTOS DE UNA SELECCIÓN, UNA CARPETA POR PERSONA.
 *
 * Los ficheros viven en un bucket PRIVADO, así que hay que firmar cada uno. Se
 * firman TODOS DE UNA VEZ (`createSignedUrls`) y no de uno en uno: con ciento
 * cuarenta candidatos eso es una petición en vez de ciento cuarenta.
 *
 * **SON TODOS, no solo el CV** (sep 2026). Desde ago 2026 una candidatura guarda
 * sus ficheros en DOS sitios (el primero en `candidates.cv_path` y el resto en
 * `candidate_documents`) y esto solo se llevaba el primero, mientras la fila del
 * menú decía "CV y adjuntos": el carnet que pedía el formulario y el contrato que
 * subió el equipo se quedaban dentro. Los extra se piden en UNA consulta por
 * lotes (`loadDocumentsFor`), no uno por candidato.
 *
 * **UNA CARPETA POR PERSONA, y por eso el fichero ya no se llama como ella.** Con
 * un solo nivel, tres documentos de Ana serían "Ana Garcia.pdf", "Ana Garcia
 * (2).pdf" y "Ana Garcia (3).pdf", o sea que para saber cuál es el contrato hay
 * que abrirlos. Con la carpeta, el nombre de cada uno vuelve a poder decir lo
 * único que no está escrito en ningún otro sitio: QUÉ documento es. Los repetidos
 * se numeran dos veces, la carpeta entre personas (dos "Juan García") y el
 * fichero dentro de ella (dos "Carnet"), porque son dos colisiones distintas.
 *
 * **Lo que falla no rompe la exportación, se cuenta.** Un CV borrado del bucket o
 * una descarga cortada no puede dejarte sin el zip entero: se salta y quien llama
 * dice cuántos entraron y cuántos no. Un zip con 138 de 140 es útil; un error
 * seco después de esperar, no.
 */
export async function exportCandidateDocs(
  campaign: Campaign,
  candidates: Candidate[],
  cargarDocs: (ids: string[]) => Promise<CandidateDocument[]>,
): Promise<ResultadoDocs> {
  if (!candidates.length) return { filename: '', incluidos: 0, fallidos: 0 }

  // Los extra, agrupados por candidato. La consulta la hace el store, que es
  // quien habla con los datos; aquí solo se arma el paquete.
  const extra = new Map<string, CandidateDocument[]>()
  for (const d of await cargarDocs(candidates.map((c) => c.id))) {
    const ya = extra.get(d.candidateId)
    if (ya) ya.push(d)
    else extra.set(d.candidateId, [d])
  }

  // Qué se lleva cada persona, en el orden en que se ve en su ficha: el CV
  // primero y los demás por antigüedad, que es como los devuelve el store.
  const porPersona = candidates
    .map((c) => ({
      candidato: c,
      docs: [
        ...(c.cvPath ? [{ path: c.cvPath, nombre: 'CV' }] : []),
        ...(extra.get(c.id) ?? []).map((d) => ({ path: d.path, nombre: d.nombre })),
      ],
    }))
    .filter((x) => x.docs.length > 0)
  if (!porPersona.length) return { filename: '', incluidos: 0, fallidos: 0 }

  const rutas = porPersona.flatMap((x) => x.docs.map((d) => d.path))
  // LOS ASSETS DE LA DEMO NO SE FIRMAN: sus rutas son ficheros públicos
  // (`/demo/...`), no objetos del bucket, y pedir una firma por ellos devolvía un
  // error que se llevaba por delante la exportación entera.
  const delBucket = rutas.filter((r) => !r.startsWith('/'))
  const firmadas = new Map<string, string>()
  if (delBucket.length) {
    const { data, error } = await supabase.storage.from('cvs').createSignedUrls(delBucket, 300)
    if (error || !data) throw new Error('No se pudieron pedir los documentos.')
    for (const d of data) if (d.path && d.signedUrl) firmadas.set(d.path, d.signedUrl)
  }

  const carpetasUsadas = new Set<string>()
  const entradas: { nombre: string; datos: Uint8Array<ArrayBuffer> }[] = []
  let fallidos = 0
  let bytes = 0

  for (const { candidato, docs } of porPersona) {
    const carpeta = nombreUnico(nombreSeguro(candidateName(candidato) || 'Sin nombre'), '', carpetasUsadas)
    const usados = new Set<string>()
    for (const doc of docs) {
      const url = doc.path.startsWith('/') ? doc.path : firmadas.get(doc.path)
      if (!url) { fallidos++; continue }
      try {
        const res = await fetch(url)
        if (!res.ok) { fallidos++; continue }
        const datos = new Uint8Array(await res.arrayBuffer()) as Uint8Array<ArrayBuffer>
        // TODO EL ZIP VIVE EN MEMORIA hasta que se descarga, así que tiene un
        // techo, y se dice antes de que la pestaña se muera: ciento cuarenta
        // CVs de 8 MiB son más de un giga en un ArrayBuffer. (Auditoría, sep 2026.)
        bytes += datos.length
        if (bytes > ZIP_MAX_BYTES_EXPORT || entradas.length >= ZIP_MAX_ENTRADAS_EXPORT) {
          throw new Error(
            `Son demasiados documentos para un solo zip (más de ${Math.round(ZIP_MAX_BYTES_EXPORT / 1024 / 1024)} MB). Exporta la selección en dos partes.`,
          )
        }
        const { base, ext } = nombreEnCarpeta(doc.nombre, doc.path)
        entradas.push({ nombre: `${carpeta}/${nombreUnico(base, ext, usados)}`, datos })
      } catch {
        fallidos++
      }
    }
  }

  if (!entradas.length) throw new Error('No se pudo descargar ningún documento.')
  const filename = nombreFichero(campaign, 'zip')
  descargar(crearZip(entradas), filename)
  return { filename, incluidos: entradas.length, fallidos }
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

  const filename = nombreFichero(campaign, 'xlsx')
  XLSX.writeFile(wb, filename)
  return filename
}

// Herramientas de Meridian: lo único que el modelo puede hacer.
//
// Dos clases, y la diferencia es de seguridad, no de estilo:
//  - LECTURA: se ejecutan aquí, en el servidor, siempre contra el cliente con la
//    sesión del usuario, así que la RLS decide qué existe. El modelo no puede
//    ver nada que esa persona no pudiera abrir a mano.
//  - `responder`: cierra el turno. Si trae una propuesta de escritura, NO se
//    ejecuta: viaja al cliente, que la enseña con un botón de confirmar y la
//    aplica con el store de siempre. El modelo nunca escribe en la base.
//
// Minimización de datos (RGPD): al modelo van respuestas de formulario y el
// resumen que ya calculó `analyze-candidate`. NUNCA el texto del CV, ni correos,
// ni teléfonos: para eso está `tiene_correo`, que es lo único que necesita saber
// para decir "a este no le puedo escribir". Los nombres sí van, porque sin ellos
// Meridian no puede hablar de personas.
// De Supabase solo se necesita `rpc`, así que se declara aquí en vez de importar
// el SDK: este módulo queda comprobable y testeable por su cuenta.
export interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export type AnswerValue = string | string[] | boolean | number | null
export type Answers = Record<string, AnswerValue>

export interface Field {
  id: string
  label: string
  type: string
  options?: string[]
  system?: boolean
}

export interface CampaignRow {
  id: string
  title: string
  sector: string | null
  location: string | null
  status: string
  fields: Field[]
}

export interface CandidateAI {
  summary?: string
  highlights?: string[]
  concerns?: string[]
  fit?: number
  error?: string
}

export interface CandidateRow {
  id: string
  campaign_id: string
  answers: Answers
  status: string
  favorito: boolean
  notes: string | null
  ai: CandidateAI | null
  created_at: string
}

/**
 * Campos cuyo valor NO sale de aquí. El tipo del teléfono en este producto es
 * 'phone' (ver FieldType en src/lib/types.ts); 'tel' se deja como alias por si
 * algún formulario viejo lo usa.
 */
const PRIVATE_FIELD_TYPES = new Set(['email', 'phone', 'tel', 'file'])

const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fitOf = (ai: CandidateAI | null): number | null =>
  ai && !ai.error && typeof ai.fit === 'number' ? ai.fit : null

/** Misma escala cualitativa que la interfaz (fitTier en src/lib/meridian.ts). */
const fitLabel = (fit: number | null): string =>
  fit == null ? 'Sin analizar' : fit >= 70 ? 'Encaja bien' : fit >= 45 ? 'Puede encajar' : 'A valorar'

function nameOf(answers: Answers, fields: Field[]): string {
  for (const f of fields) {
    if (f.type !== 'text') continue
    const v = answers[f.id]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return 'Sin nombre'
}

export function hasPhone(answers: Answers, fields: Field[]): boolean {
  return fields.some((f) => (f.type === 'phone' || f.type === 'tel')
    && typeof answers[f.id] === 'string' && (answers[f.id] as string).trim().length >= 6)
}

export function hasEmail(answers: Answers, fields: Field[]): boolean {
  for (const f of fields) {
    if (f.type !== 'email') continue
    const v = answers[f.id]
    if (typeof v === 'string' && EMAIL_RE.test(v.trim().toLowerCase())) return true
  }
  return false
}

const daysSince = (iso: string): number => Math.floor((Date.now() - Date.parse(iso)) / DAY_MS)

/** Sin tildes ni mayúsculas: "andres" tiene que encontrar a "Andrés". */
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// --- Filtrado (mismo criterio que la tabla del puesto) ----------------------

export interface ValueFilter { campo_id: string; valores: string[] }
export interface NumberFilter { campo_id: string; min?: number | null; max?: number | null }

function matchesValue(answers: Answers, filters: ValueFilter[]): boolean {
  for (const f of filters) {
    const v = answers[f.campo_id]
    const ok = f.valores.some((want) => {
      if (typeof v === 'boolean') return (v ? 'Sí' : 'No') === want
      if (Array.isArray(v)) return v.includes(want)
      return v === want
    })
    if (!ok) return false
  }
  return true
}

function matchesNumber(answers: Answers, filters: NumberFilter[]): boolean {
  for (const f of filters) {
    const raw = answers[f.campo_id]
    const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
    if (Number.isNaN(n)) return false
    if (f.min != null && n < f.min) return false
    if (f.max != null && n > f.max) return false
  }
  return true
}

// --- Contexto que se le pasa a cada herramienta ----------------------------

export interface ToolContext {
  userClient: RpcClient
  companyId: string
  campaigns: CampaignRow[]
  candidates: CandidateRow[]
}

const campaignOf = (ctx: ToolContext, id: string) => ctx.campaigns.find((c) => c.id === id)

/** Ficha compacta: lo mínimo para que el modelo razone y cite a alguien. */
function brief(ctx: ToolContext, c: CandidateRow) {
  const campaign = campaignOf(ctx, c.campaign_id)
  const fields = campaign?.fields ?? []
  const fit = fitOf(c.ai)
  return {
    id: c.id,
    nombre: nameOf(c.answers, fields),
    puesto: campaign?.title ?? 'Puesto desconocido',
    estado: c.status,
    ajuste: fit,
    etiqueta: fitLabel(fit),
    tiene_correo: hasEmail(c.answers, fields),
    // El modelo NO recibe el número (minimización): solo si se le puede llamar.
    tiene_telefono: hasPhone(c.answers, fields),
    dias_desde_candidatura: daysSince(c.created_at),
    favorito: !!c.favorito,
  }
}

// --- Herramientas de lectura ----------------------------------------------

export interface SearchArgs {
  /** Trozo del nombre. Ignora tildes y mayúsculas. */
  nombre?: string | null
  puesto_id?: string | null
  estados?: string[] | null
  filtros?: ValueFilter[] | null
  filtros_numero?: NumberFilter[] | null
  solo_con_correo?: boolean | null
  orden?: 'ajuste' | 'reciente' | null
  limite?: number | null
}

export function buscarCandidatos(ctx: ToolContext, args: SearchArgs) {
  const filtros = args.filtros ?? []
  const filtrosNumero = args.filtros_numero ?? []
  const estados = args.estados ?? []

  let pool = ctx.candidates
  if (args.nombre) {
    const buscado = norm(args.nombre)
    pool = pool.filter((c) => norm(nameOf(c.answers, campaignOf(ctx, c.campaign_id)?.fields ?? [])).includes(buscado))
  }
  if (args.puesto_id) pool = pool.filter((c) => c.campaign_id === args.puesto_id)
  if (estados.length) pool = pool.filter((c) => estados.includes(c.status))
  if (filtros.length) pool = pool.filter((c) => matchesValue(c.answers, filtros))
  if (filtrosNumero.length) pool = pool.filter((c) => matchesNumber(c.answers, filtrosNumero))
  if (args.solo_con_correo) {
    pool = pool.filter((c) => hasEmail(c.answers, campaignOf(ctx, c.campaign_id)?.fields ?? []))
  }

  const sorted = [...pool].sort((a, b) =>
    args.orden === 'reciente'
      ? b.created_at.localeCompare(a.created_at)
      : (fitOf(b.ai) ?? -1) - (fitOf(a.ai) ?? -1))

  // Tope duro: ni el modelo ni el hilo necesitan más, y el coste sube con cada fila.
  const limit = Math.min(Math.max(args.limite ?? 12, 1), 25)
  return {
    total: sorted.length,
    mostrados: sorted.slice(0, limit).map((c) => brief(ctx, c)),
  }
}

export function verCandidato(ctx: ToolContext, args: { id?: string }) {
  const c = ctx.candidates.find((x) => x.id === args.id)
  if (!c) return { error: 'No encuentro esa candidatura.' }
  const campaign = campaignOf(ctx, c.campaign_id)
  const fields = campaign?.fields ?? []
  // Respuestas del formulario SIN datos de contacto ni adjuntos.
  const respuestas = fields
    .filter((f) => !PRIVATE_FIELD_TYPES.has(f.type) && !f.system)
    .map((f) => {
      const v = c.answers[f.id]
      const texto = v === undefined || v === null || v === ''
        ? '(sin dato)'
        : typeof v === 'boolean' ? (v ? 'Sí' : 'No')
        : Array.isArray(v) ? v.join(', ')
        : String(v)
      return { campo: f.label, valor: texto }
    })
  return {
    ...brief(ctx, c),
    respuestas,
    notas_del_equipo: c.notes || null,
    analisis: c.ai && !c.ai.error
      ? { resumen: c.ai.summary ?? '', a_favor: c.ai.highlights ?? [], a_confirmar: c.ai.concerns ?? [] }
      : null,
  }
}

export function estadisticas(ctx: ToolContext, args: { puesto_id?: string | null }) {
  const pool = args.puesto_id
    ? ctx.candidates.filter((c) => c.campaign_id === args.puesto_id)
    : ctx.candidates
  const porEstado: Record<string, number> = {}
  for (const c of pool) porEstado[c.status] = (porEstado[c.status] ?? 0) + 1
  const analizados = pool.filter((c) => fitOf(c.ai) != null)
  const encajanBien = analizados.filter((c) => (fitOf(c.ai) ?? 0) >= 70).length
  const ultimos7 = pool.filter((c) => daysSince(c.created_at) <= 7).length
  return {
    total: pool.length,
    por_estado: porEstado,
    analizados: analizados.length,
    encajan_bien: encajanBien,
    entradas_ultimos_7_dias: ultimos7,
    // Destacados sin contactar: lo que de verdad duele en una oleada.
    encajan_bien_sin_contactar: analizados.filter(
      (c) => (fitOf(c.ai) ?? 0) >= 70 && c.status === 'nuevo' && daysSince(c.created_at) >= 2,
    ).length,
  }
}

/** Envíos de comprobación de interés en marcha, agrupados por lote. */
export async function estadoEnvios(ctx: ToolContext) {
  const { data, error } = await ctx.userClient.rpc('candidate_interest_overview_for_company', {
    p_company: ctx.companyId,
  })
  if (error) return { error: 'No he podido consultar los envíos.' }
  type Row = { candidate_id: string; batch_id: string; response: string | null; sent_at: string }
  const rows = (data ?? []) as Row[]
  const visible = new Set(ctx.candidates.map((c) => c.id))
  const byBatch = new Map<string, { enviados: number; respondieron: number; sigue_interesado: number; sent_at: string; campaign_id: string }>()
  for (const r of rows) {
    if (!visible.has(r.candidate_id)) continue
    const candidate = ctx.candidates.find((c) => c.id === r.candidate_id)!
    const acc = byBatch.get(r.batch_id) ?? {
      enviados: 0, respondieron: 0, sigue_interesado: 0, sent_at: r.sent_at, campaign_id: candidate.campaign_id,
    }
    acc.enviados++
    if (r.response) acc.respondieron++
    if (r.response === 'interested') acc.sigue_interesado++
    if (r.sent_at < acc.sent_at) acc.sent_at = r.sent_at
    byBatch.set(r.batch_id, acc)
  }
  return {
    envios: [...byBatch.values()]
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
      .slice(0, 10)
      .map((b) => ({
        puesto: campaignOf(ctx, b.campaign_id)?.title ?? 'Puesto desconocido',
        enviados: b.enviados,
        respondieron: b.respondieron,
        siguen_interesados: b.sigue_interesado,
        dias: daysSince(b.sent_at),
      })),
  }
}

// --- Definiciones para la API del modelo -----------------------------------

const valueFilterSchema = {
  type: 'array',
  description: 'Filtros por respuesta del formulario. Usa los campo_id que te doy en el contexto.',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      campo_id: { type: 'string' },
      valores: {
        type: 'array', items: { type: 'string' },
        description: 'Vale con que la respuesta sea uno de estos valores.',
      },
    },
    required: ['campo_id', 'valores'],
  },
} as const

const numberFilterSchema = {
  type: 'array',
  description: 'Filtros sobre campos numéricos, por ejemplo años de experiencia.',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      campo_id: { type: 'string' },
      min: { type: ['number', 'null'] },
      max: { type: ['number', 'null'] },
    },
    required: ['campo_id', 'min', 'max'],
  },
} as const

const ESTADOS = ['nuevo', 'contactado', 'entrevista', 'contratado', 'descartado'] as const

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'buscar_candidatos',
      description:
        'Busca candidaturas de la empresa. Si te nombran a alguien, usa "nombre". Si no, traduce lo que piden a filtros sobre los campos del formulario. Devuelve el total y una muestra ordenada por ajuste.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nombre: { type: ['string', 'null'], description: 'Trozo del nombre de una persona, si te la nombran. Ignora tildes y mayúsculas.' },
          puesto_id: { type: ['string', 'null'], description: 'Acota a un puesto. null = todos.' },
          estados: { type: ['array', 'null'], items: { type: 'string', enum: ESTADOS } },
          filtros: { ...valueFilterSchema, type: ['array', 'null'] },
          filtros_numero: { ...numberFilterSchema, type: ['array', 'null'] },
          solo_con_correo: { type: ['boolean', 'null'], description: 'true si vas a proponer escribirles.' },
          orden: { type: ['string', 'null'], enum: ['ajuste', 'reciente', null] },
          limite: { type: ['integer', 'null'], description: 'Entre 1 y 25. Por defecto 12.' },
        },
        required: ['nombre', 'puesto_id', 'estados', 'filtros', 'filtros_numero', 'solo_con_correo', 'orden', 'limite'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_candidato',
      description: 'Ficha de una candidatura: respuestas del formulario, notas del equipo y el análisis de triaje.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estadisticas',
      description: 'Recuentos de la contratación: por estado, entradas recientes y destacados sin contactar.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { puesto_id: { type: ['string', 'null'] } },
        required: ['puesto_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estado_envios',
      description: 'Comprobaciones de interés enviadas y cuántos han contestado.',
      parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'responder',
      description:
        'Cierra el turno con tu respuesta. Úsala SIEMPRE al final. Si quieres cambiar algo (estados, escribir a candidatos, exportar) va en `propuesta`: no se ejecuta, la persona lo confirma antes.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          texto: { type: 'string', description: 'Lo que le dices. Español, tuteo, sin guion largo, breve.' },
          bloque: {
            type: ['object', 'null'],
            additionalProperties: false,
            description: 'Qué enseñar debajo del texto.',
            properties: {
              tipo: { type: 'string', enum: ['candidatos', 'comparativa', 'datos'] },
              ids: { type: 'array', items: { type: 'string' }, description: 'Candidaturas a enseñar. Para comparativa, de 2 a 8.' },
              motivos: {
                type: ['array', 'null'],
                description: 'Una línea por candidatura explicando por qué está en la lista.',
                items: {
                  type: 'object', additionalProperties: false,
                  properties: { id: { type: 'string' }, motivo: { type: 'string' } },
                  required: ['id', 'motivo'],
                },
              },
              datos: {
                type: ['array', 'null'],
                description: 'Solo para tipo "datos": cifras a destacar.',
                items: {
                  type: 'object', additionalProperties: false,
                  properties: { label: { type: 'string' }, value: { type: 'string' } },
                  required: ['label', 'value'],
                },
              },
              oculta: { type: ['integer', 'null'], description: 'Cuántas quedan fuera de la lista ("y N más").' },
            },
            required: ['tipo', 'ids', 'motivos', 'datos', 'oculta'],
          },
          propuesta: {
            type: ['object', 'null'],
            additionalProperties: false,
            description: 'Acción a confirmar. null si solo estás informando.',
            properties: {
              tipo: { type: 'string', enum: ['marcar_estado', 'comprobar_interes', 'exportar'] },
              ids: { type: 'array', items: { type: 'string' } },
              estado: { type: ['string', 'null'], enum: [...ESTADOS, null] },
            },
            required: ['tipo', 'ids', 'estado'],
          },
          sugerencias: {
            type: 'array',
            items: { type: 'string' },
            description: 'De 0 a 3 siguientes pasos, en imperativo y muy cortos. Son botones.',
          },
        },
        required: ['texto', 'bloque', 'propuesta', 'sugerencias'],
      },
    },
  },
] as const

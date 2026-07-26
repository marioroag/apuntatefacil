// Puente con el cerebro real de Meridian (edge function `meridian-chat`).
//
// Devuelve `null` cuando el Meridian real no está disponible: demo sin backend,
// Supabase sin configurar, empresa sin plan o sin OPENAI_API_KEY. En ese caso el
// panel se queda con el intérprete heurístico (`meridianAgent`), que sigue
// siendo el cerebro de la demo. Así enchufar la clave es lo único que cambia el
// comportamiento, y quitarla no rompe nada.
import { supabase, supabaseConfigured } from './supabase'
import { STATUS_ORDER, type CandidateStatus } from './types'

export type MeridianChatBlock =
  | { kind: 'candidates'; ids: string[]; reasons?: Record<string, string>; hiddenCount?: number }
  | { kind: 'compare'; ids: string[] }
  | { kind: 'insight'; items: { label: string; value: string }[] }

/** Lo que Meridian propone hacer. Nunca está hecho: lo confirma la persona. */
export type MeridianProposal =
  | { kind: 'setStatus'; ids: string[]; status: CandidateStatus }
  | { kind: 'interest'; ids: string[] }
  | { kind: 'export'; ids: string[] }

export interface MeridianChatReply {
  text: string
  block?: MeridianChatBlock
  proposal?: MeridianProposal
  suggestions: string[]
}

/** Turno guardado, para reconstruir el hilo al abrir el tab. */
export interface MeridianStoredTurn {
  role: 'user' | 'meridian'
  text: string
  block?: MeridianChatBlock
  suggestions: string[]
}

const isStatus = (v: unknown): v is CandidateStatus =>
  typeof v === 'string' && (STATUS_ORDER as readonly string[]).includes(v)

const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function parseBlock(raw: unknown): MeridianChatBlock | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const b = raw as Record<string, unknown>
  if (b.kind === 'insight' && Array.isArray(b.items)) {
    const items = (b.items as { label?: unknown; value?: unknown }[])
      .filter((i) => typeof i?.label === 'string' && typeof i?.value === 'string')
      .map((i) => ({ label: String(i.label), value: String(i.value) }))
    if (!items.length) return undefined
    // Un único dato que vale cero no es un dato, es un "no he encontrado nada"
    // que el texto ya ha dicho. Pintar un 0 enorme parece un resultado.
    if (items.length === 1 && /^0([.,]0+)?$/.test(items[0].value.trim())) return undefined
    return { kind: 'insight', items }
  }
  const ids = asIds(b.ids)
  if (!ids.length) return undefined
  if (b.kind === 'compare') return { kind: 'compare', ids }
  if (b.kind === 'candidates') {
    return {
      kind: 'candidates',
      ids,
      reasons: b.reasons && typeof b.reasons === 'object' ? (b.reasons as Record<string, string>) : undefined,
      hiddenCount: typeof b.hiddenCount === 'number' ? b.hiddenCount : undefined,
    }
  }
  return undefined
}

function parseProposal(raw: unknown): MeridianProposal | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const p = raw as Record<string, unknown>
  const ids = asIds(p.ids)
  if (!ids.length) return undefined
  if (p.kind === 'setStatus' && isStatus(p.status)) return { kind: 'setStatus', ids, status: p.status }
  if (p.kind === 'interest') return { kind: 'interest', ids }
  if (p.kind === 'export') return { kind: 'export', ids }
  return undefined
}

const asSuggestions = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, 3) : []

export function meridianChatAvailable(companyId: string | null | undefined): boolean {
  return Boolean(companyId) && companyId !== 'demo' && supabaseConfigured
}

/**
 * Resultado de preguntarle a Meridian. Se distinguen a propósito, porque cada
 * uno pide una reacción distinta en la interfaz:
 *  - `unavailable`: no hay cerebro real (demo, sin plan, sin clave). Se cae a la
 *    heurística en silencio, porque no es un fallo que le importe a nadie.
 *  - `timeout`: ha tardado demasiado. Hay que decirlo y ofrecer reintentar,
 *    nunca dejar el hilo pensando para siempre.
 *  - `error`: ha fallado de verdad.
 */
export type MeridianOutcome =
  | { status: 'ok'; reply: MeridianChatReply }
  | { status: 'unavailable' }
  | { status: 'timeout' }
  | { status: 'error' }

/** Por encima del plazo del servidor (25 s), para darle margen a que responda él. */
const TIMEOUT_MS = 40000

export async function askMeridian(companyId: string, message: string): Promise<MeridianOutcome> {
  if (!meridianChatAvailable(companyId)) return { status: 'unavailable' }

  const call = supabase.functions
    .invoke('meridian-chat', { body: { company_id: companyId, message } })
    .then((r) => r as { data: Record<string, unknown> | null; error: unknown })
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS))

  const outcome = await Promise.race([call, timeout])
  if (outcome === 'timeout') return { status: 'timeout' }

  const { data, error } = outcome
  if (error) return { status: 'error' }
  if (!data?.ok) return { status: 'error' }
  if (data.unavailable) return { status: 'unavailable' }
  return {
    status: 'ok',
    reply: {
      text: typeof data.text === 'string' ? data.text : '',
      block: parseBlock(data.block),
      proposal: parseProposal(data.proposal),
      suggestions: asSuggestions(data.suggestions),
    },
  }
}

/** El hilo guardado, de lo más antiguo a lo más reciente. */
export async function loadMeridianThread(companyId: string): Promise<MeridianStoredTurn[]> {
  if (!meridianChatAvailable(companyId)) return []
  const { data, error } = await supabase
    .from('meridian_turns')
    .select('role,body,payload,created_at,thread_id,meridian_threads!inner(company_id)')
    .eq('meridian_threads.company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(60)
  if (error || !data) return []
  return data.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    return {
      role: row.role === 'user' ? 'user' : 'meridian',
      text: typeof row.body === 'string' ? row.body : '',
      block: parseBlock(payload.block),
      suggestions: asSuggestions(payload.suggestions),
    }
  })
}

/**
 * Guarda un turno que ha ocurrido en el cliente (una receta, una comparativa,
 * un cambio de estado). Sin esto el hilo guardado contaría media historia: solo
 * lo que pasó por el modelo. Va sin await allá donde se usa: que falle el
 * registro no debe estropear la acción, que ya ha ocurrido.
 */
export async function logMeridianTurn(
  companyId: string,
  role: 'user' | 'meridian',
  text: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (!meridianChatAvailable(companyId)) return
  await supabase.rpc('meridian_log_turn', {
    p_company: companyId,
    p_role: role,
    p_body: text,
    p_payload: payload ?? null,
  })
}

/** Borrar la conversación. Es del usuario y puede tirarla cuando quiera. */
export async function clearMeridianThread(companyId: string): Promise<boolean> {
  if (!meridianChatAvailable(companyId)) return true
  const { error } = await supabase.rpc('meridian_clear_thread', { p_company: companyId })
  return !error
}

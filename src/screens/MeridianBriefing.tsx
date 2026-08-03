import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Thread, ThreadTurn, StreamedText, ThinkingStatus } from '../components/ChatThread'
import {
  Activity, ArrowUp, Bell, Check, ChevronDown, ChevronRight, Copy, Download, Flame, Inbox,
  Layers, Loader2, Lock, Mail, MessageCircle, MessageSquare, Phone, Plus, Sparkles,
  Trash2, Users, X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { useAppBase } from '../lib/useAppBase'
import { CandidateModal } from './CandidateModal'
import { MeridianAvatar, FitLabel } from '../components/Meridian'
import { MERIDIAN_NAME, hasMeridian, candidateFit } from '../lib/meridian'
import { STATUS_META, STATUS_ORDER, type Campaign, type Candidate, type CandidateStatus } from '../lib/types'
import { candidateName, relativeDate } from '../lib/format'
import { interpret, type AgentContext } from '../lib/meridianAgent'
import { callRound, coolingDown, bestPerJob, keyAnswers, type RecipeResult } from '../lib/meridianRecipes'
import {
  meridianTasks, planInterestSend, sendPlanVoice, taskOpen, taskPending, unreadEvents,
  type MeridianTask,
} from '../lib/meridianTasks'
import { interestEmailPreview, type InterestEmailPreview } from '../lib/interestEmail'
import { exportCandidatesToExcel } from '../lib/export'
import {
  askMeridian, clearMeridianThread, loadMeridianThread, logMeridianTurn,
  meridianChatAvailable, type MeridianProposal,
} from '../lib/meridianChat'

// --- Tareas activas ---------------------------------------------------------
// Lo que Meridian tiene en marcha NO es un objeto inventado: es un lote de
// comprobación de interés real (`candidate_interest_batches`), derivado de
// `candidate.interest` en `meridianTasks`. El progreso avanza porque un candidato
// ha pulsado de verdad el enlace de su correo, y llega solo por el broadcast
// `candidate_interest_ping` que ya recarga el store.

type Block =
  | { kind: 'candidates'; ids: string[]; reasons?: Record<string, string>; hiddenCount?: number }
  | { kind: 'compare'; ids: string[] }
  | { kind: 'draft'; channel: 'email' | 'whatsapp'; subject?: string; body: string; to: string }
  | { kind: 'interestEmail'; preview: InterestEmailPreview; recipients: number }
  | { kind: 'insight'; items: { label: string; value: string }[] }
  // La tarea se localiza por un candidato del lote, no por su id: así se resuelve
  // en el render (cuando el envío ya se ha recargado) y un recordatorio apunta al
  // lote original, que es el que de verdad interesa ver.
  | { kind: 'task'; anchorId: string }

interface Turn {
  id: string
  role: 'user' | 'meridian'
  thinking?: boolean
  text?: string
  block?: Block
  suggestions?: string[]
  /** Toda escritura pasa por aquí: Meridian propone, tú confirmas. */
  confirm?: { label: string; busyLabel?: string; run: () => void | Promise<void> }
  fresh?: boolean
}

const uid = () => Math.random().toString(36).slice(2)
const EASE = [0.22, 1, 0.36, 1] as const
/** Tope holgado: las tarjetas se desplazan, así que caben los que hagan falta. */
const MAX_COMPARE = 10

/**
 * Enlace de WhatsApp. wa.me exige el número en internacional y sin signos, así
 * que se limpia y, si viene con los 9 dígitos de un móvil español (que es lo que
 * escribe cualquiera aquí), se le antepone el 34. Si ya trae prefijo se respeta.
 */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '')
  return `https://wa.me/${digits.length === 9 ? `34${digits}` : digits}`
}

/**
 * Primer teléfono que dejó el candidato, leyendo los campos del formulario de SU
 * puesto (no se asume que el campo se llame "tel"). Hace falta para poder llamar
 * desde la propia lista, que es de lo que va una ronda de llamadas.
 */
function candidatePhone(c: Candidate, campaign: Campaign | undefined): string | null {
  for (const f of campaign?.fields ?? []) {
    if (f.type !== 'phone') continue
    const v = c.answers[f.id]
    if (typeof v === 'string' && v.trim().length >= 6) return v.trim()
  }
  return null
}

/**
 * Corto a propósito: con el ejemplo dentro se cortaba en móvil, y para descubrir
 * qué se le puede pedir ya están los chips y el menú de tareas rápidas.
 */
const placeholder = `Pídele algo a ${MERIDIAN_NAME}`

/** "Oficial de primera de albañilería" -> "albañilería": los chips deben ser cortos. */
const shortTitle = (t: string): string => {
  const limpio = t.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  const partes = limpio.split(/\s+de\s+/i)
  const cola = partes[partes.length - 1]
  return (cola.length >= 4 ? cola : limpio).toLowerCase()
}

/** Marca por dispositivo de la última vez que se miró Actividad (patrón de SEEN_KEY). */
const ACTIVITY_SEEN_KEY = 'apuntatefacil.meridian.activitySeen'
const readActivitySeen = (): string | null => {
  try { return localStorage.getItem(ACTIVITY_SEEN_KEY) } catch { return null }
}

type RecipeDef = { key: string; icon: typeof Phone; label: string }
const RECIPES: RecipeDef[] = [
  { key: 'call', icon: Phone, label: 'Ronda de llamadas de hoy' },
  { key: 'compare', icon: Users, label: 'Comparar finalistas' },
  { key: 'best', icon: Sparkles, label: 'Los mejores de cada puesto' },
  { key: 'cooling', icon: Flame, label: '¿Quién se está enfriando?' },
]

// El tab de Meridian: un hilo conversacional con superpoderes. Abre proactivo con el
// parte del día, conversas con tus palabras, y CADA respuesta es un bloque accionable.
// Lo que queda en marcha (envíos, vigilancias) vive en Actividad, y su detalle completo
// se abre en el propio hilo. La "inteligencia" es demo (heurística).
export function MeridianBriefing() {
  const { candidates, campaigns, tags, brands, getCampaign, setStatus, restoreCandidate, sendInterestCheck, loadCommentsForMany } = useStore()
  const { company } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const maskPhone = base === '/demo'
  const enabled = hasMeridian(company?.plan)
  const companyId = company?.id

  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [activitySeen, setActivitySeen] = useState<string | null>(readActivitySeen)

  // Las tareas no son estado: se derivan de las candidaturas. Así una respuesta
  // que entra por el broadcast actualiza Actividad y el detalle abierto a la vez.
  const tasks = useMemo(() => meridianTasks(candidates), [candidates])
  // Mientras piensa no se puede enviar otra cosa: si no, se apilan peticiones y
  // las respuestas llegan desordenadas.
  const thinking = turns.some((t) => t.thinking)
  const unread = unreadEvents(tasks, activitySeen)
  const lastResultIds = useRef<string[]>([])
  const ctx: AgentContext = useMemo(() => ({ candidates, campaigns, lastResultIds: lastResultIds.current }), [candidates, campaigns])
  const ctxRef = useRef(ctx); ctxRef.current = ctx
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const opened = useRef(false)
  const logQueue = useRef<Promise<unknown>>(Promise.resolve())

  const pushUser = (text: string) => setTurns((p) => [...p, { id: uid(), role: 'user', text, fresh: true }])
  const pushMeridian = (t: Partial<Turn>): string => {
    const id = uid()
    setTurns((p) => [...p, { ...t, id, role: 'meridian', fresh: true }])
    return id
  }
  const replaceTurn = (id: string, patch: Partial<Turn>) => setTurns((p) => p.map((t) => (t.id === id ? { ...t, ...patch, fresh: true } : t)))
  const respond = (build: () => Partial<Turn>, delay = 560) => {
    const id = pushMeridian({ thinking: true })
    window.setTimeout(() => replaceTurn(id, { thinking: false, ...build() }), delay)
  }
  /**
   * Igual que respond, pero esperando de verdad al modelo (sin retardo falso).
   * Si build devuelve null, el turno se retira: significa que la respuesta la va
   * a poner otra acción (por ejemplo askWrite con el correo real).
   */
  const respondAsync = async (build: () => Promise<Partial<Turn> | null>) => {
    const id = pushMeridian({ thinking: true })
    try {
      const next = await build()
      if (next) replaceTurn(id, { thinking: false, ...next })
      else setTurns((p) => p.filter((t) => t.id !== id))
    } catch {
      replaceTurn(id, { thinking: false, text: 'No he podido responder. Inténtalo otra vez.' })
    }
  }

  // Apertura proactiva: el parte del día como primer turno de Meridian.
  useEffect(() => {
    if (!enabled || opened.current) return
    opened.current = true
    const nuevos = candidates.filter((c) => c.status === 'nuevo')
    // Solo cuentan como "revisadas" las que tienen análisis: si no hay ninguna,
    // Meridian no puede decir "he revisado" ni "0 encajan bien".
    const analizados = nuevos.filter((c) => candidateFit(c.ai) != null)
    const bien = analizados.filter((c) => (candidateFit(c.ai) ?? -1) >= 70).sort((a, b) => (candidateFit(b.ai) ?? -1) - (candidateFit(a.ai) ?? -1))
    const top = bien.slice(0, 5).map((c) => c.id)
    lastResultIds.current = top
    const cooling = coolingDown(candidates).ids.length
    const h = new Date().getHours()
    const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas' : 'Buenas noches'
    const topCampaign = campaigns.map((c) => ({ c, n: nuevos.filter((x) => x.campaignId === c.id).length })).sort((a, b) => b.n - a.n)[0]?.c
    const revisadas = analizados.length === 1 ? 'la candidatura nueva' : `las ${analizados.length} candidaturas nuevas`
    let text: string
    if (nuevos.length === 0) {
      text = `${saludo}. Estás al día, no hay candidaturas nuevas por revisar. ¿Te echo una mano con algo?`
    } else if (analizados.length === 0) {
      text = `${saludo}. Tienes ${nuevos.length} ${nuevos.length === 1 ? 'candidatura nueva' : 'candidaturas nuevas'} por revisar. Todavía no he analizado ninguna, así que aún no puedo ordenarlas por ajuste.`
    } else if (bien.length === 0) {
      text = `${saludo}. He revisado ${revisadas}. Ninguna encaja del todo con lo que pide el puesto, pero échales un ojo.`
    } else {
      text = `${saludo}. He revisado ${revisadas} de todos tus puestos. ${bien.length} ${bien.length === 1 ? 'encaja' : 'encajan'} bien.`
    }
    if (cooling > 0) text += ` Ojo: ${cooling} de los que encajan bien llevan días sin contactar.`
    // Solo si de verdad hay lista debajo: si no, "Empieza por estas:" queda colgando.
    if (top.length > 0) text += ' Empieza por estas:'
    // El parte se recalcula siempre, nunca se guarda: así no queda obsoleto.
    setTurns([{
      id: uid(),
      role: 'meridian',
      text,
      block: top.length ? { kind: 'candidates', ids: top, hiddenCount: Math.max(0, bien.length - top.length) } : undefined,
      // Chips cortos: uno largo ocupa la fila entera y descoloca el grupo.
      suggestions: [
        topCampaign ? `Los mejores de ${shortTitle(topCampaign.title)}` : 'Los que encajan bien',
        '¿A quién llamo hoy?',
        '¿Cómo va la semana?',
      ],
    }])

    // La conversación guardada va DELANTE del parte, en orden cronológico. Sin
    // esto Meridian recordaría cosas que la pantalla no enseña, que es peor que
    // no recordar nada. Los botones de confirmar no se restauran a propósito:
    // una propuesta de hace tres días no debería poder ejecutarse de un clic.
    if (companyId && meridianChatAvailable(companyId)) {
      void loadMeridianThread(companyId).then((stored) => {
        if (!stored.length) return
        setTurns((current) => [
          ...stored.map((t): Turn => ({
            id: uid(), role: t.role, text: t.text, block: t.block, suggestions: t.suggestions,
          })),
          ...current,
        ])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, candidates])

  // Una propuesta (venga del modelo o de la heurística) se convierte en botón.
  // Escribir es el caso especial: se delega en askWrite, que la replantea con la
  // elegibilidad real. El modelo elige a QUIÉN, nunca decide si se puede.
  const confirmFor = (proposal: MeridianProposal | undefined): Turn['confirm'] | 'delegado' | undefined => {
    if (!proposal) return undefined
    if (proposal.kind === 'interest') {
      window.setTimeout(() => askWrite(proposal.ids), 220)
      return 'delegado'
    }
    if (proposal.kind === 'setStatus') {
      return {
        label: `Marcar como ${STATUS_META[proposal.status].label.toLowerCase()}`,
        busyLabel: 'Guardando',
        run: () => runMark(proposal.ids, proposal.status),
      }
    }
    return { label: 'Exportar a Excel', busyLabel: 'Preparando', run: () => runExport(proposal.ids) }
  }

  /**
   * Turno del intérprete heurístico: el cerebro de la demo y la reserva cuando no
   * hay clave. `null` = ya ha delegado en otra acción y no hay que pintar turno.
   */
  const heuristicTurn = (text: string): Partial<Turn> | null => {
    const r = interpret(text, ctxRef.current)
    if (r.resultIds?.length) lastResultIds.current = r.resultIds
    const act = r.action
    if (act?.type === 'sendInterest') {
      const ids = act.ids.length ? act.ids : r.resultIds ?? []
      if (ids.length) { window.setTimeout(() => askWrite(ids), 220); return null }
    }
    const card = r.cards[0]
    const block: Block | undefined =
      card?.kind === 'candidates' ? { kind: 'candidates', ids: card.ids, hiddenCount: card.hiddenCount }
      : card?.kind === 'draft' ? { kind: 'draft', channel: card.channel, subject: card.subject, body: card.body, to: card.to }
      : card?.kind === 'insight' ? { kind: 'insight', items: card.items }
      : undefined
    // Solo se pinta botón para lo que tiene una acción real detrás.
    let confirm: Turn['confirm']
    if (act?.type === 'setStatus' && r.actionLabel) {
      confirm = { label: r.actionLabel, busyLabel: 'Guardando', run: () => runMark(act.ids, act.status) }
    } else if (act?.type === 'export') {
      const ids = act.ids.length ? act.ids : r.resultIds ?? []
      if (ids.length) confirm = { label: 'Exportar a Excel', busyLabel: 'Preparando', run: () => runExport(ids) }
    }
    return { text: r.text, block, suggestions: r.suggestions, confirm }
  }

  const ask = (raw: string) => {
    const text = raw.trim(); if (!text || thinking) return
    setInput('')
    pushUser(text)

    // Cerebro real primero. Si no está disponible (demo, sin plan, sin clave) se
    // cae a la heurística sin decir nada: es el mismo producto con menos
    // comprensión, no un error que haya que explicarle a nadie.
    if (companyId && meridianChatAvailable(companyId)) {
      void respondAsync(async () => {
        const outcome = await askMeridian(companyId, text)
        if (outcome.status === 'unavailable') return heuristicTurn(text)
        if (outcome.status !== 'ok') {
          // Nunca dejamos el hilo pensando: se dice lo que ha pasado y se ofrece
          // repetir la misma pregunta de un clic.
          return {
            text: outcome.status === 'timeout'
              ? 'Me he quedado atascado con esta. Vuelve a intentarlo, y si te vuelve a pasar prueba a pedírmelo más concreto.'
              : 'No he podido responder. Inténtalo otra vez.',
            confirm: { label: 'Reintentar', busyLabel: 'Pensando', run: () => { ask(text) } },
          }
        }
        const { reply } = outcome
        if (reply.block?.kind === 'candidates' || reply.block?.kind === 'compare') {
          lastResultIds.current = reply.block.ids
        }
        const confirm = confirmFor(reply.proposal)
        // Delegado = escribir. `askWrite` va a poner su propio turno con el correo
        // real y el botón, así que este NO se pinta: si no, salen dos mensajes
        // seguidos y el primero se queda desmentido por el segundo ("propongo
        // enviarles" a 2, y acto seguido "de 2 puedo escribir a 1"). Es lo mismo
        // que ya hacía el intérprete heurístico devolviendo null.
        if (confirm === 'delegado') return null
        return {
          text: reply.text,
          block: reply.block,
          suggestions: reply.suggestions,
          confirm,
        }
      })
      return
    }

    const turn = heuristicTurn(text)
    if (turn) respond(() => turn)
  }

  /**
   * Una acción lanzada desde un botón también es un turno tuyo. Sin esto el hilo
   * parecía que Meridian hablaba solo, y al recargar desaparecía justo lo que
   * habías pedido con un clic (solo se guardaba lo que pasaba por el modelo).
   */
  const actUser = (text: string) => {
    pushUser(text)
    logTurn('user', text)
  }
  /** Respuesta generada en el cliente: se pinta y se guarda igual que las del modelo. */
  const sayMeridian = (turn: Partial<Turn>, delay = 380) => {
    respond(() => turn, delay)
    if (turn.text) logTurn('meridian', turn.text, { block: turn.block, suggestions: turn.suggestions })
  }
  /**
   * Los registros van EN COLA, no en paralelo: una acción guarda tu turno y el de
   * Meridian casi a la vez, y lanzados a la vez llegaban con la misma marca de
   * tiempo y el hilo se recargaba con la respuesta antes que la pregunta.
   */
  const logTurn = (role: 'user' | 'meridian', text: string, payload?: Record<string, unknown>) => {
    if (!companyId) return
    logQueue.current = logQueue.current
      .then(() => logMeridianTurn(companyId, role, text, payload))
      .catch(() => {})
  }

  // --- Recetas --------------------------------------------------------------
  const runRecipe = (key: string) => {
    actUser(RECIPES.find((r) => r.key === key)?.label ?? 'Tareas rápidas')
    if (key === 'compare') return compareFinalists(undefined, true)
    const res: RecipeResult = key === 'call' ? callRound(candidates) : key === 'cooling' ? coolingDown(candidates) : bestPerJob(candidates, campaigns)
    lastResultIds.current = res.ids
    sayMeridian({
      text: res.voice,
      block: res.ids.length ? { kind: 'candidates', ids: res.ids, reasons: res.reasons } : undefined,
      suggestions: res.ids.length ? ['Escríbeles a todos', 'Compáralos', 'Márcalos como contactados'] : [],
    })
  }
  const compareFinalists = (ids = lastResultIds.current.slice(0, MAX_COMPARE), yaAnunciado = false) => {
    if (ids.length < 2) { pushMeridian({ text: 'Para comparar necesito al menos dos. Selecciónalos en una lista y pulsa Comparar, o pídeme un grupo primero.' }); return }
    if (!yaAnunciado) actUser(`Compara a ${ids.length === 2 ? 'estos dos' : `estos ${ids.length}`}`)
    const recortados = ids.slice(0, MAX_COMPARE)
    sayMeridian({
      text: recortados.length < ids.length
        ? `Aquí los tienes lado a lado. Te enseño ${MAX_COMPARE} a la vez, que es lo que se puede mirar de un vistazo.`
        : 'Aquí los tienes lado a lado. La decisión es tuya.',
      block: { kind: 'compare', ids: recortados },
      // Comparar es justo el momento en que ya has decidido: sin siguiente paso
      // el turno era un callejón sin salida.
      suggestions: ['Escríbeles', 'Márcalos como contactados'],
    })
  }

  // --- Acciones -------------------------------------------------------------
  // Meridian PROPONE y tú confirmas: ninguna escritura ocurre sola. Todas van por
  // el store de siempre, que ya trae RLS, optimismo, rollback y avisos de error.

  /** Nombre que verá el candidato en el correo: la marca del puesto si la tiene. */
  const senderFor = (campaignId: string): string => {
    const campaign = getCampaign(campaignId)
    const brand = campaign?.brandId ? brands.find((b) => b.id === campaign.brandId) : undefined
    return brand?.name ?? company?.name ?? 'La empresa'
  }

  /**
   * Propone el envío REAL de la comprobación de interés. Antes de confirmar dice a
   * quién no puede escribir y por qué, y enseña el correo que va a salir de verdad.
   */
  const askWrite = (ids: string[], anunciar = false) => {
    if (!ids.length) return
    if (anunciar) actUser(ids.length === 1 ? 'Escríbele' : `Escribe a ${ids.length} candidatos`)
    // Sin anunciar = venimos de una propuesta que YA hizo esperar al usuario
    // (el modelo o el intérprete). Repetir el retardo de "pensando" ahí solo
    // produce un parpadeo: el indicador se va y vuelve. Desde un botón sí, que
    // es la primera espera.
    respond(() => {
      const plan = planInterestSend(ids, candidates, campaigns)
      if (plan.sendable.length === 0) {
        return { text: sendPlanVoice(plan), suggestions: ['Enséñame otros candidatos'] }
      }
      const group = plan.groups[0]
      const first = byId.get(group.sendable[0])
      const preview = interestEmailPreview({
        campaignTitle: group.campaignTitle,
        senderName: senderFor(group.campaignId),
        candidateName: first ? (candidateName(first) || '').split(' ')[0] || null : null,
        mode: group.mode,
      })
      return {
        text: sendPlanVoice(plan),
        block: { kind: 'interestEmail', preview, recipients: plan.sendable.length },
        confirm: { label: `Enviar a ${plan.sendable.length}`, busyLabel: 'Enviando', run: () => runSend(plan) },
      }
    }, anunciar ? 560 : 0)
  }

  const askMark = (ids: string[], status: CandidateStatus, anunciar = false) => {
    if (!ids.length) return
    if (anunciar) actUser(`Marca a ${ids.length === 1 ? 'este' : `estos ${ids.length}`} como ${STATUS_META[status].label.toLowerCase()}`)
    pushMeridian({
      text: `¿Marco a ${ids.length} ${ids.length === 1 ? 'candidato' : 'candidatos'} como ${STATUS_META[status].label.toLowerCase()}?`,
      confirm: { label: `Marcar como ${STATUS_META[status].label.toLowerCase()}`, busyLabel: 'Guardando', run: () => runMark(ids, status) },
    })
  }

  const runMark = async (ids: string[], status: CandidateStatus) => {
    // Esperamos de verdad antes de cantar "hecho": el store revierte y avisa si
    // alguna escritura falla, así que la frase tiene que llegar después.
    await Promise.all(ids.map((id) => setStatus(id, status)))
    const label = STATUS_META[status].label.toLowerCase()
    pushMeridian({
      text: ids.length === 1
        ? `Hecho. Lo he marcado como ${label}.`
        : `Hecho. He marcado a ${ids.length} como ${label}.`,
    })
  }

  /** Envía de verdad: un lote por puesto, porque la comprobación es por puesto. */
  const runSend = async (plan: ReturnType<typeof planInterestSend>) => {
    const results = await Promise.all(plan.groups.map((group) =>
      sendInterestCheck(group.campaignId, group.sendable, crypto.randomUUID())
        .then((r) => ({ ...r, campaignTitle: group.campaignTitle })),
    ))
    const sent = results.reduce((n, r) => n + r.sent, 0)
    const failed = results.reduce((n, r) => n + r.failed, 0)
    const broken = results.filter((r) => !r.ok)

    if (sent === 0) {
      // Con un motivo concreto del servidor no añadimos "inténtalo otra vez": si el
      // envío de emails no está configurado, reintentar no arregla nada.
      const reason = broken[0]?.error
      pushMeridian({
        text: broken.length
          ? (reason ? `No he podido enviarlo: ${reason}` : 'No he podido enviarlo. Inténtalo otra vez en un momento.')
          : 'No he enviado nada: no quedaba nadie a quien escribir.',
      })
      return
    }
    let text = sent === 1
      ? 'Enviado. Me quedo pendiente y te aviso aquí y en Actividad cuando responda.'
      : `Enviados ${sent} correos. Me quedo pendiente y te aviso aquí y en Actividad cuando respondan.`
    if (failed > 0) text += ` Ojo: ${failed} no ${failed === 1 ? 'salió' : 'salieron'}, lo puedes reintentar.`
    // Con un solo puesto enseñamos el seguimiento aquí mismo. Con varios lotes,
    // Actividad es el sitio donde se ven todos juntos.
    pushMeridian({
      text,
      block: plan.groups.length === 1 ? { kind: 'task', anchorId: plan.groups[0].sendable[0] } : undefined,
    })
  }

  /** Exporta de verdad a .xlsx. Un archivo por puesto: la hoja es por puesto. */
  const runExport = async (ids: string[]) => {
    const wanted = new Set(ids)
    const byCampaign = new Map<string, Candidate[]>()
    for (const c of candidates) {
      if (!wanted.has(c.id)) continue
      byCampaign.set(c.campaignId, [...(byCampaign.get(c.campaignId) ?? []), c])
    }
    if (byCampaign.size === 0) { pushMeridian({ text: 'No tengo a nadie que exportar.' }); return }
    const names: string[] = []
    for (const [campaignId, rows] of byCampaign) {
      const campaign = getCampaign(campaignId)
      if (!campaign) continue
      try {
        names.push(await exportCandidatesToExcel(campaign, rows, tags, [], await loadCommentsForMany(rows.map((c) => c.id))))
      } catch {
        pushMeridian({ text: 'No he podido preparar el Excel. Inténtalo otra vez.' })
        return
      }
    }
    pushMeridian({
      text: names.length === 1
        ? `Listo, te he preparado ${names[0]} con ${ids.length} ${ids.length === 1 ? 'candidatura' : 'candidaturas'}.`
        : `Listo, te he preparado ${names.length} archivos, uno por puesto.`,
    })
  }

  const askExport = (ids: string[], anunciar = false) => {
    if (!ids.length) return
    if (anunciar) actUser(ids.length === 1 ? 'Exporta esta candidatura' : `Exporta estas ${ids.length}`)
    pushMeridian({
      text: `¿Te preparo un Excel con ${ids.length === 1 ? 'esta candidatura' : `estas ${ids.length} candidaturas`}?`,
      confirm: { label: 'Exportar a Excel', busyLabel: 'Preparando', run: () => runExport(ids) },
    })
  }

  const openTask = (task: MeridianTask) => {
    actUser(`Enséñame el envío de ${getCampaign(task.campaignId)?.title ?? 'ese puesto'}`)
    // Sin recuento en la frase: el bloque se actualiza en vivo cuando alguien
    // responde, y un texto fijo diciendo "aún no ha contestado nadie" quedaría
    // contradiciendo al bloque que tiene justo debajo.
    pushMeridian({
      text: 'Esto es lo que llevo con este envío.',
      block: { kind: 'task', anchorId: task.candidateIds[0] },
    })
  }

  const markActivitySeen = () => {
    const now = new Date().toISOString()
    setActivitySeen(now)
    try { localStorage.setItem(ACTIVITY_SEEN_KEY, now) } catch { /* cuota llena */ }
  }

  /** La conversación es tuya: puedes tirarla cuando quieras, aquí y en el servidor. */
  const borrarConversacion = async () => {
    if (companyId) await clearMeridianThread(companyId)
    opened.current = false
    setTurns([])
    toast.success('Conversación borrada')
  }
  const resolveConfirms = () => setTurns((p) => p.map((t) => (t.confirm ? { ...t, confirm: undefined } : t)))

  const openCandidate = openId ? byId.get(openId) ?? null : null
  const openCampaign = openCandidate ? getCampaign(openCandidate.campaignId) ?? null : null

  if (!enabled) return <LockedPanel base={base} />

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.25rem)] max-w-[720px] flex-col px-4">
      <header className="z-20 -mx-4 flex shrink-0 items-center justify-between border-b border-slate-200/70 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-slate-900 text-white"><Sparkles className="size-3.5" aria-hidden /></span>
          <span className="text-[14px] font-semibold text-slate-900">{MERIDIAN_NAME}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {turns.length > 1 && (
            <button
              onClick={borrarConversacion}
              aria-label="Borrar la conversación"
              title="Borrar la conversación"
              className="grid size-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
          <ActivityBell tasks={tasks} unread={unread} seenAt={activitySeen} getCand={(id) => byId.get(id)} getCampaign={getCampaign} onOpenPanel={markActivitySeen} onOpenTask={openTask} />
        </div>
      </header>

      <Thread>
        {turns.map((t) =>
          t.role === 'user' ? (
            <ThreadTurn key={t.id} id={t.id}>
              <UserTurn text={t.text ?? ''} fresh={t.fresh} />
            </ThreadTurn>
          ) : (
            <ThreadTurn key={t.id} id={t.id}>
            <MeridianTurn
              turn={t}
              senderFor={senderFor}
              getCand={(id) => byId.get(id)}
              getCampaign={getCampaign}
              getTask={(anchorId) => tasks.find((t) => t.candidateIds.includes(anchorId))}
              onOpen={setOpenId}
              onAsk={ask}
              onWrite={(ids) => askWrite(ids, true)}
              onMark={(ids, st) => askMark(ids, st, true)}
              onExport={(ids) => askExport(ids, true)}
              onCompare={(ids) => compareFinalists(ids)}
              onCancel={resolveConfirms}
            />
            </ThreadTurn>
          ),
        )}
      </Thread>

      <div className="shrink-0 pb-4">
        <div className="pt-2">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input) }}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-card transition-shadow focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15"
          >
            <RecipeLauncher onPick={runRecipe} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={`Pídele algo a ${MERIDIAN_NAME}`}
              placeholder={thinking ? `${MERIDIAN_NAME} está pensando` : placeholder}
              disabled={thinking}
              className="min-w-0 flex-1 bg-transparent px-1 text-[15px] text-slate-900 outline-none placeholder:text-slate-500 disabled:cursor-wait"
            />
            <button type="submit" disabled={!input.trim() || thinking} aria-label="Enviar" className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-400">
              <ArrowUp className="size-5" aria-hidden />
            </button>
          </form>
          <p className="mt-1.5 pb-1 text-center text-[11px] text-slate-400">{MERIDIAN_NAME} propone y tú decides. Es orientativo.</p>
        </div>
      </div>

      {openCampaign && (
        <CandidateModal
          campaign={openCampaign}
          candidate={openCandidate}
          maskPhone={maskPhone}
          onClose={() => setOpenId(null)}
          onOpenManageTags={undefined}
          onDeleted={(c) => toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })}
        />
      )}
    </div>
  )
}

// --- Centro de actividad ----------------------------------------------------

function ActivityBell({ tasks, unread, seenAt, getCand, getCampaign, onOpenPanel, onOpenTask }: {
  tasks: MeridianTask[]; unread: number; seenAt: string | null
  getCand: (id: string) => Candidate | undefined
  getCampaign: (id: string) => Campaign | undefined
  onOpenPanel: () => void; onOpenTask: (task: MeridianTask) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const toggle = () => { const next = !open; setOpen(next); if (next) onOpenPanel() }
  const enMarcha = tasks.filter(taskOpen)
  const cerradas = tasks.filter((t) => !taskOpen(t))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle} aria-label={unread ? `Actividad, ${unread} novedades sin ver` : 'Actividad'} aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="num absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.16, ease: EASE }}
          className="absolute right-0 top-full z-30 mt-2 flex max-h-[70vh] w-[392px] max-w-[calc(100vw-2rem)] origin-top-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop"
        >
          <p className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-800">
            <Activity className="size-4 text-slate-500" aria-hidden /> Actividad
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {tasks.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><Inbox className="size-5" aria-hidden /></div>
                <p className="mx-auto mt-2.5 max-w-[16rem] text-[13px] leading-5 text-slate-500">
                  Nada en marcha. Cuando me pidas escribir a unos candidatos, aquí verás quién ha contestado y quién falta.
                </p>
              </div>
            ) : (
              <>
                {enMarcha.length > 0 && <SectionLabel>En marcha</SectionLabel>}
                {enMarcha.map((t) => <TaskRow key={t.batchId} task={t} seenAt={seenAt} getCand={getCand} getCampaign={getCampaign} onOpen={() => { setOpen(false); onOpenTask(t) }} />)}
                {cerradas.length > 0 && <SectionLabel>Han contestado todos</SectionLabel>}
                {cerradas.map((t) => <TaskRow key={t.batchId} task={t} seenAt={seenAt} getCand={getCand} getCampaign={getCampaign} onOpen={() => { setOpen(false); onOpenTask(t) }} />)}
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>
}

/** Lo que contestó, en una frase. Nunca en rojo: "ya no le interesa" es rutina. */
const outcomeText = (outcome: MeridianTaskEventOutcome) =>
  outcome === 'interested' ? 'sigue interesado' : 'ya no le interesa'

type MeridianTaskEventOutcome = MeridianTask['events'][number]['outcome']

const firstNameOf = (c: Candidate | undefined) =>
  c ? (candidateName(c) || 'Sin nombre').split(' ')[0] : 'Alguien'

function TaskRow({ task, seenAt, getCand, getCampaign, onOpen }: {
  task: MeridianTask; seenAt: string | null
  getCand: (id: string) => Candidate | undefined
  getCampaign: (id: string) => Campaign | undefined
  onOpen: () => void
}) {
  const done = task.events.length
  const total = task.candidateIds.length
  const hasUnread = task.events.some((e) => !seenAt || e.at > seenAt)
  const last = task.events[0]
  const puesto = getCampaign(task.campaignId)?.title ?? 'un puesto'
  return (
    <button onClick={onOpen} className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Mail className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-slate-900">{puesto}</span>
          {hasUnread && <span className="size-1.5 shrink-0 rounded-full bg-indigo-600" aria-label="Novedades sin ver" />}
          <span className="num ml-auto shrink-0 text-[12px] font-medium text-slate-500">{done}/{total}</span>
        </span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-slate-400 transition-[width] duration-[var(--duration-max)]" style={{ width: `${(done / total) * 100}%` }} />
        </span>
        <span className="mt-1 block truncate text-[12px] text-slate-500">
          {last
            ? `${firstNameOf(getCand(last.candidateId))}: ${outcomeText(last.outcome)}`
            : `Esperando respuesta de ${total === 1 ? '1 candidato' : `${total} candidatos`}`}
        </span>
        <span className="text-[11px] text-slate-400">{relativeDate(last?.at ?? task.sentAt)}</span>
      </span>
      <ChevronRight className="mt-1.5 size-4 shrink-0 text-slate-300" aria-hidden />
    </button>
  )
}

// --- Detalle de tarea (en el hilo) -----------------------------------------

function TaskBlock({ task, senderName, getCand, getCampaign, onOpen, onWrite, onMark }: {
  task: MeridianTask
  senderName: string
  getCand: (id: string) => Candidate | undefined
  getCampaign: (id: string) => Campaign | undefined
  onOpen: (id: string) => void
  onWrite: (ids: string[]) => void
  onMark: (ids: string[], s: CandidateStatus) => void
}) {
  const [showEmail, setShowEmail] = useState(false)
  const total = task.candidateIds.length
  const done = task.events.length
  const pending = taskPending(task)
  const campaign = getCampaign(task.campaignId)
  // Los que siguen interesados: el grupo al que de verdad quieres llamar.
  const available = task.events.filter((e) => e.outcome === 'interested').map((e) => e.candidateId)
  const eventOf = (id: string) => task.events.find((e) => e.candidateId === id)
  // El correo que salió, reconstruido con la misma fuente que el envío.
  const sent = interestEmailPreview({
    campaignTitle: campaign?.title ?? 'el puesto',
    senderName,
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      {/* Cabecera: qué es, desde cuándo, cómo va */}
      <div className="border-b border-slate-100 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Mail className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-slate-900">{campaign?.title ?? 'Envío'} · {total} {total === 1 ? 'candidato' : 'candidatos'}</p>
            <p className="text-[12px] text-slate-500">Enviado {relativeDate(task.sentAt)}</p>
          </div>
          <p className="num shrink-0 text-[13px] font-semibold text-slate-700">{done}/{total}</p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-700 transition-[width] duration-[var(--duration-max)]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <div className="mt-2.5">
          <button onClick={() => setShowEmail((s) => !s)} aria-expanded={showEmail} className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 transition-colors hover:text-slate-700">
            <ChevronDown className={`size-3.5 transition-transform ${showEmail ? 'rotate-180' : ''}`} aria-hidden /> {showEmail ? 'Ocultar' : 'Ver'} el correo que envié
          </button>
          {showEmail && (
            <div className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="mb-1 text-[12px] font-semibold text-slate-800">{sent.subject}</p>
              <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-600">{sent.body}</p>
              <p className="mt-1.5 text-[11px] text-slate-500">Con dos botones: “{sent.options[0]}” y “{sent.options[1]}”.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quién ha contestado y quién no */}
      <ul>
        {task.candidateIds.map((id) => {
          const c = getCand(id); if (!c) return null
          const name = candidateName(c) || 'Sin nombre'
          const ev = eventOf(id)
          return (
            <li key={id} className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-0">
              <button onClick={() => onOpen(id)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none">
                <MeridianAvatar name={name} fit={candidateFit(c.ai)} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="truncate text-[13px] font-medium text-slate-900">{name}</span>
                  {/* Estado: siempre texto, nunca solo color (y "ya no le interesa" en gris, no en rojo). */}
                  <span className={`block truncate text-[12px] ${ev ? 'text-slate-700' : 'text-slate-400'}`}>
                    {ev ? `Ha contestado: ${outcomeText(ev.outcome)}` : 'Sin respuesta todavía'}
                  </span>
                </span>
              </button>
              {ev
                ? <Check className="size-4 shrink-0 text-slate-400" aria-label="Ha contestado" />
                : <span className="shrink-0 text-[11px] text-slate-400">Pendiente</span>}
            </li>
          )
        })}
      </ul>

      {/* Acciones sobre cada grupo: lo que de verdad quieres hacer desde aquí */}
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 bg-slate-50/80 px-2 py-1.5">
        {available.length > 0 && (
          <TaskAction icon={Check} label={`Marcar contactados (${available.length})`} onClick={() => onMark(available, 'contactado')} />
        )}
        {pending.length > 0 && (
          <TaskAction icon={Mail} label={`Insistir a los que faltan (${pending.length})`} onClick={() => onWrite(pending)} />
        )}
        {available.length === 0 && pending.length === 0 && <span className="px-1.5 text-[12px] text-slate-500">Todo resuelto por aquí.</span>}
      </div>
    </div>
  )
}

function TaskAction({ icon: Icon, label, onClick }: { icon: typeof Mail; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <Icon className="size-4 text-slate-500" aria-hidden /> {label}
    </button>
  )
}

// --- Turnos -----------------------------------------------------------------

const enterProps = (fresh?: boolean) => (fresh ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.24, ease: EASE } } : {})

function UserTurn({ text, fresh }: { text: string; fresh?: boolean }) {
  return (
    <motion.div className="flex justify-end" {...enterProps(fresh)}>
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-[14px] leading-5 text-white">{text}</p>
    </motion.div>
  )
}

function MeridianMark() {
  return <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-white ring-1 ring-inset ring-white/10"><Sparkles className="size-4" aria-hidden /></span>
}

function MeridianTurn({ turn, senderFor, getCand, getCampaign, getTask, onOpen, onAsk, onWrite, onMark, onExport, onCompare, onCancel }: {
  turn: Turn
  senderFor: (campaignId: string) => string
  getCand: (id: string) => Candidate | undefined
  getCampaign: (id: string) => Campaign | undefined
  getTask: (anchorId: string) => MeridianTask | undefined
  onOpen: (id: string) => void
  onAsk: (t: string) => void
  onWrite: (ids: string[]) => void
  onMark: (ids: string[], s: CandidateStatus) => void
  onExport: (ids: string[]) => void
  onCompare: (ids: string[]) => void
  onCancel: () => void
}) {
  const task = turn.block?.kind === 'task' ? getTask(turn.block.anchorId) : undefined
  // El bloque espera a que termine el texto. Si se pintara ya, la lista estaría
  // abajo del todo y el texto creciendo por encima empujaría hacia arriba: el
  // hilo debe crecer SIEMPRE por su borde inferior para que el scroll lo siga.
  // Guardamos el texto ya escrito (no un booleano) para que se reinicie solo
  // cuando el turno cambia de texto, por ejemplo al dejar de pensar.
  const [escrito, setEscrito] = useState<string | null>(null)
  const listo = !turn.fresh || !turn.text || escrito === turn.text
  return (
    <motion.div className="flex gap-2.5" {...enterProps(turn.fresh)}>
      <MeridianMark />
      <div className="min-w-0 flex-1 space-y-3">
        {turn.thinking ? <ThinkingStatus /> : turn.text && (
          <StreamedText
            text={turn.text}
            animate={turn.fresh}
            onDone={() => setEscrito(turn.text ?? '')}
            className="text-[14px] leading-6 text-slate-800"
          />
        )}

        {listo && <>
        {turn.block?.kind === 'candidates' && (
          <CandidatesBlock ids={turn.block.ids} reasons={turn.block.reasons} hiddenCount={turn.block.hiddenCount} getCand={getCand} getCampaign={getCampaign} onOpen={onOpen} onAsk={onAsk} onWrite={onWrite} onMark={onMark} onExport={onExport} onCompare={onCompare} />
        )}
        {turn.block?.kind === 'task' && task && (
          <TaskBlock task={task} senderName={senderFor(task.campaignId)} getCand={getCand} getCampaign={getCampaign} onOpen={onOpen} onWrite={onWrite} onMark={onMark} />
        )}
        {turn.block?.kind === 'compare' && <CompareBlock ids={turn.block.ids} getCand={getCand} getCampaign={getCampaign} onOpen={onOpen} onMark={onMark} onWrite={onWrite} />}
        {turn.block?.kind === 'draft' && <DraftBlock {...turn.block} />}
        {turn.block?.kind === 'interestEmail' && <InterestEmailBlock preview={turn.block.preview} recipients={turn.block.recipients} />}
        {turn.block?.kind === 'insight' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {turn.block.items.map((it) => (
              <div key={it.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-card">
                <p className="num text-xl font-semibold text-slate-900">{it.value}</p>
                <p className="text-[11px] leading-tight text-slate-500">{it.label}</p>
              </div>
            ))}
          </div>
        )}

        {turn.confirm && <ConfirmRow confirm={turn.confirm} onResolve={onCancel} />}

        {turn.suggestions && turn.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {turn.suggestions.map((s) => (
              <button key={s} onClick={() => onAsk(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">{s}</button>
            ))}
          </div>
        )}
        </>}
      </div>
    </motion.div>
  )
}

// --- Bloque de candidatos accionable (selección + barra) --------------------

function CandidatesBlock({ ids, reasons, hiddenCount, getCand, getCampaign, onOpen, onAsk, onWrite, onMark, onExport, onCompare }: {
  ids: string[]; reasons?: Record<string, string>; hiddenCount?: number
  getCand: (id: string) => Candidate | undefined
  getCampaign: (id: string) => Campaign | undefined
  onOpen: (id: string) => void
  onAsk: (t: string) => void
  onWrite: (ids: string[]) => void
  onMark: (ids: string[], s: CandidateStatus) => void
  onExport: (ids: string[]) => void
  onCompare: (ids: string[]) => void
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  // Se enseñan 6 y el resto se despliega aquí mismo: "y N más" era texto muerto
  // y dejaba fuera a gente a la que había que llamar.
  const [expandido, setExpandido] = useState(false)
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selIds = [...sel]
  const clear = () => setSel(new Set())
  const act = (fn: (ids: string[]) => void) => { fn(selIds); clear() }

  if (ids.length === 0) return null
  const visibles = expandido ? ids : ids.slice(0, 6)
  const porDesplegar = ids.length - visibles.length
  const todoSeleccionado = visibles.length > 0 && visibles.every((id) => sel.has(id))

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <ul>
        {visibles.map((id, i) => {
          const c = getCand(id); if (!c) return null
          const name = candidateName(c) || 'Sin nombre'
          const fit = candidateFit(c.ai)
          const checked = sel.has(id)
          const phone = candidatePhone(c, getCampaign(c.campaignId))
          return (
            <motion.li
              key={id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE, delay: Math.min(i, 6) * 0.035 }}
              className={`flex items-center gap-2.5 border-b border-slate-100 px-2.5 py-2 transition-colors last:border-0 ${checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
            >
              <button
                role="checkbox" aria-checked={checked} aria-label={`Seleccionar ${name}`} onClick={() => toggle(id)}
                className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white hover:border-slate-400'}`}
              >
                {checked && <Check className="size-3.5" aria-hidden />}
              </button>
              <button onClick={() => onOpen(id)} aria-label={`Abrir la ficha de ${name}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5 text-left focus-visible:outline-none">
                <MeridianAvatar name={name} fit={fit} size={38} />
                <span className="min-w-0 flex-1">
                  {/* Se envuelve en vez de recortar: con los dos botones de contacto
                      no cabía todo en una línea y el nombre quedaba en "Andr...",
                      que es justo lo único que no se puede perder de una fila. */}
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="text-[14px] font-medium text-slate-900">{name}</span>
                    {fit != null && <FitLabel fit={fit} className="shrink-0 text-[12px]" />}
                    {/* Por dónde va: así se ve a quién ya has hecho sin salir de la lista. */}
                    {c.status !== 'nuevo' && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                        <span className={`size-1.5 rounded-full ${STATUS_META[c.status].dot}`} aria-hidden />
                        {STATUS_META[c.status].label}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">{reasons?.[id] ?? getCampaign(c.campaignId)?.title ?? ''}</span>
                </span>
              </button>
              {/* Contactar de un toque, sin enseñar el número: en una ronda de
                  llamadas lo que quieres es pulsar, no leer nueve dígitos. */}
              {phone && (
                <span className="flex shrink-0 items-center gap-0.5">
                  <a
                    href={`tel:${phone.replace(/\s+/g, '')}`}
                    aria-label={`Llamar a ${name}`}
                    title={`Llamar a ${name}`}
                    className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Phone className="size-4" aria-hidden />
                  </a>
                  <a
                    href={whatsappHref(phone)}
                    target="_blank" rel="noopener noreferrer"
                    aria-label={`Escribir a ${name} por WhatsApp`}
                    title={`WhatsApp a ${name}`}
                    className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                  </a>
                </span>
              )}
            </motion.li>
          )
        })}
      </ul>

      {porDesplegar > 0 && (
        <button
          onClick={() => setExpandido(true)}
          className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ChevronDown className="size-3.5" aria-hidden /> Ver {porDesplegar} más
        </button>
      )}

      {/* Estas no las tiene el bloque (el modelo mandó una muestra), así que la
          única forma honesta de verlas es volver a pedírselas. */}
      {porDesplegar === 0 && !!hiddenCount && hiddenCount > 0 && (
        <button
          onClick={() => onAsk('Enséñame el resto')}
          className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ChevronDown className="size-3.5" aria-hidden /> Hay {hiddenCount} más, enséñamelas
        </button>
      )}

      {sel.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: EASE }}
          className="flex flex-wrap items-center gap-1 border-t border-slate-200 bg-slate-50/80 px-2 py-1.5"
        >
          <span className="px-1.5 text-[12px] font-medium text-slate-600"><span className="num">{sel.size}</span> {sel.size === 1 ? 'seleccionado' : 'seleccionados'}</span>
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden />
          <BulkBtn icon={Mail} label="Escribir" onClick={() => act(onWrite)} />
          <MarkMenu onPick={(s) => act((ids) => onMark(ids, s))} />
          <BulkBtn icon={Users} label="Comparar" onClick={() => sel.size >= 2 ? act(onCompare) : undefined} disabled={sel.size < 2} />
          <BulkBtn icon={Download} label="Exportar" onClick={() => act(onExport)} />
          <button onClick={clear} className="ml-auto grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label="Quitar selección"><X className="size-4" aria-hidden /></button>
        </motion.div>
      )}

      {visibles.length > 1 && (
        <button
          onClick={() => setSel(todoSeleccionado ? new Set() : new Set(visibles))}
          className="w-full border-t border-slate-100 px-3 py-1.5 text-left text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {todoSeleccionado ? 'Quitar la selección' : `Seleccionar ${visibles.length === ids.length ? 'todos' : 'los visibles'}`}
        </button>
      )}
    </div>
  )
}

function BulkBtn({ icon: Icon, label, onClick, disabled }: { icon: typeof Mail; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={disabled ? 'Elige al menos 2' : undefined} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent">
      <Icon className="size-4 text-slate-500" aria-hidden /> {label}
    </button>
  )
}

function MarkMenu({ onPick }: { onPick: (s: CandidateStatus) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <Check className="size-4 text-slate-500" aria-hidden /> Marcar como <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14, ease: EASE }} className="absolute bottom-full left-0 z-20 mb-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop" role="menu">
          {STATUS_ORDER.map((s) => (
            <button key={s} role="menuitem" onClick={() => { setOpen(false); onPick(s) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50">
              <span className={`size-1.5 rounded-full ${STATUS_META[s].dot}`} aria-hidden /> {STATUS_META[s].label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

// --- Recetas y bloques auxiliares ------------------------------------------

function RecipeLauncher({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-label="Tareas rápidas" aria-expanded={open}
        className={`grid size-9 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${open ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
      >
        <Plus className={`size-5 transition-transform duration-[var(--duration-control)] ${open ? 'rotate-45' : ''}`} aria-hidden />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.16, ease: EASE }}
          className="absolute bottom-full left-0 z-30 mb-2 w-64 origin-bottom-left overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop"
          role="menu"
        >
          <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Layers className="size-3.5" aria-hidden /> Tareas rápidas</p>
          {RECIPES.map((r) => (
            <button key={r.key} role="menuitem" onClick={() => { setOpen(false); onPick(r.key) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
              <r.icon className="size-4 shrink-0 text-slate-500" aria-hidden /> {r.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

/**
 * Comparativa por TARJETAS (decisión de Mario): una ficha por candidato que se
 * desplaza en horizontal. Su virtud es que escala sola, porque comparar dos o
 * seis es añadir tarjetas, no rehacer la maqueta.
 *
 * Para que se pueda leer en horizontal, las secciones de todas las tarjetas
 * arrancan a la misma altura: el resumen ocupa siempre lo mismo (si no, una
 * ficha con dos líneas y otra con cuatro descolocan todo lo de abajo).
 */
function CompareBlock({ ids, getCand, getCampaign, onOpen, onMark, onWrite }: {
  ids: string[]; getCand: (id: string) => Candidate | undefined
  getCampaign: (id: string) => Campaign | undefined; onOpen: (id: string) => void
  onMark: (ids: string[], s: CandidateStatus) => void
  onWrite: (ids: string[]) => void
}) {
  const cands = ids.map(getCand).filter(Boolean) as Candidate[]
  if (cands.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {cands.map((c) => {
          const fit = candidateFit(c.ai)
          const camp = getCampaign(c.campaignId)
          const name = candidateName(c) || 'Sin nombre'
          return (
            <div key={c.id} className="flex w-[248px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-card">
              <button
                onClick={() => onOpen(c.id)} aria-label={`Abrir la ficha de ${name}`}
                className="flex items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <MeridianAvatar name={name} fit={fit} size={40} />
                {/* Altura fija también aquí: un puesto de una línea y otro de dos
                    desplazaban todo lo de abajo y las tarjetas dejaban de cuadrar. */}
                <span className="min-w-0 flex-1">
                  {/* Nombre completo: recortarlo a "Juan Carlos" confunde cuando
                      hay dos personas que empiezan igual. */}
                  <span className="block truncate text-[15px] font-semibold leading-tight text-slate-900">{name}</span>
                  <span className="mt-0.5 block line-clamp-2 h-[30px] text-[12px] leading-tight text-slate-500">{camp?.title}</span>
                </span>
              </button>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                {fit != null
                  ? <><FitLabel fit={fit} className="text-[13px]" /><span className="num text-[11px] text-slate-400">{Math.round(fit)}/100</span></>
                  : <span className="text-[13px] text-slate-400">Sin analizar</span>}
              </div>
              {/* Altura fija: es lo que mantiene alineadas las secciones siguientes. */}
              <p className="mt-2 line-clamp-3 h-[60px] text-[12px] leading-5 text-slate-600">
                {c.ai?.summary || 'Sin analizar todavía.'}
              </p>
              <dl className="mt-1 space-y-1 border-t border-slate-100 pt-2.5">
                {keyAnswers(c, camp).map((a) => (
                  <div key={a.label} className="flex justify-between gap-2 text-[12px]">
                    <dt className="truncate text-slate-500">{a.label}</dt>
                    <dd className="shrink-0 font-medium text-slate-800">{a.value}</dd>
                  </div>
                ))}
              </dl>
              {c.ai && !c.ai.error && (c.ai.highlights.length > 0 || c.ai.concerns.length > 0) && (
                <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
                  {c.ai.highlights.slice(0, 2).map((h, i) => (
                    <p key={`h${i}`} className="flex items-start gap-1.5 text-[12px] text-slate-600"><Check className="mt-0.5 size-3 shrink-0 text-slate-400" aria-hidden /> {h}</p>
                  ))}
                  {c.ai.concerns.slice(0, 1).map((h, i) => (
                    <p key={`c${i}`} className="flex items-start gap-1.5 text-[12px] text-slate-500"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" aria-hidden /> {h}</p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Ya has comparado: aquí es donde decides, sin volver a buscarlos arriba. */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-1.5">
        <span className="px-1.5 text-[12px] text-slate-500">Cuando lo tengas claro:</span>
        <TaskAction icon={Mail} label="Escribirles" onClick={() => onWrite(cands.map((c) => c.id))} />
        <TaskAction icon={Check} label="Pasar a entrevista" onClick={() => onMark(cands.map((c) => c.id), 'entrevista')} />
      </div>
    </div>
  )
}

/**
 * Confirmar una escritura real tarda (sale un correo, se guardan estados). El botón
 * se queda ocupado, no se puede repetir, y solo desaparece cuando ha terminado.
 */
function ConfirmRow({ confirm, onResolve }: { confirm: NonNullable<Turn['confirm']>; onResolve: () => void }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (busy) return
    setBusy(true)
    try { await confirm.run() } finally { setBusy(false); onResolve() }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={run} disabled={busy} aria-busy={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:bg-indigo-600/70"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
        {busy ? (confirm.busyLabel ?? 'Un momento') : confirm.label}
      </button>
      {!busy && (
        <button onClick={onResolve} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">Cancelar</button>
      )}
    </div>
  )
}

/**
 * El correo de comprobación de interés, tal y como le va a llegar al candidato,
 * con sus dos botones de respuesta. No es una maqueta bonita: sale de la misma
 * fuente que el envío (interestEmailPreview).
 */
function InterestEmailBlock({ preview, recipients }: { preview: InterestEmailPreview; recipients: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2 text-[12px] font-medium text-slate-500">
        <Mail className="size-3.5" aria-hidden />
        Correo · <span className="num">{recipients}</span> {recipients === 1 ? 'destinatario' : 'destinatarios'}
      </div>
      <div className="px-3.5 py-3">
        <p className="mb-1.5 text-[13px] font-semibold text-slate-800">{preview.subject}</p>
        <p className="whitespace-pre-wrap text-[13px] leading-6 text-slate-700">{preview.body}</p>
        {/* Los dos botones reales del correo. Ninguno es destructivo: responder que
            ya no le interesa es rutina, así que ambos van en gris neutro. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {preview.options.map((label) => (
            <span key={label} className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-600">{label}</span>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-4 text-slate-400">{preview.footnote}</p>
      </div>
    </div>
  )
}

function DraftBlock({ channel, subject, body, to }: { channel: 'email' | 'whatsapp'; subject?: string; body: string; to: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2 text-[12px] font-medium text-slate-500">
        {channel === 'email' ? <Mail className="size-3.5" aria-hidden /> : <MessageSquare className="size-3.5" aria-hidden />}
        {channel === 'email' ? `Correo · ${to}` : `WhatsApp · ${to}`}
        <button onClick={() => { navigator.clipboard?.writeText((subject ? subject + '\n\n' : '') + body); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="px-3.5 py-3">
        {subject && <p className="mb-1.5 text-[13px] font-semibold text-slate-800">{subject}</p>}
        <p className="whitespace-pre-wrap text-[13px] leading-6 text-slate-700">{body}</p>
      </div>
    </div>
  )
}

function LockedPanel({ base }: { base: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500"><Sparkles className="size-6" aria-hidden /></div>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">{MERIDIAN_NAME} llega con Pro</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Tu mano derecha para contratar: te busca candidatos, les escribe, te avisa cuando responden y te da el pulso de cada puesto.</p>
        <Link to={`${base === '/demo' ? '/app' : base}/plan`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"><Lock className="size-3.5" aria-hidden /> Ver planes</Link>
      </div>
    </div>
  )
}

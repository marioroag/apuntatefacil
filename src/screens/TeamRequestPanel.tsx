import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import type { Candidate, TeamRequest, TeamRequestComment } from '../lib/types'
import { STATUS_META, TEAM_REQUEST_STATUS_META } from '../lib/types'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { candidateName, clockTime, initials, relativeDate } from '../lib/format'
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '../lib/buttons'
import { SlideOver } from '../components/ui/SlideOver'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { CandidatePanel } from './CandidatePanel'

function candidatePhone(c: Candidate): string {
  const raw = c.answers['telefono']
  return typeof raw === 'string' ? raw.trim() : ''
}

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const withCc = digits.startsWith('34') ? digits : `34${digits}`
  return `https://wa.me/${withCc}`
}

function StatusMark({ status }: { status: Candidate['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-slate-500">
      <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
      <span>{meta.label}</span>
    </span>
  )
}

// Descripción larga: patrón tipo LinkedIn / iOS. Texto recortado, fundido al
// corte y "Leer más" encima del fundido (no un control suelto debajo).
function RequestBody({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [needsMore, setNeedsMore] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  const bodyId = useId()

  useEffect(() => {
    setOpen(false)
  }, [text])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    setNeedsMore(el.scrollHeight > el.clientHeight + 1)
  }, [text, open])

  return (
    <div>
      <div className="relative">
        <p
          id={bodyId}
          ref={ref}
          className={`whitespace-pre-wrap text-[15px] leading-6 text-slate-700 ${
            open ? '' : 'max-h-[4.5rem] overflow-hidden'
          }`}
        >
          {text}
        </p>
        {needsMore && !open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-11 items-end bg-gradient-to-t from-white from-35% to-transparent pb-px">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={false}
              aria-controls={bodyId}
              className="pointer-events-auto text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Leer más
            </button>
          </div>
        )}
      </div>
      {needsMore && open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded={true}
          aria-controls={bodyId}
          className="mt-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-700"
        >
          Leer menos
        </button>
      )}
    </div>
  )
}

function ContactIcons({
  candidate,
  maskPhone,
}: {
  candidate: Candidate
  maskPhone: boolean
}) {
  const phone = candidatePhone(candidate)
  if (!phone) return null
  const tel = phone.replace(/\s/g, '')
  const wa = whatsappHref(phone)
  const stop = (e: MouseEvent) => e.stopPropagation()
  const wrap =
    'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'
  if (maskPhone) {
    return (
      <span className={wrap} onClick={stop}>
        <span
          className="grid size-7 place-items-center rounded-lg text-slate-400"
          title="En la demo el contacto está oculto"
        >
          <Phone className="size-3.5" aria-hidden />
        </span>
      </span>
    )
  }
  return (
    <span className={wrap} onClick={stop}>
      <a
        href={`tel:${tel}`}
        aria-label={`Llamar a ${candidateName(candidate)}`}
        title="Llamar"
        className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        onClick={stop}
      >
        <Phone className="size-3.5" aria-hidden />
      </a>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp a ${candidateName(candidate)}`}
          title="WhatsApp"
          className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={stop}
        >
          <MessageCircle className="size-3.5" aria-hidden />
        </a>
      )}
    </span>
  )
}

// Detalle de una petición del tablón: cabecera con ancla, propuestas como filas,
// hilo sobrio y composer en dos niveles. Panel lateral (doctrina: el detalle
// nunca es un modal a pantalla completa que tape la lista).
export function TeamRequestPanel({
  request,
  onClose,
}: {
  request: TeamRequest | null
  onClose: () => void
}) {
  const {
    candidates,
    getCampaign,
    loadTeamComments,
    addTeamComment,
    setTeamRequestStatus,
    deleteTeamRequest,
    retractProposal,
    boardVersion,
  } = useStore()
  const { user, role } = useAuth()
  const maskPhone = useLocation().pathname.startsWith('/demo')

  const [comments, setComments] = useState<TeamRequestComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [text, setText] = useState('')
  const [attached, setAttached] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openCandidate, setOpenCandidate] = useState<Candidate | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  const requestId = request?.id ?? null

  useEffect(() => {
    if (!requestId) return
    let alive = true
    setCommentsLoading(true)
    void loadTeamComments(requestId).then((cs) => {
      if (!alive) return
      setComments(cs)
      setCommentsLoading(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, boardVersion])

  useEffect(() => {
    setText('')
    setAttached([])
    setPickerOpen(false)
  }, [requestId])

  // Al abrir o al llegar una respuesta, el hilo queda anclado al final.
  useEffect(() => {
    if (!requestId || commentsLoading) return
    threadEndRef.current?.scrollIntoView({ block: 'end' })
  }, [requestId, comments.length, commentsLoading])

  const canManage = !!request && (request.authorUserId === user?.id || role === 'owner')
  const isOpen = request?.status === 'abierta'
  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const meta = request ? TEAM_REQUEST_STATUS_META[request.status] : null

  const send = async () => {
    if (!request || sending) return
    const body = text.trim()
    if (!body && attached.length === 0) return
    setSending(true)
    const comment = await addTeamComment(request.id, body, attached)
    setSending(false)
    if (!comment) return
    setComments((cs) => [...cs, comment])
    setText('')
    setAttached([])
    setPickerOpen(false)
  }

  const remove = async () => {
    if (!request) return
    const ok = await deleteTeamRequest(request.id)
    setConfirmDelete(false)
    if (ok) onClose()
  }

  return (
    <>
      <SlideOver
        open={!!request}
        onClose={() => {
          if (openCandidate) return
          if (pickerOpen) {
            setPickerOpen(false)
            return
          }
          onClose()
        }}
        title={
          request ? (
            <h2 className="text-lg font-semibold leading-snug text-slate-900 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
              {request.title}
            </h2>
          ) : null
        }
        actions={
          canManage && request ? (
            <>
              <button
                type="button"
                onClick={() => void setTeamRequestStatus(request.id, isOpen ? 'completada' : 'abierta')}
                aria-label={isOpen ? 'Marcar completada' : 'Reabrir'}
                title={isOpen ? 'Marcar completada' : 'Reabrir'}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {isOpen ? <CheckCircle2 className="size-5" aria-hidden /> : <RotateCcw className="size-5" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Eliminar petición"
                title="Eliminar"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </>
          ) : undefined
        }
        footer={
          request ? (
            isOpen ? (
              <Composer
                text={text}
                onText={setText}
                attached={attached}
                onAttach={setAttached}
                pickerOpen={pickerOpen}
                onPickerOpen={setPickerOpen}
                alreadyProposed={request.proposals.map((p) => p.candidateId)}
                candidateById={candidateById}
                getCampaignTitle={(id) => getCampaign(id)?.title ?? 'Puesto'}
                candidates={candidates}
                sending={sending}
                onSend={send}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-slate-500">
                  Petición completada{request.completedBy === user?.id ? ' por ti' : ''}.
                </p>
                {canManage && (
                  <button
                    onClick={() => void setTeamRequestStatus(request.id, 'abierta')}
                    className={BTN_SECONDARY_SM}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Reabrir
                  </button>
                )}
              </div>
            )
          ) : null
        }
      >
        {request && meta && (
          <div className="flex flex-col gap-8">
            {request.body ? <RequestBody text={request.body} /> : null}

            {request.proposals.length > 0 && (
              <ProposalsSection
                proposals={request.proposals}
                candidateById={candidateById}
                getCampaignTitle={(id) => getCampaign(id)?.title ?? 'Puesto'}
                canRetract={(p) => canManage || p.proposedBy === user?.id}
                onOpen={(c) => setOpenCandidate(c)}
                onRetract={(candidateId) => void retractProposal(request.id, candidateId)}
                maskPhone={maskPhone}
              />
            )}

            <section className="flex flex-col gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {request.commentCount === 0
                  ? 'Respuestas'
                  : `${request.commentCount} ${request.commentCount === 1 ? 'respuesta' : 'respuestas'}`}
              </h3>
              {commentsLoading && comments.length === 0 ? (
                <div className="grid place-items-center py-10" role="status" aria-label="Cargando respuestas">
                  <Loader2 className="size-5 animate-spin text-slate-400" aria-hidden />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm leading-5 text-slate-500">
                  Todavía nadie ha respondido.
                  {isOpen ? ' Escribe abajo o propone un candidato de la base.' : ''}
                </p>
              ) : (
                <ol className="flex flex-col">
                  {comments.map((c, i) => {
                    const chips = request.proposals.filter((p) => p.commentId === c.id)
                    const mine = c.authorUserId === user?.id
                    const authorKey = c.authorUserId ?? c.authorEmail ?? c.id
                    const prev = comments[i - 1]
                    const prevKey = prev ? (prev.authorUserId ?? prev.authorEmail ?? prev.id) : null
                    const prevHadProposals = !!prev && request.proposals.some((p) => p.commentId === prev.id)
                    const timeGapMs = prev
                      ? new Date(c.createdAt).getTime() - new Date(prev.createdAt).getTime()
                      : 0
                    // WhatsApp: nuevo bloque si cambia autor o pasan varios minutos.
                    const timeBreak = timeGapMs >= THREAD_TIME_GAP_MS
                    const firstInGroup = authorKey !== prevKey || timeBreak
                    const label = mine ? 'Tú' : threadAuthorLabel(c.authorEmail)
                    const spacing =
                      i === 0
                        ? ''
                        : prevHadProposals
                          ? 'mt-5'
                          : timeBreak
                            ? 'mt-5'
                            : firstInGroup
                              ? 'mt-3.5'
                              : 'mt-1.5'
                    return (
                      <li
                        key={c.id}
                        className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${spacing}`}
                      >
                        {!mine &&
                          (firstInGroup ? (
                            <span
                              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200"
                              aria-hidden
                            >
                              {initials(c.authorEmail || '?')}
                            </span>
                          ) : (
                            <span className="size-7 shrink-0" aria-hidden />
                          ))}
                        <div
                          className={`flex min-w-0 max-w-[min(100%,85%)] flex-col ${
                            mine ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`relative min-w-[4.5rem] px-2.5 pb-1.5 pt-1.5 text-[14px] leading-5 ${
                              mine
                                ? `bg-indigo-600 text-white ${
                                    firstInGroup ? 'rounded-xl rounded-tr-sm' : 'rounded-xl'
                                  }`
                                : `bg-slate-100 text-slate-800 ${
                                    firstInGroup ? 'rounded-xl rounded-tl-sm' : 'rounded-xl'
                                  }`
                            }`}
                          >
                            {firstInGroup && !mine && (
                              <p
                                className={`mb-0.5 truncate text-[12.5px] font-semibold leading-4 ${threadNameColor(authorKey)}`}
                              >
                                {label}
                              </p>
                            )}
                            {c.body ? (
                              <p className="whitespace-pre-wrap break-words pr-10">{c.body}</p>
                            ) : (
                              <p
                                className={`pr-10 text-[13px] italic ${
                                  mine ? 'text-indigo-100' : 'text-slate-500'
                                }`}
                              >
                                Propuso candidatos
                              </p>
                            )}
                            <time
                              dateTime={c.createdAt}
                              title={relativeDate(c.createdAt)}
                              className={`num absolute bottom-1.5 right-2.5 text-[11px] leading-none tabular-nums ${
                                mine ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              {clockTime(c.createdAt)}
                            </time>
                          </div>
                          {chips.length > 0 && (
                            <ThreadProposals
                              chips={chips}
                              candidateById={candidateById}
                              mine={mine}
                              maskPhone={maskPhone}
                              onOpen={(cand) => setOpenCandidate(cand)}
                            />
                          )}
                        </div>
                      </li>
                    )
                  })}
                  <div ref={threadEndRef} aria-hidden />
                </ol>
              )}
            </section>
          </div>
        )}
      </SlideOver>

      {openCandidate && getCampaign(openCandidate.campaignId) && (
        <CandidatePanel
          campaign={getCampaign(openCandidate.campaignId)!}
          candidate={openCandidate}
          onClose={() => setOpenCandidate(null)}
          onDeleted={() => setOpenCandidate(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Eliminar petición"
        confirmLabel="Eliminar"
        confirmVariant="danger"
      >
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar{' '}
          <strong className="font-semibold text-slate-800">{request?.title}</strong>?
          Se borran también sus respuestas. Esta acción no se puede deshacer.
        </p>
      </ConfirmDialog>
    </>
  )
}

function threadAuthorLabel(email: string | null | undefined): string {
  if (!email) return 'Miembro del equipo'
  const local = email.split('@')[0]?.trim()
  return local || email
}

/** Hueco a partir del cual WhatsApp abre un bloque nuevo (mismo autor). */
const THREAD_TIME_GAP_MS = 5 * 60 * 1000

// Colores de nombre estilo chat de grupo: paleta fija, nunca el ultramarine de marca.
const THREAD_NAME_COLORS = [
  'text-teal-700',
  'text-amber-700',
  'text-rose-700',
  'text-sky-700',
  'text-emerald-700',
  'text-violet-700',
  'text-orange-700',
  'text-cyan-700',
] as const

function threadNameColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return THREAD_NAME_COLORS[Math.abs(hash) % THREAD_NAME_COLORS.length]
}

function ThreadProposals({
  chips,
  candidateById,
  mine,
  maskPhone,
  onOpen,
}: {
  chips: { candidateId: string }[]
  candidateById: Map<string, Candidate>
  mine: boolean
  maskPhone: boolean
  onOpen: (c: Candidate) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const resolved = chips.map((p) => ({
    id: p.candidateId,
    candidate: candidateById.get(p.candidateId) ?? null,
  }))

  const preview = resolved.slice(0, 3)
  const extra = resolved.length - preview.length
  const only = resolved.length === 1 ? resolved[0].candidate : null
  const label =
    resolved.length === 1
      ? only
        ? candidateName(only)
        : '1 candidato'
      : `${resolved.length} candidatos`

  const side = mine ? 'self-end' : 'self-start'

  // Un solo candidato con acceso: tap = ficha. Sin acceso o varios: despliega.
  if (only) {
    return (
      <button
        type="button"
        onClick={() => onOpen(only)}
        className={`mt-2 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-card transition-colors hover:bg-slate-50 ${side}`}
      >
        <span className="flex shrink-0 items-center pl-0.5">
          <span className="grid size-6 place-items-center rounded-full bg-slate-900 text-[9px] font-bold text-white ring-2 ring-white">
            {initials(candidateName(only))}
          </span>
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">{label}</span>
        <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>
    )
  }

  return (
    <div
      className={`mt-2 flex w-max max-w-[min(100%,300px)] flex-col ${side} ${
        mine ? 'items-end' : 'items-start'
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={expanded ? `Ocultar ${label}` : `Ver ${label}`}
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-card transition-colors hover:bg-slate-50"
      >
        <span className="flex shrink-0 items-center pl-0.5">
          {preview.map(({ id, candidate }, i) => {
            const mark = candidate ? initials(candidateName(candidate)) : '?'
            return (
              <span
                key={id}
                className={`grid size-6 place-items-center rounded-full text-[9px] font-bold ring-2 ring-white ${
                  candidate ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                } ${i > 0 ? '-ml-1.5' : ''}`}
                style={{ zIndex: preview.length - i }}
              >
                {mark}
              </span>
            )
          })}
          {extra > 0 && (
            <span className="num -ml-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-slate-100 px-1 text-[10px] font-bold text-slate-600 ring-2 ring-white">
              +{extra}
            </span>
          )}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">{label}</span>
        <ChevronRight
          className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
            expanded ? 'rotate-90' : ''
          }`}
          aria-hidden
        />
      </button>
      <div
        id={listId}
        role="region"
        inert={!expanded || undefined}
        className={`w-full min-w-[220px] grid transition-[grid-template-rows] duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          className={`overflow-hidden transition-opacity duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
            expanded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <ul className="max-h-48 overflow-y-auto py-1">
              {resolved.map(({ id, candidate }) => (
                <li key={id} className="group flex items-center gap-0.5 pr-1">
                  {candidate ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpen(candidate)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
                          {initials(candidateName(candidate))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-800">
                            {candidateName(candidate)}
                          </span>
                          <span className="mt-0.5 block">
                            <StatusMark status={candidate.status} />
                          </span>
                        </span>
                      </button>
                      <ContactIcons candidate={candidate} maskPhone={maskPhone} />
                    </>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2 text-slate-500">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100">
                        <Lock className="size-3" aria-hidden />
                      </span>
                      <span className="text-[13px]">Sin acceso</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Lista de propuestas del panel: filas densas + tope de altura. Con muchas,
// el despliegue usa el mismo patrón que publicar petición / FAQ (grid-rows +
// opacidad, 180ms), con el contenido montado para animar también el cierre.
const PROPOSALS_COLLAPSE_AT = 4

function ScrollableProposalList({
  children,
  count,
  active = true,
}: {
  children: ReactNode
  count: number
  /** false mientras la lista está colapsada (altura 0): evita medir mal el overflow. */
  active?: boolean
}) {
  const ref = useRef<HTMLUListElement>(null)
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)

  const syncOverflow = () => {
    const el = ref.current
    if (!el || !active) {
      setCanUp(false)
      setCanDown(false)
      return
    }
    setCanUp(el.scrollTop > 2)
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
  }

  useLayoutEffect(() => {
    syncOverflow()
    if (!active) return
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(syncOverflow)
    ro.observe(el)
    // Tras el despliegue grid-rows (180ms) la altura ya es la real.
    const t = window.setTimeout(syncOverflow, 200)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, active])

  return (
    <div className="relative">
      <ul
        ref={ref}
        onScroll={syncOverflow}
        // ~3.5 filas: la siguiente se ve a medias → queda claro que hay scroll.
        className="max-h-[11.5rem] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-card"
        aria-label={`${count} candidatos propuestos${canDown || canUp ? '. Desliza para ver más' : ''}`}
      >
        {children}
      </ul>
      {canUp && (
        <div
          className="pointer-events-none absolute inset-x-px top-px h-7 rounded-t-[10px] bg-gradient-to-b from-white to-transparent"
          aria-hidden
        />
      )}
      {canDown && (
        <div
          className="pointer-events-none absolute inset-x-px bottom-px flex h-9 items-end justify-center rounded-b-[10px] bg-gradient-to-t from-white from-40% to-transparent pb-1.5"
          aria-hidden
        >
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
            Desliza para ver más
          </span>
        </div>
      )}
    </div>
  )
}

function ProposalsSection({
  proposals,
  candidateById,
  getCampaignTitle,
  canRetract,
  onOpen,
  onRetract,
  maskPhone,
}: {
  proposals: TeamRequest['proposals']
  candidateById: Map<string, Candidate>
  getCampaignTitle: (campaignId: string) => string
  canRetract: (p: TeamRequest['proposals'][number]) => boolean
  onOpen: (c: Candidate) => void
  onRetract: (candidateId: string) => void
  maskPhone: boolean
}) {
  const long = proposals.length >= PROPOSALS_COLLAPSE_AT
  const [expanded, setExpanded] = useState(!long)
  const listId = useId()

  useEffect(() => {
    setExpanded(proposals.length < PROPOSALS_COLLAPSE_AT)
  }, [proposals.length])

  const resolved = proposals.map((p) => ({
    proposal: p,
    candidate: candidateById.get(p.candidateId) ?? null,
  }))

  const list = (
    <ScrollableProposalList count={resolved.length} active={!long || expanded}>
      {resolved.map(({ proposal, candidate }, i) => (
        <ProposalRow
          key={proposal.candidateId}
          candidate={candidate}
          campaignTitle={candidate ? getCampaignTitle(candidate.campaignId) : null}
          canRetract={canRetract(proposal)}
          onOpen={onOpen}
          onRetract={() => onRetract(proposal.candidateId)}
          divided={i > 0}
          maskPhone={maskPhone}
        />
      ))}
    </ScrollableProposalList>
  )

  if (!long) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {proposals.length === 1 ? 'Candidato propuesto' : `${proposals.length} candidatos propuestos`}
        </h3>
        {list}
      </section>
    )
  }

  const preview = resolved.slice(0, 3)
  const extra = resolved.length - preview.length
  const open = expanded

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {proposals.length} candidatos propuestos
      </h3>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={open ? 'Ocultar lista de candidatos' : `Ver lista de ${proposals.length} candidatos`}
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-card transition-colors hover:bg-slate-50"
      >
        <span className="flex shrink-0 items-center pl-0.5">
          {preview.map(({ proposal, candidate }, i) => {
            const mark = candidate ? initials(candidateName(candidate)) : '?'
            return (
              <span
                key={proposal.candidateId}
                className={`grid size-6 place-items-center rounded-full text-[9px] font-bold ring-2 ring-white ${
                  candidate ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                } ${i > 0 ? '-ml-1.5' : ''}`}
                style={{ zIndex: preview.length - i }}
              >
                {mark}
              </span>
            )
          })}
          {extra > 0 && (
            <span className="num -ml-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-slate-100 px-1 text-[10px] font-bold text-slate-600 ring-2 ring-white">
              +{extra}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
          {proposals.length} candidatos
        </span>
        <ChevronRight
          className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
            open ? 'rotate-90' : ''
          }`}
          aria-hidden
        />
      </button>
      <div
        id={listId}
        role="region"
        inert={!open || undefined}
        className={`grid transition-[grid-template-rows] duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          className={`overflow-hidden transition-opacity duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {list}
        </div>
      </div>
    </section>
  )
}

function ProposalRow({
  candidate,
  campaignTitle,
  canRetract,
  onOpen,
  onRetract,
  divided = false,
  maskPhone,
}: {
  candidate: Candidate | null
  campaignTitle: string | null
  canRetract: boolean
  onOpen: (c: Candidate) => void
  onRetract: () => void
  divided?: boolean
  maskPhone: boolean
}) {
  const edge = divided ? 'border-t border-slate-100' : ''
  if (!candidate) {
    return (
      <li className={`flex items-center gap-2.5 px-3 py-2 ${edge}`}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
          <Lock className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-600">Sin acceso</p>
          <p className="text-[11px] leading-4 text-slate-500">Otra sede o eliminado</p>
        </div>
      </li>
    )
  }
  const name = candidateName(candidate)
  return (
    <li className={`group flex items-center gap-0.5 pr-1 ${edge}`}>
      <button
        type="button"
        onClick={() => onOpen(candidate)}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-4 text-slate-900">{name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
            <StatusMark status={candidate.status} />
            {campaignTitle && (
              <>
                <span className="shrink-0 text-slate-300" aria-hidden>
                  ·
                </span>
                <span className="truncate text-[12px] leading-4 text-slate-500">{campaignTitle}</span>
              </>
            )}
          </span>
        </span>
      </button>
      <ContactIcons candidate={candidate} maskPhone={maskPhone} />
      {canRetract && (
        <button
          type="button"
          onClick={onRetract}
          aria-label={`Retirar a ${name} de la petición`}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </li>
  )
}

function Composer({
  text,
  onText,
  attached,
  onAttach,
  pickerOpen,
  onPickerOpen,
  alreadyProposed,
  candidateById,
  getCampaignTitle,
  candidates,
  sending,
  onSend,
}: {
  text: string
  onText: (t: string) => void
  attached: string[]
  onAttach: (ids: string[]) => void
  pickerOpen: boolean
  onPickerOpen: (open: boolean) => void
  alreadyProposed: string[]
  candidateById: Map<string, Candidate>
  getCampaignTitle: (campaignId: string) => string
  candidates: Candidate[]
  sending: boolean
  onSend: () => void
}) {
  const [query, setQuery] = useState('')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const searchRef = useRef<HTMLInputElement>(null)
  const proposedSet = useMemo(() => new Set(alreadyProposed), [alreadyProposed])
  const attachedSet = useMemo(() => new Set(attached), [attached])

  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
    else {
      setQuery('')
      setCampaignFilter('all')
    }
  }, [pickerOpen])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const campaignOptions = useMemo(() => {
    const ids = [...new Set(candidates.map((c) => c.campaignId))]
    return ids
      .map((id) => ({ id, title: getCampaignTitle(id) }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [candidates, getCampaignTitle])

  const results = useMemo(() => {
    if (!pickerOpen) return []
    const q = norm(query.trim())
    const pool = candidates.filter((c) => !attachedSet.has(c.id))
    const scoped =
      campaignFilter === 'all' ? pool : pool.filter((c) => c.campaignId === campaignFilter)
    const matched = q ? scoped.filter((c) => norm(candidateName(c)).includes(q)) : scoped
    // Disponibles primero; los ya propuestos al final, visibles pero no seleccionables.
    const sorted = [...matched].sort((a, b) => {
      const ap = proposedSet.has(a.id) ? 1 : 0
      const bp = proposedSet.has(b.id) ? 1 : 0
      if (ap !== bp) return ap - bp
      return candidateName(a).localeCompare(candidateName(b), 'es')
    })
    const byCampaign = new Map<string, Candidate[]>()
    for (const c of sorted.slice(0, 80)) {
      byCampaign.set(c.campaignId, [...(byCampaign.get(c.campaignId) ?? []), c])
    }
    return [...byCampaign.entries()]
  }, [pickerOpen, query, candidates, attachedSet, proposedSet, campaignFilter])

  const canSend = !sending && (text.trim().length > 0 || attached.length > 0)
  const emptyHint = query
    ? 'Nadie coincide con esa búsqueda.'
    : campaignFilter !== 'all'
      ? 'No hay candidatos en este puesto.'
      : proposedSet.size > 0 && candidates.every((c) => proposedSet.has(c.id) || attachedSet.has(c.id))
        ? 'Todos los candidatos de la base ya están propuestos.'
        : 'No hay más candidatos que proponer.'

  return (
    <div className="space-y-2">
      {pickerOpen && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por nombre"
              aria-label="Buscar candidato"
              className="h-7 min-w-0 flex-1 text-sm outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => onPickerOpen(false)}
              aria-label="Cerrar buscador de candidatos"
              className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {campaignOptions.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-2.5 py-2">
              <button
                type="button"
                onClick={() => setCampaignFilter('all')}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 transition-colors ${
                  campaignFilter === 'all'
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                Todos
              </button>
              {campaignOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCampaignFilter(opt.id)}
                  className={`max-w-[9.5rem] shrink-0 truncate rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 transition-colors ${
                    campaignFilter === opt.id
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.title}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-2 py-3 text-[13px] text-slate-500">{emptyHint}</p>
            ) : (
              results.map(([campaignId, group]) => (
                <div key={campaignId}>
                  {campaignFilter === 'all' && (
                    <p className="px-2 pb-1 pt-2 text-[12px] font-semibold text-slate-500">
                      {getCampaignTitle(campaignId)}
                    </p>
                  )}
                  {group.map((c) => {
                    const proposed = proposedSet.has(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={proposed}
                        onClick={() => {
                          if (!proposed) onAttach([...attached, c.id])
                        }}
                        className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${
                          proposed
                            ? 'cursor-default opacity-60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          {initials(candidateName(c))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">{candidateName(c)}</span>
                          <span className="mt-0.5 block">
                            <StatusMark status={c.status} />
                          </span>
                        </span>
                        {proposed ? (
                          <span className="shrink-0 text-[12px] font-medium text-slate-500">Ya propuesto</span>
                        ) : (
                          <UserPlus className="size-4 shrink-0 text-slate-400" aria-hidden />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Una sola superficie: el hueco entre textarea y botones desaparece. */}
      <div className="rounded-xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15">
        {attached.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-2.5 pt-2.5 pb-2">
            {attached.map((id) => {
              const c = candidateById.get(id)
              const name = c ? candidateName(c) : 'Candidato'
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pl-2.5 pr-1 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => onAttach(attached.filter((x) => x !== id))}
                    aria-label={`Quitar a ${name}`}
                    className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-200/80 hover:text-slate-700"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              )
            })}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (e.shiftKey) return
            e.preventDefault()
            if (canSend) onSend()
          }}
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          placeholder="Escribe una respuesta"
          aria-label="Respuesta"
          className="min-h-[40px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={() => onPickerOpen(!pickerOpen)}
            aria-expanded={pickerOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
              pickerOpen
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <UserPlus className="size-3.5" aria-hidden />
            Proponer candidato
          </button>
          <button type="button" onClick={onSend} disabled={!canSend} className={`${BTN_PRIMARY_SM} disabled:opacity-60`}>
            {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : 'Responder'}
          </button>
        </div>
      </div>
    </div>
  )
}

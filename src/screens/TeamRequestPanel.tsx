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
import { candidateName, clockTime, initials, memberAvatarTone, relativeDate } from '../lib/format'
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

function scrollPanelToEnd(end: HTMLElement, behavior: ScrollBehavior = 'auto') {
  let node: HTMLElement | null = end.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      node.scrollTo({ top: node.scrollHeight, behavior })
      return
    }
    node = node.parentElement
  }
  end.scrollIntoView({ block: 'end', behavior })
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

// Descripción larga: recorte duro + "Leer más" (sin fundido decorativo).
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
      <p
        id={bodyId}
        ref={ref}
        className={`whitespace-pre-wrap text-[15px] leading-6 text-slate-700 ${
          open ? '' : 'max-h-[4.5rem] overflow-hidden'
        }`}
      >
        {text}
      </p>
      {needsMore && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="mt-1.5 inline-flex min-h-11 items-center text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {open ? 'Leer menos' : 'Leer más'}
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
  // Siempre visibles: el valor del tablón es contactar, no esconder el teléfono.
  const wrap = 'flex shrink-0 items-center gap-0.5'
  if (maskPhone) {
    return (
      <span className={wrap} onClick={stop}>
        <span
          className="grid size-8 pointer-coarse:size-11 place-items-center rounded-lg text-slate-400"
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
        className="grid size-8 pointer-coarse:size-11 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
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
          className="grid size-8 pointer-coarse:size-11 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
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
  const [deleting, setDeleting] = useState(false)
  const [openCandidate, setOpenCandidate] = useState<Candidate | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const pendingScrollRef = useRef(false)
  const loadedRequestRef = useRef<string | null>(null)

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

  // Limpia el hilo antes de pintar otra petición: evita un frame con mensajes ajenos.
  useLayoutEffect(() => {
    pendingScrollRef.current = false
    if (loadedRequestRef.current !== requestId) {
      loadedRequestRef.current = requestId
      setComments([])
    }
    setText('')
    setAttached([])
    setPickerOpen(false)
  }, [requestId])

  // Solo un mensaje enviado por esta persona lleva el panel al final.
  // Al abrir una petición conservamos el inicio visible: descripción y propuestas.
  useLayoutEffect(() => {
    if (!pendingScrollRef.current || commentsLoading || comments.length === 0) return
    const end = threadEndRef.current
    if (!end) return
    pendingScrollRef.current = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => scrollPanelToEnd(end, reducedMotion ? 'auto' : 'smooth'))
  }, [comments.length, commentsLoading])

  const canManage = !!request && (request.authorUserId === user?.id || role === 'owner')
  const isOpen = request?.status === 'abierta'
  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const meta = request ? TEAM_REQUEST_STATUS_META[request.status] : null
  const messageCount = commentsLoading ? request?.commentCount ?? 0 : comments.length

  const send = async () => {
    if (!request || sending) return
    const body = text.trim()
    if (!body && attached.length === 0) return
    setSending(true)
    const comment = await addTeamComment(request.id, body, attached)
    setSending(false)
    if (!comment) return
    pendingScrollRef.current = true
    setComments((cs) => (cs.some((c) => c.id === comment.id) ? cs : [...cs, comment]))
    setText('')
    setAttached([])
    setPickerOpen(false)
  }

  const remove = async () => {
    if (!request || deleting) return
    setDeleting(true)
    const ok = await deleteTeamRequest(request.id)
    setDeleting(false)
    setConfirmDelete(false)
    if (ok) onClose()
  }

  return (
    <>
      <SlideOver
        open={!!request}
        inert={!!openCandidate || confirmDelete}
        onClose={() => {
          if (openCandidate || confirmDelete || deleting) return
          if (pickerOpen) {
            setPickerOpen(false)
            return
          }
          onClose()
        }}
        title={
          request ? (
            <h2 className="text-balance text-lg font-semibold leading-snug text-slate-900">
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
                className="grid size-9 pointer-coarse:size-11 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                {isOpen ? <CheckCircle2 className="size-5" aria-hidden /> : <RotateCcw className="size-5" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Eliminar petición"
                title="Eliminar"
                className="grid size-9 pointer-coarse:size-11 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
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
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Actividad</h3>
                {messageCount > 0 && (
                  <span className="num text-[12px] text-slate-500">
                    {messageCount} {messageCount === 1 ? 'mensaje' : 'mensajes'}
                  </span>
                )}
              </div>
              {commentsLoading && comments.length === 0 ? (
                <ActivitySkeleton />
              ) : comments.length === 0 ? (
                <p className="text-sm leading-5 text-slate-500">
                  {isOpen
                    ? 'Propón un candidato o deja un mensaje.'
                    : 'Nadie ha escrito todavía.'}
                </p>
              ) : (
                <ol className="flex flex-col">
                  {comments.map((c, i) => {
                    const chips = request.proposals.filter((p) => p.commentId === c.id)
                    const mine = c.authorUserId === user?.id
                    const label = mine ? 'Tú' : threadAuthorLabel(c.authorEmail)
                    const hasBody = !!c.body.trim()
                    const isRequestAuthor =
                      (!!c.authorUserId && c.authorUserId === request.authorUserId) ||
                      (!!c.authorEmail &&
                        !!request.authorEmail &&
                        c.authorEmail.toLowerCase() === request.authorEmail.toLowerCase())
                    return (
                      <ActivityEntry
                        key={c.id}
                        email={c.authorEmail}
                        label={label}
                        at={c.createdAt}
                        body={hasBody ? c.body : null}
                        divided={i > 0}
                        authority={isRequestAuthor}
                        proposalHint={
                          !hasBody && chips.length > 0
                            ? `Propuso ${chips.length === 1 ? '1 candidato' : `${chips.length} candidatos`}`
                            : null
                        }
                      >
                        {chips.length > 0 ? (
                          <ThreadProposals
                            chips={chips}
                            candidateById={candidateById}
                            maskPhone={maskPhone}
                            onOpen={(cand) => setOpenCandidate(cand)}
                          />
                        ) : null}
                      </ActivityEntry>
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
        onClose={() => {
          if (!deleting) setConfirmDelete(false)
        }}
        onConfirm={() => void remove()}
        title="Eliminar petición"
        confirmLabel="Eliminar"
        confirmVariant="danger"
        loading={deleting}
      >
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar{' '}
          <strong className="font-semibold text-slate-800">{request?.title}</strong>?
          Se borran también sus mensajes. Esta acción no se puede deshacer.
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

function ActivitySkeleton() {
  return (
    <div
      className="flex gap-3 py-1"
      role="status"
      aria-label="Cargando actividad"
    >
      <span
        className="size-7 shrink-0 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none"
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-2.5 pt-0.5" aria-hidden>
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}

/** Entrada del feed de actividad. */
function ActivityEntry({
  email,
  label,
  at,
  body,
  divided = false,
  authority = false,
  proposalHint = null,
  children,
}: {
  email: string | null | undefined
  label: string
  at: string
  body?: string | null
  divided?: boolean
  /** Autor de la petición: el nombre lleva su color de miembro (autoridad). */
  authority?: boolean
  proposalHint?: string | null
  children?: ReactNode
}) {
  const tone = memberAvatarTone(email)
  return (
    <li className={`flex gap-3 ${divided ? 'mt-5 border-t border-slate-100 pt-5' : ''}`}>
      <span
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${tone.bg} ${tone.text}`}
        aria-hidden
      >
        {initials(email || '?')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px]">
          <span className={`font-semibold ${authority ? tone.name : 'text-slate-900'}`}>{label}</span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <time dateTime={at} title={relativeDate(at)} className="num text-slate-500">
            {clockTime(at)}
          </time>
        </div>
        {body ? (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-slate-700 text-pretty">
            {body}
          </p>
        ) : null}
        {proposalHint ? <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{proposalHint}</p> : null}
        {children}
      </div>
    </li>
  )
}

/** Adjunto de candidatos en el feed (Linear): ancho de columna, sin burbujas. */
function ThreadProposals({
  chips,
  candidateById,
  maskPhone,
  onOpen,
}: {
  chips: { candidateId: string }[]
  candidateById: Map<string, Candidate>
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

  if (only) {
    return (
      <button
        type="button"
        onClick={() => onOpen(only)}
        className="mt-2.5 flex min-h-11 w-full max-w-md items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2 pl-2 pr-3 text-left transition-colors hover:bg-slate-50"
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
          aria-hidden
        >
          {initials(candidateName(only))}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{label}</span>
        <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>
    )
  }

  return (
    <div className="mt-2.5 w-full max-w-md">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={expanded ? `Ocultar ${label}` : `Ver ${label}`}
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2 pl-2 pr-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex shrink-0 items-center pl-0.5" aria-hidden>
          {preview.map(({ id, candidate }, i) => {
            const mark = candidate ? initials(candidateName(candidate)) : '?'
            return (
              <span
                key={id}
                className={`grid size-7 place-items-center rounded-full text-[10px] font-bold ring-2 ring-white ${
                  candidate ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                } ${i > 0 ? '-ml-1.5' : ''}`}
                style={{ zIndex: preview.length - i }}
              >
                {mark}
              </span>
            )
          })}
          {extra > 0 && (
            <span className="num -ml-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-1 text-[10px] font-bold text-slate-600 ring-2 ring-white">
              +{extra}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{label}</span>
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
        className={`grid transition-[grid-template-rows] duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          className={`overflow-hidden transition-opacity duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${
            expanded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1">
            {resolved.map(({ id, candidate }) => (
              <li key={id} className="group flex items-center gap-0.5 pr-1">
                {candidate ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpen(candidate)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-900 text-[9px] font-bold text-white"
                        aria-hidden
                      >
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
  )
}

// Lista de propuestas del panel: filas densas + tope de altura. Con muchas,
// el despliegue usa el mismo patrón que publicar petición / FAQ (grid-rows +
// opacidad, 180ms), con el contenido montado para animar también el cierre.
const PROPOSALS_COLLAPSE_AT = 4
const PICKER_PAGE_SIZE = 24

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
        className="max-h-[11.5rem] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white"
        aria-label={`${count} candidatos propuestos${canDown || canUp ? '. Desliza para ver más' : ''}`}
      >
        {children}
      </ul>
      {canUp && (
        <div
          className="pointer-events-none absolute inset-x-px top-px h-6 rounded-t-[10px] bg-white/90"
          aria-hidden
        />
      )}
      {canDown && (
        <div
          className="pointer-events-none absolute inset-x-px bottom-px flex items-center justify-center rounded-b-[10px] border-t border-slate-100 bg-white/95 py-1.5"
          aria-hidden
        >
          <span className="text-[11px] font-medium text-slate-500">Desliza para ver más</span>
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

  const heading =
    proposals.length === 1 ? 'Candidato propuesto' : `${proposals.length} candidatos propuestos`

  if (!long) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-800">{heading}</h3>
        {list}
      </section>
    )
  }

  const preview = resolved.slice(0, 3)
  const extra = resolved.length - preview.length
  const open = expanded

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-800">{heading}</h3>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={open ? 'Ocultar lista de candidatos' : `Ver lista de ${proposals.length} candidatos`}
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex shrink-0 items-center pl-0.5" aria-hidden>
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
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
          aria-hidden
        >
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
          className="grid size-8 pointer-coarse:size-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
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
  const [pickerLimit, setPickerLimit] = useState(PICKER_PAGE_SIZE)
  const searchRef = useRef<HTMLInputElement>(null)
  const pickerId = useId()
  const proposedSet = useMemo(() => new Set(alreadyProposed), [alreadyProposed])
  const attachedSet = useMemo(() => new Set(attached), [attached])

  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
    else {
      setQuery('')
      setCampaignFilter('all')
      setPickerLimit(PICKER_PAGE_SIZE)
    }
  }, [pickerOpen])

  useEffect(() => {
    setPickerLimit(PICKER_PAGE_SIZE)
  }, [query, campaignFilter])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const campaignOptions = useMemo(() => {
    const ids = [...new Set(candidates.map((c) => c.campaignId))]
    return ids
      .map((id) => ({ id, title: getCampaignTitle(id) }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [candidates, getCampaignTitle])

  const { results, totalMatched, hasMore } = useMemo(() => {
    if (!pickerOpen) return { results: [] as [string, Candidate[]][], totalMatched: 0, hasMore: false }
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
    const visible = sorted.slice(0, pickerLimit)
    const byCampaign = new Map<string, Candidate[]>()
    for (const c of visible) {
      byCampaign.set(c.campaignId, [...(byCampaign.get(c.campaignId) ?? []), c])
    }
    return {
      results: [...byCampaign.entries()] as [string, Candidate[]][],
      totalMatched: sorted.length,
      hasMore: sorted.length > pickerLimit,
    }
  }, [pickerOpen, query, candidates, attachedSet, proposedSet, campaignFilter, pickerLimit])

  const canSend = !sending && (text.trim().length > 0 || attached.length > 0)
  const emptyHint = query
    ? 'Nadie coincide con esa búsqueda.'
    : campaignFilter !== 'all'
      ? 'No hay candidatos en este puesto.'
      : proposedSet.size > 0 && candidates.every((c) => proposedSet.has(c.id) || attachedSet.has(c.id))
        ? 'Todos los candidatos de la base ya están propuestos.'
        : 'No hay más candidatos que proponer.'

  const chipClass = (active: boolean) =>
    `inline-flex min-h-8 pointer-coarse:min-h-11 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium ring-1 transition-colors ${
      active
        ? 'bg-slate-900 text-white ring-slate-900'
        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
    }`

  return (
    <div className="space-y-2">
      {pickerOpen && (
        <div id={pickerId} className="rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 pointer-coarse:py-1">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por nombre"
              aria-label="Buscar candidato"
              className="h-9 pointer-coarse:h-11 min-w-0 flex-1 text-sm outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => onPickerOpen(false)}
              aria-label="Cerrar buscador de candidatos"
              className="grid size-8 pointer-coarse:size-11 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {campaignOptions.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-2.5 py-2">
              <button
                type="button"
                onClick={() => setCampaignFilter('all')}
                aria-pressed={campaignFilter === 'all'}
                className={chipClass(campaignFilter === 'all')}
              >
                Todos
              </button>
              {campaignOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCampaignFilter(opt.id)}
                  aria-pressed={campaignFilter === opt.id}
                  className={`${chipClass(campaignFilter === opt.id)} max-w-[9.5rem] truncate`}
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
              <>
                {results.map(([campaignId, group]) => (
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
                            proposed ? 'cursor-default opacity-60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
                            aria-hidden
                          >
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
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setPickerLimit((n) => n + PICKER_PAGE_SIZE)}
                    className="mt-1 flex min-h-11 w-full items-center justify-center rounded-lg text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                  >
                    Ver más ({totalMatched - pickerLimit} restantes)
                  </button>
                )}
              </>
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
                    className="grid size-5 pointer-coarse:size-11 place-items-center rounded-full text-slate-400 hover:bg-slate-200/80 hover:text-slate-700"
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
            if (e.shiftKey || e.nativeEvent.isComposing) return
            e.preventDefault()
            if (canSend) onSend()
          }}
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          placeholder="Añade un mensaje"
          aria-label="Mensaje"
          className="min-h-11 w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm pointer-coarse:text-base outline-none placeholder:text-slate-500 focus:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={() => onPickerOpen(!pickerOpen)}
            aria-expanded={pickerOpen}
            aria-controls={pickerId}
            className={`inline-flex h-9 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
              pickerOpen
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <UserPlus className="size-3.5" aria-hidden />
            Proponer candidato
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label={sending ? 'Enviando mensaje' : 'Enviar mensaje'}
            aria-busy={sending}
            className={`${BTN_PRIMARY_SM} pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, CheckCircle2, Loader2, Lock, RotateCcw, Search, Trash2, UserPlus, X } from 'lucide-react'
import type { Candidate, TeamRequest, TeamRequestComment } from '../lib/types'
import { TEAM_REQUEST_STATUS_META } from '../lib/types'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { candidateName, initials, relativeDate } from '../lib/format'
import { BTN_PRIMARY_SM, BTN_SECONDARY } from '../lib/buttons'
import { SlideOver } from '../components/ui/SlideOver'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { CandidatePanel } from './CandidatePanel'

// Detalle de una petición del tablón: descripción, candidatos propuestos, hilo
// de respuestas y composer con adjuntar candidatos. Panel lateral (doctrina:
// el detalle nunca es un modal a pantalla completa que tape la lista).
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
    sites,
    loadTeamComments,
    addTeamComment,
    setTeamRequestStatus,
    deleteTeamRequest,
    retractProposal,
    boardVersion,
  } = useStore()
  const { user, role } = useAuth()

  const [comments, setComments] = useState<TeamRequestComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [text, setText] = useState('')
  const [attached, setAttached] = useState<string[]>([]) // candidate_ids elegidos, aún sin enviar
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openCandidate, setOpenCandidate] = useState<Candidate | null>(null)

  const requestId = request?.id ?? null

  // Hilo perezoso: al abrir y cuando llega actividad de otros (boardVersion).
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

  // Al cambiar de petición, el borrador vuelve a cero.
  useEffect(() => {
    setText('')
    setAttached([])
    setPickerOpen(false)
  }, [requestId])

  const canManage = !!request && (request.authorUserId === user?.id || role === 'owner')
  const isOpen = request?.status === 'abierta'
  const siteName = request?.siteId ? sites.find((s) => s.id === request.siteId)?.name : null

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])

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

  const meta = request ? TEAM_REQUEST_STATUS_META[request.status] : null

  return (
    <>
      <SlideOver
        open={!!request}
        // Con la ficha de un candidato apilada encima, Escape debe cerrar SOLO
        // esa ficha (los dos SlideOver escuchan el teclado a la vez).
        onClose={() => {
          if (openCandidate) return
          onClose()
        }}
        title={
          request && meta ? (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-slate-900">{request.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
                <span className="truncate">{request.authorEmail || 'Sin autor'}</span>
                <span aria-hidden>·</span>
                <span className="num">{relativeDate(request.createdAt)}</span>
                {siteName && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3 text-slate-400" aria-hidden />
                      {siteName}
                    </span>
                  </>
                )}
              </p>
            </div>
          ) : null
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
              <p className="py-1 text-center text-[13px] text-slate-500">
                Petición completada{request.completedBy === user?.id ? ' por ti' : ''}. Reábrela para seguir respondiendo.
              </p>
            )
          ) : null
        }
      >
        {request && meta && (
          <div className="space-y-5">
            {/* Estado + acciones */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${meta.chip}`}>
                <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                {meta.label}
              </span>
              <span className="flex-1" />
              {canManage && (
                <>
                  <button
                    onClick={() => void setTeamRequestStatus(request.id, isOpen ? 'completada' : 'abierta')}
                    className={BTN_SECONDARY}
                  >
                    {isOpen ? <CheckCircle2 className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                    {isOpen ? 'Marcar completada' : 'Reabrir'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Eliminar petición"
                    className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </>
              )}
            </div>

            {request.body && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{request.body}</p>
            )}

            {/* Candidatos propuestos */}
            {request.proposals.length > 0 && (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {request.proposals.length === 1 ? 'Candidato propuesto' : 'Candidatos propuestos'}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {request.proposals.map((p) => (
                    <ProposalChip
                      key={p.candidateId}
                      candidate={candidateById.get(p.candidateId) ?? null}
                      canRetract={canManage || p.proposedBy === user?.id}
                      onOpen={(c) => setOpenCandidate(c)}
                      onRetract={() => void retractProposal(request.id, p.candidateId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Hilo de respuestas */}
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {request.commentCount === 0 ? 'Respuestas' : `${request.commentCount} ${request.commentCount === 1 ? 'respuesta' : 'respuestas'}`}
              </h3>
              {commentsLoading && comments.length === 0 ? (
                <div className="grid place-items-center py-6" role="status" aria-label="Cargando respuestas">
                  <Loader2 className="size-5 animate-spin text-slate-400" aria-hidden />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-[13px] text-slate-500">
                  Todavía nadie ha respondido. {isOpen ? 'Escribe abajo o propón un candidato de la base.' : ''}
                </p>
              ) : (
                <ol className="space-y-3">
                  {comments.map((c) => {
                    const chips = request.proposals.filter((p) => p.commentId === c.id)
                    const mine = c.authorUserId === user?.id
                    return (
                      <li key={c.id} className="flex gap-2.5">
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          {initials(c.authorEmail || '?')}
                        </span>
                        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                          <p className="flex items-baseline gap-2 text-[12px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">
                              {mine ? 'Tú' : c.authorEmail || 'Miembro del equipo'}
                            </span>
                            <span className="num shrink-0">{relativeDate(c.createdAt)}</span>
                          </p>
                          {c.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>}
                          {chips.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {chips.map((p) => (
                                <ProposalChip
                                  key={p.candidateId}
                                  candidate={candidateById.get(p.candidateId) ?? null}
                                  small
                                  canRetract={false}
                                  onOpen={(cand) => setOpenCandidate(cand)}
                                  onRetract={() => {}}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        )}
      </SlideOver>

      {/* Ficha del candidato propuesto, apilada sobre el detalle de la petición */}
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

// Chip de candidato propuesto. Si el candidato no es visible para quien mira
// (encargado de otra sede, candidato eliminado), degrada a un chip sin datos:
// la fila del puente se ve, el dato personal no.
function ProposalChip({
  candidate,
  canRetract,
  onOpen,
  onRetract,
  small = false,
}: {
  candidate: Candidate | null
  canRetract: boolean
  onOpen: (c: Candidate) => void
  onRetract: () => void
  small?: boolean
}) {
  const pad = small ? 'py-0.5 pl-1 pr-2 text-[12px]' : 'py-1 pl-1.5 pr-2.5 text-[13px]'
  if (!candidate) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 font-medium text-slate-500 ${pad}`}
        title="Candidato de otra sede o eliminado"
      >
        <span className="grid size-5 place-items-center rounded-full bg-slate-200 text-slate-500">
          <Lock className="size-3" aria-hidden />
        </span>
        Sin acceso
      </span>
    )
  }
  const name = candidateName(candidate)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white font-medium text-slate-700 ring-1 ring-slate-200 ${pad}`}>
      <button
        onClick={() => onOpen(candidate)}
        className="inline-flex min-w-0 items-center gap-1.5 hover:text-indigo-700"
        title={`Abrir la ficha de ${name}`}
      >
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
          {initials(name)}
        </span>
        <span className="truncate">{name}</span>
      </button>
      {canRetract && (
        <button
          onClick={onRetract}
          aria-label={`Retirar a ${name} de la petición`}
          className="-mr-1 grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

// Composer del hilo: texto + adjuntar candidatos. El picker es un panel que se
// despliega encima del composer (dentro del propio footer): busca en los
// candidatos ya cargados en memoria (acotados por RLS), agrupados por puesto.
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
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
    else setQuery('')
  }, [pickerOpen])

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Excluye los ya propuestos y los ya elegidos en este borrador.
  const results = useMemo(() => {
    if (!pickerOpen) return []
    const q = norm(query.trim())
    const taken = new Set([...alreadyProposed, ...attached])
    const pool = candidates.filter((c) => !taken.has(c.id))
    const matched = q ? pool.filter((c) => norm(candidateName(c)).includes(q)) : pool
    // Agrupado por puesto, orden estable; con tope para que la lista no explote.
    const byCampaign = new Map<string, Candidate[]>()
    for (const c of matched.slice(0, 60)) {
      byCampaign.set(c.campaignId, [...(byCampaign.get(c.campaignId) ?? []), c])
    }
    return [...byCampaign.entries()]
  }, [pickerOpen, query, candidates, alreadyProposed, attached])

  const canSend = !sending && (text.trim().length > 0 || attached.length > 0)

  return (
    <div>
      {pickerOpen && (
        <div className="mb-2 rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por nombre"
              aria-label="Buscar candidato"
              className="h-7 min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
            />
            <button
              onClick={() => onPickerOpen(false)}
              aria-label="Cerrar buscador de candidatos"
              className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-2 py-3 text-[13px] text-slate-500">
                {query ? 'Nadie coincide con esa búsqueda.' : 'No hay más candidatos que proponer.'}
              </p>
            ) : (
              results.map(([campaignId, group]) => (
                <div key={campaignId}>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {getCampaignTitle(campaignId)}
                  </p>
                  {group.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onAttach([...attached, c.id])}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                        {initials(candidateName(c))}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{candidateName(c)}</span>
                      <UserPlus className="size-4 shrink-0 text-slate-400" aria-hidden />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {attached.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attached.map((id) => {
            const c = candidateById.get(id)
            const name = c ? candidateName(c) : 'Candidato'
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1.5 text-[13px] font-medium text-indigo-800 ring-1 ring-indigo-200">
                {name}
                <button
                  onClick={() => onAttach(attached.filter((x) => x !== id))}
                  aria-label={`Quitar a ${name}`}
                  className="grid size-5 place-items-center rounded-full text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            // Enviar con Cmd/Ctrl + Enter (Enter solo hace salto de línea).
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          placeholder="Escribe una respuesta"
          aria-label="Respuesta"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
        <button
          onClick={() => onPickerOpen(!pickerOpen)}
          aria-label="Adjuntar candidato"
          aria-expanded={pickerOpen}
          title="Proponer un candidato de la base"
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          <UserPlus className="size-4.5" aria-hidden />
        </button>
        <button onClick={onSend} disabled={!canSend} className={`${BTN_PRIMARY_SM} h-11 disabled:opacity-60`}>
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Responder'}
        </button>
      </div>
    </div>
  )
}

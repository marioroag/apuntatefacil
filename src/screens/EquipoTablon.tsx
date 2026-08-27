import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList, Loader2, Send } from 'lucide-react'
import type { TeamRequest } from '../lib/types'
import { TEAM_REQUEST_STATUS_META } from '../lib/types'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { candidateName, memberAvatarTone, relativeDate } from '../lib/format'
import { useProfiles } from '../lib/profiles'
import { BTN_PRIMARY } from '../lib/buttons'
import { Avatar } from '../components/ui/Avatar'
import { useToast } from '../components/ui/Toast'
import { TeamRequestPanel } from './TeamRequestPanel'
import { IconoVacio } from '../components/ui/IconoVacio'

type Filter = 'abiertas' | 'completadas' | 'todas'

// Tablón de peticiones (pestaña por defecto de Equipo, visible a todo el
// equipo): composer arriba, lista por actividad, detalle en panel lateral.
export function EquipoTablon() {
  const { teamRequests, candidates, sites, loading, createTeamRequest, markBoardSeen } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [filter, setFilter] = useState<Filter>('abiertas')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [siteId, setSiteId] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Visitar el tablón consume el badge del menú; también cuando entra actividad
  // nueva mientras lo tienes delante.
  const markRef = useRef(markBoardSeen)
  markRef.current = markBoardSeen
  useEffect(() => {
    markRef.current()
  }, [teamRequests])

  // Deep link (?peticion=<id>): destino del email de aviso y de recargas.
  const openId = params.get('peticion')
  const openRequest = openId ? teamRequests.find((r) => r.id === openId) ?? null : null
  const openDetail = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('peticion', id)
      return next
    })
  const closeDetail = () =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('peticion')
      return next
    })

  // Enlace a una petición borrada o de otro equipo: limpia la URL y avisa una vez.
  const missingLinkRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || !openId || openRequest) return
    if (missingLinkRef.current === openId) return
    missingLinkRef.current = openId
    toast.show('Esa petición ya no está disponible.')
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('peticion')
      return next
    })
  }, [loading, openId, openRequest, setParams, toast])

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.name ?? null : null)

  const openCount = teamRequests.filter((r) => r.status === 'abierta').length
  const visible = teamRequests.filter((r) =>
    filter === 'todas' ? true : filter === 'abiertas' ? r.status === 'abierta' : r.status === 'completada',
  )
  const detailsOpen = expanded || !!body || !!siteId

  const publish = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    // Validación al enviar, nunca al teclear (doctrina de formularios).
    if (t.length < 3) {
      setTitleError(true)
      titleRef.current?.focus()
      return
    }
    setPublishing(true)
    const created = await createTeamRequest({ title: t.slice(0, 120), body: body.trim(), siteId: siteId || null })
    setPublishing(false)
    if (!created) return
    setTitle('')
    setBody('')
    setSiteId('')
    setExpanded(false)
    setTitleError(false)
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16" role="status" aria-label="Cargando tablón">
        <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
      </div>
    )
  }

  return (
    <>
      {/* Composer: publicar una petición */}
      <form onSubmit={publish} className="rounded-xl filo bg-white p-4 shadow-card">
        <label htmlFor="board-title" className="text-sm font-semibold text-slate-800">
          Publica una petición
        </label>
        <input
          id="board-title"
          ref={titleRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (titleError) setTitleError(false)
          }}
          onFocus={() => setExpanded(true)}
          placeholder="¿Qué necesita tu equipo? P. ej. 3 electricistas en Tenerife Norte"
          maxLength={120}
          aria-invalid={titleError || undefined}
          aria-describedby={titleError ? 'board-title-error' : undefined}
          className={`mt-2 h-10 w-full rounded-xl border px-3 text-sm outline-none placeholder:text-slate-500 focus:ring-4 ${
            titleError
              ? 'border-red-600 focus:border-red-600 focus:ring-red-600/10'
              : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/15'
          }`}
        />
        {titleError && (
          <p id="board-title-error" className="mt-1.5 text-[12px] font-medium text-red-600">
            Escribe qué necesitas (al menos 3 caracteres).
          </p>
        )}
        {/* Despliegue seamless (mismo patrón que el FAQ): altura por grid-rows +
            opacidad, 180ms ease-out. El contenido permanece montado para animar
            también el cierre tras publicar. */}
        <div
          className={`grid transition-[grid-template-rows] duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${
            detailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
          inert={!detailsOpen || undefined}
        >
          <div
            className={`overflow-hidden transition-opacity duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${
              detailsOpen ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Detalles (opcional): fechas, requisitos, urgencia..."
              aria-label="Detalles de la petición"
              tabIndex={detailsOpen ? undefined : -1}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {sites.length > 0 ? (
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  aria-label="Sede (opcional)"
                  tabIndex={detailsOpen ? undefined : -1}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                >
                  <option value="">Sin sede concreta</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={publishing}
                tabIndex={detailsOpen ? undefined : -1}
                className={`${BTN_PRIMARY} disabled:opacity-60`}
              >
                {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Publicar
              </button>
            </div>
          </div>
        </div>
      </form>

      {teamRequests.length === 0 ? (
        <div className="mt-10 grid place-items-center text-center">
          <IconoVacio Icon={ClipboardList} />
          <h2 className="mt-3 text-[15px] font-semibold text-slate-900">Pide ayuda a tu equipo</h2>
          <p className="mt-1 max-w-[420px] text-sm text-slate-500">
            Publica lo que necesitas cubrir y tus compañeros responden y proponen candidatos de vuestra base.
          </p>
          <button onClick={() => titleRef.current?.focus()} className={`${BTN_PRIMARY} mt-4`}>
            Escribir la primera petición
          </button>
        </div>
      ) : (
        <>
          {/* Filtro por estado */}
          <div className="mt-5 flex gap-1.5" role="group" aria-label="Filtrar peticiones">
            {(
              [
                ['abiertas', openCount > 0 ? `Abiertas (${openCount})` : 'Abiertas'],
                ['completadas', 'Completadas'],
                ['todas', 'Todas'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                // ACENTO SÓLIDO, y esto es una excepción declarada, no un olvido.
                // Se probó pasarlo a la cápsula teñida del panel para tener una sola
                // gramática y se midió que era peor: aquí las tres cápsulas están
                // SIEMPRE presentes, así que el relleno es el único portador de cuál
                // está puesta, y `indigo-50` contra `slate-100` se separan 1,02:1, o
                // sea nada. Los chips del panel sí pueden ir teñidos porque allí un
                // chip solo existe si filtra: su PRESENCIA es la señal. Y un control
                // con `aria-pressed` es una SELECCIÓN, que es uno de los cuatro usos
                // permitidos del ultramarine junto a la acción y el foco.
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  filter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {filter === 'abiertas' ? 'No hay peticiones abiertas. Todo al día.' : 'Todavía no hay peticiones completadas.'}
              </p>
            ) : (
              visible.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  mine={r.authorUserId === user?.id}
                  siteName={siteName(r.siteId)}
                  proposalNames={r.proposals.map((p) => {
                    const c = candidateById.get(p.candidateId)
                    return c ? candidateName(c) : null
                  })}
                  onOpen={() => openDetail(r.id)}
                />
              ))
            )}
          </div>
        </>
      )}

      <TeamRequestPanel request={openRequest} onClose={closeDetail} />
    </>
  )
}

function RequestCard({
  request,
  mine,
  siteName,
  proposalNames,
  onOpen,
}: {
  request: TeamRequest
  mine: boolean
  siteName: string | null
  proposalNames: (string | null)[]
  onOpen: () => void
}) {
  const meta = TEAM_REQUEST_STATUS_META[request.status]
  const done = request.status === 'completada'
  // El autor con su nombre de perfil (respaldo: el email). Antes se cortaba el
  // email por la arroba a mano, que dejaba cosas como "laura.gil".
  const profiles = useProfiles()
  const author = mine ? 'Tú' : profiles.nameFor(request.authorUserId, request.authorEmail)
  const authorTone = memberAvatarTone(request.authorEmail)
  return (
    <button
      onClick={onOpen}
      className="block w-full rounded-xl filo bg-white p-4 text-left shadow-card transition-colors hover:bg-slate-50"
    >
      <div className="flex items-start gap-2.5">
        <span className={`min-w-0 flex-1 truncate text-base font-semibold leading-snug ${done ? 'text-slate-500' : 'text-slate-900'}`}>
          {request.title}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.chip}`}>
          {meta.label}
        </span>
      </div>
      {request.body && (
        <p className="mt-1 truncate text-[13px] text-slate-500">{request.body}</p>
      )}
      <div className="mt-2.5 flex items-center gap-2 text-[12px] text-slate-500">
        <span className={`truncate font-semibold ${authorTone.name}`}>{author}</span>
        <span aria-hidden className="text-slate-300">
          ·
        </span>
        <span className="num shrink-0">{relativeDate(request.lastActivityAt)}</span>
        {request.commentCount > 0 && (
          <>
            <span aria-hidden className="text-slate-300">
              ·
            </span>
            <span className="num shrink-0">
              {request.commentCount} {request.commentCount === 1 ? 'mensaje' : 'mensajes'}
            </span>
          </>
        )}
        {siteName && (
          <>
            <span aria-hidden className="text-slate-300">
              ·
            </span>
            <span className="min-w-0 truncate">{siteName}</span>
          </>
        )}
        {proposalNames.length > 0 && (
          <span
            className="ml-auto flex shrink-0 items-center"
            aria-label={`${proposalNames.length} candidatos propuestos`}
          >
            {/* La cara sale de `ui/Avatar`. Repintada aquí era un TERCER negro
                (slate-700, contra el slate-900 del panel y el tono estable de la
                lista de miembros) y la letra se quedaba al 36% del círculo. El aro
                blanco se queda: es un halo, la excepción declarada al `ring-inset`. */}
            {proposalNames.slice(0, 3).map((name, i) => (
              <span key={i} title={name ?? 'Sin acceso'} className="-ml-1 flex first:ml-0">
                {name ? (
                  <Avatar name={name} size={20} className="ring-2 ring-white" />
                ) : (
                  <span className="grid size-5 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-500 ring-2 ring-white">
                    ?
                  </span>
                )}
              </span>
            ))}
            {proposalNames.length > 3 && (
              <span className="num -ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-slate-100 px-1 text-[9px] font-bold text-slate-600 ring-2 ring-white">
                +{proposalNames.length - 3}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  )
}

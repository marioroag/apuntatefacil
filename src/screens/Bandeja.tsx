import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, ChevronDown, CircleDot, Clock, Inbox, Phone, User } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { StatusSelect, StatusPickerSheet } from '../components/ui/StatusPill'
import { ColHead, TABLE, ROW, CELL } from '../components/ui/DataTable'
import { CandidateModal } from './CandidateModal'
import { relativeDate, formatPhone, candidateName } from '../lib/format'
import { clickDeFila } from '../lib/fila'
import { MeridianAvatar } from '../components/Meridian'
import { candidateFit } from '../lib/meridian'
import { MaskedPhone } from '../components/MaskedPhone'
import { useAppBase } from '../lib/useAppBase'
import { TAGS_ENABLED } from '../lib/pricing'
import { ManageTagsModal } from '../components/Tags'
import { STATUS_META } from '../lib/types'
import type { Candidate } from '../lib/types'

function answer(c: Candidate, id: string): string {
  const v = c.answers[id]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// Bandeja única: todos los candidatos en estado "nuevo" de TODOS los puestos
// en una sola cola para triar de una vez, sin entrar puesto por puesto.
//
// La fila es DELIBERADAMENTE escueta (Mario, jul 2026): nombre, puesto, estado y
// cuándo llegó. Sin etiquetas y sin la lectura de encaje, que aquí solo eran ruido
// para triar: ambas se ven enteras al abrir la ficha del candidato.
export function Bandeja() {
  const { candidates, getCampaign, setStatus, restoreCandidate } = useStore()
  const { role } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const demo = base === '/demo'
  const maskPhone = demo
  const canManageTags = role !== 'encargado'
  const [openId, setOpenId] = useState<string | null>(null)
  const [statusFor, setStatusFor] = useState<Candidate | null>(null) // cambiar estado (móvil)
  const [manageTagsOpen, setManageTagsOpen] = useState(false)

  const nuevos = useMemo(
    () =>
      candidates
        .filter((c) => c.status === 'nuevo')
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [candidates],
  )

  const openCandidate = openId ? candidates.find((c) => c.id === openId) ?? null : null
  const openCampaign = openCandidate ? getCampaign(openCandidate.campaignId) ?? null : null

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Bandeja</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Candidatos nuevos de todos tus puestos, en una sola cola.
        </p>
      </header>

      {nuevos.length === 0 ? (
        <EmptyInbox />
      ) : (
        <>
          <p className="mb-3 text-[13px] text-slate-500" role="status">
            {nuevos.length} {nuevos.length === 1 ? 'candidato nuevo' : 'candidatos nuevos'} sin revisar
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            {/* Móvil: tarjetas (sin scroll horizontal, sin truncar el puesto) */}
            <ul className="divide-y divide-slate-100 md:hidden" aria-label="Candidatos nuevos de todos los puestos">
              {nuevos.map((c) => {
                const camp = getCampaign(c.campaignId)
                const name = candidateName(c) || 'Sin nombre'
                const m = STATUS_META[c.status]
                return (
                  // Botón del candidato (abrir) y pastilla de estado (cambiar y triar
                  // sin abrir el detalle) como hermanos, no anidados.
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-slate-50"
                    >
                      <MeridianAvatar name={name} fit={candidateFit(c.ai)} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-slate-900">{name}</p>
                        {camp && (
                          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1.5 pr-2 text-[12px] font-medium text-slate-600">
                            <Briefcase className="size-3 shrink-0 text-slate-500" aria-hidden />
                            <span className="truncate">{camp.title}</span>
                          </span>
                        )}
                      </div>
                    </button>
                    {/* Sin "hace 3 h" en móvil: todos son nuevos y la cola ya va
                        del más reciente al más antiguo, así que la hora ocupaba
                        sitio sin decidir nada. Sigue en la tabla de escritorio. */}
                    <button
                      type="button"
                      onClick={() => setStatusFor(c)}
                      aria-label={`Estado: ${m.label}. Tocar para cambiar`}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 text-[12px] font-semibold ring-1 ring-inset transition-[filter] ${m.chip} active:brightness-95`}
                    >
                      <span className={`size-1.5 rounded-full ${m.dot}`} aria-hidden />
                      {m.label}
                      <ChevronDown className="size-3 opacity-60" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto md:block">
              <table className={`min-w-[680px] ${TABLE}`}>
                <caption className="sr-only">Candidatos nuevos de todos los puestos</caption>
                <thead>
                  <tr className="bg-slate-50/60">
                    <ColHead icon={User}>Candidato</ColHead>
                    <ColHead icon={Briefcase}>Puesto</ColHead>
                    <ColHead icon={Phone} className="hidden w-[150px] lg:table-cell">Teléfono</ColHead>
                    <ColHead icon={CircleDot} className="w-[148px]">Estado</ColHead>
                    <ColHead icon={Clock} align="right" className="w-[116px]">Recibida</ColHead>
                  </tr>
                </thead>
                <tbody>
                  {nuevos.map((c) => {
                    const camp = getCampaign(c.campaignId)
                    const name = candidateName(c) || 'Sin nombre'
                    const phone = answer(c, 'telefono')
                    return (
                      <tr
                        key={c.id}
                        onClick={(e) => clickDeFila(e) && setOpenId(c.id)}
                        className={`${ROW} group cursor-pointer hover:bg-slate-50`}
                      >
                        <td className={CELL}>
                          <div className="flex items-center gap-2.5">
                            <MeridianAvatar name={name} fit={candidateFit(c.ai)} size={32} />
                            {/* Mismo gesto que en la tabla del puesto: el nombre se
                                subraya al pasar por la fila, que es lo que abre la ficha. */}
                            <span className="truncate text-[14px] font-medium text-slate-900 decoration-slate-400 underline-offset-[3px] group-hover:underline" title={name}>{name}</span>
                          </div>
                        </td>
                        <td className={CELL}>
                          {camp ? (
                            <Link
                              to={`${base}/puestos/${camp.id}`}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-2 pr-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
                            >
                              <Briefcase className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                              <span className="truncate">{camp.title}</span>
                            </Link>
                          ) : (
                            <span className="text-[12px] text-slate-500">–</span>
                          )}
                        </td>
                        <td className={`${CELL} num hidden text-[13px] text-slate-600 lg:table-cell`}>
                          <span className="block truncate">
                            {maskPhone && phone ? <MaskedPhone value={formatPhone(phone)} /> : formatPhone(phone) || '–'}
                          </span>
                        </td>
                        <td className={`${CELL} whitespace-nowrap`}>
                          <StatusSelect status={c.status} onChange={(s) => setStatus(c.id, s)} />
                        </td>
                        <td className={`${CELL} whitespace-nowrap text-right text-[13px] text-slate-500`}>
                          <time dateTime={c.submittedAt} className="num">{relativeDate(c.submittedAt)}</time>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {openCampaign && (
        <CandidateModal
          campaign={openCampaign}
          candidate={openCandidate}
          maskPhone={maskPhone}
          onClose={() => setOpenId(null)}
          onOpenManageTags={canManageTags ? () => setManageTagsOpen(true) : undefined}
          onDeleted={(c) =>
            toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
          }
          // La bandeja mezcla puestos: al pasar al siguiente, `openCampaign` se
          // recalcula desde el propio candidato, así que la cabecera acompaña.
          siblings={nuevos}
          onNavigate={setOpenId}
        />
      )}

      {TAGS_ENABLED && canManageTags && (
        <ManageTagsModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} />
      )}

      <StatusPickerSheet
        open={!!statusFor}
        status={statusFor?.status ?? null}
        onPick={(s) => statusFor && setStatus(statusFor.id, s)}
        onClose={() => setStatusFor(null)}
      />
    </div>
  )
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card">
      <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Inbox className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Todo al día</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        No tienes candidatos nuevos sin revisar. Cuando entre una candidatura nueva, aparecerá aquí.
      </p>
    </div>
  )
}

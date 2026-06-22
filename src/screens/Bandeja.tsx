import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, ChevronDown, Inbox } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { StatusSelect, StatusPickerSheet } from '../components/ui/StatusPill'
import { CandidatePanel } from './CandidatePanel'
import { relativeDate, initials, formatPhone, candidateName } from '../lib/format'
import { MaskedPhone } from '../components/MaskedPhone'
import { useAppBase } from '../lib/useAppBase'
import { planHas, TAGS_ENABLED } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { TagCell, ManageTagsModal } from '../components/Tags'
import { STATUS_META } from '../lib/types'
import type { Candidate } from '../lib/types'

function answer(c: Candidate, id: string): string {
  const v = c.answers[id]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// Bandeja única (Pro/Multi): todos los candidatos en estado "nuevo" de TODOS los
// puestos en una sola cola para triar de una vez, sin entrar puesto por puesto.
export function Bandeja() {
  const { candidates, getCampaign, setStatus, restoreCandidate, tags } = useStore()
  const { company, role } = useAuth()
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

  // La bandeja es una capacidad Pro/Multi. La demo la enseña (plan multi); en /app,
  // si el plan no la incluye se muestra bloqueada (acceso directo por URL).
  if (!demo && !planHas(company?.plan, 'bandeja')) return <FeatureLocked feature="bandeja" />

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
                  <li key={c.id} className="px-4 py-3">
                   <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-slate-50"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">
                        {initials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-slate-900">{name}</p>
                        {camp && (
                          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1.5 pr-2 text-[12px] font-medium text-slate-600">
                            <Briefcase className="size-3 shrink-0 text-slate-400" aria-hidden />
                            <span className="truncate">{camp.title}</span>
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStatusFor(c)}
                        aria-label={`Estado: ${m.label}. Tocar para cambiar`}
                        className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1.5 text-[12px] font-semibold ring-1 ring-inset transition-[filter] ${m.chip} active:brightness-95`}
                      >
                        <span className={`size-1.5 rounded-full ${m.dot}`} aria-hidden />
                        {m.label}
                        <ChevronDown className="size-3 opacity-60" aria-hidden />
                      </button>
                      <time dateTime={c.submittedAt} className="text-[11px] text-slate-400 tabular-nums">
                        {relativeDate(c.submittedAt)}
                      </time>
                    </div>
                   </div>
                   {c.tagIds.length > 0 && (
                     <div className="pl-[3.25rem]">
                       <TagCell tagIds={c.tagIds} tags={tags} />
                     </div>
                   )}
                  </li>
                )
              })}
            </ul>
            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] border-collapse">
                <caption className="sr-only">Candidatos nuevos de todos los puestos</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                    <th scope="col" className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Candidato</th>
                    <th scope="col" className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Puesto</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Teléfono</th>
                    <th scope="col" className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                    <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recibida</th>
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
                        onClick={() => setOpenId(c.id)}
                        className="group cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
                              {initials(name)}
                            </span>
                            <div className="min-w-0">
                              <span className="block max-w-[220px] truncate font-medium text-slate-900" title={name}>{name}</span>
                              <TagCell tagIds={c.tagIds} tags={tags} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {camp ? (
                            <Link
                              to={`${base}/puestos/${camp.id}`}
                              className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-2 pr-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
                            >
                              <Briefcase className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                              <span className="truncate">{camp.title}</span>
                            </Link>
                          ) : (
                            <span className="text-[12px] text-slate-400">–</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 text-sm text-slate-600 md:table-cell tnum">
                          <span className="block max-w-[150px] truncate">
                            {maskPhone && phone ? <MaskedPhone value={formatPhone(phone)} /> : formatPhone(phone) || '–'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <StatusSelect status={c.status} onChange={(s) => setStatus(c.id, s)} />
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-slate-500">
                          <time dateTime={c.submittedAt}>{relativeDate(c.submittedAt)}</time>
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
        <CandidatePanel
          campaign={openCampaign}
          candidate={openCandidate}
          maskPhone={maskPhone}
          onClose={() => setOpenId(null)}
          onOpenManageTags={canManageTags ? () => setManageTagsOpen(true) : undefined}
          onDeleted={(c) =>
            toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
          }
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
      <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Inbox className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Todo al día</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        No tienes candidatos nuevos sin revisar. Cuando entre una candidatura nueva, aparecerá aquí.
      </p>
    </div>
  )
}

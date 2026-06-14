import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowUpDown,
  Check,
  Download,
  Filter,
  Inbox,
  PenLine,
  Search,
  SearchX,
  Share2,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useToast } from '../components/ui/Toast'
import { StatusSelect } from '../components/ui/StatusPill'
import { CandidatePanel } from './CandidatePanel'
import { exportCandidatesToExcel } from '../lib/export'
import { relativeDate, initials, miles } from '../lib/format'
import { STATUS_META, STATUS_ORDER } from '../lib/types'
import type { Campaign, Candidate, CandidateStatus, FormField } from '../lib/types'
import { publicFormUrl, publicFormUrlDisplay } from '../lib/brand'
import { useAppBase } from '../lib/useAppBase'
import { MaskedPhone } from '../components/MaskedPhone'

type SortKey = 'nombre' | 'fecha' | 'estado'

function answerStr(c: Candidate, fieldId: string): string {
  const v = c.answers[fieldId]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function highlightFields(campaign: Campaign): FormField[] {
  return campaign.fields
    .filter((f) => !f.system && ['select', 'boolean', 'number', 'multiselect'].includes(f.type))
    .slice(0, 2)
}

function filterableFields(campaign: Campaign): FormField[] {
  return campaign.fields.filter((f) => ['select', 'multiselect', 'boolean'].includes(f.type))
}

export function Dashboard() {
  const { campaignId } = useParams()
  const { getCampaign, candidatesFor, restoreCandidate } = useStore()
  const toast = useToast()
  const base = useAppBase()
  const campaign = getCampaign(campaignId!)

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<CandidateStatus>>(new Set())
  const [valueFilters, setValueFilters] = useState<{ fieldId: string; label: string; value: string }[]>([])
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'fecha', dir: 'desc' })
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Skeleton breve al cambiar de puesto (muestra el estado de carga real).
  useEffect(() => {
    setLoading(true)
    setSearch('')
    setStatusFilter(new Set())
    setValueFilters([])
    setSelected(new Set())
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [campaignId])

  const all = useMemo(() => (campaign ? candidatesFor(campaign.id) : []), [campaign, candidatesFor])

  const filtered = useMemo(() => {
    if (!campaign) return []
    const q = search.trim().toLowerCase()
    let list = all.filter((c) => {
      if (statusFilter.size && !statusFilter.has(c.status)) return false
      if (q) {
        const hay = campaign.fields.some((f) => answerStr(c, f.id).toLowerCase().includes(q))
        if (!hay) return false
      }
      // valueFilters agrupados por campo: OR dentro del campo, AND entre campos
      const byField = new Map<string, string[]>()
      for (const vf of valueFilters) {
        byField.set(vf.fieldId, [...(byField.get(vf.fieldId) ?? []), vf.value])
      }
      for (const [fid, vals] of byField) {
        const cv = c.answers[fid]
        const match = vals.some((val) => {
          if (typeof cv === 'boolean') return (cv ? 'Sí' : 'No') === val
          if (Array.isArray(cv)) return cv.includes(val)
          return cv === val
        })
        if (!match) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sort.key === 'nombre') cmp = answerStr(a, 'nombre').localeCompare(answerStr(b, 'nombre'))
      else if (sort.key === 'estado') cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      else cmp = a.submittedAt.localeCompare(b.submittedAt)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [all, campaign, search, statusFilter, valueFilters, sort])

  if (!campaign) {
    return <div className="p-8 text-slate-500">Puesto no encontrado.</div>
  }

  const activeFilterCount = statusFilter.size + valueFilters.length
  const cols = highlightFields(campaign)
  const openCandidate = openId ? all.find((c) => c.id === openId) ?? null : null
  const publicUrl = publicFormUrlDisplay(campaign.slug)
  const maskPhone = base === '/demo'

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const clearFilters = () => {
    setStatusFilter(new Set())
    setValueFilters([])
    setSearch('')
  }

  const doExport = () => {
    const name = exportCandidatesToExcel(campaign, filtered)
    toast.success(`Excel listo, ${name}`)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicFormUrl(campaign.slug))
      toast.success('Enlace copiado')
    } catch {
      toast.show('Copia el enlace manualmente: ' + publicUrl)
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Cabecera del puesto */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-slate-900">{campaign.title}</h1>
              {campaign.status === 'pausada' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                  Pausado
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {campaign.sector} · {campaign.location}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            >
              <Share2 className="size-4 text-slate-400" aria-hidden /> Compartir enlace
            </button>
            <Link
              to={`${base}/puestos/${campaign.id}/formulario`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            >
              <PenLine className="size-4 text-slate-400" aria-hidden /> Editar formulario
            </Link>
          </div>
        </div>
      </header>

      {/* Resumen de estados */}
      <StatusSummary all={all} statusFilter={statusFilter} onToggle={(s) => {
        setStatusFilter((prev) => {
          const next = new Set(prev)
          next.has(s) ? next.delete(s) : next.add(s)
          return next
        })
      }} />

      {/* Barra de filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            role="searchbox"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono..."
            className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </div>

        <FilterMenu
          campaign={campaign}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          valueFilters={valueFilters}
          setValueFilters={setValueFilters}
          count={activeFilterCount}
        />

        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-3.5" aria-hidden /> Limpiar
          </button>
        )}

        <div className="ml-auto">
          <ExportButton count={filtered.length} total={all.length} onExport={doExport} />
        </div>
      </div>

      {/* Chips de filtros activos */}
      {(statusFilter.size > 0 || valueFilters.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {[...statusFilter].map((s) => (
            <Chip key={`s-${s}`} label={`Estado: ${STATUS_META[s].label}`} onRemove={() => setStatusFilter((p) => { const n = new Set(p); n.delete(s); return n })} />
          ))}
          {valueFilters.map((vf, i) => (
            <Chip key={`v-${i}`} label={`${vf.label}: ${vf.value}`} onRemove={() => setValueFilters((p) => p.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {/* Línea de contexto */}
      <p className="mt-3 text-[13px] text-slate-500" role="status">
        {loading ? 'Cargando candidatos' : `${miles(filtered.length)} ${filtered.length === 1 ? 'candidato' : 'candidatos'}`}
        {!loading && activeFilterCount > 0 && ` · ${activeFilterCount} ${activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}`}
      </p>

      {/* Barra de selección */}
      {selected.size > 0 && !loading && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-card">
          <span className="font-semibold">{selected.size} seleccionados</span>
          <button
            onClick={() => {
              // Exporta TODA la selección, también filas que un filtro posterior
              // haya ocultado (si no, exportaría menos de lo que dice la barra).
              const subset = all.filter((c) => selected.has(c.id))
              const name = exportCandidatesToExcel(campaign, subset)
              toast.success(`Excel listo con ${subset.length} ${subset.length === 1 ? 'candidato' : 'candidatos'}, ${name}`)
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
          >
            <Download className="size-4" aria-hidden /> Exportar selección
          </button>
          <button onClick={() => setSelected(new Set())} className="rounded-lg p-1 hover:bg-white/15" aria-label="Quitar selección">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Tabla / estados */}
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {loading ? (
          <SkeletonRows cols={cols.length} />
        ) : filtered.length === 0 ? (
          all.length === 0 ? (
            <EmptyFirstUse publicUrl={publicUrl} onCopy={copyLink} />
          ) : (
            <EmptyNoResults search={search} hasFilters={statusFilter.size + valueFilters.length > 0} onClear={clearFilters} />
          )
        ) : (
          <CandidateTable
            campaign={campaign}
            cols={cols}
            rows={filtered}
            sort={sort}
            onSort={toggleSort}
            selected={selected}
            setSelected={setSelected}
            onOpen={setOpenId}
            maskPhone={maskPhone}
          />
        )}
      </div>

      <CandidatePanel
        campaign={campaign}
        candidate={openCandidate}
        maskPhone={maskPhone}
        onClose={() => setOpenId(null)}
        onDeleted={(c) =>
          toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
        }
      />
    </div>
  )
}

// --- Resumen de estados (tarjetas-filtro) ----------------------------------
function StatusSummary({
  all,
  statusFilter,
  onToggle,
}: {
  all: Candidate[]
  statusFilter: Set<CandidateStatus>
  onToggle: (s: CandidateStatus) => void
}) {
  const counts = STATUS_ORDER.map((s) => ({ s, n: all.filter((c) => c.status === s).length }))
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {counts.map(({ s, n }) => {
        const active = statusFilter.has(s)
        const m = STATUS_META[s]
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            aria-pressed={active}
            className={`flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-left transition-colors ${
              active ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className={`size-2.5 rounded-full ${m.dot}`} aria-hidden />
            <span className="flex-1">
              <span className="block text-xl font-semibold tabular-nums text-slate-900">{n}</span>
              <span className="block text-[13px] text-slate-500">{m.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// --- Tabla -----------------------------------------------------------------
function CandidateTable({
  campaign,
  cols,
  rows,
  sort,
  onSort,
  selected,
  setSelected,
  onOpen,
  maskPhone,
}: {
  campaign: Campaign
  cols: FormField[]
  rows: Candidate[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  onOpen: (id: string) => void
  maskPhone: boolean
}) {
  const { setStatus } = useStore()
  const allSel = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSel = rows.some((r) => selected.has(r.id))
  const headRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someSel && !allSel
  }, [someSel, allSel])

  const toggleAll = () => {
    setSelected(allSel ? new Set() : new Set(rows.map((r) => r.id)))
  }
  const toggleOne = (id: string) => {
    const n = new Set(selected)
    n.has(id) ? n.delete(id) : n.add(id)
    setSelected(n)
  }

  const SortHead = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" className={`px-3 py-2.5 text-left ${className}`} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800">
        {children}
        <ArrowUpDown className={`size-3 ${sort.key === k ? 'text-indigo-500' : 'text-slate-300'}`} aria-hidden />
      </button>
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <caption className="sr-only">Candidatos de {campaign.title}</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60">
            <th scope="col" className="w-10 px-3 py-2.5">
              <input
                ref={headRef}
                type="checkbox"
                checked={allSel}
                onChange={toggleAll}
                aria-label="Seleccionar todos"
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </th>
            <SortHead k="nombre">Candidato</SortHead>
            <th scope="col" className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
              Teléfono
            </th>
            {cols.map((f) => (
              <th key={f.id} scope="col" className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                {f.label}
              </th>
            ))}
            <SortHead k="estado">Estado</SortHead>
            <SortHead k="fecha" className="text-right">Recibida</SortHead>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const sel = selected.has(c.id)
            const name = answerStr(c, 'nombre') || 'Sin nombre'
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c.id)}
                className={`group cursor-pointer border-b border-slate-100 transition-colors last:border-0 ${
                  sel ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                }`}
              >
                <td className="relative px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {sel && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-indigo-600" aria-hidden />}
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggleOne(c.id)}
                    aria-label={`Seleccionar ${name}`}
                    className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
                      {initials(name)}
                    </span>
                    <span className="font-medium text-slate-900">{name}</span>
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 text-sm text-slate-600 md:table-cell tnum">
                  {maskPhone && answerStr(c, 'telefono')
                    ? <MaskedPhone value={answerStr(c, 'telefono')} />
                    : (answerStr(c, 'telefono') || '·')}
                </td>
                {cols.map((f) => (
                  <td key={f.id} className="hidden px-3 py-2.5 text-sm text-slate-600 lg:table-cell">
                    {answerStr(c, f.id) || '·'}
                  </td>
                ))}
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
  )
}

// --- Subcomponentes de filtro / estados ------------------------------------
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1 text-[13px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
      {label}
      <button onClick={onRemove} aria-label={`Quitar filtro ${label}`} className="grid size-5 place-items-center rounded-full hover:bg-indigo-100">
        <X className="size-3" aria-hidden />
      </button>
    </span>
  )
}

function FilterMenu({
  campaign,
  statusFilter,
  setStatusFilter,
  valueFilters,
  setValueFilters,
  count,
}: {
  campaign: Campaign
  statusFilter: Set<CandidateStatus>
  setStatusFilter: React.Dispatch<React.SetStateAction<Set<CandidateStatus>>>
  valueFilters: { fieldId: string; label: string; value: string }[]
  setValueFilters: React.Dispatch<React.SetStateAction<{ fieldId: string; label: string; value: string }[]>>
  count: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasValue = (fieldId: string, value: string) => valueFilters.some((v) => v.fieldId === fieldId && v.value === value)
  const toggleValue = (f: FormField, value: string) =>
    setValueFilters((p) =>
      hasValue(f.id, value)
        ? p.filter((v) => !(v.fieldId === f.id && v.value === value))
        : [...p, { fieldId: f.id, label: f.label, value }],
    )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
      >
        <Filter className="size-4 text-slate-400" aria-hidden /> Filtros
        {count > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white tabular-nums">{count}</span>}
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-pop">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</p>
          <div className="mb-3 space-y-0.5">
            {STATUS_ORDER.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={statusFilter.has(s)}
                  onChange={() =>
                    setStatusFilter((p) => {
                      const n = new Set(p)
                      n.has(s) ? n.delete(s) : n.add(s)
                      return n
                    })
                  }
                  className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
                {STATUS_META[s].label}
              </label>
            ))}
          </div>

          {filterableFields(campaign).map((f) => (
            <div key={f.id} className="mb-3">
              <p id={`flt-${f.id}`} className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</p>
              <div role="group" aria-labelledby={`flt-${f.id}`} className="space-y-0.5">
                {(f.type === 'boolean' ? ['Sí', 'No'] : f.options ?? []).map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={hasValue(f.id, opt)}
                      onChange={() => toggleValue(f, opt)}
                      className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExportButton({ count, total, onExport }: { count: number; total: number; onExport: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const filtered = count !== total

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={count === 0}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <Download className="size-4 text-slate-400" aria-hidden />
        <span className="hidden sm:inline">Exportar a Excel</span>
        <span className="sm:hidden">Excel</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-pop">
          <p className="text-sm text-slate-700">
            Vas a exportar{' '}
            <strong className="font-semibold text-slate-900">
              {miles(count)} {count === 1 ? 'candidato' : 'candidatos'}
            </strong>
            {filtered ? ' (los filtrados)' : ''} a un archivo Excel.
          </p>
          <button
            onClick={() => {
              onExport()
              setOpen(false)
            }}
            className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98]"
          >
            <Check className="size-4" aria-hidden /> Descargar Excel
          </button>
        </div>
      )}
    </div>
  )
}

// --- Estados ----------------------------------------------------------------
function SkeletonRows({ cols }: { cols: number }) {
  return (
    <div role="status" aria-label="Cargando candidatos" className="divide-y divide-slate-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="size-8 shrink-0 rounded-full skeleton" />
          <div className="h-3.5 w-40 rounded skeleton" />
          <div className="ml-auto hidden gap-8 md:flex">
            <div className="h-3 w-24 rounded skeleton" />
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 w-16 rounded skeleton" />
            ))}
            <div className="h-5 w-20 rounded-full skeleton" />
            <div className="h-3 w-16 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyFirstUse({ publicUrl, onCopy }: { publicUrl: string; onCopy: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Inbox className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Aún no hay candidatos</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Comparte el enlace del formulario para empezar a recibir respuestas. Cada respuesta entra aquí automáticamente.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3.5 pr-1.5">
        <span className="text-sm text-slate-500">{publicUrl}</span>
        <button onClick={onCopy} className="rounded-lg bg-indigo-600 px-3 py-1 text-[13px] font-semibold text-white hover:bg-indigo-700">
          Copiar enlace
        </button>
      </div>
    </div>
  )
}

function EmptyNoResults({ search, hasFilters, onClear }: { search: string; hasFilters: boolean; onClear: () => void }) {
  const onlySearch = !!search && !hasFilters
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Ningún candidato coincide</h3>
      <p className="mt-1 text-sm text-slate-500">
        {onlySearch
          ? `Sin resultados para “${search}”. Prueba con menos palabras.`
          : search
            ? `Sin resultados para “${search}” con estos filtros.`
            : 'Ningún candidato encaja con estos filtros.'}
      </p>
      <button onClick={onClear} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
        {onlySearch ? 'Borrar búsqueda' : 'Limpiar filtros'}
      </button>
    </div>
  )
}

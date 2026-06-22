import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown,
  Bell,
  BellOff,
  Bookmark,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Download,
  Filter,
  Globe,
  Inbox,
  Lock,
  MoreHorizontal,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Share2,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { StatusSelect, StatusPickerSheet } from '../components/ui/StatusPill'
import { BottomSheet } from '../components/ui/BottomSheet'
import { CandidatePanel } from './CandidatePanel'
import { exportCandidatesToExcel } from '../lib/export'
import { relativeDate, initials, miles, formatPhone, candidateName } from '../lib/format'
import { STATUS_META, STATUS_ORDER } from '../lib/types'
import type { Brand, Campaign, Candidate, CandidateStatus, FormField, NumberFilter, SavedView, Site, SortKey, Tag as TagType } from '../lib/types'
import { planHas, TAGS_ENABLED, type PlanFeature } from '../lib/pricing'
import { TagCell, BulkTagMenu, ManageTagsModal } from '../components/Tags'
import { publicFormUrl, publicFormUrlDisplay } from '../lib/brand'
import { useAppBase } from '../lib/useAppBase'
import { MaskedPhone } from '../components/MaskedPhone'
import { PullToRefresh, type RefreshResult } from '../components/PullToRefresh'
import { UpgradeDialog } from '../components/UpgradeDialog'
import { BTN_PRIMARY, BTN_PRIMARY_SM, BTN_SECONDARY } from '../lib/buttons'
import { copyText } from '../lib/clipboard'
import { supabase } from '../lib/supabase'
import { searchScore } from '../lib/search'

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

// Preguntas numéricas, filtrables por rango (Desde / Hasta).
function numberFields(campaign: Campaign): FormField[] {
  return campaign.fields.filter((f) => f.type === 'number')
}

// Etiqueta legible de un filtro numérico para el chip.
function numberFilterLabel(nf: NumberFilter): string {
  if (nf.min != null && nf.max != null) return `${nf.min}–${nf.max}`
  if (nf.min != null) return `≥ ${nf.min}`
  return `≤ ${nf.max}`
}

export function Dashboard() {
  const { campaignId } = useParams()
  const [searchParams] = useSearchParams()
  const { getCampaign, candidatesFor, restoreCandidate, savedViews, createSavedView, deleteSavedView, sites, updateCampaign, brands, updateBranding, reloadCandidatesFor, markSeen, duplicateCampaign, tags } = useStore()
  const { company, role } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const navigate = useNavigate()
  const campaign = getCampaign(campaignId!)
  // El encargado gestiona candidatos, pero NO edita el puesto (form/sede/marca):
  // esas escrituras van contra campaigns, que la RLS le bloquea.
  const isEncargado = role === 'encargado'
  const canManage = !isEncargado
  // El encargado aplica/quita etiquetas existentes pero no crea ni gestiona el
  // vocabulario (igual que en la RLS). owner/member sí.
  const canManageTags = !isEncargado
  const canViews = planHas(company?.plan, 'savedViews')
  // Las pills de sede y marca SE MUESTRAN siempre que el rol gestione el puesto;
  // si el plan no incluye la feature, la pill abre el aviso de upgrade al pulsarla
  // (el límite se descubre al usarla, no se anuncia con un tab bloqueado).
  const hasSites = planHas(company?.plan, 'sites')
  const hasBrands = planHas(company?.plan, 'brands')

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<CandidateStatus>>(new Set())
  const [valueFilters, setValueFilters] = useState<{ fieldId: string; label: string; value: string }[]>([])
  const [numberFilters, setNumberFilters] = useState<NumberFilter[]>([])
  const [ratingFilter, setRatingFilter] = useState<number>(0)
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set()) // ids de etiqueta; OR dentro del grupo
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'fecha', dir: 'desc' })
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false) // modo selección múltiple (móvil)
  // Cabecera adaptativa (móvil): si el título no cabe, "Compartir" se reduce a icono
  // para darle sitio. Medimos el título y aplicamos histéresis para que no parpadee.
  const titleRowRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const [compactShare, setCompactShare] = useState(false)
  const [rowW, setRowW] = useState(0)
  const [measureTick, setMeasureTick] = useState(0)
  useEffect(() => {
    const el = titleRowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setRowW(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Re-mide tras el primer layout y al terminar de cargar la fuente: el ancho real
  // del título cambia con la tipografía, después de la primera medición.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMeasureTick((t) => t + 1))
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts
    fonts?.ready?.then(() => setMeasureTick((t) => t + 1))
    return () => cancelAnimationFrame(raf)
  }, [campaignId])
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    if (!compactShare && el.scrollWidth - el.clientWidth > 1) {
      setCompactShare(true) // el título se corta: oculta la etiqueta de Compartir
    } else if (compactShare && el.clientWidth - el.scrollWidth > 90) {
      setCompactShare(false) // hay holgura de sobra: recupera la etiqueta sin volver a cortar
    }
  }, [compactShare, rowW, measureTick, campaignId])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false) // hoja de ajustes del puesto (móvil)
  const [duplicating, setDuplicating] = useState(false)
  // Feature avanzada que se intentó usar sin tenerla en el plan: abre el aviso.
  const [upgrade, setUpgrade] = useState<PlanFeature | null>(null)

  // Duplicar el puesto: crea una copia (campos, apariencia y datos), sin candidatos,
  // y abre su editor. El error, si lo hay, lo avisa el store.
  const handleDuplicate = async () => {
    if (duplicating || !campaign) return
    setDuplicating(true)
    const copy = await duplicateCampaign(campaign.id)
    setDuplicating(false)
    setSettingsOpen(false)
    if (copy) {
      toast.success('Puesto duplicado.')
      navigate(`${base}/puestos/${copy.id}/formulario`)
    }
  }

  // Skeleton breve al cambiar de puesto (muestra el estado de carga real).
  useEffect(() => {
    setLoading(true)
    setSearch('')
    // Filtro inicial por estado vía ?estado=nuevo (p. ej. al venir de la Vista
    // general pulsando un puesto con candidatos nuevos). El estado queda editable
    // como cualquier otro filtro; el chip "Estado: Nuevo" deja quitarlo.
    const estado = searchParams.get('estado')
    const initialEstado = estado && (STATUS_ORDER as readonly string[]).includes(estado)
      ? (estado as CandidateStatus)
      : null
    setStatusFilter(initialEstado ? new Set([initialEstado]) : new Set())
    setValueFilters([])
    setNumberFilters([])
    setRatingFilter(0)
    setTagFilter(new Set())
    setSelected(new Set())
    setSelectMode(false)
    // Trae los candidatos nuevos de este puesto: la carga global solo ocurre al
    // entrar en el panel, así que sin esto no se verían los llegados después.
    // Y marca el puesto como visto: el badge del menú cuenta los llegados después.
    if (campaignId) {
      reloadCandidatesFor(campaignId)
      markSeen(campaignId)
    }
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  // Pista única en móvil: como el refresco va por gesto (no hay botón), lo
  // enseñamos una sola vez para que sea descubrible. La marca se escribe DENTRO
  // del timeout (al mostrarse de verdad), no antes: así el doble montaje de
  // StrictMode no la cancela sin llegar a enseñarla.
  useEffect(() => {
    try {
      if (!window.matchMedia('(max-width: 767px)').matches) return
      if (localStorage.getItem('af.hint.pull')) return
    } catch {
      return
    }
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem('af.hint.pull', '1')
      } catch {
        // sin localStorage: igualmente mostramos la pista esta vez
      }
      toast.show('Desliza hacia abajo para actualizar')
    }, 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recarga los candidatos del puesto y DEVUELVE el resultado (no avisa por su cuenta):
  // en móvil lo muestra la propia barra de "tirar para refrescar"; en escritorio el
  // botón lo enseña con un toast. El guardado evita recargas solapadas.
  const refresh = async (): Promise<RefreshResult> => {
    if (!campaignId || refreshing) return { ok: true, message: '' }
    setRefreshing(true)
    const n = await reloadCandidatesFor(campaignId)
    setRefreshing(false)
    if (n < 0) return { ok: false, message: 'No pudimos actualizar' }
    return { ok: true, message: n === 0 ? 'Estás al día' : `${n} ${n === 1 ? 'candidato nuevo' : 'candidatos nuevos'}` }
  }

  const all = useMemo(() => (campaign ? candidatesFor(campaign.id) : []), [campaign, candidatesFor])

  // Búsqueda tolerante: el input actualiza `search` al instante; lo debouncamos a `dq`.
  const [dq, setDq] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDq(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // Real: RPC nativo de Postgres (tolerante + rankeado). Demo / fallback: búsqueda JS.
  // rpcIds = IDs rankeados del servidor; null = sin búsqueda, RPC pendiente o fallido.
  const [rpcIds, setRpcIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (base === '/demo' || !campaign || !dq) {
      setRpcIds(null)
      return
    }
    let alive = true
    supabase.rpc('search_candidates', { p_campaign_id: campaign.id, p_query: dq }).then(({ data, error }) => {
      if (!alive) return
      setRpcIds(error || !data ? null : (data as { id: string }[]).map((r) => r.id))
    })
    return () => {
      alive = false
    }
  }, [dq, campaign?.id, base])

  const filtered = useMemo(() => {
    if (!campaign) return []
    // Búsqueda tolerante: base = IDs rankeados (RPC en real; JS en demo o como fallback
    // instantáneo mientras llega/si falla el RPC). Sin query, todos los candidatos.
    let relevance: Map<string, number> | null = null
    let base0 = all
    if (dq) {
      const ids =
        base !== '/demo' && rpcIds !== null
          ? rpcIds
          : all
              .map((c) => [c, searchScore(c, dq)] as const)
              .filter(([, s]) => s > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([c]) => c.id)
      relevance = new Map(ids.map((id, i) => [id, i]))
      base0 = all.filter((c) => relevance!.has(c.id))
    }

    let list = base0.filter((c) => {
      if (statusFilter.size && !statusFilter.has(c.status)) return false
      if (ratingFilter > 0 && c.rating < ratingFilter) return false
      // Etiquetas: OR dentro del grupo (basta tener UNA de las seleccionadas), AND
      // con el resto de grupos (consistente con el comportamiento actual).
      if (tagFilter.size && !c.tagIds.some((id) => tagFilter.has(id))) return false
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
      // Filtros numéricos por rango: sin valor numérico -> no pasa.
      for (const nf of numberFilters) {
        const raw = c.answers[nf.fieldId]
        const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
        if (Number.isNaN(n)) return false
        if (nf.min != null && n < nf.min) return false
        if (nf.max != null && n > nf.max) return false
      }
      return true
    })

    // Orden: por relevancia cuando hay búsqueda y el orden está en su valor por defecto
    // (fecha desc); si el usuario elige una columna, manda su orden.
    if (relevance && sort.key === 'fecha' && sort.dir === 'desc') {
      list = [...list].sort((a, b) => relevance!.get(a.id)! - relevance!.get(b.id)!)
    } else {
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (sort.key === 'nombre') cmp = candidateName(a).localeCompare(candidateName(b))
        else if (sort.key === 'estado') cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        else cmp = a.submittedAt.localeCompare(b.submittedAt)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [all, campaign, dq, rpcIds, base, statusFilter, valueFilters, numberFilters, ratingFilter, tagFilter, sort])

  // Dominio real (mín/máx) de cada pregunta numérica, para acotar sus sliders.
  const numberDomains = useMemo(() => {
    const m: Record<string, [number, number]> = {}
    if (!campaign) return m
    for (const f of numberFields(campaign)) {
      const vals = all.map((c) => Number(c.answers[f.id])).filter((n) => !Number.isNaN(n))
      if (vals.length) {
        const lo = Math.min(...vals)
        const hi = Math.max(...vals)
        if (hi > lo) m[f.id] = [lo, hi]
      }
    }
    return m
  }, [all, campaign])

  if (!campaign) {
    return (
      <div className="grid h-full place-items-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <Briefcase className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Puesto no encontrado</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Puede que se haya cerrado o que el enlace ya no sea válido.
          </p>
          <Link to={base} className={`${BTN_PRIMARY} mt-6`}>
            Ir a mis puestos
          </Link>
        </div>
      </div>
    )
  }

  const activeFilterCount = statusFilter.size + valueFilters.length + numberFilters.length + (ratingFilter > 0 ? 1 : 0) + tagFilter.size
  const cols = highlightFields(campaign)
  const openCandidate = openId ? all.find((c) => c.id === openId) ?? null : null
  // Primer tramo del enlace: marca del puesto si la tiene, si no el nombre de la empresa.
  const brandLabel = (campaign.brandId ? brands.find((b) => b.id === campaign.brandId)?.name : null) ?? company?.name
  const publicUrl = publicFormUrlDisplay(campaign.slug, brandLabel)
  const maskPhone = base === '/demo'

  // Vistas guardadas: las globales valen en todos los puestos; las de puesto, solo aquí.
  const myViews = canViews ? savedViews.filter((v) => v.campaignId === null || v.campaignId === campaign.id) : []
  const hasValueFilters = valueFilters.length > 0
  const canSaveView = activeFilterCount > 0 || search.trim().length > 0

  const applyView = (v: SavedView) => {
    setSearch(v.payload.search ?? '')
    setStatusFilter(new Set(v.payload.statuses ?? []))
    setValueFilters(v.payload.valueFilters ?? [])
    setNumberFilters(v.payload.numberFilters ?? [])
    setRatingFilter(v.payload.ratingFilter ?? 0)
    setTagFilter(new Set(v.payload.tagFilter ?? []))
    setSort(v.payload.sort ?? { key: 'fecha', dir: 'desc' })
  }

  const saveView = async (name: string, scope: 'global' | 'campaign') => {
    const ok = await createSavedView({
      name,
      campaignId: scope === 'global' ? null : campaign.id,
      payload: { search, statuses: [...statusFilter], valueFilters, numberFilters, ratingFilter, tagFilter: [...tagFilter], sort },
    })
    setSaveViewOpen(false)
    if (ok) toast.success('Vista guardada')
  }

  // Asignar una marca aplica su apariencia al puesto (mantiene el título). Quitarla
  // solo desvincula: la apariencia ya copiada se conserva (sin sorpresas visuales).
  const applyBrand = (brandId: string | null) => {
    if (brandId === null) {
      updateCampaign(campaign.id, { brandId: null })
      return
    }
    const brand = brands.find((b) => b.id === brandId)
    if (!brand) return
    updateCampaign(campaign.id, { brandId })
    updateBranding(campaign.id, { accent: brand.accent, welcome: brand.welcome, thanks: brand.thanks, showLogo: brand.showLogo })
    toast.success(`Apariencia de ${brand.name} aplicada`)
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const clearFilters = () => {
    setStatusFilter(new Set())
    setValueFilters([])
    setNumberFilters([])
    setRatingFilter(0)
    setTagFilter(new Set())
    setSearch('')
  }

  const doExport = async () => {
    const name = await exportCandidatesToExcel(campaign, filtered, tags)
    toast.success(`Excel listo, ${name}`)
  }

  // Selección múltiple en móvil (modo selección): sale del modo y limpia.
  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }
  // Selecciona/deselecciona todos los candidatos visibles (filtrados).
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id))
  const toggleSelectAll = () =>
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((c) => c.id)))
  // Exporta solo la selección (misma lógica que la barra de escritorio) y sale.
  const exportSelected = async () => {
    const subset = all.filter((c) => selected.has(c.id))
    if (subset.length === 0) return
    const name = await exportCandidatesToExcel(campaign, subset, tags)
    toast.success(`Excel listo con ${subset.length} ${subset.length === 1 ? 'candidato' : 'candidatos'}, ${name}`)
    exitSelect()
  }

  const copyLink = async () => {
    if (base === '/demo') {
      // Demo: el puesto no existe en la BD real, así que el enlace no recibiría
      // candidaturas. Lo decimos claro en vez de copiar un enlace muerto.
      toast.show('En la demo el enlace es de muestra. Crea tu cuenta para tener un enlace que reciba candidaturas de verdad.')
      return
    }
    const ok = await copyText(publicFormUrl(campaign.slug, brandLabel))
    if (ok) toast.success('Enlace copiado')
    else toast.show('Copia el enlace manualmente: ' + publicUrl)
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Cabecera del puesto */}
      <header className="mb-5">
        {/* Título + acciones en la MISMA línea (las acciones a la derecha con ml-auto).
            En móvil las acciones son solo iconos; en sm+ recuperan su etiqueta. */}
        <div ref={titleRowRef} className="flex items-center gap-2.5">
          <h1 ref={titleRef} className="min-w-0 truncate text-xl font-semibold text-slate-900">{campaign.title}</h1>
          {campaign.status === 'pausada' && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
              Pausado
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            {/* Solo escritorio: en móvil se refresca tirando hacia abajo (PullToRefresh).
                El wrapper controla la visibilidad para no chocar con el inline-flex del botón. */}
            <span className="hidden sm:contents">
              <button
                onClick={async () => {
                  const r = await refresh()
                  if (r.message) r.ok ? toast.show(r.message) : toast.error(r.message)
                }}
                disabled={refreshing}
                className={`${BTN_SECONDARY} disabled:opacity-60`}
                title="Refrescar candidatos"
                aria-label="Refrescar candidatos"
              >
                <RefreshCw className={`size-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                Refrescar
              </button>
            </span>
            {/* En móvil llevan etiqueta corta ("Compartir"/"Editar") pero compacta
                (h-8, texto e icono más pequeños) para no empujar ni truncar el título;
                en sm+ recuperan su tamaño y etiqueta completa. */}
            <button
              onClick={copyLink}
              className={`${BTN_SECONDARY} max-sm:h-8 max-sm:gap-1 max-sm:px-2.5 max-sm:text-[12px]`}
              title="Compartir enlace"
              aria-label="Compartir enlace"
            >
              <Share2 className="size-4 shrink-0 text-slate-400 max-sm:size-3.5" aria-hidden />
              <span className={compactShare ? 'hidden' : 'sm:hidden'}>Compartir</span>
              <span className="hidden sm:inline">Compartir enlace</span>
            </button>
            {canManage && (
              <Link
                to={`${base}/puestos/${campaign.id}/formulario`}
                className={`${BTN_PRIMARY} max-sm:h-8 max-sm:gap-1 max-sm:px-2.5 max-sm:text-[12px]`}
                title="Editar formulario"
                aria-label="Editar formulario"
              >
                <PenLine className="size-4 shrink-0 text-indigo-200 max-sm:size-3.5" aria-hidden />
                <span className="sm:hidden">Editar</span>
                <span className="hidden sm:inline">Editar formulario</span>
              </Link>
            )}
            {/* Más acciones (escritorio): en móvil viven en "Ajustes del puesto". */}
            {canManage && (
              <span className="hidden sm:contents">
                <PuestoMenu onDuplicate={handleDuplicate} duplicating={duplicating} />
              </span>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {[campaign.sector, campaign.location].map((s) => s?.trim()).filter(Boolean).join(', ')}
        </p>
        {canManage && (
          <>
            {/* Escritorio: pills de sede, marca y avisos en línea (caben de sobra) */}
            <div className="mt-2 hidden flex-wrap items-center gap-2 sm:flex">
              <SiteSelect
                sites={sites}
                value={campaign.siteId}
                onChange={(siteId) => updateCampaign(campaign.id, { siteId })}
                base={base}
                locked={!hasSites}
                onLocked={() => setUpgrade('sites')}
              />
              <BrandSelect
                brands={brands}
                value={campaign.brandId}
                onChange={applyBrand}
                base={base}
                locked={!hasBrands}
                onLocked={() => setUpgrade('brands')}
              />
              <button
                type="button"
                onClick={() => updateCampaign(campaign.id, { notifyNew: campaign.notifyNew === false })}
                aria-pressed={campaign.notifyNew !== false}
                title={campaign.notifyNew !== false
                  ? 'Recibes un email cada vez que entra un candidato nuevo. Toca para desactivarlo.'
                  : 'No recibes emails de candidatos de este puesto. Toca para activarlo.'}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors ${
                  campaign.notifyNew !== false
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-white text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {campaign.notifyNew !== false
                  ? <Bell className="size-3.5 text-slate-400" aria-hidden />
                  : <BellOff className="size-3.5" aria-hidden />}
                {campaign.notifyNew !== false ? 'Avisos por email' : 'Avisos desactivados'}
              </button>
            </div>
            {/* Móvil: un solo acceso que agrupa sede, marca y avisos en una hoja */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-200 sm:hidden"
            >
              <SlidersHorizontal className="size-3.5 text-slate-400" aria-hidden /> Ajustes del puesto
            </button>
          </>
        )}
      </header>

      {/* Resumen de estados. Oculto en móvil (poco esencial y come pantalla); el
          filtro por estado sigue disponible en el menú Filtros. */}
      <StatusSummary all={all} statusFilter={statusFilter} onToggle={(s) => {
        setStatusFilter((prev) => {
          const next = new Set(prev)
          next.has(s) ? next.delete(s) : next.add(s)
          return next
        })
      }} />

      {/* Barra de filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:min-w-[200px] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            role="searchbox"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono..."
            className="h-9 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </div>

        {/* Acciones: en móvil reparten el ancho de la fila a partes iguales (limpio,
            sin huecos). En sm+ recuperan su tamaño natural y se alinean a la derecha.
            [&>*] = el wrapper de cada control; [&>*>button] = solo su botón disparador
            (no los botones internos de los desplegables). */}
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none [&>*>button]:w-full sm:[&>*>button]:w-auto">
          <FilterMenu
            campaign={campaign}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            valueFilters={valueFilters}
            setValueFilters={setValueFilters}
            numberFilters={numberFilters}
            setNumberFilters={setNumberFilters}
            numberDomains={numberDomains}
            ratingFilter={ratingFilter}
            setRatingFilter={setRatingFilter}
            tags={tags}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            count={activeFilterCount}
          />

          {canViews ? (
            <SavedViewsMenu
              views={myViews}
              onApply={applyView}
              onDelete={deleteSavedView}
              onSave={() => setSaveViewOpen(true)}
              canSave={canSaveView}
            />
          ) : (
            <button onClick={() => setUpgrade('savedViews')} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
              <Bookmark className="size-4 text-slate-400" aria-hidden /> Vistas
            </button>
          )}

          <ExportButton count={filtered.length} total={all.length} onExport={doExport} />
        </div>
      </div>

      {/* Chips de filtros activos */}
      {(statusFilter.size > 0 || valueFilters.length > 0 || numberFilters.length > 0 || ratingFilter > 0 || tagFilter.size > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-3.5" aria-hidden /> Limpiar
          </button>
          {[...statusFilter].map((s) => (
            <Chip key={`s-${s}`} label={`Estado: ${STATUS_META[s].label}`} onRemove={() => setStatusFilter((p) => { const n = new Set(p); n.delete(s); return n })} />
          ))}
          {valueFilters.map((vf, i) => (
            <Chip key={`v-${i}`} label={`${vf.label}: ${vf.value}`} onRemove={() => setValueFilters((p) => p.filter((_, j) => j !== i))} />
          ))}
          {numberFilters.map((nf) => (
            <Chip key={`n-${nf.fieldId}`} label={`${nf.label}: ${numberFilterLabel(nf)}`} onRemove={() => setNumberFilters((p) => p.filter((x) => x.fieldId !== nf.fieldId))} />
          ))}
          {ratingFilter > 0 && (
            <Chip label={`Valoración: ${ratingFilter}+ ${'★'.repeat(ratingFilter)}`} onRemove={() => setRatingFilter(0)} />
          )}
          {[...tagFilter].map((id) => {
            const t = tags.find((x) => x.id === id)
            if (!t) return null
            return (
              <Chip key={`t-${id}`} label={`Etiqueta: ${t.name}`} onRemove={() => setTagFilter((p) => { const n = new Set(p); n.delete(id); return n })} />
            )
          })}
        </div>
      )}

      {/* Línea de contexto + entrada al modo selección (móvil) */}
      <div className="mt-3 flex items-center gap-3">
        <p className="text-[13px] text-slate-500" role="status">
          {loading ? 'Cargando candidatos' : `${miles(filtered.length)} ${filtered.length === 1 ? 'candidato' : 'candidatos'}`}
          {!loading && activeFilterCount > 0 && `, ${activeFilterCount} ${activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}`}
        </p>
        {!loading && filtered.length > 0 && !selectMode && (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="ml-auto text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 sm:hidden"
          >
            Seleccionar
          </button>
        )}
      </div>

      {/* Barra de selección (escritorio): aparece al marcar filas con los checks. */}
      {selected.size > 0 && !loading && (
        <div className="mt-3 hidden items-center gap-2.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-card sm:flex">
          <span className="font-semibold">{selected.size} seleccionados</span>
          {TAGS_ENABLED && (
            <div className="ml-auto flex items-center gap-2">
              <BulkTagMenu
                mode="add"
                selectedIds={[...selected]}
                canManage={canManageTags}
                triggerClass="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
              />
              <BulkTagMenu
                mode="remove"
                selectedIds={[...selected]}
                canManage={canManageTags}
                triggerClass="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
              />
            </div>
          )}
          <button
            onClick={async () => {
              // Exporta TODA la selección, también filas que un filtro posterior
              // haya ocultado (si no, exportaría menos de lo que dice la barra).
              const subset = all.filter((c) => selected.has(c.id))
              const name = await exportCandidatesToExcel(campaign, subset, tags)
              toast.success(`Excel listo con ${subset.length} ${subset.length === 1 ? 'candidato' : 'candidatos'}, ${name}`)
            }}
            className={`${TAGS_ENABLED ? '' : 'ml-auto '}inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25`}
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
            <EmptyNoResults search={search} hasFilters={statusFilter.size + valueFilters.length + numberFilters.length > 0} onClear={clearFilters} />
          )
        ) : (
          <CandidateTable
            campaign={campaign}
            cols={cols}
            rows={filtered}
            tags={tags}
            sort={sort}
            onSort={toggleSort}
            selected={selected}
            setSelected={setSelected}
            onOpen={setOpenId}
            maskPhone={maskPhone}
            selectMode={selectMode}
            onEnterSelect={() => setSelectMode(true)}
          />
        )}
      </div>

      {/* Hueco para que la barra inferior fija no tape la última tarjeta (móvil) */}
      {selectMode && <div className="h-20 sm:hidden" aria-hidden />}

      <CandidatePanel
        campaign={campaign}
        candidate={openCandidate}
        maskPhone={maskPhone}
        onClose={() => setOpenId(null)}
        onOpenManageTags={canManageTags ? () => setManageTagsOpen(true) : undefined}
        onDeleted={(c) =>
          toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
        }
      />

      {TAGS_ENABLED && canManageTags && (
        <ManageTagsModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} />
      )}

      <SaveViewDialog
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        onSave={saveView}
        hasValueFilters={hasValueFilters}
        valueFilterLabels={[...new Set(valueFilters.map((v) => v.label))]}
        campaignTitle={campaign.title}
      />

      {upgrade && (
        <UpgradeDialog open feature={upgrade} onClose={() => setUpgrade(null)} />
      )}

      {canManage && (
        <PuestoSettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          campaign={campaign}
          sites={sites}
          brands={brands}
          hasSites={hasSites}
          hasBrands={hasBrands}
          base={base}
          onSetSite={(siteId) => updateCampaign(campaign.id, { siteId })}
          onSetBrand={applyBrand}
          onToggleNotify={() => updateCampaign(campaign.id, { notifyNew: campaign.notifyNew === false })}
          onUpgrade={setUpgrade}
          onDuplicate={handleDuplicate}
          duplicating={duplicating}
        />
      )}

      {/* Barra de acción de selección (móvil): fija abajo, al alcance del pulgar. */}
      {selectMode && !loading && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pt-3 shadow-pop sm:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-[1180px] space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exitSelect}
                aria-label="Cancelar selección"
                className="-ml-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="size-5" aria-hidden />
              </button>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">{selected.size} seleccionados</span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="ml-auto text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                {allFilteredSelected ? 'Ninguno' : 'Todos'}
              </button>
            </div>
            <div className="flex items-center gap-2 [&>*]:flex-1 [&>*>button]:w-full">
              {TAGS_ENABLED && (
                <>
                  <BulkTagMenu
                    mode="add"
                    selectedIds={[...selected]}
                    canManage={canManageTags}
                    placement="up"
                    triggerClass={`${BTN_SECONDARY} justify-center disabled:opacity-50`}
                  />
                  <BulkTagMenu
                    mode="remove"
                    selectedIds={[...selected]}
                    canManage={canManageTags}
                    placement="up"
                    triggerClass={`${BTN_SECONDARY} justify-center disabled:opacity-50`}
                  />
                </>
              )}
              <button
                type="button"
                onClick={exportSelected}
                disabled={selected.size === 0}
                className={`${BTN_PRIMARY} justify-center disabled:opacity-50`}
              >
                <Download className="size-4 text-indigo-200" aria-hidden /> Exportar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
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
    // Solo escritorio: en móvil se oculta (el filtro por estado vive en Filtros).
    <div className="hidden gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-5">
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
  tags,
  sort,
  onSort,
  selected,
  setSelected,
  onOpen,
  maskPhone,
  selectMode,
  onEnterSelect,
}: {
  campaign: Campaign
  cols: FormField[]
  rows: Candidate[]
  tags: TagType[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  onOpen: (id: string) => void
  maskPhone: boolean
  selectMode: boolean
  onEnterSelect: () => void
}) {
  const { setStatus } = useStore()
  // Candidato cuyo estado se está cambiando desde la hoja (solo móvil).
  const [statusFor, setStatusFor] = useState<Candidate | null>(null)
  // Pulsación larga (móvil) para entrar en modo selección. longPressed evita que
  // el click posterior al gesto vuelva a alternar la tarjeta.
  const longPressed = useRef(false)
  const pressTimer = useRef<number | null>(null)
  const startPress = (id: string) => {
    longPressed.current = false
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      onEnterSelect()
      toggleOne(id)
      pressTimer.current = null
    }, 400)
  }
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }
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
    <>
      {/* --- Vista móvil: tarjetas (< md) --- */}
      <ul className="divide-y divide-slate-100 md:hidden" aria-label={`Candidatos de ${campaign.title}`}>
        {rows.map((c) => {
          const name = candidateName(c) || 'Sin nombre'
          const phone = answerStr(c, 'telefono')
          const m = STATUS_META[c.status]
          const sel = selected.has(c.id)
          // Tap: en modo selección alterna; si no, abre el detalle. El guard
          // longPressed evita que el click tras la pulsación larga lo deshaga.
          const onTap = () => {
            if (longPressed.current) {
              longPressed.current = false
              return
            }
            if (selectMode) toggleOne(c.id)
            else onOpen(c.id)
          }
          return (
            <li
              key={c.id}
              className={`px-4 py-3 transition-colors ${selectMode && sel ? 'bg-indigo-50/70' : ''}`}
            >
             <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onTap}
                onTouchStart={selectMode ? undefined : () => startPress(c.id)}
                onTouchMove={selectMode ? undefined : cancelPress}
                onTouchEnd={selectMode ? undefined : cancelPress}
                aria-pressed={selectMode ? sel : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-slate-50"
              >
                {selectMode ? (
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                      sel ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {sel && <Check className="size-5 text-white" />}
                  </span>
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">
                    {initials(name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-slate-900">{name}</p>
                  {phone && (
                    <p className="mt-0.5 truncate text-sm text-slate-500 tabular-nums">
                      {maskPhone ? <MaskedPhone value={formatPhone(phone)} /> : formatPhone(phone)}
                    </p>
                  )}
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {selectMode ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset ${m.chip}`}>
                    <span className={`size-1.5 rounded-full ${m.dot}`} aria-hidden />
                    {m.label}
                  </span>
                ) : (
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
                )}
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

      {/* --- Vista escritorio: tabla (md+) --- */}
      <div className="hidden overflow-x-auto md:block">
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
            const name = candidateName(c) || 'Sin nombre'
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
                <td className="hidden px-3 py-2.5 text-sm text-slate-600 md:table-cell tnum">
                  <span className="block max-w-[150px] truncate">
                    {maskPhone && answerStr(c, 'telefono')
                      ? <MaskedPhone value={formatPhone(answerStr(c, 'telefono'))} />
                      : (formatPhone(answerStr(c, 'telefono')) || '–')}
                  </span>
                </td>
                {cols.map((f) => (
                  <td key={f.id} className="hidden px-3 py-2.5 text-sm text-slate-600 lg:table-cell">
                    <span className="block max-w-[200px] truncate" title={answerStr(c, f.id) || undefined}>{answerStr(c, f.id) || '–'}</span>
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

      <StatusPickerSheet
        open={!!statusFor}
        status={statusFor?.status ?? null}
        onPick={(s) => statusFor && setStatus(statusFor.id, s)}
        onClose={() => setStatusFor(null)}
      />
    </>
  )
}

// --- Subcomponentes de filtro / estados ------------------------------------
// Slider de rango con dos pomos (dos inputs range superpuestos; los pomos no se
// cruzan). La pista coloreada marca el tramo seleccionado.
function RangeSlider({ min, max, from, to, onChange }: {
  min: number; max: number; from: number; to: number; onChange: (from: number, to: number) => void
}) {
  const span = max - min || 1
  const pctFrom = ((from - min) / span) * 100
  const pctTo = ((to - min) / span) * 100
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" aria-hidden />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-500"
        style={{ left: `${pctFrom}%`, width: `${pctTo - pctFrom}%` }}
        aria-hidden
      />
      <input
        type="range" min={min} max={max} value={from}
        onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
        aria-label="Desde"
        className="range-thumb absolute inset-0 h-5 w-full"
      />
      <input
        type="range" min={min} max={max} value={to}
        onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
        aria-label="Hasta"
        className="range-thumb absolute inset-0 h-5 w-full"
      />
    </div>
  )
}

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
  numberFilters,
  setNumberFilters,
  numberDomains,
  ratingFilter,
  setRatingFilter,
  tags,
  tagFilter,
  setTagFilter,
  count,
}: {
  campaign: Campaign
  statusFilter: Set<CandidateStatus>
  setStatusFilter: React.Dispatch<React.SetStateAction<Set<CandidateStatus>>>
  valueFilters: { fieldId: string; label: string; value: string }[]
  setValueFilters: React.Dispatch<React.SetStateAction<{ fieldId: string; label: string; value: string }[]>>
  numberFilters: NumberFilter[]
  setNumberFilters: React.Dispatch<React.SetStateAction<NumberFilter[]>>
  numberDomains: Record<string, [number, number]>
  ratingFilter: number
  setRatingFilter: React.Dispatch<React.SetStateAction<number>>
  tags: TagType[]
  tagFilter: Set<string>
  setTagFilter: React.Dispatch<React.SetStateAction<Set<string>>>
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

  const numFor = (fieldId: string) => numberFilters.find((n) => n.fieldId === fieldId)
  // El slider va de [lo, hi]; guardamos min/max solo cuando se estrecha respecto al
  // dominio (null en los extremos -> chip "≥"/"≤"; rango completo -> sin filtro).
  const setRange = (f: FormField, lo: number, hi: number, from: number, to: number) => {
    const min = from > lo ? from : null
    const max = to < hi ? to : null
    setNumberFilters((p) => {
      const rest = p.filter((n) => n.fieldId !== f.id)
      return min == null && max == null ? rest : [...rest, { fieldId: f.id, label: f.label, min, max }]
    })
  }

  const toggleTag = (id: string) =>
    setTagFilter((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // Limpia solo los filtros (no la búsqueda); lo usa el pie de la hoja en móvil.
  const clearAll = () => {
    setStatusFilter(new Set())
    setValueFilters([])
    setNumberFilters([])
    setRatingFilter(0)
    setTagFilter(new Set())
  }

  // Controles compartidos por el desplegable de escritorio y la hoja inferior de
  // móvil. Las filas son cómodas al tacto (≥44px) en móvil y compactas en sm+.
  const rowClass =
    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2.5 text-[15px] text-slate-700 hover:bg-slate-50 sm:gap-2 sm:px-1.5 sm:py-1 sm:text-sm'
  const checkClass = 'size-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 sm:size-4'
  const controls = (
    <>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</p>
      <div className="mb-4 space-y-0.5 sm:mb-3">
        {STATUS_ORDER.map((s) => (
          <label key={s} className={rowClass}>
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
              className={checkClass}
            />
            <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
            {STATUS_META[s].label}
          </label>
        ))}
      </div>

      {/* Etiquetas: justo debajo de Estado (ambos son clasificación del empresario).
          Si la empresa aún no tiene etiquetas, el grupo se oculta (sin ruido). */}
      {TAGS_ENABLED && tags.length > 0 && (
        <div className="mb-4 sm:mb-3">
          <p id="flt-tags" className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Etiquetas</p>
          <div role="group" aria-labelledby="flt-tags" className="space-y-0.5">
            {tags.map((t) => (
              <label key={t.id} className={rowClass}>
                <input
                  type="checkbox"
                  checked={tagFilter.has(t.id)}
                  onChange={() => toggleTag(t.id)}
                  className={checkClass}
                />
                <span className="min-w-0 truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {filterableFields(campaign).map((f) => (
        <div key={f.id} className="mb-4 sm:mb-3">
          <p id={`flt-${f.id}`} className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</p>
          <div role="group" aria-labelledby={`flt-${f.id}`} className="space-y-0.5">
            {(f.type === 'boolean' ? ['Sí', 'No'] : f.options ?? []).map((opt) => (
              <label key={opt} className={rowClass}>
                <input
                  type="checkbox"
                  checked={hasValue(f.id, opt)}
                  onChange={() => toggleValue(f, opt)}
                  className={checkClass}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}

      {numberFields(campaign).map((f) => {
        const dom = numberDomains[f.id]
        if (!dom) return null // sin rango útil (sin datos o todos iguales): no hay slider
        const [lo, hi] = dom
        const nf = numFor(f.id)
        const from = nf?.min ?? lo
        const to = nf?.max ?? hi
        return (
          <div key={f.id} className="mb-4 sm:mb-3">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</p>
              <span className="text-[12px] font-medium tabular-nums text-slate-600">{from} – {to}</span>
            </div>
            <RangeSlider min={lo} max={hi} from={from} to={to} onChange={(nFrom, nTo) => setRange(f, lo, hi, nFrom, nTo)} />
          </div>
        )
      })}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Valoración mínima</p>
        <div className="flex gap-0.5" role="group" aria-label="Filtrar por valoración mínima">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRatingFilter(ratingFilter === n ? 0 : n)}
              aria-label={`${n} estrella${n > 1 ? 's' : ''} o más`}
              aria-pressed={ratingFilter >= n}
              className="rounded-md p-1.5 text-slate-300 transition-colors hover:text-amber-400 sm:p-0.5"
            >
              <Star
                className={`size-7 sm:size-5 ${ratingFilter >= n ? 'fill-amber-400 text-amber-400' : ''}`}
                aria-hidden
              />
            </button>
          ))}
        </div>
        {ratingFilter > 0 && (
          <p className="mt-1 text-[12px] text-slate-400">{ratingFilter} estrella{ratingFilter > 1 ? 's' : ''} o más</p>
        )}
      </div>
    </>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={BTN_SECONDARY}
      >
        <Filter className="size-4 text-slate-400" aria-hidden /> Filtros
        {count > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white tabular-nums">{count}</span>}
      </button>

      {/* Escritorio: desplegable anclado al botón */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 hidden max-h-[60vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-pop sm:block">
          {controls}
        </div>
      )}

      {/* Móvil: hoja inferior */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        footer={
          <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
            <button onClick={clearAll} disabled={count === 0} className={`${BTN_SECONDARY} flex-1 disabled:opacity-50`}>
              Limpiar
            </button>
            <button onClick={() => setOpen(false)} className={`${BTN_PRIMARY} flex-1`}>
              Ver resultados
            </button>
          </div>
        }
      >
        <div className="px-4 py-3">{controls}</div>
      </BottomSheet>
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
        className={`${BTN_PRIMARY} disabled:opacity-50`}
      >
        <Download className="size-4 text-indigo-200" aria-hidden />
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
            className={`${BTN_PRIMARY} mt-2.5 w-full`}
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
      {/* w-full + max-w para que la fila se ciña al ancho del card y el enlace se
          trunque (en una columna items-center, sin ancho fijo, no truncaría y se
          saldría). El enlace va discreto (más pequeño y tenue): manda la acción. */}
      <div className="mt-4 flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3.5 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-400">{publicUrl}</span>
        <button onClick={onCopy} className={`${BTN_PRIMARY_SM} shrink-0`}>
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
      <button onClick={onClear} className={`${BTN_SECONDARY} mt-4`}>
        {onlySearch ? 'Borrar búsqueda' : 'Limpiar filtros'}
      </button>
    </div>
  )
}

// --- Vistas guardadas (Pro/Multi) ------------------------------------------
function SavedViewsMenu({
  views,
  onApply,
  onDelete,
  onSave,
  canSave,
}: {
  views: SavedView[]
  onApply: (v: SavedView) => void
  onDelete: (id: string) => void
  onSave: () => void
  canSave: boolean
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

  // Lista de vistas compartida por el desplegable de escritorio y la hoja de móvil.
  // En móvil las filas son cómodas al tacto y el botón de borrar SIEMPRE se ve (en
  // táctil no hay hover); en sm+ se mantiene el borrar que aparece al pasar el ratón.
  const list =
    views.length === 0 ? (
      <p className="px-2.5 py-2 text-[13px] text-slate-500">
        Aún no has guardado ninguna vista. Filtra como quieras y guarda la combinación.
      </p>
    ) : (
      <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto sm:max-h-[40vh]">
        {views.map((v) => (
          <li key={v.id} className="group flex items-center gap-1 rounded-lg hover:bg-slate-50">
            <button
              onClick={() => {
                onApply(v)
                setOpen(false)
              }}
              className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-3 text-left text-[15px] text-slate-700 sm:gap-2 sm:py-1.5 sm:text-sm"
            >
              {v.campaignId === null ? (
                <Globe className="size-4 shrink-0 text-slate-400 sm:size-3.5" aria-hidden />
              ) : (
                <Briefcase className="size-4 shrink-0 text-slate-400 sm:size-3.5" aria-hidden />
              )}
              <span className="truncate">{v.name}</span>
            </button>
            <button
              onClick={() => onDelete(v.id)}
              aria-label={`Eliminar vista ${v.name}`}
              className="mr-1 grid size-9 shrink-0 place-items-center rounded-md text-slate-400 opacity-100 transition-opacity hover:bg-slate-200 hover:text-slate-700 focus-visible:opacity-100 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Trash2 className="size-4 sm:size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={BTN_SECONDARY}
      >
        <Bookmark className="size-4 text-slate-400" aria-hidden /> Vistas
        {views.length > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-500">{views.length}</span>
        )}
      </button>

      {/* Escritorio: desplegable anclado al botón */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 hidden w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop sm:block">
          {list}
          <div className="mt-1 border-t border-slate-100 pt-1">
            <button
              onClick={() => {
                setOpen(false)
                onSave()
              }}
              disabled={!canSave}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus className="size-4" aria-hidden /> Guardar vista actual
            </button>
            {!canSave && (
              <p className="px-2.5 pb-1 pt-0.5 text-[11px] text-slate-400">Aplica un filtro o una búsqueda para poder guardarla.</p>
            )}
          </div>
        </div>
      )}

      {/* Móvil: hoja inferior */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Vistas"
        footer={
          <div className="border-t border-slate-200 px-4 py-3">
            <button
              onClick={() => {
                setOpen(false)
                onSave()
              }}
              disabled={!canSave}
              className={`${BTN_PRIMARY} w-full disabled:opacity-50`}
            >
              <Plus className="size-4" aria-hidden /> Guardar vista actual
            </button>
            {!canSave && (
              <p className="mt-2 text-center text-[12px] text-slate-400">Aplica un filtro o una búsqueda para poder guardarla.</p>
            )}
          </div>
        }
      >
        <div className="px-2 py-2">{list}</div>
      </BottomSheet>
    </div>
  )
}

function SaveViewDialog({
  open,
  onClose,
  onSave,
  hasValueFilters,
  valueFilterLabels,
  campaignTitle,
}: {
  open: boolean
  onClose: () => void
  onSave: (name: string, scope: 'global' | 'campaign') => void
  hasValueFilters: boolean
  valueFilterLabels: string[]
  campaignTitle: string
}) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'global' | 'campaign'>('global')

  useEffect(() => {
    if (open) {
      setName('')
      setScope(hasValueFilters ? 'campaign' : 'global')
    }
  }, [open, hasValueFilters])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const effectiveScope: 'global' | 'campaign' = hasValueFilters ? 'campaign' : scope
  const canSave = name.trim().length > 0
  const submit = () => canSave && onSave(name.trim(), effectiveScope)

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="saveview-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-pop">
        <h2 id="saveview-title" className="text-lg font-semibold text-slate-900">Guardar vista</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Ponle nombre a esta combinación de filtros para reaplicarla de un clic.
        </p>

        <label htmlFor="viewname" className="mt-4 block text-sm font-semibold text-slate-800">Nombre</label>
        <input
          id="viewname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
          placeholder="ej: sin contactar esta semana"
          className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">Dónde se aplica</p>
          {hasValueFilters ? (
            <p className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
              Esta vista incluye filtros de {valueFilterLabels.join(', ')}, que dependen de los campos de este formulario.
              Por eso se guarda solo en <strong className="font-semibold text-slate-800">{campaignTitle}</strong>.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                <input type="radio" name="viewscope" checked={scope === 'global'} onChange={() => setScope('global')} className="mt-0.5 size-4 border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">En todos mis puestos</span>
                  <span className="block text-[12px] text-slate-500">Búsqueda, estado y orden. Aparece en cualquier puesto.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                <input type="radio" name="viewscope" checked={scope === 'campaign'} onChange={() => setScope('campaign')} className="mt-0.5 size-4 border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Solo en este puesto</span>
                  <span className="block text-[12px] text-slate-500">Aparece solo en {campaignTitle}.</span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={BTN_SECONDARY}>
            Cancelar
          </button>
          <button onClick={submit} disabled={!canSave} className={`${BTN_PRIMARY} disabled:opacity-50`}>
            Guardar vista
          </button>
        </div>
      </div>
    </div>
  )
}

// Selector de sede del puesto (Multi). Asigna el puesto a una sede o lo deja sin sede.
function SiteSelect({
  sites,
  value,
  onChange,
  base,
  locked = false,
  onLocked,
}: {
  sites: Site[]
  value: string | null
  onChange: (siteId: string | null) => void
  base: string
  locked?: boolean
  onLocked?: () => void
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
  const current = sites.find((s) => s.id === value)
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => (locked ? onLocked?.() : setOpen((o) => !o))}
        aria-haspopup={locked ? 'dialog' : 'listbox'}
        aria-expanded={locked ? undefined : open}
        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
      >
        <Building2 className="size-3.5 text-slate-400" aria-hidden />
        {current ? current.name : 'Sin sede'}
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </button>
      {open && !locked && (
        <ul role="listbox" className="absolute left-0 z-50 mt-1 max-h-[50vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          <li>
            <button
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="flex-1">Sin sede</span>
              {!value && <Check className="size-4 text-indigo-600" aria-hidden />}
            </button>
          </li>
          {sites.map((s) => (
            <li key={s.id}>
              <button
                role="option"
                aria-selected={s.id === value}
                onClick={() => {
                  onChange(s.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Building2 className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="flex-1 truncate">{s.name}</span>
                {s.id === value && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
              </button>
            </li>
          ))}
          <li className="mt-1 border-t border-slate-100 pt-1">
            <Link to={`${base}/sedes`} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
              <Plus className="size-3.5" aria-hidden /> Gestionar sedes
            </Link>
          </li>
        </ul>
      )}
    </div>
  )
}

// Selector de marca del puesto (Multi). Al elegir una marca se aplica su apariencia.
function BrandSelect({
  brands,
  value,
  onChange,
  base,
  locked = false,
  onLocked,
}: {
  brands: Brand[]
  value: string | null
  onChange: (brandId: string | null) => void
  base: string
  locked?: boolean
  onLocked?: () => void
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
  const current = brands.find((b) => b.id === value)
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => (locked ? onLocked?.() : setOpen((o) => !o))}
        aria-haspopup={locked ? 'dialog' : 'listbox'}
        aria-expanded={locked ? undefined : open}
        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
      >
        {current ? (
          <span className="size-2.5 rounded-full" style={{ backgroundColor: current.accent }} aria-hidden />
        ) : (
          <Tag className="size-3.5 text-slate-400" aria-hidden />
        )}
        {current ? current.name : 'Sin marca'}
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </button>
      {open && !locked && (
        <ul role="listbox" className="absolute left-0 z-50 mt-1 max-h-[50vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          <li>
            <button
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="flex-1">Sin marca</span>
              {!value && <Check className="size-4 text-indigo-600" aria-hidden />}
            </button>
          </li>
          {brands.map((b) => (
            <li key={b.id}>
              <button
                role="option"
                aria-selected={b.id === value}
                onClick={() => {
                  onChange(b.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.accent }} aria-hidden />
                <span className="flex-1 truncate">{b.name}</span>
                {b.id === value && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
              </button>
            </li>
          ))}
          <li className="mt-1 border-t border-slate-100 pt-1">
            <Link to={`${base}/marcas`} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
              <Plus className="size-3.5" aria-hidden /> Gestionar marcas
            </Link>
          </li>
        </ul>
      )}
    </div>
  )
}

// --- Ajustes del puesto (hoja inferior, solo móvil) ------------------------
// Agrupa sede, marca y avisos en una hoja para no romper la cabecera con pills
// que no caben en una línea. Las opciones se eligen como chips (no desplegables
// anidados, que se recortarían dentro del scroll de la hoja).
function SettingSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SettingChip({ selected, onClick, label, dot, Icon }: { selected: boolean; onClick: () => void; label: string; dot?: string; Icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${
        selected ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {dot !== undefined ? (
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
      ) : Icon ? (
        <Icon className={`size-3.5 shrink-0 ${selected ? 'text-indigo-500' : 'text-slate-400'}`} aria-hidden />
      ) : null}
      <span className="truncate">{label}</span>
      {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
    </button>
  )
}

function LockedSetting({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] text-slate-600 hover:bg-slate-100"
    >
      <Lock className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      <span className="flex-1">{text}</span>
      <span className="shrink-0 font-semibold text-indigo-700">Ver planes</span>
    </button>
  )
}

function PuestoSettingsSheet({
  open,
  onClose,
  campaign,
  sites,
  brands,
  hasSites,
  hasBrands,
  base,
  onSetSite,
  onSetBrand,
  onToggleNotify,
  onUpgrade,
  onDuplicate,
  duplicating,
}: {
  open: boolean
  onClose: () => void
  campaign: Campaign
  sites: Site[]
  brands: Brand[]
  hasSites: boolean
  hasBrands: boolean
  base: string
  onSetSite: (siteId: string | null) => void
  onSetBrand: (brandId: string | null) => void
  onToggleNotify: () => void
  onUpgrade: (f: PlanFeature) => void
  onDuplicate: () => void
  duplicating: boolean
}) {
  const notify = campaign.notifyNew !== false
  return (
    <BottomSheet open={open} onClose={onClose} title="Ajustes del puesto">
      <div className="space-y-5 px-4 py-4">
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sede</p>
                {hasSites ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <SettingChip selected={!campaign.siteId} onClick={() => onSetSite(null)} label="Sin sede" Icon={Building2} />
                      {sites.map((s) => (
                        <SettingChip key={s.id} selected={campaign.siteId === s.id} onClick={() => onSetSite(s.id)} label={s.name} Icon={Building2} />
                      ))}
                    </div>
                    <Link to={`${base}/sedes`} onClick={onClose} className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-700">
                      <Plus className="size-3.5" aria-hidden /> Gestionar sedes
                    </Link>
                  </>
                ) : (
                  <LockedSetting onClick={() => { onUpgrade('sites'); onClose() }} text="Organiza tus puestos por sede con el plan Multi." />
                )}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Marca</p>
                {hasBrands ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <SettingChip selected={!campaign.brandId} onClick={() => onSetBrand(null)} label="Sin marca" Icon={Tag} />
                      {brands.map((b) => (
                        <SettingChip key={b.id} selected={campaign.brandId === b.id} onClick={() => onSetBrand(b.id)} label={b.name} dot={b.accent} />
                      ))}
                    </div>
                    <Link to={`${base}/marcas`} onClick={onClose} className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-700">
                      <Plus className="size-3.5" aria-hidden /> Gestionar marcas
                    </Link>
                  </>
                ) : (
                  <LockedSetting onClick={() => { onUpgrade('brands'); onClose() }} text="Aplica la identidad de tus marcas con el plan Multi." />
                )}
              </section>

              <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">Avisos por email</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">Te avisamos cuando entra un candidato nuevo en este puesto.</p>
                </div>
                <SettingSwitch checked={notify} onChange={onToggleNotify} label="Avisos por email" />
              </section>

              <section>
                <button
                  onClick={onDuplicate}
                  disabled={duplicating}
                  className={`${BTN_SECONDARY} w-full disabled:opacity-60`}
                >
                  <Copy className="size-4 text-slate-400" aria-hidden />
                  {duplicating ? 'Duplicando…' : 'Duplicar puesto'}
                </button>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">Crea un puesto nuevo con los mismos campos y apariencia, sin candidatos.</p>
              </section>
      </div>
    </BottomSheet>
  )
}

// Menú "más acciones" del puesto (escritorio). Mismo patrón de popover que
// SiteSelect/BrandSelect: cierre con click fuera y Escape, foco visible.
function PuestoMenu({ onDuplicate, duplicating }: { onDuplicate: () => void; duplicating: boolean }) {
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
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${BTN_SECONDARY} px-2`}
        title="Más acciones"
        aria-label="Más acciones del puesto"
      >
        <MoreHorizontal className="size-4 text-slate-400" aria-hidden />
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          <li role="none">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDuplicate()
              }}
              disabled={duplicating}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Copy className="size-4 text-slate-400" aria-hidden />
              {duplicating ? 'Duplicando…' : 'Duplicar puesto'}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

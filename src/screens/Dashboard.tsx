import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Archive,
  ArrowUp,
  ArrowUpDown,
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
  Loader2,
  Lock,
  MailCheck,
  Pause,
  PenLine,
  Play,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Share2,
  SlidersHorizontal,
  Star,
  MessagesSquare,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { Checkbox } from '../components/ui/Checkbox'
import { StatusSelect, StatusPickerSheet } from '../components/ui/StatusPill'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { CandidateModal } from './CandidateModal'
import { exportCandidatesToExcel } from '../lib/export'
import { RegistrarAccion } from '../lib/acciones'
import { relativeDate, miles, formatPhone, candidateName, isFreshNuevo } from '../lib/format'
import { clickDeFila } from '../lib/fila'
// El anillo de ajuste se queda en el avatar (Mario, jul 2026) y desde ago 2026 lo
// acompaña la columna "Encaje", que dice en palabras lo que el anillo dice en arco:
// mismo par punto+texto que exige la doctrina para el estado. Con ella vuelve su
// ORDEN; lo que sigue retirado es el buscador en lenguaje natural.
import { MeridianAvatar, FitLabel } from '../components/Meridian'
import { candidateFit, hasMeridian } from '../lib/meridian'
import { STATUS_META, STATUS_ORDER } from '../lib/types'
import type { Brand, Campaign, Candidate, CandidateInterestState, CandidateStatus, FormField, NumberFilter, SavedView, Site, SortKey, Tag as TagType } from '../lib/types'
import { planHas, PLAN_CANDIDATE_LIMIT, TAGS_ENABLED, type PlanFeature } from '../lib/pricing'
import { TagCell, BulkTagMenu, ManageTagsModal } from '../components/Tags'
import { publicFormUrl, publicFormUrlDisplay } from '../lib/brand'
import { OnboardingTestCard } from '../components/OnboardingGuide'
import { ShareReply } from '../components/ShareReply'
import { useOnboarding } from '../lib/onboarding'
import { useAppBase } from '../lib/useAppBase'
import { MaskedPhone } from '../components/MaskedPhone'
import { PullToRefresh, type RefreshResult } from '../components/PullToRefresh'
import { UpgradeDialog } from '../components/UpgradeDialog'
import { BTN_DANGER, BTN_PRIMARY, BTN_PRIMARY_SM, BTN_SECONDARY } from '../lib/buttons'
import { copyText } from '../lib/clipboard'
import { supabase } from '../lib/supabase'
import { searchScore } from '../lib/search'
import { InterestCheckDialog } from '../components/InterestCheckDialog'
import { InterestOutcomeIcon } from '../components/InterestSignal'
import { candidateInterestState, INTEREST_STATE_LABEL } from '../lib/interest'

function answerStr(c: Candidate, fieldId: string): string {
  const v = c.answers[fieldId]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { getCampaign, candidatesFor, restoreCandidate, savedViews, createSavedView, deleteSavedView, sites, createSite, updateCampaign, brands, reloadCandidatesFor, markSeen, duplicateCampaign, tags, deleteCampaign, lockedInfo, loadCommentsForMany } = useStore()
  const { company, role } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const campaign = getCampaign(campaignId!)
  // El encargado gestiona candidatos, pero NO edita el puesto (form/sede/marca):
  // esas escrituras van contra campaigns, que la RLS le bloquea.
  const isEncargado = role === 'encargado'
  const canManage = !isEncargado
  // El encargado aplica/quita etiquetas existentes pero no crea ni gestiona el
  // vocabulario (igual que en la RLS). owner/member sí.
  const canManageTags = !isEncargado
  const canViews = planHas(company?.plan, 'savedViews')

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<CandidateStatus>>(new Set())
  const [valueFilters, setValueFilters] = useState<{ fieldId: string; label: string; value: string }[]>([])
  const [numberFilters, setNumberFilters] = useState<NumberFilter[]>([])
  const [favoritosOnly, setFavoritosOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set()) // ids de etiqueta; OR dentro del grupo
  const [interestFilter, setInterestFilter] = useState<Set<CandidateInterestState>>(new Set())
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'fecha', dir: 'desc' })
  // El candidato abierto vive en la URL (?candidato=<id>), no en estado local:
  // así el aviso de una mención puede enlazar directamente a su ficha, y volver
  // atrás cierra el detalle en vez de salir del puesto.
  const openId = searchParams.get('candidato')
  const setOpenId = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('candidato', id)
        else next.delete('candidato')
        return next
      },
      // replace: recorrer 40 candidatos con las flechas no debe dejar 40 entradas
      // en el historial del navegador.
      { replace: true },
    )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [interestDialogOpen, setInterestDialogOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false) // modo selección múltiple (móvil)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false) // aviso al pulsar una candidatura bloqueada
  // Aquí vivía una cabecera adaptativa: medía el título con un ResizeObserver y,
  // si no cabía, reducía "Compartir" a solo icono. Dejó de servir para nada
  // cuando los dos botones pasaron a ser cuadrados de icono en móvil: la etiqueta
  // ya se oculta siempre por debajo de `sm`. Se quitó el estado, las dos
  // mediciones y el observer, que seguían corriendo en cada render del panel.
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false) // hoja de ajustes del puesto (móvil)
  const [duplicating, setDuplicating] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  // Pausar libera cupo; reactivar consume un hueco activo: si el plan ya está al
  // máximo de activos, updateCampaign revierte y avisa (el toast lo explica).
  const togglePause = async () => {
    if (!campaign) return
    const next = campaign.status === 'activa' ? 'pausada' : 'activa'
    const ok = await updateCampaign(campaign.id, { status: next })
    if (ok) toast.success(next === 'pausada' ? 'Puesto pausado. Deja de aceptar candidaturas.' : 'Puesto reactivado.')
  }
  // Reabrir un puesto cerrado vuelve a contar como proceso activo: updateCampaign
  // revierte y avisa solo si el plan no da para más.
  const reopen = async () => {
    if (!campaign) return
    const ok = await updateCampaign(campaign.id, { status: 'activa' })
    if (ok) toast.success('Puesto reabierto.')
  }
  // Cerrar: deja de aceptar candidaturas y libera un cupo del plan (reversible).
  const doClose = async () => {
    if (!campaign) return
    setClosing(true)
    const ok = await updateCampaign(campaign.id, { status: 'cerrada' })
    setClosing(false)
    setConfirmClose(false)
    setSettingsOpen(false)
    if (ok) toast.success('Puesto cerrado. Liberaste un proceso de tu plan.')
  }
  // Eliminar: borrado real del puesto y sus candidaturas. Tras borrar, salimos al
  // primer puesto disponible (la ruta índice redirige).
  const doDelete = async () => {
    if (!campaign) return
    setDeleting(true)
    const ok = await deleteCampaign(campaign.id)
    setDeleting(false)
    setConfirmDelete(false)
    setSettingsOpen(false)
    if (ok) {
      toast.success('Puesto eliminado.')
      navigate(base)
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
    setFavoritosOnly(false)
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

  // IDs de candidatos que "acaban de llegar" (en vivo por realtime, por refresco
  // manual o por tirar para refrescar) mientras el usuario ya tenía el puesto
  // abierto: la fila hace una entrada breve en la tabla (nunca en la carga
  // inicial del puesto, eso sería un intro de página, prohibido por la doctrina).
  // Se ajusta DURANTE el render (patrón oficial de React para derivar estado a
  // partir de un cambio en las props), no en un efecto: un efecto llegaría un
  // render tarde, cuando la fila ya habría montado en su estado final y
  // `initial` ya no tendría ningún efecto (framer-motion solo lo consulta en
  // el montaje).
  const [trackedCampaignId, setTrackedCampaignId] = useState<string | null>(null)
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null)
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set())
  if (campaign && trackedCampaignId !== campaign.id) {
    // Puesto distinto (o primera vez): lo que ya hay ahí es "de siempre", no anima.
    setTrackedCampaignId(campaign.id)
    setSeenIds(new Set(all.map((c) => c.id)))
    if (justArrived.size > 0) setJustArrived(new Set())
  } else if (seenIds) {
    const arrivedIds = all.filter((c) => !seenIds.has(c.id)).map((c) => c.id)
    if (arrivedIds.length > 0) {
      setSeenIds(new Set(all.map((c) => c.id)))
      setJustArrived((prev) => new Set([...prev, ...arrivedIds]))
    }
  }
  // Dejan de estar "recién llegados" pasado un momento: si la fila desaparece
  // de un filtro y reaparece luego, no debe repetir la entrada.
  useEffect(() => {
    if (justArrived.size === 0) return
    const ids = [...justArrived]
    const t = window.setTimeout(() => {
      setJustArrived((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }, 900)
    return () => window.clearTimeout(t)
  }, [justArrived])

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
      if (interestFilter.size && !interestFilter.has(candidateInterestState(campaign, c))) return false
      if (favoritosOnly && !c.favorito) return false
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
        else if (sort.key === 'encaje') {
          const fa = candidateFit(a.ai)
          const fb = candidateFit(b.ai)
          // Sin analizar va SIEMPRE al final, se ordene como se ordene: "no lo sé"
          // no es "el peor encaje", y colarlo arriba al invertir sería mentir.
          if (fa == null || fb == null) return fa == null ? (fb == null ? 0 : 1) : -1
          cmp = fa - fb
        }
        else cmp = a.submittedAt.localeCompare(b.submittedAt)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [all, campaign, dq, rpcIds, base, statusFilter, interestFilter, valueFilters, numberFilters, favoritosOnly, tagFilter, sort])

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

  // Candidatos BLOQUEADOS (cupo del plan gratuito superado): se siguen recibiendo,
  // pero el comerciante no los ve hasta subir de plan. Mostramos un aviso + filas
  // difuminadas para que sepa cuántos esperan. Solo en trial (los de pago no
  // bloquean). Las filas difuminadas, solo en la vista sin filtrar.
  const lockedFor = campaign && company?.plan === 'trial' ? lockedInfo[campaign.id] : undefined
  const lockedCount = lockedFor?.count ?? 0
  const lockedDates = lockedFor?.dates ?? []
  const isFiltered =
    !!dq || statusFilter.size > 0 || interestFilter.size > 0 || favoritosOnly || tagFilter.size > 0 || valueFilters.length > 0 || numberFilters.length > 0
  // Los bloqueados (difuminados) salen ARRIBA, como las candidaturas nuevas (son
  // las más recientes), solo en la vista por defecto (más nuevos primero y sin
  // filtros): con otro orden no tendría sentido cronológico, así que ahí no se
  // pintan (el aviso de upsell sí sigue saliendo, va por el recuento aparte).
  const showLockedRows = !isFiltered && sort.key === 'fecha' && sort.dir === 'desc'

  if (!campaign) {
    return (
      <div className="grid h-full place-items-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
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

  const activeFilterCount = statusFilter.size + interestFilter.size + valueFilters.length + numberFilters.length + (favoritosOnly ? 1 : 0) + tagFilter.size
  // Aquí vivía `cols` (highlightFields): las dos respuestas del formulario que la
  // tabla pintaba como columnas. Fuera desde ago 2026 (Mario): cambiaban de puesto en
  // puesto, se comían el ancho de lo que sí es común a todos (encaje, etiquetas,
  // teléfono) y llegaban con la cabecera cortada. Las respuestas siguen enteras donde
  // valen: la ficha, los filtros y el Excel.
  const showFit = hasMeridian(company?.plan)
  const openCandidate = openId ? all.find((c) => c.id === openId) ?? null : null
  const selectedCandidates = all.filter((candidate) => selected.has(candidate.id))
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
    setInterestFilter(new Set(v.payload.interestStates ?? []))
    setValueFilters(v.payload.valueFilters ?? [])
    setNumberFilters(v.payload.numberFilters ?? [])
    setFavoritosOnly(v.payload.favoritosOnly ?? false)
    setTagFilter(new Set(v.payload.tagFilter ?? []))
    setSort(v.payload.sort ?? { key: 'fecha', dir: 'desc' })
  }

  const saveView = async (name: string, scope: 'global' | 'campaign') => {
    const ok = await createSavedView({
      name,
      campaignId: scope === 'global' ? null : campaign.id,
      payload: { search, statuses: [...statusFilter], interestStates: [...interestFilter], valueFilters, numberFilters, favoritosOnly, tagFilter: [...tagFilter], sort },
    })
    setSaveViewOpen(false)
    if (ok) toast.success('Vista guardada')
  }

  // La marca aporta el nombre, el logo y el banner del formulario, en vivo: cambiar
  // de marca NO pisa el color ni los textos de este puesto (eso es suyo y se edita
  // en el constructor). Sin sorpresas visuales al cambiar la etiqueta.
  const applyBrand = (brandId: string | null) => {
    updateCampaign(campaign.id, { brandId })
  }

  const toggleSort = (key: SortKey) =>
    // Al elegir una columna nueva empieza ascendente, salvo Encaje: ahí lo que se
    // pide al pulsar es "enséñame primero a quien encaja", no al revés.
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'encaje' ? 'desc' : 'asc' }))

  const clearFilters = () => {
    setStatusFilter(new Set())
    setInterestFilter(new Set())
    setValueFilters([])
    setNumberFilters([])
    setFavoritosOnly(false)
    setTagFilter(new Set())
    setSearch('')
  }

  const doExport = async () => {
    // Las candidaturas bloqueadas (plan gratuito, sobre el tope) también salen en
    // el Excel, como filas señuelo sin datos personales: exportar no puede ser un
    // atajo para leer lo bloqueado. Solo en la vista completa (sin filtro): con un
    // filtro no sabemos si encajarían, así que no se mezclan (igual que en el panel).
    let lockedDates: string[] = []
    if (lockedCount > 0 && !isFiltered) {
      const { data } = await supabase.rpc('locked_candidates_export', { p_campaign: campaign.id })
      if (Array.isArray(data)) lockedDates = data as string[]
    }
    const name = await exportCandidatesToExcel(campaign, filtered, tags, lockedDates, await loadCommentsForMany(filtered.map((c) => c.id)))
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
    const name = await exportCandidatesToExcel(campaign, subset, tags, [], await loadCommentsForMany(subset.map((c) => c.id)))
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
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Acción del buscador mientras este puesto esté abierto: exporta lo que ves,
          con los filtros puestos. Lleva el nombre del puesto porque el buscador se
          usa desde cualquier sitio y "Exportar a Excel" a secas no diría de qué. */}
      <RegistrarAccion
        activa={filtered.length > 0}
        id="exportar-excel"
        label={`Exportar a Excel · ${campaign.title}`}
        hint={
          isFiltered
            ? `Las ${filtered.length} candidaturas que tienes filtradas ahora.`
            : `Las ${filtered.length} candidaturas de este puesto.`
        }
        icon={Download}
        claves={['excel', 'xlsx', 'exportar', 'descargar', 'hoja de calculo']}
        hacer={() => void doExport()}
      />
      {/* Cabecera del puesto */}
      <header className="mb-5">
        {/* Título + acciones: solo Compartir y Editar visibles; el resto en Ajustes del puesto. */}
        <div className="flex items-center gap-2.5">
          <h1 className="min-w-0 truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">{campaign.title}</h1>
          {campaign.status !== 'activa' && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
              {campaign.status === 'pausada' ? 'Pausado' : 'Cerrado'}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            <ShareMenu
              campaignId={campaign.id}
              title={campaign.title}
              url={publicFormUrl(campaign.slug, brandLabel)}
              urlDisplay={publicUrl}
              template={campaign.shareReply}
              canEdit={canManage}
              demo={base === '/demo'}
            />
            {/* En móvil los dos botones de la cabecera son cuadrados de 44px: solo
                icono, mismo tamaño y mismo alto. Antes este medía 32 de alto y
                llevaba texto, y el de compartir 44, así que quedaban desparejos.
                44 es además el mínimo de objetivo táctil. */}
            {canManage && (
              <Link
                to={`${base}/puestos/${campaign.id}/formulario`}
                className={`${BTN_PRIMARY} max-sm:size-11 max-sm:px-0`}
                title="Editar formulario"
                aria-label="Editar formulario"
              >
                <PenLine className="size-4 shrink-0 text-indigo-200" aria-hidden />
                <span className="max-sm:hidden">Editar</span>
              </Link>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {[campaign.sector, campaign.location].map((s) => s?.trim()).filter(Boolean).join(', ')}
        </p>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
        >
          <SlidersHorizontal className="size-3.5 text-slate-400" aria-hidden /> Ajustes del puesto
        </button>
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
        <div className="flex min-w-0 w-full flex-1 items-center gap-2 sm:min-w-[200px]">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            {/* El alto acompaña al de los botones de la fila en los dos punteros: 36px en
                escritorio y 44px en táctil, igual que BTN_SECONDARY. El filo no necesita
                nada especial porque los anillos de los botones son `ring-inset` (ver
                lib/buttons.ts): pintan dentro de su caja, como este `border`. */}
            <input
              type="search"
              aria-label="Buscar candidatos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono..."
              className="h-9 pointer-coarse:h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              const r = await refresh()
              if (r.message) r.ok ? toast.show(r.message) : toast.error(r.message)
            }}
            disabled={refreshing}
            className={`${BTN_SECONDARY} max-sm:hidden shrink-0 disabled:opacity-60`}
            title="Refrescar candidatos"
            aria-label="Refrescar candidatos"
          >
            <RefreshCw className={`size-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          </button>
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
            interestFilter={interestFilter}
            setInterestFilter={setInterestFilter}
            valueFilters={valueFilters}
            setValueFilters={setValueFilters}
            numberFilters={numberFilters}
            setNumberFilters={setNumberFilters}
            numberDomains={numberDomains}
            favoritosOnly={favoritosOnly}
            setFavoritosOnly={setFavoritosOnly}
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

        </div>
      </div>

      {/* Chips de filtros activos */}
      {(statusFilter.size > 0 || interestFilter.size > 0 || valueFilters.length > 0 || numberFilters.length > 0 || favoritosOnly || tagFilter.size > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-3.5" aria-hidden /> Limpiar
          </button>
          {[...statusFilter].map((s) => (
            <Chip key={`s-${s}`} label={`Estado: ${STATUS_META[s].label}`} onRemove={() => setStatusFilter((p) => { const n = new Set(p); n.delete(s); return n })} />
          ))}
          {[...interestFilter].map((s) => (
            <Chip key={`i-${s}`} label={`Interés: ${INTEREST_STATE_LABEL[s]}`} onRemove={() => setInterestFilter((p) => { const n = new Set(p); n.delete(s); return n })} />
          ))}
          {valueFilters.map((vf, i) => (
            <Chip key={`v-${i}`} label={`${vf.label}: ${vf.value}`} onRemove={() => setValueFilters((p) => p.filter((_, j) => j !== i))} />
          ))}
          {numberFilters.map((nf) => (
            <Chip key={`n-${nf.fieldId}`} label={`${nf.label}: ${numberFilterLabel(nf)}`} onRemove={() => setNumberFilters((p) => p.filter((x) => x.fieldId !== nf.fieldId))} />
          ))}
          {favoritosOnly && (
            <Chip label="Solo favoritos" onRemove={() => setFavoritosOnly(false)} />
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
          {loading ? (
            'Cargando candidatos'
          ) : (
            <>
              <span className="num font-medium text-slate-700">{miles(filtered.length)}</span>{' '}
              {filtered.length === 1 ? 'candidato' : 'candidatos'}
              {activeFilterCount > 0 && (
                <>
                  {', '}
                  <span className="num">{activeFilterCount}</span> {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
                </>
              )}
            </>
          )}
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
        <div className="mt-3 hidden flex-wrap items-center gap-2.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-card sm:flex">
          <span className="font-semibold">{selected.size} seleccionados</span>
          <button
            type="button"
            onClick={() => setInterestDialogOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 font-semibold text-indigo-700 shadow-control hover:bg-indigo-50"
          >
            <MailCheck className="size-4" aria-hidden /> Comprobar interés
          </button>
          {TAGS_ENABLED && (
            <div className="flex items-center gap-2">
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
              const name = await exportCandidatesToExcel(campaign, subset, tags, [], await loadCommentsForMany(subset.map((c) => c.id)))
              toast.success(`Excel listo con ${subset.length} ${subset.length === 1 ? 'candidato' : 'candidatos'}, ${name}`)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
          >
            <Download className="size-4" aria-hidden /> Exportar selección
          </button>
          <button onClick={() => setSelected(new Set())} className="rounded-lg p-1 hover:bg-white/15" aria-label="Quitar selección">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Aviso de candidaturas bloqueadas (plan gratuito): se siguen recibiendo,
          pero solo se ven hasta el tope. Invita a mejorar el plan, sin urgencia falsa. */}
      {lockedCount > 0 && !loading && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-card sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Lock className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {lockedCount === 1 ? 'Tienes 1 candidatura esperando' : `Tienes ${lockedCount} candidaturas esperando`}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
              Las seguimos recibiendo, pero el plan gratuito solo te deja ver {PLAN_CANDIDATE_LIMIT.trial}. Mejora tu plan para verlas todas.
            </p>
          </div>
          <button onClick={() => navigate(`${base}/plan`)} className={`${BTN_PRIMARY} shrink-0 max-sm:w-full max-sm:justify-center`}>
            Mejorar plan
          </button>
        </div>
      )}

      {/* Tabla / estados */}
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card md:overflow-visible">
        {loading ? (
          <SkeletonRows showFit={showFit} />
        ) : filtered.length === 0 ? (
          all.length === 0 ? (
            // Durante la guía de primer uso, el paso 4 ("pruébalo tú mismo") vive
            // aquí: en el hueco exacto donde aparecerá la candidatura de prueba.
            onboarding.active && onboarding.phase === 'probar' && onboarding.campaign?.id === campaign.id ? (
              <OnboardingTestCard campaign={campaign} shareUrl={publicFormUrl(campaign.slug, brandLabel)} onCopy={copyLink} />
            ) : (
              <EmptyFirstUse publicUrl={publicUrl} onCopy={copyLink} />
            )
          ) : (
            <EmptyNoResults search={search} hasFilters={statusFilter.size + valueFilters.length + numberFilters.length > 0} onClear={clearFilters} />
          )
        ) : (
          <CandidateTable
            campaign={campaign}
            showFit={showFit}
            rows={filtered}
            justArrived={justArrived}
            lockedDates={showLockedRows ? lockedDates : []}
            onLockedClick={() => setLockedDialogOpen(true)}
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

      <ConfirmDialog
        open={lockedDialogOpen}
        onClose={() => setLockedDialogOpen(false)}
        onConfirm={() => { setLockedDialogOpen(false); navigate(`${base}/plan`) }}
        title="Mejora tu plan para verla"
        confirmLabel="Ver planes"
        cancelLabel="Ahora no"
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Esta candidatura entró por encima del{' '}
          <strong className="font-semibold text-slate-900">tope del plan gratuito</strong>. La guardamos por ti, pero para verla, y todas las que sigan llegando,{' '}
          <strong className="font-semibold text-slate-900">necesitas mejorar tu plan</strong>.
        </p>
      </ConfirmDialog>

      <CandidateModal
        campaign={campaign}
        candidate={openCandidate}
        maskPhone={maskPhone}
        onClose={() => setOpenId(null)}
        onOpenManageTags={canManageTags ? () => setManageTagsOpen(true) : undefined}
        onDeleted={(c) =>
          toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
        }
        // Las flechas recorren lo que se está viendo, no toda la base: si has
        // filtrado por "entrevista", "siguiente" es el siguiente de esa lista.
        siblings={filtered}
        onNavigate={setOpenId}
      />

      <InterestCheckDialog
        open={interestDialogOpen}
        campaign={campaign}
        candidates={selectedCandidates}
        base={base}
        demo={base === '/demo'}
        onClose={() => setInterestDialogOpen(false)}
        onSent={() => toast.success(base === '/demo' ? 'Simulación completada.' : 'Comprobación enviada.')}
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

      <PuestoSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        campaign={campaign}
        sites={sites}
        brands={brands}
        canManage={canManage}
        exportCount={filtered.length}
        exportTotal={all.length}
        onExport={doExport}
        onSetSite={(siteId) => updateCampaign(campaign.id, { siteId })}
        onCreateSite={createSite}
        onSetBrand={applyBrand}
        onToggleNotify={() => updateCampaign(campaign.id, { notifyNew: campaign.notifyNew === false })}
        onDuplicate={handleDuplicate}
        duplicating={duplicating}
        onPauseResume={togglePause}
        onReopen={reopen}
        onClosePuesto={() => setConfirmClose(true)}
        onDelete={() => setConfirmDelete(true)}
      />

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Cerrar puesto"
        confirmLabel="Cerrar puesto"
        loading={closing}
        onConfirm={doClose}
      >
        El formulario dejará de aceptar candidaturas y liberas un proceso de tu plan. Podrás reabrirlo cuando quieras.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar puesto"
        confirmLabel="Eliminar"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={doDelete}
      >
        Se eliminará «{campaign.title}»{all.length > 0 ? ` y sus ${all.length} ${all.length === 1 ? 'candidatura' : 'candidaturas'}` : ''}. Esta acción no se puede deshacer.
      </ConfirmDialog>

      {/* Barra de acción de selección (móvil): fija abajo, al alcance del pulgar. */}
      {selectMode && !loading && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pt-3 shadow-pop sm:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-[1240px] space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exitSelect}
                aria-label="Cancelar selección"
                className="-ml-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="size-5" aria-hidden />
              </button>
              <span className="text-sm font-semibold text-slate-900 num">{selected.size} seleccionados</span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="ml-auto text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                {allFilteredSelected ? 'Ninguno' : 'Todos'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0 [&>*>button]:w-full">
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
                onClick={() => setInterestDialogOpen(true)}
                disabled={selected.size === 0}
                className={`${BTN_PRIMARY} justify-center disabled:opacity-50`}
              >
                <MailCheck className="size-4 text-indigo-200" aria-hidden /> Interés
              </button>
              <button
                type="button"
                onClick={exportSelected}
                disabled={selected.size === 0}
                className={`${BTN_SECONDARY} justify-center disabled:opacity-50`}
              >
                <Download className="size-4 text-slate-400" aria-hidden /> Exportar
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
  const total = all.length
  return (
    // Lectura de instrumento: una sola superficie segmentada por hairlines, no 5
    // tarjetas sueltas. Cada segmento es un filtro por estado (toggle). Solo
    // escritorio: en móvil el filtro por estado vive en Filtros.
    <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card sm:grid sm:grid-cols-5 sm:divide-x sm:divide-slate-200">
      {counts.map(({ s, n }) => {
        const active = statusFilter.has(s)
        const m = STATUS_META[s]
        const pct = total > 0 ? Math.round((n / total) * 100) : 0
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            aria-pressed={active}
            title={`${m.label}: ${n} de ${total} (${pct}%). Filtrar.`}
            className={`group relative flex flex-col gap-1.5 px-4 py-3.5 text-left transition-colors duration-[var(--duration-control)] ${
              active ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${m.dot}`} aria-hidden />
              <span className="text-[12px] font-medium text-slate-600">{m.label}</span>
            </span>
            <span className="num text-2xl font-semibold leading-none tracking-[-0.01em] text-slate-900">{n}</span>
            {/* Proporción: hairline de fondo + tramo lleno del color del estado. */}
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <span className={`block h-full rounded-full ${m.dot} transition-[width] duration-[var(--duration-max)] ease-[var(--ease-out)]`} style={{ width: `${pct}%` }} />
            </span>
            {/* Acento de "filtro activo" en la base del segmento. */}
            {active && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-indigo-600" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

// --- Tabla -----------------------------------------------------------------
function SortHead({
  k,
  children,
  className = '',
  sort,
  onSort,
}: {
  k: SortKey
  children: string
  className?: string
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
}) {
  const active = sort.key === k
  const currentOrder = sort.dir === 'asc' ? 'ascendente' : 'descendente'
  const nextOrder = active && sort.dir === 'asc' ? 'descendente' : 'ascendente'

  return (
    <th
      scope="col"
      className={`overflow-hidden px-3 py-2.5 text-left ${className}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        aria-label={active
          ? `${children}: orden ${currentOrder}. Cambiar a ${nextOrder}`
          : `${children}: sin ordenar. Ordenar de forma ascendente`}
        className={`group inline-flex w-full min-w-0 items-center gap-1 rounded-sm text-[11px] font-semibold uppercase tracking-wider transition-colors duration-[var(--duration-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 motion-reduce:transition-none ${
          active ? 'text-slate-700' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <span className="truncate">{children}</span>
        <span className="relative grid size-3 shrink-0 place-items-center" aria-hidden>
          <motion.span
            initial={false}
            animate={{ opacity: active ? 0 : 1, scale: active ? 0.82 : 1 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 grid place-items-center text-slate-300 transition-colors duration-[var(--duration-control)] group-hover:text-slate-500 motion-reduce:transition-none"
          >
            <ArrowUpDown className="size-3" />
          </motion.span>
          <motion.span
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              rotate: active && sort.dir === 'desc' ? 180 : 0,
              scale: active ? 1 : 0.82,
            }}
            transition={{
              opacity: { duration: 0.1 },
              rotate: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
            }}
            className="absolute inset-0 grid place-items-center text-indigo-500"
          >
            <ArrowUp className="size-3" />
          </motion.span>
        </span>
      </button>
    </th>
  )
}

/**
 * Celda "Encaje": lo que Meridian ve en esta candidatura, EN PALABRAS. La nota cruda
 * (0-100) no se pinta nunca en la lista: poner un número al lado de una persona la
 * convierte en un ranking. El matiz lo da el anillo del avatar, en la celda de al
 * lado. Sin analizar no se rellena con nada: una raya, como el teléfono que falta.
 */
function FitCell({ candidate }: { candidate: Candidate }) {
  const fit = candidateFit(candidate.ai)
  if (fit == null) {
    return (
      <span className="text-slate-600">
        <span aria-hidden>–</span>
        <span className="sr-only">Sin analizar</span>
      </span>
    )
  }
  return (
    <span className="block truncate" title={`Ajuste ${Math.round(fit)} sobre 100`}>
      <FitLabel fit={fit} />
    </span>
  )
}

function CandidateTable({
  campaign,
  showFit,
  rows,
  justArrived,
  tags,
  sort,
  onSort,
  selected,
  setSelected,
  onOpen,
  maskPhone,
  selectMode,
  onEnterSelect,
  lockedDates,
  onLockedClick,
}: {
  campaign: Campaign
  /** Solo hay columna Encaje si el plan tiene Meridian: sin él nunca habría nada que poner. */
  showFit: boolean
  rows: Candidate[]
  justArrived: Set<string>
  lockedDates: string[]
  onLockedClick: () => void
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
  const { setStatus, commentCounts } = useStore()
  // La columna Etiquetas solo existe cuando la empresa tiene vocabulario: sin una sola
  // etiqueta creada sería una columna de rayas que no explica nada. Aparece sola al
  // crear la primera, igual que su filtro.
  const showTags = TAGS_ENABLED && tags.length > 0

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
  // Orden de aparición entre las filas recién llegadas: si entran varias a la
  // vez, se escalonan (como en el mockup del hero) en vez de aparecer todas de
  // golpe. Tope a 4 para no alargar la espera si llega una tanda grande.
  const arrivalOrder = useMemo(() => {
    const order = new Map<string, number>()
    let i = 0
    for (const r of rows) if (justArrived.has(r.id)) order.set(r.id, i++)
    return order
  }, [rows, justArrived])

  // CTA de las filas bloqueadas (escritorio): un ÚNICO botón centrado sobre el
/**
 * Señales de la fila: si está en favoritos y si hay conversación. Sin esto, el
 * filtro "Solo favoritos" ordenaba por algo que no se veía en ninguna parte, y
 * había que abrir candidato a candidato para saber dónde había hablado alguien.
 */
function RowSignals({ favorito, comments }: { favorito: boolean; comments: number }) {
  if (!favorito && !comments) return null
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {favorito && (
        <>
          <Star className="size-3.5 fill-current text-indigo-600" aria-hidden />
          <span className="sr-only">En favoritos.</span>
        </>
      )}
      {comments > 0 && (
        <span className="flex items-center gap-0.5 text-[12px] text-slate-500">
          <MessagesSquare className="size-3.5 text-slate-400" aria-hidden />
          <span className="num">{comments}</span>
          <span className="sr-only">{comments === 1 ? 'mensaje del equipo' : 'mensajes del equipo'}</span>
        </span>
      )}
    </span>
  )
}

  // bloque entero. No se puede anclar con position sobre un <tbody>/<tr>/<td>
  // (Safari no crea contenedor de posicionamiento sobre elementos de tabla: el
  // overlay se escaparía al viewport). Así que medimos el bloque de filas con JS
  // y colocamos el overlay dentro del <div> que envuelve la tabla, que sí es un
  // contenedor fiable en todos los navegadores.
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const tableHeadRef = useRef<HTMLTableSectionElement>(null)
  const lockedBodyRef = useRef<HTMLTableSectionElement>(null)
  const [lockedBox, setLockedBox] = useState<{ top: number; height: number } | null>(null)
  const [headerCanStick, setHeaderCanStick] = useState(false)
  const [headerStuck, setHeaderStuck] = useState(false)

  // Si la tabla cabe, liberamos su overflow horizontal para que el sticky se
  // ancle al scroll principal. Cuando no cabe, conservamos el scroll horizontal
  // local y evitamos introducir un segundo desplazamiento vertical.
  useLayoutEffect(() => {
    const wrap = tableWrapRef.current
    const table = tableRef.current
    if (!wrap || !table) return
    const measure = () => {
      const fits = table.scrollWidth <= wrap.clientWidth + 1
      setHeaderCanStick((current) => current === fits ? current : fits)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    ro.observe(table)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [showFit, showTags])

  useEffect(() => {
    const wrap = tableWrapRef.current
    const head = tableHeadRef.current
    const scroller = wrap?.closest('main')
    if (!headerCanStick || !wrap || !head || !scroller) {
      setHeaderStuck(false)
      return
    }
    const measure = () => {
      const sr = scroller.getBoundingClientRect()
      const wr = wrap.getBoundingClientRect()
      const hr = head.getBoundingClientRect()
      const stuck = wr.top <= sr.top && wr.bottom > sr.top + hr.height
      setHeaderStuck((current) => current === stuck ? current : stuck)
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [headerCanStick])

  useLayoutEffect(() => {
    if (lockedDates.length === 0) {
      setLockedBox(null)
      return
    }
    const measure = () => {
      const wrap = tableWrapRef.current
      const body = lockedBodyRef.current
      if (!wrap || !body) return
      const wr = wrap.getBoundingClientRect()
      const br = body.getBoundingClientRect()
      setLockedBox({ top: br.top - wr.top + wrap.scrollTop, height: br.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (tableWrapRef.current) ro.observe(tableWrapRef.current)
    if (lockedBodyRef.current) ro.observe(lockedBodyRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [lockedDates.length, showFit, showTags])

  const allSel = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSel = rows.some((r) => selected.has(r.id))

  const toggleAll = () => {
    setSelected(allSel ? new Set() : new Set(rows.map((r) => r.id)))
  }
  const toggleOne = (id: string) => {
    const n = new Set(selected)
    n.has(id) ? n.delete(id) : n.add(id)
    setSelected(n)
  }

  return (
    <>
      {/* --- Vista móvil: tarjetas (< md) --- */}
      <ul className="divide-y divide-slate-100 md:hidden" aria-label={`Candidatos de ${campaign.title}`}>
        {/* Bloqueados (móvil): ARRIBA, como las candidaturas nuevas (son las más
            recientes). Contenido señuelo REAL (mismo texto que el Excel: "Candidatura
            bloqueada" / "Bloqueada"), difuminado entero para que no se lea nada, con
            el CTA nítido encima: es la única pieza legible y accionable de la fila. */}
        {lockedDates.map((date, i) => (
          <li key={`locked-${i}`} className="relative overflow-hidden bg-slate-50/70 px-4 py-3">
            <div aria-hidden className="flex items-center gap-3 blur-[4px] select-none">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-200 text-[12.5px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-300">
                CB
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[14px] font-medium text-slate-700">Candidatura bloqueada</p>
                <p className="truncate text-[13px] text-slate-500">612 345 678</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300">
                <span className="size-1.5 rounded-full bg-slate-400" /> Bloqueada
              </span>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <button type="button" onClick={onLockedClick} className={`${BTN_PRIMARY_SM} pointer-events-auto`}>
                <Lock className="size-3.5" aria-hidden /> Mejorar plan
              </button>
            </div>
            <time dateTime={date} className="num absolute right-3 top-2 text-[11px] text-slate-400">{relativeDate(date)}</time>
          </li>
        ))}
        {rows.map((c) => {
          const name = candidateName(c) || 'Sin nombre'
          const phone = answerStr(c, 'telefono')
          const m = STATUS_META[c.status]
          const fresh = isFreshNuevo(c)
          const sel = selected.has(c.id)
          const arrivedAt = arrivalOrder.get(c.id)
          const statusChipClass = `${m.chip} inline-flex items-center gap-1 rounded-full ring-1 ring-inset ${
            fresh
              ? 'gap-1.5 px-2.5 py-1 text-[13px] font-bold ring-2 ring-slate-400'
              : 'gap-1 px-2 py-0.5 text-[12px] font-semibold'
          }`
          const statusDotClass = `${fresh ? 'size-2' : 'size-1.5'} rounded-full ${m.dot}`
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
              style={arrivedAt !== undefined
                ? { animation: `drop-in 240ms var(--ease-out) ${Math.min(arrivedAt, 4) * 45}ms both` }
                : undefined}
              className={`px-4 py-3 transition-colors ${selectMode && sel ? 'bg-indigo-50/70' : fresh ? 'bg-slate-50/80' : ''}`}
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
                  <MeridianAvatar name={name} fit={c.ai && !c.ai.error ? c.ai.fit : undefined} size={40} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[15px] font-medium text-slate-900">
                    <span className="truncate">{name}</span>
                    {c.source === 'prueba' && <TestChip />}
                    <InterestOutcomeIcon campaign={campaign} candidate={c} />
                    <RowSignals favorito={c.favorito} comments={commentCounts[c.id] ?? 0} />
                  </p>
                  {phone && (
                    <p className="num mt-0.5 truncate text-sm text-slate-500">
                      {maskPhone ? <MaskedPhone value={formatPhone(phone)} /> : formatPhone(phone)}
                    </p>
                  )}
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {selectMode ? (
                  <span className={statusChipClass}>
                    <span className={statusDotClass} aria-hidden />
                    {m.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatusFor(c)}
                    aria-label={`Estado: ${m.label}${fresh ? ', recién llegado' : ''}. Tocar para cambiar`}
                    className={`${statusChipClass} pr-1.5 transition-[filter] active:brightness-95`}
                  >
                    <span className={statusDotClass} aria-hidden />
                    {m.label}
                    <ChevronDown className="size-3 opacity-60" aria-hidden />
                  </button>
                )}
                <time
                  dateTime={c.submittedAt}
                  className={`num text-[11px] ${fresh ? 'font-semibold text-slate-700' : 'text-slate-500'}`}
                >
                  {relativeDate(c.submittedAt)}
                </time>
              </div>
             </div>
             {/* Sin etiquetas en la tarjeta: en móvil la fila tiene que leerse de
                 un vistazo (quién, teléfono, estado, cuándo) y una segunda línea
                 de chips la hacía crecer y competir con eso. Se ven al abrir la
                 ficha, y en la tabla de escritorio, donde sí hay sitio. */}
            </li>
          )
        })}
      </ul>

      {/* --- Vista escritorio: tabla (md+) --- */}
      <div ref={tableWrapRef} className={`relative hidden md:block ${headerCanStick ? 'overflow-visible' : 'overflow-x-auto'}`}>
      <table ref={tableRef} className="w-full min-w-[824px] table-fixed border-collapse">
        <caption className="sr-only">Candidatos de {campaign.title}</caption>
        <thead
          ref={tableHeadRef}
          className={`${headerCanStick ? 'sticky top-0 z-20' : ''} border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${
            headerStuck
              ? 'border-slate-200/80 bg-white/82 shadow-sticky backdrop-blur-md backdrop-saturate-125'
              : 'border-transparent bg-transparent shadow-none backdrop-blur-0 backdrop-saturate-100'
          }`}
        >
          <tr className={`border-b transition-[background-color,border-color] duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${
            headerStuck ? 'border-transparent bg-transparent' : 'border-slate-200 bg-slate-50/60'
          }`}>
            <th scope="col" className="w-10 px-0 py-2.5 text-center align-middle leading-none">
              <Checkbox
                className="translate-y-[1.5px]"
                checked={allSel}
                indeterminate={someSel && !allSel}
                onChange={toggleAll}
                aria-label="Seleccionar todos"
              />
            </th>
            <SortHead k="nombre" sort={sort} onSort={onSort} className="w-[248px]">Candidato</SortHead>
            {showFit && <SortHead k="encaje" sort={sort} onSort={onSort} className="w-[136px]">Encaje</SortHead>}
            {showTags && (
              <th scope="col" className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 xl:table-cell">
                Etiquetas
              </th>
            )}
            <th scope="col" className="w-[136px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Teléfono
            </th>
            <SortHead k="estado" sort={sort} onSort={onSort} className="w-[168px]">Estado</SortHead>
            <SortHead k="fecha" sort={sort} onSort={onSort} className="w-[96px] text-right">Recibida</SortHead>
          </tr>
        </thead>
        {/* Bloqueados (escritorio): ARRIBA, como las candidaturas nuevas (son las
            más recientes). Cada fila usa las MISMAS celdas y anchos que una real (el
            table-fixed las alinea igual bajo cada cabecera) con contenido señuelo
            difuminado (mismo texto que el Excel: "Candidatura bloqueada" / "Bloqueada").
            El CTA NO va aquí: es un overlay medido (ver lockedBox) posicionado sobre
            el <div> envoltorio, no sobre la tabla, para funcionar también en Safari. */}
        {lockedDates.length > 0 && (
          <tbody ref={lockedBodyRef}>
            {lockedDates.map((date, i) => (
              <tr key={`locked-${i}`} className="h-16 border-b border-slate-100 bg-slate-50/70 last:border-0">
                <td className="px-0 py-3 text-center align-middle leading-none">
                  <div aria-hidden className="size-4 rounded-[5px] border border-slate-300 bg-white blur-[4px] select-none" />
                </td>
                <td className="px-3 py-3">
                  <span aria-hidden className="block truncate text-[14px] font-medium text-slate-700 blur-[4px] select-none">Candidatura bloqueada</span>
                </td>
                {showFit && (
                  <td className="px-3 py-3">
                    <span aria-hidden className="block truncate text-[13px] text-slate-600 blur-[4px] select-none">Puede encajar</span>
                  </td>
                )}
                {showTags && (
                  <td className="hidden px-3 py-3 xl:table-cell">
                    <span aria-hidden className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 blur-[4px] select-none">Etiqueta</span>
                  </td>
                )}
                <td className="px-3 py-3">
                  <span aria-hidden className="num block truncate text-[13px] text-slate-600 blur-[4px] select-none">612 345 678</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span aria-hidden className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 blur-[4px] select-none">
                    <span className="size-1.5 rounded-full bg-slate-400" /> Bloqueada
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <time dateTime={date} aria-hidden className="num text-[13px] text-slate-500 blur-[4px] select-none">{relativeDate(date)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        )}
        <tbody>
          {rows.map((c) => {
            const sel = selected.has(c.id)
            const name = candidateName(c) || 'Sin nombre'
            const arrivedAt = arrivalOrder.get(c.id)
            const hasTags = c.tagIds.some((id) => tags.some((tag) => tag.id === id))
            return (
              <tr
                key={c.id}
                style={arrivedAt !== undefined
                  ? { animation: `drop-in 240ms var(--ease-out) ${Math.min(arrivedAt, 4) * 45}ms both` }
                  : undefined}
                onClick={(e) => clickDeFila(e) && onOpen(c.id)}
                className={`group h-16 cursor-pointer border-b border-slate-100 transition-colors duration-[var(--duration-control)] last:border-0 ${
                  sel ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                }`}
              >
                {/* La ÚNICA celda que no abre la ficha, y a propósito: es la zona de
                    puntería de su checkbox, no un hueco de la fila (ver lib/fila.ts). */}
                <td className="relative px-0 py-3 text-center align-middle leading-none" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    className="translate-y-[1.5px]"
                    checked={sel}
                    onChange={() => toggleOne(c.id)}
                    aria-label={`Seleccionar ${name}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <MeridianAvatar name={name} fit={c.ai && !c.ai.error ? c.ai.fit : undefined} size={34} />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpen(c.id)}
                        className="block min-w-0 truncate text-left text-[14px] font-medium text-slate-900 hover:underline focus-visible:underline"
                        title={name}
                      >
                        {name}
                      </button>
                      {c.source === 'prueba' && <TestChip />}
                      <InterestOutcomeIcon campaign={campaign} candidate={c} />
                      <RowSignals favorito={c.favorito} comments={commentCounts[c.id] ?? 0} />
                    </div>
                  </div>
                </td>
                {showFit && (
                  <td className="px-3 py-3 text-[13px]">
                    <FitCell candidate={c} />
                  </td>
                )}
                {showTags && (
                  <td className="hidden px-3 py-3 xl:table-cell">
                    {hasTags ? <TagCell tagIds={c.tagIds} tags={tags} singleLine /> : <span className="text-[13px] text-slate-600">–</span>}
                  </td>
                )}
                <td className="px-3 py-3 text-[13px] text-slate-600">
                  <span className="num block truncate">
                    {maskPhone && answerStr(c, 'telefono')
                      ? <MaskedPhone value={formatPhone(answerStr(c, 'telefono'))} />
                      : (formatPhone(answerStr(c, 'telefono')) || '–')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <StatusSelect status={c.status} onChange={(s) => setStatus(c.id, s)} uniform />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] text-slate-500">
                  <time dateTime={c.submittedAt} className="num">{relativeDate(c.submittedAt)}</time>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {/* CTA ÚNICO del bloque bloqueado, centrado sobre TODAS las filas bloqueadas.
          Vive fuera de la tabla (dentro del <div> envoltorio, contenedor fiable en
          todos los navegadores) y su posición/alto se miden desde el <tbody>. */}
      {lockedBox && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center"
          style={{ top: lockedBox.top, height: lockedBox.height }}
        >
          <button type="button" onClick={onLockedClick} className={`${BTN_PRIMARY_SM} pointer-events-auto shadow-pop`}>
            <Lock className="size-3.5" aria-hidden /> Mejorar plan
          </button>
        </div>
      )}
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

function FilterPanelHeader({
  count,
  onClear,
  variant,
}: {
  count: number
  onClear: () => void
  variant: 'dropdown' | 'sheet'
}) {
  const activeText = count === 1 ? '1 activo' : count > 1 ? `${count} activos` : null
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
      <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
        {variant === 'dropdown' ? (
          'Filtros'
        ) : activeText ? (
          <span className="num font-medium text-slate-600">{activeText}</span>
        ) : (
          <span className="font-normal text-slate-500">Sin filtros activos</span>
        )}
      </p>
      <button
        type="button"
        onClick={onClear}
        disabled={count === 0}
        className="shrink-0 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
      >
        Limpiar
      </button>
    </div>
  )
}

function FilterMenu({
  campaign,
  statusFilter,
  setStatusFilter,
  interestFilter,
  setInterestFilter,
  valueFilters,
  setValueFilters,
  numberFilters,
  setNumberFilters,
  numberDomains,
  favoritosOnly,
  setFavoritosOnly,
  tags,
  tagFilter,
  setTagFilter,
  count,
}: {
  campaign: Campaign
  statusFilter: Set<CandidateStatus>
  setStatusFilter: React.Dispatch<React.SetStateAction<Set<CandidateStatus>>>
  interestFilter: Set<CandidateInterestState>
  setInterestFilter: React.Dispatch<React.SetStateAction<Set<CandidateInterestState>>>
  valueFilters: { fieldId: string; label: string; value: string }[]
  setValueFilters: React.Dispatch<React.SetStateAction<{ fieldId: string; label: string; value: string }[]>>
  numberFilters: NumberFilter[]
  setNumberFilters: React.Dispatch<React.SetStateAction<NumberFilter[]>>
  numberDomains: Record<string, [number, number]>
  favoritosOnly: boolean
  setFavoritosOnly: React.Dispatch<React.SetStateAction<boolean>>
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
    setInterestFilter(new Set())
    setValueFilters([])
    setNumberFilters([])
    setFavoritosOnly(false)
    setTagFilter(new Set())
  }

  // Controles compartidos por el desplegable de escritorio y la hoja inferior de
  // móvil. Las filas son cómodas al tacto (≥44px) en móvil y compactas en sm+.
  const rowClass =
    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2.5 text-[15px] text-slate-700 hover:bg-slate-50 sm:gap-2 sm:px-1.5 sm:py-1 sm:text-sm'
  const controls = (
    <>
      {/* Favoritos primero: es el filtro de una línea que más se usa ("enséñame
          a los que quiero"), y antes vivía al final del panel como cinco
          estrellas, que era el widget más grande para la decisión más simple. */}
      <label className={`${rowClass} mb-4 sm:mb-3`}>
        <Checkbox checked={favoritosOnly} onChange={() => setFavoritosOnly((v) => !v)} />
        <Star className="size-4 shrink-0 text-slate-400" aria-hidden />
        Solo favoritos
      </label>

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Estado</p>
      <div className="mb-4 space-y-0.5 sm:mb-3">
        {STATUS_ORDER.map((s) => (
          <label key={s} className={rowClass}>
            <Checkbox
              checked={statusFilter.has(s)}
              onChange={() =>
                setStatusFilter((p) => {
                  const n = new Set(p)
                  n.has(s) ? n.delete(s) : n.add(s)
                  return n
                })
              }
            />
            <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
            {STATUS_META[s].label}
          </label>
        ))}
      </div>

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Interés</p>
      <div className="mb-4 space-y-0.5 sm:mb-3">
        {(['interested', 'not_interested', 'sent', 'no_response', 'never', 'unavailable'] as CandidateInterestState[]).map((state) => (
          <label key={state} className={rowClass}>
            <Checkbox
              checked={interestFilter.has(state)}
              onChange={() => setInterestFilter((previous) => {
                const next = new Set(previous)
                next.has(state) ? next.delete(state) : next.add(state)
                return next
              })}
            />
            {INTEREST_STATE_LABEL[state]}
          </label>
        ))}
      </div>

      {/* Etiquetas: justo debajo de Estado (ambos son clasificación del empresario).
          Si la empresa aún no tiene etiquetas, el grupo se oculta (sin ruido). */}
      {TAGS_ENABLED && tags.length > 0 && (
        <div className="mb-4 sm:mb-3">
          <p id="flt-tags" className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Etiquetas</p>
          <div role="group" aria-labelledby="flt-tags" className="space-y-0.5">
            {tags.map((t) => (
              <label key={t.id} className={rowClass}>
                <Checkbox
                  checked={tagFilter.has(t.id)}
                  onChange={() => toggleTag(t.id)}
                />
                <span className="min-w-0 truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {filterableFields(campaign).map((f) => (
        <div key={f.id} className="mb-4 sm:mb-3">
          <p id={`flt-${f.id}`} className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{f.label}</p>
          <div role="group" aria-labelledby={`flt-${f.id}`} className="space-y-0.5">
            {(f.type === 'boolean' ? ['Sí', 'No'] : f.options ?? []).map((opt) => (
              <label key={opt} className={rowClass}>
                <Checkbox
                  checked={hasValue(f.id, opt)}
                  onChange={() => toggleValue(f, opt)}
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{f.label}</p>
              <span className="text-[12px] font-medium num text-slate-600">{from} – {to}</span>
            </div>
            <RangeSlider min={lo} max={hi} from={from} to={to} onChange={(nFrom, nTo) => setRange(f, lo, hi, nFrom, nTo)} />
          </div>
        )
      })}

    </>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${BTN_SECONDARY} relative`}
      >
        <Filter className="size-4 text-slate-400" aria-hidden /> Filtros
        {/* Badge en la esquina: absoluto, no altera el ancho del botón. */}
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white num ring-2 ring-white">
            {count}
          </span>
        )}
      </button>

      {/* Escritorio: desplegable anclado al botón */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 hidden max-h-[60vh] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop sm:flex">
          <FilterPanelHeader count={count} onClear={clearAll} variant="dropdown" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">{controls}</div>
        </div>
      )}

      {/* Móvil: hoja inferior */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        footer={
          <div className="border-t border-slate-200 px-4 py-3">
            <button onClick={() => setOpen(false)} className={`${BTN_PRIMARY} w-full`}>
              Ver resultados
            </button>
          </div>
        }
      >
        <div className="sticky top-0 z-10">
          <FilterPanelHeader count={count} onClear={clearAll} variant="sheet" />
        </div>
        <div className="px-4 pb-3 pt-3">{controls}</div>
      </BottomSheet>
    </div>
  )
}

function SettingsExportButton({
  count,
  total,
  onExport,
}: {
  count: number
  total: number
  onExport: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const filtered = count !== total
  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onExport()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={count === 0 || busy}
      className={`${BTN_SECONDARY} w-full disabled:opacity-60`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden />
      ) : (
        <Download className="size-4 text-slate-400" aria-hidden />
      )}
      {busy
        ? 'Generando Excel…'
        : count === 0
          ? 'No hay candidatos para exportar'
          : `Exportar ${miles(count)} ${filtered ? 'filtrados' : count === 1 ? 'candidato' : 'candidatos'} a Excel`}
    </button>
  )
}

// --- Estados ----------------------------------------------------------------
function SkeletonRows({ showFit }: { showFit: boolean }) {
  // Replica la rejilla real de la fila (checkbox · nombre, y a la derecha
  // encaje/etiquetas/teléfono/estado/fecha) para que el paso a datos no salte.
  return (
    <div role="status" aria-label="Cargando candidatos">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-16 items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0">
          <div className="size-4 shrink-0 rounded skeleton" />
          <div className="h-3.5 w-40 rounded skeleton" />
          <div className="ml-auto hidden items-center gap-8 md:flex">
            {showFit && <div className="h-3 w-20 rounded skeleton" />}
            <div className="hidden h-3 w-24 rounded skeleton xl:block" />
            <div className="h-3 w-24 rounded skeleton" />
            <div className="h-6 w-[124px] rounded-full skeleton" />
            <div className="h-3 w-16 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Chip neutro para la candidatura de prueba del onboarding (source 'prueba').
// Gris siempre: no es un estado, solo un origen; se borra cuando ya no hace falta.
function TestChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
      Prueba
    </span>
  )
}

function ShareMenu({
  campaignId,
  title,
  url,
  urlDisplay,
  template,
  canEdit,
  demo,
}: {
  campaignId: string
  title: string
  url: string
  urlDisplay: string
  template?: string | null
  canEdit: boolean
  demo: boolean
}) {
  const { updateCampaign } = useStore()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches)

  const close = () => {
    setOpen(false)
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener('resize', place)
    // El main scrollea: hay que reposicionar o el panel se queda huérfano.
    const main = document.getElementById('contenido')
    main?.addEventListener('scroll', place, { passive: true })
    return () => {
      window.removeEventListener('resize', place)
      main?.removeEventListener('scroll', place)
    }
  }, [open])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!open) return
    // pointerdown (no click): al pulsar Editar el botón se desmonta en el mismo
    // evento y contains(target) falla con nodos ya desconectados. composedPath
    // conserva el panel aunque React reemplace el botón. El blur del textarea
    // ocurre antes y guarda la plantilla.
    const onDoc = (e: PointerEvent) => {
      const path = e.composedPath()
      if (path.includes(ref.current!) || path.includes(panelRef.current!)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${BTN_SECONDARY} max-sm:size-11 max-sm:px-0 ${
          open ? 'bg-slate-50 ring-slate-300' : ''
        }`}
        title="Compartir"
        aria-label="Compartir"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Share2 className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="max-sm:hidden">Compartir</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-[var(--duration-control)] max-sm:hidden ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {/* Escritorio: fixed para no recortar con overflow del main. */}
      <AnimatePresence>
        {open && pos && !isMobile && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Compartir puesto"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 hidden w-[min(100vw-1.5rem,25rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-pop sm:block"
          >
            <ShareReply
              title={title}
              url={url}
              urlDisplay={urlDisplay}
              demo={demo}
              variant="popover"
              template={template}
              onSaveReply={
                canEdit
                  ? (reply) => updateCampaign(campaignId, { shareReply: reply })
                  : undefined
              }
              onClose={close}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Móvil: hoja inferior (mismo patrón que Filtros) */}
      {isMobile && (
        <BottomSheet open={open} onClose={close} title="Compartir">
          <ShareReply
            title={title}
            url={url}
            urlDisplay={urlDisplay}
            demo={demo}
            variant="sheet"
            template={template}
            onSaveReply={
              canEdit
                ? (reply) => updateCampaign(campaignId, { shareReply: reply })
                : undefined
            }
          />
        </BottomSheet>
      )}
    </div>
  )
}

function EmptyFirstUse({ publicUrl, onCopy }: { publicUrl: string; onCopy: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
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
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">{publicUrl}</span>
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
      <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
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
              className="mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 opacity-100 transition-opacity hover:bg-slate-200 hover:text-slate-700 focus-visible:opacity-100 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100"
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
              <p className="px-2.5 pb-1 pt-0.5 text-[11px] text-slate-500">Aplica un filtro o una búsqueda para poder guardarla.</p>
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
              <p className="mt-2 text-center text-[12px] text-slate-500">Aplica un filtro o una búsqueda para poder guardarla.</p>
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
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-pop">
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
          className="mt-1.5 h-9 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
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

// --- Ajustes del puesto (hoja con sede, marca, avisos y acciones del puesto) ---
function SettingSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span className={`block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  options: { value: string | null; label: string; leading?: ReactNode }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const labelId = useRef(`setting-select-${Math.random().toString(36).slice(2, 9)}`).current

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

  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <div ref={ref} className="relative">
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-control transition-shadow hover:bg-slate-50 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15"
      >
        {current.leading}
        <span className="min-w-0 flex-1 truncate">{current.label}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400 opacity-60" aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-50 mt-1 max-h-[min(240px,40vh)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop"
        >
          {options.map((opt) => {
            const sel = opt.value === value
            return (
              <li key={opt.value ?? '__none'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {opt.leading}
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {sel && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PuestoSettingsDialog({
  open,
  onClose,
  children,
  inert = false,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Hay otro diálogo encima: ni foco, ni Escape, ni cierre por telón. */
  inert?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // El foco vuelve a quien abrió los ajustes solo al cerrarlos. No depende de
  // `inert`: mientras hay un diálogo encima los ajustes siguen abiertos, y
  // devolver el foco aquí se lo robaría a ese diálogo.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // El foco entra al panel una sola vez, al abrir. Si se reenfocara también al
    // dejar de estar inerte, al cerrar el pop-up de encima le robaría el foco al
    // botón que lo abrió.
    const t = window.setTimeout(() => panelRef.current?.focus(), 50)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      opener?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open || inert) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, inert, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 hidden sm:grid place-items-center p-6"
          role="dialog"
          aria-modal={!inert}
          aria-hidden={inert || undefined}
          aria-labelledby="puesto-settings-title"
          inert={inert || undefined}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-pop outline-none"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="puesto-settings-title" className="text-lg font-semibold text-slate-900">
                Ajustes del puesto
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Sede del puesto. La sede no tiene pantalla propia: nace donde se usa, así que
// aquí se elige una existente o se crea una nueva y queda asignada de una vez.
// Renombrarla y borrarla va en el bloque "Por sede" de Vista general.
// Crear no es elegir: los campos vivían aquí dentro, empujando el resto de los
// ajustes hacia abajo y mezclando "lo que este puesto tiene" con "lo que estoy
// creando". Ahora el botón abre un pop-up (`CrearSedeDialog`) y esta fila solo
// elige.
function SedeSetting({
  campaign,
  sites,
  onSetSite,
  onCrear,
}: {
  campaign: Campaign
  sites: Site[]
  onSetSite: (siteId: string | null) => void
  onCrear: () => void
}) {
  // Sin ninguna sede creada, un selector con una sola opción ("Sin sede") no es
  // una elección: es ruido vendiendo un concepto que quizá no necesitas. Se queda
  // en una línea discreta, y solo al usarla aparece el campo de verdad.
  if (sites.length === 0)
    return (
      <button onClick={onCrear} className="inline-flex min-h-8 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:text-indigo-700">
        <Building2 className="size-3.5 text-slate-400" aria-hidden /> Agrupar por sede
      </button>
    )

  return (
    <div>
      <SettingSelect
        label="Sede"
        value={campaign.siteId}
        onChange={onSetSite}
        options={[
          {
            value: null,
            label: 'Sin sede',
            leading: <Building2 className="size-4 shrink-0 text-slate-400" aria-hidden />,
          },
          ...sites.map((s) => ({
            value: s.id,
            label: s.name,
            leading: <Building2 className="size-4 shrink-0 text-slate-400" aria-hidden />,
          })),
        ]}
      />
      <button onClick={onCrear} className="mt-2 inline-flex min-h-8 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg text-[13px] font-medium text-indigo-700 hover:text-indigo-800">
        <Plus className="size-3.5" aria-hidden /> Crear sede
      </button>
    </div>
  )
}

// Pop-up para crear la sede, encima de los ajustes del puesto (que quedan inertes
// mientras está abierto: ni Escape, ni foco, ni cierre por telón). Es una tarea
// corta y con nombre propio, así que se comporta como tal: título, dos campos,
// dos botones, y Enter crea desde cualquiera de los campos.
function CrearSedeDialog({
  open,
  onClose,
  onCrear,
}: {
  open: boolean
  onClose: () => void
  /** Devuelve true si se creó: solo entonces se cierra el pop-up. */
  onCrear: (input: { name: string; city: string }) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const panelRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => nameRef.current?.focus(), 60)
    return () => {
      window.clearTimeout(t)
      opener?.focus?.()
    }
  }, [open])

  const cerrar = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrar()
        return
      }
      if (e.key !== 'Tab') return
      const els = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? [],
      )
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      const active = document.activeElement
      if (!panelRef.current?.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, cerrar])

  const crear = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await onCrear({ name: name.trim(), city: city.trim() })
    setBusy(false)
    if (ok) onClose()
  }

  // Enter desde cualquiera de los dos campos crea la sede. Se hace explícito, con
  // preventDefault, en vez de dejarlo al envío implícito del navegador: mismo
  // camino en todos los navegadores y un solo envío.
  const onKeyDownForm = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
    e.preventDefault()
    void crear()
  }

  // En táctil el campo sube a 44px y a 16px de fuente (el mismo criterio que los
  // botones): por debajo de 16px, iOS hace zoom al enfocar.
  const input =
    'h-10 pointer-coarse:h-11 w-full rounded-xl border border-slate-300 px-3 text-sm pointer-coarse:text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="crear-sede-title">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            aria-hidden
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
            onClick={cerrar}
          />
          <motion.form
            ref={panelRef}
            onSubmit={(e) => {
              e.preventDefault()
              void crear()
            }}
            onKeyDown={onKeyDownForm}
            className="relative w-full max-w-[420px] rounded-xl bg-white p-5 shadow-pop outline-none"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0, 0, 0.2, 1] }}
          >
            <h2 id="crear-sede-title" className="text-lg font-semibold text-slate-900">
              Nueva sede
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Agrupa los puestos de un mismo local. Al crearla se asigna a este puesto.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-800">Nombre</span>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Valencia centro"
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-800">
                  Ciudad <span className="font-normal text-slate-500">(opcional)</span>
                </span>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Valencia" className={input} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cerrar} disabled={busy} className={`${BTN_SECONDARY} disabled:opacity-50`}>
                Cancelar
              </button>
              <button type="submit" disabled={busy || !name.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                {busy ? 'Creando…' : 'Crear sede'}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  )
}

function PuestoSettingsSheet({
  open,
  onClose,
  campaign,
  sites,
  brands,
  canManage,
  exportCount,
  exportTotal,
  onExport,
  onSetSite,
  onCreateSite,
  onSetBrand,
  onToggleNotify,
  onDuplicate,
  duplicating,
  onPauseResume,
  onReopen,
  onClosePuesto,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  campaign: Campaign
  sites: Site[]
  brands: Brand[]
  canManage: boolean
  exportCount: number
  exportTotal: number
  onExport: () => void | Promise<void>
  onSetSite: (siteId: string | null) => void
  onCreateSite: (input: { name: string; city: string }) => Promise<Site | null>
  onSetBrand: (brandId: string | null) => void
  onToggleNotify: () => void
  onDuplicate: () => void
  duplicating: boolean
  onPauseResume: () => void
  onReopen: () => void
  onClosePuesto: () => void
  onDelete: () => void
}) {
  const notify = campaign.notifyNew !== false
  const status = campaign.status
  const toast = useToast()
  // El pop-up de crear sede se monta UNA vez, fuera de la hoja y del diálogo (que
  // pintan el mismo `body` a la vez, cada uno para su ancho): dentro se montaría
  // dos veces y heredaría el `display:none` del que no toca.
  // El contador es la `key` del pop-up: cada apertura monta uno nuevo, así los
  // campos empiezan vacíos sin tener que vaciarlos a mano (y sin que se vean
  // borrarse mientras se cierra).
  const [crearSede, setCrearSede] = useState(false)
  const [crearSedeKey, setCrearSedeKey] = useState(0)
  const abrirCrearSede = () => {
    setCrearSedeKey((k) => k + 1)
    setCrearSede(true)
  }
  const crearSedeYAsignar = async (input: { name: string; city: string }) => {
    const site = await onCreateSite(input)
    if (!site) return false
    onSetSite(site.id)
    toast.success('Sede creada y asignada a este puesto')
    return true
  }
  const body = (
    <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
              {canManage && (
              <section className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Organización</p>
                <SedeSetting campaign={campaign} sites={sites} onSetSite={onSetSite} onCrear={abrirCrearSede} />
                {/* La marca solo se elige cuando hay más de una: con una sola no hay
                    decisión que tomar. Su nombre, logo y banner se editan en el
                    constructor del formulario, que es donde se ven. */}
                {brands.length > 1 && (
                  <SettingSelect
                    label="Marca"
                    value={campaign.brandId}
                    onChange={onSetBrand}
                    options={[
                      {
                        value: null,
                        label: 'Sin marca',
                        leading: <Tag className="size-4 shrink-0 text-slate-400" aria-hidden />,
                      },
                      ...brands.map((b) => ({
                        value: b.id,
                        label: b.name,
                        leading: <Tag className="size-4 shrink-0 text-slate-400" aria-hidden />,
                      })),
                    ]}
                  />
                )}
              </section>
              )}

              {canManage && (
              <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">Avisos por email</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">Te avisamos cuando entra un candidato nuevo en este puesto.</p>
                </div>
                <SettingSwitch checked={notify} onChange={onToggleNotify} label="Avisos por email" />
              </section>
              )}

              <section className="space-y-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Datos</p>
                <SettingsExportButton count={exportCount} total={exportTotal} onExport={onExport} />
              </section>

              {canManage && (
              <section className="space-y-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Acciones</p>
                <button onClick={onDuplicate} disabled={duplicating} className={`${BTN_SECONDARY} w-full disabled:opacity-60`}>
                  <Copy className="size-4 text-slate-400" aria-hidden />
                  {duplicating ? 'Duplicando…' : 'Duplicar puesto'}
                </button>
                {status !== 'cerrada' && (
                  <button onClick={onPauseResume} className={`${BTN_SECONDARY} w-full`}>
                    {status === 'activa' ? <Pause className="size-4 text-slate-400" aria-hidden /> : <Play className="size-4 text-slate-400" aria-hidden />}
                    {status === 'activa' ? 'Pausar puesto' : 'Reanudar puesto'}
                  </button>
                )}
                {status === 'cerrada' ? (
                  <button onClick={onReopen} className={`${BTN_SECONDARY} w-full`}>
                    <Play className="size-4 text-slate-400" aria-hidden />
                    Reabrir puesto
                  </button>
                ) : (
                  <button onClick={onClosePuesto} className={`${BTN_SECONDARY} w-full`}>
                    <Archive className="size-4 text-slate-400" aria-hidden />
                    Cerrar puesto
                  </button>
                )}
                <button onClick={onDelete} className={`${BTN_DANGER} w-full`}>
                  <Trash2 className="size-4" aria-hidden />
                  Eliminar puesto
                </button>
              </section>
              )}
    </div>
  )
  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Ajustes del puesto" inert={crearSede}>
        {body}
      </BottomSheet>
      <PuestoSettingsDialog open={open} onClose={onClose} inert={crearSede}>
        {body}
      </PuestoSettingsDialog>
      <CrearSedeDialog key={crearSedeKey} open={crearSede} onClose={() => setCrearSede(false)} onCrear={crearSedeYAsignar} />
    </>
  )
}

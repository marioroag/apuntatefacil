import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Brand, Branding, Campaign, Candidate, CandidateStatus, FormField, SavedView, SavedViewPayload, Site, Tag, TeamRequest, TeamRequestComment, TeamRequestStatus } from './types'
import { supabase, supabaseConfigured } from './supabase'
import { useAuth } from './auth'
import { useToast } from '../components/ui/Toast'
import { SEED, SEED_BRANDS, SEED_TAGS, SEED_TEAM_COMMENTS, SEED_TEAM_REQUESTS } from './seed'

// Normaliza un nombre de etiqueta como hace el servidor (trigger normalize_tag_name):
// quita espacios de los extremos y colapsa los interiores. La comparación de
// duplicados es además case-insensitive.
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

// --- Mapeo BD (snake_case) <-> app (camelCase) -----------------------------
type CampaignRow = {
  id: string
  slug: string
  title: string
  sector: string
  location: string
  status: Campaign['status']
  milanuncios_url: string | null
  fields: FormField[]
  branding: Branding
  site_id: string | null
  brand_id: string | null
  notify_new: boolean
  created_at: string
}
type CandidateRow = {
  id: string
  campaign_id: string
  answers: Candidate['answers']
  status: CandidateStatus
  source: Candidate['source']
  rating: number
  notes: string
  cv_path: string | null
  created_at: string
}

const toCampaign = (r: CampaignRow): Campaign => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  sector: r.sector,
  location: r.location,
  status: r.status,
  createdAt: r.created_at,
  milanunciosUrl: r.milanuncios_url ?? undefined,
  fields: r.fields ?? [],
  branding: r.branding,
  siteId: r.site_id ?? null,
  brandId: r.brand_id ?? null,
  notifyNew: r.notify_new ?? true,
})

type SiteRow = { id: string; name: string; city: string }
const toSite = (r: SiteRow): Site => ({ id: r.id, name: r.name, city: r.city ?? '' })

type BrandRow = { id: string; name: string; accent: string; welcome: string; thanks: string; show_logo: boolean; logo_path: string | null; banner_path: string | null }
const toBrand = (r: BrandRow): Brand => ({
  id: r.id,
  name: r.name,
  accent: r.accent,
  welcome: r.welcome ?? '',
  thanks: r.thanks ?? '',
  showLogo: r.show_logo,
  logoPath: r.logo_path ?? null,
  bannerPath: r.banner_path ?? null,
})
const toCandidate = (r: CandidateRow, tagIds: string[] = []): Candidate => ({
  id: r.id,
  campaignId: r.campaign_id,
  answers: r.answers ?? {},
  status: r.status,
  source: r.source,
  rating: r.rating,
  notes: r.notes ?? '',
  cvPath: r.cv_path ?? undefined,
  submittedAt: r.created_at,
  tagIds,
})

type TagRow = { id: string; name: string }
const toTag = (r: TagRow): Tag => ({ id: r.id, name: r.name })
type CandidateTagRow = { candidate_id: string; tag_id: string }
// Agrupa las filas de candidate_tags en un mapa candidato -> ids de etiqueta. Una
// sola consulta por lote (evita el N+1 de pedir las etiquetas candidato a candidato).
function tagsByCandidate(rows: CandidateTagRow[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const r of rows) m.set(r.candidate_id, [...(m.get(r.candidate_id) ?? []), r.tag_id])
  return m
}

type SavedViewRow = {
  id: string
  campaign_id: string | null
  name: string
  payload: SavedViewPayload
}
const toSavedView = (r: SavedViewRow): SavedView => ({
  id: r.id,
  campaignId: r.campaign_id,
  name: r.name,
  payload: r.payload,
})

type TeamRequestRow = {
  id: string
  title: string
  body: string
  status: TeamRequestStatus
  author_user_id: string | null
  author_email: string
  site_id: string | null
  created_at: string
  completed_by: string | null
  last_activity_at: string
  last_activity_by: string | null
  team_request_candidates: { candidate_id: string; comment_id: string | null; proposed_by: string | null }[]
  team_request_comments: { count: number }[]
}
const toTeamRequest = (r: TeamRequestRow): TeamRequest => ({
  id: r.id,
  title: r.title,
  body: r.body ?? '',
  status: r.status,
  authorUserId: r.author_user_id,
  authorEmail: r.author_email ?? '',
  siteId: r.site_id ?? null,
  createdAt: r.created_at,
  completedBy: r.completed_by,
  lastActivityAt: r.last_activity_at,
  lastActivityBy: r.last_activity_by,
  commentCount: r.team_request_comments?.[0]?.count ?? 0,
  proposals: (r.team_request_candidates ?? []).map((p) => ({
    candidateId: p.candidate_id,
    commentId: p.comment_id,
    proposedBy: p.proposed_by,
  })),
})
// Columnas de la cabecera + puente embebido + recuento de respuestas, en una consulta.
const TEAM_REQUEST_SELECT =
  '*, team_request_candidates(candidate_id,comment_id,proposed_by), team_request_comments(count)'

type TeamCommentRow = {
  id: string
  request_id: string
  author_user_id: string | null
  author_email: string
  body: string
  created_at: string
}
const toTeamComment = (r: TeamCommentRow): TeamRequestComment => ({
  id: r.id,
  requestId: r.request_id,
  authorUserId: r.author_user_id,
  authorEmail: r.author_email ?? '',
  body: r.body ?? '',
  createdAt: r.created_at,
})

export interface NewCampaignInput {
  title: string
  sector: string
  location: string
  fields: FormField[]
  branding: Branding
  milanunciosUrl?: string
}

interface Store {
  loading: boolean
  campaigns: Campaign[]
  candidates: Candidate[]
  // Bloqueados por puesto (cupo del plan gratuito superado). El comerciante no los
  // ve (RLS); esto es solo el recuento + las fechas de entrada, para el upsell.
  lockedInfo: Record<string, { count: number; dates: string[] }>
  getCampaign: (id: string) => Campaign | undefined
  candidatesFor: (campaignId: string) => Candidate[]
  newCountFor: (campaignId: string) => number
  // Candidatos llegados desde la última vez que se abrió el puesto (por dispositivo).
  newSinceFor: (campaignId: string) => number
  markSeen: (campaignId: string) => void
  reload: () => Promise<void>
  // Recarga solo los candidatos de un puesto (la carga global solo ocurre al
  // entrar en el panel; esto trae los que llegaron después, sin recargar la página).
  // Devuelve cuántos candidatos NUEVOS trajo (>= 0), o -1 si la recarga falló.
  reloadCandidatesFor: (campaignId: string) => Promise<number>
  // mutaciones
  setStatus: (candidateId: string, status: CandidateStatus) => Promise<void>
  setRating: (candidateId: string, rating: number) => Promise<void>
  setNotes: (candidateId: string, notes: string) => Promise<void>
  deleteCandidate: (candidateId: string) => Candidate | undefined
  restoreCandidate: (candidate: Candidate) => Promise<void>
  updateFields: (campaignId: string, fields: FormField[]) => Promise<boolean>
  updateBranding: (campaignId: string, branding: Partial<Branding>) => Promise<void>
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => Promise<boolean>
  createCampaign: (input: NewCampaignInput) => Promise<Campaign | null>
  // Crea un puesto nuevo copiando campos, apariencia y datos del original (enlace
  // propio, sin candidatos). Devuelve el puesto nuevo o null si falla.
  duplicateCampaign: (campaignId: string) => Promise<Campaign | null>
  deleteCampaign: (campaignId: string) => Promise<boolean>
  // Vistas guardadas (Pro/Multi)
  savedViews: SavedView[]
  createSavedView: (input: { name: string; campaignId: string | null; payload: SavedViewPayload }) => Promise<SavedView | null>
  deleteSavedView: (id: string) => Promise<void>
  // Sedes (Multi)
  sites: Site[]
  createSite: (input: { name: string; city: string }) => Promise<Site | null>
  renameSite: (id: string, patch: { name: string; city: string }) => Promise<boolean>
  deleteSite: (id: string) => Promise<boolean>
  // Marcas (Multi)
  brands: Brand[]
  createBrand: (input: Omit<Brand, 'id'>) => Promise<Brand | null>
  updateBrand: (id: string, patch: Partial<Omit<Brand, 'id'>>) => Promise<void>
  deleteBrand: (id: string) => Promise<void>
  // Etiquetas (todos los planes). El vocabulario es de empresa; aplicar/quitar
  // escribe la relación candidate_tags al instante (optimista, con rollback).
  tags: Tag[]
  // Nº de candidatos (visibles) que usan cada etiqueta. Para el modal de gestión.
  tagUsage: (tagId: string) => number
  // Crea una etiqueta nueva (owner/member). Si ya existe una igual (ignorando
  // mayúsculas/espacios) la reutiliza en vez de duplicar. Null si falla.
  createTag: (name: string) => Promise<Tag | null>
  renameTag: (id: string, name: string) => Promise<boolean>
  deleteTag: (id: string) => Promise<void>
  restoreTag: (tag: Tag, candidateIds: string[]) => Promise<void>
  applyTag: (candidateId: string, tagId: string) => Promise<void>
  removeTag: (candidateId: string, tagId: string) => Promise<void>
  // Acciones masivas (selección múltiple): aplica/quita una etiqueta a varios.
  applyTagToMany: (candidateIds: string[], tagId: string) => Promise<void>
  removeTagFromMany: (candidateIds: string[], tagId: string) => Promise<void>
  // Tablón de peticiones de equipo. Las cabeceras viven en memoria (ordenadas por
  // actividad); el hilo de cada petición se carga perezoso al abrir su detalle.
  teamRequests: TeamRequest[]
  // Sube con cada ping realtime del tablón: un detalle abierto lo usa para refrescar su hilo.
  boardVersion: number
  // Peticiones con actividad ajena desde la última visita al tablón (badge del menú).
  boardNewCount: number
  markBoardSeen: () => void
  loadTeamComments: (requestId: string) => Promise<TeamRequestComment[]>
  createTeamRequest: (input: { title: string; body: string; siteId: string | null }) => Promise<TeamRequest | null>
  // Responde a una petición, opcionalmente proponiendo candidatos. Devuelve la
  // respuesta creada (para pintarla al instante) o null si falló.
  addTeamComment: (requestId: string, body: string, candidateIds: string[]) => Promise<TeamRequestComment | null>
  setTeamRequestStatus: (id: string, status: TeamRequestStatus) => Promise<void>
  deleteTeamRequest: (id: string) => Promise<boolean>
  retractProposal: (requestId: string, candidateId: string) => Promise<void>
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

// --- Persistencia de la DEMO en localStorage --------------------------------
// La demo es 100% local; guardamos su estado para que aguante recargas.
const DEMO_KEY = 'apuntatefacil.demo.v3'

// "Visto por última vez" por puesto (mapa campaignId -> ISO), local al navegador.
const SEEN_KEY = 'apuntatefacil.seen.v1'
function readSeen(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

// "Visto por última vez" del tablón (mapa companyId -> ISO): el tablón es una
// superficie única por empresa, a diferencia del seen por puesto de arriba.
const BOARD_SEEN_KEY = 'apuntatefacil.board-seen.v1'
function readBoardSeen(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOARD_SEEN_KEY) ?? 'null')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function readDemoState(): { campaigns: Campaign[]; candidates: Candidate[]; savedViews: SavedView[]; sites: Site[]; brands: Brand[]; tags: Tag[]; teamRequests: TeamRequest[]; teamComments: TeamRequestComment[] } | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.campaigns) && Array.isArray(parsed?.candidates))
      return {
        campaigns: parsed.campaigns,
        // Demos guardadas antes de las etiquetas no traen tagIds: lo rellenamos.
        candidates: (parsed.candidates as Candidate[]).map((c) => ({ ...c, tagIds: c.tagIds ?? [] })),
        savedViews: Array.isArray(parsed.savedViews) ? parsed.savedViews : [],
        sites: Array.isArray(parsed.sites) ? parsed.sites : SEED.sites,
        brands: Array.isArray(parsed.brands) ? parsed.brands : SEED_BRANDS,
        tags: Array.isArray(parsed.tags) ? parsed.tags : SEED_TAGS,
        // Demos guardadas antes del tablón: datos de ejemplo.
        teamRequests: Array.isArray(parsed.teamRequests) ? parsed.teamRequests : SEED_TEAM_REQUESTS,
        teamComments: Array.isArray(parsed.teamComments) ? parsed.teamComments : SEED_TEAM_COMMENTS,
      }
  } catch {
    /* ignora storage corrupto */
  }
  return null
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { company, user } = useAuth()
  const toast = useToast()
  const companyId = company?.id
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(false)
  // Empresa cuyos datos hay AHORA en memoria. Si difiere de la empresa activa, estamos en
  // una transición (cambio de equipo): el panel debe verse cargando, no con los datos del
  // equipo anterior. Ver `dataLoading` más abajo.
  const [loadedCompanyId, setLoadedCompanyId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [lockedInfo, setLockedInfo] = useState<Record<string, { count: number; dates: string[] }>>({})
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen())
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([])
  // Hilos del tablón en DEMO (en real se cargan perezosos por petición, sin estado global).
  const [demoTeamComments, setDemoTeamComments] = useState<TeamRequestComment[]>([])
  const [boardSeen, setBoardSeen] = useState<Record<string, string>>(() => readBoardSeen())
  const [boardVersion, setBoardVersion] = useState(0)
  // Candidatos con una escritura optimista aún sin confirmar en el servidor. Un
  // refetch (reloadCandidatesFor) NO debe pisar su estado local con datos viejos
  // del servidor mientras la escritura está en vuelo.
  const pendingCandidateWrites = useRef<Set<string>>(new Set())
  // Secuencia de cargas: con cambios de equipo rápidos solo la última recarga escribe su
  // resultado (una respuesta vieja no debe pisar los datos del equipo recién elegido).
  const loadSeq = useRef(0)

  const reload = useCallback(async () => {
    // Toda invocación invalida cualquier carga en vuelo anterior, también las que terminan en un
    // early-return (logout -> companyId undefined, demo): así una respuesta tardía del equipo
    // anterior no resucita sus datos en memoria tras salir.
    const seq = ++loadSeq.current
    if (!companyId) {
      setCampaigns([])
      setCandidates([])
      setSavedViews([])
      setSites([])
      setBrands([])
      setTags([])
      setTeamRequests([])
      setDemoTeamComments([])
      setLoadedCompanyId(null)
      return
    }
    if (companyId === 'demo') {
      // Demo pública: persiste en localStorage; si no hay nada guardado, datos
      // de ejemplo. No toca Supabase.
      const saved = readDemoState()
      setCampaigns(saved?.campaigns ?? SEED.campaigns)
      setCandidates(saved?.candidates ?? SEED.candidates)
      setSavedViews(saved?.savedViews ?? [])
      setSites(saved?.sites ?? SEED.sites)
      setBrands(saved?.brands ?? SEED_BRANDS)
      setTags(saved?.tags ?? SEED_TAGS)
      setTeamRequests(saved?.teamRequests ?? SEED_TEAM_REQUESTS)
      setDemoTeamComments(saved?.teamComments ?? SEED_TEAM_COMMENTS)
      setLockedInfo({})
      setLoadedCompanyId('demo')
      setLoading(false)
      return
    }
    setLoading(true)
    // Acotamos a la empresa ACTIVA (company_id). La RLS sola no basta: para un usuario en
    // varios equipos devolvería datos de TODOS, sumándolos. Con esto ves solo el equipo activo.
    const [c1, c2, c3, c4, c5, c6, c7, c8, c9] = await Promise.all([
      supabase.from('campaigns').select('*').eq('company_id', companyId).order('created_at', { ascending: true }),
      supabase.from('candidates').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('saved_views').select('id,campaign_id,name,payload').eq('company_id', companyId).order('created_at', { ascending: true }),
      supabase.from('sites').select('id,name,city').eq('company_id', companyId).order('name', { ascending: true }),
      supabase.from('brands').select('id,name,accent,welcome,thanks,show_logo,logo_path,banner_path').eq('company_id', companyId).order('name', { ascending: true }),
      supabase.from('tags').select('id,name').eq('company_id', companyId).order('name', { ascending: true }),
      // Relación candidato-etiqueta en UNA consulta por lote (la RLS la acota a lo visible; las
      // filas de candidatos de otra empresa simplemente no casan con los cargados aquí).
      supabase.from('candidate_tags').select('candidate_id,tag_id'),
      // Bloqueados por puesto (la RLS los oculta; recuento + fechas por este RPC
      // security definer). Devuelve { campaignId: { count, dates } }.
      supabase.rpc('locked_candidates_preview'),
      // Tablón de equipo: cabeceras + candidatos propuestos + nº de respuestas.
      supabase.from('team_requests').select(TEAM_REQUEST_SELECT).eq('company_id', companyId).order('last_activity_at', { ascending: false }),
    ])
    if (seq !== loadSeq.current) return // un cambio de equipo más nuevo ya está cargando
    if (c1.error || c2.error) {
      toast.error('No pudimos cargar tus datos. Reintenta en unos segundos.')
      // Sin datos válidos de ESTA empresa: vaciamos para no revelar los del equipo anterior
      // bajo la identidad del nuevo (mismo resultado que una carga inicial fallida: panel vacío
      // + toast). Recuperable recargando o volviendo a entrar al equipo.
      setCampaigns([])
      setCandidates([])
    } else {
      const tagMap = !c7.error && c7.data ? tagsByCandidate(c7.data as CandidateTagRow[]) : new Map<string, string[]>()
      setCampaigns((c1.data as CampaignRow[]).map(toCampaign))
      setCandidates((c2.data as CandidateRow[]).map((r) => toCandidate(r, tagMap.get(r.id) ?? [])))
    }
    setLockedInfo(!c8.error && c8.data ? (c8.data as Record<string, { count: number; dates: string[] }>) : {})
    // Vistas, sedes, marcas y etiquetas son secundarias: si la tabla aún no existe o falla, no rompe el panel.
    setSavedViews(!c3.error && c3.data ? (c3.data as SavedViewRow[]).map(toSavedView) : [])
    setSites(!c4.error && c4.data ? (c4.data as SiteRow[]).map(toSite) : [])
    setBrands(!c5.error && c5.data ? (c5.data as BrandRow[]).map(toBrand) : [])
    setTags(!c6.error && c6.data ? (c6.data as TagRow[]).map(toTag) : [])
    setTeamRequests(!c9.error && c9.data ? (c9.data as TeamRequestRow[]).map(toTeamRequest) : [])
    setLoadedCompanyId(companyId)
    setLoading(false)
  }, [companyId, toast])

  useEffect(() => {
    reload()
  }, [reload])

  // Recarga solo el preview de candidatos bloqueados (recuento + fechas por
  // puesto), sin el reload() completo. Lo usa el canal realtime cuando el ping
  // llega con locked=true (plan trial con el cupo lleno).
  const refreshLockedInfo = useCallback(async () => {
    if (!companyId || companyId === 'demo') return
    const { data, error } = await supabase.rpc('locked_candidates_preview')
    if (!error && data) setLockedInfo(data as Record<string, { count: number; dates: string[] }>)
  }, [companyId])

  const reloadCandidatesFor = useCallback(async (campaignId: string): Promise<number> => {
    if (!companyId || companyId === 'demo') return 0 // demo: datos en memoria, nada nuevo de red
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
    if (error || !data) return -1
    const rows = data as CandidateRow[]
    // Etiquetas de estos candidatos, en una sola consulta por lote.
    const { data: ctData } = await supabase
      .from('candidate_tags')
      .select('candidate_id,tag_id')
      .in('candidate_id', rows.map((r) => r.id))
    const tagMap = tagsByCandidate((ctData as CandidateTagRow[]) ?? [])
    const fetched = rows.map((r) => toCandidate(r, tagMap.get(r.id) ?? []))
    // Cuántos vienen que no teníamos ya en local (para avisar "N nuevos").
    const knownIds = new Set(candidates.filter((c) => c.campaignId === campaignId).map((c) => c.id))
    const added = fetched.filter((f) => !knownIds.has(f.id)).length
    // Reemplaza los de este puesto por el estado fresco del servidor; deja el
    // resto. Para los candidatos con una edición optimista en vuelo, conserva el
    // estado local (el servidor aún no lo refleja y lo pisaría con datos viejos).
    setCandidates((prev) => {
      const localById = new Map(prev.map((c) => [c.id, c]))
      const merged = fetched.map((f) =>
        pendingCandidateWrites.current.has(f.id) ? localById.get(f.id) ?? f : f,
      )
      return [...prev.filter((c) => c.campaignId !== campaignId), ...merged]
    })
    return added
  }, [companyId, candidates])

  // Recarga solo las cabeceras del tablón (tras un ping realtime de otro miembro).
  const reloadTeamBoard = useCallback(async () => {
    if (!companyId || companyId === 'demo') return
    const { data, error } = await supabase
      .from('team_requests')
      .select(TEAM_REQUEST_SELECT)
      .eq('company_id', companyId)
      .order('last_activity_at', { ascending: false })
    if (!error && data) setTeamRequests((data as TeamRequestRow[]).map(toTeamRequest))
  }, [companyId])

  // Los handlers del canal realtime viven fuera del ciclo de render: consumen
  // las recargas vía ref para no resuscribir el websocket en cada cambio de estado.
  const reloadCandidatesRef = useRef(reloadCandidatesFor)
  reloadCandidatesRef.current = reloadCandidatesFor
  const refreshLockedRef = useRef(refreshLockedInfo)
  refreshLockedRef.current = refreshLockedInfo
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const reloadTeamBoardRef = useRef(reloadTeamBoard)
  reloadTeamBoardRef.current = reloadTeamBoard
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // Live reload: canal privado por empresa. Al entrar una candidatura, un
  // trigger de BD emite un ping sin PII (campaign_id, locked) y aquí recargamos
  // SOLO lo afectado. La demo y un backend sin configurar no abren websocket.
  useEffect(() => {
    if (!companyId || companyId === 'demo' || !supabaseConfigured) return
    const pending = new Set<string>() // campaign_ids acumulados (ráfagas)
    let lockedDirty = false
    let boardDirty = false
    let timer = 0
    const flush = () => {
      timer = 0
      const ids = [...pending]
      pending.clear()
      ids.forEach((id) => void reloadCandidatesRef.current(id))
      if (lockedDirty) {
        lockedDirty = false
        void refreshLockedRef.current()
      }
      if (boardDirty) {
        boardDirty = false
        void reloadTeamBoardRef.current()
        // Un detalle de petición abierto refresca su hilo al ver subir la versión.
        setBoardVersion((v) => v + 1)
      }
    }
    const channel = supabase
      .channel(`company:${companyId}`, { config: { private: true } })
      .on('broadcast', { event: 'new_candidate' }, ({ payload }) => {
        const cid = typeof payload?.campaign_id === 'string' ? payload.campaign_id : null
        if (payload?.locked) lockedDirty = true
        else if (cid) pending.add(cid)
        if (!timer) timer = window.setTimeout(flush, 500) // amortigua ráfagas
      })
      .on('broadcast', { event: 'team_board_ping' }, ({ payload }) => {
        // Lo propio ya está pintado en local (mutación optimista): solo recargamos
        // por actividad de OTROS miembros.
        if (payload?.by && payload.by === userIdRef.current) return
        boardDirty = true
        if (!timer) timer = window.setTimeout(flush, 500)
      })
    // Canal privado: el token debe estar fijado en Realtime antes de suscribir
    // (los refresh de sesión posteriores los propaga supabase-js solo).
    void supabase.realtime.setAuth().then(() => channel.subscribe())
    // Red de seguridad al volver a la pestaña: si el socket no está sano
    // (portátil suspendido, red caída), recarga completa; si lo está, el canal
    // ya entregó todo y no hay nada que hacer.
    const onWake = () => {
      if (document.visibilityState === 'visible' && channel.state !== 'joined') void reloadRef.current()
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
      void supabase.removeChannel(channel) // cambio de empresa / logout
    }
  }, [companyId])

  // Persiste la demo en localStorage tras cada cambio. Salta la primera ejecución
  // (la hidratación inicial con el estado vacío) para no pisar lo guardado.
  const demoPersistReady = useRef(false)
  useEffect(() => {
    if (companyId !== 'demo') return
    if (!demoPersistReady.current) {
      demoPersistReady.current = true
      return
    }
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ campaigns, candidates, savedViews, sites, brands, tags, teamRequests, teamComments: demoTeamComments }))
    } catch {
      /* cuota llena, ignora */
    }
  }, [companyId, campaigns, candidates, savedViews, sites, brands, tags, teamRequests, demoTeamComments])

  const patchCandidateLocal = (id: string, patch: Partial<Candidate>) =>
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const patchTeamRequestLocal = (id: string, patch: Partial<TeamRequest>) =>
    setTeamRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  // Aviso por email del tablón, best-effort: si falla no molesta al usuario (el
  // dato ya está guardado y el aviso en vivo llega igual por realtime).
  const notifyBoard = (kind: 'peticion' | 'respuesta', id: string) => {
    if (companyId === 'demo' || !supabaseConfigured) return
    void supabase.functions.invoke('notify-team-board', { body: { kind, id } }).catch(() => {})
  }

  const dbCandidate = async (id: string, patch: Record<string, unknown>, revert: () => void) => {
    if (companyId === 'demo') return // demo: solo estado local
    pendingCandidateWrites.current.add(id)
    const { error } = await supabase.from('candidates').update(patch).eq('id', id)
    pendingCandidateWrites.current.delete(id)
    if (error) {
      revert()
      toast.error('No se pudo guardar el cambio. Inténtalo de nuevo.')
    }
  }

  // loading expuesto = recarga en curso O cambio de empresa aún sin sus datos. El segundo
  // término es true en el MISMO render en que cambia la empresa activa, así el panel pasa a
  // "cargando" de golpe, sin un frame enseñando los puestos del equipo anterior. (Demo no
  // tiene cambiador, se excluye para que no parpadee en su carga inicial.)
  const dataLoading = loading || (companyId != null && companyId !== 'demo' && loadedCompanyId !== companyId)

  const store = useMemo<Store>(() => ({
    loading: dataLoading,
    campaigns,
    candidates,
    lockedInfo,
    getCampaign: (id) => campaigns.find((c) => c.id === id),
    candidatesFor: (campaignId) =>
      candidates
        .filter((c) => c.campaignId === campaignId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    newCountFor: (campaignId) =>
      candidates.filter((c) => c.campaignId === campaignId && c.status === 'nuevo').length,
    newSinceFor: (campaignId) => {
      const since = seen[campaignId]
      // Sin marca de "visto" (nunca abierto): cuentan todos como nuevos.
      return candidates.filter((c) => c.campaignId === campaignId && (!since || c.submittedAt > since)).length
    },
    markSeen: (campaignId) => {
      setSeen((prev) => {
        const next = { ...prev, [campaignId]: new Date().toISOString() }
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch { /* cuota llena */ }
        return next
      })
    },
    reload,
    reloadCandidatesFor,

    setStatus: async (id, status) => {
      const prev = candidates.find((c) => c.id === id)?.status
      patchCandidateLocal(id, { status })
      await dbCandidate(id, { status }, () => prev && patchCandidateLocal(id, { status: prev }))
    },
    setRating: async (id, rating) => {
      const prev = candidates.find((c) => c.id === id)?.rating
      patchCandidateLocal(id, { rating })
      await dbCandidate(id, { rating }, () => prev != null && patchCandidateLocal(id, { rating: prev }))
    },
    setNotes: async (id, notes) => {
      patchCandidateLocal(id, { notes })
      await dbCandidate(id, { notes }, () => {})
    },

    deleteCandidate: (id) => {
      const found = candidates.find((c) => c.id === id)
      setCandidates((cs) => cs.filter((c) => c.id !== id))
      if (companyId === 'demo') return found
      supabase
        .from('candidates')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (found) setCandidates((cs) => [found, ...cs])
            toast.error('No se pudo eliminar. Inténtalo de nuevo.')
          }
        })
      return found
    },
    restoreCandidate: async (candidate) => {
      setCandidates((cs) => [candidate, ...cs])
      if (companyId === 'demo') return
      const { error } = await supabase.from('candidates').insert({
        id: candidate.id,
        campaign_id: candidate.campaignId,
        company_id: companyId,
        answers: candidate.answers,
        status: candidate.status,
        source: candidate.source,
        rating: candidate.rating,
        notes: candidate.notes,
        cv_path: candidate.cvPath ?? null,
        created_at: candidate.submittedAt,
      })
      if (error) {
        setCandidates((cs) => cs.filter((c) => c.id !== candidate.id))
        toast.error(
          error.message?.includes('CANDIDATE_LIMIT_REACHED')
            ? 'Has llegado al límite de candidatos de tu plan. Sube de plan para recuperarlo.'
            : 'No se pudo deshacer.',
        )
        return
      }
      // Reaplica sus etiquetas (la relación candidate_tags se borró en cascada al
      // eliminar el candidato). Si alguna falla, no bloquea el restablecimiento.
      if (candidate.tagIds.length) {
        await supabase.from('candidate_tags').insert(
          candidate.tagIds.map((tagId) => ({ candidate_id: candidate.id, tag_id: tagId })),
        )
      }
    },

    updateFields: async (campaignId, fields) => {
      setCampaigns((cs) => cs.map((c) => (c.id === campaignId ? { ...c, fields } : c)))
      if (companyId === 'demo') return true
      const { error } = await supabase.from('campaigns').update({ fields }).eq('id', campaignId)
      if (error) {
        toast.error('No se pudieron guardar los campos.')
        return false
      }
      return true
    },
    updateBranding: async (campaignId, branding) => {
      let merged: Branding | undefined
      setCampaigns((cs) =>
        cs.map((c) => {
          if (c.id !== campaignId) return c
          merged = { ...c.branding, ...branding }
          return { ...c, branding: merged }
        }),
      )
      if (companyId === 'demo') return
      if (merged) {
        const { error } = await supabase.from('campaigns').update({ branding: merged }).eq('id', campaignId)
        if (error) toast.error('No se pudo guardar la apariencia.')
      }
    },
    updateCampaign: async (campaignId, patch) => {
      const prev = campaigns.find((c) => c.id === campaignId)
      setCampaigns((cs) => cs.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)))
      if (companyId === 'demo') return true
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.sector !== undefined) dbPatch.sector = patch.sector
      if (patch.location !== undefined) dbPatch.location = patch.location
      if (patch.siteId !== undefined) dbPatch.site_id = patch.siteId
      if (patch.brandId !== undefined) dbPatch.brand_id = patch.brandId
      if (patch.notifyNew !== undefined) dbPatch.notify_new = patch.notifyNew
      if (Object.keys(dbPatch).length) {
        const { error } = await supabase.from('campaigns').update(dbPatch).eq('id', campaignId)
        if (error) {
          if (prev) setCampaigns((cs) => cs.map((c) => (c.id === campaignId ? prev : c)))
          toast.error(
            error.message?.includes('PLAN_LIMIT_REACHED')
              ? 'Ya tienes el máximo de puestos activos de tu plan. Pausa otro o sube de plan para activar este.'
              : 'No se pudo guardar el puesto.',
          )
          return false
        }
      }
      return true
    },

    createCampaign: async (input) => {
      if (companyId === 'demo') {
        const campaign: Campaign = {
          id: `demo_${Math.random().toString(36).slice(2, 9)}`,
          slug: newSlug(),
          title: input.title,
          sector: input.sector,
          location: input.location,
          status: 'activa',
          createdAt: new Date().toISOString(),
          milanunciosUrl: input.milanunciosUrl,
          fields: input.fields,
          branding: input.branding,
          siteId: null,
          brandId: null,
          notifyNew: true,
        }
        setCampaigns((cs) => [...cs, campaign])
        return campaign
      }
      // El slug es un id opaco aleatorio y UNIQUE; si (rarísimo) chocara, reintentamos con
      // otro. Cualquier otro error (p. ej. límite de plan) no se reintenta.
      let data: CampaignRow | null = null
      let error: { message?: string; code?: string } | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await supabase
          .from('campaigns')
          .insert({
            company_id: companyId,
            slug: newSlug(),
            title: input.title,
            sector: input.sector,
            location: input.location,
            status: 'activa',
            milanuncios_url: input.milanunciosUrl ?? null,
            fields: input.fields,
            branding: input.branding,
          })
          .select('*')
          .single()
        data = res.data as CampaignRow | null
        error = res.error
        if (!error) break
        if (res.error?.code === '23505') continue // colisión de slug: reintenta con otro id
        break
      }
      if (error || !data) {
        toast.error(
          error?.message?.includes('PLAN_LIMIT_REACHED')
            ? 'Has llegado al límite de procesos de tu plan. Sube de plan para abrir otro.'
            : 'No se pudo crear el puesto.',
        )
        return null
      }
      const campaign = toCampaign(data as CampaignRow)
      setCampaigns((cs) => [...cs, campaign])
      return campaign
    },
    duplicateCampaign: async (campaignId) => {
      const src = campaigns.find((c) => c.id === campaignId)
      if (!src) return null
      const title = `${src.title} (copia)`
      const fields = src.fields.map((f) => ({ ...f }))
      const branding = { ...src.branding }
      if (companyId === 'demo') {
        const campaign: Campaign = {
          id: `demo_${Math.random().toString(36).slice(2, 9)}`,
          slug: newSlug(),
          title,
          sector: src.sector,
          location: src.location,
          status: 'activa',
          createdAt: new Date().toISOString(),
          milanunciosUrl: src.milanunciosUrl,
          fields,
          branding,
          siteId: src.siteId,
          brandId: src.brandId,
          notifyNew: src.notifyNew ?? true,
        }
        setCampaigns((cs) => [...cs, campaign])
        return campaign
      }
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          company_id: companyId,
          slug: newSlug(),
          title,
          sector: src.sector,
          location: src.location,
          status: 'activa',
          milanuncios_url: src.milanunciosUrl ?? null,
          fields,
          branding,
          site_id: src.siteId,
          brand_id: src.brandId,
          notify_new: src.notifyNew ?? true,
        })
        .select('*')
        .single()
      if (error || !data) {
        toast.error(
          error?.message?.includes('PLAN_LIMIT_REACHED')
            ? 'Has llegado al límite de procesos de tu plan. Sube de plan para abrir otro.'
            : 'No se pudo duplicar el puesto.',
        )
        return null
      }
      const campaign = toCampaign(data as CampaignRow)
      setCampaigns((cs) => [...cs, campaign])
      return campaign
    },
    deleteCampaign: async (campaignId) => {
      const prev = campaigns
      const prevCands = candidates
      setCampaigns((cs) => cs.filter((c) => c.id !== campaignId))
      setCandidates((cs) => cs.filter((c) => c.campaignId !== campaignId))
      if (companyId === 'demo') return true
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId)
      if (error) {
        setCampaigns(prev)
        setCandidates(prevCands)
        toast.error('No se pudo eliminar el puesto.')
        return false
      }
      return true
    },

    savedViews,
    createSavedView: async ({ name, campaignId, payload }) => {
      if (companyId === 'demo') {
        const view: SavedView = { id: `view_${Math.random().toString(36).slice(2, 9)}`, campaignId, name, payload }
        setSavedViews((vs) => [...vs, view])
        return view
      }
      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          company_id: companyId,
          campaign_id: campaignId,
          name,
          scope: campaignId ? 'campaign' : 'global',
          payload,
        })
        .select('id,campaign_id,name,payload')
        .single()
      if (error || !data) {
        toast.error('No se pudo guardar la vista.')
        return null
      }
      const view = toSavedView(data as SavedViewRow)
      setSavedViews((vs) => [...vs, view])
      return view
    },
    deleteSavedView: async (id) => {
      const prev = savedViews
      setSavedViews((vs) => vs.filter((v) => v.id !== id))
      if (companyId === 'demo') return
      const { error } = await supabase.from('saved_views').delete().eq('id', id)
      if (error) {
        setSavedViews(prev)
        toast.error('No se pudo eliminar la vista.')
      }
    },

    sites,
    createSite: async ({ name, city }) => {
      if (companyId === 'demo') {
        const site: Site = { id: `site_${Math.random().toString(36).slice(2, 9)}`, name, city }
        setSites((ss) => [...ss, site])
        return site
      }
      const { data, error } = await supabase
        .from('sites')
        .insert({ company_id: companyId, name, city })
        .select('id,name,city')
        .single()
      if (error || !data) {
        toast.error('No se pudo crear la sede.')
        return null
      }
      const site = toSite(data as SiteRow)
      setSites((ss) => [...ss, site])
      return site
    },
    renameSite: async (id, patch) => {
      const prev = sites
      setSites((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      if (companyId === 'demo') return true
      const { error } = await supabase.from('sites').update({ name: patch.name, city: patch.city }).eq('id', id)
      if (error) {
        setSites(prev)
        toast.error('No se pudo guardar la sede.')
        return false
      }
      return true
    },
    deleteSite: async (id) => {
      const prevSites = sites
      const prevCampaigns = campaigns
      setSites((ss) => ss.filter((s) => s.id !== id))
      // Los puestos de esa sede quedan "sin sede" (no se borran). En BD lo hace
      // el "on delete set null"; aquí reflejamos lo mismo en local.
      setCampaigns((cs) => cs.map((c) => (c.siteId === id ? { ...c, siteId: null } : c)))
      if (companyId === 'demo') return true
      const { error } = await supabase.from('sites').delete().eq('id', id)
      if (error) {
        setSites(prevSites)
        setCampaigns(prevCampaigns)
        toast.error('No se pudo eliminar la sede.')
        return false
      }
      return true
    },

    brands,
    createBrand: async (input) => {
      if (companyId === 'demo') {
        const brand: Brand = { id: `brand_${Math.random().toString(36).slice(2, 9)}`, ...input }
        setBrands((bs) => [...bs, brand])
        return brand
      }
      const { data, error } = await supabase
        .from('brands')
        .insert({
          company_id: companyId,
          name: input.name,
          accent: input.accent,
          welcome: input.welcome,
          thanks: input.thanks,
          show_logo: input.showLogo,
          logo_path: input.logoPath,
          banner_path: input.bannerPath,
        })
        .select('id,name,accent,welcome,thanks,show_logo,logo_path,banner_path')
        .single()
      if (error || !data) {
        // Backstop del tope de marcas del servidor (trigger enforce_brand_limit):
        // el cliente ya avisa antes, pero si llega aquí damos un mensaje claro.
        if (error?.message?.includes('BRAND_LIMIT_REACHED')) {
          toast.error('Has llegado al límite de marcas de tu plan. Sube a Multi para crear más.')
        } else {
          toast.error('No se pudo crear la marca.')
        }
        return null
      }
      const brand = toBrand(data as BrandRow)
      setBrands((bs) => [...bs, brand])
      return brand
    },
    updateBrand: async (id, patch) => {
      const prev = brands
      setBrands((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      if (companyId === 'demo') return
      const dbPatch: Record<string, unknown> = {}
      if (patch.name !== undefined) dbPatch.name = patch.name
      if (patch.accent !== undefined) dbPatch.accent = patch.accent
      if (patch.welcome !== undefined) dbPatch.welcome = patch.welcome
      if (patch.thanks !== undefined) dbPatch.thanks = patch.thanks
      if (patch.showLogo !== undefined) dbPatch.show_logo = patch.showLogo
      if (patch.logoPath !== undefined) dbPatch.logo_path = patch.logoPath
      if (patch.bannerPath !== undefined) dbPatch.banner_path = patch.bannerPath
      const { error } = await supabase.from('brands').update(dbPatch).eq('id', id)
      if (error) {
        setBrands(prev)
        toast.error('No se pudo guardar la marca.')
      }
    },
    deleteBrand: async (id) => {
      const prevBrands = brands
      const prevCampaigns = campaigns
      setBrands((bs) => bs.filter((b) => b.id !== id))
      // El puesto conserva la apariencia ya copiada; solo pierde la referencia a la marca.
      setCampaigns((cs) => cs.map((c) => (c.brandId === id ? { ...c, brandId: null } : c)))
      if (companyId === 'demo') return
      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) {
        setBrands(prevBrands)
        setCampaigns(prevCampaigns)
        toast.error('No se pudo eliminar la marca.')
      }
    },

    tags,
    tagUsage: (tagId) => candidates.filter((c) => c.tagIds.includes(tagId)).length,
    createTag: async (name) => {
      const clean = normalizeTagName(name)
      if (!clean || clean.length > 40) return null
      // Reutiliza si ya existe (ignorando mayúsculas): no duplica vocabulario.
      const existing = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase())
      if (existing) return existing
      if (companyId === 'demo') {
        const tag: Tag = { id: `tag_${Math.random().toString(36).slice(2, 9)}`, name: clean }
        setTags((ts) => [...ts, tag])
        return tag
      }
      const { data, error } = await supabase
        .from('tags')
        .insert({ company_id: companyId, name: clean })
        .select('id,name')
        .single()
      if (error || !data) {
        // 23505: otra sesión la creó a la vez. Reléela y reutilízala en vez de fallar.
        if (error?.code === '23505') {
          const { data: rows } = await supabase.from('tags').select('id,name').eq('company_id', companyId)
          const found = (rows as TagRow[] | null)?.find((t) => t.name.toLowerCase() === clean.toLowerCase())
          if (found) {
            const tag = toTag(found)
            setTags((ts) => (ts.some((t) => t.id === tag.id) ? ts : [...ts, tag]))
            return tag
          }
        }
        toast.error('No se pudo crear la etiqueta.')
        return null
      }
      const tag = toTag(data as TagRow)
      setTags((ts) => [...ts, tag])
      return tag
    },
    renameTag: async (id, name) => {
      const clean = normalizeTagName(name)
      if (!clean || clean.length > 40) return false
      // Renombrar a un nombre que ya usa OTRA etiqueta sería un duplicado: lo evitamos.
      if (tags.some((t) => t.id !== id && t.name.toLowerCase() === clean.toLowerCase())) {
        toast.error('Ya tienes una etiqueta con ese nombre.')
        return false
      }
      const prev = tags
      setTags((ts) => ts.map((t) => (t.id === id ? { ...t, name: clean } : t)))
      if (companyId === 'demo') return true
      const { error } = await supabase.from('tags').update({ name: clean }).eq('id', id)
      if (error) {
        setTags(prev)
        toast.error('No se pudo renombrar la etiqueta.')
        return false
      }
      return true
    },
    deleteTag: async (id) => {
      const prevTags = tags
      const prevCands = candidates
      setTags((ts) => ts.filter((t) => t.id !== id))
      // Desaparece de todos los candidatos (en BD lo hace el on delete cascade).
      setCandidates((cs) => cs.map((c) => (c.tagIds.includes(id) ? { ...c, tagIds: c.tagIds.filter((t) => t !== id) } : c)))
      if (companyId === 'demo') return
      const { error } = await supabase.from('tags').delete().eq('id', id)
      if (error) {
        setTags(prevTags)
        setCandidates(prevCands)
        toast.error('No se pudo eliminar la etiqueta.')
      }
    },
    restoreTag: async (tag, candidateIds) => {
      // Deshacer un borrado de etiqueta: recrea la etiqueta (mismo id) y la reaplica.
      setTags((ts) => (ts.some((t) => t.id === tag.id) ? ts : [...ts, tag]))
      setCandidates((cs) => cs.map((c) => (candidateIds.includes(c.id) && !c.tagIds.includes(tag.id) ? { ...c, tagIds: [...c.tagIds, tag.id] } : c)))
      if (companyId === 'demo') return
      const { error } = await supabase.from('tags').insert({ id: tag.id, company_id: companyId, name: tag.name })
      if (error) {
        setTags((ts) => ts.filter((t) => t.id !== tag.id))
        setCandidates((cs) => cs.map((c) => (c.tagIds.includes(tag.id) ? { ...c, tagIds: c.tagIds.filter((t) => t !== tag.id) } : c)))
        toast.error('No se pudo deshacer.')
        return
      }
      if (candidateIds.length) {
        await supabase.from('candidate_tags').insert(candidateIds.map((cid) => ({ candidate_id: cid, tag_id: tag.id })))
      }
    },
    applyTag: async (candidateId, tagId) => {
      const cand = candidates.find((c) => c.id === candidateId)
      if (!cand || cand.tagIds.includes(tagId)) return
      patchCandidateLocal(candidateId, { tagIds: [...cand.tagIds, tagId] })
      if (companyId === 'demo') return
      pendingCandidateWrites.current.add(candidateId)
      const { error } = await supabase.from('candidate_tags').insert({ candidate_id: candidateId, tag_id: tagId })
      pendingCandidateWrites.current.delete(candidateId)
      if (error) {
        patchCandidateLocal(candidateId, { tagIds: cand.tagIds })
        toast.error('No se pudo aplicar la etiqueta.')
      }
    },
    removeTag: async (candidateId, tagId) => {
      const cand = candidates.find((c) => c.id === candidateId)
      if (!cand || !cand.tagIds.includes(tagId)) return
      patchCandidateLocal(candidateId, { tagIds: cand.tagIds.filter((t) => t !== tagId) })
      if (companyId === 'demo') return
      pendingCandidateWrites.current.add(candidateId)
      const { error } = await supabase.from('candidate_tags').delete().eq('candidate_id', candidateId).eq('tag_id', tagId)
      pendingCandidateWrites.current.delete(candidateId)
      if (error) {
        patchCandidateLocal(candidateId, { tagIds: cand.tagIds })
        toast.error('No se pudo quitar la etiqueta.')
      }
    },
    applyTagToMany: async (candidateIds, tagId) => {
      const targets = candidates.filter((c) => candidateIds.includes(c.id) && !c.tagIds.includes(tagId))
      if (!targets.length) return
      const ids = targets.map((t) => t.id)
      setCandidates((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, tagIds: [...c.tagIds, tagId] } : c)))
      if (companyId === 'demo') return
      ids.forEach((id) => pendingCandidateWrites.current.add(id))
      const { error } = await supabase.from('candidate_tags').insert(ids.map((cid) => ({ candidate_id: cid, tag_id: tagId })))
      ids.forEach((id) => pendingCandidateWrites.current.delete(id))
      if (error) {
        setCandidates((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, tagIds: c.tagIds.filter((t) => t !== tagId) } : c)))
        toast.error('No se pudieron aplicar las etiquetas.')
      }
    },
    removeTagFromMany: async (candidateIds, tagId) => {
      const targets = candidates.filter((c) => candidateIds.includes(c.id) && c.tagIds.includes(tagId))
      if (!targets.length) return
      const ids = targets.map((t) => t.id)
      setCandidates((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, tagIds: c.tagIds.filter((t) => t !== tagId) } : c)))
      if (companyId === 'demo') return
      ids.forEach((id) => pendingCandidateWrites.current.add(id))
      const { error } = await supabase.from('candidate_tags').delete().eq('tag_id', tagId).in('candidate_id', ids)
      ids.forEach((id) => pendingCandidateWrites.current.delete(id))
      if (error) {
        setCandidates((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, tagIds: [...c.tagIds, tagId] } : c)))
        toast.error('No se pudieron quitar las etiquetas.')
      }
    },

    // --- Tablón de peticiones de equipo ------------------------------------
    teamRequests,
    boardVersion,
    boardNewCount: (() => {
      const since = companyId ? boardSeen[companyId] : undefined
      // Sin marca de "visto" (nunca abierto): cuenta toda actividad ajena.
      return teamRequests.filter(
        (r) => r.lastActivityBy !== userId && (!since || r.lastActivityAt > since),
      ).length
    })(),
    markBoardSeen: () => {
      if (!companyId) return
      setBoardSeen((prev) => {
        const next = { ...prev, [companyId]: new Date().toISOString() }
        try { localStorage.setItem(BOARD_SEEN_KEY, JSON.stringify(next)) } catch { /* cuota llena */ }
        return next
      })
    },

    loadTeamComments: async (requestId) => {
      if (companyId === 'demo')
        return demoTeamComments
          .filter((c) => c.requestId === requestId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const { data, error } = await supabase
        .from('team_request_comments')
        .select('id,request_id,author_user_id,author_email,body,created_at')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })
      if (error || !data) return []
      return (data as TeamCommentRow[]).map(toTeamComment)
    },

    createTeamRequest: async ({ title, body, siteId }) => {
      if (companyId === 'demo') {
        const request: TeamRequest = {
          id: `req_demo_${Math.random().toString(36).slice(2, 9)}`,
          title,
          body,
          status: 'abierta',
          authorUserId: userId,
          authorEmail: user?.email ?? '',
          siteId,
          createdAt: new Date().toISOString(),
          completedBy: null,
          lastActivityAt: new Date().toISOString(),
          lastActivityBy: userId,
          commentCount: 0,
          proposals: [],
        }
        setTeamRequests((rs) => [request, ...rs])
        return request
      }
      // Como createCampaign: primero el servidor (necesitamos id y autor que
      // fijan los triggers), luego el estado local con la fila real.
      const { data, error } = await supabase
        .from('team_requests')
        .insert({ company_id: companyId, title, body, site_id: siteId })
        .select('*')
        .single()
      if (error || !data) {
        toast.error('No se pudo publicar la petición. Inténtalo de nuevo.')
        return null
      }
      const row = data as Omit<TeamRequestRow, 'team_request_candidates' | 'team_request_comments'>
      const request = toTeamRequest({ ...row, team_request_candidates: [], team_request_comments: [] })
      setTeamRequests((rs) => [request, ...rs])
      notifyBoard('peticion', request.id)
      return request
    },

    addTeamComment: async (requestId, body, candidateIds) => {
      const now = new Date().toISOString()
      if (companyId === 'demo') {
        const comment: TeamRequestComment = {
          id: `reqc_demo_${Math.random().toString(36).slice(2, 9)}`,
          requestId,
          authorUserId: userId,
          authorEmail: user?.email ?? '',
          body,
          createdAt: now,
        }
        setDemoTeamComments((cs) => [...cs, comment])
        setTeamRequests((rs) =>
          rs.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  commentCount: r.commentCount + 1,
                  lastActivityAt: now,
                  lastActivityBy: userId,
                  proposals: [
                    ...r.proposals,
                    ...candidateIds
                      .filter((cid) => !r.proposals.some((p) => p.candidateId === cid))
                      .map((cid) => ({ candidateId: cid, commentId: comment.id, proposedBy: userId })),
                  ],
                }
              : r,
          ),
        )
        return comment
      }
      const { data, error } = await supabase
        .from('team_request_comments')
        .insert({ request_id: requestId, body })
        .select('id,request_id,author_user_id,author_email,body,created_at')
        .single()
      if (error || !data) {
        toast.error('No se pudo enviar el mensaje. Inténtalo de nuevo.')
        return null
      }
      const comment = toTeamComment(data as TeamCommentRow)
      let attached = candidateIds
      if (candidateIds.length) {
        // El puente valida por RLS que el candidato sea visible y de la empresa.
        // Si alguna fila falla (p. ej. otro compañero lo propuso a la vez), la
        // respuesta ya está publicada: avisamos sin tirar nada.
        const { error: pErr } = await supabase.from('team_request_candidates').insert(
          candidateIds.map((cid) => ({ request_id: requestId, candidate_id: cid, comment_id: comment.id })),
        )
        if (pErr) {
          attached = []
          toast.error('La respuesta se publicó, pero no se pudieron adjuntar los candidatos.')
        }
      }
      const request = teamRequests.find((r) => r.id === requestId)
      patchTeamRequestLocal(requestId, {
        commentCount: (request?.commentCount ?? 0) + 1,
        lastActivityAt: now,
        lastActivityBy: userId,
        proposals: [
          ...(request?.proposals ?? []),
          ...attached
            .filter((cid) => !request?.proposals.some((p) => p.candidateId === cid))
            .map((cid) => ({ candidateId: cid, commentId: comment.id, proposedBy: userId })),
        ],
      })
      notifyBoard('respuesta', comment.id)
      return comment
    },

    setTeamRequestStatus: async (id, status) => {
      const prev = teamRequests.find((r) => r.id === id)
      patchTeamRequestLocal(id, {
        status,
        completedBy: status === 'completada' ? userId : null,
        lastActivityAt: new Date().toISOString(),
        lastActivityBy: userId,
      })
      if (companyId === 'demo') return
      // completed_at/by y la actividad los fija el trigger de BD.
      const { error } = await supabase.from('team_requests').update({ status }).eq('id', id)
      if (error) {
        if (prev) patchTeamRequestLocal(id, prev)
        toast.error('No se pudo cambiar el estado de la petición.')
      }
    },

    deleteTeamRequest: async (id) => {
      const prev = teamRequests
      setTeamRequests((rs) => rs.filter((r) => r.id !== id))
      if (companyId === 'demo') {
        setDemoTeamComments((cs) => cs.filter((c) => c.requestId !== id))
        return true
      }
      const { error } = await supabase.from('team_requests').delete().eq('id', id)
      if (error) {
        setTeamRequests(prev)
        toast.error('No se pudo eliminar la petición.')
        return false
      }
      return true
    },

    retractProposal: async (requestId, candidateId) => {
      const request = teamRequests.find((r) => r.id === requestId)
      if (!request) return
      patchTeamRequestLocal(requestId, {
        proposals: request.proposals.filter((p) => p.candidateId !== candidateId),
      })
      if (companyId === 'demo') return
      const { error } = await supabase
        .from('team_request_candidates')
        .delete()
        .eq('request_id', requestId)
        .eq('candidate_id', candidateId)
      if (error) {
        patchTeamRequestLocal(requestId, { proposals: request.proposals })
        toast.error('No se pudo retirar el candidato.')
      }
    },

    resetDemo: () => {
      try {
        localStorage.removeItem(DEMO_KEY)
      } catch {
        /* ignora */
      }
      setCampaigns(SEED.campaigns)
      setCandidates(SEED.candidates)
      setSavedViews([])
      setSites(SEED.sites)
      setBrands(SEED_BRANDS)
      setTags(SEED_TAGS)
      setTeamRequests(SEED_TEAM_REQUESTS)
      setDemoTeamComments(SEED_TEAM_COMMENTS)
    },
  }), [dataLoading, campaigns, candidates, lockedInfo, savedViews, sites, brands, tags, seen, teamRequests, demoTeamComments, boardSeen, boardVersion, companyId, userId, user?.email, reload, reloadCandidatesFor, toast])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}

// Id corto y opaco para el slug público de un puesto nuevo. No deriva del título: el
// título va aparte en la URL como tramo legible (ver publicFormPath en brand.ts). Con
// 36^10 ≈ 3.6e15 combinaciones la colisión es ínfima, y createCampaign reintenta si la
// hubiera (el slug es UNIQUE en la BD).
export function newSlug(): string {
  return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 10)
}

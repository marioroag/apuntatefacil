import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Brand, Branding, Campaign, Candidate, CandidateStatus, FormField, SavedView, SavedViewPayload, Site } from './types'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { useToast } from '../components/ui/Toast'
import { SEED, SEED_BRANDS } from './seed'

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
const toCandidate = (r: CandidateRow): Candidate => ({
  id: r.id,
  campaignId: r.campaign_id,
  answers: r.answers ?? {},
  status: r.status,
  source: r.source,
  rating: r.rating,
  notes: r.notes ?? '',
  cvPath: r.cv_path ?? undefined,
  submittedAt: r.created_at,
})

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
  updateFields: (campaignId: string, fields: FormField[]) => Promise<void>
  updateBranding: (campaignId: string, branding: Partial<Branding>) => Promise<void>
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => Promise<void>
  createCampaign: (input: NewCampaignInput) => Promise<Campaign | null>
  deleteCampaign: (campaignId: string) => Promise<void>
  // Vistas guardadas (Pro/Multi)
  savedViews: SavedView[]
  createSavedView: (input: { name: string; campaignId: string | null; payload: SavedViewPayload }) => Promise<SavedView | null>
  deleteSavedView: (id: string) => Promise<void>
  // Sedes (Multi)
  sites: Site[]
  createSite: (input: { name: string; city: string }) => Promise<Site | null>
  renameSite: (id: string, patch: { name: string; city: string }) => Promise<void>
  deleteSite: (id: string) => Promise<void>
  // Marcas (Multi)
  brands: Brand[]
  createBrand: (input: Omit<Brand, 'id'>) => Promise<Brand | null>
  updateBrand: (id: string, patch: Partial<Omit<Brand, 'id'>>) => Promise<void>
  deleteBrand: (id: string) => Promise<void>
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

// --- Persistencia de la DEMO en localStorage --------------------------------
// La demo es 100% local; guardamos su estado para que aguante recargas.
const DEMO_KEY = 'apuntatefacil.demo.v1'

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

function readDemoState(): { campaigns: Campaign[]; candidates: Candidate[]; savedViews: SavedView[]; sites: Site[]; brands: Brand[] } | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.campaigns) && Array.isArray(parsed?.candidates))
      return {
        campaigns: parsed.campaigns,
        candidates: parsed.candidates,
        savedViews: Array.isArray(parsed.savedViews) ? parsed.savedViews : [],
        sites: Array.isArray(parsed.sites) ? parsed.sites : SEED.sites,
        brands: Array.isArray(parsed.brands) ? parsed.brands : SEED_BRANDS,
      }
  } catch {
    /* ignora storage corrupto */
  }
  return null
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { company } = useAuth()
  const toast = useToast()
  const companyId = company?.id

  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen())
  // Candidatos con una escritura optimista aún sin confirmar en el servidor. Un
  // refetch (reloadCandidatesFor) NO debe pisar su estado local con datos viejos
  // del servidor mientras la escritura está en vuelo.
  const pendingCandidateWrites = useRef<Set<string>>(new Set())

  const reload = useCallback(async () => {
    if (!companyId) {
      setCampaigns([])
      setCandidates([])
      setSavedViews([])
      setSites([])
      setBrands([])
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
      setLoading(false)
      return
    }
    setLoading(true)
    const [c1, c2, c3, c4, c5] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: true }),
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
      supabase.from('saved_views').select('id,campaign_id,name,payload').order('created_at', { ascending: true }),
      supabase.from('sites').select('id,name,city').order('name', { ascending: true }),
      supabase.from('brands').select('id,name,accent,welcome,thanks,show_logo,logo_path,banner_path').order('name', { ascending: true }),
    ])
    if (c1.error || c2.error) {
      toast.error('No pudimos cargar tus datos. Reintenta en unos segundos.')
    } else {
      setCampaigns((c1.data as CampaignRow[]).map(toCampaign))
      setCandidates((c2.data as CandidateRow[]).map(toCandidate))
    }
    // Vistas, sedes y marcas son secundarias: si la tabla aún no existe o falla, no rompe el panel.
    setSavedViews(!c3.error && c3.data ? (c3.data as SavedViewRow[]).map(toSavedView) : [])
    setSites(!c4.error && c4.data ? (c4.data as SiteRow[]).map(toSite) : [])
    setBrands(!c5.error && c5.data ? (c5.data as BrandRow[]).map(toBrand) : [])
    setLoading(false)
  }, [companyId, toast])

  useEffect(() => {
    reload()
  }, [reload])

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
      localStorage.setItem(DEMO_KEY, JSON.stringify({ campaigns, candidates, savedViews, sites, brands }))
    } catch {
      /* cuota llena, ignora */
    }
  }, [companyId, campaigns, candidates, savedViews, sites, brands])

  const patchCandidateLocal = (id: string, patch: Partial<Candidate>) =>
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))

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

  const store = useMemo<Store>(() => ({
    loading,
    campaigns,
    candidates,
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

    reloadCandidatesFor: async (campaignId) => {
      if (!companyId || companyId === 'demo') return 0 // demo: datos en memoria, nada nuevo de red
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
      if (error || !data) return -1
      const fetched = (data as CandidateRow[]).map(toCandidate)
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
    },

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
      }
    },

    updateFields: async (campaignId, fields) => {
      setCampaigns((cs) => cs.map((c) => (c.id === campaignId ? { ...c, fields } : c)))
      if (companyId === 'demo') return
      const { error } = await supabase.from('campaigns').update({ fields }).eq('id', campaignId)
      if (error) toast.error('No se pudieron guardar los campos.')
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
      if (companyId === 'demo') return
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
              ? 'Has llegado al límite de procesos de tu plan. Sube de plan para reactivar este.'
              : 'No se pudo guardar el puesto.',
          )
        }
      }
    },

    createCampaign: async (input) => {
      if (companyId === 'demo') {
        const campaign: Campaign = {
          id: `demo_${Math.random().toString(36).slice(2, 9)}`,
          slug: slugify(input.title),
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
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          company_id: companyId,
          slug: slugify(input.title),
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
    deleteCampaign: async (campaignId) => {
      const prev = campaigns
      const prevCands = candidates
      setCampaigns((cs) => cs.filter((c) => c.id !== campaignId))
      setCandidates((cs) => cs.filter((c) => c.campaignId !== campaignId))
      if (companyId === 'demo') return
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId)
      if (error) {
        setCampaigns(prev)
        setCandidates(prevCands)
        toast.error('No se pudo eliminar el puesto.')
      }
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
      if (companyId === 'demo') return
      const { error } = await supabase.from('sites').update({ name: patch.name, city: patch.city }).eq('id', id)
      if (error) {
        setSites(prev)
        toast.error('No se pudo guardar la sede.')
      }
    },
    deleteSite: async (id) => {
      const prevSites = sites
      const prevCampaigns = campaigns
      setSites((ss) => ss.filter((s) => s.id !== id))
      // Los puestos de esa sede quedan "sin sede" (no se borran). En BD lo hace
      // el "on delete set null"; aquí reflejamos lo mismo en local.
      setCampaigns((cs) => cs.map((c) => (c.siteId === id ? { ...c, siteId: null } : c)))
      if (companyId === 'demo') return
      const { error } = await supabase.from('sites').delete().eq('id', id)
      if (error) {
        setSites(prevSites)
        setCampaigns(prevCampaigns)
        toast.error('No se pudo eliminar la sede.')
      }
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
    },
  }), [loading, campaigns, candidates, savedViews, sites, brands, seen, companyId, reload, toast])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}

// slug url-safe a partir del título, con sufijo aleatorio para unicidad.
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 7)
  return `${base || 'puesto'}-${rand}`
}

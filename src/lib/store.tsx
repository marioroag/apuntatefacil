import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Branding, Campaign, Candidate, CandidateStatus, FormField } from './types'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { useToast } from '../components/ui/Toast'
import { SEED } from './seed'

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
  reload: () => Promise<void>
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
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

// --- Persistencia de la DEMO en localStorage --------------------------------
// La demo es 100% local; guardamos su estado para que aguante recargas.
const DEMO_KEY = 'criba.demo.v1'

function readDemoState(): { campaigns: Campaign[]; candidates: Candidate[] } | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.campaigns) && Array.isArray(parsed?.candidates)) return parsed
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

  const reload = useCallback(async () => {
    if (!companyId) {
      setCampaigns([])
      setCandidates([])
      return
    }
    if (companyId === 'demo') {
      // Demo pública: persiste en localStorage; si no hay nada guardado, datos
      // de ejemplo. No toca Supabase.
      const saved = readDemoState()
      setCampaigns(saved?.campaigns ?? SEED.campaigns)
      setCandidates(saved?.candidates ?? SEED.candidates)
      setLoading(false)
      return
    }
    setLoading(true)
    const [c1, c2] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: true }),
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
    ])
    if (c1.error || c2.error) {
      toast.error('No pudimos cargar tus datos. Reintenta en unos segundos.')
    } else {
      setCampaigns((c1.data as CampaignRow[]).map(toCampaign))
      setCandidates((c2.data as CandidateRow[]).map(toCandidate))
    }
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
      localStorage.setItem(DEMO_KEY, JSON.stringify({ campaigns, candidates }))
    } catch {
      /* cuota llena, ignora */
    }
  }, [companyId, campaigns, candidates])

  const patchCandidateLocal = (id: string, patch: Partial<Candidate>) =>
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const dbCandidate = async (id: string, patch: Record<string, unknown>, revert: () => void) => {
    if (companyId === 'demo') return // demo: solo estado local
    const { error } = await supabase.from('candidates').update(patch).eq('id', id)
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
    reload,

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
        toast.error('No se pudo deshacer.')
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
      setCampaigns((cs) => cs.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)))
      if (companyId === 'demo') return
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.sector !== undefined) dbPatch.sector = patch.sector
      if (patch.location !== undefined) dbPatch.location = patch.location
      if (Object.keys(dbPatch).length) {
        const { error } = await supabase.from('campaigns').update(dbPatch).eq('id', campaignId)
        if (error) toast.error('No se pudo guardar el puesto.')
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
        toast.error('No se pudo crear el puesto.')
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

    resetDemo: () => {
      try {
        localStorage.removeItem(DEMO_KEY)
      } catch {
        /* ignora */
      }
      setCampaigns(SEED.campaigns)
      setCandidates(SEED.candidates)
    },
  }), [loading, campaigns, candidates, companyId, reload, toast])

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

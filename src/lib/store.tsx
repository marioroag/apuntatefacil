import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Branding,
  Campaign,
  Candidate,
  CandidateStatus,
  CribaData,
  FormField,
} from './types'
import { SEED } from './seed'

const KEY = 'criba.data.v1'

function load(): CribaData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as CribaData
  } catch {
    /* ignora storage corrupto */
  }
  return SEED
}

interface Store {
  data: CribaData
  getCampaign: (id: string) => Campaign | undefined
  getCampaignBySlug: (slug: string) => Campaign | undefined
  candidatesFor: (campaignId: string) => Candidate[]
  newCountFor: (campaignId: string) => number
  // mutaciones
  setStatus: (candidateId: string, status: CandidateStatus) => void
  setRating: (candidateId: string, rating: number) => void
  setNotes: (candidateId: string, notes: string) => void
  deleteCandidate: (candidateId: string) => Candidate | undefined
  restoreCandidate: (candidate: Candidate) => void
  addCandidate: (campaignId: string, answers: Candidate['answers'], source?: Candidate['source']) => void
  updateFields: (campaignId: string, fields: FormField[]) => void
  updateBranding: (campaignId: string, branding: Partial<Branding>) => void
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

let idc = Date.now()
const nextId = (p: string) => `${p}_${(idc++).toString(36)}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CribaData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* cuota llena, ignora */
    }
  }, [data])

  const patchCandidate = useCallback((id: string, patch: Partial<Candidate>) => {
    setData((d) => ({
      ...d,
      candidates: d.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  const store = useMemo<Store>(() => ({
    data,
    getCampaign: (id) => data.campaigns.find((c) => c.id === id),
    getCampaignBySlug: (slug) => data.campaigns.find((c) => c.slug === slug),
    candidatesFor: (campaignId) =>
      data.candidates
        .filter((c) => c.campaignId === campaignId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    newCountFor: (campaignId) =>
      data.candidates.filter((c) => c.campaignId === campaignId && c.status === 'nuevo').length,

    setStatus: (id, status) => patchCandidate(id, { status }),
    setRating: (id, rating) => patchCandidate(id, { rating }),
    setNotes: (id, notes) => patchCandidate(id, { notes }),

    deleteCandidate: (id) => {
      const found = data.candidates.find((c) => c.id === id)
      setData((d) => ({ ...d, candidates: d.candidates.filter((c) => c.id !== id) }))
      return found
    },
    restoreCandidate: (candidate) =>
      setData((d) => ({ ...d, candidates: [candidate, ...d.candidates] })),

    addCandidate: (campaignId, answers, source = 'enlace') =>
      setData((d) => ({
        ...d,
        candidates: [
          {
            id: nextId('cand'),
            campaignId,
            answers,
            status: 'nuevo',
            submittedAt: new Date().toISOString(),
            source,
            rating: 0,
            notes: '',
          },
          ...d.candidates,
        ],
      })),

    updateFields: (campaignId, fields) =>
      setData((d) => ({
        ...d,
        campaigns: d.campaigns.map((c) => (c.id === campaignId ? { ...c, fields } : c)),
      })),

    updateBranding: (campaignId, branding) =>
      setData((d) => ({
        ...d,
        campaigns: d.campaigns.map((c) =>
          c.id === campaignId ? { ...c, branding: { ...c.branding, ...branding } } : c,
        ),
      })),

    updateCampaign: (campaignId, patch) =>
      setData((d) => ({
        ...d,
        campaigns: d.campaigns.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)),
      })),

    resetDemo: () => {
      localStorage.removeItem(KEY)
      setData(SEED)
    },
  }), [data, patchCandidate])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}

// Hook auxiliar para simular "nuevas candidaturas entrando" en la demo.
export function useNewSubmissionSimulator(_campaignId: string | undefined) {
  const ref = useRef<number | null>(null)
  return ref // (no-op de momento; gancho para la demo en vivo)
}

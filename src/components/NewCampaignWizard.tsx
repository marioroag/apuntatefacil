import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  HardHat, HeartHandshake, Loader2, PenLine, ShoppingBag, Sparkles, Truck, UtensilsCrossed, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from './ui/Toast'
import { TEMPLATES, templateCampaignInput } from '../lib/templates'
import type { SectorTemplate } from '../lib/templates'
import { blankCampaignInput } from '../lib/defaults'
import { useAppBase } from '../lib/useAppBase'

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed, HardHat, Truck, Sparkles, ShoppingBag, HeartHandshake,
}

export function NewCampaignWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createCampaign } = useStore()
  const { company } = useAuth()
  const navigate = useNavigate()
  const base = useAppBase()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  const pick = async (key: string, t?: SectorTemplate) => {
    if (!company || busy) return
    setBusy(key)
    const input = t ? templateCampaignInput(t, company.accent) : blankCampaignInput(company.accent)
    const c = await createCampaign(input)
    setBusy(null)
    if (c) {
      onClose()
      navigate(`${base}/puestos/${c.id}/formulario`)
    } else {
      toast.error('No se pudo crear el puesto.')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }} onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-pop"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="wizard-title" className="text-lg font-semibold text-slate-900">Nuevo puesto</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">Elige un punto de partida. Podrás cambiarlo todo después.</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {TEMPLATES.map((t) => {
                  const Icon = ICONS[t.icon] ?? PenLine
                  const loading = busy === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => pick(t.key, t)}
                      disabled={!!busy}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{t.label}</span>
                      <span className="text-[12px] text-slate-500">{t.title} · {t.fields.length} preguntas</span>
                    </button>
                  )
                })}

                <button
                  onClick={() => pick('blank')}
                  disabled={!!busy}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    {busy === 'blank' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PenLine className="size-5" aria-hidden />}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">Desde cero</span>
                  <span className="text-[12px] text-slate-500">Solo nombre y teléfono</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

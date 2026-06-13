import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Link2Off } from 'lucide-react'
import { useStore } from '../lib/store'
import { ApplicationForm } from '../components/ApplicationForm'
import { FieldRenderer, validateField } from '../components/FieldRenderer'
import type { FieldValue } from '../components/FieldRenderer'
import { readableOn } from '../lib/colors'
import { BRAND } from '../lib/brand'
import type { Campaign } from '../lib/types'

void FieldRenderer // mismo render que el builder (WYSIWYG)

export function PublicForm() {
  const { slug } = useParams()
  const { getCampaignBySlug, addCandidate, data } = useStore()
  const campaign = getCampaignBySlug(slug!)

  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const formTop = useRef<HTMLDivElement>(null)

  // Enlace no activo
  if (!campaign || campaign.status === 'cerrada') {
    return (
      <CenteredCard>
        <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <Link2Off className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Este enlace ya no está activo</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          La empresa ha cerrado esta oferta. Si crees que es un error, contacta con quien te lo compartió.
        </p>
      </CenteredCard>
    )
  }

  if (done) return <ThankYou campaign={campaign} companyName={data.company.name} />

  const onChange = (id: string, v: FieldValue) => {
    setValues((p) => ({ ...p, [id]: v }))
    // limpia el error de ese campo al corregir
    setErrors((p) => (p[id] ? { ...p, [id]: '' } : p))
  }

  const onBlur = (id: string) => {
    const field = campaign.fields.find((f) => f.id === id)!
    const err = validateField(field, values[id])
    setErrors((p) => ({ ...p, [id]: err ?? '' }))
  }

  const submit = () => {
    const next: Record<string, string> = {}
    for (const f of campaign.fields) {
      const err = validateField(f, values[f.id])
      if (err) next[f.id] = err
    }
    setErrors(next)
    if (Object.keys(next).filter((k) => next[k]).length > 0) {
      formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setSubmitting(true)
    // limpia valores vacíos/undefined antes de guardar
    const answers = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
    ) as Record<string, string | string[] | boolean>
    // simula el envío
    window.setTimeout(() => {
      addCandidate(campaign.id, answers, 'enlace')
      setSubmitting(false)
      setDone(true)
    }, 900)
  }

  // Limpia errores vacíos antes de pasar al render
  const cleanErrors = Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Record<string, string>

  return (
    <div className="min-h-svh bg-slate-50 px-4 py-8 sm:py-12">
      <div ref={formTop} className="mx-auto w-full max-w-[480px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
          <ApplicationForm
            campaign={campaign}
            values={values}
            errors={cleanErrors}
            onChange={onChange}
            onBlur={onBlur}
            onSubmit={submit}
            submitting={submitting}
            companyName={data.company.name}
          />
        </div>
        <p className="mt-4 text-center text-[12px] text-slate-400">
          Formulario con {BRAND}
        </p>
      </div>
    </div>
  )
}

function ThankYou({ campaign, companyName }: { campaign: Campaign; companyName: string }) {
  const h1 = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    h1.current?.focus()
  }, [])
  const accent = campaign.branding.accent
  return (
    <div className="min-h-svh bg-slate-50 px-4 py-8 sm:py-12" style={{ ['--accent' as string]: accent, ['--accent-contrast' as string]: readableOn(accent) }}>
      <div className="mx-auto w-full max-w-[480px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-card" role="status">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
            className="mx-auto grid size-14 place-items-center rounded-full bg-green-100 text-green-600"
          >
            <Check className="size-7" aria-hidden />
          </motion.div>
          <h1 ref={h1} tabIndex={-1} className="mt-4 text-[22px] font-bold tracking-tight text-slate-900 outline-none">
            Gracias, hemos recibido tu candidatura
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            {campaign.branding.thanks ||
              'La empresa revisará tu candidatura y te contactará si encaja con el puesto.'}
          </p>
        </div>
        <p className="mt-4 text-center text-[12px] text-slate-400">Formulario con {BRAND} · enviado a {companyName}</p>
      </div>
    </div>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-card">
        {children}
      </div>
    </div>
  )
}

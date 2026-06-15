import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAppBase } from '../lib/useAppBase'
import { FEATURE_COPY, PLAN_LABEL, type PlanFeature } from '../lib/pricing'
import { BTN_PRIMARY } from '../lib/buttons'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Pantalla completa para cuando se entra por URL directa a una sección que el
// plan no incluye (el menú ya la muestra bloqueada, pero esto cubre el acceso
// directo o un enlace guardado). Mismo mensaje que el aviso modal.
export function FeatureLocked({
  feature,
  featureLabel,
  blurb,
}: {
  feature: PlanFeature
  featureLabel?: string
  blurb?: string
}) {
  const navigate = useNavigate()
  const base = useAppBase()
  const copy = FEATURE_COPY[feature]
  const name = featureLabel ?? copy.label
  const planLabel = PLAN_LABEL[copy.minPlan]

  return (
    <div className="grid h-full place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Lock className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{cap(name)}</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
          {blurb ?? copy.blurb} Es una función del plan {planLabel}, así que tu plan actual no la incluye. Sube de plan
          para desbloquearla.
        </p>
        <button onClick={() => navigate(`${base}/plan`)} className={`${BTN_PRIMARY} mt-6`}>
          Ver planes
        </button>
      </div>
    </div>
  )
}

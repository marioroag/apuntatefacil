import { useNavigate } from 'react-router-dom'
import { useAppBase } from '../lib/useAppBase'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { FEATURE_COPY, PLAN_LABEL, type PlanFeature } from '../lib/pricing'

// Aviso al intentar usar una feature que el plan actual no incluye. Dice qué
// falta y con qué plan se desbloquea; confirmar lleva a la pantalla de planes.
// La etiqueta y el plan mínimo salen de FEATURE_COPY; se pueden sobreescribir
// (p. ej. etiqueta distinta a la de FEATURE_COPY cuando haga falta).
export function UpgradeDialog({
  open,
  onClose,
  feature,
  featureLabel,
}: {
  open: boolean
  onClose: () => void
  feature: PlanFeature
  featureLabel?: string
}) {
  const navigate = useNavigate()
  const base = useAppBase()
  const { label, minPlan } = FEATURE_COPY[feature]
  const name = featureLabel ?? label
  const planLabel = PLAN_LABEL[minPlan]

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => {
        onClose()
        navigate(`${base}/plan`)
      }}
      title={`Desbloquea ${name} con ${planLabel}`}
      confirmLabel="Ver planes"
      cancelLabel="Ahora no"
    >
      <p className="text-sm leading-relaxed text-slate-600">
        Tu plan actual no incluye {name}. Es una función del plan{' '}
        <strong className="font-semibold text-slate-900">{planLabel}</strong>: sube de plan para empezar a usarla.
      </p>
    </ConfirmDialog>
  )
}

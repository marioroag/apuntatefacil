import { useNavigate } from 'react-router-dom'
import { useAppBase } from '../lib/useAppBase'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { PLAN_CANDIDATE_LIMIT } from '../lib/pricing'

// Aviso que salta al abrir el panel cuando el plan de Prueba ha llegado al tope de
// candidatos y su puesto se ha pausado. Reaparece en cada apertura del panel hasta
// que el cliente sube de plan; confirmar lleva a la pantalla de planes.
export function TrialPausedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const base = useAppBase()
  const limit = PLAN_CANDIDATE_LIMIT.trial

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => {
        onClose()
        navigate(`${base}/plan`)
      }}
      title="Tu puesto está en pausa"
      confirmLabel="Ver planes"
      cancelLabel="Entendido"
    >
      <p className="text-sm leading-relaxed text-slate-600">
        El plan de Prueba admite hasta{' '}
        <strong className="font-semibold text-slate-900">{limit} candidatos</strong>. Has llegado al tope,
        así que hemos pausado tu puesto para no perder a nadie. Sube de plan para reactivarlo y seguir
        recibiendo candidaturas.
      </p>
    </ConfirmDialog>
  )
}

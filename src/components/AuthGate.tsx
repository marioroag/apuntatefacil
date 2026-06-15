import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Onboarding } from '../screens/Onboarding'
import { Paywall } from '../screens/Paywall'

function FullSpinner() {
  return (
    <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
      <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
    </div>
  )
}

/** Protege /app: exige sesión y empresa. Si falta empresa, muestra onboarding. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, company, companyLoading } = useAuth()
  if (loading) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (companyLoading && !company) return <FullSpinner />
  if (!company) return <Onboarding />
  // El plan "Prueba" no da acceso: hay que contratar un plan de pago para usar el panel.
  if (company.plan === 'trial') return <Paywall />
  return <>{children}</>
}

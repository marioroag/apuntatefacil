import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Onboarding } from '../screens/Onboarding'

function FullSpinner() {
  return (
    <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
      <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
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
  // El plan "Prueba" SÍ da acceso al panel, con topes (1 puesto, 15 candidatos).
  // El puesto se pausa al llegar al tope y se avisa para subir de plan.
  return <>{children}</>
}

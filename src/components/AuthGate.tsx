import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, WifiOff } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Onboarding } from '../screens/Onboarding'
import { BTN_PRIMARY } from '../lib/buttons'

function FullSpinner() {
  return (
    <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
      <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
    </div>
  )
}

/**
 * NO SE PUDO CARGAR TU EMPRESA, que no es lo mismo que no tenerla.
 *
 * Esta pantalla existe porque su ausencia costó un fallo grave en producción
 * (26-ago-2026): al no poder cargar, la app caía en `!company` y enseñaba el
 * onboarding, o sea que le pedía a alguien con su empresa montada que se creara
 * otra. Un error se dice; no se disfraza del principio del producto.
 */
function ErrorDeCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl filo bg-white p-6 text-center shadow-card">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <WifiOff className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">No hemos podido cargar tu empresa</h1>
        {/* El motivo, no un "algo ha ido mal": lo que se hace después depende de
            si es la conexión o es otra cosa. */}
        <p className="mt-1 text-sm text-slate-500">{mensaje}</p>
        <button type="button" onClick={onReintentar} className={`${BTN_PRIMARY} mt-5 w-full`}>
          Reintentar
        </button>
        <p className="mt-3 text-[13px] text-slate-500">
          Tus datos están intactos: esto es un problema al leerlos, no al guardarlos.
        </p>
      </div>
    </div>
  )
}

/**
 * Protege /app: exige sesión y empresa.
 *
 * TRES estados y no dos, y ese es el arreglo: cargando, no se pudo saber, y
 * sabido. Solo el tercero, con la lista vacía de verdad, lleva al onboarding.
 * Antes había dos (`company` o no `company`) y cualquier fallo de carga se
 * convertía en "eres un usuario nuevo, crea tu empresa".
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, company, companyLoading, companyError, retryCompanies } = useAuth()
  if (loading) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (companyLoading && !company) return <FullSpinner />
  // Antes de decidir que no tienes empresa, hay que haber podido preguntarlo.
  if (companyError && !company) return <ErrorDeCarga mensaje={companyError} onReintentar={retryCompanies} />
  if (!company) return <Onboarding />
  // La prueba SÍ da acceso al panel, con topes (1 proceso, 25 candidaturas o
  // 15 días). Al agotarse se sigue recopilando: las candidaturas nuevas entran
  // bloqueadas hasta añadir el método de pago.
  return <>{children}</>
}

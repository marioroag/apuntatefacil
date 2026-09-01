import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, WifiOff } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Onboarding } from '../screens/Onboarding'
import { BTN_PRIMARY } from '../lib/buttons'
import { IconoVacio } from './ui/IconoVacio'

/** Se exporta para que la puerta de la demo (`SoloSoporte`) espere con la MISMA
 *  pantalla: dos ruedas distintas para lo mismo se separan al primer retoque. */
export function FullSpinner() {
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
function ErrorDeCarga({
  mensaje,
  onReintentar,
  onSalir,
}: {
  mensaje: string
  onReintentar: () => void
  onSalir: () => void
}) {
  // El mensaje trae el detalle técnico en su segunda línea, si lo hay.
  const [texto, codigo] = mensaje.split('\n')
  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl filo bg-white p-6 text-center shadow-card">
        <IconoVacio Icon={WifiOff} />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">No hemos podido cargar tu empresa</h1>
        <p className="mt-1 text-sm text-slate-500">{texto}</p>
        <button type="button" onClick={onReintentar} className={`${BTN_PRIMARY} mt-5 w-full`}>
          Reintentar
        </button>
        {/* UNA PANTALLA DE ERROR SIEMPRE TIENE UNA SALIDA, y esto no es un detalle
            de estilo: con solo "Reintentar", un fallo que se repite deja a la
            persona ENCERRADA en la aplicación, sin poder ni siquiera cambiar de
            cuenta. Pasó (26-ago-2026) y es peor que el error que la trajo aquí. */}
        <button
          type="button"
          onClick={onSalir}
          className="mt-3 w-full text-[13px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Cerrar sesión y volver a entrar
        </button>
        <p className="mt-4 text-[13px] text-slate-500">
          Tus datos están intactos: esto es un problema al leerlos, no al guardarlos.
        </p>
        {/* El código, para poder decirlo al pedir ayuda. Seleccionable y en su
            propia línea: no estorba a quien solo quiere reintentar. */}
        {codigo && (
          <p className="mt-3 select-all break-words rounded-lg bg-slate-50 px-3 py-2 text-left text-[12px] leading-relaxed text-slate-500">
            {codigo}
          </p>
        )}
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
  const { loading, session, company, companyLoading, companyError, retryCompanies, signOut } = useAuth()
  if (loading) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (companyLoading && !company) return <FullSpinner />
  // Antes de decidir que no tienes empresa, hay que haber podido preguntarlo.
  if (companyError && !company)
    return <ErrorDeCarga mensaje={companyError} onReintentar={retryCompanies} onSalir={signOut} />
  if (!company) return <Onboarding />
  // La prueba SÍ da acceso al panel: 1 proceso abierto y 15 días, sin tope de
  // candidaturas. Al caducar se sigue recopilando: las nuevas entran bloqueadas
  // hasta añadir el método de pago.
  return <>{children}</>
}

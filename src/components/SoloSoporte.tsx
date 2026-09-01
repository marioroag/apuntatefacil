import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSoporte } from '../lib/useSupportStaff'
import { FullSpinner } from './AuthGate'

/**
 * LA DEMO YA NO ES PÚBLICA (Mario, ago 2026).
 *
 * Hasta ahora `/demo` la abría cualquiera desde la landing, y ese era el argumento de
 * media página ("pruébalo sin registro ni tarjeta"). Ahora la landing ofrece SOLICITAR
 * una demo, que lleva a la agenda de Mario, y el producto de ejemplo se queda para
 * enseñarlo nosotros. Así que esto es una puerta de verdad y no un enlace escondido:
 * quitar el botón de la landing no habría cerrado nada, porque la URL se teclea.
 *
 * Quién pasa lo decide el BACKEND (`is_support_staff`, con su allowlist en la
 * migración), no el cliente. Es la misma puerta que ya guarda la bandeja de soporte y
 * el panel de admin, así que no hay un segundo concepto de "administrador" que
 * mantener a mano.
 *
 * Mientras se pregunta se espera: adivinar que sí enseñaría un instante lo de dentro a
 * quien no debe verlo, y adivinar que no echaría a quien sí puede antes de que llegue
 * la respuesta. Después de la primera vez el valor está cacheado y la puerta abre sin
 * espera.
 *
 * Al rechazar se va a la portada y no a una pantalla de "no puedes": para quien no es
 * del equipo esta dirección no existe, que es lo que esta casa hace siempre con lo que
 * no está disponible.
 */
export function SoloSoporte({ children }: { children: ReactNode }) {
  const soporte = useSoporte()
  if (soporte === null) return <FullSpinner />
  if (!soporte) return <Navigate to="/" replace />
  return <>{children}</>
}

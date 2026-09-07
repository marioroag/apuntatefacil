import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSoporte } from '../lib/useSupportStaff'
import { FullSpinner } from './AuthGate'

/**
 * HOY LA PUERTA ESTÁ ABIERTA (Mario, ago 2026: "deja la puerta abierta de momento
 * aunque no esté conectada a ningún botón, te avisaré cuando la quitemos").
 *
 * Una sola bandera manda, como `ANILLO_AJUSTE`: el código de la
 * puerta se queda ENTERO, así que cerrarla nunca más es volver a poner `true`. Lo
 * que NO se hace es quitar el `SoloSoporte` de la ruta y guardarlo para luego: un
 * componente que no monta nadie se pudre, y devolverlo sería reescribirlo.
 *
 * Y no es una trampa de desarrollo, que es lo contrario: una bandera que se salta
 * la puerta SOLO en local acaba viajando a producción sin que nadie lo note, y
 * encima haría que lo que probamos no sea lo que la gente usa. Esto vale igual en
 * los dos sitios, y por eso se puede decir en una línea qué está pasando.
 *
 * LO QUE CUESTA, DICHO: con la bandera en `false`, `/demo` la abre CUALQUIERA que
 * teclee la dirección. No hay ningún enlace (el botón de la landing lleva a la
 * agenda de cal.com), pero eso es esconderla, no cerrarla. Se acepta porque ahí
 * dentro no hay nada de nadie: `DemoAuthProvider` fabrica la sesión y la empresa,
 * los datos son el seed y `esDemo` corta cualquier escritura, así que lo único que
 * se enseña es el producto de ejemplo, que es lo que hacía hasta ago 2026.
 *
 * ---
 *
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
export const DEMO_SOLO_EQUIPO = false

export function SoloSoporte({ children }: { children: ReactNode }) {
  // El hook se pregunta SIEMPRE, con la puerta abierta o cerrada: por encima de un
  // hook no puede haber un `return`, que es lo que vigila `hooks.test.ts`. Cuesta
  // una consulta por sesión, y está cacheada a nivel de módulo.
  const soporte = useSoporte()
  if (!DEMO_SOLO_EQUIPO) return <>{children}</>
  if (soporte === null) return <FullSpinner />
  if (!soporte) return <Navigate to="/" replace />
  return <>{children}</>
}

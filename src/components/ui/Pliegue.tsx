import type { ReactNode } from 'react'

/**
 * EL PLIEGUE: algo que se despliega y se recoge SIN montarse ni desmontarse.
 *
 * Nació en el lateral (la sublista de puestos, con el raíl estrechándose): quitar
 * la lista del DOM haría que todo lo de debajo pegara un salto de 200px en el
 * fotograma 0, que es exactamente el tirón que aquella versión vino a quitar.
 * Plegado sigue ahí, con alto cero. Lo usan también las tarjetas de la torre de
 * primeros pasos, que abren su cuerpo cuando les toca.
 *
 * La altura se anima con `grid-template-rows: 1fr -> 0fr` y NO con `max-height`,
 * por lo mismo que el informe de Meridian: un techo inventado o corta el contenido
 * o deja el final del recorrido vacío, y aquí el alto depende de lo que haya
 * dentro. Con el grid, el recorrido es siempre el alto real.
 *
 * `inert` mientras está plegado: sin él, lo de dentro seguiría en el tabulador y
 * en el lector de pantalla detrás de algo que no se ve. Es la misma pareja
 * (sigue en el DOM + inert) que ya usa el informe de Meridian.
 *
 * `ritmo`: el lateral va a `--duration-max` con la curva estándar porque se
 * pliega AL RITMO DEL RAÍL (240ms); una tarjeta que abre su cuerpo al hacer
 * clic es "algo que aparece", `--duration-enter`.
 */
export function Pliegue({ abierto, children, ritmo = 'rail' }: { abierto: boolean; children: ReactNode; ritmo?: 'rail' | 'aparecer' }) {
  const tiempo =
    ritmo === 'rail'
      ? 'duration-[var(--duration-max)] ease-[var(--ease-standard)]'
      : 'duration-[var(--duration-enter)] ease-[var(--ease-out)]'
  return (
    <div
      className={`grid transition-[grid-template-rows] ${tiempo} motion-reduce:transition-none ${
        abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      {/* `min-h-0` no es decorativo: un elemento de rejilla trae `min-height:
          auto`, así que la pista de `0fr` NO puede encoger por debajo del alto del
          contenido y la lista se quedaba entera a la vista. Se midió: 30px por
          fila con el pliegue "cerrado". */}
      <div className="min-h-0 overflow-hidden" inert={!abierto || undefined}>
        {children}
      </div>
    </div>
  )
}

/**
 * Las mismas tres duraciones del CSS (`--duration-*` en `index.css`), en
 * segundos, para Framer Motion.
 *
 * Framer Motion no lee variables CSS: pide un número. Hasta ahora cada overlay
 * escribía el suyo a mano (0.16 en un telón, 0.18 en un panel, 0.24 en otro),
 * que es justo lo que prohíbe la regla del acabado: lo que se decide, se
 * NOMBRA. Un número suelto en el `transition` de una pantalla es el que nadie
 * vuelve a tocar cuando el sistema cambia, y así es como aparecieron un 0.16 y
 * un 0.18 que no eran ninguna de las tres duraciones del sistema.
 *
 * Si cambian los tokens del CSS, cambian aquí. No hay una tercera copia.
 */
export const DUR = {
  /** 150ms: responde al dedo. También lo que SALE porque tú lo has cerrado. */
  control: 0.15,
  /** 180ms: algo aparece. */
  enter: 0.18,
  /** 240ms: el techo. Overlays grandes que recorren distancia. */
  max: 0.24,
} as const

/**
 * Las curvas, por el mismo motivo y con el mismo cuidado. Framer Motion tampoco
 * lee `--ease-*`, así que se declaran aquí una vez.
 *
 * Y este caso era peor que el de las duraciones: había CINCO constantes llamadas
 * `CURVA` sueltas por `components/ui` con DOS valores distintos, así que el
 * siguiente que las subiera a un sitio común vería declaraciones "iguales", haría
 * el hoist y se llevaría por delante la que no lo era, porque se llama igual.
 * Dos curvas, dos nombres.
 */
export const EASE = {
  /** `--ease-out`. Lo que RESPONDE a tu dedo: entra rápido y frena al final. */
  out: [0, 0, 0.2, 1] as const,
  /** `--ease-standard`. Lo que TRANSFORMA algo de un estado a otro: entra y sale despacio. */
  standard: [0.4, 0, 0.2, 1] as const,
} as const

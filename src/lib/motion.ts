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

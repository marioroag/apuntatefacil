import type { MouseEvent } from 'react'

/**
 * Filas de tabla que abren una ficha al pulsarlas.
 *
 * La regla es "toda la fila abre, MENOS lo que ya es un control", y se decide
 * mirando DÓNDE nace el click, no apagando celdas enteras con
 * `onClick={e => e.stopPropagation()}`.
 *
 * Apagar celdas fue el origen de un fallo caro (ago 2026): en una tabla
 * `table-fixed`, la columna que no declara ancho se queda con TODO el espacio
 * sobrante. La de Etiquetas del puesto medía 350px de los 1174 de la fila, así
 * que silenciarla dejaba muerta casi un tercio de la superficie pulsable, justo
 * la franja central por la que se pulsa. Y como esa columna solo existe a partir
 * de `xl`, el fallo se curaba solo al estrechar la ventana: parecía cosa del
 * navegador y no lo era, era dónde pulsabas. Lo mismo en la Bandeja con la
 * columna de Puesto, que también es la elástica.
 *
 * Dentro de una fila solo hay controles reales (`<button>`, `<a>`, `<input>`:
 * la doctrina prohíbe los `div` pulsables), así que `closest` los cubre todos;
 * y los menús que se pintan en un portal ni siquiera pasan por aquí.
 */
const CONTROLES = 'a, button, input, label, select, textarea, [role="button"], [role="option"]'

/** true si el click es de la FILA, no de un control que viva dentro de ella. */
export function clickDeFila(e: Pick<MouseEvent<HTMLElement>, 'target'>): boolean {
  // Por `closest` y no por `instanceof Element`: así la regla se puede probar
  // sin montar un DOM entero, que es lo que hace que llegue a haber prueba.
  const t = e.target as { closest?: (s: string) => unknown } | null
  return typeof t?.closest === 'function' ? !t.closest(CONTROLES) : true
}

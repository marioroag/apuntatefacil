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

/* ---------------------------------------------------------------------------
   LA SELECCIÓN INVADE DESDE LA FILA DE AL LADO (Mario, sep 2026)
   ---------------------------------------------------------------------------
   Marcar una fila PEGADA a otra ya marcada no es empezar una selección: es
   agrandar la que ya hay. Apareciendo de golpe las dos cosas se ven igual, y
   para saber cuánto abarca lo marcado hay que releer la columna de casillas;
   con el tinte entrando por el filo que las dos comparten, el bloque se lee
   como bloque en el mismo momento en que crece. Dice POR DÓNDE ha crecido la
   selección, que es información y no adorno.

   Aquí vive solo la DECISIÓN (qué fila invade y desde qué lado); cómo se pinta
   está en `.fila-invade` (src/index.css). Y vive aquí, en un módulo que se
   prueba, porque lo que la sostiene no se ve fallar de un vistazo: hace falta la
   selección ANTERIOR para saber cuál se acaba de marcar, y el vecino se busca en
   el orden en el que la tabla PINTA las filas (que cambia al ordenar), no en el
   de los datos.
--------------------------------------------------------------------------- */

/** Desde qué filo entra el tinte: el de la vecina que ya estaba marcada. */
export type Invasion = 'arriba' | 'abajo' | 'ambos'

/**
 * Qué fila invade tras un cambio de selección, y desde dónde.
 *
 * `ids` son las filas EN EL ORDEN EN QUE SE PINTAN (en móvil el orden de las
 * columnas cambia, el de las filas no, pero ordenar la tabla sí lo cambia:
 * "contiguo" es lo que se ve pegado, no lo que va seguido en la base).
 *
 * SOLO INVADE SI SE HA MARCADO UNA, y no es una limitación técnica: la invasión
 * cuenta que esta fila se ha unido a las de al lado, y cuando se marcan muchas
 * a la vez ("seleccionar todo") no hay "las de al lado", llegan todas juntas.
 * Sale gratis además el caso que importa: en un seleccionar-todo desde cero
 * ninguna tenía vecina marcada ANTES, así que la lista se tiñe entera de golpe
 * en vez de dejar dos filas rezagadas animándose.
 */
export function invasionDeSeleccion(
  ids: string[],
  antes: ReadonlySet<string>,
  ahora: ReadonlySet<string>,
): Map<string, Invasion> {
  const out = new Map<string, Invasion>()
  let i = -1
  for (let n = 0; n < ids.length; n++) {
    if (!ahora.has(ids[n]) || antes.has(ids[n])) continue
    if (i !== -1) return out // más de una marcada a la vez: no hay "la de al lado"
    i = n
  }
  if (i === -1) return out // no se ha marcado ninguna (se ha desmarcado, u ordenado)

  const arriba = i > 0 && antes.has(ids[i - 1])
  const abajo = i < ids.length - 1 && antes.has(ids[i + 1])
  // Rellenando un hueco entre dos ya marcadas entra por los DOS filos: las dos
  // son de donde viene, y elegir una sola diría que la otra no cuenta.
  if (arriba && abajo) out.set(ids[i], 'ambos')
  else if (arriba) out.set(ids[i], 'arriba')
  else if (abajo) out.set(ids[i], 'abajo')
  return out
}

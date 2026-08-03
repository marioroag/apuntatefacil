/**
 * Dónde se coloca algo que FLOTA sobre la interfaz (tooltip, desplegable, menú).
 *
 * El fallo que resuelve: un globo colocado con `absolute left-1/2 -translate-x-1/2`
 * mide su sitio contra su padre, que no sabe nada de la ventana. Cerca de un filo
 * (o dentro de un panel con scroll) se sale y se corta a media palabra, que es
 * exactamente lo que pasaba con la ayuda de "Etiquetas" en la ficha del candidato.
 * Y como el corte depende del ancho de la ventana, parece cosa del navegador
 * cuando en realidad es dónde estaba el ancla.
 *
 * La regla es una sola y vale para cualquier cosa que flote: se coloca respecto a
 * la VENTANA (por eso quien la usa pinta en un portal con `position: fixed`, así
 * ningún `overflow` de antepasado puede recortarla), se prefiere abajo, se sube
 * solo si abajo no cabe y arriba sí, y en horizontal se aprieta contra el filo en
 * vez de salirse. Nunca desaparece texto: como mucho, se descentra.
 *
 * Función pura y sin DOM, para poder probarla de verdad (`flotante.test.ts`) sin
 * montar media aplicación.
 */

export type Caja = { top: number; bottom: number; left: number; right: number }
export type Lado = 'arriba' | 'abajo'
export type Colocacion = { top: number; left: number; lado: Lado }

/** Aire mínimo contra el filo de la ventana. */
const MARGEN = 8
/** Separación entre el ancla y lo que flota. */
const HUECO = 6

export function colocarFlotante(
  ancla: Caja,
  tam: { width: number; height: number },
  vista: { width: number; height: number },
  opts: {
    margen?: number
    hueco?: number
    /** Contra qué se alinea en horizontal antes de apretar contra el filo. */
    alinear?: 'centro' | 'izquierda' | 'derecha'
    /** Fuerza el lado; por defecto se decide por el hueco disponible. */
    lado?: Lado
  } = {},
): Colocacion {
  const { margen = MARGEN, hueco = HUECO, alinear = 'centro' } = opts

  const cabeAbajo = ancla.bottom + hueco + tam.height + margen <= vista.height
  const cabeArriba = ancla.top - hueco - tam.height - margen >= 0
  // Abajo por defecto: es donde el ojo busca la explicación de lo que acaba de
  // señalar. Solo sube si abajo no cabe Y arriba sí; si no cabe en ninguno de los
  // dos, se queda abajo (subir tampoco lo arreglaría y cambiaría de sitio por nada).
  const lado = opts.lado ?? (cabeAbajo || !cabeArriba ? 'abajo' : 'arriba')

  const top = lado === 'abajo' ? ancla.bottom + hueco : ancla.top - hueco - tam.height

  const crudo =
    alinear === 'izquierda'
      ? ancla.left
      : alinear === 'derecha'
        ? ancla.right - tam.width
        : (ancla.left + ancla.right) / 2 - tam.width / 2

  // El tope nunca puede quedar por debajo del suelo: si lo que flota es más ancho
  // que la ventana, se pega al margen izquierdo y quien lo pinta se encarga de que
  // no llegue a ese caso (ancho máximo relativo a la ventana).
  const tope = Math.max(margen, vista.width - tam.width - margen)
  const left = Math.min(Math.max(crudo, margen), tope)

  // A pixel entero: medio pixel emborrona el texto y el filo de 1px, que es
  // justo lo que la doctrina de acabado no perdona.
  return { top: Math.round(Math.max(margen, top)), left: Math.round(left), lado }
}

/**
 * Borde superior e inferior de lo que se VE alrededor de un elemento. No basta con
 * la ventana: un desplegable dibujado dentro de un panel con scroll lo corta ESE
 * borde, no el de la pantalla. Se queda con el primer antepasado que recorta.
 *
 * Lo usan los flotantes que sí viven en el flujo (el desplegable de etiquetas) y
 * los que están en un portal, para saber si su ancla se ha ido de la vista.
 */
export function limitesVisibles(el: HTMLElement): [number, number] {
  let p = el.parentElement
  while (p) {
    const ov = getComputedStyle(p).overflowY
    if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') {
      const caja = p.getBoundingClientRect()
      return [Math.max(caja.top, 0), Math.min(caja.bottom, window.innerHeight)]
    }
    p = p.parentElement
  }
  return [0, window.innerHeight]
}

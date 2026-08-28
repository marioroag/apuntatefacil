import { useEffect, useState } from 'react'

/**
 * ¿ESTAMOS EN UN ANCHO DE MÓVIL? Una sola respuesta para toda la app.
 *
 * Esta consulta estaba escrita a mano tres veces solo en el panel del puesto (la
 * hoja del menú de puesto, la de compartir y ahora el buscador), cada una con su
 * `useState` de arranque y su `useEffect` de suscripción, y las tres con el mismo
 * breakpoint copiado como número suelto. Es la forma exacta en que un valor
 * empieza a derivar: basta con que alguien toque el `sm` de Tailwind y solo se
 * entere una de las tres.
 *
 * Se pregunta en JS y NO con una media query de CSS cuando lo que cambia no es
 * cómo se ve algo, sino qué se MONTA (una hoja que atrapa el foco) o qué SIGNIFICA
 * un control (una lupa que pliega un campo contra una lupa que solo adorna). Para
 * lo puramente visual mandan las variantes de Tailwind, que no cuestan render.
 *
 * El valor de arranque se lee de forma síncrona: con `false` inicial, el primer
 * pintado de un móvil sería el de escritorio y se vería el cambio.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

/** Por debajo de `sm` (639px), que es donde el panel deja de tener dos columnas. */
export const useEsMovil = () => useMediaQuery('(max-width: 639px)')

/**
 * ¿CABEN DOS COLUMNAS? A partir de `lg` (1024px). Lo usa el anuncio público para
 * MONTAR su raíl o repartir sus piezas en la columna, en vez de pintar las dos
 * cosas y esconder una con `hidden lg:block`: eso deja los mismos enlaces dos
 * veces en el DOM, y quien navega con el tabulador o con lector recorre las
 * ofertas por duplicado. Es la misma regla que obliga a montar el raíl de la
 * ficha del candidato y la hoja del menú de puesto solo donde se usan.
 */
export const useHayDosColumnas = () => useMediaQuery('(min-width: 1024px)')

/**
 * ¿HAY TECLADO EN PANTALLA? Se pregunta por el PUNTERO, no por el ancho.
 *
 * Lo usa lo único que de verdad depende de esto: **el foco automático**. Enfocar
 * un campo al abrir un menú es un acierto con teclado físico (escribes y filtras
 * sin tocar el ratón) y una molestia en táctil, porque levanta el teclado del
 * sistema, se come media pantalla y tapa justo la lista que ibas a mirar. Y peor
 * si el menú tiene páginas: se vuelve a levantar en cada paso.
 *
 * Por el puntero y no por el ancho porque la causa es el teclado del sistema, no
 * el tamaño: una tablet de 1024px en horizontal tiene el mismo problema y un
 * portátil estrecho no lo tiene. Es la misma distinción que ya hace la doctrina
 * en CSS con `pointer-coarse` para los objetivos de toque.
 */
export const useEsTactil = () => useMediaQuery('(pointer: coarse)')

/**
 * "Prefiero menos movimiento." Se pregunta en JS y no solo con `motion-reduce:`
 * cuando lo que hay que evitar no es la transición sino el ESTADO DE PARTIDA: una
 * animación que arranca desde cero (la gráfica creciendo desde su eje) sin
 * transición pinta un fotograma vacío antes de aparecer, y eso es un parpadeo, no
 * una animación más corta. Para lo demás siguen mandando las variantes de CSS,
 * que no cuestan render.
 */
export const useMenosMovimiento = () => useMediaQuery('(prefers-reduced-motion: reduce)')

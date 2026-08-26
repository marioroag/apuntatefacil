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

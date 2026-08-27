import { useLayoutEffect, useState, type RefObject } from 'react'

/* ---------------------------------------------------------------------------
   "AQUÍ SIGUE HABIENDO COSAS": el filo que se desvanece por donde continúa.
   ---------------------------------------------------------------------------
   Una zona que scrollea dentro de otra que también scrollea no tiene forma de
   anunciarse: la barra del navegador o no se ve (macOS la esconde) o es de un
   pixel, y en táctil no existe. Sin nada, lo que hay más allá del filo
   sencillamente no existe para quien mira.

   La respuesta es recortar con una máscara el lado por el que la lista CONTINÚA.
   No pinta nada encima, así que funciona sobre cualquier fondo, y solo aparece
   donde de verdad hay algo más: llegar al final apaga su desvanecido, que es
   justo lo que dice "hasta aquí".

   **Es la excepción declarada a "sin gradientes"** (la segunda, después del
   barrido del skeleton), y se sostiene porque no es pintura: es información.

   Vive aquí y no dentro de un componente porque ya son dos consumidores en dos
   ejes distintos: la tira de pastillas de `ui/Tabs` (horizontal) y la lista de
   horas de `ui/DateTimePicker` (vertical). Escrito dos veces, el día que se
   afine el desvanecido solo se afinaría uno.
--------------------------------------------------------------------------- */

/** Cuánto se desvanece el filo por el que la lista continúa. */
const DESVANECIDO = 24

export function useDesvanecido(
  ref: RefObject<HTMLElement | null>,
  eje: 'x' | 'y',
  {
    activo = true,
    /** Cualquier valor que, al cambiar, obligue a volver a medir (el contenido
     *  de la lista, por ejemplo: un `ResizeObserver` sobre el contenedor no se
     *  entera de que sus hijos son otros). */
    senal,
  }: { activo?: boolean; senal?: unknown } = {},
): string | undefined {
  const [borde, setBorde] = useState({ inicio: false, fin: false })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !activo) return
    const mirar = () => {
      const pos = eje === 'x' ? el.scrollLeft : el.scrollTop
      const sobra = eje === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight
      // El margen de 1px no es paranoia: con zoom del navegador o pantallas
      // fraccionarias, `scrollLeft` se queda en 0,4 al principio de todo y el
      // filo de arriba parpadearía sin que nadie haya scrolleado.
      setBorde({ inicio: pos > 1, fin: sobra - pos > 1 })
    }
    mirar()
    el.addEventListener('scroll', mirar, { passive: true })
    const ro = new ResizeObserver(mirar)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', mirar)
      ro.disconnect()
    }
  }, [ref, eje, activo, senal])

  if (!activo || (!borde.inicio && !borde.fin)) return undefined
  const hacia = eje === 'x' ? 'to right' : 'to bottom'
  return `linear-gradient(${hacia}, transparent 0, black ${borde.inicio ? DESVANECIDO : 0}px, black calc(100% - ${
    borde.fin ? DESVANECIDO : 0
  }px), transparent 100%)`
}

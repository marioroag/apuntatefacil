import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { colocarFlotante, limitesVisibles } from '../../lib/flotante'

/**
 * LA ÚNICA FORMA DE UN TOOLTIP EN LA APP.
 *
 * Antes cada sitio se pintaba el suyo con `absolute left-1/2 -translate-x-1/2`, y
 * eso se corta siempre: el globo se mide contra su padre, que no sabe dónde está
 * el filo de la ventana, y encima cualquier antepasado con `overflow` lo recorta.
 * La ayuda de "Etiquetas" en la ficha del candidato se salía por la izquierda y se
 * leía "as etiquetas son internas de tu mpresa". El fallo no era de esa pantalla:
 * era de no tener una pieza.
 *
 * Cómo no vuelve a pasar, y por qué no hay que arreglarlo tooltip a tooltip:
 *  - Se pinta en un PORTAL con `position: fixed`. Ningún `overflow` de la fila, la
 *    tarjeta o el panel con scroll puede recortarlo, esté donde esté el ancla.
 *  - Se coloca con `colocarFlotante` (probado en `lib/flotante.test.ts`): prefiere
 *    abajo, sube si no cabe, y en horizontal se aprieta contra el filo en vez de
 *    salirse. El ancho máximo es relativo a la VENTANA, así que en un móvil de
 *    320px tampoco se sale.
 *  - `pointer-events-none`: un tooltip jamás roba el hover ni tapa un click.
 *
 * Accesibilidad: el texto vive SIEMPRE en el DOM (copia `sr-only` enlazada con
 * `aria-describedby`), no solo mientras se ve. Si solo existiera al mostrarse,
 * quien navega con lector dependería de que el foco y el render lleguen en el
 * orden correcto, y a veces no llegan. El globo visible es `aria-hidden`: es la
 * misma frase, y decirla dos veces es peor que no decirla.
 *
 * Se muestra con el ratón, con el foco de teclado y al tocar (en táctil no hay
 * hover). Escape lo retira sin cortar la propagación: es una capa pasiva, no debe
 * comerse el Escape del diálogo que tenga debajo.
 */
export function Tooltip({
  text,
  children,
  alinear = 'centro',
}: {
  text: string
  /** Un único elemento: es el ancla y quien recibe el `aria-describedby`. */
  children: ReactElement<{ 'aria-describedby'?: string }>
  alinear?: 'centro' | 'izquierda' | 'derecha'
}) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anclaRef = useRef<HTMLSpanElement>(null)
  const globoRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const colocar = useCallback(() => {
    const ancla = anclaRef.current
    const globo = globoRef.current
    if (!ancla || !globo) return
    const caja = ancla.getBoundingClientRect()
    // Si el ancla se ha ido de lo que se ve (scroll del panel o de la página), el
    // globo no puede quedarse flotando solo sobre el borde: se retira con ella.
    const [techo, suelo] = limitesVisibles(ancla)
    if (caja.bottom < techo || caja.top > suelo) {
      setVisible(false)
      return
    }
    const g = globo.getBoundingClientRect()
    setPos(
      colocarFlotante(
        caja,
        { width: g.width, height: g.height },
        { width: window.innerWidth, height: window.innerHeight },
        { alinear },
      ),
    )
  }, [alinear])

  // Antes de pintar: el globo se monta invisible, se mide y solo entonces se
  // coloca. Medirlo después de verse sería un salto de un fotograma.
  useLayoutEffect(() => {
    if (visible) colocar()
    else setPos(null)
  }, [visible, colocar])

  useEffect(() => {
    if (!visible) return
    // Se RECOLOCA al scrollear (no se cierra): con el foco puesto, el texto debe
    // seguir ahí hasta que lo quites tú. Y `capture` para enterarse también del
    // scroll de los paneles interiores, que no burbujea.
    const onScroll = () => colocar()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setVisible(false)
    // En táctil, tocar fuera lo retira: no hay "salir con el ratón".
    const onFuera = (e: PointerEvent) => {
      if (!anclaRef.current?.contains(e.target as Node)) setVisible(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onFuera)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onFuera)
    }
  }, [visible, colocar])

  return (
    <span
      ref={anclaRef}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      // onFocus/onBlur de React son focusin/focusout: llegan desde el control de
      // dentro sin tener que tocarlo.
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onPointerDown={(e) => e.pointerType !== 'mouse' && setVisible((v) => !v)}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} className="sr-only">
        {text}
      </span>
      {visible &&
        createPortal(
          <div
            ref={globoRef}
            role="tooltip"
            aria-hidden
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? undefined : 'hidden',
            }}
            className="pointer-events-none z-[80] max-w-[min(15rem,calc(100vw-16px))] rounded-lg bg-slate-900 px-3 py-2 text-[12px] leading-relaxed text-white shadow-pop"
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  )
}

/**
 * Icono de info con su ayuda. Es el caso de siempre: un título y una aclaración
 * que no merece estar escrita a la vista todo el rato.
 *
 * El botón se llama "Más información" y la frase es su DESCRIPCIÓN, no su nombre:
 * un botón cuyo nombre es un párrafo entero se lee fatal en una lista de controles.
 */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        aria-label="Más información"
        className="grid size-4 place-items-center rounded-full text-slate-600 transition-colors duration-[var(--duration-control)] hover:text-slate-900 focus-visible:text-slate-900"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
    </Tooltip>
  )
}

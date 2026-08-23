import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown } from 'lucide-react'
import { MessageScroller, useMessageScrollerScrollable } from '@shadcn/react/message-scroller'

/**
 * Las piezas de conversación de Meridian.
 *
 * El scroll no lo escribimos nosotros: lo pone `@shadcn/react`, el paquete
 * headless de los componentes de chat de shadcn (cero dependencias, cero
 * estilos, solo comportamiento). Nos da lo que cuesta clavar a mano:
 *
 * - **Pegarse al borde vivo**: la conversación se queda junto al composer y la
 *   vista sigue al texto según crece, sin saltos. NO usamos el anclaje de turno
 *   del paquete (`scrollAnchor`), que sube tu pregunta a lo alto de la pantalla
 *   de golpe: Mario lo probó y ese tirón es justo lo que no quiere.
 * - **Soltar el auto-scroll**: si te subes a releer, deja de arrastrarte. Antes
 *   hacíamos `scrollIntoView` en cada cambio y te sacaba de donde estabas.
 * - Saber si queda contenido arriba o abajo, para pintar los bordes y el botón
 *   de bajar solo cuando de verdad hacen falta.
 *
 * Los estilos son todos nuestros: el paquete no trae ninguno.
 */

/** Contenedor con scroll propio. Va dentro de una columna flex de altura fija. */
export function Thread({ children }: { children: ReactNode }) {
  return (
    <MessageScroller.Provider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={48}>
      <MessageScroller.Root className="relative -mx-4 min-h-0 flex-1">
        <MessageScroller.Viewport
          aria-label="Conversación con Meridian"
          className="h-full overflow-y-auto overscroll-contain px-4 focus-visible:outline-none"
        >
          <MessageScroller.Content className="space-y-6 pb-8 pt-5">{children}</MessageScroller.Content>
        </MessageScroller.Viewport>
        <EdgeFades />
        <ScrollToEnd />
      </MessageScroller.Root>
    </MessageScroller.Provider>
  )
}

/** Un turno. El id lo usa el paquete para medir y para poder saltar a él. */
export function ThreadTurn({ id, children }: { id: string; children: ReactNode }) {
  return <MessageScroller.Item messageId={id}>{children}</MessageScroller.Item>
}

/** Difuminado en los bordes, solo del lado donde queda contenido por ver. */
function EdgeFades() {
  const { start, end } = useMessageScrollerScrollable()
  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-slate-50 to-transparent transition-opacity duration-[var(--duration-control)] ${start ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent transition-opacity duration-[var(--duration-control)] ${end ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  )
}

/** Aparece solo si hay algo por debajo. Inactivo ya llega `inert` desde el paquete. */
function ScrollToEnd() {
  return (
    <MessageScroller.Button
      direction="end"
      aria-label="Ir al final de la conversación"
      className="absolute bottom-4 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full filo bg-white text-slate-500 shadow-pop transition-[color,transform,opacity] duration-[var(--duration-control)] hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 data-[active=false]:translate-y-1 data-[active=false]:opacity-0"
    >
      <ArrowDown className="size-4" aria-hidden />
    </MessageScroller.Button>
  )
}

/** Techo de la escritura: una respuesta larga no puede tardar más que esto. */
const ESCRITURA_MS = 1400

/**
 * Texto de Meridian, escribiéndose.
 *
 * Las palabras se AÑADEN al DOM de una en una, no se encienden ya colocadas.
 * La diferencia importa: al crecer el párrafo, el ResizeObserver del scroller
 * lo persigue y la conversación se queda pegada al composer. Si el texto
 * apareciera entero, el scroll no tendría nada a lo que seguir y volveríamos al
 * salto seco. Cada palabra nueva entra además con un fundido corto (`word-in`).
 *
 * La respuesta llega entera de la edge function, así que esto no simula una
 * espera: reparte en poco más de un segundo algo que ya está aquí.
 */
export function StreamedText({ text, animate, className, onDone }: {
  text: string; animate?: boolean; className?: string; onDone?: () => void
}) {
  const partes = useMemo(() => text.split(/(\s+)/), [text])
  // -1 = sin escritura, texto plano de una pieza. Importa que sea un caso
  // aparte y no "todas las palabras visibles": si montamos todos los spans a la
  // vez, sus `word-in` arrancan juntos y el párrafo entero entra desenfocado.
  // Un turno recuperado del historial no debe animarse en absoluto.
  const [visibles, setVisibles] = useState(animate ? 0 : -1)
  const finRef = useRef(onDone); finRef.current = onDone

  useEffect(() => {
    const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!animate || sinMovimiento) { setVisibles(-1); finRef.current?.(); return }
    const porParte = Math.min(30, ESCRITURA_MS / Math.max(partes.length, 1))
    const inicio = performance.now()
    let raf = requestAnimationFrame(function paso(ahora: number) {
      const n = Math.min(partes.length, Math.ceil((ahora - inicio) / porParte))
      setVisibles(n)
      if (n < partes.length) raf = requestAnimationFrame(paso)
      else finRef.current?.()
    })
    return () => cancelAnimationFrame(raf)
  }, [animate, partes])

  if (visibles < 0) return <p className={className}>{text}</p>
  return (
    <p className={className}>
      {partes.slice(0, visibles).map((trozo, i) =>
        trozo.trim() === '' ? trozo : <span key={i} className="word-in">{trozo}</span>,
      )}
    </p>
  )
}

/**
 * Estado mientras piensa. El texto cambia con los segundos que llevas
 * esperando, que es información real: no inventamos en qué anda (el bucle de
 * herramientas ocurre en el servidor y aquí no llega).
 */
export function ThinkingStatus() {
  const [waited, setWaited] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setWaited((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  const label = waited < 9 ? 'Pensando' : waited < 20 ? 'Sigo con ello' : 'Está tardando más de lo normal'
  return (
    <p role="status" className="py-1 text-[14px] leading-6">
      <span className="shimmer-text font-medium">{label}</span>
    </p>
  )
}

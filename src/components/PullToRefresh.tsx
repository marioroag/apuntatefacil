import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

// Tirar para refrescar, al estilo de las apps móviles: estando arriba del todo,
// arrastras hacia abajo y al soltar pasado el umbral se recarga. Solo táctil
// (en escritorio no hay gesto). Busca solo el contenedor con scroll más cercano,
// así no acopla a ningún id concreto.

const THRESHOLD = 70 // px de tirón (ya con resistencia) para disparar
const MAX_PULL = 100 // tope visual del tirón
const RESISTANCE = 0.5 // el dedo recorre el doble que el indicador

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') return node
    node = node.parentElement
  }
  return null
}

export function PullToRefresh({
  onRefresh,
  children,
  enabled = true,
}: {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  // Estado mutable del gesto fuera de React (evita cierres obsoletos en los listeners).
  const g = useRef({ startY: 0, pulling: false, dragging: false, pull: 0, busy: false })
  // onRefresh puede ser una función nueva en cada render: la guardamos en ref para
  // no reenganchar listeners en cada render.
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  })

  useEffect(() => {
    if (!enabled) return
    const scroller = findScrollParent(ref.current)
    if (!scroller) return

    const reset = () => {
      g.current.pulling = false
      g.current.dragging = false
      g.current.pull = 0
      setPull(0)
    }

    const onStart = (e: TouchEvent) => {
      if (g.current.busy || e.touches.length !== 1 || scroller.scrollTop > 0) {
        g.current.pulling = false
        return
      }
      g.current.startY = e.touches[0].clientY
      g.current.pulling = true
    }

    const onMove = (e: TouchEvent) => {
      if (!g.current.pulling || g.current.busy) return
      const dy = e.touches[0].clientY - g.current.startY
      // Si se sube el dedo o ya no estamos arriba del todo, se cancela el gesto.
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (g.current.dragging) reset()
        else g.current.pulling = false
        return
      }
      // Tirón válido hacia abajo desde arriba: cortamos el rebote nativo y seguimos.
      e.preventDefault()
      g.current.dragging = true
      const p = Math.min(dy * RESISTANCE, MAX_PULL)
      g.current.pull = p
      setPull(p)
    }

    const onEnd = () => {
      if (!g.current.pulling) return
      g.current.pulling = false
      if (g.current.dragging && g.current.pull >= THRESHOLD) {
        g.current.dragging = false
        trigger()
      } else {
        reset()
      }
    }

    const trigger = async () => {
      g.current.busy = true
      setRefreshing(true)
      setPull(THRESHOLD) // se queda en el umbral girando mientras carga
      try {
        await onRefreshRef.current()
      } finally {
        g.current.busy = false
        g.current.pull = 0
        setRefreshing(false)
        setPull(0)
      }
    }

    scroller.addEventListener('touchstart', onStart, { passive: true })
    scroller.addEventListener('touchmove', onMove, { passive: false })
    scroller.addEventListener('touchend', onEnd)
    scroller.addEventListener('touchcancel', onEnd)
    return () => {
      scroller.removeEventListener('touchstart', onStart)
      scroller.removeEventListener('touchmove', onMove)
      scroller.removeEventListener('touchend', onEnd)
      scroller.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled])

  const armed = pull >= THRESHOLD
  return (
    <div ref={ref}>
      <div
        className="flex items-end justify-center overflow-hidden"
        style={{ height: pull, transition: g.current.dragging ? 'none' : 'height .22s ease' }}
        aria-hidden={!refreshing}
      >
        <div className="flex h-9 items-center justify-center pb-1.5">
          <Loader2
            className={`size-5 text-indigo-600 ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { opacity: Math.min(pull / THRESHOLD, 1), transform: `rotate(${armed ? 180 : pull * 2}deg)` }}
            aria-hidden
          />
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {refreshing ? 'Actualizando candidatos' : ''}
      </span>
      {children}
    </div>
  )
}

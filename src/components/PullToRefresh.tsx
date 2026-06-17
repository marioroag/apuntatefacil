import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'

// Tirar para refrescar, al estilo de las apps móviles: estando arriba del todo,
// arrastras hacia abajo y al soltar pasado el umbral se recarga. Solo táctil
// (en escritorio no hay gesto). Busca solo el contenedor con scroll más cercano,
// así no acopla a ningún id concreto. El resultado ("Estás al día", "N nuevos" o
// un error) se muestra EN la barra de arriba, no en un toast: aparece, se mantiene
// un momento y se recoge solo, todo en el mismo sitio del gesto.

export type RefreshResult = { ok: boolean; message: string }

const THRESHOLD = 70 // px de tirón (ya con resistencia) para disparar
const MAX_PULL = 100 // tope visual del tirón
const RESISTANCE = 0.5 // el dedo recorre el doble que el indicador
const RESULT_H = 40 // alto de la barra mientras se muestra el mensaje de resultado
const RESULT_MS = 1500 // cuánto se mantiene el mensaje antes de recogerse

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
  onRefresh: () => Promise<RefreshResult | void>
  children: ReactNode
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [result, setResult] = useState<RefreshResult | null>(null)
  // Estado mutable del gesto fuera de React (evita cierres obsoletos en los listeners).
  const g = useRef({ startY: 0, pulling: false, dragging: false, pull: 0, busy: false })
  const resultTimer = useRef<number | null>(null)
  // onRefresh puede ser una función nueva en cada render: la guardamos en ref para
  // no reenganchar listeners en cada render.
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  })
  useEffect(() => () => { if (resultTimer.current) window.clearTimeout(resultTimer.current) }, [])

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
      // Si hay un panel/hoja/diálogo abierto (detalle del candidato, Filtros, etc.),
      // no tiramos para refrescar: ese overlay vive dentro del contenedor con scroll
      // y sus toques burbujearían hasta aquí, robándole su propio scroll.
      const overlayOpen = !!document.querySelector('[role="dialog"][aria-modal="true"]')
      if (g.current.busy || overlayOpen || e.touches.length !== 1 || scroller.scrollTop > 0) {
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

    const collapse = () => {
      setResult(null)
      g.current.busy = false
      g.current.pull = 0
      setPull(0)
    }

    const trigger = async () => {
      g.current.busy = true
      setResult(null)
      setRefreshing(true)
      setPull(THRESHOLD) // se queda en el umbral girando mientras carga
      let res: RefreshResult | void = undefined
      try {
        res = await onRefreshRef.current()
      } finally {
        setRefreshing(false)
        if (res && res.message) {
          // Mostramos el resultado en la propia barra, lo mantenemos y lo recogemos.
          setResult(res)
          g.current.pull = RESULT_H
          setPull(RESULT_H)
          resultTimer.current = window.setTimeout(collapse, RESULT_MS)
        } else {
          collapse()
        }
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
        style={{ height: pull, transition: g.current.dragging ? 'none' : 'height .28s ease' }}
      >
        <div className="flex h-9 items-center justify-center gap-1.5 pb-1.5">
          {result ? (
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${result.ok ? 'text-slate-600' : 'text-red-600'}`}
            >
              {result.ok ? (
                <Check className="size-4 text-green-600" aria-hidden />
              ) : (
                <AlertCircle className="size-4" aria-hidden />
              )}
              {result.message}
            </span>
          ) : refreshing ? (
            <Loader2 className="size-5 animate-spin text-indigo-600" aria-hidden />
          ) : (
            <Loader2
              className="size-5 text-indigo-600"
              style={{ opacity: Math.min(pull / THRESHOLD, 1), transform: `rotate(${armed ? 180 : pull * 2}deg)` }}
              aria-hidden
            />
          )}
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {refreshing ? 'Actualizando candidatos' : result?.message ?? ''}
      </span>
      {children}
    </div>
  )
}

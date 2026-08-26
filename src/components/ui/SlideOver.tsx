import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { botonIcono } from '../../lib/buttons'
import { DUR, EASE } from '../../lib/motion'

/**
 * La curva del panel, la misma que sus hermanos `Modal` y `ConfirmDialog`. Se
 * nombra porque Framer Motion no lee variables CSS y un `cubic-bezier` suelto
 * dentro de un `transition` es exactamente el número que deriva sin que nadie lo
 * vea. Las duraciones salen de `lib/motion.ts`: el telón entra en `enter` y el
 * cajón en `max`, que es el techo declarado para lo que recorre distancia.
 */

export function SlideOver({
  open,
  onClose,
  title,
  actions,
  children,
  footer,
  /** Cuando hay otro modal encima: sin foco, Escape ni anuncio como diálogo activo. */
  inert = false,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Acciones a la izquierda del cierre (misma fila, mismo peso visual). */
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  inert?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  // onClose por ref: el efecto de foco/teclado solo debe correr al abrir/cerrar,
  // no en cada render del padre. Si lo metiéramos en deps, una onClose recreada
  // (lo normal) reejecutaría el cleanup, que hace opener.focus() y robaría el foco
  // del campo activo en cada tecla. Ver bug del textarea de respuesta en Soporte.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const opener = document.activeElement as HTMLElement | null
    return () => {
      document.body.style.overflow = prev
      opener?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open || inert) return

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') {
        const els = focusables()
        if (els.length === 0) return
        const first = els[0]
        const last = els[els.length - 1]
        const active = document.activeElement
        // Si el foco se ha quedado fuera (por ejemplo al hacer clic en una zona
        // del panel que no es un control, que lo manda a <body>), el Tab se iría
        // a la página de detrás. Lo devolvemos al panel: el diálogo es modal.
        if (!panelRef.current?.contains(active)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
          return
        }
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panelRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, inert])

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal={!inert}
          aria-hidden={inert || undefined}
          aria-labelledby="slideover-title"
          inert={inert || undefined}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            aria-hidden
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : DUR.enter }}
            onClick={inert ? undefined : onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={inert ? undefined : -1}
            className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-white shadow-pop outline-none"
            initial={reducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: reducedMotion ? 0 : DUR.max, ease: EASE.out }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              {/* flex-1: sin esto, un título con contenido inline-flex (p. ej. un botón
                  con truncate dentro) calcula su ancho intrínseco de forma ambigua y
                  puede clipar 1-2 caracteres de más aunque sobre espacio en la cabecera. */}
              <div className="min-w-0 flex-1" id="slideover-title">{title}</div>
              <div className="-mr-1 flex shrink-0 items-center gap-0.5">
                {actions}
                {/* La equis se fabrica con `botonIcono`, como cualquier otro botón de
                    solo icono. Escrita a mano se había quedado en dos peldaños de la
                    rampa (reposo y hover) y sin el tercero, así que al pulsarla no
                    pasaba nada: es por donde derivan siempre los clones. La variante
                    `ghost` existía en `buttons.ts` sin que la usara nadie. */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  className={botonIcono('ghost')}
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </header>
            <div className="flex-1 overscroll-contain overflow-y-auto px-4 py-5 sm:px-5">{children}</div>
            {footer && (
              <footer className="border-t border-slate-200 bg-slate-50 px-3 py-3 sm:px-5">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

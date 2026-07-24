import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

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
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

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
            className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]"
            aria-hidden
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={inert ? undefined : onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={inert ? undefined : -1}
            className="absolute right-0 top-0 flex h-full w-full max-w-[500px] flex-col border-l border-border bg-card shadow-pop outline-none"
            initial={reducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0, 0, 0.2, 1] }}
          >
            <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
              {/* flex-1: sin esto, un título con contenido inline-flex (p. ej. un botón
                  con truncate dentro) calcula su ancho intrínseco de forma ambigua y
                  puede clipar 1-2 caracteres de más aunque sobre espacio en la cabecera. */}
              <div className="min-w-0 flex-1" id="slideover-title">{title}</div>
              <div className="-mr-1 flex shrink-0 items-center gap-0.5">
                {actions}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  className="grid size-9 pointer-coarse:size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </header>
            <div className="flex-1 overscroll-contain overflow-y-auto px-4 py-6 sm:px-6">{children}</div>
            {footer && (
              <footer className="border-t border-border bg-muted/45 px-3 py-3 sm:px-6">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

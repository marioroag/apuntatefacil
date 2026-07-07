import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export function SlideOver({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // onClose por ref: el efecto de foco/teclado solo debe correr al abrir/cerrar,
  // no en cada render del padre. Si lo metiéramos en deps, una onClose recreada
  // (lo normal) reejecutaría el cleanup, que hace opener.focus() y robaría el foco
  // del campo activo en cada tecla. Ver bug del textarea de respuesta en Soporte.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null

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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => panelRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      window.clearTimeout(t)
      opener?.focus?.() // devuelve el foco a la fila/control de origen
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="slideover-title">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-white shadow-pop outline-none"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              {/* flex-1: sin esto, un título con contenido inline-flex (p. ej. un botón
                  con truncate dentro) calcula su ancho intrínseco de forma ambigua y
                  puede clipar 1-2 caracteres de más aunque sobre espacio en la cabecera. */}
              <div className="min-w-0 flex-1" id="slideover-title">{title}</div>
              <button
                onClick={onClose}
                aria-label="Cerrar panel"
                className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <footer className="border-t border-slate-200 px-5 py-3">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

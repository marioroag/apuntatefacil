import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './Button'
import { DUR, EASE } from '../../lib/motion'

/**
 * La curva del panel, la misma que su hermano `Modal`. No es ninguna de las
 * `--ease-*` del CSS, y por eso se nombra: Framer Motion no lee variables, así
 * que un número suelto dentro del `transition` es el que deriva sin que nadie lo
 * vea. El telón iba además a 0.16, que no es ninguna de las tres duraciones del
 * sistema (`lib/motion.ts`); ahora entra en `enter`, como todo lo que aparece.
 */

// Modal de confirmación centrado. Foco atrapado, cierre con Escape o clic fuera,
// scroll del fondo bloqueado. La animación respeta reduced-motion (MotionConfig global).
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  loading = false,
  confirmDisabled = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
  loading?: boolean
  /** El botón de confirmar apagado hasta que el diálogo tenga lo que necesita
   *  (por ejemplo, una respuesta pendiente dentro). Cancelar sigue vivo. */
  confirmDisabled?: boolean
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const els = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
        if (!els.length) return
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => panelRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      opener?.focus?.()
    }
  }, [open, onClose, loading])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.enter }}
            onClick={() => !loading && onClose()}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative w-full max-w-[420px] rounded-xl bg-white p-6 shadow-pop outline-none"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: DUR.enter, ease: EASE.out }}
          >
            <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">{title}</h2>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
              <Button variant={confirmVariant} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

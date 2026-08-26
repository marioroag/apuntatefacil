import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DUR, EASE } from '../../lib/motion'

/** La curva de salida del panel, la misma que traía. Un fundido no la necesita. */

/**
 * Modal centrado GRANDE (detalle del candidato). Hermano de ConfirmDialog: mismo
 * telón, mismas curvas y mismo contrato de foco; lo que cambia es el tamaño y que
 * el contenido manda su propio scroll (aquí no hay padding ni scroll global).
 *
 * Reglas que resuelve por ti, para no volver a escribirlas en cada pantalla:
 *   - Foco atrapado dentro del panel y devuelto a quien lo abrió al cerrar.
 *   - Escape cierra; clic en el telón cierra (nunca clic dentro).
 *   - El fondo no scrollea mientras está abierto.
 *   - `inert` cuando hay otro diálogo encima (ni foco, ni Escape, ni anuncio).
 *   - En móvil ocupa la pantalla; a partir de `sm` es una tarjeta centrada.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  label,
  children,
  /** Ancho máximo en escritorio. El alto lo fija el contenido, con techo de 88vh. */
  maxWidthClass = 'sm:max-w-[1080px]',
  inert = false,
}: {
  open: boolean
  onClose: () => void
  /** id del título dentro del modal. Si no hay título visible, usa `label`. */
  labelledBy?: string
  label?: string
  children: ReactNode
  maxWidthClass?: string
  inert?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  // Igual que en SlideOver: onClose por ref para que el efecto no se reejecute en
  // cada render del padre (reejecutarlo devuelve el foco al opener y te lo roba
  // mientras escribes).
  // La ref se actualiza en su propio efecto, declarado ANTES que los demás para
  // que estos ya vean la versión nueva. Escribirla durante el render sería tocar
  // una ref en render, que es lo que React desaconseja.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

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
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)

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

  // Entra en `enter` (180ms, "algo aparece") y sale en `control` (150ms): cerrar
  // es una respuesta a tu dedo y lo que se va no hay que anunciarlo. Las dos son
  // duraciones del sistema, no números escritos aquí (ver `lib/motion.ts`).
  const entra = { duration: reducedMotion ? 0 : DUR.enter, ease: EASE.out }
  const sale = { duration: reducedMotion ? 0 : DUR.control, ease: EASE.out }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal={!inert}
          aria-hidden={inert || undefined}
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : label}
          inert={inert || undefined}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            aria-hidden
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: entra }}
            exit={{ opacity: 0, transition: sale }}
            onClick={inert ? undefined : onClose}
          />
          {/* La capa no captura el clic: lo que cae fuera del panel llega al telón. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center sm:p-6">
            <motion.div
              ref={panelRef}
              tabIndex={inert ? undefined : -1}
              className={`pointer-events-auto flex h-full max-h-svh w-full flex-col overflow-hidden bg-white shadow-pop outline-none sm:h-[min(88vh,780px)] sm:rounded-xl ${maxWidthClass}`}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: entra }}
              exit={reducedMotion ? { opacity: 0, transition: sale } : { opacity: 0, scale: 0.98, y: 6, transition: sale }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

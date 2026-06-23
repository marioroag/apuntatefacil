import type { ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Hoja inferior de móvil reutilizable (Filtros, Vistas, Ajustes, Cambiar estado).
 * Trae el asa de arrastre y el gesto de "deslizar hacia abajo para cerrar" propio
 * de las apps nativas, además del backdrop y la cabecera (título + cerrar).
 *
 * Solo arrastra desde el asa/cabecera (`dragListener={false}` + `dragControls`),
 * así el cuerpo hace scroll normal sin pelearse con el gesto de cierre.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  label,
  zClass = 'z-50',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** aria-label del diálogo (por defecto usa el título si es texto). */
  label?: string
  /** clase de z-index (p. ej. z-[60] para apilar sobre otra capa). */
  zClass?: string
}) {
  const drag = useDragControls()
  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 ${zClass} sm:hidden`}
          role="dialog"
          aria-modal="true"
          aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-pop"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 650) onClose()
            }}
          >
            {/* Asa + cabecera: la zona de arrastre. touch-none evita que el navegador
                haga scroll/refresh mientras se desliza la hoja. */}
            <div
              onPointerDown={(e) => drag.start(e)}
              className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
            >
              <div className="flex justify-center pt-2.5">
                <span className="h-1 w-9 rounded-full bg-slate-300" aria-hidden />
              </div>
              <div className="flex items-center justify-between px-4 pb-3 pt-2">
                <p className="text-base font-semibold text-slate-900">{title}</p>
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Cerrar"
                  className="-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="h-px bg-slate-200" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

            {footer && <div className="shrink-0">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

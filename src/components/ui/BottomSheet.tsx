import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Hoja inferior de móvil reutilizable (Filtros, Vistas, Ajustes, Cambiar estado).
 * Trae el asa de arrastre y el gesto de "deslizar hacia abajo para cerrar" propio
 * de las apps nativas, además del backdrop y la cabecera (título + cerrar).
 *
 * Solo arrastra desde el asa/cabecera (`dragListener={false}` + `dragControls`),
 * así el cuerpo hace scroll normal sin pelearse con el gesto de cierre.
 *
 * **VA EN UN PORTAL A `document.body`** (sep 2026), y no es cosmético: la hoja es
 * `position: fixed`, y un antepasado con `transform` deja de ser la ventana y pasa
 * a ser SU bloque contenedor. El panel de `ui/Modal` se anima con `scale`/`y`, así
 * que una hoja abierta desde dentro de la ficha del candidato (cambiar estado,
 * etiquetar) se colocaría contra el panel y encima la recortaría su
 * `overflow-hidden`. Es la regla de siempre de esta casa: **lo que flota se coloca
 * contra la VENTANA**, y un portal salva además del apilamiento del antepasado.
 *
 * COROLARIO QUE HAY QUE PAGAR: al salir a un portal, la hoja ya NO está dentro del
 * `ref` de quien la monta, así que cualquier click-fuera que pregunte
 * "¿está dentro?" lee un toque en la hoja como un toque fuera y la cierra. Quien
 * monte una hoja apaga su propio click-fuera mientras está en móvil: la hoja ya
 * trae telón, Escape y arrastre para cerrarse.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  label,
  zClass = 'z-50',
  inert = false,
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
  /** Hay otro diálogo encima: ni foco, ni Escape, ni cierre por telón. */
  inert?: boolean
}) {
  const drag = useDragControls()
  const sheetRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // El foco se devuelve a quien abrió la hoja, y solo cuando la hoja se cierra:
  // separado del atrapado de foco a propósito, porque al quedar inerte (otro
  // diálogo encima) la hoja sigue abierta y devolver el foco se lo robaría al
  // diálogo que acaba de abrirse.
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => previousFocus?.focus()
  }, [open])

  useEffect(() => {
    if (!open || inert) return
    const focusable = () =>
      sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // CORTA LA PROPAGACIÓN: una hoja puede abrirse DESDE un modal (cambiar
        // estado o etiquetar dentro de la ficha del candidato), y `ui/Modal`
        // escucha el mismo Escape en el MISMO nodo. Sin esto, Escape cerraría la
        // ficha entera además de la hoja.
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      // Y el Tab también: el modal de debajo devuelve el foco a SU panel, y la
      // hoja vive en un portal fuera de él, así que sin cortar aquí el tabulador
      // se escaparía de la hoja a la primera. Manda la capa de arriba.
      event.stopPropagation()
      const items = focusable()
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    // EN FASE DE CAPTURA, y no es un detalle: `ui/Modal` escucha en el mismo nodo
    // (`document`) y en la misma fase de burbuja, y se registra ANTES (al abrirse
    // la ficha) que esto (al abrirse la hoja). Dos listeners en el mismo nodo y
    // la misma fase corren en ORDEN DE REGISTRO, así que el corte de arriba
    // llegaría tarde. En captura, `document` es el primer nodo del recorrido.
    // Es la misma lección que ya costaron el menú `···` y la lista de etiquetas.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, inert])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 ${zClass} sm:hidden`}
          role="dialog"
          aria-modal={!inert}
          aria-hidden={inert || undefined}
          aria-label={label ?? (typeof title === 'string' ? title : undefined)}
          inert={inert || undefined}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={inert ? undefined : onClose}
          />
          <motion.div
            ref={sheetRef}
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
                  className="-mr-1 inline-flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
    </AnimatePresence>,
    document.body,
  )
}

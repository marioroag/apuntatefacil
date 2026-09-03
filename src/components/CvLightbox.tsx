import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react'
import { CvViewer } from './CvViewer'
import { BTN_SUPERFICIE } from '../lib/buttons'
import { DUR, EASE } from '../lib/motion'
import type { CitaCv } from '../lib/meridian'

/**
 * EL DOCUMENTO A PANTALLA COMPLETA (Mario, ago 2026, con el visor de Drive como
 * referencia). Se abre pinchando sobre el documento incrustado de la ficha:
 * telón oscuro, el documento centrado y más ancho, y arriba SOLO lo que hace
 * falta: cerrar a la izquierda, y Descargar / Abrir fuera a la derecha. Sin
 * zoom, sin imprimir, sin comentar: eso ya lo trae "Abrir fuera".
 *
 * Las flechas de pasar de documento solo se pintan con MÁS DE UNO (`docs`):
 * hoy el formulario admite un solo adjunto, así que no se ven nunca, pero la
 * pieza queda lista para el día de los candidatos de portal, que traen varios.
 *
 * TIENE SU PROPIO PLAN B, Y ESO ES LO QUE ARREGLA UN CIERRE EN SECO (sep 2026).
 * Su `onFallo` era `onClose`: un PDF que pdf.js no pudiera abrir hacía que el
 * visor se ABRIERA Y SE CERRARA solo, sin decir nada, y eso es todo lo que
 * pasaba al pulsar un documento en Safari, donde pdf.js cae al plan B siempre.
 * El incrustado de la ficha llevaba ese plan B desde el principio (el iframe con
 * el visor del navegador); el grande no, así que el mismo documento se veía
 * abajo y desaparecía al ampliarlo. Ahora cae aquí dentro, a pantalla completa,
 * que además es MEJOR que el incrustado: el iframe de la ficha tiene alto fijo
 * y este ocupa el telón entero.
 *
 * De ahí que `data` sea opcional: la columna Documentos abre esto sin bytes
 * cuando la descarga para subrayar no sale, en vez de cerrarse y dejar el clic
 * mudo. La regla es la de siempre: **un visor que no puede pintar el documento
 * enseña lo que pueda y lo dice; nunca se cierra solo.**
 *
 * Vive en un PORTAL sobre la ficha (que ya es un Modal), y por eso sus teclas
 * van EN CAPTURA sobre `document` con stopPropagation: el Modal de la ficha
 * escucha el mismo evento en el mismo nodo en fase de burbuja, y sin el corte
 * en captura, Escape cerraría la ficha entera y Tab devolvería el foco a un
 * panel que está debajo del telón (la lección del selector de etiquetas).
 */
export function CvLightbox({
  nombre,
  data,
  citas,
  onClose,
  onDescargar,
  urlAparte,
  docs,
}: {
  nombre: string
  /** Los bytes del PDF, para subrayar las citas. Sin ellos se enseña el plan B
   *  (el visor del navegador con `urlAparte`): el documento se ve igual, sin
   *  marcas. */
  data: ArrayBuffer | null
  citas: CitaCv[]
  onClose: () => void
  onDescargar: () => void
  /** URL para "Abrir fuera" (la firmada, o la del asset en la demo). */
  urlAparte: string | null
  /** Varios documentos: índice actual, total y cómo moverse. Sin esto (o con
   *  uno solo), las flechas no existen. */
  docs?: { indice: number; total: number; onIr: (n: number) => void }
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()
  // pdf.js no pudo con este documento: se enseña con el visor del navegador.
  const [visorFallo, setVisorFallo] = useState(false)
  // Hay navegadores sin visor de PDF propio (lo dicen ellos): ahí el iframe pinta
  // un rectángulo gris mudo, así que mejor decirlo y señalar los dos verbos que
  // esta misma barra ya tiene puestos arriba.
  const sinVisorNativo = typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === false

  // Foco: entra en la equis al abrir y vuelve a quien abrió al cerrar (el
  // mismo contrato que ui/Modal, aquí a mano porque esto no es esa pieza).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()
    return () => opener?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        // El Tab se atrapa AQUÍ y se corta: el Modal de la ficha, debajo,
        // devolvería el foco a su panel (este portal no vive dentro de él).
        e.stopPropagation()
        const els = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
        )
        if (els.length === 0) return
        const first = els[0]
        const last = els[els.length - 1]
        const active = document.activeElement
        if (!rootRef.current?.contains(active)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const botonChrome = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-[var(--duration-control)] ${BTN_SUPERFICIE.sobreOscuro}`
  const botonIconoChrome = `grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-[var(--duration-control)] ${BTN_SUPERFICIE.sobreOscuro}`
  const flecha = `pointer-events-auto grid size-11 place-items-center rounded-full transition-colors duration-[var(--duration-control)] ${BTN_SUPERFICIE.sobreOscuro}`

  return createPortal(
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Documento: ${nombre}`}
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950/85"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : DUR.enter, ease: EASE.out }}
      onClick={(e) => {
        // Clic en el telón (o en cualquier hueco que no sea el documento ni un
        // control) cierra, como en la referencia.
        if ((e.target as Element).closest('[data-doc-pagina], button, a')) return
        onClose()
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5 sm:px-4">
        <button ref={cerrarRef} type="button" aria-label="Cerrar" onClick={onClose} className={botonIconoChrome}>
          <X className="size-5" aria-hidden />
        </button>
        <span className="min-w-0 truncate text-sm font-medium text-white/90" title={nombre}>
          {nombre}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onDescargar} className={botonChrome}>
            <Download className="size-3.5" aria-hidden /> Descargar
          </button>
          {urlAparte && (
            <a href={urlAparte} target="_blank" rel="noreferrer" className={botonChrome}>
              <ExternalLink className="size-3.5" aria-hidden /> Abrir fuera
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {data && !visorFallo ? (
          <CvViewer
            data={data}
            titulo={nombre}
            citas={citas}
            aspecto="lienzo"
            // NUNCA `onClose`: un fallo del visor no es una orden de cerrar. Se
            // cae al plan B, que es lo que ya hacía el incrustado de la ficha.
            onFallo={() => setVisorFallo(true)}
          />
        ) : urlAparte && !sinVisorNativo ? (
          // Plan B: el visor del navegador. Enseña el documento sin subrayados;
          // las citas siguen enteras, en texto, en el informe de Meridian.
          <iframe src={urlAparte} title={nombre} className="h-full w-full bg-slate-100" />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="max-w-[42ch] text-sm leading-6 text-white/70">
              {sinVisorNativo
                ? 'Este navegador no puede enseñar el documento aquí dentro. Descárgalo o ábrelo aparte.'
                : 'No se pudo abrir el documento aquí dentro. Prueba a descargarlo.'}
            </p>
          </div>
        )}
      </div>

      {docs && docs.total > 1 && (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3">
          <button
            type="button"
            aria-label="Documento anterior"
            disabled={docs.indice === 0}
            onClick={() => docs.onIr(docs.indice - 1)}
            className={`${flecha} disabled:opacity-40`}
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Documento siguiente"
            disabled={docs.indice >= docs.total - 1}
            onClick={() => docs.onIr(docs.indice + 1)}
            className={`${flecha} disabled:opacity-40`}
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </div>
      )}
    </motion.div>,
    document.body,
  )
}

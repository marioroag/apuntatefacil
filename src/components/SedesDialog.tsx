import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from './ui/Toast'
import { DUR, EASE } from '../lib/motion'
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, botonIcono } from '../lib/buttons'
import type { Site } from '../lib/types'

/**
 * LA CASA DE LAS SEDES (ago 2026).
 *
 * Una sede sigue sin ser un DESTINO: es un atributo del puesto, y por eso no hay
 * (ni vuelve) una pantalla `/app/sedes`. Lo que sí hacía falta era un sitio donde
 * renombrarlas y borrarlas, porque el único que había era el bloque "Por sede" de
 * Vista general, que se fue con el rediseño de esa pantalla.
 *
 * Se abre desde los dos sitios donde una sede se piensa:
 *   · el submenú **Sede** de un puesto, que es donde se elige la suya;
 *   · el buscador ("Gestionar sedes"), que es la puerta declarada de todo lo que
 *     a propósito no tiene una.
 *
 * UNA SOLA SUPERFICIE PARA LAS TRES COSAS (crear, renombrar, borrar). Antes había
 * dos: un diálogo que solo creaba, colgado del submenú, y un editor en línea
 * dentro de Vista general. Dos formas de tocar lo mismo se separan al primer
 * retoque, que es la lección que este proyecto ya ha pagado varias veces.
 *
 * BORRAR SE CONFIRMA EN LA PROPIA FILA, no en un segundo diálogo encima de este:
 * dos capas apiladas se pelean por el Escape, y la frase que de verdad hay que
 * leer ("los puestos no se borran") se lee mejor pegada a la sede que vas a
 * quitar que en una caja que tapa la lista.
 */
export function SedesDialog({
  open,
  onClose,
  alCrear,
}: {
  open: boolean
  onClose: () => void
  /** Se llama con la sede recién creada. Lo usa el puesto para asignársela. */
  alCrear?: (site: Site) => void
}) {
  const { sites, createSite, renameSite, deleteSite } = useStore()
  const { role } = useAuth()
  const toast = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const primeroRef = useRef<HTMLInputElement>(null)
  const reducedMotion = useReducedMotion()

  // El encargado ve la estructura de la empresa, no la cambia. Es la misma regla
  // que ya aplica la RLS y el resto de los ajustes de empresa.
  const puedeGestionar = role !== 'encargado'

  const [editando, setEditando] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cerrar = useCallback(() => {
    if (!ocupado) onClose()
  }, [ocupado, onClose])

  // Al abrir: el foco entra en el primer campo de la sede nueva, que es lo que se
  // viene a hacer la mayoría de las veces. Al cerrar vuelve a quien la abrió.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => primeroRef.current?.focus(), 60)
    return () => {
      window.clearTimeout(t)
      setEditando(null)
      setBorrando(null)
      opener?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape sube UN nivel: si hay una fila abierta (editando o preguntando
        // si se borra), la cierra; solo desde la lista limpia se cierra el todo.
        if (editando || borrando) {
          e.stopPropagation()
          setEditando(null)
          setBorrando(null)
          return
        }
        cerrar()
        return
      }
      if (e.key !== 'Tab') return
      const els = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      const activo = document.activeElement
      if (!panelRef.current?.contains(activo)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && activo === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activo === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, cerrar, editando, borrando])

  const guardar = async (id: string, patch: { name: string; city: string }) => {
    setOcupado(true)
    const ok = await renameSite(id, patch)
    setOcupado(false)
    if (ok) {
      setEditando(null)
      toast.success('Sede guardada')
    }
  }

  const eliminar = async (site: Site) => {
    setOcupado(true)
    const ok = await deleteSite(site.id)
    setOcupado(false)
    if (ok) {
      setBorrando(null)
      toast.success('Sede eliminada')
    }
  }

  const crear = async (input: { name: string; city: string }) => {
    setOcupado(true)
    const site = await createSite(input)
    setOcupado(false)
    if (!site) return false
    alCrear?.(site)
    toast.success(alCrear ? 'Sede creada y asignada a este puesto' : 'Sede creada')
    return true
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sedes-title"
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            aria-hidden
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : DUR.control, ease: EASE.out }}
            onClick={cerrar}
          />
          <motion.div
            ref={panelRef}
            className="relative flex max-h-[min(88vh,720px)] w-full max-w-[480px] flex-col overflow-clip rounded-xl bg-white shadow-pop outline-none"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: reducedMotion ? 0 : DUR.enter, ease: EASE.out }}
          >
            <header className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <h2 id="sedes-title" className="text-lg font-semibold text-slate-900">
                  Sedes
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Agrupan tus puestos por local, obra o delegación. Cada puesto está en una, o en ninguna.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className={`${botonIcono('ghost')} -mr-1 -mt-1`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {sites.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500">
                  Todavía no tienes ninguna sede. Quien trabaja en un solo sitio no las necesita.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {sites.map((s) => (
                    <li key={s.id} className="py-2.5 first:pt-0">
                      {editando === s.id ? (
                        <FilaEditor site={s} ocupado={ocupado} onGuardar={(p) => void guardar(s.id, p)} onCancelar={() => setEditando(null)} />
                      ) : borrando === s.id ? (
                        <div>
                          <p className="text-sm text-slate-800">
                            ¿Eliminar <span className="font-semibold">{s.name}</span>?
                          </p>
                          {/* La frase que quita el miedo va aquí, pegada a la
                              decisión, y no en una nota al pie que se lee después. */}
                          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                            Sus puestos no se borran: se quedan sin sede y puedes asignarles otra cuando quieras.
                          </p>
                          <div className="mt-2.5 flex gap-2">
                            <button type="button" disabled={ocupado} onClick={() => void eliminar(s)} className={`${BTN_DANGER} disabled:opacity-50`}>
                              {ocupado ? 'Eliminando…' : 'Eliminar'}
                            </button>
                            <button type="button" disabled={ocupado} onClick={() => setBorrando(null)} className={BTN_SECONDARY}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <MapPin className="size-4 shrink-0 text-slate-400" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                            {/* La ciudad solo si dice algo que el nombre no diga:
                                casi todas se llaman como su ciudad. */}
                            {s.city && s.city.trim().toLowerCase() !== s.name.trim().toLowerCase() && (
                              <p className="truncate text-[12px] text-slate-500">{s.city}</p>
                            )}
                          </div>
                          {puedeGestionar && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => { setBorrando(null); setEditando(s.id) }}
                                aria-label={`Renombrar la sede ${s.name}`}
                                className={botonIcono('ghost', 'sm')}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditando(null); setBorrando(s.id) }}
                                aria-label={`Eliminar la sede ${s.name}`}
                                className={botonIcono('ghost', 'sm', 'hover:bg-red-50 hover:text-red-600')}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {puedeGestionar && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                <FilaNueva ref={primeroRef} ocupado={ocupado} asigna={!!alCrear} onCrear={crear} />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// En táctil el campo sube a 44px y a 16px de fuente: por debajo de 16, iOS hace
// zoom al enfocar.
const CAMPO =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 pointer-coarse:h-11 pointer-coarse:text-base focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'

/** Renombrar una sede, en su propia fila. Enter guarda, Escape cancela. */
function FilaEditor({
  site,
  ocupado,
  onGuardar,
  onCancelar,
}: {
  site: Site
  ocupado: boolean
  onGuardar: (patch: { name: string; city: string }) => void
  onCancelar: () => void
}) {
  const [name, setName] = useState(site.name)
  const [city, setCity] = useState(site.city)
  const guardar = () => name.trim() && onGuardar({ name: name.trim(), city: city.trim() })
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
          autoFocus
          aria-label="Nombre de la sede"
          placeholder="Nombre"
          className={CAMPO}
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
          aria-label="Ciudad de la sede (opcional)"
          placeholder="Ciudad (opcional)"
          className={CAMPO}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={ocupado || !name.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>
          Guardar
        </button>
        <button type="button" onClick={onCancelar} disabled={ocupado} className={BTN_SECONDARY}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Crear una sede. Vive en el pie, que es donde se añade a una lista. */
function FilaNueva({
  ref,
  ocupado,
  asigna,
  onCrear,
}: {
  ref: React.RefObject<HTMLInputElement | null>
  ocupado: boolean
  /** Abierto desde un puesto: la recién creada se le asigna, y se dice. */
  asigna: boolean
  onCrear: (input: { name: string; city: string }) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const crear = async () => {
    if (!name.trim() || ocupado) return
    const ok = await onCrear({ name: name.trim(), city: city.trim() })
    if (ok) {
      setName('')
      setCity('')
      ref.current?.focus()
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void crear()
      }}
    >
      <p className="text-sm font-semibold text-slate-800">Nueva sede</p>
      {asigna && <p className="mt-0.5 text-[12px] text-slate-500">Al crearla se asigna a este puesto.</p>}
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la sede" placeholder="Valencia centro" className={CAMPO} />
        <input value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ciudad de la sede (opcional)" placeholder="Valencia" className={CAMPO} />
      </div>
      <button type="submit" disabled={ocupado || !name.trim()} className={`${BTN_SECONDARY} mt-2.5 disabled:opacity-50`}>
        <Plus className="size-4" aria-hidden /> Crear sede
      </button>
    </form>
  )
}

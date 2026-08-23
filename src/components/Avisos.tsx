import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAvisos } from '../lib/avisos'
import { useProfiles } from '../lib/profiles'
import { relativeDate } from '../lib/format'
import { Avatar } from './ui/Avatar'

/**
 * El timbre de la barra y su panel. Lo que enseña sale entero de datos que ya
 * existen (ver `lib/avisos.ts`): menciones en el chat (de un candidato o del
 * tablón) y movimiento del tablón.
 *
 * El contador va en TINTA, no en el acento ni en rojo. Un aviso no es una
 * acción (el acento es para actuar) ni un error (el rojo es para eso). Y no se
 * pinta un punto pelado sino la cifra: "tienes algo" obliga a abrir para saber
 * si merece la pena; "tienes 3" ya es información.
 *
 * Lo pendiente se marca como visto AL CERRAR, no al abrir: si se marcase al
 * abrir, lo nuevo perdería su marca justo en el momento de mirarlo.
 */
export function Avisos() {
  const { disponible, items, sinVer, marcarVisto } = useAvisos()
  const profiles = useProfiles()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // Por referencia: así `cerrar` es estable y el efecto de abajo se registra al
  // abrir y se quita al cerrar, en vez de en cada render.
  const marcarRef = useRef(marcarVisto)
  marcarRef.current = marcarVisto
  const cerrar = useCallback(() => {
    setOpen(false)
    marcarRef.current()
  }, [])

  // El panel se ancla al borde derecho de la VENTANA, no al timbre: colgándolo
  // del timbre, en móvil el ancho se salía por la izquierda (detrás quedan la
  // hamburguesa y su margen). El alto se mide, no se escribe a mano, para que
  // siga a la barra si algún día cambia de altura.
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    if (!open) return
    const medir = () => setTop((wrapRef.current?.getBoundingClientRect().bottom ?? 56) + 6)
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) cerrar()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrar()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, cerrar])

  if (!disponible) return null

  const move = (dir: 1 | -1) => {
    const els = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-av]') ?? [])
    if (!els.length) return
    const i = els.indexOf(document.activeElement as HTMLElement)
    els[i < 0 ? 0 : (i + dir + els.length) % els.length]?.focus()
  }

  return (
    <div ref={wrapRef} className="relative flex h-full items-center">
      <button
        ref={triggerRef}
        onClick={() => (open ? cerrar() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={sinVer > 0 ? `Avisos, ${sinVer} sin ver` : 'Avisos'}
        className={`relative grid size-9 place-items-center rounded-lg transition-colors ${
          open ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Bell className="size-[18px]" aria-hidden />
        {sinVer > 0 && (
          <span
            aria-hidden
            className="num absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-slate-900 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
          >
            {sinVer > 9 ? '9+' : sinVer}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Avisos"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
          }}
          style={{ top }}
          className="fixed right-2 z-40 w-[min(22rem,calc(100vw-1rem))] rounded-xl filo bg-white shadow-pop"
        >
          <div className="flex items-baseline justify-between px-3 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Avisos</h2>
            {sinVer > 0 && (
              <button
                onClick={marcarVisto}
                className="text-[12px] font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                Marcar como visto
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 pb-4 pt-1 text-[13px] leading-5 text-slate-500">
              Nada nuevo. Aquí te avisamos cuando alguien te mencione o mueva algo en el tablón.
            </p>
          ) : (
            <ul className="max-h-[min(70vh,26rem)] overflow-y-auto border-t border-slate-100 p-1.5">
              {items.map((a) => {
                const nombre = profiles.nameFor(a.actorUserId, a.actorEmail) || 'Alguien'
                return (
                  <li key={a.id}>
                    <Link
                      data-av
                      to={a.to}
                      onClick={cerrar}
                      className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                    >
                      <Avatar
                        name={nombre}
                        seed={a.actorEmail || a.actorUserId}
                        src={profiles.avatarFor(a.actorUserId)}
                        size={28}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-5 text-slate-800">
                          <span className="font-semibold text-slate-900">{nombre}</span> {a.accion}
                        </span>
                        <span className="block truncate text-[12px] text-slate-500">{a.detalle}</span>
                      </span>
                      <span className="num mt-0.5 shrink-0 text-[11px] text-slate-500">{relativeDate(a.at)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

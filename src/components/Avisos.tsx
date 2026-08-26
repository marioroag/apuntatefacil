import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAvisos } from '../lib/avisos'
import { useProfiles } from '../lib/profiles'
import { relativeDate } from '../lib/format'
import { Avatar } from './ui/Avatar'
import { FILA, FILA_ABIERTA, FILA_QUIETA } from './filaLateral'

/**
 * Notificaciones: la fila del LATERAL y su panel. Lo que enseña sale entero de
 * datos que ya existen (ver `lib/avisos.ts`): menciones en el chat (de un
 * candidato o del tablón) y movimiento del tablón.
 *
 * Era un timbre de la barra superior; con el reskin (ago 2026) bajó al lateral y
 * pasó a ser una fila como las demás, con su nombre escrito. Un icono suelto en
 * una barra necesita que aprendas qué es; una fila que pone "Notificaciones", no.
 * El contador sigue siendo el mismo dato y sigue yendo a la derecha de la fila.
 *
 * La fila la declara el registro del menú (`nav.ts`, `capa: 'avisos'`) pero la
 * pinta este componente, porque el número y el `disponible` (sin equipo no hay
 * nada que pueda generar un aviso) los sabe él: llevarlos por el registro sería
 * llevar la misma cuenta en dos sitios.
 *
 * El contador va en TINTA, no en el acento ni en rojo. Un aviso no es una
 * acción (el acento es para actuar) ni un error (el rojo es para eso). Y no se
 * pinta un punto pelado sino la cifra: "tienes algo" obliga a abrir para saber
 * si merece la pena; "tienes 3" ya es información.
 *
 * Lo pendiente se marca como visto AL CERRAR, no al abrir: si se marcase al
 * abrir, lo nuevo perdería su marca justo en el momento de mirarlo.
 */
export function Avisos({ label }: { label: string }) {
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
  const cerrar = useCallback(() => setOpen(false), [])

  /**
   * ABRIR ES HABER VISTO (Mario, ago 2026). Aquí había un botón, "Marcar como
   * visto", en la cabecera del panel: pedía un gesto para declarar algo que el
   * gesto anterior ya había hecho, que es abrir la lista y tenerla delante. Es la
   * misma regla que ya gobierna el punto de Candidatos y el de un puesto: **una
   * señal se apaga MIRANDO, no trabajando**, y aquí encima ni siquiera era
   * trabajo, era papeleo.
   *
   * Se marca al ABRIR y no al cerrar, que es lo que hacía antes. La diferencia se
   * ve cuando entra un aviso mientras tienes el panel abierto: marcando al cerrar,
   * ese aviso se daba por visto sin que nadie lo hubiera mirado; marcando al
   * abrir, se queda sin ver y la chapa vuelve a encenderse al cerrar, que es lo
   * que hay que hacer con algo que no has leído.
   */
  useEffect(() => {
    if (open) marcarRef.current()
  }, [open])

  // El panel sale FUERA DEL LATERAL Y ARRIBA DEL TODO (Mario, ago 2026), no a la
  // altura de su fila. Colgado de la fila, la lista de avisos arrancaba a media
  // pantalla y bajaba hasta cerca del filo: nacía en un sitio distinto según en
  // qué bloque cayera "Notificaciones" y según cuántos puestos tuvieras
  // desplegados. Es una capa de la aplicación, no un submenú de esa fila, así que
  // empieza donde empieza la superficie de la que sale.
  //
  // "Arriba" es el techo del LATERAL (`[data-lateral]`), no el de la ventana:
  // en escritorio son lo mismo, pero en móvil el menú vive por debajo de la
  // barrita y anclar a la ventana taparía el aspa que lo cierra.
  //
  // Se coloca contra la VENTANA (`fixed`) para que ningún `overflow` del menú, que
  // se desplaza, pueda recortarlo, y se MIDE en vez de escribirse a mano porque en
  // una ventana baja tiene que subir hasta caber en lugar de salirse por abajo.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const medir = () => {
      const fila = wrapRef.current?.getBoundingClientRect()
      if (!fila) return
      const ancho = panelRef.current?.offsetWidth ?? 352
      const alto = panelRef.current?.offsetHeight ?? 320
      const MARGEN = 8
      const lateral = wrapRef.current?.closest('[data-lateral]')?.getBoundingClientRect()
      const techo = (lateral?.top ?? 0) + MARGEN
      setPos({
        // Fuera del lateral de verdad: se mide contra el filo del LATERAL y no
        // contra el de su fila, que acaba 10px antes (el raíl tiene relleno) y
        // dejaba el panel montado sobre el borde. Apretado contra el filo de la
        // pantalla si no cabe a la derecha: nunca fuera.
        left: Math.max(MARGEN, Math.min((lateral?.right ?? fila.right) + MARGEN, window.innerWidth - ancho - MARGEN)),
        // Arriba del todo. Solo sube por encima del techo si la ventana es tan
        // baja que el panel no cabe, y ni así se sale.
        top: Math.max(MARGEN, Math.min(techo, window.innerHeight - alto - MARGEN)),
      })
    }
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

  // La cifra: la ÚNICA del lateral, y por eso puede permitirse peso. La doctrina
  // dice que la negrita es para cuando hay una sola chapa; aquí la hay. Fondo
  // `slate-100` para no gritar sobre el blanco.
  const cifra = sinVer > 0 && (
    <span className="num shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
      {sinVer > 9 ? '9+' : sinVer}
      <span className="sr-only"> {sinVer === 1 ? 'aviso sin ver' : 'avisos sin ver'}</span>
    </span>
  )

  const filaAvisos = (
    <button
      ref={triggerRef}
      onClick={() => (open ? cerrar() : setOpen(true))}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      className={`${FILA} ${open ? FILA_ABIERTA : FILA_QUIETA}`}
    >
      <Bell className={`size-5 shrink-0 ${open ? 'text-slate-900' : 'text-slate-700'}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {cifra}
    </button>
  )

  return (
    <div ref={wrapRef}>
      {filaAvisos}

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
          // `visibility` y no montaje condicional: el panel tiene que estar en
          // el DOM para poder medirlo, y `useLayoutEffect` corre antes de pintar,
          // así que nadie llega a ver el fotograma sin colocar.
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          className="fixed z-40 w-[min(22rem,calc(100vw-1rem))] rounded-xl filo bg-white shadow-pop"
        >
          <div className="px-3 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Avisos</h2>
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

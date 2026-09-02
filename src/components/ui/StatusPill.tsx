import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { STATUS_META, STATUS_ORDER } from '../../lib/types'
import type { CandidateStatus } from '../../lib/types'
import { BottomSheet } from './BottomSheet'

const MENU_W = 176 // w-44

export function StatusPill({ status, className = '' }: { status: CandidateStatus; className?: string }) {
  const m = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${m.chip} ${className}`}
    >
      <span className={`size-2 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  )
}

/**
 * Pill que abre un menú para reasignar el estado sin salir de la fila.
 *
 * La pill mide SIEMPRE lo que mide su texto, también en columna. Se probó lo
 * contrario (`uniform`, 124px fijos, ago 2026) con el argumento de que el ojo baja
 * mejor por un borde recto que por un serrucho, y Mario lo retiró: con la rejilla
 * puesta, el borde recto ya lo da el filo de la columna, y estirar "Nuevo" hasta el
 * ancho de "Contratado" solo deja aire muerto entre la palabra y el chevron. La
 * pastilla es la etiqueta de una palabra, no una caja que rellenar.
 */
/* ---------------------------------------------------------------------------
   LA LISTA DE LOS CINCO ESTADOS. Una sola, con dos disparadores.
   ---------------------------------------------------------------------------
   La pinta la pastilla de una fila (`StatusSelect`) y el tramo "Estado" de la
   barra de selección, que cambia el estado de VARIOS de golpe. Es la misma
   decisión con el mismo vocabulario, así que la lista, su colocación en portal y
   su cierre viven aquí una vez: copiada, la segunda se separa de la primera al
   primer retoque, que es lo que este proyecto lleva media doctrina evitando.

   Nombres pelados, sin una frase por opción: los cinco estados se cambian
   cincuenta veces al día, son obvios y son reversibles. La descripción por opción
   es para lo que se decide una vez y cuesta caro (el estado del PUESTO), no para
   esto.
--------------------------------------------------------------------------- */
export function MenuEstado({
  valor,
  onChange,
  align = 'left',
  triggerClass,
  children,
}: {
  /** El estado marcado, o `null` cuando la selección tiene varios distintos. */
  valor: CandidateStatus | null
  onChange: (s: CandidateStatus) => void
  align?: 'left' | 'right'
  triggerClass?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // El menú va en un portal con posición fija (no absolute) para que NO lo recorte el
  // overflow de la tarjeta/scroll de la lista. Se calcula desde el botón, abriendo hacia
  // abajo o hacia arriba según el hueco, y alineado a izquierda/derecha.
  const place = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const estH = STATUS_ORDER.length * 33 + 8
    const vw = window.innerWidth || document.documentElement.clientWidth || 0
    const vh = window.innerHeight || document.documentElement.clientHeight || 0
    // Abre hacia arriba solo si no cabe abajo y sí cabe arriba; si no sabemos el alto
    // del viewport, por defecto hacia abajo.
    const openUp = vh > 0 && r.bottom + estH + 8 > vh && r.top - estH - 8 > 0
    const top = openUp ? Math.max(8, r.top - estH - 4) : r.bottom + 4
    const rawLeft = align === 'right' ? r.right - MENU_W : r.left
    const left = vw > 0 ? Math.max(8, Math.min(rawLeft, vw - MENU_W - 8)) : Math.max(8, rawLeft)
    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    // El menú es fijo y no sigue al botón: ciérralo si el contenido scrollea o se redimensiona.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className={triggerClass ? 'contents' : 'inline-block'}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
      >
        {children}
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W }}
            className="z-[70] overflow-hidden rounded-xl filo bg-white py-1 shadow-pop"
          >
            {STATUS_ORDER.map((s) => {
              const mm = STATUS_META[s]
              const sel = s === valor
              return (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => {
                      onChange(s)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className={`size-2 rounded-full ${mm.dot}`} aria-hidden />
                    <span className="flex-1">{mm.label}</span>
                    {sel && <Check className="size-4 text-indigo-600" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </div>
  )
}

export function StatusSelect({
  status,
  onChange,
  align = 'left',
  celda = false,
}: {
  status: CandidateStatus
  onChange: (s: CandidateStatus) => void
  align?: 'left' | 'right'
  /**
   * Vive dentro de una celda de la rejilla, y eso decide DOS cosas: que la
   * pastilla se quede sin punto (ver más abajo) y cómo se pulsa en móvil.
   *
   * **En móvil el disparador
   * es la CELDA ENTERA** (Mario, ago 2026): una pastilla de 24px de alto es un
   * objetivo de toque de la mitad del mínimo, y en una fila de 48px hay sitio de
   * sobra alrededor que no hace nada. En escritorio se queda como está, porque
   * ahí apuntar con el ratón a la pastilla no cuesta nada y una zona pulsable
   * enorme se llevaría por delante el click que abre la ficha.
   *
   * Es una prop y no el comportamiento por defecto porque la ficha del candidato
   * también usa esta pieza, y allí no hay celda que llenar.
   */
  celda?: boolean
}) {
  const m = STATUS_META[status]

  // Hito de marca: al pasar a "contratado" (y SOLO entonces) la pill da un único
  // pulso sobrio, como un cuño. Es el único estado celebrable de la doctrina;
  // "descartado" solo cambia de color. reduced-motion lo neutraliza globalmente.
  const prevStatus = useRef(status)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (prevStatus.current !== 'contratado' && status === 'contratado') {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 460)
      prevStatus.current = status
      return () => clearTimeout(t)
    }
    prevStatus.current = status
  }, [status])

  // La PASTILLA es lo que se ve; el BOTÓN es lo que se pulsa, y en una celda de
  // móvil el botón crece hasta la fila entera mientras la pastilla se queda igual.
  // El `-mx-2 px-2` recupera el relleno de la celda, que en móvil es de 8px: sin
  // él quedaría una banda muerta a cada lado, que es justo donde cae el dedo. Y
  // hace falta ADEMÁS pedir el ancho (`calc(100% + 1rem)`), porque `w-full` se
  // mide contra la caja de CONTENIDO: con solo el margen negativo el botón se
  // desplaza 8px a la izquierda pero sigue midiendo lo mismo, así que tapa el
  // relleno de un lado y deja el del otro sin cubrir. Medido: 127 de 144.
  //
  // TODO lo de crecer va en variantes `max-sm:`, incluido el `flex w-full`. Se
  // escribió en la base y el botón se quedaba a ancho completo también en
  // escritorio (143 de 168 medidos): allí eso se come el click que abre la ficha
  // en media celda, que es justo lo que esta prop NO quiere hacer.
  return (
    <MenuEstado
      valor={status}
      onChange={onChange}
      align={align}
      triggerClass={`group inline-flex rounded-full ${celda ? 'max-sm:-mx-2 max-sm:flex max-sm:min-h-12 max-sm:w-[calc(100%+1rem)] max-sm:items-center max-sm:rounded-lg max-sm:px-2' : ''}`}
    >
      {/* EL RELLENO NO ES SIMÉTRICO PORQUE EL CHEVRON NO LLENA SU CAJA (Mario,
          sep 2026: "parece que hay más padding a la derecha"). Y lo parecía porque
          lo hay: medido, el glifo de lucide dibuja su flecha en el 50% central de
          su viewBox, así que un chevron de 14px deja 3,5 de aire dentro de su
          propia caja. Con `px-2.5` a los dos lados, la tinta arrancaba a 10 por la
          izquierda y acababa a **13,5** por la derecha, un 35% más.
          El relleno derecho se descuenta ese aire (10 - 3,5 ≈ 6, o sea `pr-1.5`) y
          los dos lados vuelven a leerse iguales. La pastilla de solo lectura
          (`StatusPill`) se queda simétrica: no lleva chevron, así que no hay nada
          que descontar. REGLA: cuando una cápsula acaba en un glifo, el relleno de
          ese lado se mide hasta la TINTA, no hasta la caja. */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1.5 text-[13px] font-semibold transition-colors ${m.chip} group-hover:brightness-[0.97] ${celebrate ? 'animate-[pop-pulse_0.42s_ease-out]' : ''}`}
      >
        {/* EN LA TABLA, SIN PUNTO (Mario, sep 2026). No rompe la regla de que un
            estado nunca se dice solo con color: lo que se lee es su NOMBRE, y el
            punto solo repetía en dos píxeles el mismo color que ya tiene el
            relleno de la pastilla. En una columna de treinta filas eso son
            treinta glifos que no añaden un dato, y es el mismo argumento que ya
            le quitó el anillo a esta pastilla. Fuera de la tabla se queda: allí
            la pastilla aparece SOLA, sin sus hermanas debajo para comparar, y el
            punto es lo que la ata a la familia de los cinco estados. */}
        {!celda && <span className={`size-2 shrink-0 rounded-full ${m.dot}`} aria-hidden />}
        {m.label}
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </span>
    </MenuEstado>
  )
}

/**
 * Selector de estado como hoja inferior (solo móvil). Lo usan las tarjetas de
 * candidato del panel y la bandeja para cambiar el estado sin abrir el detalle.
 * En hoja (no desplegable) para que no lo recorte el `overflow-hidden` de la lista.
 */
export function StatusPickerSheet({
  open,
  status,
  onPick,
  onClose,
}: {
  open: boolean
  status: CandidateStatus | null
  onPick: (s: CandidateStatus) => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Cambiar estado" zClass="z-[60]">
      <ul className="p-2 pb-3">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s]
          const sel = s === status
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  onPick(s)
                  onClose()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-slate-700 transition-colors active:bg-slate-50"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${m.dot}`} aria-hidden />
                <span className="flex-1">{m.label}</span>
                {sel && <Check className="size-[18px] text-indigo-600" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}

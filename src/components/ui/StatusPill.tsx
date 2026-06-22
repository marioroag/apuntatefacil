import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset ${m.chip} ${className}`}
    >
      <span className={`size-2 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  )
}

/** Pill que abre un menú para reasignar el estado sin salir de la fila. */
export function StatusSelect({
  status,
  onChange,
  align = 'left',
}: {
  status: CandidateStatus
  onChange: (s: CandidateStatus) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const m = STATUS_META[status]

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
    <div className="inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset transition-colors ${m.chip} hover:brightness-[0.97]`}
      >
        <span className={`size-2 rounded-full ${m.dot}`} aria-hidden />
        {m.label}
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W }}
            className="z-[70] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop"
          >
            {STATUS_ORDER.map((s) => {
              const mm = STATUS_META[s]
              const sel = s === status
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

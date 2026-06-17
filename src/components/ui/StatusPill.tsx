import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { STATUS_META, STATUS_ORDER } from '../../lib/types'
import type { CandidateStatus } from '../../lib/types'
import { BottomSheet } from './BottomSheet'

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
  const ref = useRef<HTMLDivElement>(null)
  const m = STATUS_META[status]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
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
      {open && (
        <ul
          role="listbox"
          className={`absolute z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
        </ul>
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

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, TriangleAlert, X } from 'lucide-react'

type ToastKind = 'success' | 'info' | 'error'
interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (message: string, opts?: { kind?: ToastKind; action?: Toast['action']; duration?: number }) => void
  success: (message: string, opts?: { action?: Toast['action']; duration?: number }) => void
  error: (message: string) => void
}

const Ctx = createContext<ToastApi | null>(null)

const ICON: Record<ToastKind, ReactNode> = {
  success: <Check className="size-4 text-green-600" aria-hidden />,
  info: <Info className="size-4 text-indigo-600" aria-hidden />,
  error: <TriangleAlert className="size-4 text-red-600" aria-hidden />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>((message, opts = {}) => {
    const id = ++seq.current
    const kind = opts.kind ?? 'info'
    setToasts((t) => [...t, { id, kind, message, action: opts.action }].slice(-3))
    const dur = opts.duration ?? (opts.action ? 8000 : 5000)
    window.setTimeout(() => remove(id), dur)
  }, [remove])

  const api: ToastApi = {
    show,
    success: (m, o) => show(m, { kind: 'success', ...o }),
    error: (m) => show(m, { kind: 'error' }),
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 pl-3.5 shadow-pop"
            >
              <span className="mt-0.5 shrink-0">{ICON[t.kind]}</span>
              <p className="flex-1 text-sm leading-snug text-slate-700">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    remove(t.id)
                  }}
                  className="shrink-0 rounded-lg px-2 py-0.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => remove(t.id)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const a = useContext(Ctx)
  if (!a) throw new Error('useToast fuera de ToastProvider')
  return a
}

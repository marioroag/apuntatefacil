import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, TriangleAlert, X } from 'lucide-react'
import { DUR, EASE } from '../../lib/motion'

/**
 * La curva del aviso, que es `--ease-standard` de `index.css` escrita en
 * números porque Framer Motion no lee variables CSS. Aquí estaba copiada suelta
 * dentro del `transition`, junto a un 0.18 que era `DUR.enter`: los dos son
 * exactamente el número anónimo que la regla del acabado prohíbe, el que nadie
 * vuelve a tocar cuando el sistema cambia.
 */

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

// El icono de `info` va en gris de apoyo y NO en el acento. `info` es el `kind`
// por defecto de `show()`, o sea el toast más frecuente del producto: su
// ultramarine era el único de la caja que no se podía pulsar, justo al lado del
// que sí (el botón de acción de abajo). Verde y rojo se quedan porque son paleta
// de estado, no de marca. No se pierde nada al quitar el color: el glifo es
// `aria-hidden` y lo que informa es el texto del aviso, con su `role` status o
// alert según el tipo.
const ICON: Record<ToastKind, ReactNode> = {
  success: <Check className="size-4 text-green-600" aria-hidden />,
  info: <Info className="size-4 text-slate-500" aria-hidden />,
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

  // Estable entre renders: si no, cambiar el toast recrea este objeto y dispara
  // efectos de consumidores (p. ej. el reload del store, que en la demo borraba
  // el puesto recién creado al copiar el enlace).
  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m, o) => show(m, { kind: 'success', ...o }),
    error: (m) => show(m, { kind: 'error' }),
  }), [show])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        // Se aparta de la barra de selección, que flota sobre el mismo filo y la
        // declara mientras está puesta (`--alto-barra-flotante`, en Dashboard).
        // Sin esto, el aviso de "Excel listo" aterrizaba encima de la barra que
        // acababas de usar, tapándole la equis.
        className="pointer-events-none fixed bottom-[calc(1rem+var(--alto-barra-flotante,0px))] right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2"
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
              transition={{ duration: DUR.enter, ease: EASE.standard }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-3 rounded-xl filo bg-white p-3 pl-3.5 shadow-pop"
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
                className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-600"
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

import { useRef, type ReactNode } from 'react'

/**
 * Pestañas del sistema. Una sola gramática en toda la app: subrayado a 2px en el
 * activo (ultramarine = nav activo, uso permitido del acento), peso y tinta para
 * la jerarquía, gris con subrayado al pasar por encima en los demás.
 *
 * Semántica completa (`tablist`/`tab`/`tabpanel`) y navegación con flechas, que
 * es lo que se olvida al copiar el patrón a mano: con el foco en una pestaña,
 * ← → cambian de pestaña y Inicio/Fin saltan a los extremos. Solo la activa
 * entra en el orden de tabulación; desde ella, un Tab lleva al panel.
 *
 * El panel va con <TabPanel> y el mismo `idPrefix`: así los ids que atan pestaña
 * y contenido los pone el componente, no cada pantalla.
 */
export type TabItem<T extends string> = {
  value: T
  label: string
  /** Recuento a la derecha. Solo cuando el número informa (mensajes, sí; campos, no). */
  count?: number
}

const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`
const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idPrefix,
  label,
  className = '',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  /** Prefijo de los ids; debe ser único por grupo de pestañas de la pantalla. */
  idPrefix: string
  /** Nombre del grupo para lectores de pantalla ("Secciones del candidato"). */
  label: string
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)

  const move = (dir: -1 | 1 | 'first' | 'last') => {
    const i = items.findIndex((t) => t.value === value)
    const next =
      dir === 'first' ? 0
      : dir === 'last' ? items.length - 1
      : (i + dir + items.length) % items.length
    const target = items[next]
    if (!target) return
    onChange(target.value)
    // El foco sigue a la selección (activación automática, patrón estándar).
    window.requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(idPrefix, target.value))}`)?.focus()
    })
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`flex items-center gap-5 border-b border-slate-200 ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
        else if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
        else if (e.key === 'Home') { e.preventDefault(); move('first') }
        else if (e.key === 'End') { e.preventDefault(); move('last') }
      }}
    >
      {items.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            id={tabId(idPrefix, t.value)}
            aria-selected={active}
            aria-controls={panelId(idPrefix, t.value)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 pt-3 text-sm transition-colors ${
              active
                ? 'font-semibold text-slate-900'
                : 'font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {t.label}
            {/* El subrayado activo va suelto y sobresale un poco a los lados: una
                etiqueta corta ("CV") pedía más marca que su propio ancho, y así
                se consigue sin separar las pestañas entre sí. */}
            {active && <span className="absolute -inset-x-1.5 bottom-[-2px] h-0.5 bg-indigo-600" aria-hidden />}
            {t.count != null && (
              <span
                className={`num rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Contenido de la pestaña activa. `tabIndex=0` para poder scrollearlo con el teclado. */
export function TabPanel({
  idPrefix,
  value,
  className = '',
  children,
}: {
  idPrefix: string
  value: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      tabIndex={0}
      className={`focus-visible:outline-none ${className}`}
    >
      {children}
    </div>
  )
}

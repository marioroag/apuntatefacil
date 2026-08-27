/**
 * Interruptor. El control de los ajustes: se aplica AL INSTANTE, sin botón de
 * guardar, así que su forma tiene que decir "encendido / apagado" y no
 * "marcado". Para eso está: un checkbox dice "he elegido esto", un interruptor
 * dice "esto está funcionando". Donde haya que elegir de una lista sigue
 * mandando `Checkbox`; no mezclar los dos para lo mismo.
 *
 * El acento sí va aquí, y no contradice la doctrina: encendido es SELECCIÓN, la
 * misma familia que el nav activo o una fila elegida. Apagado es grafito.
 *
 * Dos piezas a propósito:
 *   * `Switch` cuando el interruptor es el control (lleva su <button role=switch>).
 *   * `SwitchTrack` cuando el control es la FILA entera, que es lo normal en una
 *     pantalla de ajustes: así se pulsa en cualquier parte del renglón y no hay
 *     un botón dentro de otro. Ojo: un <label> alrededor NO sirve, porque una
 *     etiqueta no activa un <button>.
 */

/**
 * DOS TALLAS, Y SE DECLARAN (Mario, ago 2026: "son demasiado brutos").
 *
 * `md` (20x36) es la de una pantalla de AJUSTES, donde el interruptor está solo
 * en su renglón y la fila entera es el control: ahí tiene que pesar.
 * `sm` (16x28) es la de una lista densa dentro de un desplegable, como la de
 * columnas del panel de la vista: al lado de un texto de 13px, la grande se lee
 * como el objeto principal de la fila en vez de como su estado.
 *
 * Se declara en vez de pegarle un `h-4 w-7` desde fuera, que es lo que abrió el
 * mismo agujero con los botones: dos utilidades del mismo eje no se resuelven por
 * el orden en que se escriben.
 */
const TALLA_SWITCH = {
  md: { caja: 'h-5 w-9', pomo: 'size-4', viaje: 'translate-x-4' },
  sm: { caja: 'h-4 w-7', pomo: 'size-3', viaje: 'translate-x-3' },
} as const

/** Solo la pastilla. No es interactiva: quien la use ya es el control. */
export function SwitchTrack({ checked, disabled = false, size = 'md' }: {
  checked: boolean
  disabled?: boolean
  size?: keyof typeof TALLA_SWITCH
}) {
  const t = TALLA_SWITCH[size]
  return (
    <span
      aria-hidden
      className={`relative inline-flex ${t.caja} shrink-0 items-center rounded-full transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${
        disabled ? 'opacity-40' : ''
      } ${checked ? 'bg-indigo-600' : 'bg-slate-300 group-hover:bg-slate-400'}`}
    >
      <span
        className={`pointer-events-none absolute left-0.5 ${t.pomo} rounded-full bg-white shadow-raised transition-transform duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${
          checked ? t.viaje : 'translate-x-0'
        }`}
      />
    </span>
  )
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  label,
  describedBy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  id?: string
  /** Nombre accesible del interruptor suelto. */
  label: string
  describedBy?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
    >
      <SwitchTrack checked={checked} disabled={disabled} />
    </button>
  )
}

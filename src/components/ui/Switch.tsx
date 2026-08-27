/**
 * Interruptor. El control de los ajustes: se aplica AL INSTANTE, sin botón de
 * guardar, así que su forma tiene que decir "encendido / apagado" y no
 * "marcado". Para eso está: un checkbox dice "he elegido esto", un interruptor
 * dice "esto está funcionando". Donde haya que elegir de una lista sigue
 * mandando `Checkbox`; no mezclar los dos para lo mismo.
 *
 * UNA SOLA TALLA (20x36). Llegó a haber una `sm` de 16x28 para la lista de
 * columnas del panel de la vista, porque ahí la grande "era demasiado bruta" al
 * lado de un texto de 13px. Esa lista pasó a casillas en ago 2026, que es lo que
 * la doctrina pedía desde el principio para elegir de una lista, y la talla se
 * quedó sin consumidor: se borra, porque una pieza de vocabulario que no usa
 * nadie es una invitación a reintroducir lo que se quitó. Si algún día vuelve a
 * hacer falta un interruptor pequeño, se DECLARA aquí otra vez; lo que no vale
 * es pegarle un `h-4 w-7` desde fuera (dos utilidades del mismo eje no se
 * resuelven por el orden en que se escriben).
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

/** Solo la pastilla. No es interactiva: quien la use ya es el control. */
export function SwitchTrack({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${
        disabled ? 'opacity-40' : ''
      } ${checked ? 'bg-indigo-600' : 'bg-slate-300 group-hover:bg-slate-400'}`}
    >
      <span
        className={`pointer-events-none absolute left-0.5 size-4 rounded-full bg-white shadow-raised transition-transform duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${
          checked ? 'translate-x-4' : 'translate-x-0'
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

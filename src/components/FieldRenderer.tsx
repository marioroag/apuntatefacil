import { useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, Paperclip, X } from 'lucide-react'
import type { FormField } from '../lib/types'

export type FieldValue = string | string[] | boolean | undefined

// --- Validación (al blur / al enviar, nunca al teclear) --------------------
export function validateField(field: FormField, value: FieldValue): string | null {
  const empty =
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

  if (field.required && empty && field.type !== 'boolean') {
    return 'Este campo es obligatorio'
  }
  if (field.required && field.type === 'boolean' && value === undefined) {
    return 'Elige una opción'
  }
  if (empty) return null

  if (field.type === 'email' && typeof value === 'string') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return 'Escribe un email válido, por ejemplo nombre@dominio.com'
  }
  if (field.type === 'phone' && typeof value === 'string') {
    const digits = value.replace(/\D/g, '')
    // Vale con y sin prefijo: de 9 dígitos (nacional) a 15 (máximo internacional).
    if (digits.length < 9) return 'Escribe un teléfono válido, por ejemplo 600 123 456'
    if (digits.length > 15) return 'Ese teléfono tiene demasiados dígitos, revísalo'
  }
  return null
}

// Formatea un teléfono AL ESCRIBIR: deja solo dígitos (y un '+' inicial para el
// prefijo internacional) y los agrupa de 3 en 3 con espacios. Sin prefijo ->
// "600 123 456"; con prefijo -> "+34 600 123 456" (asumimos código de país de 2
// dígitos, el caso español; no imponemos el formato de otros países). Agrupa desde
// la IZQUIERDA para que los grupos no se reordenen mientras se teclea.
function formatPhoneTyping(raw: string): string {
  const hasPlus = raw.trimStart().startsWith('+')
  // Máximo real de un teléfono (E.164): 15 dígitos, prefijo incluido. Capamos aquí
  // para que ni escribiendo ni pegando se pase (tope duro, no un error a posteriori).
  const digits = raw.replace(/\D/g, '').slice(0, 15)
  if (!digits) return hasPlus ? '+' : ''
  if (hasPlus) {
    const cc = digits.slice(0, 2)
    const rest = digits.slice(2).replace(/(\d{3})(?=\d)/g, '$1 ')
    return rest ? `+${cc} ${rest}` : `+${cc}`
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ')
}

const inputBase =
  'w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-500 ' +
  'transition-[border-color,box-shadow] duration-[var(--duration-control)] outline-none ' +
  'focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]'

function fieldBorder(error?: string) {
  return error ? 'border-red-400' : 'border-slate-300'
}

// Navegación con flechas dentro de un grupo de "radios" (roving tabindex).
function arrowMove(
  e: React.KeyboardEvent,
  count: number,
  index: number,
  go: (i: number) => void,
) {
  let next: number | null = null
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % count
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + count) % count
  if (next !== null) {
    e.preventDefault()
    go(next)
  }
}

export function FieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  onFile,
  error,
  idPrefix = 'f',
}: {
  field: FormField
  value: FieldValue
  onChange: (v: FieldValue) => void
  onBlur?: () => void
  onFile?: (file: File | null) => void
  error?: string
  idPrefix?: string
}) {
  const id = `${idPrefix}-${field.id}`
  const labelId = `${id}-label`
  const descId = field.helpText ? `${id}-help` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label id={labelId} htmlFor={id} className="mb-1.5 block break-words text-sm font-semibold text-slate-800">
        {field.label}
        {/* El rojo tiene dos usos, error de verdad y acción destructiva, y este no es
            ninguno: este mismo fichero pinta el error a unas líneas de aquí, así que un
            asterisco rojo en el rótulo lee como "esto ya está mal" en un formulario
            recién abierto. Baja a la tinta de apoyo. Y como el asterisco va `aria-hidden`
            y el control no declara `required`, lo que decía el glifo no llegaba a un
            lector de pantalla: se escribe. */}
        {field.required && (
          <>
            <span className="ml-0.5 text-slate-500" aria-hidden>*</span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        )}
      </label>
      {field.helpText && (
        <p id={descId} className="mb-1.5 break-words text-[13px] text-slate-500">
          {field.helpText}
        </p>
      )}

      <Control
        field={field}
        id={id}
        labelId={labelId}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFile={onFile}
        error={error}
        describedBy={describedBy}
        invalid={!!error}
      />

      {error && (
        <p id={errId} className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

function Control({
  field,
  id,
  labelId,
  value,
  onChange,
  onBlur,
  onFile,
  describedBy,
  invalid,
  error,
}: {
  field: FormField
  id: string
  labelId: string
  value: FieldValue
  onChange: (v: FieldValue) => void
  onBlur?: () => void
  onFile?: (file: File | null) => void
  describedBy?: string
  invalid: boolean
  error?: string
}) {
  const common = {
    id,
    onBlur,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  }
  const border = fieldBorder(error)

  // Teléfono: al escribir, reformatea agrupando los dígitos y RESTAURA el cursor
  // tras el mismo nº de dígitos que había antes, para que no salte al final al
  // reformatear (permite editar en medio con normalidad).
  const phoneRef = useRef<HTMLInputElement>(null)
  const phoneCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (phoneCaret.current != null && phoneRef.current) {
      phoneRef.current.setSelectionRange(phoneCaret.current, phoneCaret.current)
      phoneCaret.current = null
    }
  })
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const selStart = e.target.selectionStart ?? raw.length
    const digitsBefore = raw.slice(0, selStart).replace(/\D/g, '').length
    const formatted = formatPhoneTyping(raw)
    let caret = formatted.length
    if (digitsBefore === 0) {
      caret = formatted.startsWith('+') ? 1 : 0
    } else {
      let seen = 0
      for (let i = 0; i < formatted.length; i++) {
        const c = formatted.charCodeAt(i)
        if (c >= 48 && c <= 57 && ++seen === digitsBefore) {
          caret = i + 1
          break
        }
      }
    }
    phoneCaret.current = caret
    onChange(formatted)
  }

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...common}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          maxLength={2000}
          className={`${inputBase} ${border} resize-y py-3`}
        />
      )

    case 'select':
      return <SelectControl field={field} id={id} labelId={labelId} value={value as string} onChange={onChange} onBlur={onBlur} describedBy={describedBy} invalid={invalid} />

    case 'multiselect':
      return <MultiSelectControl field={field} id={id} labelId={labelId} value={(value as string[]) ?? []} onChange={onChange} describedBy={describedBy} invalid={invalid} />

    case 'boolean':
      return <BooleanControl id={id} labelId={labelId} value={value as boolean | undefined} onChange={onChange} invalid={invalid} describedBy={describedBy} />

    case 'file':
      return <FileControl id={id} value={value as string | undefined} onChange={onChange} onFile={onFile} error={error} describedBy={describedBy} />

    case 'date':
      return (
        <input
          {...common}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} ${border} h-12`}
        />
      )

    case 'number':
      return (
        <input
          {...common}
          type="number"
          inputMode="numeric"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value.slice(0, 12))}
          placeholder={field.placeholder}
          className={`${inputBase} ${border} h-12`}
        />
      )

    case 'phone':
      return (
        <input
          {...common}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          ref={phoneRef}
          value={(value as string) ?? ''}
          onChange={handlePhoneChange}
          placeholder={field.placeholder ?? '600 000 000'}
          maxLength={22}
          className={`${inputBase} ${border} h-12`}
        />
      )

    case 'email':
      return (
        <input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? 'nombre@email.com'}
          maxLength={254}
          className={`${inputBase} ${border} h-12`}
        />
      )

    default:
      return (
        <input
          {...common}
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={100}
          className={`${inputBase} ${border} h-12`}
        />
      )
  }
}

// 2-5 opciones: radios visibles (cards) operables por teclado. 6+: select nativo.
function SelectControl({
  field,
  id,
  labelId,
  value,
  onChange,
  onBlur,
  describedBy,
  invalid,
}: {
  field: FormField
  id: string
  labelId: string
  value?: string
  onChange: (v: FieldValue) => void
  onBlur?: () => void
  describedBy?: string
  invalid: boolean
}) {
  const options = field.options ?? []
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  if (options.length > 5) {
    // El chevron es un icono de verdad, no una imagen de fondo. Antes era el
    // `ChevronDown` de lucide embebido como data-URI dentro de la clase
    // `bg-[url(...)]`, y **Tailwind nunca llegó a generar esa utilidad**: el
    // desplegable salía con `appearance-none` y sin ninguna flecha, o sea con
    // pinta de campo de texto que no se puede escribir. Se descubrió al buscarlo
    // en el CSS compilado (ago 2026); llevaba roto en main. Como icono normal
    // hereda `--stroke-icon` igual que los demás y no hay nada que recordar.
    return (
      <div className="relative">
        <select
          id={id}
          onBlur={onBlur}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} ${invalid ? 'border-red-400' : 'border-slate-300'} h-12 appearance-none pr-10`}
        >
          <option value="" disabled>Elige una opción</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-500"
          aria-hidden
        />
      </div>
    )
  }

  const focusIndex = options.findIndex((o) => o === value)
  return (
    <div role="radiogroup" id={id} aria-labelledby={labelId} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="grid gap-2">
      {options.map((o, i) => {
        const sel = value === o
        const tabbable = sel || (focusIndex === -1 && i === 0)
        return (
          <button
            type="button"
            key={o}
            ref={(el) => { refs.current[i] = el }}
            role="radio"
            aria-checked={sel}
            tabIndex={tabbable ? 0 : -1}
            onKeyDown={(e) => arrowMove(e, options.length, i, (ni) => { onChange(options[ni]); refs.current[ni]?.focus() })}
            onClick={() => onChange(o)}
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-base transition-colors ${
              sel ? 'bg-[color-mix(in_srgb,var(--accent)_8%,white)] text-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            style={sel ? { borderColor: 'var(--accent)' } : undefined}
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${sel ? '' : 'border-slate-300'}`}
              style={sel ? { borderColor: 'var(--accent)' } : undefined}
            >
              {sel && <span className="size-2.5 rounded-full bg-accent" />}
            </span>
            <span className="min-w-0 break-words">{o}</span>
          </button>
        )
      })}
    </div>
  )
}

function MultiSelectControl({
  field,
  id,
  labelId,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  field: FormField
  id: string
  labelId: string
  value: string[]
  onChange: (v: FieldValue) => void
  describedBy?: string
  invalid: boolean
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <div role="group" id={id} aria-labelledby={labelId} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {(field.options ?? []).map((o) => {
        const sel = value.includes(o)
        return (
          <button
            type="button"
            key={o}
            aria-pressed={sel}
            onClick={() => toggle(o)}
            // 44px de alto (`min-h-11`): con `py-2` se quedaban en 38 y esto es el
            // formulario PÚBLICO, que se rellena con el pulgar. Sin variante táctil, a
            // todos los anchos, igual que los 48px de los inputs de al lado: aquí no hay
            // densidad de escritorio que proteger.
            className={`inline-flex min-h-11 max-w-full items-center gap-1.5 break-words rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              sel ? 'text-on-accent' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            style={sel ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
          >
            {sel && <Check className="size-3.5 shrink-0" aria-hidden />}
            <span className="min-w-0 break-words">{o}</span>
          </button>
        )
      })}
    </div>
  )
}

function BooleanControl({
  id,
  labelId,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  labelId: string
  value?: boolean
  onChange: (v: FieldValue) => void
  invalid: boolean
  describedBy?: string
}) {
  const opts = [
    { v: true, label: 'Sí' },
    { v: false, label: 'No' },
  ]
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const focusIndex = opts.findIndex((o) => o.v === value)
  return (
    <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="flex gap-2" id={id}>
      {opts.map(({ v, label }, i) => {
        const sel = value === v
        const tabbable = sel || (focusIndex === -1 && i === 0)
        return (
          <button
            type="button"
            key={label}
            ref={(el) => { refs.current[i] = el }}
            role="radio"
            aria-checked={sel}
            tabIndex={tabbable ? 0 : -1}
            onKeyDown={(e) => arrowMove(e, opts.length, i, (ni) => { onChange(opts[ni].v); refs.current[ni]?.focus() })}
            onClick={() => onChange(v)}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border text-base font-medium transition-colors ${
              sel ? 'text-on-accent' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            style={sel ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
          >
            {sel && <Check className="size-4" aria-hidden />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

function FileControl({
  id,
  value,
  onChange,
  onFile,
  error,
  describedBy,
}: {
  id: string
  value?: string
  onChange: (v: FieldValue) => void
  onFile?: (file: File | null) => void
  error?: string
  describedBy?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const errId = `${id}-fileerr`

  const handleFile = (file?: File) => {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setLocalErr(`El archivo pesa ${(file.size / 1048576).toFixed(1)} MB y el máximo es 8 MB. Sube un archivo más pequeño`)
      return
    }
    setLocalErr(null)
    onChange(file.name)
    onFile?.(file)
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-3">
        <Paperclip className="size-4 shrink-0 text-slate-500" aria-hidden />
        <span className="flex-1 truncate text-base text-slate-800">{value}</span>
        <button
          type="button"
          onClick={() => { onChange(undefined); onFile?.(null) }}
          // Es el único camino para corregir un CV equivocado desde el móvil y medía 28px
          // de alto. La diana se DESPEGA del dibujo con un `::after` invisible (28 + 8 + 8
          // = 44) en vez de engordar el botón, que estiraría la fila del archivo entera.
          // Es el mismo recurso que la cápsula de estado del puesto.
          className="relative inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" aria-hidden /> Quitar
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".pdf,.doc,.docx"
        aria-describedby={[describedBy, localErr ? errId : null].filter(Boolean).join(' ') || undefined}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:bg-slate-50 ${
          error || localErr ? 'border-red-400' : 'border-slate-300'
        }`}
      >
        <Paperclip className="size-5 text-slate-500" aria-hidden />
        <span className="text-sm font-medium text-slate-700">Sube tu CV</span>
        <span className="text-[13px] text-slate-500">PDF o Word, hasta 8 MB</span>
      </button>
      {localErr && (
        <p id={errId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {localErr}
        </p>
      )}
    </div>
  )
}

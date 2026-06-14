import { useRef, useState } from 'react'
import { AlertCircle, Check, Paperclip, X } from 'lucide-react'
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
    if (digits.length < 9) return 'Escribe un teléfono válido, por ejemplo 600 123 456'
  }
  return null
}

const inputBase =
  'w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
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
      <label id={labelId} htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {field.helpText && (
        <p id={descId} className="mb-1.5 text-[13px] text-slate-500">
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

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...common}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
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
          onChange={(e) => onChange(e.target.value)}
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
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? '600 000 000'}
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
    return (
      <select
        id={id}
        onBlur={onBlur}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${invalid ? 'border-red-400' : 'border-slate-300'} h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:18px] bg-[right_0.85rem_center] bg-no-repeat pr-10`}
      >
        <option value="" disabled>Elige una opción</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
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
            {o}
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              sel ? 'text-on-accent' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            style={sel ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
          >
            {sel && <Check className="size-3.5" aria-hidden />}
            {o}
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
        <Paperclip className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="flex-1 truncate text-base text-slate-800">{value}</span>
        <button
          type="button"
          onClick={() => { onChange(undefined); onFile?.(null) }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
        <Paperclip className="size-5 text-slate-400" aria-hidden />
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

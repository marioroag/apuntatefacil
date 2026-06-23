import { useState, type CSSProperties } from 'react'
import { AlertCircle, Check, Loader2, Lock } from 'lucide-react'
import type { Campaign } from '../lib/types'
import { FieldRenderer } from './FieldRenderer'
import type { FieldValue } from './FieldRenderer'
import { readableOn } from '../lib/colors'

/**
 * Render presentacional del formulario. Lo usan TANTO el formulario público
 * como la vista previa del builder, con el mismo markup y CSS (WYSIWYG real).
 */
export function ApplicationForm({
  campaign,
  values,
  errors,
  onChange,
  onBlur,
  onFile,
  onSubmit,
  submitPhase = 'idle',
  companyName,
  logoUrl,
  bannerUrl,
  consent = false,
  onConsentChange,
  consentError,
  preview = false,
}: {
  campaign: Campaign
  values: Record<string, FieldValue>
  errors: Record<string, string>
  onChange: (fieldId: string, v: FieldValue) => void
  onBlur?: (fieldId: string) => void
  onFile?: (fieldId: string, file: File | null) => void
  onSubmit?: () => void
  submitPhase?: 'idle' | 'uploading' | 'submitting'
  companyName: string
  logoUrl?: string | null
  bannerUrl?: string | null
  // Consentimiento del candidato (RGPD): obligatorio para enviar. Lo gestiona el padre.
  consent?: boolean
  onConsentChange?: (v: boolean) => void
  consentError?: string
  preview?: boolean
}) {
  const accent = campaign.branding.accent
  const style = {
    '--accent': accent,
    '--accent-contrast': readableOn(accent),
  } as CSSProperties
  // "Leer más" del aviso de privacidad: despliega una explicación honesta inline.
  const [showPrivacy, setShowPrivacy] = useState(false)

  const errorList = campaign.fields
    .filter((f) => errors[f.id])
    .map((f) => ({ id: f.id, label: f.label, msg: errors[f.id] }))

  const busy = submitPhase !== 'idle'
  const submitLabel =
    submitPhase === 'uploading'
      ? 'Subiendo archivo...'
      : submitPhase === 'submitting'
        ? 'Enviando candidatura...'
        : 'Enviar candidatura'

  return (
    <form
      style={style}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      noValidate
      className="w-full"
    >
      {/* Cabecera con el branding del cliente */}
      <header className="mb-6">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="mb-4 h-28 w-full rounded-xl object-cover sm:h-32" />
        )}
        {campaign.branding.showLogo && (
          <div className="mb-4 flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : (
              <span
                className="grid size-8 place-items-center rounded-lg text-sm font-bold text-on-accent"
                style={{ backgroundColor: accent }}
              >
                {companyName.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 break-words text-sm font-semibold text-slate-700">{companyName}</span>
          </div>
        )}
        <h1 className="break-words text-[25px] font-bold leading-tight tracking-tight text-slate-900">
          {campaign.title}
        </h1>
        {campaign.branding.welcome && (
          <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-600">{campaign.branding.welcome}</p>
        )}
      </header>

      {/* Resumen de errores (al enviar) */}
      {errorList.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertCircle className="size-4" aria-hidden />
            Revisa {errorList.length === 1 ? 'este campo' : `estos ${errorList.length} campos`}
          </p>
          <ul className="mt-1.5 space-y-0.5 pl-6 text-[13px] text-red-600">
            {errorList.map((e) => (
              <li key={e.id} className="list-disc">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`f-${e.id}`)
                    const target = el && el.matches('input,select,textarea,button,[tabindex]')
                      ? el
                      : (el?.querySelector('input,select,textarea,button') as HTMLElement | null)
                    target?.focus()
                    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  }}
                  className="break-words text-left underline hover:text-red-700"
                >
                  {e.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-5">
        {campaign.fields.map((f) => (
          <FieldRenderer
            key={f.id}
            field={f}
            value={values[f.id]}
            onChange={(v) => onChange(f.id, v)}
            onBlur={onBlur ? () => onBlur(f.id) : undefined}
            onFile={onFile ? (file) => onFile(f.id, file) : undefined}
            error={errors[f.id]}
          />
        ))}
      </div>

      <p className="mt-4 text-[13px] text-slate-500">Los campos con * son obligatorios</p>

      {/* Aviso de privacidad honesto */}
      <p className="mt-5 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-500">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">
          Tus datos se enviarán a {companyName} para este proceso de selección.{' '}
          {!showPrivacy ? (
            <button type="button" onClick={() => setShowPrivacy(true)} className="underline hover:text-slate-600">
              Leer más
            </button>
          ) : (
            <>
              Solo {companyName} verá tu candidatura para este puesto: no la compartimos con terceros ni la
              usamos para publicidad. Puedes pedir que actualicen o borren tus datos contactando con la empresa.{' '}
              <button type="button" onClick={() => setShowPrivacy(false)} className="underline hover:text-slate-600">
                Leer menos
              </button>
            </>
          )}
        </span>
      </p>

      {/* Consentimiento del candidato (RGPD), obligatorio. Casilla SIN marcar (sin dark
          patterns), con el acento del cliente. El enlace abre en pestaña nueva para no
          perder lo que ha escrito el candidato. */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
        <span className="relative mt-px inline-flex shrink-0">
          <input
            id="consent-check"
            type="checkbox"
            checked={!!consent}
            onChange={(e) => onConsentChange?.(e.target.checked)}
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? 'consent-err' : undefined}
            style={consent ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
            className={`size-5 cursor-pointer appearance-none rounded-[5px] border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] motion-reduce:transition-none ${consent ? '' : consentError ? 'border-red-400 bg-white' : 'border-slate-300 bg-white'}`}
          />
          <Check strokeWidth={3.5} aria-hidden className={`pointer-events-none absolute inset-0 m-auto size-3.5 text-on-accent transition-opacity motion-reduce:transition-none ${consent ? 'opacity-100' : 'opacity-0'}`} />
        </span>
        <span className="min-w-0 break-words">
          He leído y acepto la{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 underline hover:text-slate-900">
            política de privacidad
          </a>
          {' '}y que {companyName} trate mis datos para este proceso de selección.
        </span>
      </label>
      {consentError && (
        <p id="consent-err" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {consentError}
        </p>
      )}

      {busy && (
        <p role="status" aria-live="polite" className="sr-only">
          {submitPhase === 'uploading' ? 'Subiendo archivo' : 'Enviando candidatura'}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || preview}
        aria-busy={busy}
        className="on-accent mt-4 flex w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(18,22,34,0.24)] ring-1 ring-inset ring-black/10 transition-[filter,transform] duration-150 ease-[var(--ease-out)] hover:brightness-[1.06] active:translate-y-px disabled:opacity-70"
        style={{ backgroundColor: accent, height: 52 }}
      >
        {busy && <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />}
        {submitLabel}
      </button>
      {preview && (
        <p className="mt-2 text-center text-[12px] text-slate-500">Vista previa, lo que verá el candidato</p>
      )}
    </form>
  )
}

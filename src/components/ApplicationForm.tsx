import type { CSSProperties } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
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
  onSubmit,
  submitting,
  companyName,
  preview = false,
}: {
  campaign: Campaign
  values: Record<string, FieldValue>
  errors: Record<string, string>
  onChange: (fieldId: string, v: FieldValue) => void
  onBlur?: (fieldId: string) => void
  onSubmit?: () => void
  submitting?: boolean
  companyName: string
  preview?: boolean
}) {
  const accent = campaign.branding.accent
  const style = {
    '--accent': accent,
    '--accent-contrast': readableOn(accent),
  } as CSSProperties

  const errorList = campaign.fields
    .filter((f) => errors[f.id])
    .map((f) => ({ id: f.id, label: f.label, msg: errors[f.id] }))

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
        {campaign.branding.showLogo && (
          <div className="mb-4 flex items-center gap-2">
            <span
              className="grid size-8 place-items-center rounded-lg text-sm font-bold text-on-accent"
              style={{ backgroundColor: accent }}
            >
              {companyName.slice(0, 1)}
            </span>
            <span className="text-sm font-semibold text-slate-700">{companyName}</span>
          </div>
        )}
        <h1 className="text-[25px] font-bold leading-tight tracking-tight text-slate-900">
          {campaign.branding.headline || campaign.title}
        </h1>
        {campaign.branding.welcome && (
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{campaign.branding.welcome}</p>
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
                  className="text-left underline hover:text-red-700"
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
            error={errors[f.id]}
          />
        ))}
      </div>

      <p className="mt-4 text-[13px] text-slate-400">Los campos con * son obligatorios</p>

      {/* Aviso de privacidad honesto */}
      <p className="mt-5 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-400">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>
          Tus datos se enviarán a {companyName} para este proceso de selección.{' '}
          <button type="button" className="underline hover:text-slate-600">Leer más</button>
        </span>
      </p>

      <button
        type="submit"
        disabled={submitting || preview}
        className="on-accent mt-4 flex w-full items-center justify-center rounded-xl text-base font-semibold text-on-accent transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
        style={{ backgroundColor: accent, height: 52 }}
      >
        {submitting ? 'Enviando...' : 'Enviar candidatura'}
      </button>
      {preview && (
        <p className="mt-2 text-center text-[12px] text-slate-400">Vista previa, lo que verá el candidato</p>
      )}
    </form>
  )
}

import { useState, type CSSProperties } from 'react'
import { AlertCircle, Check, Loader2, Lock } from 'lucide-react'
import type { Campaign } from '../lib/types'
import { FieldRenderer } from './FieldRenderer'
import type { FieldValue } from './FieldRenderer'
import { accentOnWhite, readableOn } from '../lib/colors'
import { CAJA_LOGO, HojaPublica } from './HojaPublica'
import { ENLACE_PRIVACIDAD, consentimientoVigente } from '../lib/consent'

/**
 * Render presentacional del formulario. Lo usan TANTO el formulario público
 * como la vista previa del builder, con el mismo markup y CSS (WYSIWYG real).
 *
 * ES LA SEGUNDA MITAD DEL ANUNCIO, NO OTRA PANTALLA (Mario, ago 2026). Antes
 * era una tarjeta de 480px flotando sobre gris, con el banner metido DENTRO y
 * redondeado por las cuatro esquinas: al pulsar "Apúntate ahora" la foto
 * encogía, se despegaba del borde y el fondo cambiaba de color, así que el
 * candidato pasaba de una página a otra distinta justo en el momento en el que
 * hay que decidir si te fías. Ahora comparte con el anuncio la pieza que hace
 * ese gesto (`HojaPublica`): la foto a sangre y la hoja subiendo sobre ella.
 * Lo que cambia entre las dos pantallas es lo que hay DEBAJO de la foto, que es
 * lo único que tiene que cambiar.
 *
 * LA HOJA VA A SANGRE Y LO QUE SE ACOTA ES LA COLUMNA. El formulario sigue
 * siendo de una columna de 480 (mobile-first, inputs de 48 y letra de 16), pero
 * esa columna vive centrada dentro de una hoja que llega a los bordes, igual
 * que el contenido del anuncio vive centrado en la suya. Si se acotara la hoja,
 * en una ventana ancha la foto asomaría por los lados acabada en seco.
 *
 * EL TÍTULO VA PRIMERO Y LA MARCA DEBAJO, como en el anuncio en columna
 * estrecha: en una pantalla de móvil el nombre del puesto es lo único que no
 * puede esperar, y con la marca delante el titular arranca una línea más abajo.
 * El logo va en su caja con filo y el nombre en el color de la empresa, que es
 * exactamente lo que se acaba de ver en el anuncio: el candidato tiene que
 * reconocer que sigue en el mismo sitio.
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
  retencionMeses = null,
  logoUrl,
  bannerUrl,
  consent = false,
  onConsentChange,
  consentError,
  aviso,
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
  /** Cuánto conserva la empresa las candidaturas de este proceso: meses tras
   *  cerrarlo, o null si las guarda hasta que las elimine. Se le dice al
   *  candidato junto al consentimiento (art. 13 RGPD: plazo o criterio). */
  retencionMeses?: number | null
  logoUrl?: string | null
  bannerUrl?: string | null
  // Consentimiento del candidato (RGPD): obligatorio para enviar. Lo gestiona el padre.
  consent?: boolean
  onConsentChange?: (v: boolean) => void
  consentError?: string
  /**
   * El aviso de que el envío ha fallado. Lo pinta el padre (es él quien habla
   * con la red) pero VIVE AQUÍ DENTRO: con la hoja a sangre, un bloque pintado
   * antes del formulario caería encima de la foto de cabecera.
   */
  aviso?: React.ReactNode
  preview?: boolean
}) {
  const accent = campaign.branding.accent
  // Tres variables y no dos: el acento tal cual (fondos), el texto que se lee
  // ENCIMA de él, y el acento oscurecido lo justo para leerse SOBRE blanco, que
  // es lo que necesita el nombre de la empresa. Un amarillo de marca sobre
  // blanco se queda en 1,67:1 y el nombre no se leería.
  const style = {
    '--accent': accent,
    '--accent-contrast': readableOn(accent),
    '--accent-ink': accentOnWhite(accent),
  } as CSSProperties
  // "Leer más" del aviso de privacidad: despliega una explicación honesta inline.
  const [showPrivacy, setShowPrivacy] = useState(false)

  // El texto del consentimiento, partido para colgarle el enlace en medio. Si
  // la frase enlazable no estuviera, se pinta entero y sin enlace: mejor sin
  // enlace que con un texto que no es el que se guarda.
  const textoConsent = consentimientoVigente(companyName)
  const corte = textoConsent.indexOf(ENLACE_PRIVACIDAD)
  const antesDelEnlace = corte < 0 ? textoConsent : textoConsent.slice(0, corte)
  const despuesDelEnlace = corte < 0 ? '' : textoConsent.slice(corte + ENLACE_PRIVACIDAD.length)

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
      <HojaPublica bannerUrl={bannerUrl}>
        {/* La hoja llega a los bordes; lo que se acota es la COLUMNA. El
            formulario sigue siendo de 480, mobile-first. */}
        <div className="mx-auto w-full max-w-[480px] px-6 pb-10 pt-7 sm:px-8">
      {aviso}
      {/* Cabecera con el branding del cliente, con la anatomía del anuncio en
          columna estrecha: el puesto primero y la marca debajo. */}
      <header className="mb-7">
        <h1 className="break-words text-[26px] font-bold leading-tight tracking-tight text-slate-900">
          {campaign.title}
        </h1>
        {campaign.branding.showLogo && (
          <div className="mt-5 flex items-center gap-3.5">
            {logoUrl ? (
              // `object-contain` y relleno, no `cover`: un logotipo no se
              // recorta. La caja con filo es la del anuncio.
              <img src={logoUrl} alt="" className={CAJA_LOGO} />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-lg font-bold text-on-accent">
                {companyName.slice(0, 1)}
              </span>
            )}
            {/* En TINTA, no en el color de la marca (Mario, sep 2026): el nombre es
                quién contrata, no un botón, y teñido se leía como un enlace o
                como un control. La marca ya la dicen el logo, el banner y el
                botón; el acento se queda para lo que se pulsa. */}
            <span className="min-w-0 break-words text-base font-bold text-slate-900">{companyName}</span>
          </div>
        )}
        {campaign.branding.welcome && (
          <p className="mt-5 whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-600">{campaign.branding.welcome}</p>
        )}
      </header>

      {/* Resumen de errores (al enviar) */}
      {errorList.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl filo-red-200 bg-red-50 p-3.5">
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
              Solo {companyName} verá tu candidatura para este puesto: no la vendemos, no la damos a otras
              empresas y no la usamos para publicidad. Para que esto funcione nos apoyamos en proveedores
              (alojamiento, correo y, si la empresa lo usa, un asistente
              que resume las candidaturas), que solo la tratan por cuenta de {companyName} y están
              listados en la política de privacidad.
              {retencionMeses != null
                ? ` ${companyName} borra las candidaturas de este puesto ${retencionMeses} meses después de cerrarlo, salvo la de quien contrate.`
                : ` ${companyName} conserva tu candidatura hasta que la elimine.`}{' '}
              Puedes pedir que actualicen o borren tus datos contactando con la empresa.{' '}
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
          <Check aria-hidden className={`pointer-events-none absolute inset-0 m-auto size-3.5 text-on-accent transition-opacity [stroke-width:3.5] motion-reduce:transition-none ${consent ? 'opacity-100' : 'opacity-0'}`} />
        </span>
        {/* El texto NO se escribe aquí: se lee de src/lib/consent.ts, que es lo
            que se guarda por versión con cada candidatura. Si se escribiera en
            los dos sitios acabarían diciendo cosas distintas, y el id guardado
            apuntaría a algo que este candidato nunca leyó. Lo único que hace
            esta vista es colgar el enlace de la frase que ya está dentro. */}
        <span className="min-w-0 break-words">
          {antesDelEnlace}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 underline hover:text-slate-900">
            {ENLACE_PRIVACIDAD}
          </a>
          {despuesDelEnlace}
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
        // EL MISMO BOTÓN QUE EL "Apúntate ahora" DEL ANUNCIO (ago 2026): son dos
        // pantallas seguidas y tenían dos acabados distintos, uno que ACLARABA al
        // pasar por encima y otro que oscurecía. Oscurecer es lo que dice la
        // doctrina del botón, y el anillo negro al 10% sobraba: el color ya hace
        // el trabajo.
        className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-on-accent transition-[filter] duration-[var(--duration-control)] ease-[var(--ease-out)] hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_22%,transparent)] active:translate-y-px disabled:opacity-70 motion-reduce:transition-none"
      >
        {busy && <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />}
        {submitLabel}
      </button>
      {preview && (
        <p className="mt-2 text-center text-[12px] text-slate-500">Vista previa, lo que verá el candidato</p>
      )}
        </div>
      </HojaPublica>
    </form>
  )
}

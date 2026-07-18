import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, RotateCcw, X } from 'lucide-react'
import { copyText } from '../lib/clipboard'
import { replyBodyForCampaign, replyForCampaign } from '../lib/shareReply'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { useToast } from './ui/Toast'

type ShareReplyProps = {
  title: string
  /** URL canónica completa (https://…) que se incluye en la respuesta y se copia sola. */
  url: string
  /** Versión sin protocolo para toasts de fallback. */
  urlDisplay?: string
  disabled?: boolean
  demo?: boolean
  className?: string
  /**
   * `popover` / `sheet`: cabecera propia (Dashboard).
   * `section`: sin cabecera (Builder ya tiene SectionTitle).
   */
  variant?: 'popover' | 'sheet' | 'section'
  /** Enlace "Abrir formulario" (Builder). */
  formHref?: string
  /** Si true, el enlace de abrir formulario no navega (demo). */
  formDemo?: boolean
  onFormDemoClick?: () => void
  /** Plantilla personalizada guardada en el puesto. */
  savedReply?: string | null
  /** Persiste la plantilla del puesto. `null` restablece la respuesta base. */
  onSaveReply?: (reply: string | null) => Promise<boolean>
  /** Lleva el foco al editor al abrir la capa de compartir. */
  autoFocus?: boolean
  /** Cierra el panel flotante de escritorio. */
  onClose?: () => void
  /** Tras copiar la respuesta con éxito. */
  onCopied?: () => void
}

const FIELD =
  'min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 ' +
  'outline-none placeholder:text-slate-500 transition-shadow ' +
  'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
  'pointer-coarse:text-base'

export function ShareReply({
  title,
  url,
  urlDisplay,
  disabled = false,
  demo = false,
  className = '',
  variant = 'section',
  formHref,
  formDemo = false,
  onFormDemoClick,
  savedReply,
  onSaveReply,
  autoFocus = false,
  onClose,
  onCopied,
}: ShareReplyProps) {
  const toast = useToast()
  const defaultBody = replyBodyForCampaign({ title })
  const display = urlDisplay ?? url.replace(/^https?:\/\//, '')
  const template = savedReply ?? defaultBody
  const [draft, setDraft] = useState(template)
  const [copied, setCopied] = useState<'reply' | 'link' | null>(null)
  const [saving, setSaving] = useState(false)
  const lastSaved = useRef(template)
  const savingRef = useRef(false)
  const draftId = useId()

  useEffect(() => {
    // La store actualiza de forma optimista. Si el guardado falla y revierte,
    // conservamos el texto del usuario para que pueda reintentarlo.
    if (savingRef.current) return
    setDraft(template)
    lastSaved.current = template
  }, [template])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(null), 1600)
    return () => window.clearTimeout(t)
  }, [copied])

  const reply = replyForCampaign({ title, url, body: draft })
  const edited = draft !== defaultBody
  const changed = draft !== lastSaved.current

  const saveDraft = async () => {
    if (!onSaveReply || !changed || !draft.trim()) return true
    savingRef.current = true
    setSaving(true)
    const body = draft === defaultBody ? null : draft
    const saved = await onSaveReply(body)
    if (saved) lastSaved.current = body ?? defaultBody
    savingRef.current = false
    setSaving(false)
    return saved
  }

  const copyReply = async () => {
    if (!draft.trim()) return
    await saveDraft()
    const ok = await copyText(reply)
    if (ok) {
      setCopied('reply')
      toast.success('Respuesta copiada')
      onCopied?.()
    } else {
      toast.show('Copia manualmente:\n' + reply)
    }
  }

  const copyLink = async () => {
    const ok = await copyText(url)
    if (ok) {
      setCopied('link')
      toast.success('Enlace copiado')
    } else {
      toast.show('Copia el enlace manualmente: ' + display)
    }
  }

  const showHeader = variant === 'popover'
  const bodyClass = variant === 'sheet' ? 'px-4 pb-4 pt-3' : ''
  const resetDraft = async () => {
    setDraft(defaultBody)
    if (!onSaveReply) return
    savingRef.current = true
    setSaving(true)
    const saved = await onSaveReply(null)
    if (saved) lastSaved.current = defaultBody
    savingRef.current = false
    setSaving(false)
  }

  return (
    <div className={className}>
      {showHeader && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-900">Compartir puesto</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              Copia la respuesta o el enlace del formulario.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </header>
      )}
      <div className={bodyClass}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor={draftId} className="text-[13px] font-semibold text-slate-800">
            Mensaje
          </label>
          {edited && (
            <button
              type="button"
              onClick={() => void resetDraft()}
              disabled={saving}
              className="inline-flex min-h-8 max-sm:min-h-11 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg px-2 text-[12px] max-sm:text-sm pointer-coarse:text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Restablecer
            </button>
          )}
        </div>
        <textarea
          id={draftId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void saveDraft()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') void saveDraft()
          }}
          disabled={disabled}
          rows={5}
          spellCheck
          autoFocus={autoFocus}
          className={FIELD}
        />
        <p className="mt-1.5 text-[12px] max-sm:text-sm pointer-coarse:text-sm leading-relaxed text-slate-500">
          {saving
            ? 'Guardando la plantilla…'
            : 'El enlace se añade al copiar. Los cambios se guardan en este puesto al salir del campo.'}
        </p>
        {demo && (
          <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[12px] max-sm:text-sm pointer-coarse:text-sm leading-relaxed text-slate-600">
            Estás en la demo. Puedes copiar el texto, pero el enlace es solo de muestra.
          </p>
        )}

        <button
          type="button"
          onClick={copyReply}
          disabled={disabled || !draft.trim() || saving}
          className={`${BTN_PRIMARY} mt-3 w-full max-sm:min-h-11 disabled:opacity-50`}
        >
          {copied === 'reply' ? (
            <>
              <Check className="size-4 text-indigo-200" aria-hidden /> Copiado
            </>
          ) : (
            <>
              <Copy className="size-4 text-indigo-200" aria-hidden /> Copiar respuesta
            </>
          )}
        </button>

        <div className="my-4 h-px bg-slate-200" />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-800">Enlace del formulario</p>
          {formDemo ? (
            <button
              type="button"
              onClick={onFormDemoClick}
              className="inline-flex min-h-8 max-sm:min-h-11 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg px-2 text-[12px] max-sm:text-sm pointer-coarse:text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
            >
              <ExternalLink className="size-3.5" aria-hidden /> Abrir
            </button>
          ) : (
            <a
              href={formHref ?? url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 max-sm:min-h-11 pointer-coarse:min-h-11 items-center gap-1.5 rounded-lg px-2 text-[12px] max-sm:text-sm pointer-coarse:text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
            >
              <ExternalLink className="size-3.5" aria-hidden /> Abrir
            </a>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="num min-w-0 flex-1 truncate text-[12px] max-sm:text-sm pointer-coarse:text-sm text-slate-500">{display}</span>
          <button
            type="button"
            onClick={copyLink}
            disabled={disabled}
            className={`${BTN_SECONDARY} max-sm:min-h-11 shrink-0 disabled:opacity-50`}
          >
            {copied === 'link' ? (
              <>
                <Check className="size-3.5 text-slate-500" aria-hidden /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-slate-400" aria-hidden /> Copiar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

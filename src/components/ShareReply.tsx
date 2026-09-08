import { Check, Copy, ExternalLink, Pencil, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { BTN_PRIMARY, botonIcono } from '../lib/buttons'
import { copyText } from '../lib/clipboard'
import {
  editableReplyBody,
  replyBodyForCampaign,
  replyForCampaign,
} from '../lib/shareReply'
import { useToast } from './ui/Toast'

// El botón fantasma de solo icono ya está en `buttons.ts`; esto era una copia a
// mano de su pintura, y como todas las copias había derivado: sin el tercer
// peldaño de la rampa (`active:`), así que al pulsarlo no pasaba nada. El
// `max-sm:size-11` se conserva tal cual porque es el objetivo de toque que ya
// tenía; el foco lo pone `:focus-visible` global, no hace falta repetirlo.
const ICON_ACTION = botonIcono('ghost', 'sm', 'max-sm:size-11 disabled:opacity-50')

const TEXT_ACTION =
  'inline-flex min-h-8 max-sm:min-h-11 items-center gap-1.5 rounded-lg px-1.5 text-[13px] font-medium text-slate-600 ' +
  'transition-colors hover:bg-slate-100 hover:text-slate-900 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ' +
  'disabled:opacity-60'

type ShareReplyProps = {
  title: string
  url: string
  urlDisplay?: string
  template?: string | null
  disabled?: boolean
  demo?: boolean
  className?: string
  variant?: 'popover' | 'sheet'
  formHref?: string
  formDemo?: boolean
  onFormDemoClick?: () => void
  /** Si existe, "Editar" abre el mensaje aquí mismo. */
  onSaveReply?: (reply: string | null) => Promise<boolean>
  onClose?: () => void
}

const FIELD =
  'min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 ' +
  'outline-none placeholder:text-slate-500 transition-shadow ' +
  'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
  'pointer-coarse:text-base'

export function ShareReply({
  title,
  url,
  urlDisplay,
  template,
  disabled = false,
  demo = false,
  className = '',
  variant = 'popover',
  formHref,
  formDemo = false,
  onFormDemoClick,
  onSaveReply,
  onClose,
}: ShareReplyProps) {
  const toast = useToast()
  const draftId = useId()
  const defaultBody = replyBodyForCampaign({ title })
  const savedBody = editableReplyBody({ body: template, title })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(savedBody)
  const [copied, setCopied] = useState<'reply' | 'link' | null>(null)
  const [saving, setSaving] = useState(false)
  const lastSaved = useRef(savedBody)
  const savingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const showHeader = variant === 'popover'
  const display = urlDisplay ?? url.replace(/^https?:\/\//, '')
  const canEdit = Boolean(onSaveReply) && !disabled
  const edited = draft !== defaultBody

  useEffect(() => {
    if (savingRef.current) return
    const next = editableReplyBody({ body: template, title })
    setDraft(next)
    lastSaved.current = next
  }, [template, title])

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(null), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

  useEffect(() => {
    if (!editing) return
    textareaRef.current?.focus()
    const el = textareaRef.current
    if (!el) return
    const end = el.value.length
    el.setSelectionRange(end, end)
  }, [editing])

  const saveDraft = async (value = draft) => {
    if (!onSaveReply) return true
    const next = value.trim() ? value : defaultBody
    if (next === lastSaved.current) return true
    savingRef.current = true
    setSaving(true)
    const saved = await onSaveReply(next === defaultBody ? null : next)
    if (saved) lastSaved.current = next
    savingRef.current = false
    setSaving(false)
    return saved
  }

  const copyReply = async () => {
    if (editing) await saveDraft()
    const text = replyForCampaign({
      body: editing ? draft : template,
      title,
      url,
    })
    const copiedReply = await copyText(text)
    if (copiedReply) {
      setCopied('reply')
      toast.success('Respuesta copiada')
    } else {
      toast.show(`Copia manualmente:\n${text}`)
    }
  }

  const copyLink = async () => {
    const copiedLink = await copyText(url)
    if (copiedLink) {
      setCopied('link')
      toast.success('Enlace copiado')
    } else {
      toast.show(`Copia el enlace manualmente: ${display}`)
    }
  }

  const resetDraft = async () => {
    setDraft(defaultBody)
    await saveDraft(defaultBody)
  }

  const finishEditing = async () => {
    await saveDraft()
    setEditing(false)
  }

  return (
    <div className={`${variant === 'sheet' ? 'px-4 pb-5 pt-3' : ''} ${className}`}>
      {showHeader && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-900">Compartir puesto</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-slate-600">Copia una respuesta lista para enviar.</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={botonIcono('ghost', 'md', '-mr-1.5 -mt-1')}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </header>
      )}

      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={editing ? draftId : undefined} className="text-[13px] font-semibold text-slate-800">
          Mensaje
        </label>
        {canEdit && (
          editing ? (
            <div className="flex items-center gap-0.5">
              {edited && (
                <button type="button" onClick={() => void resetDraft()} disabled={saving} className={TEXT_ACTION}>
                  <RotateCcw className="size-3.5" aria-hidden /> Restablecer
                </button>
              )}
              <button type="button" onClick={() => void finishEditing()} disabled={saving} className={TEXT_ACTION}>
                Guardar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className={TEXT_ACTION}>
              <Pencil className="size-3.5" aria-hidden /> Editar
            </button>
          )
        )}
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          id={draftId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void saveDraft()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              void finishEditing()
            }
          }}
          disabled={disabled || saving}
          rows={4}
          spellCheck
          className={FIELD}
        />
      ) : (
        <div className="min-h-[4.5rem] whitespace-pre-wrap rounded-xl filo bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-800">
          {savedBody}
        </div>
      )}

      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
        {saving ? 'Guardando…' : 'El enlace se añade automáticamente al copiar.'}
      </p>

      {demo && (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
          Estás en la demo. Puedes copiar el texto, pero el enlace es solo de muestra.
        </p>
      )}

      {/* SIN ICONO, y no es una simplificación: un botón a ancho completo centra
          el conjunto icono+texto, así que el rótulo queda descentrado (12px
          medidos en el caso del lateral). El icono acompaña al texto en botones
          estrechos con la etiqueta a la izquierda, donde no centra nada. El
          acuse de copiado no se pierde: lo dice la palabra. */}
      <button
        type="button"
        onClick={() => void copyReply()}
        disabled={disabled || saving}
        className={`${BTN_PRIMARY} mt-3 w-full max-sm:min-h-11 disabled:opacity-50`}
      >
        {copied === 'reply' ? 'Copiado' : 'Copiar respuesta'}
      </button>

      <div className="mt-2 flex min-w-0 items-center gap-1 rounded-xl filo bg-slate-50 py-1 pl-3 pr-1">
        <p className="min-w-0 flex-1 truncate text-[12px] num text-slate-600" title={display}>
          {display}
        </p>
        {formDemo ? (
          <button
            type="button"
            onClick={onFormDemoClick}
            className={ICON_ACTION}
            aria-label="Abrir el enlace"
            title="Abrir el enlace"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </button>
        ) : (
          <a
            href={formHref ?? url}
            target="_blank"
            rel="noreferrer"
            className={ICON_ACTION}
            aria-label="Abrir el enlace"
            title="Abrir el enlace"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={disabled}
          className={ICON_ACTION}
          aria-label="Copiar enlace"
          title="Copiar enlace"
        >
          {copied === 'link' ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </div>
    </div>
  )
}

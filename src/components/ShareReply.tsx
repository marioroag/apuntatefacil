import { BriefcaseBusiness, Check, Copy, ExternalLink, Link2, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { copyText } from '../lib/clipboard'
import {
  SHARE_LINK_TOKEN,
  resolveReplyTemplate,
  tokenizeReplyTemplate,
} from '../lib/shareReply'
import { useToast } from './ui/Toast'

type ShareReplyProps = {
  title: string
  url: string
  urlDisplay?: string
  template?: string | null
  disabled?: boolean
  demo?: boolean
  className?: string
  variant?: 'popover' | 'sheet' | 'section'
  formHref?: string
  formDemo?: boolean
  onFormDemoClick?: () => void
  editHref?: string
  onClose?: () => void
}

export function ShareReply({
  title,
  url,
  urlDisplay,
  template,
  disabled = false,
  demo = false,
  className = '',
  variant = 'section',
  formHref,
  formDemo = false,
  onFormDemoClick,
  editHref,
  onClose,
}: ShareReplyProps) {
  const toast = useToast()
  const [copied, setCopied] = useState<'reply' | 'link' | null>(null)
  const showHeader = variant === 'popover'
  const reply = resolveReplyTemplate({ template, title, url })
  const display = urlDisplay ?? url.replace(/^https?:\/\//, '')

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(null), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const copyReply = async () => {
    const copiedReply = await copyText(reply)
    if (copiedReply) {
      setCopied('reply')
      toast.success('Respuesta copiada')
    } else {
      toast.show(`Copia manualmente:\n${reply}`)
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

  return (
    <div className={className}>
      {showHeader && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-900">Compartir puesto</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">Copia una respuesta lista para enviar.</p>
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

      <p className="mb-2 text-[13px] font-semibold text-slate-800">Mensaje</p>
      <div className="min-h-24 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800">
        {tokenizeReplyTemplate(template).map((segment, index) => {
          if (segment.type === 'text') {
            return <span key={`${segment.value}-${index}`} className="whitespace-pre-wrap">{segment.value}</span>
          }
          const isLink = segment.value === SHARE_LINK_TOKEN
          return (
            <span
              key={`${segment.value}-${index}`}
              className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 align-baseline text-[12px] font-medium text-slate-700"
            >
              {isLink ? <Link2 className="size-3 text-slate-500" aria-hidden /> : <BriefcaseBusiness className="size-3 text-slate-500" aria-hidden />}
              {isLink ? 'Enlace al formulario' : 'Puesto'}
            </span>
          )
        })}
      </div>
      {demo && (
        <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
          Estás en la demo. Puedes copiar el texto, pero el enlace es solo de muestra.
        </p>
      )}

      <button
        type="button"
        onClick={copyReply}
        disabled={disabled}
        className={`${BTN_PRIMARY} mt-3 w-full max-sm:min-h-11 disabled:opacity-50`}
      >
        {copied === 'reply' ? <><Check className="size-4 text-indigo-200" aria-hidden /> Copiado</> : <><Copy className="size-4 text-indigo-200" aria-hidden /> Copiar respuesta</>}
      </button>

      <div className="mt-2 flex items-center justify-between gap-2">
        {editHref ? (
          <Link
            to={editHref}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Pencil className="size-3.5" aria-hidden /> Editar plantilla
          </Link>
        ) : <span />}
        <div className="flex items-center gap-1">
          {formDemo ? (
            <button
              type="button"
              onClick={onFormDemoClick}
              className="inline-flex size-8 max-sm:size-11 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50"
              aria-label="Abrir formulario"
              title="Abrir formulario"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </button>
          ) : (
            <a
              href={formHref ?? url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 max-sm:size-11 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50"
              aria-label="Abrir formulario"
              title="Abrir formulario"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          <button
            type="button"
            onClick={copyLink}
            disabled={disabled}
            className={`${BTN_SECONDARY} size-8 max-sm:size-11 px-0 text-slate-600 disabled:opacity-50`}
            aria-label="Copiar enlace"
            title="Copiar enlace"
          >
            {copied === 'link' ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  )
}

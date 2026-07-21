import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, Info, Loader2, MailCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { INTEREST_BATCH_LIMIT, previewInterestCandidates, type InterestOmissionReason, type InterestSendResult } from '../lib/interest'
import type { Campaign, Candidate } from '../lib/types'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'

const REASON_LABEL: Record<InterestOmissionReason | 'duplicate' | 'not_visible', string> = {
  missing_email: 'Sin correo válido',
  wait_reminder: 'Contactados hace menos de 7 días',
  wait_recheck: 'Confirmaron interés hace menos de 30 días',
  not_interested: 'Indicaron que ya no les interesa',
  reminder_used: 'Ya recibieron el recordatorio permitido',
  duplicate: 'Correo repetido en la selección',
  not_visible: 'No disponibles',
}

export function InterestCheckDialog({
  open,
  campaign,
  candidates,
  base,
  demo,
  onClose,
  onSent,
}: {
  open: boolean
  campaign: Campaign
  candidates: Candidate[]
  base: string
  demo: boolean
  onClose: () => void
  onSent: () => void
}) {
  const { sendInterestCheck } = useStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InterestSendResult | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const hasEmailField = campaign.fields.some((field) => field.type === 'email')

  const close = useCallback(() => {
    if (busyRef.current) return
    setResult(null)
    setIdempotencyKey(crypto.randomUUID())
    onClose()
  }, [onClose])

  const preview = useMemo(() => {
    const rows = previewInterestCandidates(candidates, campaign.fields)
    const seen = new Set<string>()
    const omitted: Partial<Record<InterestOmissionReason | 'duplicate', number>> = {}
    let recipients = 0
    for (const row of rows) {
      if (!row.eligibility.eligible || !row.email) {
        const reason = row.eligibility.eligible ? 'missing_email' : row.eligibility.reason
        omitted[reason] = (omitted[reason] ?? 0) + 1
      } else if (seen.has(row.email)) {
        omitted.duplicate = (omitted.duplicate ?? 0) + 1
      } else {
        seen.add(row.email)
        recipients += 1
      }
    }
    return { recipients, omitted }
  }, [campaign.fields, candidates])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => panelRef.current?.focus(), 40)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) close()
      if (event.key !== 'Tab') return
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a,button:not([disabled])') ?? [])
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [close, open])

  const send = async () => {
    if (busy || preview.recipients === 0 || preview.recipients > INTEREST_BATCH_LIMIT) return
    setBusy(true)
    busyRef.current = true
    const next = await sendInterestCheck(campaign.id, candidates.map((candidate) => candidate.id), idempotencyKey)
    setBusy(false)
    busyRef.current = false
    setResult(next)
    if (next.sent > 0) onSent()
  }

  const retry = () => {
    setResult(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const displayedOmissions = result?.omitted ?? preview.omitted
  const overLimit = preview.recipients > INTEREST_BATCH_LIMIT

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="interest-dialog-title">
          <motion.div className="absolute inset-0 bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative max-h-[calc(100svh-2rem)] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-5 shadow-pop outline-none sm:p-6"
            initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 6 }}
          >
            <button type="button" onClick={close} disabled={busy} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50" aria-label="Cerrar">
              <X className="size-5" aria-hidden />
            </button>
            <div className="flex items-start gap-3 pr-9">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><MailCheck className="size-5" aria-hidden /></span>
              <div>
                <h2 id="interest-dialog-title" className="text-lg font-semibold text-slate-950">Comprobar interés</h2>
                <p className="mt-0.5 text-sm text-slate-500">Pregunta si siguen interesados/as antes de contactar personalmente.</p>
              </div>
            </div>

            {!hasEmailField ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                <div className="flex gap-2.5">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Este formulario no pide correo</p>
                    <p className="mt-1 text-[13px] leading-5 text-amber-900/80">Añade un campo de correo para poder enviar esta comprobación a futuras candidaturas.</p>
                    <Link to={`${base}/puestos/${campaign.id}/formulario`} onClick={close} className="mt-2 inline-flex text-[13px] font-semibold text-amber-950 underline underline-offset-2">Añadir correo al formulario</Link>
                  </div>
                </div>
              </div>
            ) : result ? (
              <div className="mt-5">
                <div className={`rounded-xl border px-4 py-4 ${result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <p className={`text-sm font-semibold ${result.ok ? 'text-emerald-950' : 'text-amber-950'}`}>
                    {result.duplicate
                      ? 'Este envío ya se había procesado'
                      : result.sent > 0
                        ? `${result.sent} ${result.sent === 1 ? 'correo enviado' : 'correos enviados'}`
                        : 'No se envió ningún correo'}
                  </p>
                  {result.failed > 0 && <p className="mt-1 text-[13px] text-amber-900">{result.failed} {result.failed === 1 ? 'envío falló' : 'envíos fallaron'} y se pueden reintentar.</p>}
                  {result.error && <p className="mt-1 text-[13px] text-amber-900">{result.error}</p>}
                  {demo && result.ok && <p className="mt-1 text-[13px] text-emerald-900">Simulación completada. La demo no envía correos reales.</p>}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-2xl font-semibold tabular-nums text-slate-950">{preview.recipients}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Destinatarios únicos</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-2xl font-semibold tabular-nums text-slate-950">{candidates.length - preview.recipients}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Candidaturas omitidas</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vista previa</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">¿Sigues interesado/a en {campaign.title}?</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-slate-600">La empresa quiere saber si sigues interesado/a en el puesto para poder valorar los siguientes pasos.</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white">Sí, sigo interesado/a</span>
                    <span className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">No, ya no me interesa</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-5 text-slate-600">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                  Cada correo repetido recibe un solo mensaje. Las respuestas se mostrarán en todas sus candidaturas elegibles.
                </div>
              </>
            )}

            {Object.values(displayedOmissions).some(Boolean) && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Omitidos</p>
                <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
                  {Object.entries(displayedOmissions).filter(([, count]) => Number(count) > 0).map(([reason, count]) => (
                    <li key={reason} className="flex justify-between gap-3"><span>{REASON_LABEL[reason as keyof typeof REASON_LABEL]}</span><span className="font-medium tabular-nums text-slate-800">{count}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {overLimit && <p className="mt-4 text-sm text-amber-700">Puedes enviar como máximo {INTEREST_BATCH_LIMIT} correos únicos cada vez. Reduce la selección.</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className={BTN_SECONDARY}>{result ? 'Cerrar' : 'Cancelar'}</button>
              {!result && hasEmailField && preview.recipients > 0 && !overLimit && (
                <button type="button" onClick={() => void send()} disabled={busy} className={`${BTN_PRIMARY} disabled:cursor-wait disabled:opacity-70`}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {demo ? 'Simular envío' : `Enviar ${preview.recipients === 1 ? 'correo' : `${preview.recipients} correos`}`}
                </button>
              )}
              {result && (result.failed > 0 || !result.ok) && <button type="button" onClick={retry} className={BTN_PRIMARY}>Reintentar</button>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

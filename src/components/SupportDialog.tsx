import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'
import { SUPPORT_EMAIL, supportMailto } from '../lib/brand'

// Formulario de soporte. Un único componente para los dos sitios (WYSIWYG): la
// landing lo abre anónimo (source 'landing'), el panel identificado (source 'app',
// con email y empresa precargados). Escribe vía RPC security definer y avisa por
// email al equipo. Si el backend falla, ofrece el email como salida (nunca deja
// al usuario atascado ni le borra lo que escribió).
const INPUT =
  'w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'

export function SupportDialog({
  open,
  onClose,
  source,
  defaultEmail = '',
  defaultName = '',
  companyId,
  page,
}: {
  open: boolean
  onClose: () => void
  source: 'app' | 'landing'
  defaultEmail?: string
  defaultName?: string
  companyId?: string
  page?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState<{ email?: boolean; message?: boolean }>({})
  const [errors, setErrors] = useState<{ email?: string; message?: string }>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)

  // Al abrir: reseteamos a los valores por defecto y enfocamos el primer campo
  // vacío. Nunca arrastramos el estado de una apertura anterior.
  useEffect(() => {
    if (!open) return
    setName(defaultName)
    setEmail(defaultEmail)
    setMessage('')
    setTouched({})
    setErrors({})
    setSending(false)
    setSent(false)
    setFailed(false)
    const t = window.setTimeout(() => {
      // Enfoca email si viene vacío (landing), si no el mensaje (panel ya tiene email).
      const target = defaultEmail ? panelRef.current?.querySelector<HTMLTextAreaElement>('#support-message') : firstRef.current
      target?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [open, defaultEmail, defaultName])

  // Cierre con Escape, foco atrapado, scroll del fondo bloqueado (mismo patrón que ConfirmDialog).
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      opener?.focus?.()
    }
  }, [open, onClose, sending])

  const validate = (field: 'email' | 'message', value: string): string | undefined => {
    if (field === 'email') {
      const v = value.trim()
      if (!v) return 'Escribe tu email para que podamos responderte.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Escribe un email válido, por ejemplo nombre@dominio.com.'
      return undefined
    }
    if (!value.trim()) return 'Cuéntanos en qué te ayudamos.'
    return undefined
  }

  const onBlur = (field: 'email' | 'message') => {
    const value = field === 'email' ? email : message
    // Al salir del campo solo validamos lo que YA está escrito (p. ej. un email con
    // mal formato). El error de "obligatorio vacío" se reserva al envío: no debe
    // saltar solo por pasar de largo el campo sin escribir nada.
    if (!value.trim()) {
      setErrors((e) => ({ ...e, [field]: undefined }))
      return
    }
    setTouched((t) => ({ ...t, [field]: true }))
    setErrors((e) => ({ ...e, [field]: validate(field, value) }))
  }

  const submit = async () => {
    const eEmail = validate('email', email)
    const eMessage = validate('message', message)
    setTouched({ email: true, message: true })
    setErrors({ email: eEmail, message: eMessage })
    if (eEmail || eMessage) return

    setSending(true)
    setFailed(false)
    const { data: ticketId, error } = await supabase.rpc('submit_support_request', {
      p_email: email.trim(),
      p_message: message.trim(),
      p_name: name.trim() || null,
      p_source: source,
      p_page: page ?? null,
      p_company_id: companyId ?? null,
    })
    if (error) {
      setSending(false)
      setFailed(true)
      return
    }
    // Aviso por email al equipo (best-effort: si falla, la consulta ya está guardada).
    if (ticketId) supabase.functions.invoke('notify-support', { body: { ticket_id: ticketId } }).catch(() => {})
    setSending(false)
    setSent(true)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="support-title">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => !sending && onClose()}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative w-full max-w-[460px] rounded-xl bg-white p-6 shadow-pop outline-none"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              <X className="size-4" aria-hidden />
            </button>

            {sent ? (
              <div className="py-2 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full bg-green-50 text-green-600">
                  <Check className="size-5" aria-hidden />
                </div>
                <h2 id="support-title" className="mt-4 text-lg font-semibold text-slate-900">Mensaje enviado</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Gracias, lo tenemos. Te respondemos por email lo antes posible.
                </p>
                <div className="mt-6">
                  <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
                </div>
              </div>
            ) : (
              <>
                <h2 id="support-title" className="text-lg font-semibold text-slate-900">¿En qué te ayudamos?</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Cuéntanos qué necesitas y te respondemos por email.
                </p>

                <div className="mt-5 space-y-3.5">
                  <div>
                    <label htmlFor="support-name" className="mb-1 block text-[13px] font-medium text-slate-700">
                      Nombre <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      ref={firstRef}
                      id="support-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className={`h-10 ${INPUT}`}
                    />
                  </div>

                  <div>
                    <label htmlFor="support-email" className="mb-1 block text-[13px] font-medium text-slate-700">Email</label>
                    <input
                      id="support-email"
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => onBlur('email')}
                      autoComplete="email"
                      aria-invalid={touched.email && !!errors.email}
                      aria-describedby={errors.email ? 'support-email-err' : undefined}
                      className={`h-10 ${INPUT} ${touched.email && errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : ''}`}
                    />
                    {touched.email && errors.email && (
                      <p id="support-email-err" className="mt-1 text-[13px] text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="support-message" className="mb-1 block text-[13px] font-medium text-slate-700">Mensaje</label>
                    <textarea
                      id="support-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onBlur={() => onBlur('message')}
                      rows={4}
                      aria-invalid={touched.message && !!errors.message}
                      aria-describedby={errors.message ? 'support-message-err' : undefined}
                      className={`resize-none py-2.5 ${INPUT} ${touched.message && errors.message ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : ''}`}
                    />
                    {touched.message && errors.message && (
                      <p id="support-message-err" className="mt-1 text-[13px] text-red-600">{errors.message}</p>
                    )}
                  </div>
                </div>

                {failed && (
                  <p className="mt-3 text-[13px] leading-relaxed text-red-600">
                    No hemos podido enviar tu mensaje. Inténtalo de nuevo o escríbenos a{' '}
                    <a href={supportMailto()} className="font-semibold underline underline-offset-2">{SUPPORT_EMAIL}</a>.
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
                  <Button onClick={submit} loading={sending} loadingLabel="Enviando">Enviar</Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

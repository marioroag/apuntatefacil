import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, Info, Loader2, MailCheck, MessageCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { WHATSAPP_ASSISTANT_ENABLED } from '../lib/settings'
import { WHATSAPP_LISTO } from '../lib/whatsapp'
import { AvisoWhatsappPendiente } from './WhatsappPendiente'
import { interestEmailPreview } from '../lib/interestEmail'
import { textoInteres } from '../../supabase/functions/_shared/whatsapp/render'
import { INTEREST_BATCH_LIMIT, previewInterestCandidates, type InterestOmissionReason, type InterestSendResult } from '../lib/interest'
import type { Campaign, Candidate, InterestChannel } from '../lib/types'
import { BTN_PRIMARY, BTN_SECONDARY, botonIcono } from '../lib/buttons'
import { DUR, EASE } from '../lib/motion'

/**
 * El movimiento del diálogo, con las duraciones del sistema.
 *
 * Framer Motion no lee los tokens del CSS y, sin `transition`, pone su default:
 * un MUELLE en `scale`/`y` y 300ms en la opacidad, o sea un rebote y un tiempo
 * por encima del techo de 240ms, en un diálogo. Entra en `enter` (180ms, algo
 * aparece) y sale en `control` (150ms): cerrar responde a tu dedo. Mismo
 * contrato que `ui/Modal`.
 */
const ENTRA = { duration: DUR.enter, ease: EASE.out }
const SALE = { duration: DUR.control, ease: EASE.out }

const REASON_LABEL: Record<InterestOmissionReason | 'duplicate' | 'not_visible', string> = {
  missing_email: 'Sin correo válido',
  missing_phone: 'Sin un teléfono que podamos usar',
  no_consent: 'No aceptaron que les escribamos por WhatsApp',
  wait_reminder: 'Contactados hace menos de 7 días',
  wait_recheck: 'Confirmaron interés hace menos de 30 días',
  not_interested: 'Indicaron que ya no les interesa',
  reminder_used: 'Ya recibieron el recordatorio permitido',
  duplicate: 'Repetidos en la selección',
  not_visible: 'No disponibles',
}

/**
 * Lo que cambia entre canales, en un solo sitio.
 *
 * La PREGUNTA no está aquí: es la misma para los dos y sale de su función de
 * verdad (`interestEmailPreview` y `textoInteres`), no de una copia escrita a
 * mano en la interfaz. Aquí solo vive cómo se llama lo que se manda, que es lo
 * único que un empresario nota distinto.
 */
const CANAL = {
  email: {
    nombre: 'Correo',
    icono: MailCheck,
    uno: 'correo',
    varios: 'correos',
    repetido: 'Cada correo repetido recibe un solo mensaje.',
  },
  whatsapp: {
    nombre: 'WhatsApp',
    icono: MessageCircle,
    uno: 'mensaje',
    varios: 'mensajes',
    repetido: 'Cada teléfono repetido recibe un solo mensaje.',
  },
} as const satisfies Record<InterestChannel, unknown>

/**
 * El hueco del nombre en la vista previa.
 *
 * No se pone un nombre de ejemplo ("Hola Rubén") porque quien lo lee no puede
 * saber si eso es una muestra o si a los 40 les va a llegar el mismo nombre. Y
 * tampoco se quita el saludo, porque entonces la vista previa enseña un mensaje
 * más frío del que sale de verdad. Se enseña el HUECO, que es lo que hay ahí.
 *
 * Es un carácter de uso privado: se mete en el texto que devuelven las funciones
 * de verdad (`textoInteres`, `interestEmailPreview`) y se parte por él al pintar.
 * Así la vista previa sigue saliendo de una sola fuente, sin copiar el texto.
 */
const HUECO = ''

function ConHueco({ texto }: { texto: string }) {
  const trozos = texto.split(HUECO)
  return (
    <>
      {trozos.map((trozo, i) => (
        <span key={i}>
          {/* Sin fondo ni relleno a propósito: una pastilla deja al punto de la
              frase separado de la palabra ("candidato ."), y en una vista previa
              que existe para enseñar el texto exacto, eso es un texto distinto. */}
          {i > 0 && <span className="font-medium text-slate-500">[nombre del candidato]</span>}
          {trozo}
        </span>
      ))}
    </>
  )
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
  const { sendInterestCheck, brands } = useStore()
  const { company } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InterestSendResult | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [canal, setCanal] = useState<InterestChannel>('email')
  const hasEmailField = campaign.fields.some((field) => field.type === 'email')
  const hasPhoneField = campaign.fields.some((field) => field.type === 'phone')

  // WhatsApp solo se ofrece si se puede usar de verdad: el asistente está
  // encendido y el formulario pide teléfono. Quien no lo tenga no ve el
  // concepto, en vez de una pestaña bloqueada que recuerda lo que no tiene.
  const puedeWhatsapp = WHATSAPP_ASSISTANT_ENABLED && hasPhoneField
  // Aquí el WhatsApp no se esconde mientras se da de alta el número, se enseña
  // apagado: es una empresa que YA tiene el canal en su plan y con teléfono en
  // su formulario, así que quitarlo de la vista sin decir nada solo consigue que
  // lo busque. El motivo va debajo y el correo sigue funcionando igual.
  const whatsappEnEspera = puedeWhatsapp && !WHATSAPP_LISTO
  const canalActivo: InterestChannel = puedeWhatsapp && WHATSAPP_LISTO ? canal : 'email'
  const meta = CANAL[canalActivo]
  const Icono = meta.icono
  // Quién firma: la marca del puesto si la tiene, si no la empresa. Lo mismo
  // que decide el envío del correo, para que la vista previa no mienta.
  const firma = brands.find((b) => b.id === campaign.brandId)?.name ?? company?.name ?? 'La empresa'

  const close = useCallback(() => {
    if (busyRef.current) return
    setResult(null)
    setIdempotencyKey(crypto.randomUUID())
    onClose()
  }, [onClose])

  const preview = useMemo(() => {
    const rows = previewInterestCandidates(candidates, campaign.fields, canalActivo)
    const seen = new Set<string>()
    const omitted: Partial<Record<InterestOmissionReason | 'duplicate', number>> = {}
    let recipients = 0
    for (const row of rows) {
      if (!row.eligibility.eligible || !row.to) {
        const reason = row.eligibility.eligible ? (row.missing ?? 'missing_email') : row.eligibility.reason
        omitted[reason] = (omitted[reason] ?? 0) + 1
      } else if (seen.has(row.to)) {
        omitted.duplicate = (omitted.duplicate ?? 0) + 1
      } else {
        seen.add(row.to)
        recipients += 1
      }
    }
    return { recipients, omitted }
  }, [campaign.fields, candidates, canalActivo])

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
    const next = await sendInterestCheck(campaign.id, candidates.map((candidate) => candidate.id), idempotencyKey, canalActivo)
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
  // La pregunta, tal y como sale. Las dos opciones son las mismas en los dos
  // canales: son los botones de la plantilla de WhatsApp y los enlaces del
  // correo, y por eso se pintan de aquí en ambos casos.
  const correo = interestEmailPreview({
    campaignTitle: campaign.title,
    senderName: firma,
    candidateName: HUECO,
  })

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="interest-dialog-title">
          <motion.div className="absolute inset-0 bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: ENTRA }} exit={{ opacity: 0, transition: SALE }} onClick={close} />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative max-h-[calc(100svh-2rem)] w-full max-w-[520px] overflow-y-auto rounded-xl bg-white p-5 shadow-pop outline-none sm:p-6"
            initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0, transition: ENTRA }} exit={{ opacity: 0, scale: 0.98, y: 6, transition: SALE }}
          >
            {/* Fabricada con la pieza de la casa: a mano medía 32px y no crecía en
                táctil (el mínimo son 44), y su glifo iba en `slate-400`, que es
                tinta de icono decorativo y no de algo que se pulsa. */}
            <button type="button" onClick={close} disabled={busy} className={botonIcono('ghost', 'md', 'absolute right-4 top-4 disabled:opacity-50')} aria-label="Cerrar">
              <X className="size-5" aria-hidden />
            </button>
            <div className="flex items-start gap-3 pr-11">
              <Icono className="size-5 shrink-0 text-slate-700" aria-hidden />
              <div>
                <h2 id="interest-dialog-title" className="text-lg font-semibold text-slate-950">Comprobar interés</h2>
                <p className="mt-0.5 text-sm text-slate-500">Pregunta si siguen interesados/as antes de contactar personalmente.</p>
              </div>
            </div>

            {puedeWhatsapp && !result && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500" id="interest-canal-label">Por dónde</p>
                {/* Radios NATIVOS, no botones con role="radio": así las flechas
                    del teclado mueven la elección sin escribir nada, que es lo
                    que un lector de pantalla anuncia que va a pasar.

                    La PINTURA es la del conmutador de la casa (`SwitchVista`, en
                    Dashboard): caja RECTANGULAR con filo y divisoria interior, no
                    un carril gris con una pastilla blanca deslizándose dentro,
                    que es el patrón que se retiró en ago 2026. `overflow-clip`
                    porque los hijos son cajas cuadradas que llegan al filo y en la
                    curva de la esquina se comerían el borde. */}
                <div className="mt-2 flex h-10 overflow-clip rounded-lg filo bg-white pointer-coarse:h-11" role="radiogroup" aria-labelledby="interest-canal-label">
                  {(['email', 'whatsapp'] as const).map((id, i) => {
                    const activo = canalActivo === id
                    const enEspera = id === 'whatsapp' && whatsappEnEspera
                    const C = CANAL[id].icono
                    return (
                      <label
                        key={id}
                        className={`flex h-full flex-1 items-center justify-center gap-2 px-3 text-[13px] font-medium transition-colors duration-[var(--duration-control)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-indigo-500/40 ${
                          // La divisoria la pinta la mitad de la derecha: un
                          // `divide-x` en el padre lo taparía el fondo del activo.
                          i > 0 ? 'border-l border-slate-200' : ''
                        } ${
                          activo
                            ? 'bg-indigo-100 text-indigo-700'
                            : enEspera
                              ? 'cursor-not-allowed text-slate-400'
                              : 'cursor-pointer text-slate-800 hover:bg-slate-50'
                        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name="interest-canal"
                          className="sr-only"
                          checked={activo}
                          disabled={busy || enEspera}
                          onChange={() => setCanal(id)}
                        />
                        <C className="size-4" aria-hidden />
                        {CANAL[id].nombre}
                        {/* La chapa dice POR QUÉ no se puede elegir, en el sitio
                            donde se intenta elegir. El texto largo va debajo. */}
                        {enEspera && (
                          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[var(--tracking-overline)] text-slate-600">
                            Pronto
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
                {whatsappEnEspera && <AvisoWhatsappPendiente className="mt-2" />}
              </div>
            )}

            {canalActivo === 'email' && !hasEmailField ? (
              <div className="mt-5 rounded-xl filo-amber-200 bg-amber-50 px-4 py-3.5">
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
                <div className={`rounded-xl px-4 py-4 ${result.ok ? 'filo-emerald-200 bg-emerald-50' : 'filo-amber-200 bg-amber-50'}`}>
                  <p className={`text-sm font-semibold ${result.ok ? 'text-emerald-950' : 'text-amber-950'}`}>
                    {result.duplicate
                      ? 'Este envío ya se había procesado'
                      : result.sent > 0
                        ? `${result.sent} ${result.sent === 1 ? `${meta.uno} enviado` : `${meta.varios} enviados`}`
                        : `No se envió ningún ${meta.uno}`}
                  </p>
                  {result.failed > 0 && <p className="mt-1 text-[13px] text-amber-900">{result.failed} {result.failed === 1 ? 'envío falló' : 'envíos fallaron'} y se pueden reintentar.</p>}
                  {result.error && <p className="mt-1 text-[13px] text-amber-900">{result.error}</p>}
                  {demo && result.ok && <p className="mt-1 text-[13px] text-emerald-900">Simulación completada. La demo no envía nada real.</p>}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl filo bg-slate-50 px-4 py-3">
                    <p className="text-2xl font-semibold num text-slate-950">{preview.recipients}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Destinatarios únicos</p>
                  </div>
                  <div className="rounded-xl filo bg-slate-50 px-4 py-3">
                    <p className="text-2xl font-semibold num text-slate-950">{candidates.length - preview.recipients}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Candidaturas omitidas</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl filo px-4 py-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vista previa</p>
                  {canalActivo === 'email' ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{correo.subject}</p>
                      <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-slate-600">
                        <ConHueco texto={correo.body} />
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-[13px] leading-5 text-slate-700">
                      <ConHueco texto={textoInteres(HUECO, firma, campaign.title)} />
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {correo.options.map((opcion) => (
                      <span key={opcion} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">{opcion}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-5 text-slate-600">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                  {meta.repetido} Las respuestas se mostrarán en todas sus candidaturas elegibles.
                </div>
              </>
            )}

            {Object.values(displayedOmissions).some(Boolean) && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Omitidos</p>
                <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
                  {Object.entries(displayedOmissions).filter(([, count]) => Number(count) > 0).map(([reason, count]) => (
                    <li key={reason} className="flex justify-between gap-3"><span>{REASON_LABEL[reason as keyof typeof REASON_LABEL]}</span><span className="font-medium num text-slate-800">{count}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {overLimit && <p className="mt-4 text-sm text-amber-700">Puedes enviar como máximo {INTEREST_BATCH_LIMIT} {meta.varios} cada vez. Reduce la selección.</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className={BTN_SECONDARY}>{result ? 'Cerrar' : 'Cancelar'}</button>
              {!result && (canalActivo === 'whatsapp' || hasEmailField) && preview.recipients > 0 && !overLimit && (
                <button type="button" onClick={() => void send()} disabled={busy} className={`${BTN_PRIMARY} disabled:cursor-wait disabled:opacity-70`}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {demo ? 'Simular envío' : `Enviar ${preview.recipients === 1 ? meta.uno : `${preview.recipients} ${meta.varios}`}`}
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

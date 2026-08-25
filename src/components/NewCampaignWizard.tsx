import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  HardHat, HeartHandshake, Loader2, Lock, PenLine, ShoppingBag, Sparkles, Truck, UtensilsCrossed, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from './ui/Toast'
import { TEMPLATES, templateCampaignInput } from '../lib/templates'
import type { SectorTemplate } from '../lib/templates'
import { blankCampaignInput } from '../lib/defaults'
import { useAppBase } from '../lib/useAppBase'
import { PLAN_LABEL, PLAN_PROCESS_LIMIT, PRECIO_PROCESO } from '../lib/pricing'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed, HardHat, Truck, Sparkles, ShoppingBag, HeartHandshake,
}

// Crea un puesto desde una plantilla (o desde cero). Lo comparten el modal
// "Nuevo puesto" y el paso 2 del onboarding: una sola lógica de creación.
// `status: 'cerrada'` lo usa el flujo de pago: el puesto se crea a la espera y
// el webhook de Stripe lo abre al completarse el cobro.
export function useCreateFromTemplate() {
  const { createCampaign } = useStore()
  const { company } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const create = async (key: string, t?: SectorTemplate, opts?: { status?: 'activa' | 'cerrada' }) => {
    if (!company || busy) return null
    setBusy(key)
    const input = t ? templateCampaignInput(t, company.accent) : blankCampaignInput(company.accent)
    const c = await createCampaign({ ...input, status: opts?.status })
    setBusy(null)
    if (!c) toast.error('No se pudo crear el puesto.')
    return c
  }

  return { busy, create }
}

// Rejilla de plantillas por sector + "desde cero". Presentacional: quien la usa
// decide qué pasa al elegir (el modal navega y cierra; el onboarding navega).
export function TemplateGrid({ busyKey, onPick }: {
  busyKey: string | null
  onPick: (key: string, t?: SectorTemplate) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {TEMPLATES.map((t) => {
        const Icon = ICONS[t.icon] ?? PenLine
        const loading = busyKey === t.key
        return (
          <button
            key={t.key}
            onClick={() => onPick(t.key, t)}
            disabled={!!busyKey}
            className="group flex flex-col items-start gap-2 rounded-xl filo bg-white p-3.5 text-left transition-colors hover:filo-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />}
            </span>
            <span className="text-sm font-semibold text-slate-900">{t.label}</span>
            <span className="text-[12px] text-slate-500">{t.title}, {t.fields.length} preguntas</span>
          </button>
        )
      })}

      <button
        onClick={() => onPick('blank')}
        disabled={!!busyKey}
        className="group flex flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
      >
        <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
          {busyKey === 'blank' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PenLine className="size-5" aria-hidden />}
        </span>
        <span className="text-sm font-semibold text-slate-900">Desde cero</span>
        <span className="text-[12px] text-slate-500">Solo nombre y teléfono</span>
      </button>
    </div>
  )
}

export function NewCampaignWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { campaigns, previewReabrir, reabrirProceso, contratarHueco } = useStore()
  const { company } = useAuth()
  const navigate = useNavigate()
  const base = useAppBase()
  const { busy, create } = useCreateFromTemplate()
  const [cobro, setCobro] = useState<null | { key: string; t?: SectorTemplate; amountDue: number | null; free: boolean }>(null)
  const [cobrando, setCobrando] = useState(false)

  // Qué le espera a este proceso nuevo, espejo en cliente del enforcement de
  // servidor. En el pago por proceso nunca hay muro: o hay hueco pagado libre
  // ('libre'), o se cobra uno más a la suscripción ('cobrar'), o falta el
  // método de pago y se pasa por Stripe Checkout ('checkout'). El muro solo
  // queda para los tiers antiguos, que tienen tope fijo.
  const abiertos = campaigns.filter((c) => c.status !== 'cerrada').length
  const activos = campaigns.filter((c) => c.status === 'activa').length
  const plan = company?.plan ?? 'trial'
  const modo: 'libre' | 'cobrar' | 'checkout' | 'bloqueado' = (() => {
    if (!company || company.id === 'demo') return 'libre'
    if (plan === 'proceso') {
      if (abiertos < company.paid_processes) return 'libre'
      const viva = ['active', 'trialing', 'past_due'].includes(company.subscription_status ?? '')
      return viva ? 'cobrar' : 'checkout'
    }
    if (plan === 'trial') return activos < 1 ? 'libre' : 'checkout'
    return activos < (PLAN_PROCESS_LIMIT[plan] ?? 0) ? 'libre' : 'bloqueado'
  })()
  const atLimit = modo === 'bloqueado'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  const pick = async (key: string, t?: SectorTemplate) => {
    if (modo === 'cobrar') {
      // El importe se enseña ANTES de cobrar: prorrata hasta la próxima
      // factura, o gratis si queda un ciclo ya pagado que retomar.
      const pv = await previewReabrir(null)
      setCobro({ key, t, amountDue: pv.amountDue, free: pv.free })
      return
    }
    if (modo === 'checkout') {
      // Sin método de pago: el puesto se crea A LA ESPERA (cerrado) y se pasa
      // al pago seguro; el webhook lo abre al completarse.
      const c = await create(key, t, { status: 'cerrada' })
      if (!c) return
      const ok = await reabrirProceso(c.id)
      if (!ok) {
        // El pago no arrancó: el puesto queda guardado a la espera. Se puede
        // seguir editando y activarlo después desde sus ajustes.
        onClose()
        navigate(`${base}/puestos/${c.id}/formulario`)
      }
      return
    }
    const c = await create(key, t)
    if (c) {
      onClose()
      navigate(`${base}/puestos/${c.id}/formulario`)
    }
  }

  const confirmarCobro = async () => {
    if (!cobro) return
    setCobrando(true)
    const pagado = await contratarHueco()
    if (!pagado) {
      setCobrando(false)
      return
    }
    const c = await create(cobro.key, cobro.t)
    setCobrando(false)
    setCobro(null)
    if (c) {
      onClose()
      navigate(`${base}/puestos/${c.id}/formulario`)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }} onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-pop"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            {atLimit ? (
              <div className="relative p-6 text-center">
                <button onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                  <X className="size-5" aria-hidden />
                </button>
                <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  <Lock className="size-6" aria-hidden />
                </div>
                <h2 id="wizard-title" className="mt-4 text-lg font-semibold text-slate-900">
                  Has llegado al límite de tu plan
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">
                  Tu plan {PLAN_LABEL[company?.plan ?? 'esencial']} permite {PLAN_PROCESS_LIMIT[plan] ?? 0}{' '}
                  {(PLAN_PROCESS_LIMIT[plan] ?? 0) === 1 ? 'puesto activo' : 'puestos activos'} a la vez.
                  Pausa o cierra uno para abrir otro.
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <button onClick={onClose} className={BTN_SECONDARY}>
                    Entendido
                  </button>
                  <button
                    onClick={() => { onClose(); navigate(`${base}/plan`) }}
                    className={BTN_PRIMARY}
                  >
                    Ver facturación
                  </button>
                </div>
              </div>
            ) : cobro ? (
              <div className="relative p-6">
                <button onClick={() => setCobro(null)} aria-label="Volver" className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                  <X className="size-5" aria-hidden />
                </button>
                <h2 id="wizard-title" className="text-lg font-semibold text-slate-900">Abrir otro proceso</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {cobro.free
                    ? 'Tienes un hueco de proceso ya pagado en este ciclo: abrir este no te cobra nada ahora.'
                    : cobro.amountDue != null
                      ? <>Se te cobrará ahora <strong className="font-semibold text-slate-900">{(cobro.amountDue / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>, la parte proporcional hasta tu próxima factura.</>
                      : `Este proceso se añade a tu factura: ${PRECIO_PROCESO} € al mes (IVA aparte).`}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  Después son {PRECIO_PROCESO} € al mes (IVA aparte) mientras esté abierto. Ciérralo cuando
                  quieras y deja de cobrarse; tus candidatos siguen siendo tuyos.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button onClick={() => setCobro(null)} className={BTN_SECONDARY} disabled={cobrando}>
                    Volver
                  </button>
                  <button onClick={confirmarCobro} className={`${BTN_PRIMARY} disabled:opacity-60`} disabled={cobrando}>
                    {cobrando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {cobro.free ? 'Abrir proceso' : 'Cobrar y abrir'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 id="wizard-title" className="text-lg font-semibold text-slate-900">Nuevo puesto</h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">Elige un punto de partida. Podrás cambiarlo todo después.</p>
                  </div>
                  <button onClick={onClose} aria-label="Cerrar" className="-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                    <X className="size-5" aria-hidden />
                  </button>
                </div>

                {/* Lo que va a costar se dice ANTES de elegir, no después de crear. */}
                {modo === 'cobrar' && (
                  <p className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[13px] leading-relaxed text-slate-600">
                    Tus procesos pagados están ocupados: este son {PRECIO_PROCESO} € al mes más (IVA aparte).
                    Verás el importe exacto antes de cobrar.
                  </p>
                )}
                {modo === 'checkout' && (
                  <p className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[13px] leading-relaxed text-slate-600">
                    {plan === 'trial'
                      ? `Tu prueba incluye un proceso. Para abrir otro, activa el pago: cada proceso abierto son ${PRECIO_PROCESO} € al mes (IVA aparte), también el de tu prueba. Eliges la plantilla y pasas al pago seguro de Stripe.`
                      : `Abrir este proceso son ${PRECIO_PROCESO} € al mes (IVA aparte). Eliges la plantilla y pasas al pago seguro de Stripe.`}
                  </p>
                )}

                <div className="max-h-[60vh] overflow-y-auto p-4">
                  <TemplateGrid busyKey={busy} onPick={pick} />
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

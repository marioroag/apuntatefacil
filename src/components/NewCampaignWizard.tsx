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
import { PLAN_LABEL, PLAN_PROCESS_LIMIT, PRECIO_PROCESO, modoProceso, type RegionFiscal } from '../lib/pricing'
import { BTN_PRIMARY, BTN_SECONDARY, botonIcono } from '../lib/buttons'
import { IconoVacio } from './ui/IconoVacio'
import { AnuncioEditor, usePasoAnuncio, type ValorAnuncio } from './AnuncioEditor'
import { RegionFiscalRadio } from './RegionFiscal'

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed, HardHat, Truck, Sparkles, ShoppingBag, HeartHandshake,
}

// Crea un puesto desde una plantilla (o desde cero). Lo comparten el modal
// "Crear puesto" y el paso 2 del onboarding: una sola lógica de creación.
// `status: 'cerrada'` lo usa el flujo de pago: el puesto se crea a la espera y
// el webhook de Stripe lo abre al completarse el cobro.
export function useCreateFromTemplate() {
  const { createCampaign } = useStore()
  const { company } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const create = async (
    key: string,
    t?: SectorTemplate,
    opts?: { status?: 'activa' | 'cerrada'; anuncio?: ValorAnuncio },
  ) => {
    if (!company || busy) return null
    setBusy(key)
    const input = t ? templateCampaignInput(t, company.accent) : blankCampaignInput(company.accent)
    const c = await createCampaign({
      ...input,
      status: opts?.status,
      // El anuncio nace con el puesto cuando viene del asistente. La ubicación
      // es columna propia (la lee la cabecera del puesto y el baremo), así que
      // viaja al lado y no dentro del jsonb.
      ...(opts?.anuncio ? { anuncio: opts.anuncio.anuncio, location: opts.anuncio.location, provincia: opts.anuncio.provincia } : {}),
    })
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
            <span className="text-slate-700 group-hover:text-indigo-600">
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />}
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
        <span className="text-slate-700 group-hover:text-indigo-600">
          {busyKey === 'blank' ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <PenLine className="size-5" aria-hidden />}
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
  const [cobro, setCobro] = useState<null | { key: string; t?: SectorTemplate; amountDue: number | null; free: boolean; impuestosIncluidos: boolean }>(null)
  const [cobrando, setCobrando] = useState(false)
  // DOS PASOS: primero de dónde partes (la plantilla) y después qué cuenta el
  // puesto (el anuncio). El orden no es cosmético: la plantilla trae el título y
  // las preguntas, así que hasta elegirla no se sabe de qué puesto es el anuncio
  // que se está escribiendo.
  const [paso, setPaso] = useState<'plantilla' | 'anuncio'>('plantilla')
  const [elegida, setElegida] = useState<{ key: string; t?: SectorTemplate } | null>(null)
  const { valor, cambiar, faltan, formulario, comprobar, reiniciar } = usePasoAnuncio()

  // Qué le espera a este proceso nuevo: la regla vive en `modoProceso`
  // (pricing.ts) porque la pregunta también la hace Duplicar, y las dos puertas
  // tienen que contestar lo mismo.
  const plan = company?.plan ?? 'trial'
  const modo = modoProceso(company, campaigns)
  // Dónde está el cliente, si aún no lo dijo: decide el impuesto de la factura
  // y hace falta para salir a pagar.
  const [regionElegida, setRegionElegida] = useState<RegionFiscal | null>(null)
  const region = company?.region_fiscal ?? regionElegida
  const [faltaRegion, setFaltaRegion] = useState(false)
  const atLimit = modo === 'bloqueado'

  // Cerrar es volver a empezar: si no, salir a medias y entrar otra vez dejaría
  // el anuncio de la plantilla anterior escrito bajo otra plantilla. Se hace al
  // CERRAR y no en un efecto al abrir: mientras está cerrado no se ve nada, así
  // que es el mismo resultado sin una cascada de renders.
  const cerrar = () => {
    setPaso('plantilla')
    setElegida(null)
    setCobro(null)
    reiniciar()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    // Escape sube UN nivel: del anuncio vuelve a las plantillas y solo desde la
    // raíz cierra, igual que las páginas del menú de un puesto.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (cobro) setCobro(null)
      else if (paso === 'anuncio') setPaso('plantilla')
      else cerrar()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
    // `cerrar` se recrea en cada render y no aporta nada a las dependencias:
    // lo que decide qué hace el Escape es el paso en el que estás.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, paso, cobro])

  const pick = (key: string, t?: SectorTemplate) => {
    setElegida({ key, t })
    setPaso('anuncio')
  }

  const crear = async () => {
    if (!elegida || busy || !comprobar()) return
    if (modo === 'checkout' && !region) {
      // Sin región no se puede preparar la factura: el aviso se enciende al
      // intentar seguir (nunca antes) y el foco va a la pregunta.
      setFaltaRegion(true)
      formulario.current?.querySelector<HTMLElement>('[data-region-fiscal] input')?.focus()
      return
    }
    const { key, t } = elegida
    if (modo === 'cobrar') {
      // El importe se enseña ANTES de cobrar: prorrata hasta la próxima
      // factura, o gratis si queda un ciclo ya pagado que retomar.
      const pv = await previewReabrir(null)
      setCobro({ key, t, amountDue: pv.amountDue, free: pv.free, impuestosIncluidos: pv.impuestosIncluidos })
      return
    }
    if (modo === 'checkout') {
      // Sin método de pago: el puesto se crea A LA ESPERA (cerrado) y se pasa
      // al pago seguro; el webhook lo abre al completarse.
      const c = await create(key, t, { status: 'cerrada', anuncio: valor })
      if (!c) return
      const ok = await reabrirProceso(c.id, region)
      if (!ok) {
        // El pago no arrancó: el puesto queda guardado a la espera. Se puede
        // seguir editando y activarlo después desde sus ajustes.
        cerrar()
        navigate(`${base}/puestos/${c.id}/formulario`)
      }
      return
    }
    const c = await create(key, t, { anuncio: valor })
    if (c) {
      cerrar()
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
    const c = await create(cobro.key, cobro.t, { anuncio: valor })
    setCobrando(false)
    setCobro(null)
    if (c) {
      cerrar()
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
            transition={{ duration: 0.18 }} onClick={cerrar}
          />
          {/* `overflow-clip` y no `hidden`: quien llega a las dos esquinas de abajo
              es el bloque con scroll (`max-h-[60vh] overflow-y-auto`), y `clip` lo
              recorta con el radio SIN convertir el panel en contenedor de scroll,
              que es lo que rompería cualquier `sticky` de dentro. */}
          <motion.div
            className="relative w-full max-w-xl overflow-clip rounded-xl bg-white shadow-pop"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            {atLimit ? (
              <div className="relative p-6 text-center">
                {/* Las tres equis de este modal salen de `botonIcono`, no de un
                    `p-1.5` a mano: así se quedaban en 32px y sin crecer en táctil
                    (`md` da 36 y 44 con puntero grueso), y sin el press de la
                    rampa, que es por donde derivan siempre los clones. */}
                <button onClick={cerrar} aria-label="Cerrar" className={botonIcono('ghost', 'md', 'absolute right-3 top-3')}>
                  <X className="size-5" aria-hidden />
                </button>
                <IconoVacio Icon={Lock} />
                <h2 id="wizard-title" className="mt-4 text-lg font-semibold text-slate-900">
                  Has llegado al límite de tu plan
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">
                  Tu plan {PLAN_LABEL[company?.plan ?? 'esencial']} permite {PLAN_PROCESS_LIMIT[plan] ?? 0}{' '}
                  {(PLAN_PROCESS_LIMIT[plan] ?? 0) === 1 ? 'puesto activo' : 'puestos activos'} a la vez.
                  Pausa o cierra uno para abrir otro.
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <button onClick={cerrar} className={BTN_SECONDARY}>
                    Entendido
                  </button>
                  <button
                    onClick={() => { cerrar(); navigate(`${base}/plan`) }}
                    className={BTN_PRIMARY}
                  >
                    Ver facturación
                  </button>
                </div>
              </div>
            ) : cobro ? (
              <div className="relative p-6">
                <button onClick={() => setCobro(null)} aria-label="Volver" className={botonIcono('ghost', 'md', 'absolute right-3 top-3')}>
                  <X className="size-5" aria-hidden />
                </button>
                <h2 id="wizard-title" className="text-lg font-semibold text-slate-900">Abrir otro proceso</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {cobro.free
                    ? 'Tienes un hueco de proceso ya pagado en este ciclo: abrir este no te cobra nada ahora.'
                    : cobro.amountDue != null
                      ? <>Se te cobrará ahora <strong className="font-semibold text-slate-900">{(cobro.amountDue / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>{cobro.impuestosIncluidos ? ' (IVA incluido)' : ' más IVA'}, la parte proporcional hasta tu próxima factura.</>
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
                    <h2 id="wizard-title" className="text-lg font-semibold text-slate-900">
                      {paso === 'plantilla' ? 'Crear puesto' : 'Tu anuncio'}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {paso === 'plantilla'
                        ? 'Elige un punto de partida. Podrás cambiarlo todo después.'
                        : 'Lo que se lee antes del formulario. Podrás cambiarlo todo después, el título incluido.'}
                    </p>
                  </div>
                  <button onClick={cerrar} aria-label="Cerrar" className={botonIcono('ghost', 'md', '-mr-1')}>
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
                      ? `Tu prueba incluye un proceso. Para abrir otro, activa el pago: cada proceso abierto son ${PRECIO_PROCESO} € al mes (impuestos aparte), también el de tu prueba. Eliges la plantilla y pasas al pago seguro de Stripe.`
                      : `Abrir este proceso son ${PRECIO_PROCESO} € al mes (impuestos aparte). Eliges la plantilla y pasas al pago seguro de Stripe.`}
                  </p>
                )}

                {paso === 'plantilla' ? (
                  <div className="max-h-[60vh] overflow-y-auto p-4">
                    <TemplateGrid busyKey={busy} onPick={pick} />
                  </div>
                ) : (
                  <>
                    <div ref={formulario} className="max-h-[60vh] overflow-y-auto px-5 py-4">
                      {/* Si este puesto acaba en la página de pago, hay que saber
                          dónde está el cliente ANTES de salir: decide el impuesto
                          de su primera factura. Va ARRIBA, pegado a la nota que
                          dice que se pasa al pago, y no debajo del anuncio, donde
                          se probó y quedaba fuera de la vista: el botón se apagaba
                          sin que se viera por qué. Una vez, y solo si no lo ha dicho. */}
                      {modo === 'checkout' && !company?.region_fiscal && (
                        <div className="mb-5 rounded-xl bg-slate-50 px-4 pb-4 pt-1">
                          <RegionFiscalRadio value={region} onChange={(r) => { setRegionElegida(r); setFaltaRegion(false) }} falta={faltaRegion} />
                        </div>
                      )}
                      <AnuncioEditor valor={valor} onChange={cambiar} faltan={faltan} />
                    </div>
                    {/* El pie es donde vive el flujo: volver a las plantillas o
                        crear. Sin flecha de vuelta arriba, que sería la misma
                        puerta dos veces; la equis de la cabecera sigue siendo
                        cerrar, que es otra cosa. */}
                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
                      <button onClick={() => setPaso('plantilla')} className={BTN_SECONDARY} disabled={!!busy}>
                        Volver
                      </button>
                      <button onClick={() => void crear()} className={`${BTN_PRIMARY} disabled:opacity-60`} disabled={!!busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                        Crear puesto
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

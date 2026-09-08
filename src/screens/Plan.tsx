import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Loader2, Receipt } from 'lucide-react'
import {
  PLAN_LABEL, PRECIO_PROCESO, PRUEBA_DIAS, diasDePruebaRestantes, hayPagoActivo, impuestoTexto, pendienteDePago, procesoAbierto,
  type RegionFiscal,
} from '../lib/pricing'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PageHeader } from '../components/ui/PageHeader'
import { pollPlanAndReload } from '../lib/planSync'
import { motivo } from '../lib/motivo'
import { RegionFiscalRadio } from '../components/RegionFiscal'

// Facturación del PAGO POR PROCESO (ago 2026). Sustituye al catálogo de tres
// planes: aquí ya no se elige nada, se ve lo que hay abierto y lo que cuesta.
//  - En prueba: cómo va (días y candidaturas) y el botón de activar el pago.
//  - Pagando: los procesos abiertos, el total al mes y el portal de Stripe
//    (método de pago, facturas). Dejar de pagar = cerrar procesos, cada uno
//    desde su pantalla: aquí no hay "cancelar suscripción" porque no hace falta.
//  - Tiers antiguos (Esencial/Pro/Multi): se conservan cancelar/reanudar,
//    PERO solo si detrás hay una suscripción viva. Un plan antiguo puesto a
//    mano (sin cliente ni suscripción en Stripe) no tiene nada que gestionar
//    ni que cancelar: ahí lo único que cabe es el alta del pago por proceso.

/**
 * El alta del pago. Se declara una sola vez porque la piden DOS sitios: la
 * prueba y un plan antiguo que se quedó sin suscripción detrás. Escrito dos
 * veces, el día que se afine el botón o su letra pequeña se afinaría uno.
 */
function ActivarPago({ onClick, cargando, bloqueadas, abiertos, pendientes, region, onRegion, preguntarRegion }: {
  onClick: () => void
  cargando: boolean
  bloqueadas: number
  /** Dónde está el cliente: decide el impuesto. Se pregunta solo si no lo ha dicho. */
  region: RegionFiscal | null
  onRegion: (r: RegionFiscal) => void
  preguntarRegion: boolean
  /** Procesos que se van a cobrar al activar el pago (los no cerrados). */
  abiertos: number
  /** Puestos creados a la espera del pago: se abren al completarlo. */
  pendientes: number
}) {
  const total = abiertos + pendientes
  return (
    <>
      {/* El total ANTES de salir a Stripe. Su página lo enseña también, pero la
          sorpresa hay que resolverla aquí, sobre todo en una cuenta con varios
          puestos abiertos: "por cada proceso" no dice cuántos son. */}
      {total > 0 && (
        <p className="mt-4 text-sm text-slate-900">
          {abiertos === 1 ? 'Tienes 1 proceso abierto' : `Tienes ${abiertos} procesos abiertos`}
          {pendientes > 0 ? (pendientes === 1 ? ' y 1 a la espera del pago' : ` y ${pendientes} a la espera del pago`) : ''}
          {': '}
          <span className="num font-semibold">{total} × {PRECIO_PROCESO} € = {total * PRECIO_PROCESO} €</span> al mes, {impuestoTexto(region)}.
        </p>
      )}
      {preguntarRegion && <RegionFiscalRadio value={region} onChange={onRegion} />}
      <button onClick={onClick} disabled={cargando || (preguntarRegion && !region)} className={`${BTN_PRIMARY} mt-4 w-full justify-center sm:w-auto disabled:opacity-60`}>
        {cargando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
        Añadir método de pago
      </button>
      <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
        Con el pago seguro de Stripe, que te pedirá el NIF y la dirección para la factura. Pagas {PRECIO_PROCESO} € al mes
        por cada proceso que tengas abierto ({impuestoTexto(region)}), y cerrar uno deja de cobrarlo
        {bloqueadas > 0 ? '. Tus candidaturas en espera se desbloquean al momento' : ''}.
      </p>
    </>
  )
}

export function Plan() {
  const { company, refreshCompany, role, companyLoading } = useAuth()
  const { campaigns, lockedInfo } = useStore()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [dialogBusy, setDialogBusy] = useState(false)
  // La región la dice el cliente una vez; después manda lo guardado en la empresa.
  const [regionElegida, setRegionElegida] = useState<RegionFiscal | null>(null)
  const region = company?.region_fiscal ?? regionElegida

  const plan = company?.plan ?? 'trial'
  const abiertos = campaigns.filter(procesoAbierto)
  const pendientes = campaigns.filter(pendienteDePago).length
  const totalMes = abiertos.length * PRECIO_PROCESO
  // Un hueco pagado y sin estrenar: se paga un proceso más de los que se ven.
  // Pasa si se cobra un hueco y la creación del puesto falla justo después; no
  // se pierde (el siguiente puesto entra sin cobrar), pero hay que decirlo.
  const huecosSinUsar = Math.max(0, (company?.paid_processes ?? 0) - abiertos.length)

  useEffect(() => {
    const c = params.get('checkout')
    if (!c) return
    // Quitamos el parámetro ANTES de recargar (evita un bucle al volver a montar).
    params.delete('checkout')
    setParams(params, { replace: true })
    if (c === 'ok') {
      toast.success('Pago activado. Aplicándolo a tu cuenta...')
      void pollPlanAndReload(refreshCompany, (co) => !!co && co.plan === 'proceso' && co.paid_processes > 0).then((ok) => {
        if (!ok) toast.show('El pago puede tardar unos segundos en reflejarse. Recarga si no lo ves.')
      })
    } else if (c === 'cancel') {
      toast.show('Pago cancelado, no se ha cobrado nada.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Solo el propietario gestiona la facturación; miembros y encargados no entran aquí.
  if (companyLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
      </div>
    )
  }
  if (role !== 'owner') return <Navigate to="/app" replace />

  // Alta del pago (desde la prueba, o tras quedarse sin suscripción).
  const activarPago = async () => {
    setBusy('checkout')
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { checkout: true, returnUrl: `${window.location.origin}/app/plan`, companyId: company?.id, regionFiscal: region ?? undefined },
    })
    setBusy(null)
    if (!error && data?.url) {
      window.location.href = data.url as string
      return
    }
    if (!error && data?.changed) {
      // Ya había una suscripción viva (carrera con el webhook): se adoptó.
      toast.success('Pago activado. Aplicándolo a tu cuenta...')
      void pollPlanAndReload(refreshCompany, (co) => !!co && co.plan === 'proceso' && co.paid_processes > 0)
      return
    }
    toast.error(await motivo(error) ?? 'No se pudo abrir el pago. Inténtalo de nuevo.')
  }

  // Portal de Stripe: método de pago, facturas y datos fiscales.
  const abrirPortal = async () => {
    setBusy('portal')
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { portal: true, returnUrl: window.location.href, companyId: company?.id },
    })
    setBusy(null)
    if (!error && data?.url) {
      window.location.href = data.url as string
      return
    }
    toast.error(await motivo(error) ?? 'No se pudo abrir el portal de facturación. Inténtalo de nuevo.')
  }

  // Legacy: cancelar/reanudar la suscripción de un tier retirado.
  const cancelarLegacy = async () => {
    setDialogBusy(true)
    const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { cancel: true, companyId: company?.id } })
    setDialogBusy(false)
    if (error || !data?.canceled) {
      toast.error(await motivo(error) ?? 'No se pudo cancelar. Inténtalo de nuevo.')
      return
    }
    setConfirmCancel(false)
    toast.success('Suscripción cancelada. Mantienes el acceso hasta el final del periodo.')
    void refreshCompany()
  }
  const reanudarLegacy = async () => {
    setBusy('resume')
    const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { resume: true, companyId: company?.id } })
    setBusy(null)
    if (error || !data?.resumed) {
      toast.error(await motivo(error) ?? 'No se pudo reanudar. Inténtalo de nuevo.')
      return
    }
    toast.success('Suscripción reanudada.')
    void refreshCompany()
  }

  const dias = diasDePruebaRestantes(company?.trial_ends_at)
  const bloqueadas = Object.values(lockedInfo).reduce((n, i) => n + i.count, 0)
  const pastDue = company?.subscription_status === 'past_due'
  // Lo que decide qué se puede hacer aquí es si Stripe está cobrando, no cómo
  // se llame el plan: los dos se separan en cuanto un plan se pone a mano.
  const conPago = hayPagoActivo(company)
  const esLegacy = plan === 'esencial' || plan === 'pro' || plan === 'multi'

  // Se iguala la ESCALA DE RELLENO con las demás pantallas del shell (`py-6
  // sm:px-6 lg:px-8`): estaba en `py-8 sm:px-8` y era la única con otro reparto,
  // así que en ventanas estrechas los bordes no caían donde en el resto.
  // El ANCHO es `max-w-lectura` (820) y no el de trabajo (1240) a propósito:
  // Facturación es una columna que se lee de arriba abajo, con un total y una
  // lista corta, y a 1240 las líneas se irían a 150 caracteres. Los dos anchos y
  // su porqué viven en `@theme` (index.css).
  return (
    <div className="mx-auto max-w-lectura px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      <Link to="/app" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Volver al panel
      </Link>
      <PageHeader
        titulo="Facturación"
        sub={`${PRECIO_PROCESO} € al mes + IVA por proceso abierto. Sin permanencia: cierras un proceso y deja de cobrarse.`}
      />

      {/* ---- En prueba -------------------------------------------------- */}
      {plan === 'trial' && (
        <div className="mt-6 rounded-xl filo bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Tu prueba</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tu primer proceso es gratis durante {PRUEBA_DIAS} días, con todas las candidaturas que lleguen
            {company?.trial_ends_at ? '.' : <>: el reloj arranca al abrir tu primer puesto.</>}
          </p>
          {company?.trial_ends_at && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3.5">
                <dt className="text-[13px] text-slate-500">Días de prueba</dt>
                <dd className="num mt-0.5 font-semibold text-slate-900">
                  {dias === 0 ? 'Agotados' : `Quedan ${dias}`}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5">
                <dt className="text-[13px] text-slate-500">Procesos abiertos</dt>
                <dd className="num mt-0.5 font-semibold text-slate-900">
                  {abiertos.length} de 1
                </dd>
              </div>
            </dl>
          )}
          {bloqueadas > 0 && (
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
              {bloqueadas === 1 ? 'Hay 1 candidatura esperando' : `Hay ${bloqueadas} candidaturas esperando`}:
              se siguen recibiendo y las verás todas al activar el pago.
            </p>
          )}
          <ActivarPago onClick={activarPago} cargando={!!busy} bloqueadas={bloqueadas} abiertos={abiertos.length} pendientes={pendientes} region={region} onRegion={setRegionElegida} preguntarRegion={!company?.region_fiscal} />
        </div>
      )}

      {/* ---- Pagando por proceso ---------------------------------------- */}
      {plan === 'proceso' && (
        <div className="mt-6 rounded-xl filo bg-white p-6 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Procesos abiertos</h2>
            <p className="text-sm text-slate-600">
              <span className="num font-semibold text-slate-900">{abiertos.length}</span>
              {' '}× {PRECIO_PROCESO} € = <span className="num font-semibold text-slate-900">{totalMes} €</span>/mes, {impuestoTexto(company?.region_fiscal)}
            </p>
          </div>

          {pastDue && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3.5 text-[13px] leading-relaxed text-amber-800">
              No pudimos cobrar tu última factura. Lo reintentamos automáticamente los próximos días;
              revisa tu método de pago para no perder el acceso.
            </p>
          )}
          {!conPago && (
            <>
              {/* Sin suscripción viva (cancelada, o agotada por impago): la puerta
                  de vuelta es el alta, aquí mismo, con el total delante. Antes solo
                  había una nota que mandaba a reabrir un puesto, y con puestos
                  abiertos y sin pago la pantalla se contradecía a sí misma. */}
              <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-600">
                No tienes ningún pago activo. Tus puestos cerrados se conservan enteros y exportables.
              </p>
              <ActivarPago onClick={activarPago} cargando={!!busy} bloqueadas={bloqueadas} abiertos={abiertos.length} pendientes={pendientes} region={region} onRegion={setRegionElegida} preguntarRegion={!company?.region_fiscal} />
            </>
          )}

          {abiertos.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl filo">
              {abiertos.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <Link to={`/app/puestos/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:text-indigo-600">
                    {c.title}
                  </Link>
                  {c.status === 'pausada' && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                      Pausado
                    </span>
                  )}
                  <span className="num shrink-0 text-slate-500">{PRECIO_PROCESO} €/mes</span>
                </li>
              ))}
            </ul>
          ) : conPago ? (
            <p className="mt-4 text-sm text-slate-600">
              No tienes procesos abiertos: no se te cobrará más. Tus puestos cerrados siguen enteros y exportables.
            </p>
          ) : null}

          {conPago && huecosSinUsar > 0 && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-600">
              {huecosSinUsar === 1
                ? 'Tienes 1 proceso pagado sin usar: el próximo puesto que abras no te cobra nada.'
                : `Tienes ${huecosSinUsar} procesos pagados sin usar: los próximos puestos que abras no te cobran nada.`}
            </p>
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
            Un proceso pausado sigue abierto (no acepta candidaturas nuevas, pero se cobra). Para dejar de
            pagar uno, ciérralo desde su pantalla: un clic, y conservas todos sus candidatos.
          </p>

          <button onClick={abrirPortal} disabled={!!busy} className={`${BTN_SECONDARY} mt-5 disabled:opacity-60`}>
            {busy === 'portal' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Receipt className="size-4 text-slate-400" aria-hidden />}
            Gestionar pago y facturas
          </button>
        </div>
      )}

      {/* ---- Tiers antiguos --------------------------------------------- */}
      {esLegacy && (
        <div className="mt-6 rounded-xl filo bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Plan {PLAN_LABEL[plan]}</h2>
          {!conPago ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Estás en un plan anterior, que ya no se ofrece, y ahora mismo no tiene ningún pago detrás:
                no hay facturas que ver ni suscripción que cancelar. Para seguir con tus procesos abiertos,
                añade un método de pago y pasarás al pago por proceso.
              </p>
              <ActivarPago onClick={activarPago} cargando={!!busy} bloqueadas={bloqueadas} abiertos={abiertos.length} pendientes={pendientes} region={region} onRegion={setRegionElegida} preguntarRegion={!company?.region_fiscal} />
            </>
          ) : (
            <>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Estás en un plan anterior, que ya no se ofrece. Lo conservas tal cual mientras quieras;
                si lo cancelas, pasarás al pago por proceso ({PRECIO_PROCESO} € al mes + IVA por proceso abierto).
              </p>
              {company?.cancel_at_period_end ? (
                <>
                  <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-[13px] text-slate-600">
                    Tu plan se cancelará al final del periodo ya pagado.
                  </p>
                  <button onClick={reanudarLegacy} disabled={!!busy} className={`${BTN_SECONDARY} mt-4 disabled:opacity-60`}>
                    {busy === 'resume' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Reanudar suscripción
                  </button>
                </>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button onClick={abrirPortal} disabled={!!busy} className={`${BTN_SECONDARY} disabled:opacity-60`}>
                    {busy === 'portal' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Receipt className="size-4 text-slate-400" aria-hidden />}
                    Gestionar pago y facturas
                  </button>
                  <button onClick={() => setConfirmCancel(true)} disabled={!!busy} className="text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-60">
                    Cancelar suscripción
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-[13px] text-slate-500">
        El pago se gestiona con Stripe. Tus datos son tuyos: puedes exportarlos a Excel cuando quieras.
      </p>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancelarLegacy}
        title="Cancelar suscripción"
        confirmLabel="Sí, cancelar"
        cancelLabel="No, seguir"
        confirmVariant="danger"
        loading={dialogBusy}
      >
        <p>
          Mantienes tu plan hasta el final del periodo ya pagado. Después no se te cobra más y tus puestos
          abiertos se cierran: conservas todos los candidatos y puedes exportarlos, o reabrir un proceso
          pagando {PRECIO_PROCESO} € al mes + IVA.
        </p>
      </ConfirmDialog>
    </div>
  )
}

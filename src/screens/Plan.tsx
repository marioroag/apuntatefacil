import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { TIERS, PLAN_LABEL } from '../lib/pricing'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { pollPlanAndReload } from '../lib/planSync'

const PLAN_RANK: Record<string, number> = { trial: 0, esencial: 1, pro: 2, multi: 3 }
const eur = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

type Dialog =
  | { type: 'change'; planId: string; tierName: string; price: number; annual: boolean; amountDue: number; total: number }
  | { type: 'cancel' }

export function Plan() {
  const { company, refreshCompany, role, companyLoading } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [annual, setAnnual] = useState(false)

  const current = company?.plan ?? 'trial'
  const subscribed = current !== 'trial'
  const currentInterval = company?.billing_interval ?? null // 'month' | 'year' | null
  const selectedInterval = annual ? 'year' : 'month'
  const pendingCancel = subscribed && !!company?.cancel_at_period_end

  useEffect(() => {
    const c = params.get('checkout')
    if (!c) return
    // Quitamos el parámetro ANTES de recargar (evita un bucle al volver a montar).
    params.delete('checkout')
    setParams(params, { replace: true })
    if (c === 'ok') {
      toast.success('Suscripción activada. Aplicando tu plan...')
      void pollPlanAndReload(refreshCompany, (c) => !!c && c.plan !== 'trial').then((ok) => {
        if (!ok) toast.show('El plan puede tardar unos segundos en reflejarse. Recarga si no lo ves.')
      })
    } else if (c === 'cancel') {
      toast.show('Pago cancelado, no se ha cobrado nada.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Solo el propietario gestiona el plan; miembros y encargados no entran aquí.
  if (companyLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
      </div>
    )
  }
  if (role !== 'owner') return <Navigate to="/app" replace />

  // Alta nueva o cobro de cambio ya confirmado: llama a la función y actúa según la respuesta.
  const runCheckout = async (planId: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { plan: planId, returnUrl: `${window.location.origin}/app/plan`, annual },
    })
    if (error) {
      toast.error('No se pudo completar. Inténtalo de nuevo.')
      return false
    }
    if (data?.url) {
      window.location.href = data.url as string
      return true
    }
    if (data?.changed) {
      toast.success('Plan actualizado. Aplicando los cambios...')
      // El plan/periodo real lo confirma el webhook de Stripe (no es instantáneo):
      // sondeamos hasta que la empresa refleje plan Y periodo y recargamos. Esperar
      // también al periodo evita recargar con el periodo viejo en un cambio de solo periodo.
      void pollPlanAndReload(
        refreshCompany,
        (c) => c?.plan === planId && c?.billing_interval === selectedInterval,
      ).then((ok) => {
        if (!ok) toast.show('El cambio puede tardar unos segundos en reflejarse. Recarga si no lo ves.')
      })
      return true
    }
    toast.error('No se pudo completar. Inténtalo de nuevo.')
    return false
  }

  const onPlanClick = async (planId: string) => {
    // En Prueba: alta nueva -> la confirmación es la propia pantalla de pago de Stripe.
    if (!subscribed) {
      setBusy(planId)
      await runCheckout(planId)
      setBusy(null)
      return
    }
    // Ya suscrito: previsualizamos el importe exacto y abrimos el modal.
    const tier = TIERS.find((t) => t.id === planId)
    if (!tier) return
    setBusy(planId)
    const { data: pv, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { plan: planId, preview: true, annual },
    })
    setBusy(null)
    if (error) {
      toast.error('No se pudo calcular el importe. Inténtalo de nuevo.')
      return
    }
    if (pv?.notSubscribed) {
      // La suscripción anterior ya no es válida (p.ej. datos de prueba tras pasar a real).
      await refreshCompany()
      setBusy(planId)
      await runCheckout(planId)
      setBusy(null)
      return
    }
    setDialog({
      type: 'change',
      planId,
      tierName: tier.name,
      price: annual ? tier.annual : tier.monthly,
      annual,
      amountDue: typeof pv?.amountDue === 'number' ? pv.amountDue : 0,
      total: typeof pv?.total === 'number' ? pv.total : 0,
    })
  }

  const confirmDialog = async () => {
    if (!dialog) return
    setDialogBusy(true)
    if (dialog.type === 'change') {
      const ok = await runCheckout(dialog.planId)
      setDialogBusy(false)
      if (ok) setDialog(null)
    } else {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { cancel: true } })
      setDialogBusy(false)
      if (error || !data?.canceled) {
        toast.error('No se pudo cancelar. Inténtalo de nuevo.')
        return
      }
      toast.success('Suscripción cancelada. Mantienes el acceso hasta el final del periodo.')
      setDialog(null)
      // Mantenemos los botones bloqueados durante el sondeo para que no se pueda
      // disparar un cambio de plan que pise la cancelación aún en vuelo.
      setBusy('__cancel__')
      const ok = await pollCancelState(true)
      setBusy(null)
      if (!ok) toast.show('El cambio puede tardar unos segundos en reflejarse. Recarga si no lo ves.')
    }
  }

  // Tras cancelar/reanudar, el flag real lo fija el webhook de Stripe (no es
  // instantáneo): sondeamos la empresa hasta que el panel refleje el botón correcto.
  // Devuelve true si convergió a tiempo, false si agotó los intentos.
  const pollCancelState = async (expected: boolean): Promise<boolean> => {
    for (let i = 0; i < 12; i++) {
      const c = await refreshCompany()
      if (!!c?.cancel_at_period_end === expected) return true
      await new Promise((r) => setTimeout(r, 1000))
    }
    return false
  }

  const resumeSubscription = async () => {
    setBusy('__resume__')
    const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { resume: true } })
    if (error || !data?.resumed) {
      setBusy(null)
      toast.error('No se pudo reanudar. Inténtalo de nuevo.')
      return
    }
    toast.success('Suscripción reanudada. Seguirás con tu plan.')
    if (!(await pollCancelState(false))) {
      toast.show('El cambio puede tardar unos segundos en reflejarse. Recarga si no lo ves.')
    }
    setBusy(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <Link to="/app" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Volver al panel
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tu plan</h1>
      <p className="mt-1.5 text-slate-600">
        Estás en el plan <strong className="font-semibold text-slate-900">{PLAN_LABEL[current] ?? 'Prueba'}</strong>. Candidatos y usuarios ilimitados en todos. Precios sin IVA.
      </p>

      <div className="mt-6 flex justify-center sm:justify-start">
        {/* El periodo se bloquea mientras hay un cambio en curso o el modal abierto:
            así lo que se cobra coincide siempre con lo que muestra la confirmación. */}
        <div role="group" aria-label="Periodicidad de facturación" className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
          <button type="button" disabled={!!dialog || !!busy} onClick={() => setAnnual(false)} aria-pressed={!annual} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${!annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            Mensual
          </button>
          <button type="button" disabled={!!dialog || !!busy} onClick={() => setAnnual(true)} aria-pressed={annual} className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            Anual
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${annual ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>2 meses gratis</span>
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        {TIERS.map((t) => {
          const samePlan = current === t.id
          // Mismo plan + mismo periodo = el plan actual. Mismo plan + otro periodo =
          // se puede cambiar solo el periodo. Si aún no sabemos el periodo (suscripción
          // previa a esta función), tratamos el plan como actual para no ofrecer un
          // cambio a ciegas hasta que el webhook lo registre.
          const isCurrent = samePlan && (currentInterval == null || currentInterval === selectedInterval)
          const switchInterval = samePlan && !isCurrent
          const isDowngrade = PLAN_RANK[current] > PLAN_RANK[t.id]
          return (
            <div
              key={t.id}
              className={`relative flex flex-col rounded-2xl bg-white p-6 ${t.recommended ? 'border-2 border-indigo-600 shadow-card' : 'border border-slate-200'}`}
            >
              {t.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white">
                  Recomendado
                </span>
              )}
              <h2 className="text-lg font-semibold text-slate-900">{t.name}</h2>
              <p className="mt-1 text-[14px] text-slate-500">{t.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{annual ? t.annual : t.monthly} €</span>
                <span className="text-sm text-slate-500">{annual ? 'al año' : 'al mes'}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onPlanClick(t.id)}
                disabled={isCurrent || !!busy}
                className={`mt-6 ${t.recommended ? BTN_PRIMARY : BTN_SECONDARY} w-full disabled:opacity-60`}
              >
                {busy === t.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {isCurrent
                  ? 'Tu plan actual'
                  : switchInterval
                    ? annual ? 'Pasar a anual' : 'Pasar a mensual'
                    : isDowngrade ? `Cambiar a ${t.name}` : `Mejorar a ${t.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {subscribed && (pendingCancel ? (
          <button
            onClick={resumeSubscription}
            disabled={!!busy}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
          >
            {busy === '__resume__' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Reanudar suscripción
          </button>
        ) : (
          <button
            onClick={() => setDialog({ type: 'cancel' })}
            disabled={!!busy}
            className="text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-60"
          >
            Cancelar suscripción
          </button>
        ))}
        <p className="text-center text-[13px] text-slate-500">
          {pendingCancel
            ? 'Tu plan se cancelará al final del periodo ya pagado. Reanúdalo cuando quieras para seguir.'
            : subscribed
              ? 'El pago se gestiona con Stripe. Al cambiar de plan, el cobro se ajusta de forma proporcional.'
              : 'El pago se gestiona con Stripe. Puedes cancelar cuando quieras y exportar tus datos siempre.'}
        </p>
      </div>

      {/* Modal de confirmación de cambio de plan */}
      <ConfirmDialog
        open={dialog?.type === 'change'}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
        title={dialog?.type === 'change' ? `Cambiar al plan ${dialog.tierName}` : ''}
        confirmLabel="Confirmar cambio"
        loading={dialogBusy}
      >
        {dialog?.type === 'change' && (
          <>
            <p>
              Tu plan pasará a <strong className="font-semibold text-slate-900">{dialog.tierName}</strong>, {dialog.price} € {dialog.annual ? 'al año' : 'al mes'}.
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-slate-700">
              {dialog.amountDue > 0 ? (
                <p>
                  Se te cobrará ahora <strong className="font-semibold text-slate-900">{eur(dialog.amountDue)}</strong> a tu tarjeta guardada: la parte proporcional de lo que queda de tu periodo actual.
                </p>
              ) : dialog.total < 0 ? (
                <p>
                  No se te cobra nada ahora. Generas <strong className="font-semibold text-slate-900">{eur(-dialog.total)}</strong> de saldo a favor, que se descuenta de tus próximas facturas.
                </p>
              ) : (
                <p>No se te cobra nada ahora.</p>
              )}
            </div>
            {pendingCancel && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">
                Tenías programada la cancelación al final del periodo. Al cambiar de plan, tu suscripción se reactiva y seguirá renovándose.
              </p>
            )}
            <p className="mt-3 text-[13px] text-slate-500">Después seguirás pagando {dialog.price} € {dialog.annual ? 'al año' : 'al mes'} (IVA aparte). Puedes cancelar cuando quieras.</p>
          </>
        )}
      </ConfirmDialog>

      {/* Modal de confirmación de cancelación */}
      <ConfirmDialog
        open={dialog?.type === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
        title="Cancelar suscripción"
        confirmLabel="Sí, cancelar"
        cancelLabel="No, seguir"
        confirmVariant="danger"
        loading={dialogBusy}
      >
        <p>
          Mantienes tu plan actual hasta el final del periodo ya pagado y, a partir de ahí, pasas al plan de <strong className="font-semibold text-slate-900">Prueba</strong>. No se te cobrará nada más.
        </p>
        <p className="mt-2 text-[13px] text-slate-500">Tus datos siguen siendo tuyos: puedes exportarlos a Excel cuando quieras.</p>
      </ConfirmDialog>
    </div>
  )
}

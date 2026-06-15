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
  | { type: 'change'; planId: string; tierName: string; monthly: number; amountDue: number; total: number }
  | { type: 'cancel' }

export function Plan() {
  const { company, refreshCompany, role, companyLoading } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)

  const current = company?.plan ?? 'trial'
  const subscribed = current !== 'trial'

  useEffect(() => {
    const c = params.get('checkout')
    if (!c) return
    // Quitamos el parámetro ANTES de recargar (evita un bucle al volver a montar).
    params.delete('checkout')
    setParams(params, { replace: true })
    if (c === 'ok') {
      toast.success('Suscripción activada. Aplicando tu plan...')
      void pollPlanAndReload(refreshCompany, (plan) => !!plan && plan !== 'trial').then((ok) => {
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
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  }
  if (role !== 'owner') return <Navigate to="/app" replace />

  // Alta nueva o cobro de cambio ya confirmado: llama a la función y actúa según la respuesta.
  const runCheckout = async (planId: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { plan: planId, returnUrl: `${window.location.origin}/app/plan` },
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
      // El plan real lo confirma el webhook de Stripe (no es instantáneo): sondeamos
      // hasta que la empresa lo refleje y recargamos para que todo el panel se actualice.
      void pollPlanAndReload(refreshCompany, (plan) => plan === planId).then((ok) => {
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
      body: { plan: planId, preview: true },
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
      monthly: tier.monthly,
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
      refreshCompany()
      setDialog(null)
    }
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

      <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-3">
        {TIERS.map((t) => {
          const isCurrent = current === t.id
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
                <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{t.monthly} €</span>
                <span className="text-sm text-slate-500">al mes</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onPlanClick(t.id)}
                disabled={isCurrent || !!busy}
                className={`mt-6 ${t.recommended ? BTN_PRIMARY : BTN_SECONDARY} w-full disabled:opacity-60`}
              >
                {busy === t.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {isCurrent ? 'Tu plan actual' : isDowngrade ? `Cambiar a ${t.name}` : `Mejorar a ${t.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {subscribed && (
          <button
            onClick={() => setDialog({ type: 'cancel' })}
            disabled={!!busy}
            className="text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-60"
          >
            Cancelar suscripción
          </button>
        )}
        <p className="text-center text-[13px] text-slate-400">
          El pago se gestiona con Stripe. {subscribed
            ? 'Al cambiar de plan, el cobro se ajusta de forma proporcional.'
            : 'Puedes cancelar cuando quieras y exportar tus datos siempre.'}
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
              Tu plan pasará a <strong className="font-semibold text-slate-900">{dialog.tierName}</strong>, {dialog.monthly} € al mes.
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-slate-700">
              {dialog.amountDue > 0 ? (
                <p>
                  Se te cobrará ahora <strong className="font-semibold text-slate-900">{eur(dialog.amountDue)}</strong> a tu tarjeta guardada: la parte proporcional de lo que queda de mes.
                </p>
              ) : dialog.total < 0 ? (
                <p>
                  No se te cobra nada ahora. Generas <strong className="font-semibold text-slate-900">{eur(-dialog.total)}</strong> de saldo a favor, que se descuenta de tus próximas facturas.
                </p>
              ) : (
                <p>No se te cobra nada ahora.</p>
              )}
            </div>
            <p className="mt-3 text-[13px] text-slate-400">Después seguirás pagando {dialog.monthly} € al mes (IVA aparte). Puedes cancelar cuando quieras.</p>
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
        <p className="mt-2 text-[13px] text-slate-400">Tus datos siguen siendo tuyos: puedes exportarlos a Excel cuando quieras.</p>
      </ConfirmDialog>
    </div>
  )
}

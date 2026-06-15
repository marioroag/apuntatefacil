import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { TIERS } from '../lib/pricing'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'
import { pollPlanAndReload } from '../lib/planSync'
import { BTN_PRIMARY } from '../lib/buttons'

// Muro de pago: una cuenta en plan "Prueba" no accede al panel hasta contratar un plan.
export function Paywall() {
  const { user, signOut, refreshCompany, role, companyLoading, company } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const c = params.get('checkout')
    if (!c) return
    // Quitamos el parámetro ANTES de recargar (evita un bucle al volver a montar).
    params.delete('checkout')
    setParams(params, { replace: true })
    if (c === 'ok') {
      toast.success('Pago recibido. Activando tu cuenta...')
      // El plan lo activa el webhook de Stripe (no es instantáneo): sondeamos hasta
      // que la empresa salga de "trial" y recargamos para entrar ya en el panel.
      void pollPlanAndReload(refreshCompany, (plan) => !!plan && plan !== 'trial').then((ok) => {
        if (!ok) toast.show('La activación puede tardar unos segundos. Recarga si no entras al panel.')
      })
    } else if (c === 'cancel') {
      toast.show('Pago cancelado. Elige un plan para empezar.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = async (planId: string) => {
    setBusy(planId)
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { plan: planId, returnUrl: `${window.location.origin}/app` },
    })
    setBusy(null)
    if (error || !data?.url) {
      toast.error('No se pudo iniciar el pago. Inténtalo de nuevo.')
      return
    }
    window.location.href = data.url as string
  }

  // El plan/facturación es del propietario. Un miembro o encargado de una empresa
  // todavía sin plan no debe poder pagar: ve un mensaje, no las tarjetas de compra.
  if (companyLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  }
  if (role !== 'owner') {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-[420px] text-center">
          <div className="flex items-center justify-center gap-2.5">
            <Logo className="size-9" />
            <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND}</span>
          </div>
          <h1 className="mt-6 text-xl font-semibold text-slate-900">Tu equipo aún no tiene un plan activo</h1>
          <p className="mt-2 text-slate-600">
            Pídele al propietario de {company?.name ?? 'tu empresa'} que active un plan para que podáis empezar a usar el panel.
          </p>
          <p className="mt-6 text-[13px] text-slate-400">
            {user?.email} ·{' '}
            <button onClick={() => signOut()} className="font-medium text-slate-500 underline hover:text-slate-700">
              Cerrar sesión
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2.5">
          <Logo className="size-9" />
          <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND}</span>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Elige un plan para empezar</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Tu cuenta está lista. Activa tu panel eligiendo un plan: candidatos y usuarios ilimitados en todos, sin permanencia, y puedes cambiar o cancelar cuando quieras. Precios sin IVA.
        </p>

        <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`relative flex flex-col rounded-2xl p-6 ${
                t.available === false
                  ? 'border border-slate-200 bg-slate-50'
                  : t.recommended
                    ? 'border-2 border-indigo-600 bg-white shadow-card'
                    : 'border border-slate-200 bg-white shadow-card'
              }`}
            >
              {t.available === false ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-500">
                  Próximamente
                </span>
              ) : t.recommended ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white">
                  Recomendado
                </span>
              ) : null}
              <h2 className="text-lg font-semibold text-slate-900">{t.name}</h2>
              <p className="mt-1 text-[14px] text-slate-500">{t.tagline}</p>
              <p className="mt-3 text-[13px] font-semibold text-indigo-700">{t.processes}</p>
              <div className="mt-3 flex items-baseline gap-1.5">
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
              {t.available === false ? (
                <div className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-400">
                  Próximamente
                </div>
              ) : (
                <button
                  onClick={() => choose(t.id)}
                  disabled={!!busy}
                  className={`${BTN_PRIMARY} mt-6 w-full disabled:opacity-60`}
                >
                  {busy === t.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Empezar con {t.name}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] text-slate-400">
          ¿Solo quieres curiosear? Mira la <a href="/demo" className="font-medium text-indigo-600 hover:text-indigo-700">demo con datos de ejemplo</a>.
        </p>
        <p className="mt-2 text-center text-[13px] text-slate-400">
          {user?.email} ·{' '}
          <button onClick={() => signOut()} className="font-medium text-slate-500 underline hover:text-slate-700">
            Cerrar sesión
          </button>
        </p>
      </div>
    </div>
  )
}

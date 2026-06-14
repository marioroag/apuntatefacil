import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { TIERS } from '../lib/pricing'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const PLAN_RANK: Record<string, number> = { trial: 0, esencial: 1, pro: 2, multi: 3 }

export function Plan() {
  const { company, refreshCompany } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const c = params.get('checkout')
    if (!c) return
    if (c === 'ok') {
      toast.success('Suscripción activada. Puede tardar unos segundos en reflejarse.')
      refreshCompany()
    } else if (c === 'cancel') {
      toast.show('Pago cancelado, no se ha cobrado nada.')
    }
    params.delete('checkout')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upgrade = async (planId: string) => {
    setBusy(planId)
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { plan: planId, returnUrl: `${window.location.origin}/app/plan` },
    })
    setBusy(null)
    if (error || !data?.url) {
      toast.error('No se pudo iniciar el pago. Revisa que las claves de Stripe estén configuradas.')
      return
    }
    window.location.href = data.url as string
  }

  const current = company?.plan ?? 'trial'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <Link to="/app" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Volver al panel
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tu plan</h1>
      <p className="mt-1.5 text-slate-600">
        Estás en el plan <strong className="font-semibold text-slate-900">{current === 'trial' ? 'Prueba' : current}</strong>. Candidatos y usuarios ilimitados en todos. Precios sin IVA.
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
                onClick={() => upgrade(t.id)}
                disabled={isCurrent || !!busy}
                className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                  t.recommended ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {busy === t.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {isCurrent ? 'Tu plan actual' : isDowngrade ? `Cambiar a ${t.name}` : `Mejorar a ${t.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-center text-[13px] text-slate-400">
        El pago se gestiona con Stripe. Puedes cancelar cuando quieras y exportar tus datos siempre.
      </p>
    </div>
  )
}

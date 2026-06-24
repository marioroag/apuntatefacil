import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, CreditCard, Gauge, Loader2, MessagesSquare, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { miles } from '../lib/format'
import { TIERS, PLAN_LABEL } from '../lib/pricing'
import { STATUS_META, STATUS_ORDER } from '../lib/types'
import type { CandidateStatus } from '../lib/types'

// Forma del RPC admin_overview (ver migración 20260624140000_admin_overview.sql).
interface Overview {
  accounts: { companies: number; users: number; new_companies_7d: number; new_companies_30d: number }
  plans: { trial: number; esencial: number; pro: number; multi: number }
  subscriptions: {
    active_paid: number
    by_plan_interval: { plan: string; interval: string; count: number }[]
  }
  candidates: { total: number; new_7d: number; new_30d: number; by_status: Partial<Record<CandidateStatus, number>> }
  campaigns: { total: number; activa: number; pausada: number; cerrada: number }
  support: { open: number; closed: number; pending: number }
  series_candidates_14d: { day: string; count: number }[]
}

// MRR a partir del desglose plan x periodicidad, con los precios de pricing.ts (fuente
// única). El anual cuenta su parte mensual (precio anual / 12).
function computeMrr(rows: Overview['subscriptions']['by_plan_interval']): number {
  return rows.reduce((sum, r) => {
    const tier = TIERS.find((t) => t.id === r.plan)
    if (!tier) return sum
    const monthly = r.interval === 'year' ? tier.annual / 12 : tier.monthly
    return sum + monthly * r.count
  }, 0)
}

export function AdminOverview() {
  const toast = useToast()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('admin_overview')
    if (error) {
      if (error.message?.toLowerCase().includes('autorizado')) setDenied(true)
      else toast.error('No se pudieron cargar las estadísticas.')
      setLoading(false)
      return
    }
    setData(d as Overview)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  if (denied) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <Gauge className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Sin acceso</h1>
          <p className="mt-1.5 text-sm text-slate-500">El panel es solo para el equipo de Apúntate Fácil.</p>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="grid h-full place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  }

  const mrr = computeMrr(data.subscriptions.by_plan_interval)
  const maxDay = Math.max(1, ...data.series_candidates_14d.map((d) => d.count))
  const maxStatus = Math.max(1, ...STATUS_ORDER.map((s) => data.candidates.by_status[s] ?? 0))
  const maxPlan = Math.max(1, data.plans.trial, data.plans.esencial, data.plans.pro, data.plans.multi)

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Panel</h1>
        <p className="mt-0.5 text-sm text-slate-500">El pulso de Apúntate Fácil de un vistazo.</p>
      </header>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          Icon={Building2}
          label="Cuentas registradas"
          value={miles(data.accounts.companies)}
          sub={`${miles(data.accounts.users)} ${data.accounts.users === 1 ? 'usuario' : 'usuarios'} · +${miles(data.accounts.new_companies_7d)} esta semana`}
        />
        <StatCard
          Icon={CreditCard}
          label="Suscripciones de pago"
          value={miles(data.subscriptions.active_paid)}
          sub={`${miles(Math.round(mrr))} €/mes de ingreso recurrente`}
        />
        <StatCard
          Icon={Users}
          label="Candidatos recolectados"
          value={miles(data.candidates.total)}
          sub={`+${miles(data.candidates.new_7d)} en los últimos 7 días`}
        />
        <StatCard
          Icon={MessagesSquare}
          label="Consultas abiertas"
          value={miles(data.support.open)}
          sub={data.support.pending > 0 ? `${miles(data.support.pending)} te esperan` : 'Todo respondido'}
          to="/app/soporte"
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* Suscripciones por plan + MRR */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Suscripciones por plan</h2>
            <span className="num text-[13px] font-semibold text-slate-900">
              {miles(Math.round(mrr))} €/mes<span className="font-normal text-slate-400"> MRR</span>
            </span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {(['trial', 'esencial', 'pro', 'multi'] as const).map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[13px] text-slate-600">{PLAN_LABEL[p]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${p === 'trial' ? 'bg-slate-300' : 'bg-slate-700'}`}
                    style={{ width: `${Math.round((data.plans[p] / maxPlan) * 100)}%` }}
                  />
                </div>
                <span className="num w-8 shrink-0 text-right text-[13px] font-semibold text-slate-900">{data.plans[p]}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Candidaturas por día (14 días) */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Candidaturas, últimos 14 días</h2>
            <span className="num text-[13px] font-semibold text-slate-900">
              {miles(data.candidates.new_30d)}<span className="font-normal text-slate-400"> en 30 días</span>
            </span>
          </div>
          <div className="mt-4 flex h-28 items-end gap-1.5" aria-hidden>
            {data.series_candidates_14d.map((d) => (
              <div
                key={d.day}
                className="flex-1 rounded-t bg-slate-200 transition-colors hover:bg-slate-400"
                style={{ height: `${Math.max(4, Math.round((d.count / maxDay) * 100))}%` }}
                title={`${dayLabel(d.day)}: ${d.count} ${d.count === 1 ? 'candidatura' : 'candidaturas'}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{dayLabel(data.series_candidates_14d[0]?.day)}</span>
            <span>Hoy</span>
          </div>
        </section>

        {/* Candidatos por estado */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-900">Candidatos por estado</h2>
          <ul className="mt-4 space-y-2.5">
            {STATUS_ORDER.map((s) => {
              const n = data.candidates.by_status[s] ?? 0
              return (
                <li key={s} className="flex items-center gap-3">
                  <span className="flex w-24 shrink-0 items-center gap-1.5 text-[13px] text-slate-600">
                    <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
                    {STATUS_META[s].label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${STATUS_META[s].dot}`} style={{ width: `${Math.round((n / maxStatus) * 100)}%` }} />
                  </div>
                  <span className="num w-8 shrink-0 text-right text-[13px] font-semibold text-slate-900">{n}</span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Puestos + Soporte */}
        <section className="grid grid-rows-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-slate-400" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900">Puestos</h2>
            </div>
            <div className="mt-3 flex items-center gap-6">
              <MiniStat label="Activos" value={data.campaigns.activa} />
              <MiniStat label="Pausados" value={data.campaigns.pausada} />
              <MiniStat label="Cerrados" value={data.campaigns.cerrada} />
            </div>
          </div>
          <Link
            to="/app/soporte"
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-colors hover:border-slate-300"
          >
            <div>
              <div className="flex items-center gap-2">
                <MessagesSquare className="size-4 text-slate-400" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-900">Soporte</h2>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">
                {data.support.pending > 0 ? `${miles(data.support.pending)} pendientes de responder` : 'Sin consultas pendientes'}
              </p>
            </div>
            <span className="text-[13px] font-semibold text-slate-500 group-hover:text-indigo-600">Abrir bandeja</span>
          </Link>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  Icon,
  label,
  value,
  sub,
  to,
}: {
  Icon: typeof Building2
  label: string
  value: string
  sub: string
  to?: string
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="size-4" aria-hidden />
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
      </div>
      <p className="num mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-[13px] text-slate-500">{sub}</p>
    </>
  )
  const cls = 'block rounded-xl border border-slate-200 bg-white p-5 shadow-card'
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:border-slate-300`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="num text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-[12px] text-slate-500">{label}</p>
    </div>
  )
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function dayLabel(iso?: string): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]}`
}

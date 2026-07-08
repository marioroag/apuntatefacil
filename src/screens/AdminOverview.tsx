import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Briefcase, Building2, ChevronRight, CreditCard, Gauge, Loader2, MessagesSquare, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { SlideOver } from '../components/ui/SlideOver'
import { miles, relativeDate } from '../lib/format'
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

// Forma de los RPCs admin_accounts / admin_company_detail
// (ver migración 20260708130000_admin_accounts.sql).
interface AccountRow {
  id: string
  name: string
  plan: string
  interval: string | null
  subscription_status: string | null
  created_at: string
  users: number
  owner_email: string | null
  campaigns: number
  candidates: number
  candidates_7d: number
}

interface AccountDetail {
  users: { email: string; role: string; created_at: string; last_sign_in_at: string | null }[]
  campaigns: { id: string; title: string; status: string; created_at: string; candidates: number }[]
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

  // Drill-down de cuentas: la tarjeta "Cuentas registradas" abre un panel lateral
  // con el listado (plan, dueño, usuarios); pinchar una cuenta carga su detalle
  // (usuarios con último acceso + puestos con sus candidatos). El listado se pide
  // al abrir por primera vez, no con la página: es una vista secundaria.
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null)
  const [selected, setSelected] = useState<AccountRow | null>(null)
  const [detail, setDetail] = useState<AccountDetail | null>(null)

  const openAccounts = async () => {
    setAccountsOpen(true)
    if (accounts) return
    const { data: d, error } = await supabase.rpc('admin_accounts')
    if (error) {
      toast.error('No se pudo cargar el listado de cuentas.')
      setAccountsOpen(false)
      return
    }
    setAccounts(d as AccountRow[])
  }

  const openDetail = async (row: AccountRow) => {
    setSelected(row)
    setDetail(null)
    const { data: d, error } = await supabase.rpc('admin_company_detail', { p_company: row.id })
    if (error) {
      toast.error('No se pudo cargar el detalle de la cuenta.')
      setSelected(null)
      return
    }
    setDetail(d as AccountDetail)
  }

  const closeAccounts = () => {
    setAccountsOpen(false)
    setSelected(null)
    setDetail(null)
  }

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
          onClick={openAccounts}
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

      {/* Panel lateral de cuentas: listado y, al pinchar una, su detalle. */}
      <SlideOver
        open={accountsOpen}
        onClose={closeAccounts}
        title={selected ? selected.name : 'Cuentas registradas'}
      >
        {!selected ? (
          accounts === null ? (
            <PanelSpinner />
          ) : accounts.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-slate-500">Todavía no hay cuentas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(a)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
                      <Building2 className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-slate-900">{a.name}</span>
                        <PlanChip plan={a.plan} interval={a.interval} />
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                        {a.owner_email ?? 'Sin dueño'} · {a.users} {a.users === 1 ? 'usuario' : 'usuarios'}
                      </span>
                    </span>
                    <span className="num shrink-0 text-right text-[13px] text-slate-500">
                      {miles(a.candidates)} cand.
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div>
            <button
              type="button"
              onClick={() => { setSelected(null); setDetail(null) }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <ArrowLeft className="size-3.5" aria-hidden /> Todas las cuentas
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-2 px-2">
              <PlanChip plan={selected.plan} interval={selected.interval} />
              {selected.subscription_status && (
                <span className="text-[12px] text-slate-500">{selected.subscription_status}</span>
              )}
              <span className="text-[12px] text-slate-400">Cuenta creada el {shortDate(selected.created_at)}</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 px-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="num text-xl font-semibold text-slate-900">{miles(selected.users)}</p>
                <p className="text-[12px] text-slate-500">{selected.users === 1 ? 'Usuario' : 'Usuarios'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="num text-xl font-semibold text-slate-900">{miles(selected.campaigns)}</p>
                <p className="text-[12px] text-slate-500">{selected.campaigns === 1 ? 'Puesto' : 'Puestos'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="num text-xl font-semibold text-slate-900">{miles(selected.candidates)}</p>
                <p className="text-[12px] text-slate-500">
                  Candidatos{selected.candidates_7d > 0 ? ` · +${miles(selected.candidates_7d)} 7d` : ''}
                </p>
              </div>
            </div>

            {detail === null ? (
              <PanelSpinner />
            ) : (
              <>
                <h3 className="mt-6 px-2 text-[13px] font-semibold text-slate-900">Usuarios</h3>
                <ul className="mt-2 divide-y divide-slate-100">
                  {detail.users.map((u) => (
                    <li key={u.email} className="flex items-center gap-3 px-2 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800">{u.email}</span>
                        <span className="block text-[12px] text-slate-500">
                          {ROLE_LABEL[u.role] ?? u.role}
                          {u.last_sign_in_at ? ` · último acceso ${relativeDate(u.last_sign_in_at)}` : ' · nunca ha entrado'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <h3 className="mt-5 px-2 text-[13px] font-semibold text-slate-900">Puestos</h3>
                {detail.campaigns.length === 0 ? (
                  <p className="mt-2 px-2 text-[13px] text-slate-500">Todavía no ha creado ningún puesto.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {detail.campaigns.map((ca) => (
                      <li key={ca.id} className="flex items-center gap-3 px-2 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-800">{ca.title}</span>
                          <span className="block text-[12px] text-slate-500">
                            {CAMPAIGN_STATUS_LABEL[ca.status] ?? ca.status} · creado el {shortDate(ca.created_at)}
                          </span>
                        </span>
                        <span className="num shrink-0 text-[13px] font-semibold text-slate-900">
                          {miles(ca.candidates)}
                          <span className="font-normal text-slate-400"> cand.</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  )
}

// Chip de plan, neutro (el acento es solo para acción): los planes de pago van en
// tinta sólida para distinguirse del trial a un vistazo, con la periodicidad al lado.
function PlanChip({ plan, interval }: { plan: string; interval: string | null }) {
  const paid = plan !== 'trial'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        paid ? 'bg-slate-800 text-white ring-slate-800' : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {PLAN_LABEL[plan] ?? plan}
      {paid && interval === 'year' && <span className="font-normal opacity-70">anual</span>}
    </span>
  )
}

function PanelSpinner() {
  return (
    <div className="grid place-items-center py-10" role="status" aria-label="Cargando">
      <Loader2 className="size-5 animate-spin text-slate-400" aria-hidden />
    </div>
  )
}

const ROLE_LABEL: Record<string, string> = { owner: 'Propietario', member: 'Miembro', encargado: 'Encargado' }
const CAMPAIGN_STATUS_LABEL: Record<string, string> = { activa: 'Activo', pausada: 'Pausado', cerrada: 'Cerrado' }

function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function StatCard({
  Icon,
  label,
  value,
  sub,
  to,
  onClick,
}: {
  Icon: typeof Building2
  label: string
  value: string
  sub: string
  to?: string
  onClick?: () => void
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
  if (to) {
    return (
      <Link to={to} className={`${cls} transition-colors hover:border-slate-300`}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full cursor-pointer text-left transition-colors hover:border-slate-300`}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
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

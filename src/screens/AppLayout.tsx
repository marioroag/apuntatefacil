import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import { Briefcase, ExternalLink, Inbox, Loader2, LogOut, Menu, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { BRAND } from '../lib/brand'
import { Logo } from '../components/Logo'
import { initials } from '../lib/format'
import { seedDemoData } from '../lib/seedDemo'
import { NewCampaignWizard } from '../components/NewCampaignWizard'

const PLAN_LABEL: Record<string, string> = {
  trial: 'Prueba', esencial: 'Esencial', pro: 'Pro', multi: 'Multi',
}

export function FirstCampaignRedirect() {
  const { campaigns, loading } = useStore()
  if (loading)
    return (
      <div className="grid h-full place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  const first = campaigns[0]
  if (!first) return <EmptyCompany />
  return <Navigate to={`/app/puestos/${first.id}`} replace />
}

function EmptyCompany() {
  const { reload } = useStore()
  const { company } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  const loadDemo = async () => {
    if (!company) return
    setBusy(true)
    const res = await seedDemoData(company.id)
    if (res.error) {
      toast.error('No se pudieron cargar los datos de ejemplo.')
      setBusy(false)
      return
    }
    await reload()
    toast.success('Datos de ejemplo cargados')
    setBusy(false)
  }

  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Inbox className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Empieza tu primer puesto</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Crea un puesto, comparte su enlace con quien responda a tu anuncio y las candidaturas entran aquí solas.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            onClick={() => setWizardOpen(true)}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
          >
            <Plus className="size-4" aria-hidden /> Crear un puesto
          </button>
          <button
            onClick={loadDemo}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-slate-400" aria-hidden />}
            Cargar datos de ejemplo
          </button>
        </div>
      </div>
      <NewCampaignWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}

export function AppLayout() {
  const { campaigns, newCountFor } = useStore()
  const { company, signOut } = useAuth()
  const { campaignId } = useParams()
  const [open, setOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  if (!company) return null // AuthGate garantiza empresa; guard de tipos

  const nav = (
    <nav className="flex h-full flex-col" aria-label="Puestos">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link to="/" className="flex items-center gap-2" aria-label={`${BRAND}, ir al inicio`}>
          <Logo className="size-7" />
          <span className="text-[15px] font-bold tracking-tight text-slate-900">{BRAND}</span>
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="px-3 pt-5">
        <button
          onClick={() => { setWizardOpen(true); setOpen(false) }}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.98]"
        >
          <Plus className="size-4" aria-hidden /> Nuevo puesto
        </button>
      </div>

      <p className="px-4 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Puestos
      </p>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {campaigns.map((c) => {
          const count = newCountFor(c.id)
          return (
            <li key={c.id}>
              <NavLink
                to={`/app/puestos/${c.id}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-50 font-semibold text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-indigo-600" aria-hidden />}
                    <Briefcase className={`size-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.status === 'pausada' && (
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">Pausado</span>
                    )}
                    {count > 0 && (
                      <span
                        className="shrink-0 rounded-full bg-indigo-100 px-1.5 text-[11px] font-bold tabular-nums text-indigo-700"
                        title={`${count} nuevos`}
                      >
                        {count}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
            {initials(company.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-800">{company.name}</p>
            <Link to="/app/plan" className="block truncate text-[11px] text-slate-500 hover:text-indigo-600">
              Plan {PLAN_LABEL[company.plan] ?? 'Prueba'} · gestionar
            </Link>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Link
            to="/"
            className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <ExternalLink className="size-3.5" aria-hidden /> Ver la web
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="size-3.5" aria-hidden /> Salir
          </button>
        </div>
      </div>
    </nav>
  )

  void campaignId

  return (
    <div className="flex h-svh overflow-hidden bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-pop">{nav}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu className="size-5" aria-hidden />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <Logo className="size-6" />
            <span className="text-sm font-bold text-slate-900">{BRAND}</span>
          </Link>
        </div>

        <main id="contenido" className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <NewCampaignWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}

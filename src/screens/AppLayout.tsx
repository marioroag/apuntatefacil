import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import { Briefcase, ExternalLink, Menu, Plus, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useToast } from '../components/ui/Toast'
import { BRAND } from '../lib/brand'
import { Logo } from '../components/Logo'

export function FirstCampaignRedirect() {
  const { data } = useStore()
  const first = data.campaigns[0]
  if (!first) return <Navigate to="/" replace />
  return <Navigate to={`/app/puestos/${first.id}`} replace />
}

export function AppLayout() {
  const { data, newCountFor } = useStore()
  const toast = useToast()
  const { campaignId } = useParams()
  const [open, setOpen] = useState(false)

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
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.98]"
          onClick={() => toast.show('En esta demo los puestos están precargados. Aquí abrirías el asistente para crear uno nuevo.')}
        >
          <Plus className="size-4" aria-hidden /> Nuevo puesto
        </button>
      </div>

      <p className="px-4 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Puestos
      </p>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {data.campaigns.map((c) => {
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
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[13px] font-bold text-white">
            EL
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-800">{data.company.name}</p>
            <p className="text-[11px] text-slate-500">
              Plan {data.company.plan === 'pro' ? 'Pro' : 'Free'}
            </p>
          </div>
        </div>
        <Link
          to="/"
          className="mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Volver a la web
        </Link>
      </div>
    </nav>
  )

  if (!campaignId && data.campaigns.length === 0) return <Navigate to="/" replace />

  return (
    <div className="flex h-svh overflow-hidden bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">{nav}</aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-pop">{nav}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar móvil */}
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
    </div>
  )
}

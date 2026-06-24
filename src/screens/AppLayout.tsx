import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Building2, Check, ChevronDown, ExternalLink, Gauge, Inbox, LayoutGrid, LifeBuoy, Loader2, LogOut, Menu, MessagesSquare, Plus, Sparkles, Tag, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { BRAND } from '../lib/brand'
import { Logo } from '../components/Logo'
import { BetaBadge } from '../components/BetaBadge'
import { initials } from '../lib/format'
import { seedDemoData } from '../lib/seedDemo'
import { NewCampaignWizard } from '../components/NewCampaignWizard'
import { SupportDialog } from '../components/SupportDialog'
import { useIsSupportStaff } from '../lib/useSupportStaff'
import { TrialPausedDialog } from '../components/TrialPausedDialog'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAppBase } from '../lib/useAppBase'
import { ArrowRight } from 'lucide-react'
import { planHas, PLAN_LABEL } from '../lib/pricing'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'

// Item del menú lateral. Solo se muestra si el plan incluye la feature (la
// visibilidad la decide quien lo renderiza); el límite se descubre al intentar
// usar las cosas en su contexto (pill de sede/marca, crear puesto, vistas), no
// con tabs bloqueadas en el menú.
function SideNavItem({
  to,
  Icon,
  label,
  count = 0,
  onNavigate,
}: {
  to: string
  Icon: LucideIcon
  label: string
  count?: number
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-sm transition-colors ${
          isActive ? 'bg-indigo-50 font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`size-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
          <span className="flex-1">{label}</span>
          {count > 0 && (
            <span className="num shrink-0 rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700" title={`${count} nuevos`}>
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function FirstCampaignRedirect() {
  const { campaigns, loading } = useStore()
  const base = useAppBase()
  if (loading)
    return (
      <div className="grid h-full place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  if (campaigns.length === 0) return <EmptyCompany />
  return <Navigate to={`${base}/resumen`} replace />
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
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
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
            className={`${BTN_PRIMARY} disabled:opacity-60`}
          >
            <Plus className="size-4" aria-hidden /> Crear un puesto
          </button>
          {/* En Prueba no se cargan datos de ejemplo: superarían los topes (1 puesto,
              15 candidatos) y pausarían el puesto al instante. Para curiosear está /demo. */}
          {company?.plan !== 'trial' && (
            <button
              onClick={loadDemo}
              disabled={busy}
              className={`${BTN_SECONDARY} disabled:opacity-60`}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-slate-400" aria-hidden />}
              Cargar datos de ejemplo
            </button>
          )}
        </div>
      </div>
      <NewCampaignWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}

// Cambiador de equipos (solo si el usuario pertenece a 2+ empresas). Va al pie del
// sidebar, así que el desplegable abre hacia ARRIBA.
function CompanySwitcher({
  companies,
  activeId,
  onSwitch,
}: {
  companies: { id: string; name: string }[]
  activeId: string
  onSwitch: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = companies.find((c) => c.id === activeId)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
          {initials(active?.name ?? '')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-800">{active?.name}</p>
          <p className="truncate text-[11px] text-slate-500">Cambiar de equipo</p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-pop"
        >
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === activeId}
                onClick={() => {
                  onSwitch(c.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
              >
                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {initials(c.name)}
                </div>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800">{c.name}</span>
                {c.id === activeId && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AppLayout() {
  const { campaigns, newCountFor, newSinceFor, resetDemo, sites, loading } = useStore()
  const { company, companies, setActiveCompany, signOut, role, user } = useAuth()
  const { campaignId } = useParams()
  const base = useAppBase()
  const navigate = useNavigate()
  const demo = base === '/demo'
  const isStaff = useIsSupportStaff()
  const [open, setOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [confirmReset, setConfirmReset] = useState(false)
  const [betaBannerOpen, setBetaBannerOpen] = useState(
    () => typeof localStorage !== 'undefined' && !localStorage.getItem('apuntatefacil.beta-banner-dismissed')
  )

  // Plan de Prueba con el puesto pausado por el tope de candidatos: avisamos una vez
  // por apertura del panel (vuelve a salir en cada recarga hasta que suba de plan).
  // Lo detectamos por el ESTADO del puesto, no por el recuento: así el aviso sigue
  // saliendo aunque borren candidatos por debajo de 15 (en Prueba la única causa de
  // pausa es el tope), y también lo ve el encargado, cuyo recuento está acotado por RLS.
  const trialPaused = !demo && company?.plan === 'trial' && campaigns.some((c) => c.status === 'pausada')
  const [pausedOpen, setPausedOpen] = useState(false)
  const pausedShown = useRef(false)
  useEffect(() => {
    if (trialPaused && !pausedShown.current) {
      pausedShown.current = true
      setPausedOpen(true)
    }
  }, [trialPaused])

  // Gesto de navegación en móvil: deslizar hacia la derecha desde los primeros ~70%
  // del ancho abre el menú (zona generosa, acorde a la memoria muscular); deslizar
  // a la izquierda lo cierra. Solo gestos claramente horizontales, para no pelear
  // con el scroll vertical ni con tirar para refrescar. Listeners pasivos.
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    const THRESHOLD = 55 // px de recorrido horizontal para disparar
    const OPEN_ZONE = 0.7 // fracción del ancho (desde la izq.) donde puede iniciarse la apertura
    let sx = 0,
      sy = 0,
      track = false,
      inOpenZone = false
    let axis: '' | 'h' | 'v' = ''
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.innerWidth >= 1024) {
        track = false
        return
      }
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      // Abrir: el gesto puede empezar en los primeros ~70% del ancho.
      inOpenZone = sx <= window.innerWidth * OPEN_ZONE
      track = openRef.current || inOpenZone // abrir: zona izquierda amplia; cerrar: en cualquier sitio
      axis = ''
    }
    const onMove = (e: TouchEvent) => {
      if (!track) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!axis) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
        axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (axis === 'v') {
          track = false // vertical: lo maneja el scroll / pull-to-refresh
          return
        }
      }
      if (openRef.current) {
        if (dx < -THRESHOLD) {
          setOpen(false)
          track = false
        }
      } else if (inOpenZone && dx > THRESHOLD) {
        setOpen(true)
        track = false
      }
    }
    const onEnd = () => {
      track = false
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (!company) return null // AuthGate garantiza empresa; guard de tipos

  const isEncargado = role === 'encargado'
  const isOwner = role === 'owner'
  // Las features avanzadas NO se muestran en el menú si el plan no las incluye:
  // el cliente descubre el límite al intentar usar las cosas en su contexto (pill
  // de sede/marca, crear puesto, vistas guardadas), no con tabs bloqueadas. El
  // encargado ve sus datos (acotados por RLS) pero no gestiona estructura ni equipo.
  const showSedes = planHas(company.plan, 'sites') // Sedes: todos los roles ven sus sedes (acotadas por RLS); crear/editar/borrar va gateado dentro por rol
  const showBrands = planHas(company.plan, 'brands') && !isEncargado // gestionar marcas
  const showEquipo = !demo && isOwner // gestión de equipo: solo el propietario
  const canCreate = !isEncargado // crear puestos
  const groupBySite = planHas(company.plan, 'sites') && sites.length > 0
  const totalNuevos = campaigns.reduce((s, c) => s + newCountFor(c.id), 0)
  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Render de un puesto (reutilizado en lista plana y agrupada por sede).
  const renderPuesto = (c: (typeof campaigns)[number]) => {
    const count = newSinceFor(c.id)
    return (
      <li key={c.id}>
        <NavLink
          to={`${base}/puestos/${c.id}`}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              isActive ? 'bg-indigo-50 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-indigo-600" aria-hidden />}
              <Briefcase className={`size-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              {c.status !== 'activa' && <span className="shrink-0 text-[11px] font-medium text-slate-500">{c.status === 'pausada' ? 'Pausado' : 'Cerrado'}</span>}
              {count > 0 && (
                <span className="num shrink-0 rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700" title={`${count} nuevos`}>
                  {count}
                </span>
              )}
            </>
          )}
        </NavLink>
      </li>
    )
  }

  const nav = (
    <nav className="flex h-full flex-col" aria-label="Puestos">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link to="/" className="flex items-center gap-2" aria-label={`${BRAND}, ir al inicio`}>
          <Logo className="size-7" />
          <span className="text-[17px] brand-wordmark text-slate-900" aria-hidden>apuntatefacil</span>
          <BetaBadge />
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {canCreate && (
        <div className="px-3 pt-5">
          <button
            onClick={() => { setWizardOpen(true); setOpen(false) }}
            className={`${BTN_PRIMARY} w-full`}
          >
            <Plus className="size-4" aria-hidden /> Nuevo puesto
          </button>
        </div>
      )}

      <div className={`px-3 ${canCreate ? 'pt-2' : 'pt-5'}`}>
        <SideNavItem
          to={`${base}/resumen`}
          Icon={LayoutGrid}
          label="Vista general"
          onNavigate={() => setOpen(false)}
        />
      </div>

      <div className="px-3 pt-2">
        <SideNavItem
          to={`${base}/bandeja`}
          Icon={Inbox}
          label="Bandeja"
          count={totalNuevos}
          onNavigate={() => setOpen(false)}
        />
      </div>

      {showSedes && (
        <div className="px-3 pt-2">
          <SideNavItem
            to={`${base}/sedes`}
            Icon={Building2}
            label="Sedes"
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {showBrands && (
        <div className="px-3 pt-2">
          <SideNavItem
            to={`${base}/marcas`}
            Icon={Tag}
            label="Marcas"
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {showEquipo && (
        <div className="px-3 pt-2">
          <NavLink
            to={`${base}/equipo`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-sm transition-colors ${
                isActive ? 'bg-indigo-50 font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Users className={`size-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
                <span className="flex-1">Equipo</span>
              </>
            )}
          </NavLink>
        </div>
      )}

      {/* Zona de ADMIN: SOLO para el equipo de Apúntate Fácil (allowlist en el backend),
          nunca en la demo. El resto de usuarios no ve nada de esto. */}
      {isStaff && !demo && (
        <>
          <p className="px-4 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
          <div className="px-3">
            <SideNavItem to={`${base}/admin`} Icon={Gauge} label="Panel" onNavigate={() => setOpen(false)} />
          </div>
          <div className="px-3 pt-1">
            <SideNavItem to={`${base}/soporte`} Icon={MessagesSquare} label="Soporte" onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}

      {loading ? (
        // Transición (carga inicial o cambio de equipo): skeleton en lugar de los puestos del
        // equipo anterior, para que header, lista y contenido se revelen a la vez al terminar.
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pt-4" role="status" aria-label="Cargando puestos">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg skeleton" />
          ))}
        </div>
      ) : groupBySite ? (
        <div className="flex-1 overflow-y-auto px-2 pt-4">
          {sites.map((s) => {
            const items = campaigns.filter((c) => c.siteId === s.id)
            if (items.length === 0) return null
            const isCollapsed = collapsed.has(s.id)
            return (
              <div key={s.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(s.id)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className={`size-3.5 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
                  <span className="num">{items.length}</span>
                </button>
                {!isCollapsed && <ul className="space-y-0.5">{items.map(renderPuesto)}</ul>}
              </div>
            )
          })}
          {(() => {
            const sinSede = campaigns.filter((c) => !c.siteId || !sites.some((s) => s.id === c.siteId))
            if (sinSede.length === 0) return null
            const isCollapsed = collapsed.has('__none__')
            return (
              <div className="mb-1">
                <button
                  onClick={() => toggleGroup('__none__')}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className={`size-3.5 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">Sin sede</span>
                  <span className="num">{sinSede.length}</span>
                </button>
                {!isCollapsed && <ul className="space-y-0.5">{sinSede.map(renderPuesto)}</ul>}
              </div>
            )
          })()}
        </div>
      ) : (
        <>
          <p className="px-4 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Puestos
          </p>
          <ul className="flex-1 space-y-0.5 overflow-y-auto px-2">{campaigns.map(renderPuesto)}</ul>
        </>
      )}

      <div className="mt-auto border-t border-slate-200 p-3">
        {demo ? (
          <>
            <Link to="/login" className={`${BTN_PRIMARY} w-full`}>
              Empezar <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/"
              className="mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <ExternalLink className="size-3.5" aria-hidden /> Salir de la demo
            </Link>
          </>
        ) : (
          <>
            {/* Bloque del usuario: para el owner TODO el bloque (avatar + nombre +
                subtítulo) lleva a gestionar el plan, no solo el texto. "Salir" queda
                aparte (abajo), así no anidamos interactivos dentro del Link. */}
            {companies.length > 1 ? (
              <>
                <CompanySwitcher
                  companies={companies}
                  activeId={company.id}
                  onSwitch={(id) => {
                    if (id === company.id) return
                    setActiveCompany(id)
                    setOpen(false) // cerrar el drawer móvil, como el resto de acciones del menú
                    // Vamos a la base: el store entra en "cargando" de golpe (loadedCompanyId aún
                    // es el viejo) y el redirect de /app lleva a Vista general del nuevo equipo
                    // cuando llegan sus datos. Evita quedar en un :id que ya no existe.
                    navigate(base)
                  }}
                />
                {isOwner && (
                  <Link
                    to="/app/plan"
                    className="mt-0.5 block truncate rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                  >
                    Gestionar plan {PLAN_LABEL[company.plan] ?? 'Prueba'}
                  </Link>
                )}
              </>
            ) : isOwner ? (
              <Link
                to="/app/plan"
                aria-label={`Gestionar plan ${PLAN_LABEL[company.plan] ?? 'Prueba'}`}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
                  {initials(company.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{company.name}</p>
                  <p className="truncate text-[11px] text-slate-500 group-hover:text-indigo-600">
                    Gestionar plan {PLAN_LABEL[company.plan] ?? 'Prueba'}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[12px] font-bold text-white">
                  {initials(company.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{company.name}</p>
                  <p className="truncate text-[11px] text-slate-500">Plan {PLAN_LABEL[company.plan] ?? 'Prueba'}</p>
                </div>
              </div>
            )}
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => { setSupportOpen(true); setOpen(false) }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <LifeBuoy className="size-3.5" aria-hidden /> Ayuda
              </button>
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <LogOut className="size-3.5" aria-hidden /> Salir
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  )

  void campaignId

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">{nav}</aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-slate-900/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 h-full w-72 bg-white shadow-pop"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
            >
              {nav}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu className="size-5" aria-hidden />
          </button>
          <Link to="/" className="flex items-center gap-2" aria-label={`${BRAND}, ir al inicio`}>
            <Logo className="size-6" />
            <span className="text-[17px] brand-wordmark text-slate-900" aria-hidden>apuntatefacil</span>
            <BetaBadge />
          </Link>
        </div>

        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-center text-[13px] text-indigo-800">
            <span>Demo con datos de ejemplo en Plan {PLAN_LABEL[company.plan]}.</span>
            {/* Los dos accionables van juntos: saltan de línea como un bloque, sin
                que "Crear mi cuenta" se quede solo en la línea de abajo. */}
            <span className="inline-flex items-center gap-2">
              <button onClick={() => setConfirmReset(true)} className="font-semibold underline underline-offset-2 hover:text-indigo-900">
                Reiniciar demo
              </button>
              <span aria-hidden className="h-3 w-px bg-indigo-200" />
              <Link to="/login" className="font-semibold underline underline-offset-2 hover:text-indigo-900">
                Crear mi cuenta
              </Link>
            </span>
          </div>
        )}
        {!demo && betaBannerOpen && (
          <div className="flex items-center justify-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-[12px] text-slate-500">
            <BetaBadge />
            <span>
              Estás en la versión beta. Si algo no va bien,{' '}
              <button
                onClick={() => setSupportOpen(true)}
                className="font-semibold underline underline-offset-2 hover:text-slate-700"
              >
                escríbenos
              </button>{' '}
              y lo arreglamos.
            </span>
            <button
              onClick={() => { setBetaBannerOpen(false); localStorage.setItem('apuntatefacil.beta-banner-dismissed', '1') }}
              className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              aria-label="Cerrar aviso de beta"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
        <main id="contenido" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Suspense fallback={<div className="grid h-full place-items-center" role="status" aria-label="Cargando"><Loader2 className="size-6 animate-spin text-slate-400" aria-hidden /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <NewCampaignWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <SupportDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        source="app"
        defaultEmail={user?.email ?? ''}
        companyId={company.id}
      />
      <TrialPausedDialog open={pausedOpen} onClose={() => setPausedOpen(false)} />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); resetDemo() }}
        title="¿Reiniciar la demo?"
        confirmLabel="Reiniciar"
        confirmVariant="danger"
      >
        Se recargan los datos de ejemplo y se pierden los cambios que hayas hecho durante esta demo.
      </ConfirmDialog>
    </div>
  )
}

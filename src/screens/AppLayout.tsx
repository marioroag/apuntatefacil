import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, CalendarDays, ChevronDown, Gauge, Inbox, LayoutGrid, Loader2, MessagesSquare, Plus, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { BetaBadge } from '../components/BetaBadge'
import { seedDemoData } from '../lib/seedDemo'
import { TopBar } from '../components/TopBar'
import { ProfileDialog } from '../components/ProfileDialog'
import { NewCampaignWizard } from '../components/NewCampaignWizard'
import { SupportDialog } from '../components/SupportDialog'
import { useIsSupportStaff } from '../lib/useSupportStaff'
import { DowngradeReconcileDialog } from '../components/DowngradeReconcileDialog'
import { OnboardingGuide, OnboardingCreatePuesto } from '../components/OnboardingGuide'
import { useOnboarding } from '../lib/onboarding'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAppBase } from '../lib/useAppBase'
import { AccionesProvider, RegistrarAccion } from '../lib/acciones'
import { planHas, PLAN_LABEL } from '../lib/pricing'
import { MERIDIAN_CHAT_ENABLED, MERIDIAN_NAME, hasMeridian, candidateFit } from '../lib/meridian'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'

// Cabecera de un grupo de sede en el menú: SOLO un separador plegable, cero
// botones de administración. El menú navega; renombrar y eliminar una sede viven
// en el bloque "Por sede" de Vista general, que ya las lista.
function SiteGroupHeader({
  name,
  count,
  collapsed,
  onToggle,
}: {
  name: string
  count: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
    >
      <ChevronDown className={`size-3.5 shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{name}</span>
      <span className="num">{count}</span>
    </button>
  )
}

// Item del menú lateral. Solo se muestra si el plan incluye la feature (la
// visibilidad la decide quien lo renderiza); el límite se descubre al intentar
// usar las cosas en su contexto (crear puesto, vistas guardadas), no con tabs
// bloqueadas en el menú.
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
  const onboarding = useOnboarding()
  if (loading)
    return (
      <div className="grid h-full place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  // Con la guía de primer uso activa, el paso 2 (crear el primer puesto con
  // plantilla) ocupa la pantalla; si el usuario la cerró, el empty state normal.
  if (campaigns.length === 0) return onboarding.active ? <OnboardingCreatePuesto /> : <EmptyCompany />
  // Recién creado el puesto durante la guía (sin candidaturas aún): el destino de
  // /app es el formulario del puesto (paso 3), no el resumen. Así ganamos la carrera
  // con el navigate imperativo del paso 2 y el usuario sigue la secuencia del wizard.
  if (onboarding.active && onboarding.phase !== 'hecho' && onboarding.campaign) {
    return <Navigate to={`${base}/puestos/${onboarding.campaign.id}/formulario`} replace />
  }
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

export function AppLayout() {
  // `companies`, `setActiveCompany` y `signOut` ya no salen de aquí: el cambio
  // de equipo y la sesión viven en el menú de la barra superior (ago 2026). El
  // lateral navega y nada más.
  const { campaigns, candidates, newCountFor, newSinceFor, resetDemo, sites, loading, boardNewCount, interviewUpcomingCount } = useStore()
  const { company, role, user, setOnboardingDone } = useAuth()
  const onboarding = useOnboarding()
  const { campaignId } = useParams()
  const base = useAppBase()
  const navigate = useNavigate()
  const demo = base === '/demo'
  const isStaff = useIsSupportStaff()
  const [open, setOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [confirmReset, setConfirmReset] = useState(false)
  const [betaBannerOpen, setBetaBannerOpen] = useState(
    () => typeof localStorage !== 'undefined' && !localStorage.getItem('apuntatefacil.beta-banner-dismissed')
  )

  // Guía de primer uso, ahora anclada en la barra con su anillo de progreso. El
  // paso que enseña es el MISMO que numera la propia guía ("Paso N de 4"), para
  // que no haya dos cuentas distintas del mismo avance. Se ve mientras quede
  // algo por hacer, la hayas cerrado o no; al pulsarla, si estaba cerrada se
  // reabre y en cualquier caso te lleva al paso pendiente.
  const pasoGuia =
    onboarding.eligible && onboarding.phase !== 'hecho'
      ? onboarding.phase === 'puesto'
        ? 2
        : onboarding.phase === 'formulario'
          ? 3
          : 4
      : null
  const abrirGuia = () => {
    if (onboarding.dismissed) void setOnboardingDone(false)
    const c = onboarding.campaign
    if (!c) return navigate(base)
    navigate(onboarding.phase === 'formulario' ? `${base}/puestos/${c.id}/formulario` : `${base}/puestos/${c.id}`)
  }

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
  // el cliente descubre el límite al intentar usar las cosas en su contexto (crear
  // puesto, vistas guardadas), no con tabs bloqueadas. El encargado ve sus datos
  // (acotados por RLS) pero no gestiona estructura.
  // Sedes y marcas NO tienen entrada aquí (ago 2026): no son destinos, son
  // atributos del puesto. La sede se crea y se asigna en los ajustes del puesto y
  // se renombra/borra en la cabecera de su grupo, aquí abajo; la marca vive en el
  // panel Apariencia del constructor del formulario.
  // Equipo (tablón + miembros) es Pro+: lo ven todos los roles del plan; dentro,
  // la pestaña Miembros solo se pinta al owner (y los RPCs son owner-only).
  const showEquipo = planHas(company.plan, 'teamBoard')
  // Entrevistas (Pro/Multi). El badge cuenta las CONFIRMADAS por venir, no
  // "novedades sin ver": aquí el número útil es cuántas citas tienes por delante.
  const showEntrevistas = planHas(company.plan, 'entrevistas')
  const canCreate = !isEncargado // crear puestos
  // Agrupamos solo si la agrupación SEPARA algo: con una única sede (o con todos
  // los puestos en la misma) la cabecera no informa de nada y solo mete ruido.
  const gruposConPuestos =
    sites.filter((s) => campaigns.some((c) => c.siteId === s.id)).length +
    (campaigns.some((c) => !c.siteId || !sites.some((s) => s.id === c.siteId)) ? 1 : 0)
  const groupBySite = gruposConPuestos > 1
  const totalNuevos = campaigns.reduce((s, c) => s + newCountFor(c.id), 0)
  // Meridian (Pro/Multi): entrada al Parte diario. Badge = candidaturas nuevas que
  // Meridian destaca (encajan bien) y aún no has revisado. Apagado mientras el hilo
  // esté fuera (MERIDIAN_CHAT_ENABLED): el triaje sigue vivo en cada candidatura.
  const showMeridian = MERIDIAN_CHAT_ENABLED && hasMeridian(company.plan)
  const meridianDestacados = showMeridian
    ? candidates.filter((c) => c.status === 'nuevo' && (candidateFit(c.ai) ?? -1) >= 70).length
    : 0
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
            `group flex min-h-11 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-150 ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 lg:min-h-9 ${
              isActive
                ? 'border-indigo-200/80 bg-indigo-50 font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
                : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
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

  // El menú lateral ya no lleva cabecera de marca: el logo salió del shell y la
  // esquina superior izquierda es ahora la persona (barra superior). Lo primero
  // que ves aquí es la acción, no la valla.
  const nav = (
    <nav className="flex h-full flex-col" aria-label="Puestos">
      {/* Solo en el cajón móvil: en escritorio el lateral es fijo y no se cierra. */}
      <div className="flex justify-end px-2 pt-2 lg:hidden">
        <button
          onClick={() => setOpen(false)}
          className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Cerrar menú"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {canCreate && (
        <div className="px-3 pt-3 lg:pt-4">
          <button
            onClick={() => { setWizardOpen(true); setOpen(false) }}
            className={`${BTN_PRIMARY} w-full`}
          >
            <Plus className="size-4" aria-hidden /> Nuevo puesto
          </button>
        </div>
      )}

      <div className={`space-y-1 px-3 ${canCreate ? 'pt-2' : 'pt-3 lg:pt-4'}`}>
        {/* Vista general es una pantalla más del Panel, la primera: se sacó
            arriba como pestaña y Mario lo descartó (ago 2026). Va con Bandeja y
            Equipo porque las tres son destinos de toda la empresa, por encima de
            la lista de puestos. */}
        <SideNavItem
          to={`${base}/resumen`}
          Icon={LayoutGrid}
          label="Vista general"
          onNavigate={() => setOpen(false)}
        />
        {showMeridian && (
          <SideNavItem
            to={`${base}/meridian`}
            Icon={Sparkles}
            label={MERIDIAN_NAME}
            count={meridianDestacados}
            onNavigate={() => setOpen(false)}
          />
        )}
        <SideNavItem
          to={`${base}/bandeja`}
          Icon={Inbox}
          label="Bandeja"
          count={totalNuevos}
          onNavigate={() => setOpen(false)}
        />
        {showEquipo && (
          <SideNavItem
            to={`${base}/equipo`}
            Icon={Users}
            label="Equipo"
            count={boardNewCount}
            onNavigate={() => setOpen(false)}
          />
        )}
      </div>

      {showEntrevistas && (
        <div className="px-3 pt-2">
          <SideNavItem
            to={`${base}/entrevistas`}
            Icon={CalendarDays}
            label="Entrevistas"
            count={interviewUpcomingCount}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {showEntrevistas && (
        <div className="px-3 pt-2">
          <SideNavItem
            to={`${base}/ajustes`}
            Icon={SlidersHorizontal}
            label="Ajustes"
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {/* Zona de ADMIN: SOLO para el equipo de Apúntate Fácil (allowlist en el backend),
          nunca en la demo. El resto de usuarios no ve nada de esto. */}
      {isStaff && !demo && (
        <>
          <p className="px-4 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
          <div className="space-y-1 px-3">
            <SideNavItem to={`${base}/admin`} Icon={Gauge} label="Panel" onNavigate={() => setOpen(false)} />
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
                <SiteGroupHeader
                  name={s.name}
                  count={items.length}
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroup(s.id)}
                />
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
                <SiteGroupHeader
                  name="Sin sede"
                  count={sinSede.length}
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroup('__none__')}
                />
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

      {/* El pie del lateral se vació: la empresa, el plan, la ayuda y salir viven
          ahora en el menú de perfil de la barra superior. El lateral navega y
          nada más. */}
      <div className="h-3 shrink-0" aria-hidden />
    </nav>
  )

  void campaignId

  return (
    <AccionesProvider>
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-50">
      {/* Lo que se puede HACER desde el buscador de la barra. Va en un componente
          aparte porque quien registra tiene que estar dentro del provider, y el
          provider lo monta esta misma pantalla. */}
      <RegistrarAccion
        activa={canCreate}
        id="nuevo-puesto"
        label="Nuevo puesto"
        hint="Publica un puesto y su formulario."
        icon={Plus}
        claves={['crear puesto', 'anuncio', 'oferta', 'vacante', 'publicar']}
        hacer={() => setWizardOpen(true)}
      />
      <TopBar
        onOpenMenu={() => setOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenOnboarding={abrirGuia}
        onboardingPaso={pasoGuia}
        betaBannerOpen={!demo && betaBannerOpen}
      />

      <div className="flex min-h-0 flex-1">
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
        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-center text-[13px] text-indigo-800">
            <span>Demo de empresario en Plan {PLAN_LABEL[company.plan]}.</span>
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
        {/* Con la guía activa, hueco inferior para que la tarjeta flotante no tape
            el final del contenido (botones de guardar, últimas filas). */}
        <main id="contenido" className={`min-h-0 flex-1 overflow-y-auto overscroll-contain${onboarding.active ? ' pb-28' : ''}`}>
          <Suspense fallback={<div className="grid h-full place-items-center" role="status" aria-label="Cargando"><Loader2 className="size-6 animate-spin text-slate-400" aria-hidden /></div>}>
            <Outlet />
          </Suspense>
        </main>
        </div>
      </div>

      <OnboardingGuide />
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <NewCampaignWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <SupportDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        source="app"
        defaultEmail={user?.email ?? ''}
        companyId={company.id}
      />
      {/* Bloqueante: tras bajar de plan, el dueño elige qué puestos mantener
          activos. El servidor ya garantizó el límite; esto es solo la elección. */}
      {!demo && isOwner && company?.downgrade_reconcile_at != null && <DowngradeReconcileDialog />}
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
    </AccionesProvider>
  )
}

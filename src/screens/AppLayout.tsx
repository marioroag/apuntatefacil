import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Inbox, Loader2, Menu, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { BetaBadge } from '../components/BetaBadge'
import { seedDemoData } from '../lib/seedDemo'
import { Sidebar } from '../components/Sidebar'
import { GlobalSearch } from '../components/GlobalSearch'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'
import { ProfileDialog } from '../components/ProfileDialog'
import { NewCampaignWizard } from '../components/NewCampaignWizard'
import { SupportDialog } from '../components/SupportDialog'
import { DowngradeReconcileDialog } from '../components/DowngradeReconcileDialog'
import { OnboardingGuide, OnboardingCreatePuesto } from '../components/OnboardingGuide'
import { useOnboarding } from '../lib/onboarding'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAppBase } from '../lib/useAppBase'
import { AccionesProvider, RegistrarAccion } from '../lib/acciones'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'

// El menú lateral entero (marca, destinos, puestos, acción y cuenta) vive ahora
// en `components/Sidebar.tsx`. Aquí solo queda el SHELL: qué superficies hay y
// cómo se reparten la pantalla.

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
  // Del store aquí no se lee casi nada: los contadores, los puestos y las
  // empresas los pide el propio lateral, que es quien los pinta. Este shell solo
  // reparte superficies y monta los diálogos.
  const { resetDemo } = useStore()
  const { company, role, user, setOnboardingDone } = useAuth()
  const onboarding = useOnboarding()
  const base = useAppBase()
  const navigate = useNavigate()
  const demo = base === '/demo'
  const [open, setOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [buscarOpen, setBuscarOpen] = useState(false)
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

  // ⌘K abre el buscador. El atajo vivía DENTRO del campo de la barra, que era
  // donde estaba montado siempre; retirada la barra ya no hay campo permanente,
  // así que lo registra el shell, que es lo único que nunca se desmonta. Se
  // ignora mientras el foco esté en un campo de texto sin que sea el atajo (el
  // navegador ya lo reserva) y se traga el ⌘K del navegador a propósito.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscarOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // Todo lo que el menú necesita saber lo saca él del store: aquí solo quedan la
  // guía de primer uso, el gesto del cajón y qué diálogos hay abiertos. Las
  // sedes salieron del lateral con el reskin (los puestos van en una sola lista
  // plegable), y con ellas el estado de grupos plegados.
  const isOwner = role === 'owner'
  // Crear puestos: el encargado ve sus datos (acotados por RLS) pero no gestiona
  // estructura. El límite de plan NO se descubre aquí, se descubre al crear.
  const canCreate = role !== 'encargado'

  // El lateral es la MISMA pieza en escritorio y en el cajón móvil: una sola
  // navegación, dos sitios donde ponerla. `onNavigate` es lo único que cambia de
  // sentido (en escritorio no hay cajón que cerrar, y cerrarlo es un no-op).
  const lateral = (
    <Sidebar
      onNavigate={() => setOpen(false)}
      onNewCampaign={() => { setWizardOpen(true); setOpen(false) }}
      onBuscar={() => { setBuscarOpen(true); setOpen(false) }}
      onOpenSupport={() => setSupportOpen(true)}
      onOpenProfile={() => setProfileOpen(true)}
      onOpenOnboarding={abrirGuia}
      onboardingPaso={pasoGuia}
      onReiniciarDemo={() => setConfirmReset(true)}
    />
  )

  return (
    <AccionesProvider>
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-50">
      {/* Lo que se puede HACER desde el buscador de la barra. Va en un componente
          aparte porque quien registra tiene que estar dentro del provider, y el
          provider lo monta esta misma pantalla. */}
      <RegistrarAccion
        activa={canCreate}
        id="nuevo-puesto"
        label="Crear puesto"
        hint="Publica un puesto y su formulario."
        icon={Plus}
        claves={['nuevo puesto', 'anuncio', 'oferta', 'vacante', 'publicar']}
        hacer={() => setWizardOpen(true)}
      />
      {/* La barra superior se retiró con el reskin (ago 2026): el lateral es la
          única capa de navegación y absorbió a sus tres inquilinos (Buscar,
          Notificaciones, Ajustes) y a tu cuenta. Aquí abajo solo queda el
          reparto: el menú a la izquierda, el trabajo a la derecha.

          Se probó devolverla (ago 2026): las dos formas convivieron tras un
          interruptor para poder compararlas en vivo, y Mario se quedó con esta.
          Si vuelve a plantearse, que sea con un argumento nuevo, no por nostalgia. */}
      <div className="flex min-h-0 flex-1">
        {/* 256px (`w-64`). El mockup traía 264; se bajó a 256 para darle esos
            píxeles al trabajo, que es lo que se mira, y se probó a seguir hasta
            240: ahí se parte, porque "Mozo/a de almacén" y "Preparador/a de
            pedidos" empiezan a cortarse a media palabra y la lista de puestos
            deja de ser legible de un vistazo. 256 es el suelo. (El nombre entero
            sigue en el `title` y el lector de pantalla lo lee completo: `truncate`
            es solo CSS.) El filo lo pinta el LATERAL y no el contenido, para que
            el borde sea siempre el mismo aunque debajo cambie la pantalla. */}
        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-lateral-filo)] lg:block">
          {lateral}
        </aside>

        {/* En móvil el mismo menú entra en un cajón, POR DEBAJO de la barrita de
            arriba (top-14 = su h-14): así el botón que lo abrió sigue a la vista
            y es el mismo que lo cierra, sin necesidad de una equis dentro.
            Si cambia la altura de esa barra, cambia este `top-14`. */}
        <AnimatePresence>
          {open && (
            <div className="fixed inset-x-0 bottom-0 top-14 z-40 lg:hidden">
              <motion.div
                className="absolute inset-0 bg-slate-900/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                id="menu-lateral"
                data-cajon
                className="absolute left-0 top-0 h-full w-72 shadow-pop"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
              >
                {lateral}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
        {/* La única barra que queda, y SOLO por debajo de lg: sin lateral a la
            vista hace falta algo que lo abra, y la marca acompaña porque en móvil
            es lo único que dice dónde estás. Todo lo demás (buscar, avisos,
            ajustes, tu cuenta) está dentro del cajón: cada cosa existe una sola
            vez en cada ancho, nunca las dos. */}
        <header className="z-50 flex h-14 shrink-0 items-center gap-1 border-b border-[var(--color-lateral-filo)] bg-[var(--color-lateral)] px-2 lg:hidden">
          <button
            data-cajon
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls={open ? 'menu-lateral' : undefined}
            className={`grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-[var(--color-lateral-hover)] hover:text-slate-900 ${open ? 'bg-[var(--color-lateral-activo)] text-slate-900' : ''}`}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
          <Link to={base} className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-900">
              <Logo className="size-[15px]" tone="oscuro" />
            </span>
            <span className="min-w-0 truncate text-[15px] font-bold tracking-[-0.02em] text-slate-900">{BRAND}</span>
          </Link>
        </header>
        {/* El aviso de la demo se retiró (Mario, ago 2026): con el shell nuevo era
            una franja permanente entre la barra y el trabajo para decir algo que
            ya dicen el menú de cuenta ("Salir de la demo") y la propia URL. Sus
            dos accionables no se perdieron: "Crear mi cuenta" y "Reiniciar demo"
            viven en ese menú, que es donde se va a buscar lo que tiene que ver
            con en qué cuenta estás. */}
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

      {/* Fuera del reparto de superficies a propósito: va a pantalla completa y
          dentro del `flex` se quedaría atrapado en su contexto de apilamiento. */}
      {buscarOpen && <GlobalSearch onClose={() => setBuscarOpen(false)} />}

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

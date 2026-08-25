import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  CreditCard,
  ExternalLink,
  HelpCircle,
  LifeBuoy,
  LogOut,
  Menu,
  Pencil,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProfiles } from '../lib/profiles'
import { useAppBase } from '../lib/useAppBase'
import { PLAN_LABEL } from '../lib/pricing'
import { initials } from '../lib/format'
import { Avatar } from './ui/Avatar'
import { BetaBadge } from './BetaBadge'
import { GlobalSearch } from './GlobalSearch'
import { Avisos } from './Avisos'

/**
 * Barra superior del producto (ago 2026). Es la capa de servicio de la app: a la
 * izquierda DÓNDE estás (la empresa), en el centro CÓMO llegar a alguien, y a la
 * derecha lo que reclama tu atención. Debajo, el trabajo.
 *
 * La esquina de la izquierda es la empresa y no el logo de Apúntate Fácil:
 * dentro de tu casa no hace falta la valla. Y no es tu cara: se probó al revés
 * (tú fuera, empresa dentro) y Mario lo cambió tomando de referencia Stripe.
 * Tú vives al fondo de este mismo menú, que es donde se va a buscar la sesión.
 * La marca sigue en la landing, el login y el formulario público, que es donde
 * hay algo que presentar.
 *
 * NO reparte la app en secciones: se probó un par de pestañas Inicio/Panel y se
 * descartó (Vista general es una pantalla más del Panel). Si vuelve a haber
 * navegación de primer nivel, tendrá que ganársela con una segunda mitad de
 * verdad, no con una pantalla mudada de sitio.
 *
 * NI UN PIXEL DE ULTRAMARINE aquí, salvo el foco. La barra no contiene ninguna
 * acción primaria (esa es "Nuevo puesto", en el lateral): el contador de avisos
 * y el anillo de progreso van en tinta.
 */

const ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'

const ICONO =
  'grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900'

/** La guía es de 4 pasos y ya los numera ella (StepProgress). El anillo lee
 *  el MISMO número: dos cuentas distintas del mismo avance sería un error. */
const ONBOARDING_TOTAL = 4

export function TopBar({
  menuOpen,
  onToggleMenu,
  onOpenSupport,
  onOpenProfile,
  onOpenOnboarding,
  onboardingPaso,
  betaBannerOpen,
}: {
  /** Si el cajón de navegación (solo móvil) está desplegado. */
  menuOpen: boolean
  onToggleMenu: () => void
  onOpenSupport: () => void
  onOpenProfile: () => void
  /** Abre o reabre la guía de primer uso. */
  onOpenOnboarding: () => void
  /** Paso actual de la guía (2..4, como su propia etiqueta), o null si no procede. */
  onboardingPaso: number | null
  /** Si el aviso de beta de abajo está puesto, aquí no se repite la chapa. */
  betaBannerOpen: boolean
}) {
  const base = useAppBase()
  const demo = base === '/demo'
  const [buscarMovil, setBuscarMovil] = useState(false)

  return (
    <>
      {/* z-50, por encima del cajón de navegación (z-40): en móvil el cajón entra
          POR DEBAJO de la barra, así que la barra tiene que seguir viva mientras
          está abierto, y con ella sus dos desplegables (empresa y avisos), que
          se pintan dentro de este contexto de apilamiento. Los diálogos de
          verdad (modales, buscador a pantalla completa) también van a z-50 y le
          ganan por orden en el DOM: se montan después. */}
      <header
        className="relative z-50 flex h-14 shrink-0 items-center border-b border-slate-200 bg-white"
        // Tocar la barra retira el cajón (menos su propio botón, que alterna).
        // Ahora que conviven en pantalla, cualquier otra cosa de aquí arriba abre
        // una capa o lleva a otro sitio, y dejar la navegación desplegada detrás
        // sería apilar dos superficies para lo mismo. Se filtra por el origen del
        // evento, como las filas de la tabla: nada de apagar zonas enteras.
        onPointerDownCapture={(e) => {
          if (menuOpen && !(e.target as HTMLElement).closest('[data-cajon]')) onToggleMenu()
        }}
      >
        {/* La celda de la empresa ocupa la misma columna que el menú lateral
            (w-64) y su filo continúa el borde del lateral: la esquina superior
            izquierda es una celda, no un elemento suelto flotando sobre el
            contenido. Si cambia el ancho del lateral, cambia este. Por debajo de
            lg no hay lateral que encajar y la celda se ajusta al nombre. */}
        <div className="flex h-full shrink-0 items-center px-2 lg:w-64 lg:border-r lg:border-slate-200">
          <CompanyMenu
            onOpenSupport={onOpenSupport}
            onOpenProfile={onOpenProfile}
            onOpenOnboarding={onboardingPaso !== null ? onOpenOnboarding : undefined}
          />
        </div>

        <div className="flex h-full min-w-0 flex-1 items-center px-2 sm:px-3 lg:px-6">
          {/* El buscador ocupa el centro porque encontrar a una persona sin
              recordar su puesto es lo único que no se puede hacer en ninguna
              pantalla. Por debajo de md no cabe un campo: hay un botón. */}
          <div className="hidden h-full min-w-0 flex-1 items-center md:flex">
            <GlobalSearch variant="inline" />
          </div>

          <div className="ml-auto flex h-full items-center gap-0.5 sm:gap-1">
            {/* Una sola señal de beta a la vez: mientras el aviso de abajo esté
                puesto, la chapa aquí arriba sería el mismo dato dos veces. */}
            {!demo && !betaBannerOpen && (
              <span className="mr-1 hidden lg:block">
                <BetaBadge />
              </span>
            )}
            {demo && (
              <Link
                to="/login"
                className="mr-1 hidden items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 sm:inline-flex"
              >
                Empezar <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}

            <button onClick={() => setBuscarMovil(true)} aria-label="Buscar" className={`${ICONO} md:hidden`}>
              <Search className="size-[18px]" aria-hidden />
            </button>

            {/* Ayuda y Primeros pasos ascienden a la barra a partir de sm; por
                debajo siguen siendo filas del menú. Cada cosa existe una sola
                vez en cada ancho, nunca las dos. */}
            <button onClick={onOpenSupport} aria-label="Ayuda" className={`${ICONO} hidden sm:grid`}>
              <HelpCircle className="size-[18px]" aria-hidden />
            </button>

            <Avisos />

            {/* Ajustes va pegado al timbre porque son vecinos de tema: lo que te
                llega y qué avisos quieres recibir se tocan desde los dos sitios. */}
            <NavLink
              to={`${base}/ajustes`}
              aria-label="Ajustes"
              className={({ isActive }) =>
                `${ICONO} ${isActive ? 'bg-slate-100 text-slate-900' : ''}`
              }
            >
              <Settings className="size-[18px]" aria-hidden />
            </NavLink>

            {onboardingPaso !== null && (
              <button
                onClick={onOpenOnboarding}
                aria-label={`Primeros pasos, paso ${onboardingPaso} de ${ONBOARDING_TOTAL}`}
                className="ml-1 hidden h-9 items-center gap-2 rounded-full filo pl-2.5 pr-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
              >
                <Anillo paso={onboardingPaso} />
                Primeros pasos
              </button>
            )}

            {/* Un solo control para el cajón: el que lo abre lo cierra. El cajón
                entra por debajo de la barra, así que este botón nunca queda
                tapado y no hace falta una equis dentro del menú. */}
            <button
              data-cajon
              onClick={onToggleMenu}
              aria-label={menuOpen ? 'Cerrar menú de puestos' : 'Abrir menú de puestos'}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? 'menu-lateral' : undefined}
              className={`${ICONO} lg:hidden ${menuOpen ? 'bg-slate-100 text-slate-900' : ''}`}
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {/* Fuera del header a propósito: el header es un contexto de apilamiento y
          esta capa, que va a pantalla completa, se quedaría dentro de él. */}
      {buscarMovil && (
        <GlobalSearch variant="sheet" onClose={() => setBuscarMovil(false)} />
      )}
    </>
  )
}

/** Anillo de progreso de la guía. En tinta, no en el acento: es un estado. */
function Anillo({ paso }: { paso: number }) {
  const r = 6.5
  const vuelta = 2 * Math.PI * r
  const hecho = Math.min(1, Math.max(0, paso / ONBOARDING_TOTAL))
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2.5" className="stroke-slate-200" />
      {hecho > 0 && (
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={vuelta}
          strokeDashoffset={vuelta * (1 - hecho)}
          transform="rotate(-90 8 8)"
          className="stroke-slate-900 transition-[stroke-dashoffset] duration-[var(--duration-max)] ease-[var(--ease-out)] motion-reduce:transition-none"
        />
      )}
    </svg>
  )
}

/**
 * Filas del menú que de verdad se ven. Ayuda y Primeros pasos se ocultan por
 * ancho (`sm:hidden`), y `display:none` NO las saca de querySelectorAll: sin
 * filtrar, las flechas mandaban el foco a una fila invisible y el recorrido se
 * quedaba atascado ahí.
 */
function visibles(root: HTMLElement | null): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('[data-mi]') ?? []).filter((el) => el.offsetParent !== null)
}

/**
 * Hueco de 26px a la izquierda de cada fila del menú. Existe porque ahí conviven
 * iconos de 16px y avatares de 26px: sin un hueco común, el texto de unas filas
 * arrancaba 10px antes que el de otras y la columna se veía rota.
 */
function Slot({ children }: { children: React.ReactNode }) {
  return <span className="grid size-[26px] shrink-0 place-items-center">{children}</span>
}

/** Baldosa de la empresa: sus iniciales sobre tinta. La misma en el botón y en
 *  la cabecera del menú, a dos tamaños. */
function CompanyTile({ name, size, radius }: { name: string; size: number; radius: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      className={`grid shrink-0 place-items-center bg-slate-900 font-bold leading-none text-white ${radius}`}
    >
      {initials(name)}
    </span>
  )
}

function CompanyMenu({
  onOpenSupport,
  onOpenProfile,
  onOpenOnboarding,
}: {
  onOpenSupport: () => void
  onOpenProfile: () => void
  onOpenOnboarding?: () => void
}) {
  const { company, companies, setActiveCompany, signOut, role, user } = useAuth()
  const profiles = useProfiles()
  const base = useAppBase()
  const demo = base === '/demo'
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const uid = user?.id ?? null
  const email = user?.email ?? ''
  const nombre = profiles.nameFor(uid, email)
  const foto = profiles.avatarFor(uid)
  const sinNombre = !profiles.me?.fullName.trim() && !demo
  const isOwner = role === 'owner'
  // Lo que el bloque de empresa pinta a cualquier ancho. Debajo de sm siempre
  // hay algo más (Ayuda, y Primeros pasos si procede), así que su raya sabe
  // desaparecer sola en vez de sumarse a la de arriba.
  const hayBloqueEmpresa = (!demo && isOwner) || companies.length > 1
  const empresa = company?.name ?? ''
  const planLabel = PLAN_LABEL[company?.plan ?? 'trial'] ?? 'Prueba'

  const close = useCallback(() => setOpen(false), [])

  // Cierre por clic fuera y por Escape; el foco vuelve a quien abrió.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Al abrir, el foco entra en el menú; ↑↓ recorren, Inicio/Fin saltan. Sin
  // temporizador: el panel ya está en el DOM cuando corre el efecto, y un
  // setTimeout se comía la primera flecha de quien va rápido con el teclado.
  useEffect(() => {
    if (!open) return
    visibles(panelRef.current)[0]?.focus()
  }, [open])

  const move = (dir: 1 | -1 | 'first' | 'last') => {
    const items = visibles(panelRef.current)
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next =
      dir === 'first' ? 0 : dir === 'last' ? items.length - 1 : i < 0 ? 0 : (i + dir + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div className="relative flex h-full min-w-0 flex-1 items-center" ref={wrapRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // El nombre visible se trunca en pantallas estrechas, así que el botón
        // necesita su propio nombre accesible; empieza por el visible para que
        // coincida con lo que se lee (WCAG "label in name").
        aria-label={`${empresa}. Tu cuenta`}
        // La baldosa cae a 12px del borde y el nombre a 46px: exactamente donde
        // arrancan el botón "Nuevo puesto" y las etiquetas del menú lateral.
        className={`flex h-10 max-w-[52vw] items-center gap-2 rounded-lg pl-1 pr-1.5 transition-colors sm:max-w-[240px] lg:w-full lg:max-w-none ${
          open ? 'bg-slate-100' : 'hover:bg-slate-100'
        }`}
      >
        <CompanyTile name={empresa} size={26} radius="rounded-md" />
        <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-slate-900">{empresa}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label="Tu cuenta"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
            else if (e.key === 'Home') { e.preventDefault(); move('first') }
            else if (e.key === 'End') { e.preventDefault(); move('last') }
          }}
          className="absolute left-0 top-full z-40 mt-1.5 w-[min(20rem,calc(100vw-1rem))] rounded-xl filo bg-white p-1.5 shadow-pop"
        >
          {/* Dónde estás. Centrado y con aire: es la puerta de entrada de la
              cuenta, no una fila más. No es accionable (el bloque de arriba
              informa, los de abajo actúan). */}
          <div className="flex flex-col items-center gap-1.5 px-3 pb-3 pt-3">
            <CompanyTile name={empresa} size={44} radius="rounded-xl" />
            <p className="max-w-full truncate text-[15px] font-semibold text-slate-900">{empresa}</p>
            <p className="text-[12px] text-slate-500">{company?.plan === 'proceso' ? planLabel : `Plan ${planLabel}`}</p>
          </div>

          <Separator />

          {!demo && isOwner && (
            <Link data-mi role="menuitem" to="/app/plan" onClick={close} className={ITEM}>
              <Slot><CreditCard className="size-4 text-slate-400" aria-hidden /></Slot>
              <span className="flex-1">Facturación</span>
            </Link>
          )}

          {/* Con varias empresas se elige aquí; con una, ya lo dice la cabecera. */}
          {companies.length > 1 && (
            <div role="group" aria-label="Cambiar de equipo">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Cambiar de equipo
              </p>
              {companies.map((c) => (
                <button
                  key={c.id}
                  data-mi
                  role="menuitemradio"
                  aria-checked={c.id === company?.id}
                  onClick={() => {
                    close()
                    if (c.id === company?.id) return
                    setActiveCompany(c.id)
                    navigate(base)
                  }}
                  className={ITEM}
                >
                  <CompanyTile name={c.name} size={24} radius="rounded-md" />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{c.name}</span>
                  {c.id === company?.id && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
                </button>
              ))}
            </div>
          )}

          {/* Ayuda y Primeros pasos solo por debajo de sm: a partir de ahí viven
              en la barra y aquí serían la misma cosa dos veces. */}
          <div className="sm:hidden">
            {onOpenOnboarding && (
              <button data-mi role="menuitem" onClick={() => { close(); onOpenOnboarding() }} className={ITEM}>
                <Slot><Compass className="size-4 text-slate-400" aria-hidden /></Slot>
                Primeros pasos
              </button>
            )}
            <button data-mi role="menuitem" onClick={() => { close(); onOpenSupport() }} className={ITEM}>
              <Slot><LifeBuoy className="size-4 text-slate-400" aria-hidden /></Slot>
              Ayuda
            </button>
          </div>

          {/* Una raya solo vale si separa dos cosas. La de arriba siempre lo
              hace (empresa y persona están siempre); esta depende de que el
              bloque de en medio exista, y en la demo con un solo equipo ese
              bloque solo existe por debajo de sm, así que la raya se va con
              él. Si no, quedaban dos rayas juntas sin nada entre ellas. */}
          <Separator className={hayBloqueEmpresa ? undefined : 'sm:hidden'} />

          {/* Y quién eres tú. Al fondo, como en la referencia: la sesión es lo
              último que se toca y lo primero que se busca cuando se busca. */}
          {demo ? (
            <>
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <Avatar name={nombre} seed={email || uid} src={foto} size={26} />
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{nombre}</p>
              </div>
              <Link data-mi role="menuitem" to="/login" onClick={close} className={ITEM}>
                <Slot><ArrowRight className="size-4 text-slate-400" aria-hidden /></Slot>
                Crear mi cuenta
              </Link>
              <Link data-mi role="menuitem" to="/" onClick={close} className={ITEM}>
                <Slot><ExternalLink className="size-4 text-slate-400" aria-hidden /></Slot>
                Salir de la demo
              </Link>
            </>
          ) : (
            <>
              <button data-mi role="menuitem" onClick={() => { close(); onOpenProfile() }} className={ITEM}>
                <Avatar name={nombre} seed={email || uid} src={foto} size={26} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{nombre}</span>
                {/* Sin nombre puesto, el menú lo dice una vez, sin insistir ni
                    bloquear. En tinta secundaria, NO en el acento: es un aviso,
                    y el acento aquí es solo acción, nav, foco y selección. */}
                {sinNombre && <span className="shrink-0 text-[12px] text-slate-500">Sin nombre</span>}
                <Pencil className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              </button>
              <button data-mi role="menuitem" onClick={() => { close(); void signOut() }} className={ITEM}>
                <Slot><LogOut className="size-4 text-slate-400" aria-hidden /></Slot>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Separator({ className = '' }: { className?: string }) {
  return <div className={`my-1 h-px bg-slate-200 ${className}`} role="separator" />
}

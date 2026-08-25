import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, Compass, ExternalLink, LifeBuoy, LogOut, Pencil, RotateCcw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProfiles } from '../lib/profiles'
import { useAppBase } from '../lib/useAppBase'
import { PLAN_LABEL } from '../lib/pricing'
import { initials } from '../lib/format'
import { FACTURACION_ICON } from '../lib/nav'
import { Avatar } from './ui/Avatar'
import { BetaBadge } from './BetaBadge'

// -----------------------------------------------------------------------------
// EL MENÚ DE CUENTA (antes `CompanyMenu`, en la barra superior).
//
// Cambia de disparador con el reskin: lo abría la EMPRESA, y ahora lo abre la
// PERSONA, porque la empresa ya se dice arriba, en la cabecera de su bloque. Se
// probó devolver las dos caras tras un interruptor para comparar los repartos
// (ago 2026) y ganó este: quedó una sola cara y una sola dirección.
// Dentro sigue el mismo reparto de Stripe: primero dónde estás (la empresa y su
// plan), luego lo de la empresa (facturación, cambio de equipo) y al final tú.
// Se abre hacia ARRIBA, que es de donde tiene sitio: vive pegado al filo de abajo.
// -----------------------------------------------------------------------------

const ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'

/** La guía es de 4 pasos y ya los numera ella (StepProgress). El anillo lee
 *  el MISMO número: dos cuentas distintas del mismo avance sería un error. */
const ONBOARDING_TOTAL = 4

/**
 * Filas del menú que de verdad se ven. `display:none` NO las saca de
 * querySelectorAll: sin filtrar, las flechas mandaban el foco a una fila
 * invisible y el recorrido se quedaba atascado ahí.
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

/** Baldosa de la empresa: sus iniciales sobre tinta. */
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

export function CuentaMenu({
  onNavigate,
  onOpenSupport,
  onOpenProfile,
  onOpenOnboarding,
  onboardingPaso,
  onReiniciarDemo,
}: {
  onNavigate: () => void
  onOpenSupport: () => void
  onOpenProfile: () => void
  onOpenOnboarding?: () => void
  onboardingPaso: number | null
  onReiniciarDemo: () => void
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
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // El nombre visible se trunca en pantallas estrechas, así que el botón
        // necesita su propio nombre accesible; empieza por el visible para que
        // coincida con lo que se lee (WCAG "label in name").
        aria-label={`${nombre}. Tu cuenta`}
        // Misma altura que el botón de arriba (36 en escritorio, 44 en táctil) y
        // no 46: el pie tiene que pertenecer al mismo sistema que las filas de
        // 34 que tiene encima. Iba suelto, con su propia medida, y se notaba.
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)] lg:h-9 ${
          open ? 'bg-[var(--color-lateral-activo)]' : 'hover:bg-[var(--color-lateral-hover)]'
        }`}
      >
        <Avatar name={nombre} seed={email || uid} src={foto} size={26} />
        {/* 14px, el mismo cuerpo que las etiquetas del menú: tu nombre es una
            fila más del lateral, no un titular. */}
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-900">{nombre}</span>
        {/* El aviso de la guía viaja con la cuenta: es lo último que queda por
            hacer para terminar de montar la casa, y aquí está siempre a la vista
            sin ocupar una fila propia del menú. */}
        {onboardingPaso !== null && <Anillo paso={onboardingPaso} />}
        <ChevronDown
          className={`size-3.5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
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
          // Hacia ARRIBA: el disparador está pegado al filo de abajo y no hay
          // sitio por debajo. `max-h` + scroll por si el equipo tiene muchas
          // empresas y la lista pasa de largo.
          // Hacia ARRIBA: el disparador está pegado al filo de abajo y no hay
          // sitio por debajo. `max-h` + scroll por si el equipo tiene muchas
          // empresas y la lista pasa de largo.
          className="absolute bottom-full left-0 z-40 mb-1.5 max-h-[min(80vh,32rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl filo bg-white p-1.5 shadow-pop"
        >
          {/* Dónde estás. Centrado y con aire: es la puerta de entrada de la
              cuenta, no una fila más. No es accionable (el bloque de arriba
              informa, los de abajo actúan). */}
          <div className="flex flex-col items-center gap-1.5 px-3 pb-3 pt-3">
            <CompanyTile name={empresa} size={44} radius="rounded-xl" />
            <p className="max-w-full truncate text-[15px] font-semibold text-slate-900">{empresa}</p>
            <p className="text-[12px] text-slate-500">{company?.plan === 'proceso' ? planLabel : `Plan ${planLabel}`}</p>
            {!demo && <BetaBadge />}
          </div>

          <Separator />

          {!demo && isOwner && (
            <Link data-mi role="menuitem" to="/app/plan" onClick={() => { close(); onNavigate() }} className={ITEM}>
              <Slot><FACTURACION_ICON className="size-4 text-slate-400" aria-hidden /></Slot>
              <span className="flex-1">Facturación</span>
            </Link>
          )}

          {/* Con varias empresas se elige aquí; con una, ya lo dice la cabecera. */}
          {companies.length > 1 && (
            <div role="group" aria-label="Cambiar de equipo">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[var(--tracking-overline)] text-slate-400">
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

          {/* Ayuda y Primeros pasos vivían en la barra a partir de sm y aquí por
              debajo. Retirada la barra, existen en un solo sitio a todos los
              anchos: este. */}
          {onOpenOnboarding && (
            <button data-mi role="menuitem" onClick={() => { close(); onOpenOnboarding() }} className={ITEM}>
              <Slot><Compass className="size-4 text-slate-400" aria-hidden /></Slot>
              <span className="flex-1">Primeros pasos</span>
              {onboardingPaso !== null && (
                <span className="num shrink-0 text-[12px] text-slate-500">{onboardingPaso}/{ONBOARDING_TOTAL}</span>
              )}
            </button>
          )}
          <button data-mi role="menuitem" onClick={() => { close(); onOpenSupport() }} className={ITEM}>
            <Slot><LifeBuoy className="size-4 text-slate-400" aria-hidden /></Slot>
            Ayuda
          </button>

          <Separator />

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
              {/* Se retiró la franja de aviso de la demo y este era su único sitio.
                  Aquí encaja mejor que allí: va con lo demás que tiene que ver con
                  en qué cuenta estás. */}
              <button data-mi role="menuitem" onClick={() => { close(); onReiniciarDemo() }} className={ITEM}>
                <Slot><RotateCcw className="size-4 text-slate-400" aria-hidden /></Slot>
                Reiniciar demo
              </button>
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

/** Anillo de progreso de la guía. En tinta, no en el acento: es un estado. */
function Anillo({ paso }: { paso: number }) {
  const r = 6.5
  const vuelta = 2 * Math.PI * r
  const hecho = Math.min(1, Math.max(0, paso / ONBOARDING_TOTAL))
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" role="img" aria-label={`Primeros pasos, paso ${paso} de ${ONBOARDING_TOTAL}`}>
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2.5" className="stroke-slate-300" />
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

function Separator({ className = '' }: { className?: string }) {
  return <div className={`my-1 h-px bg-slate-200 ${className}`} role="separator" />
}

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, ExternalLink, LifeBuoy, LogOut, Pencil, RotateCcw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProfiles } from '../lib/profiles'
import { useStore } from '../lib/store'
import { useAppBase } from '../lib/useAppBase'
import { procesosAbiertos } from '../lib/pricing'
import { initials } from '../lib/format'
import { FACTURACION_ICON } from '../lib/nav'
import { Avatar } from './ui/Avatar'

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
  const { campaigns } = useStore()
  const profiles = useProfiles()
  const base = useAppBase()
  const demo = base === '/demo'
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // El menú tiene DOS PÁGINAS en la misma caja, no una capa flotante colgada de
  // otra: la raíz y la de elegir equipo. Es el mismo mecanismo que el submenú de
  // Sede en el menú del puesto, y por el mismo motivo: colgada de la primera se
  // saldría de la pantalla, y en móvil este panel ya ocupa el ancho entero.
  const [pagina, setPagina] = useState<'raiz' | 'equipos'>('raiz')
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const uid = user?.id ?? null
  const email = user?.email ?? ''
  const nombre = profiles.nameFor(uid, email)
  const foto = profiles.avatarFor(uid)
  const sinNombre = !profiles.me?.fullName.trim() && !demo
  const abiertos = procesosAbiertos(campaigns)
  const isOwner = role === 'owner'
  const empresa = company?.name ?? ''
  // Debajo del nombre de la empresa NO va el nombre del plan, va CUÁNTOS PROCESOS
  // TIENE ABIERTOS (Mario, ago 2026). "Pago por proceso" es el nombre del modelo y
  // es el mismo todos los días: una línea que nunca cambia deja de leerse. El
  // número sí cambia, y es además la única cifra de la que depende la factura.
  //
  // Se dice ABIERTOS y no "activos" a propósito, aunque cueste una palabra menos:
  // un proceso PAUSADO sigue abierto y sigue cobrándose, así que llamarlos activos
  // insinuaría que los pausados no cuentan, que es justo el malentendido que la
  // doctrina de precios más se esfuerza en evitar. Es la misma palabra que usa
  // Facturación, que es a donde lleva esta línea si la pulsas.

  const close = useCallback(() => {
    setOpen(false)
    // La página vuelve a la raíz al CERRAR y no al abrir: al abrir se vería el
    // salto de vuelta durante la animación de cierre.
    setPagina('raiz')
  }, [])

  // Cierre por clic fuera y por Escape; el foco vuelve a quien abrió.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      // Dentro de la página de equipos, Escape vuelve a la raíz; en la raíz,
      // cierra. Así no se sale de todo por querer deshacer un paso.
      if (pagina === 'equipos') {
        setPagina('raiz')
        return
      }
      close()
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, pagina, close])

  // Al abrir, el foco entra en el menú; ↑↓ recorren, Inicio/Fin saltan. Sin
  // temporizador: el panel ya está en el DOM cuando corre el efecto, y un
  // setTimeout se comía la primera flecha de quien va rápido con el teclado.
  // Y también al CAMBIAR DE PÁGINA, que es lo mismo pero un nivel más abajo: si el
  // foco se quedara en la fila que acabas de pulsar, esa fila ya no existe.
  useEffect(() => {
    if (!open) return
    visibles(panelRef.current)[0]?.focus()
  }, [open, pagina])

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
          // ANCHO: el de SU BOTÓN en móvil, 320 en escritorio (Mario, ago 2026).
          // En el raíl de 256px el panel tiene que ser MÁS ancho que su disparador
          // o sus filas no caben; pero por debajo de `lg` el menú ocupa la pantalla
          // entera, así que ahí el disparador ya mide 375 y un panel de 320 se veía
          // más estrecho que la fila que lo abre, encajado y descentrado. `w-full`
          // lo pega a su botón, que es de donde parece salir.
          className="absolute bottom-full left-0 z-40 mb-1.5 max-h-[min(80vh,32rem)] w-full overflow-y-auto rounded-xl filo bg-white p-1.5 shadow-pop lg:w-[min(20rem,calc(100vw-2rem))]"
        >
          {pagina === 'equipos' ? (
            <>
              {/* LA PÁGINA DE EQUIPOS. Su fila de volver es la primera, y va con `‹`
                  porque el glifo dice hacia dónde: `›` es "aquí dentro hay más que
                  elegir" y `‹` es la vuelta. Dos glifos usados con criterio ahorran
                  tener que leer la fila para saber qué hace. */}
              <button data-mi role="menuitem" onClick={() => setPagina('raiz')} className={`${ITEM} font-medium text-slate-800`}>
                <Slot><ChevronLeft className="size-4 text-slate-400" aria-hidden /></Slot>
                Equipos
              </button>
              <Separator />
              {companies.map((c) => {
                const elegido = c.id === company?.id
                return (
                  <button
                    key={c.id}
                    data-mi
                    role="menuitemradio"
                    aria-checked={elegido}
                    onClick={() => {
                      close()
                      if (elegido) return
                      setActiveCompany(c.id)
                      navigate(base)
                    }}
                    className={ITEM}
                  >
                    <CompanyTile name={c.name} size={26} radius="rounded-md" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{c.name}</span>
                    {elegido && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
                  </button>
                )
              })}
            </>
          ) : (
            <>
              {/* DÓNDE ESTÁS, Y ES UN SELECTOR (Mario, ago 2026). Antes esto era un
                  bloque informativo y los equipos se listaban ENTEROS más abajo, con
                  su rótulo y una fila por empresa. Con tres o cuatro equipos, media
                  altura del menú se iba en una lista que solo se usa de vez en
                  cuando, empujando hacia abajo lo que sí se usa a diario.
                  Ahora la cabecera ES el control: dice en qué equipo estás y, si hay
                  más de uno, se pulsa y enseña la lista en la misma caja. Con un solo
                  equipo no hay nada que elegir y se queda como estaba, informativa:
                  un botón que no puede hacer nada es peor que ningún botón. */}
              {companies.length > 1 ? (
                <button
                  data-mi
                  role="menuitem"
                  onClick={() => setPagina('equipos')}
                  aria-label={`Equipo: ${empresa}. Cambiar de equipo`}
                  className="flex w-full flex-col items-center gap-1.5 rounded-lg px-3 pb-3 pt-3 transition-colors hover:bg-slate-100"
                >
                  <CompanyTile name={empresa} size={44} radius="rounded-xl" />
                  <span className="flex max-w-full items-center gap-1">
                    <span className="min-w-0 truncate text-[15px] font-semibold text-slate-900">{empresa}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                  </span>
                  <Procesos n={abiertos} />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-3 pb-3 pt-3">
                  <CompanyTile name={empresa} size={44} radius="rounded-xl" />
                  <p className="max-w-full truncate text-[15px] font-semibold text-slate-900">{empresa}</p>
                  <Procesos n={abiertos} />
                </div>
              )}

              <Separator />

              {/* UN SOLO GRUPO DE CUATRO, sin separador en medio (Mario, ago 2026).
                  La raya de antes partía "lo de la empresa" de "lo tuyo", y esa
                  frontera dejó de existir en cuanto Perfil bajó a ser una fila más:
                  las cuatro son sitios a los que vas desde aquí, y una raya que no
                  separa dos cosas distintas solo parte el menú en dos cajas. */}
              {/* TU PERFIL, y la fila dice TU NOMBRE, no la palabra "Perfil" (Mario,
                  ago 2026). Es la misma idea que gobierna la cabecera de este menú y
                  la del bloque de empresa del lateral: un nombre propio se escribe, no
                  se sustituye por la categoría a la que pertenece. Y aquí encima el
                  nombre hace un trabajo que la etiqueta no haría, que es decirte con
                  qué cuenta estás dentro.
                  Por eso lleva el LÁPIZ: siendo la única fila del grupo que no empieza
                  por un verbo, el glifo es lo que dice que se puede tocar. La cara va
                  de icono, en el mismo hueco de 26px que los demás. */}
              {!demo && (
                <button data-mi role="menuitem" onClick={() => { close(); onOpenProfile() }} className={ITEM}>
                  <Avatar name={nombre} seed={email || uid} src={foto} size={26} />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{nombre}</span>
                  {/* Sin nombre puesto, el menú lo dice una vez, sin insistir ni
                      bloquear. En tinta secundaria, NO en el acento: es un aviso, y el
                      acento aquí es solo acción, nav, foco y selección. */}
                  {sinNombre && <span className="shrink-0 text-[12px] text-slate-500">Sin nombre</span>}
                  <Pencil className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                </button>
              )}

              {!demo && isOwner && (
                <Link data-mi role="menuitem" to="/app/plan" onClick={() => { close(); onNavigate() }} className={ITEM}>
                  <Slot><FACTURACION_ICON className="size-4 text-slate-400" aria-hidden /></Slot>
                  <span className="flex-1">Facturación</span>
                </Link>
              )}

              {/* Solo aparece mientras quede guía por terminar, así que no está en el
                  orden fijo: se cuela junto a Ayuda porque son lo mismo, sitios donde
                  se va a preguntar cómo se hace algo. */}
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

              {demo && (
                <>
                  <Separator />
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
              )}
              {!demo && (
                <button data-mi role="menuitem" onClick={() => { close(); void signOut() }} className={ITEM}>
                  <Slot><LogOut className="size-4 text-slate-400" aria-hidden /></Slot>
                  Cerrar sesión
                </button>
              )}
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

/**
 * "N procesos abiertos". Se pinta en las dos caras de la cabecera (la que es
 * selector y la que no), así que se declara una vez.
 *
 * Se dice ABIERTOS y no "activos" a propósito, aunque sea una palabra más larga:
 * un proceso PAUSADO sigue abierto y sigue cobrándose, así que "activos"
 * insinuaría que los pausados no cuentan, que es justo el malentendido que la
 * doctrina de precios más se esfuerza en evitar. Es además la palabra que usa
 * Facturación, que es a donde lleva esta línea.
 */
function Procesos({ n }: { n: number }) {
  return (
    <span className="block text-[12px] text-slate-500">
      <span className="num">{n}</span> {n === 1 ? 'proceso abierto' : 'procesos abiertos'}
    </span>
  )
}

function Separator({ className = '' }: { className?: string }) {
  return <div className={`my-1 h-px bg-slate-200 ${className}`} role="separator" />
}

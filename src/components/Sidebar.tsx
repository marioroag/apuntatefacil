import { useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useAppBase } from '../lib/useAppBase'
import { useIsSupportStaff } from '../lib/useSupportStaff'
import { BRAND } from '../lib/brand'
import { MERIDIAN_CHAT_ENABLED, hasMeridian, candidateFit } from '../lib/meridian'
import { PUESTO_ICON, navGroups, type NavGroup, type NavItem } from '../lib/nav'
import { BTN_PRIMARY_LATERAL } from '../lib/buttons'
import { Logo } from './Logo'
import { Avisos } from './Avisos'
import { CuentaMenu } from './CuentaMenu'
import { Combinacion } from './ui/Tecla'
import { FILA, FILA_ACTIVA, FILA_QUIETA } from './filaLateral'

/**
 * EL MENÚ LATERAL (reskin ago 2026, identidad nueva de Figma).
 *
 * Es la ÚNICA capa de navegación del producto: la barra superior se retiró y sus
 * inquilinos bajaron aquí. De arriba abajo se lee como una sola columna: quién
 * eres como producto (la marca), cómo llegas a cualquier sitio (Vista general,
 * Buscar, Notificaciones), qué hay dentro de tu empresa (sus puestos y todo lo
 * que se hace con ellos) y, abajo del todo, la acción y tu cuenta.
 *
 * Superficie RECESIVA (`--color-lateral`, un paso por debajo del fondo de
 * trabajo): el lateral es el marco y el contenido es la mesa. Por eso no lleva
 * sombra ninguna, solo su filo.
 *
 * El lateral NO conoce ningún destino: pinta lo que declare `lib/nav.ts`. Añadir
 * una tab es una entrada en ese array, nunca UI nueva aquí. Lo único que este
 * fichero sabe de más son los PUESTOS, que son datos y no destinos, y las dos
 * capas que se abren en vez de navegar (Buscar y Notificaciones).
 */


/** Cabecera de bloque. La única del menú es el nombre de tu empresa: no hay
 *  "Candidatos" ni "Empresa" desde el reskin, porque con dos bloques el segundo
 *  se presenta solo diciendo de quién es.
 *
 *  En CAJA NORMAL y a 13px, no en versalita de 11px tracked. La versalita es el
 *  rótulo de una categoría ("CANDIDATOS"), y aquí no hay categoría: hay un
 *  nombre propio. "CONSTRUCCIONES TEIDE" en mayúsculas apretadas grita, se lee
 *  peor y encima le cambia el nombre a la empresa; la referencia de JOIN lo
 *  escribe tal cual y por eso su columna respira. El aire de arriba (24px) es lo
 *  que separa los dos bloques: sin él haría falta una raya. */
function BloqueLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="truncate px-3.5 pb-1 pt-6 text-[13px] font-medium text-slate-500">
      {children}
    </div>
  )
}

/**
 * "AQUÍ HAY ALGO NUEVO": un punto, no una cifra.
 *
 * El menú llegó a pintar nueve números a la vez (142, 96, 84, 158, 118, 88, 274,
 * 8 y 4) y ninguno cambiaba una decisión: abres el puesto igual con 142 que con
 * 158, y para saber cuál tiene más ya está Vista general, que los ordena. Lo que
 * de verdad se pregunta aquí es "¿dónde hay algo que no he mirado?", y a eso se
 * contesta con una marca, no con una cantidad. Además el 274 de Bandeja era la
 * SUMA de los seis de arriba: el número más grande de la pantalla era el mismo
 * dato otra vez.
 *
 * En TINTA, no en el acento ni en rojo, por el mismo motivo que el contador de
 * avisos: algo nuevo no es una acción (para eso está el acento) ni un error
 * (para eso está el rojo).
 *
 * El número no se pierde, cambia de canal: `label` lo lleva entero al lector de
 * pantalla ("142 candidaturas nuevas"), que es lo que la doctrina quiso decir con
 * "un contador se DICE, no se enseña". Quien no ve la pantalla se lleva MÁS
 * precisión que quien la ve, y está bien: ahí el número sí ahorra abrir.
 */
function Novedad({ label }: { label?: string }) {
  return (
    <span className="shrink-0">
      <span aria-hidden className="block size-1.5 rounded-full bg-slate-900" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

/** El icono de una fila. En `slate-700`, medio peldaño por debajo de su etiqueta
 *  y no dos: el icono tiene que sentarse por debajo del texto, pero en gris medio
 *  sobre blanco se apaga y la columna de iconos se vuelve una mancha.
 *
 *  `senal` pone el punto de "hay algo nuevo" EN el icono, arriba a la derecha, en
 *  vez de al final de la fila. Es para las filas que terminan en un control (hoy,
 *  el chevron de Puestos): ahí el punto cae pegado al chevron y se lee como si
 *  fuera parte de él, dos glifos pequeños discutiéndose el mismo sitio. Regla:
 *  **una fila que acaba en un control no pone su señal al lado de ese control.**
 *
 *  El aro es de los que van FUERA a propósito (la excepción declarada del
 *  `ring-inset`): es un halo, lo que separa el punto de los trazos del icono que
 *  tiene debajo, no el canto de un control. */
function FilaIcon({ Icon, activa, senal }: { Icon: LucideIcon; activa?: boolean; senal?: boolean }) {
  const glifo = <Icon className={`size-5 shrink-0 ${activa ? 'text-slate-900' : 'text-slate-700'}`} aria-hidden />
  if (!senal) return glifo
  return (
    <span className="relative shrink-0">
      {glifo}
      <span aria-hidden className="absolute -right-0.5 -top-0.5 block size-1.5 rounded-full bg-slate-900 ring-2 ring-[var(--color-lateral)]" />
    </span>
  )
}

function EnlaceFila({
  to,
  Icon,
  label,
  novedades = 0,
  novedadesLabel,
  onNavigate,
}: {
  to: string
  Icon: LucideIcon
  label: string
  novedades?: number
  novedadesLabel?: string
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `${FILA} ${isActive ? FILA_ACTIVA : FILA_QUIETA}`}
    >
      {({ isActive }) => (
        <>
          <FilaIcon Icon={Icon} activa={isActive} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {novedades > 0 && <Novedad label={novedadesLabel} />}
        </>
      )}
    </NavLink>
  )
}

/** Fila que abre una capa en vez de llevar a una ruta (hoy, Buscar). No es un
 *  enlace y no tiene estado activo: no es un sitio donde estás, es algo que
 *  haces.
 *
 *  El atajo solo se enseña al pasar por encima (y al llegar con el teclado, que
 *  es justo quien lo va a usar): un menú no es una chuleta, y una tecla impresa
 *  en cada fila compite con el nombre de la fila. Se oculta con `opacity` y no
 *  desmontándolo, para que el hueco esté reservado siempre y la etiqueta no dé
 *  un salto de ancho al aparecer. Solo en escritorio: en táctil no hay ni hover
 *  ni teclas. */
function BotonFila({ Icon, label, onClick, teclas }: { Icon: LucideIcon; label: string; onClick: () => void; teclas?: string[] }) {
  return (
    <button onClick={onClick} className={`${FILA} ${FILA_QUIETA} group`}>
      <FilaIcon Icon={Icon} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {teclas && (
        <Combinacion
          teclas={teclas}
          className="hidden shrink-0 opacity-0 transition-opacity duration-[var(--duration-control)] ease-[var(--ease-out)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none lg:inline-grid"
        />
      )}
    </button>
  )
}

/**
 * Los puestos: una fila plegable con la lista de verdad debajo.
 *
 * Es lo único del menú que son DATOS y no destinos declarados, y por eso lo pinta
 * este fichero y no el registro. Se pliega porque es la única lista que crece sin
 * techo, y plegarla es la respuesta a un cliente con cuarenta puestos: NO lleva
 * scroll propio. Se probó con `max-h` y dentro de una columna de 264px salían dos
 * barras de scroll pegadas, la del menú y la suya, que es peor problema que el que
 * resolvía. Una superficie, un scroll.
 *
 * Los hijos no llevan icono: el briefcase ya lo pone el padre, y repetirlo en
 * cada fila convierte la sangría en ruido. Su texto arranca a 48px, exactamente
 * donde arranca la etiqueta del padre.
 */
function Puestos({ onNavigate }: { onNavigate: () => void }) {
  const { campaigns, newSinceFor, loading } = useStore()
  const base = useAppBase()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(true)
  const listaId = useId()

  // Plegado, el padre HEREDA el "estás aquí" de su hijo. Sin esto, plegar la
  // lista estando dentro de un puesto dejaba el menú entero sin una sola fila
  // marcada: la app te decía que no estabas en ninguna parte. Desplegado no se
  // marca, porque entonces el sitio lo dice el hijo y marcar los dos sería decir
  // que estás en dos.
  const dentroDeUnPuesto = pathname.startsWith(`${base}/puestos/`)
  const heredaActivo = !abierto && dentroDeUnPuesto

  // Plegado, el padre también hereda la SEÑAL de sus hijos: si no, plegar la
  // lista escondería que hay candidaturas nuevas, que es justo lo que la señal
  // está ahí para no dejar que se pierda. Desplegado no la pinta, o el mismo
  // aviso se contaría dos veces.
  const nuevasDentro = loading ? 0 : campaigns.reduce((n, c) => n + newSinceFor(c.id), 0)
  const heredaSenal = !abierto && nuevasDentro > 0

  return (
    <div>
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={listaId}
        className={`${FILA} ${heredaActivo ? FILA_ACTIVA : FILA_QUIETA}`}
      >
        <FilaIcon Icon={PUESTO_ICON} activa={heredaActivo} senal={heredaSenal} />
        <span className="min-w-0 flex-1 truncate text-left">Puestos</span>
        {/* Sin cifra visible: desplegada la lista, el número está contando lo que
            tienes delante, y plegada no es un dato que se vaya a mirar (nadie
            abre el menú a ver cuántos puestos tiene). Se queda solo para quien no
            ve la lista, en el `sr-only` de abajo, que ahí sí informa. */}
        <ChevronDown
          className={`size-4 shrink-0 ${heredaActivo ? 'text-slate-900' : 'text-slate-600'} transition-transform duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${abierto ? '' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="sr-only">
          {campaigns.length === 1 ? '1 puesto' : `${campaigns.length} puestos`}
          {heredaSenal && `, ${nuevasDentro === 1 ? '1 candidatura nueva' : `${nuevasDentro} candidaturas nuevas`}`}
        </span>
      </button>

      {/* La lista NO va sangrada: la sangría la lleva cada fila, así el fondo del
          hijo ocupa exactamente el mismo ancho que el de la madre y las chapas de
          todo el menú caen en una sola vertical. Con la lista sangrada, los
          contadores de los puestos quedaban 6px a la izquierda de los demás y la
          columna se veía descosida. */}
      {/* Las hijas van MÁS JUNTAS entre sí que las madres (2px contra 6): son un
          grupo, y el hueco es lo que dice que van juntas. En la referencia pasa
          igual, 32px de paso contra los 40 del primer nivel. */}
      {abierto && (
        <ul id={listaId} className="space-y-0.5 pb-1 pt-1" aria-label="Puestos">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <li key={i} className="h-10 rounded-xl skeleton lg:h-[30px]" />)
          ) : campaigns.length === 0 ? (
            <li className="px-3.5 py-1.5 pl-12 text-[13px] leading-snug text-slate-500">
              Aún no tienes ningún puesto. Crea el primero y sus candidaturas entran aquí solas.
            </li>
          ) : (
            campaigns.map((c) => {
              const count = newSinceFor(c.id)
              // Un puesto que no está corriendo se APAGA, no se etiqueta. Llevaba
              // un "Pausado" escrito al lado, y en una fila que ya tiene nombre y
              // señal era la tercera cosa que leer, encima comiéndose el ancho del
              // título (era la única fila que se cortaba). Bajar la tinta lo dice
              // sin ocupar sitio: en una columna de nombres oscuros, el gris se lee
              // como "este no está en marcha".
              //
              // El texto NO se pierde, se muda al lector de pantalla: el color no
              // puede ser el único portador de un estado, y quien no ve la pantalla
              // se quedaría sin saberlo. `slate-500` y no `slate-400`: es el nombre
              // de un puesto, texto con significado, y el suelo es 4,5:1.
              const apagado = c.status !== 'activa'
              return (
                <li key={c.id}>
                  <NavLink
                    to={`${base}/puestos/${c.id}`}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex h-10 w-full items-center gap-2 rounded-xl pl-12 pr-3.5 text-sm outline-none lg:h-[30px] transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)] ${
                        isActive
                          ? FILA_ACTIVA
                          : apagado
                            ? 'font-medium text-slate-500 hover:bg-[var(--color-lateral-hover)] hover:text-slate-700'
                            : FILA_QUIETA
                      }`
                    }
                  >
                    {/* El nombre completo en `title` para quien usa ratón: los
                        títulos largos se siguen cortando. El lector de pantalla ya
                        lo lee entero (truncate es solo CSS). */}
                    <span className="min-w-0 flex-1 truncate" title={c.title}>{c.title}</span>
                    {apagado && <span className="sr-only">({c.status === 'pausada' ? 'pausado' : 'cerrado'})</span>}
                    {count > 0 && <Novedad label={count === 1 ? '1 candidatura nueva' : `${count} candidaturas nuevas`} />}
                  </NavLink>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

export function Sidebar({
  onNavigate,
  onNewCampaign,
  onBuscar,
  onOpenSupport,
  onOpenProfile,
  onOpenOnboarding,
  onboardingPaso,
  onReiniciarDemo,
}: {
  /** Cierra el cajón móvil al ir a cualquier sitio. En escritorio, un no-op. */
  onNavigate: () => void
  onNewCampaign: () => void
  onBuscar: () => void
  onOpenSupport: () => void
  onOpenProfile: () => void
  onOpenOnboarding: () => void
  /** Paso actual de la guía (2..4, como su propia etiqueta), o null si no procede. */
  onboardingPaso: number | null
  /** Solo en la demo: recarga los datos de ejemplo (pide confirmación). */
  onReiniciarDemo: () => void
}) {
  const { campaigns, candidates, newCountFor, boardNewCount } = useStore()
  const { company, role } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'
  const isStaff = useIsSupportStaff()

  const totalNuevos = campaigns.reduce((s, c) => s + newCountFor(c.id), 0)
  // Meridian: candidaturas nuevas que destaca (encajan bien) y no has revisado.
  // Apagado mientras el hilo esté fuera (MERIDIAN_CHAT_ENABLED); el triaje sigue
  // vivo en cada candidatura.
  const meridianDestacados =
    MERIDIAN_CHAT_ENABLED && hasMeridian(company?.plan)
      ? candidates.filter((c) => c.status === 'nuevo' && (candidateFit(c.ai) ?? -1) >= 70).length
      : 0

  const grupos = navGroups({
    plan: company?.plan,
    empresa: company?.name ?? '',
    isStaff,
    demo,
    counts: {
      bandeja: totalNuevos,
      equipo: boardNewCount,
      meridian: meridianDestacados,
    },
  })

  // Crear puestos: el encargado ve sus datos (acotados por RLS) pero no gestiona
  // estructura. El límite de plan NO se descubre aquí, se descubre al crear.
  const canCreate = role !== 'encargado'

  const pintarItem = (it: NavItem) => {
    // Notificaciones se pinta sola: el timbre sabe su propio contador y si la
    // empresa tiene con quién generarlo (sin equipo no hay avisos posibles y no
    // se pinta nada). Pasarle el número por el registro sería llevar la misma
    // cuenta en dos sitios.
    if (it.capa === 'avisos') return <Avisos key={it.id} label={it.label} />
    if (it.capa === 'buscar') return <BotonFila key={it.id} Icon={it.Icon} label={it.label} onClick={onBuscar} teclas={['⌘', 'K']} />
    return (
      <EnlaceFila
        key={it.id}
        to={`${base}${it.to}`}
        Icon={it.Icon}
        label={it.label}
        novedades={it.novedades}
        novedadesLabel={it.novedades && it.novedadesLabel ? it.novedadesLabel(it.novedades) : undefined}
        onNavigate={onNavigate}
      />
    )
  }

  const pintarGrupo = (g: NavGroup) => {
    return (
      <div key={g.id}>
        {g.label && <BloqueLabel>{g.label}</BloqueLabel>}
        {/* 6px de hueco, no 2: junto con la píldora de 34 da el paso de 40 de la
            referencia. Es la mitad de la regla; la otra mitad es que la píldora
            encogió (ver `filaLateral.ts`). */}
        <div className="space-y-1.5">
          {g.conPuestos && <Puestos onNavigate={onNavigate} />}
          {g.items.map(pintarItem)}
        </div>
      </div>
    )
  }

  return (
    <nav
      className="flex h-full flex-col bg-[var(--color-lateral)]"
      aria-label="Menú principal"
    >
      {/* La marca vuelve al producto (reskin ago 2026). Estuvo fuera del shell a
          propósito ("dentro de tu casa no hace falta la valla") mientras la
          esquina superior izquierda era la empresa; retirada la barra, la empresa
          pasó a ser la cabecera de su propio bloque y este sitio se quedó libre.
          La baldosa es de tinta y el monograma va en su versión oscura. */}
      <Link
        to={base}
        onClick={onNavigate}
        // `hidden lg:flex`, y no es una decisión de estilo: por debajo de lg este
        // mismo menú vive dentro del cajón, y encima del cajón está la barrita
        // que ya lleva la marca. Sin esto salía dos veces, una debajo de la otra.
        // Como el aside solo existe a partir de lg y el cajón solo por debajo, la
        // media query los reparte sin que ninguno tenga que saber del otro.
        className="hidden shrink-0 items-center gap-2.5 rounded-xl px-[18px] pb-7 pt-[22px] outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 lg:flex"
      >
        <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-slate-900">
          <Logo className="size-[18px]" tone="oscuro" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.02em] text-slate-900">
          {BRAND}
        </span>
      </Link>

      {/* Lo que crece va aquí en medio y se desplaza; la marca y el pie se quedan
          quietos. Sin esto, un cliente con muchos puestos empujaba "Crear puesto"
          fuera de la pantalla, que es justo la acción que nunca puede perderse. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-4 pt-4 lg:pt-0">
        {grupos.map(pintarGrupo)}
      </div>

      {/* Sin raya sobre el pie: lo que separa el pie del menú es el hueco que
          deja la zona elástica, no una línea. Con la raya puesta, el lateral se
          leía partido en dos cajas; JOIN tampoco la tiene y por eso su pie se ve
          apoyado en vez de encerrado. */}
      <div className="shrink-0 px-2.5 pb-3 pt-2">
        {/* SIN icono, y no es por quitar adornos: con el "+" delante, lo que se
            centra es el grupo icono+texto, así que el RÓTULO queda 12px a la
            derecha del centro del botón (medido). El ojo centra el texto, no el
            grupo, y ese descuadre es exactamente lo que se lee como "hecho a
            ojo". Un CTA a ancho completo con la etiqueta centrada tampoco
            necesita el icono: "Crear puesto" ya dice lo que hace. Un icono junto
            al texto vale cuando el botón es estrecho y la etiqueta va a la
            izquierda, no aquí. */}
        {canCreate && (
          <button onClick={onNewCampaign} className={BTN_PRIMARY_LATERAL}>
            Crear puesto
          </button>
        )}
        {/* 16px de aire, no 6: el botón es una ACCIÓN y la fila de abajo es
            QUIÉN ERES, y pegados se leen como un solo bloque de mandos. Es la
            diferencia más grande del pie contra la referencia. */}
        <div className={canCreate ? 'pt-4' : undefined}>
        <CuentaMenu
          onNavigate={onNavigate}
          onOpenSupport={onOpenSupport}
          onOpenProfile={onOpenProfile}
          onOpenOnboarding={onboardingPaso !== null ? onOpenOnboarding : undefined}
          onboardingPaso={onboardingPaso}
          onReiniciarDemo={onReiniciarDemo}
        />
        </div>
      </div>
    </nav>
  )
}

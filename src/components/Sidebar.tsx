import { useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useAppBase } from '../lib/useAppBase'
import { useIsSupportStaff } from '../lib/useSupportStaff'
import { PUESTO_ICON, cifraCorta, contarNuevas, contarPuestos, navGroups, type NavGroup, type NavItem } from '../lib/nav'
import { BTN_PRIMARY_LATERAL } from '../lib/buttons'
import { Logo } from './Logo'
import { Avisos } from './Avisos'
import { CuentaMenu } from './CuentaMenu'
import { Combinacion } from './ui/Tecla'
import { FILA, FILA_ACTIVA, FILA_CAJA, FILA_CHEVRON, FILA_ENLACE, FILA_ETIQUETA, FILA_ETIQUETA_CENTRADA, FILA_HIJA, FILA_QUIETA, FILA_SOLO_ANCHO, FILA_SOLO_ESTRECHO, FILA_SUBLISTA, CTA_LATERAL_CONTRAIDO, ZONA_LATERAL, ZONA_MARCA } from './filaLateral'

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


/**
 * EN QUÉ ESTADO ESTÁ EL RAÍL, en una sola pieza y no en dos booleanos sueltos.
 *
 *  - `ancho`: el menú de siempre, 256px, empujando al trabajo.
 *  - `estrecho`: fijado a 64px, solo iconos.
 *  - `asomado`: fijado estrecho, pero el ratón (o el foco) está encima y se ha
 *    abierto un momento POR ENCIMA del trabajo, sin moverlo.
 *
 * Son tres y no dos porque `asomado` no es ni lo uno ni lo otro: se ve como
 * `ancho` pero el botón de la cabecera hace lo contrario que en `ancho` (deja el
 * menú abierto en vez de cerrarlo). Con dos booleanos (`contraido` +
 * `fijadoEstrecho`) existiría además una cuarta combinación que no significa
 * nada, y este proyecto ya sabe cómo acaban dos listas para la misma verdad.
 *
 * En el cajón de móvil es SIEMPRE `ancho`: allí el menú ocupa la pantalla entera
 * y estrecharlo no ahorraría nada.
 */
export type EstadoRail = 'ancho' | 'estrecho' | 'asomado'

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
    <div className="truncate px-3.5 pb-1 pt-6 text-sm font-medium text-slate-600">
      {children}
    </div>
  )
}

/**
 * CUÁNTAS COSAS NUEVAS HAY: la CIFRA, pelada, al final de la fila.
 *
 * Ha dado tres vueltas y conviene tener las tres a la vista, porque la de ahora
 * no es "volver atrás", es quedarse con lo bueno de cada una:
 *
 *  1. Una CHAPA con el número (fondo gris, negrita). Se retiró porque el menú
 *     llegó a pintar nueve a la vez y la columna se leía como un tablero de
 *     resultados, robándole el sitio a lo único que se lee ahí, que son los
 *     nombres.
 *  2. Un PUNTO, con el número mudado al `sr-only`. Arreglaba el ruido y perdía el
 *     dato: la marca contesta "¿hay algo?" pero no "¿cuánto?", y en una lista de
 *     puestos eso es justo lo que decide por cuál empiezas.
 *  3. La CIFRA SIN CHAPA (Mario, ago 2026, con una referencia delante). Devuelve
 *     el dato sin devolver el ruido, porque **lo que hacía tablero no era el
 *     número, era la chapa**: un relleno, un radio y una negrita repetidos nueve
 *     veces. Un número gris alineado a la derecha se lee como un dato al margen,
 *     que es lo que es.
 *
 * Va APAGADA (`slate-500`, 4,8:1) y un punto por debajo de su etiqueta (14 contra
 * 15): la doctrina ya decía que **si hay una chapa por fila, la chapa va
 * apagada**; la negrita es para cuando hay UNA. Y `num` (cifras tabulares) porque
 * viven en columna: sin ellas, el 1 es estrecho y el 8 ancho, la columna queda
 * dentada y un contador que pasa de 9 a 10 empuja lo que tiene al lado.
 *
 * CON TOPE EN 15 (`cifraCorta`, en `lib/nav.ts`), y el tope no es de ancho sino
 * de significado: por debajo el número cambia lo que haces (84 y 158 te dicen por
 * qué puesto empezar) y por encima todos dicen lo mismo, "aquí hay mucho".
 *
 * El número visible va `aria-hidden` y la frase entera en `sr-only`, o el lector
 * diría "Puestos 142 142 candidaturas nuevas". Quien no ve la pantalla se sigue
 * llevando la frase completa; quien la ve, la cifra.
 *
 * CON EL RAÍL ESTRECHO no hay sitio para una cifra, así que la señal vuelve a ser
 * el PUNTO, y montado EN el icono (ver `FilaIcon`). No son dos lenguajes: es el
 * mismo dato en el único canal que cabe en 64px.
 */
function Novedad({ n, label, className = '' }: { n: number; label?: string; className?: string }) {
  return (
    <span className={`shrink-0 ${className}`}>
      <span aria-hidden className="num text-sm font-medium text-slate-500">
        {cifraCorta(n)}
      </span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

/** El icono de una fila. En `slate-800`, medio peldaño por debajo de su etiqueta
 *  (`slate-900`) y no dos: el icono tiene que sentarse por debajo del texto, pero
 *  en gris medio sobre blanco se apaga y la columna de iconos se vuelve una
 *  mancha. Subió de 700 a 800 en ago 2026 con las etiquetas (10,4:1 -> 14,7:1);
 *  el porqué de la pareja está en `filaLateral.ts`.
 *
 *  MIDE 18 Y NO 20 desde ago 2026: en la referencia que trajo Mario el icono pesa
 *  0,94 veces la altura de mayúscula de su etiqueta y el nuestro pesaba 1,98, o
 *  sea el doble. Un menú se lee por los NOMBRES. La cuenta está en `filaLateral.ts`.
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
  const glifo = <Icon className={`size-[18px] shrink-0 ${activa ? 'text-slate-900' : 'text-slate-800'}`} aria-hidden />
  if (!senal) return glifo
  return (
    <span className="relative shrink-0">
      {glifo}
      <span aria-hidden className="absolute -right-0.5 -top-0.5 block size-1.5 rounded-full bg-[var(--color-novedad)] ring-2 ring-[var(--color-lateral)]" />
    </span>
  )
}

/**
 * CONTRAER EL RAÍL, Y DECIR EN QUÉ ESTADO ESTÁ.
 *
 * Vive al final de la fila de marca, que es donde lo pone la referencia que dio
 * Mario y donde se busca: el control que gobierna el raíl entero corona el raíl.
 *
 * CON EL RAÍL ESTRECHO NO SE VE (Mario, ago 2026: "el botón de colapsar no
 * debería estar cuando está colapsado; para descolapsar se pasa por encima, y si
 * quieres que se quede así le das otra vez al botón"). Y no hace falta esconderlo
 * a mano: la fila de marca recorta lo que no cabe, así que a 64px se queda fuera
 * y al ensancharse vuelve a entrar deslizándose.
 *
 * DOS GLIFOS, NO UNO (Mario, ago 2026: "el icono debería mostrar el estado").
 * Estuvo con un `PanelLeft` a secas y el argumento era que contraído el botón no
 * existe, así que nunca tiene que decir "abrir". El argumento se cae por el
 * ASOMARSE: con el raíl fijado estrecho y el ratón encima, el botón SÍ se ve, y
 * ahí pulsarlo hace lo contrario, dejarlo abierto. O sea que el mismo dibujo
 * hacía dos cosas distintas y encima con una etiqueta fija que mentía en uno de
 * los dos casos. Ahora la flecha del panel apunta hacia donde va a moverse el
 * raíl, que es el mismo criterio que el `Menu`/`X` de la barrita de móvil.
 *
 * Y LA ETIQUETA CAMBIA CON ÉL. Asomado no dice "Desplegar", que describiría algo
 * que ya está pasando delante de tus ojos: dice **"Mantener el menú abierto"**,
 * que es lo que de verdad hace el clic. Es la regla de siempre, un control dice
 * lo que va a pasar y no cómo se llama por dentro.
 */
function BotonContraer({ rail, onClick }: { rail: EstadoRail; onClick: () => void }) {
  const vaADejarloAbierto = rail === 'asomado'
  const Icono = vaADejarloAbierto ? PanelLeftOpen : PanelLeftClose
  // Recortado fuera de la fila cuando el raíl está estrecho de verdad: no se ve y
  // no se puede pulsar, así que también sale del tabulador y del lector. No se
  // DESMONTA, que cambiaría el ancho del contenido de golpe y movería al monograma.
  const oculto = rail === 'estrecho'
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={oculto ? -1 : undefined}
      aria-hidden={oculto || undefined}
      aria-label={vaADejarloAbierto ? 'Mantener el menú abierto' : 'Contraer el menú'}
      className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-700 outline-none transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] hover:bg-[var(--color-lateral-hover)] hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)]"
    >
      <Icono className="size-[18px]" aria-hidden />
    </button>
  )
}

/**
 * EL PLIEGUE DE UNA SUBLISTA.
 *
 * La lista NO se monta y se desmonta, se pliega: con el raíl estrechándose (o con
 * el ratón entrando y saliendo de él), quitarla del DOM haría que todo lo de
 * debajo pegara un salto de 200px en el fotograma 0, que es exactamente el tirón
 * que esta versión del lateral vino a quitar. Plegada sigue ahí, con alto cero.
 *
 * La altura se anima con `grid-template-rows: 1fr -> 0fr` y NO con `max-height`,
 * por lo mismo que el informe de Meridian: un techo inventado o corta la lista o
 * deja el final del recorrido vacío, y aquí el alto depende de cuántos puestos
 * tenga cada empresa. Con el grid, el recorrido es siempre el alto real.
 *
 * `inert` mientras está plegada: sin él, los seis puestos seguirían en el
 * tabulador y en el lector de pantalla detrás de una lista que no se ve. Es la
 * misma pareja (sigue en el DOM + inert) que ya usa el informe de Meridian.
 */
function Pliegue({ abierto, children }: { abierto: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-[var(--duration-max)] ease-[var(--ease-standard)] motion-reduce:transition-none ${
        abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      {/* `min-h-0` no es decorativo: un elemento de rejilla trae `min-height:
          auto`, así que la pista de `0fr` NO puede encoger por debajo del alto del
          contenido y la lista se quedaba entera a la vista. Se midió: 30px por
          fila con el pliegue "cerrado". */}
      <div className="min-h-0 overflow-hidden" inert={!abierto || undefined}>
        {children}
      </div>
    </div>
  )
}

function EnlaceFila({
  to,
  Icon,
  label,
  novedades = 0,
  novedadesLabel,
  contraido,
  onNavigate,
}: {
  to: string
  Icon: LucideIcon
  label: string
  novedades?: number
  novedadesLabel?: string
  contraido: boolean
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
            {/* Contraído, la señal se muda AL ICONO. No es un caso nuevo: es la
                regla que ya se escribió para "Puestos", **una fila que acaba en un
                control no pone su señal al lado de ese control**, con el raíl
                estrecho aplicada a todas, porque ahí la fila ENTERA es el icono y
                no hay ningún "final de fila" donde poner nada. */}
            <FilaIcon Icon={Icon} activa={isActive} senal={contraido && novedades > 0} />
            <span className={FILA_ETIQUETA}>{label}</span>
            {novedades > 0 && <Novedad n={novedades} label={novedadesLabel} className={FILA_SOLO_ANCHO} />}
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
      <span className={FILA_ETIQUETA}>{label}</span>
      {/* `pointer-coarse:hidden` y no `hidden lg:inline-grid`, que es lo que ponía
          y NO escondía nada: `hidden` y el `inline-grid` que `Tecla` trae en su
          clase base son la misma utilidad, así que gana la que se emita después en
          el CSS y no la que se escriba al final del `className`. Contra una
          utilidad base solo puede una VARIANTE. Se notó al contraer el raíl, donde
          la tecla (39px) se salía de una fila de 34; hasta entonces la tapaba el
          `opacity-0`, que en táctil no se levanta nunca porque no hay hover.
          Y la pregunta correcta es por el PUNTERO y no por el ancho: un portátil
          de 900px tiene teclado y el atajo funciona; un teléfono no. */}
      {teclas && (
        <Combinacion
          teclas={teclas}
          className="shrink-0 opacity-0 transition-opacity duration-[var(--duration-control)] ease-[var(--ease-out)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:hidden"
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
function Puestos({
  abierto,
  contraido,
  onToggle,
  onNavigate,
}: {
  abierto: boolean
  contraido: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const { campaigns, newSinceFor, loading } = useStore()
  const base = useAppBase()
  const { pathname } = useLocation()
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
  // Contraído no hay lista, así que la madre lleva siempre la señal y el "estás
  // aquí" de sus hijos: es lo único que queda de ellos en pantalla.
  const heredaSenal = (!abierto || contraido) && nuevasDentro > 0

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={abierto && !contraido}
        aria-controls={listaId}
        className={`${FILA} ${heredaActivo ? FILA_ACTIVA : FILA_QUIETA}`}
      >
        <FilaIcon Icon={PUESTO_ICON} activa={heredaActivo} senal={contraido && heredaSenal} />
        <span className={FILA_ETIQUETA}>Puestos</span>
        {/* Plegada, la madre lleva la CIFRA de sus hijas: es lo que impide que
            plegar la lista esconda cuánto hay esperando. Va antes del chevron, y
            no pasa nada porque sea un número pegado a un control: la regla de "una
            fila que acaba en un control no pone su señal al lado" se escribió para
            un PUNTO, que es un glifo pequeño y se leía como parte del chevron. Una
            cifra es texto y se distingue sola. */}
        {heredaSenal && <Novedad n={nuevasDentro} className={FILA_SOLO_ANCHO} />}
        {/* Sin cifra visible: desplegada la lista, el número está contando lo que
            tienes delante, y plegada no es un dato que se vaya a mirar (nadie
            abre el menú a ver cuántos puestos tiene). Se queda solo para quien no
            ve la lista, en el `sr-only` de abajo, que ahí sí informa. */}
        <ChevronDown
          className={`size-4 shrink-0 ${FILA_SOLO_ANCHO} ${heredaActivo ? 'text-slate-900' : 'text-slate-700'} transition-transform duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${abierto ? '' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="sr-only">
          {contarPuestos(campaigns.length)}
          {heredaSenal && `, ${contarNuevas(nuevasDentro)}`}
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
      {/* Con el raíl estrecho la lista se PLIEGA, no desaparece: ver `Pliegue`. En
          64px sus filas no dirían nada (no tienen icono propio, el maletín es de
          la madre) y además ocuparían el alto de seis puestos. Basta con pasar el
          ratón por encima para que el raíl se abra y vuelvan. */}
      <Pliegue abierto={abierto && !contraido}>
        <ul id={listaId} className={FILA_SUBLISTA} aria-label="Puestos">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <li key={i} className="h-10 rounded-xl skeleton lg:h-8" />)
          ) : campaigns.length === 0 ? (
            <li className="py-1.5 pl-3 pr-3.5 text-sm leading-snug text-slate-600">
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
                      `${FILA_HIJA} ${
                        isActive
                          ? FILA_ACTIVA
                          : apagado
                            ? 'text-slate-600 hover:bg-[var(--color-lateral-hover)] hover:text-slate-800'
                            : FILA_QUIETA
                      }`
                    }
                  >
                    {/* El nombre completo en `title` para quien usa ratón: los
                        títulos largos se siguen cortando. El lector de pantalla ya
                        lo lee entero (truncate es solo CSS). */}
                    <span className="min-w-0 flex-1 truncate" title={c.title}>{c.title}</span>
                    {apagado && <span className="sr-only">({c.status === 'pausada' ? 'pausado' : 'cerrado'})</span>}
                    {count > 0 && <Novedad n={count} label={contarNuevas(count)} />}
                  </NavLink>
                </li>
              )
            })
          )}
        </ul>
      </Pliegue>
    </div>
  )
}

/**
 * UNA FILA CON CORTES DEBAJO (hoy, Candidatos y sus tres vistas).
 *
 * Es la segunda plegable del menú y NO se comporta como "Puestos", a propósito:
 * aquí la etiqueta LLEVA a un sitio (Activos, el corte principal) y el chevron
 * PLIEGA, mientras que en Puestos pliega la fila entera. La diferencia no es un
 * capricho de esta pantalla, es la regla: **una fila plegable navega si tiene
 * adónde ir**, y no existe ninguna pantalla de "todos los puestos". Con una sola
 * zona pulsable que hiciera las dos cosas habría que adivinar cuál pasa al
 * pulsar; y sin chevron no habría forma de volver a plegar la lista.
 *
 * El contenido de los hijos NO se sabe aquí: sale del registro (`nav.ts`, que a
 * su vez lo saca de `lib/candidatos.ts`). Esta pieza solo sabe pintar "una fila
 * con hijos", así que la siguiente que los tenga no cuesta UI nueva.
 *
 * Es un `<Link>` y no un `<NavLink>` a propósito. El "estás aquí" de la madre
 * tiene una regla propia (solo cuando está PLEGADA, heredado de su hija) y
 * `NavLink` pone su `aria-current` por su cuenta, sin dejar quitarlo: en la ruta
 * de Activos lo habrían llevado la madre Y la hija a la vez, o sea el mismo
 * "estás en esta página" dicho dos veces a quien usa lector de pantalla. Es el
 * mismo problema que la doctrina ya resolvió en lo visual ("desplegado no se
 * marca el padre"), una capa más abajo.
 */
function FilaConHijos({
  it,
  base,
  abierto,
  contraido,
  cajon,
  onToggle,
  onAbrir,
  onNavigate,
}: {
  it: NavItem
  base: string
  abierto: boolean
  contraido: boolean
  /**
   * Este menú es el CAJÓN de móvil, no el raíl de escritorio. Cambia lo que hace
   * la etiqueta: ver abajo.
   */
  cajon: boolean
  onToggle: () => void
  /** Ir a la fila ABRE su lista: llegas al corte principal y ves los otros dos. */
  onAbrir: () => void
  onNavigate: () => void
}) {
  const { pathname } = useLocation()
  const listaId = useId()
  const hijos = it.hijos ?? []

  // Plegada, la madre HEREDA el "estás aquí" de su hija. Sin esto, plegar la
  // lista estando en Contratados dejaba el menú entero sin una sola fila marcada:
  // la app te decía que no estabas en ninguna parte. Desplegada no se marca,
  // porque entonces el sitio lo dice la hija y marcar las dos sería decir que
  // estás en dos.
  const dentro = hijos.some((h) => pathname === `${base}${h.to}`)
  // Contraída no hay hijas que marquen nada, así que la madre lleva siempre lo
  // suyo: el "estás aquí" y la señal.
  const heredaActivo = (!abierto || contraido) && dentro

  // Y hereda la SEÑAL por el mismo motivo: plegar la lista no puede esconder que
  // hay candidaturas nuevas. Desplegada la lleva la hija a la que hay que ir
  // (Activos), o el mismo aviso se contaría dos veces.
  const heredaSenal = (!abierto || contraido) && (it.novedades ?? 0) > 0

  // EN EL CAJÓN DE MÓVIL LA FILA NO NAVEGA, PLIEGA (Mario, ago 2026: "el
  // comportamiento de que al entrar a Candidatos entre solo en Activos hay que
  // cancelarlo en móvil").
  //
  // La regla de esta pieza sigue siendo la misma, lo que cambia es una de sus
  // premisas. "Una fila plegable navega si tiene adónde ir" se escribió con el
  // raíl de escritorio delante, donde la lista queda A LA VISTA junto al
  // contenido: pulsas Candidatos, aterrizas en Activos y ves los otros tres
  // cortes. En el cajón el menú OCUPA LA PANTALLA ENTERA y navegar lo cierra, así
  // que la etiqueta te llevaba a Activos sin que llegaras a ver que había cortes:
  // el desplegable existía y no se podía usar. Ahí la fila no tiene adónde ir sin
  // destruir lo que estabas mirando, y por la misma regla pliega entera, como
  // Puestos.
  //
  // Se paga un toque de más para llegar a Activos, y se cobra lo que ese toque
  // compra: ver los cuatro cortes, que es de lo que va la fila.
  if (cajon) {
    return (
      <div>
        <button
          onClick={onToggle}
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-current={heredaActivo ? 'page' : undefined}
          className={`${FILA} ${heredaActivo ? FILA_ACTIVA : FILA_QUIETA}`}
        >
          <FilaIcon Icon={it.Icon} activa={heredaActivo} />
          <span className={FILA_ETIQUETA}>{it.label}</span>
          {heredaSenal && <Novedad n={it.novedades!} />}
          <ChevronDown
            className={`size-4 shrink-0 ${heredaActivo ? 'text-slate-900' : 'text-slate-700'} transition-transform duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${abierto ? '' : '-rotate-90'}`}
            aria-hidden
          />
          {heredaSenal && it.novedadesLabel && (
            <span className="sr-only">, {it.novedadesLabel(it.novedades!)}</span>
          )}
        </button>

        <Pliegue abierto={abierto}>
          <ul id={listaId} className={FILA_SUBLISTA} aria-label={it.label}>
            {hijos.map((h) => (
              <li key={h.id}>
                <NavLink
                  to={`${base}${h.to}`}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) => `${FILA_HIJA} ${isActive ? FILA_ACTIVA : FILA_QUIETA}`}
                >
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {(h.novedades ?? 0) > 0 && <Novedad n={h.novedades!} label={h.novedadesLabel?.(h.novedades!)} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </Pliegue>
      </div>
    )
  }

  return (
    <div>
      <div className={`${FILA_CAJA} ${heredaActivo ? FILA_ACTIVA : FILA_QUIETA}`}>
        <Link
          to={`${base}${it.to}`}
          onClick={() => { onAbrir(); onNavigate() }}
          aria-current={heredaActivo ? 'page' : undefined}
          className={FILA_ENLACE}
        >
          <FilaIcon Icon={it.Icon} activa={heredaActivo} senal={contraido && heredaSenal} />
          <span className={FILA_ETIQUETA}>{it.label}</span>
          {heredaSenal && <Novedad n={it.novedades!} className={FILA_SOLO_ANCHO} />}
          {/* El punto que pinta `FilaIcon` es `aria-hidden`: es una marca, no un
              texto. Cuando la madre lo HEREDA, la cuenta entera tiene que decirse
              aquí o no se dice en ninguna parte, porque las hijas (que la llevan
              desplegadas) ya no están en el DOM. Es el mismo agujero que dejó a la
              Bandeja leyéndose "candidaturas nuevas" sin cifra, y por eso "Puestos"
              lo resuelve igual, con un `sr-only` en su propia fila. */}
          {heredaSenal && it.novedadesLabel && (
            <span className="sr-only">, {it.novedadesLabel(it.novedades!)}</span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          // Con el raíl estrecho el chevron está recortado (no se ve y no se
          // puede pulsar), así que también sale del tabulador y del lector: un
          // control invisible que responde al Intro es peor que ninguno. No se
          // DESMONTA, que cambiaría el ancho del contenido de golpe.
          tabIndex={contraido ? -1 : undefined}
          aria-hidden={contraido || undefined}
          aria-expanded={abierto && !contraido}
          aria-controls={listaId}
          // La etiqueta dice qué pliega, no solo que pliega: en una lista de
          // filas, "Desplegar" a secas obliga a recordar sobre cuál estabas.
          aria-label={`${abierto ? 'Plegar' : 'Desplegar'} las vistas de ${it.label.toLowerCase()}`}
          className={`${FILA_CHEVRON} ${FILA_SOLO_ANCHO}`}
        >
          <ChevronDown
            className={`size-4 shrink-0 ${heredaActivo ? 'text-slate-900' : 'text-slate-700'} transition-transform duration-[var(--duration-control)] ease-[var(--ease-out)] motion-reduce:transition-none ${abierto ? '' : '-rotate-90'}`}
            aria-hidden
          />
        </button>
      </div>

      <Pliegue abierto={abierto && !contraido}>
        <ul id={listaId} className={FILA_SUBLISTA} aria-label={it.label}>
          {hijos.map((h) => {
            const n = h.novedades ?? 0
            return (
              <li key={h.id}>
                {/* `end`: sin él, "/candidatos" se daría por activo estando en
                    "/candidatos/todos", y se marcarían dos vistas a la vez. */}
                <NavLink
                  to={`${base}${h.to}`}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) => `${FILA_HIJA} ${isActive ? FILA_ACTIVA : FILA_QUIETA}`}
                >
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {n > 0 && <Novedad n={n} label={h.novedadesLabel?.(n)} />}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </Pliegue>
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
  rail = 'ancho',
  cajon = false,
  onAlternarContraido,
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
  /**
   * En qué estado está el raíl. Lo decide el SHELL y no lo pregunta este
   * componente, porque quien monta las dos superficies (el raíl de escritorio y
   * el cajón de móvil) es quien sabe cuál es cuál.
   */
  rail?: EstadoRail
  /**
   * Este menú es el CAJÓN de móvil y no el raíl de escritorio. Lo dice el shell,
   * que es quien monta las dos superficies; el componente no lo pregunta con una
   * media query porque no es una cuestión de ANCHO sino de qué superficie es: lo
   * que cambia es que aquí navegar CIERRA el menú, y eso vale igual en un móvil
   * de 375 que en un portátil de 900.
   */
  cajon?: boolean
  onAlternarContraido?: () => void
}) {
  // Lo que le importa a cada fila es solo si se ve estrecha; `asomado` se pinta
  // igual que `ancho` y solo cambia lo que hace el botón de la cabecera.
  const contraido = rail === 'estrecho'
  const { candidatosNewCount, boardNewCount } = useStore()
  const { company, role } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'
  const isStaff = useIsSupportStaff()

  const { pathname } = useLocation()

  const grupos = navGroups({
    plan: company?.plan,
    empresa: company?.name ?? '',
    isStaff,
    demo,
    counts: {
      // `candidatosNewCount` y NO la suma de `newCountFor`, que era "cuántos están
      // en estado nuevo": eso no se apaga mirando, se apaga triando, así que el
      // punto se quedaba encendido para siempre y una señal que no se apaga es lo
      // mismo que ninguna señal. Encima el menú contestaba la misma pregunta de
      // dos maneras, porque las filas de los puestos ya usaban "desde la última
      // vez". Ahora las dos dicen lo mismo. El porqué, en `store.tsx`.
      nuevos: candidatosNewCount,
      equipo: boardNewCount,
    },
  })

  /**
   * UN SOLO DESPLEGABLE ABIERTO (Mario, ago 2026).
   *
   * El estado vive aquí y no dentro de cada plegable, que es lo que hace que sean
   * excluyentes: con un `useState` por pieza no hay forma de que una sepa de la
   * otra sin inventar un canal entre hermanas. Uno solo y el que gana es el
   * último que abres.
   *
   * Y NO ES SOLO ORDEN: con las dos listas abiertas, "Ajustes" caía por debajo
   * del pliegue en una pantalla de portátil, o sea que la única forma de llegar a
   * él era desplazar un menú que parecía completo. Abriendo de una en una, el
   * bloque entero cabe.
   *
   * Cuál arranca abierto lo decide LA RUTA, no un valor fijo: si entras estando
   * dentro de un puesto se abre Puestos, y si entras por una vista de candidatos
   * se abre Candidatos. Con un fijo, la mitad de las veces el menú arrancaba
   * enseñando la lista que no estabas usando. Es un inicializador perezoso, así
   * que decide al montar y luego manda lo que pulses: navegar después no te
   * reabre nada por su cuenta, salvo pulsar la fila madre, que para eso está.
   */
  const [abierto, setAbierto] = useState<string | null>(() => {
    if (pathname.startsWith(`${base}/puestos/`)) return 'puestos'
    for (const g of grupos)
      for (const it of g.items)
        if (it.hijos?.some((h) => pathname === `${base}${h.to}`)) return it.id
    return 'puestos'
  })
  const alternar = (id: string) => setAbierto((a) => (a === id ? null : id))

  // Crear puestos: el encargado ve sus datos (acotados por RLS) pero no gestiona
  // estructura. El límite de plan NO se descubre aquí, se descubre al crear.
  const canCreate = role !== 'encargado'

  const pintarItem = (it: NavItem) => {
    // Notificaciones se pinta sola: el timbre sabe su propio contador y si la
    // empresa tiene con quién generarlo (sin equipo no hay avisos posibles y no
    // se pinta nada). Pasarle el número por el registro sería llevar la misma
    // cuenta en dos sitios.
    if (it.capa === 'avisos') return <Avisos key={it.id} label={it.label} contraido={contraido} />
    // El atajo NO se monta con el raíl estrecho: la tecla mide 39px y no cabe en
    // una fila de 48, así que se saldría por el filo. Es lo único de una fila que
    // se decide en React y no con opacidad, porque aquí sí hay algo que quitar.
    if (it.capa === 'buscar')
      return (
        <BotonFila
          key={it.id}
          Icon={it.Icon}
          label={it.label}
          onClick={onBuscar}
          teclas={contraido ? undefined : ['⌘', 'K']}
        />
      )
    // Con hijos, la fila se parte: la etiqueta lleva y el chevron pliega.
    if (it.hijos)
      return (
        <FilaConHijos
          key={it.id}
          it={it}
          base={base}
          abierto={abierto === it.id}
          contraido={contraido}
          cajon={cajon}
          onToggle={() => alternar(it.id)}
          onAbrir={() => setAbierto(it.id)}
          onNavigate={onNavigate}
        />
      )
    return (
      <EnlaceFila
        key={it.id}
        to={`${base}${it.to}`}
        Icon={it.Icon}
        label={it.label}
        novedades={it.novedades}
        novedadesLabel={it.novedades && it.novedadesLabel ? it.novedadesLabel(it.novedades) : undefined}
        contraido={contraido}
        onNavigate={onNavigate}
      />
    )
  }

  const pintarGrupo = (g: NavGroup) => {
    return (
      <div key={g.id}>
        {/* La cabecera del bloque desaparece con el raíl estrecho: el nombre de
            la empresa no cabe en 64px y recortado a tres letras no dice nada. Lo
            que separa los dos bloques sigue siendo su aire, que es lo que ya hacía
            el trabajo (por eso aquí nunca hubo una raya). */}
        {g.label && !contraido && <BloqueLabel>{g.label}</BloqueLabel>}
        {/* 6px de hueco, no 2: junto con la píldora de 34 da el paso de 40 de la
            referencia. Es la mitad de la regla; la otra mitad es que la píldora
            encogió (ver `filaLateral.ts`). */}
        {/* SIN `items-center`, y se vio midiendo: en un contenedor `flex-col`
            centra en HORIZONTAL, y las filas que desbordan el raíl estrecho (las
            que llevan chevron o chapa) se iban a la IZQUIERDA, con x negativa, o
            sea fuera del menú. Las filas son `w-full` y cada una recorta lo suyo,
            que es lo que las deja alineadas sin centrar nada. */}
        <div className="flex flex-col gap-1.5">
          {g.conPuestos && (
            <Puestos abierto={abierto === 'puestos'} contraido={contraido} onToggle={() => alternar('puestos')} onNavigate={onNavigate} />
          )}
          {g.items.map(pintarItem)}
        </div>
      </div>
    )
  }

  return (
    <nav
      // `data-lateral` no es decoración: el panel de Avisos se coloca contra la
      // ventana (`fixed`) y necesita saber dónde EMPIEZA esta superficie para
      // abrirse a su altura. En escritorio arranca en 0 y en móvil por debajo de
      // la barrita, y esta marca es lo que deja escribirlo una sola vez.
      data-lateral
      // El grupo del que cuelgan todas las variantes `group-data-[contraido]`
      // repartidas por `filaLateral.ts`. Se marca aquí, en el nodo que envuelve a
      // todas las filas, incluidas las que pintan otros ficheros (Avisos y el pie).
      data-contraido={contraido || undefined}
      className="group/lateral flex h-full flex-col bg-[var(--color-lateral)]"
      aria-label="Menú principal"
    >
      {/* LA CABECERA: la marca y, con ella, la forma de estrechar el raíl.

          La marca vuelve al producto (reskin ago 2026). Estuvo fuera del shell a
          propósito ("dentro de tu casa no hace falta la valla") mientras la
          esquina superior izquierda era la empresa; retirada la barra, la empresa
          pasó a ser la cabecera de su propio bloque y este sitio se quedó libre.

          `hidden lg:flex`, y no es una decisión de estilo: por debajo de lg este
          mismo menú vive dentro del cajón, y encima del cajón está la barrita que
          ya lleva la marca. Sin esto salía dos veces, una debajo de la otra.

          UNA SOLA ANATOMÍA en los dos anchos, que es la regla de esta versión:
          `overflow-hidden` y el relleno animado hacen todo el trabajo. A 64px el
          botón de contraer sencillamente no cabe y se recorta (que es justo lo que
          Mario pidió: contraído no se pinta), el wordmark se apaga, y el monograma
          se desliza de 30 a 18, que es donde queda centrado. Ni una rama de React,
          ni un elemento que aparezca o desaparezca de golpe. */}
      <div className={`hidden shrink-0 items-center gap-1.5 overflow-hidden pb-7 pt-[22px] lg:flex ${ZONA_MARCA}`}>
        {/* SIN `min-w-0` en el enlace, y esto se midió: con él, el bloque de la
            marca podía encoger hasta CERO, así que a 64px el botón de contraer se
            deslizaba hasta el hueco del logo y se quedaba a la vista, que es justo
            lo contrario de lo que se le pidió. Sin él, el enlace no baja del ancho
            de su monograma (28, `shrink-0`) y el botón queda empujado fuera del
            recorte. Quien encoge es el wordmark, que sí lleva su `min-w-0`. */}
        <Link
          to={base}
          onClick={onNavigate}
          // 11 y no el 6 de siempre: es lo que deja el wordmark en los mismos 64
          // que las etiquetas del menú con el logo ya centrado en su columna
          // (25 + 28 + 11 = 64). Ver `ZONA_MARCA`.
          className="flex flex-1 items-center gap-[11px] rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          {/* El MISMO lockup que el resto del producto (Mario, ago 2026):
              monograma bicolor a pelo + wordmark "apuntatefacil" en minúscula,
              como el login, el onboarding y la landing. Aquí había una variante
              propia del shell (baldosa de tinta con el logo en su versión oscura y
              "Apúntate Fácil" en caja de título), y dos formas de escribir la
              marca se leen como dos productos. El nombre accesible lo pone el
              propio SVG del logo (aria-label); el wordmark es dibujo y va
              aria-hidden, igual que en todas las demás superficies.

              La sangría a 30 y el monograma a 28 con 6 de hueco: así el logo cae
              en la MISMA vertical que los iconos del menú y el wordmark en la
              misma que sus etiquetas (30 + 28 + 6 = 64, medido). El 28 tampoco es
              libre: sale de la PROPORCIÓN del lockup en el resto del producto
              (landing 32/20, login 36/20, o sea 1,6-1,8). */}
          <Logo className="size-7 shrink-0" />
          <span className={`min-w-0 text-[17px] brand-wordmark text-slate-900 ${FILA_ETIQUETA}`} aria-hidden translate="no">
            apuntatefacil
          </span>
        </Link>
        {/* A la derecha de la marca, que es donde lo pone la referencia y donde se
            busca: el control que gobierna el raíl entero vive en la fila que lo
            corona. Contraído queda fuera del recorte, así que también sale del
            tabulador: un botón que no se ve no puede responder al Intro. */}
        {onAlternarContraido && <BotonContraer rail={rail} onClick={onAlternarContraido} />}
      </div>

      {/* Lo que crece va aquí en medio y se desplaza; la marca y el pie se quedan
          quietos. Sin esto, un cliente con muchos puestos empujaba "Crear puesto"
          fuera de la pantalla, que es justo la acción que nunca puede perderse. */}
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pt-4 lg:pt-0 ${ZONA_LATERAL}`}>
        {grupos.map(pintarGrupo)}
      </div>

      {/* Sin raya sobre el pie: lo que separa el pie del menú es el hueco que
          deja la zona elástica, no una línea. Con la raya puesta, el lateral se
          leía partido en dos cajas; JOIN tampoco la tiene y por eso su pie se ve
          apoyado en vez de encerrado. */}
      <div className={`shrink-0 pb-3 pt-2 ${ZONA_LATERAL}`}>
        {/* SIN icono, y no es por quitar adornos: con el "+" delante, lo que se
            centra es el grupo icono+texto, así que el RÓTULO queda 12px a la
            derecha del centro del botón (medido). El ojo centra el texto, no el
            grupo, y ese descuadre es exactamente lo que se lee como "hecho a
            ojo". Un CTA a ancho completo con la etiqueta centrada tampoco
            necesita el icono: "Crear puesto" ya dice lo que hace. Un icono junto
            al texto vale cuando el botón es estrecho y la etiqueta va a la
            izquierda, no aquí. */}
        {canCreate && (
          <button
            onClick={onNewCampaign}
            aria-label="Crear puesto"
            // La forma contraída se pega AQUÍ y no dentro de `BTN_PRIMARY_LATERAL`
            // porque `lib/` no puede importar de `components/`: el estado del raíl
            // es vocabulario del lateral, y el botón solo aporta su pintura.
            className={`relative ${BTN_PRIMARY_LATERAL} ${CTA_LATERAL_CONTRAIDO}`}
          >
            {/* LOS DOS RÓTULOS SE CRUZAN EN EL SITIO, no se sustituyen: los dos
                van centrados en la misma caja y lo único que cambia es cuál está
                encendido. Cambiando el contenido, el botón se rehacía en el
                fotograma 0 mientras su caja seguía animándose, que es el tirón que
                esta versión vino a quitar.

                Y así el "+" no rompe la regla del botón de bloque ("un CTA a ancho
                completo con la etiqueta centrada no lleva icono"): esa regla existe
                porque el grupo icono+texto se centra y deja el RÓTULO 12px
                descentrado, y aquí nunca conviven. El nombre va en el `aria-label`,
                que es el mismo en los dos anchos. */}
            <span aria-hidden className={`absolute inset-0 grid place-items-center ${FILA_ETIQUETA_CENTRADA}`}>
              Crear puesto
            </span>
            <span aria-hidden className={`absolute inset-0 grid place-items-center ${FILA_SOLO_ESTRECHO}`}>
              <Plus className="size-[18px]" />
            </span>
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

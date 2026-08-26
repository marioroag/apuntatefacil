import { ArrowUp, ArrowUpDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AsaColumna } from '../../lib/columnas'

/* ---------------------------------------------------------------------------
   REJILLA DE DATOS · vocabulario único de las tablas (panel y bandeja)
   ---------------------------------------------------------------------------
   Una tabla sin filos verticales es una LISTA con las cosas alineadas por
   casualidad: el ojo baja por las filas y tiene que reconstruir a qué columna
   pertenece cada dato. Con el filo puesto es una BASE DE DATOS: la columna
   existe como objeto, se recorre de arriba abajo y comparar dos teléfonos o dos
   estados deja de exigir memoria. Es el mismo principio que ya gobierna las
   pills de estado a ancho fijo (un borde recto, no un serrucho), llevado a las
   seis columnas.

   Las tres decisiones que hacen que funcione, y que por eso viven AQUÍ y no
   sueltas en cada pantalla:

   1. El interior es más claro que el marco. El filo entre columnas va a
      `slate-100` y el marco de la tarjeta a `slate-200`: el marco CIERRA, el
      interior solo GUÍA. Con los dos al mismo valor la tabla se convierte en una
      cuadrícula de hoja de cálculo y grita más que los datos.
   2. `border-separate`, no `border-collapse`. Con los bordes colapsados los pinta
      la TABLA y no la celda, así que la cabecera pegajosa se queda sin ellos en
      cuanto se despega (bug conocido de Chrome, y la cabecera de aquí es
      pegajosa). Como contrapartida, en modo separado los bordes de `<tr>` y
      `<thead>` NO se pintan: todo filo vive en la celda. El fondo y la sombra sí
      siguen funcionando en la fila, que es donde tienen que estar (hover,
      selección, la banda de la cabecera).
   3. La celda del checkbox no lleva filo. No es un campo del candidato: es el
      asa para cogerlo. Separarla con una línea la convertiría en una columna de
      datos vacía y partiría en dos la única cosa que la fila representa, una
      persona.

   Las cabeceras van en frase y con el icono de su tipo, no en versalita: en una
   rejilla la cabecera es el NOMBRE DE UN CAMPO, no el rótulo de una sección, y
   el icono lo identifica antes de que se lea la palabra.
--------------------------------------------------------------------------- */

/** Filo vertical entre columnas. El último no lo pinta: ahí ya está el marco. */
const LINE = 'border-r border-r-slate-100 last:border-r-0'

export const TABLE = 'w-full table-fixed border-separate border-spacing-0'

/* ---------------------------------------------------------------------------
   COLUMNAS FIJAS: LA IDENTIDAD NO SE VA CON EL DESPLAZAMIENTO (Mario, ago 2026)
   ---------------------------------------------------------------------------
   La rejilla se desplaza a lo ancho (en móvil siempre, y en escritorio en cuanto
   la ventana estrecha o el usuario ensancha una columna). Empujando a la
   izquierda para llegar al teléfono o a la fecha se perdía de vista lo único que
   dice de QUIÉN es esa fila, y con ello la casilla para cogerlo: la tabla pasaba
   a ser una cuadrícula de datos sin dueño, y para seleccionar a alguien había que
   volver atrás. Así que la casilla y el candidato se quedan quietos y el resto
   pasa por debajo.

   Las tres cosas que hay que respetar al usarlas:

   1. UNA CELDA FIJA ES OPACA, SIEMPRE. Lo que se desliza por debajo se ve a
      través de cualquier alfa, y el nombre acabaría leyéndose sobre un teléfono.
      Por eso los fondos de fila de la rejilla son tokens opacos (ver
      `--color-tabla-*` en index.css) y la celda fija pinta el MISMO que su fila:
      dos mitades de la misma fila con dos colores es una costura.
   2. EL `left` LO PONE LA PANTALLA, porque depende de sus columnas: 0 para la
      primera, y el ancho de la casilla (40px) para el candidato que va detrás.
   3. SIN SOMBRA. El filo entre columnas ya lo pintan las seis, así que el borde
      de la fija no necesita anunciarse; ver `FIJA`.
--------------------------------------------------------------------------- */

/**
 * Celda que no se mueve. El `left` lo pone quien la usa (ver la nota 2).
 *
 * Y no lleva sombra (Mario, ago 2026). Se probó la hermana horizontal de la
 * cabecera pegajosa, encendida solo con la rejilla ya desplazada, y sobra: el filo
 * que separa dos columnas ya está pintado en todas, así que el borde de la fija
 * no necesita presentarse. Lo que se ahorra al quitarla no es solo la sombra:
 * saber si la tabla está desplazada exigía un oyente de scroll, un estado y un
 * `data-` en el envoltorio, todo ello para decorar un filo que ya existía.
 */
export const FIJA = 'sticky z-10'

/**
 * La transición de color de una fila.
 *
 * La exporta para que **una celda FIJA repita la de su fila**, y eso no es un
 * detalle: la celda fija pinta su propio fondo (nota 1 de arriba), así que sin
 * esto la mitad que se queda quieta cambia DE GOLPE mientras la que se desliza se
 * funde en 150ms. Bajando el ratón por la lista, eso se lee como si la fila fuera
 * por detrás del puntero, o sea exactamente igual que un tirón. Medido: la fila
 * llevaba `background-color 0.15s` y la celda `all 0s`.
 */
export const TRANSICION_FILA = 'transition-colors duration-[var(--duration-control)]'

/** Fila de datos. `group/row` deja que la última celda se quede sin filo inferior. */
export const ROW = `group/row h-14 ${TRANSICION_FILA}`

/**
 * Celda de datos.
 *
 * `max-sm:px-2`: en móvil la rejilla se desplaza a lo ancho y cada píxel de
 * relleno se lo quita al nombre, que es lo único que no se puede truncar sin
 * perder de quién es la fila. 8px por celda no se ven y en la columna del
 * candidato son un apellido entero.
 */
export const CELL = `px-3 max-sm:px-2 align-middle border-b border-b-slate-100 group-last/row:border-b-0 ${LINE}`

/**
 * Celda sin filo derecho (la del checkbox: ver la decisión 3 de arriba).
 *
 * SIN `max-sm:px-2`, y no es un olvido: quien la usa la pone a `px-0` para que la
 * casilla quede centrada en sus 40px, y una VARIANTE gana siempre a una utilidad
 * base, esté donde esté escrita en el `className`. Con el relleno de móvil puesto
 * aquí, las casillas de la tabla se descolgaban 8px a la derecha de su columna.
 * Es el mismo tropiezo que el `px-0` contra el `px-3.5` de los botones de icono.
 */
export const CELL_FLUSH = 'px-3 align-middle border-b border-b-slate-100 group-last/row:border-b-0'

/**
 * Celda de cabecera, SIN posición: la pone `ColHead`, que es quien sabe si la
 * columna es fija (ver `HEAD_CELL_FLUSH_FIJA` para por qué no puede ir en la base).
 * El filo inferior es más oscuro: cierra la banda.
 *
 * En reposo la posición es `relative`, porque de la cabecera cuelga el asa de
 * ajustar el ancho, que se coloca sobre su filo derecho. Va en todas y no solo en
 * las que llevan asa: `relative` sin nada posicionado dentro no cambia una sola
 * medida, y tenerlo en las dos formas evita que la cabecera se mueva un píxel
 * según lleve asa o no.
 */
const HEAD_BASE = `h-10 px-3 max-sm:px-2 text-left align-middle border-b border-b-slate-200 ${LINE}`

/** Cabecera sin filo derecho, pareja de CELL_FLUSH. */
const HEAD_BASE_FLUSH = 'h-10 px-3 text-left align-middle border-b border-b-slate-200'
export const HEAD_CELL_FLUSH = `relative ${HEAD_BASE_FLUSH}`

/**
 * La misma cabecera sin filo, pero FIJA.
 *
 * Existe como constante propia en vez de pegarle `sticky` a la de arriba porque
 * `relative` y `sticky` son la MISMA utilidad de Tailwind (`position`), y dos
 * utilidades del mismo eje no se resuelven por el orden en que se escriben en el
 * `className` sino por el que se emite en el CSS. La salida es siempre la misma:
 * la variante que NO pone la que sobra. (El `relative` de la base está ahí para
 * el asa de ajustar el ancho, y `sticky` posiciona igual de bien.)
 */
export const HEAD_CELL_FLUSH_FIJA = `${FIJA} ${HEAD_BASE_FLUSH}`


/**
 * Fila de la MISMA lista en móvil, donde no hay rejilla que valga: por debajo de
 * `md` cada candidato es una ficha de dos líneas (arriba quién, abajo sus datos).
 * Vive aquí porque es la otra mitad de la misma tabla, y porque las dos pantallas
 * que la usan tienen que envejecer juntas.
 *
 * El filo va SANGRADO hasta donde empieza el texto (16 de margen + 36 del avatar +
 * 12 de hueco = 64): así la columna de avatares se lee como un raíl y la lista deja
 * de parecer una tabla a la que le faltan las columnas. `divide-y` no vale, porque
 * pinta el filo de lado a lado de la fila.
 *
 * **Esta medida DEPENDE del tamaño de la cara**: si el avatar cambia, este número
 * cambia con él o el filo se descuelga del texto. Eran 68 con caras de 40 (ago
 * 2026); al bajarlas a 36 hubo que bajarlo aquí, y ese es exactamente el corolario
 * de "cuando se cambia la escala de una zona hay que recorrer sus vecinas".
 */
export const MOBILE_ROW =
  'relative after:pointer-events-none after:absolute after:bottom-0 after:left-16 after:right-0 after:h-px after:bg-slate-100 last:after:hidden'

/**
 * EL ASA DE AJUSTAR EL ANCHO. Se pone sobre el filo que separa dos cabeceras.
 *
 * La zona sensible mide 9px y va CENTRADA en el filo (`-right-1`), no pegada a un
 * lado: el filo es de 1px y el ojo apunta a él, así que un asa que solo cubriera
 * su izquierda obligaría a acertar dentro de la columna. Lo que se VE es una
 * barra de 2px que aparece al acercarse, como en la referencia.
 *
 * Es de las poquísimas cosas que se pintan en el acento sin ser un botón, y está
 * dentro de la regla: el ultramarine es acción, foco y selección, y esto es un
 * control que se agarra. En reposo no se ve nada, que es lo que impide que seis
 * filos de acento compitan con los datos.
 */
function AsaAncho({ asa }: { asa: AsaColumna }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ancho de la columna ${asa.nombre}`}
      tabIndex={0}
      onPointerDown={asa.onPointerDown}
      onPointerMove={asa.onPointerMove}
      onPointerUp={asa.onPointerUp}
      onPointerCancel={asa.onPointerCancel}
      onKeyDown={asa.onKeyDown}
      onDoubleClick={asa.onDoubleClick}
      // `touch-none` para que el gesto no se lo lleve el desplazamiento de la
      // tabla, y `select-none` para no ir seleccionando texto al arrastrar.
      className="group/asa absolute inset-y-0 -right-1 z-10 flex w-2 cursor-col-resize touch-none select-none items-stretch justify-center focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="w-0.5 rounded-full bg-transparent transition-colors duration-[var(--duration-control)] group-hover/asa:bg-indigo-500 group-focus-visible/asa:bg-indigo-500 motion-reduce:transition-none"
      />
    </span>
  )
}

type Sort = {
  active: boolean
  dir: 'asc' | 'desc'
  onToggle: () => void
  /** Cómo se lee la columna en el aviso del lector de pantalla ("Candidato: ..."). */
  label?: string
}

/**
 * Cabecera de columna: icono de tipo + nombre del campo, y el glifo de orden solo
 * si la columna ordena. En reposo el glifo está a opacidad 0 y aparece al pasar por
 * encima o al enfocar: con seis columnas, seis flechitas grises permanentes hacen
 * más ruido que la propia cabecera, y la que SÍ ordena ahora mismo se ve siempre.
 */
export function ColHead({
  icon: Icon,
  children,
  className = '',
  toneClass = '',
  align = 'left',
  flush = false,
  sort,
  columna,
  ancho,
  asa,
  fija,
}: {
  icon?: LucideIcon
  children: string
  className?: string
  /** Fondo/estado de la banda (lo decide la pantalla: cambia al despegarse). */
  toneClass?: string
  align?: 'left' | 'right'
  flush?: boolean
  sort?: Sort
  /**
   * Ancho en píxeles, si el usuario lo ha ajustado. Va en `style` y no en una
   * clase porque es un número que sale de un arrastre: una clase de Tailwind
   * compuesta al vuelo no llega nunca al CSS compilado (el mismo fallo que dejó
   * al `<select>` sin flecha).
   *
   * `'auto'` es el caso de la ÚLTIMA columna cuando alguna hermana está
   * congelada: anula el ancho de su clase para que sea ella quien se coma el
   * sobrante y la tabla siga midiendo lo que mide la tarjeta.
   */
  ancho?: number | 'auto'
  /**
   * La clave de esta columna, escrita en el DOM (`data-columna`). Al empezar un
   * arrastre hay que congelar el ancho de TODAS sus hermanas, y esto es lo que
   * deja encontrarlas desde el `<th>` que agarras sin que la tabla tenga que
   * pasarle a nadie una lista de refs.
   */
  columna?: string
  /** Lo que hace ajustable esta columna. Sale de `useColumnasAjustables`. */
  asa?: AsaColumna
  /**
   * Posición de la cabecera cuando la columna es FIJA: `` `${FIJA} left-10` ``
   * y compañía. Sustituye al `relative` de la base en vez de acompañarlo, porque
   * son la misma utilidad (ver `HEAD_CELL_FLUSH_FIJA`).
   */
  fija?: string
}) {
  const base = `${fija ?? 'relative'} ${flush ? HEAD_BASE_FLUSH : HEAD_BASE}`
  const active = sort?.active ?? false
  const inner = `flex w-full min-w-0 items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`
  // LA CABECERA ES EL NOMBRE DE UN CAMPO, NO UN PIE DE FOTO (Mario, ago 2026).
  //
  // Estaba en `slate-500` a peso medio con el icono en `slate-400`, o sea la
  // pintura de lo que ACOMPAÑA. Pero una cabecera de rejilla es lo que te dice
  // qué estás mirando en cada columna, y la mitad de ellas son además controles
  // (ordenan). Es literalmente la regla de nitidez que ya se aplicó al lateral:
  // lo que se pulsa va en tinta, y el gris de apoyo se queda para lo secundario.
  //
  // El icono se queda medio peldaño por debajo de la etiqueta, como en el menú:
  // identifica el tipo de campo antes de que se lea la palabra, pero no compite
  // con ella.
  const label = (
    <>
      {Icon && <Icon className="size-3.5 shrink-0 text-slate-500" aria-hidden />}
      <span className="truncate text-[13px] font-semibold">{children}</span>
    </>
  )

  const estilo = ancho !== undefined ? { width: ancho } : undefined

  if (!sort) {
    return (
      <th scope="col" data-columna={columna} className={`${base} ${toneClass} ${className}`} style={estilo}>
        <span className={`${inner} text-slate-700`}>{label}</span>
        {asa && <AsaAncho asa={asa} />}
      </th>
    )
  }

  const currentOrder = sort.dir === 'asc' ? 'ascendente' : 'descendente'
  const nextOrder = active && sort.dir === 'asc' ? 'descendente' : 'ascendente'
  const name = sort.label ?? children

  return (
    <th
      scope="col"
      data-columna={columna}
      className={`${base} ${toneClass} ${className}`}
      style={estilo}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={sort.onToggle}
        aria-label={active
          ? `${name}: orden ${currentOrder}. Cambiar a ${nextOrder}`
          : `${name}: sin ordenar. Ordenar de forma ascendente`}
        className={`group ${inner} rounded-sm transition-colors duration-[var(--duration-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 motion-reduce:transition-none ${
          active ? 'text-slate-900' : 'text-slate-700 hover:text-slate-900'
        }`}
      >
        {label}
        <span className="grid size-3 shrink-0 place-items-center" aria-hidden>
          {active ? (
            <ArrowUp
              className={`size-3 text-indigo-500 transition-transform duration-[var(--duration-control)] motion-reduce:transition-none ${
                sort.dir === 'desc' ? 'rotate-180' : ''
              }`}
            />
          ) : (
            <ArrowUpDown className="size-3 text-slate-300 opacity-0 transition-opacity duration-[var(--duration-control)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
          )}
        </span>
      </button>
      {asa && <AsaAncho asa={asa} />}
    </th>
  )
}

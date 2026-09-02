import { startTransition, useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
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
export const ROW = `group/row h-12 ${TRANSICION_FILA}`

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

/* ---------------------------------------------------------------------------
   PINTAR SOLO LAS FILAS QUE SE VEN (Mario, ago 2026)
   ---------------------------------------------------------------------------
   El síntoma no parecía de la tabla: "al contraer el menú se ve laggy". Medido
   con el gesto en la mano (pantalla de 120 Hz, o sea 8,3 ms de presupuesto por
   fotograma), el lateral resultó ser inocente y la tabla, la culpable:

     Vista general (0 filas) ....  8,3 ms/fotograma, CERO perdidos
     Un puesto (127 filas) ......  9,4 ms,  uno de 17
     Candidatos (593 filas) ..... 20,8 ms,  6 de 28

   La cadena es esta: el `<aside>` anima su ANCHO, así que el trabajo de al lado
   se recalcula ENTERO en cada fotograma. Un solo recálculo forzado cuesta
   **9,1 ms con las 593 filas puestas y 0,0 ms sin ellas**; con el contenido en
   `display:none` la animación sale perfecta, y **con 20 filas en el DOM también
   (8,3 ms, cero perdidos, idéntico al reposo)**. O sea que el coste es
   exactamente proporcional a cuántas filas hay que colocar.

   Lo que se descartó MIDIENDO, para que nadie lo vuelva a intentar:
    - No es React: cero mutaciones en el DOM durante el gesto (MutationObserver).
    - No son las columnas fijas: 9,1 -> 8,0 al quitarles el `sticky`.
    - No es el plegable de un submenú, que sale a 8,3 ms y cero perdidos.
    - **NO HAY TRUCO DE CSS.** La contención no se aplica a los elementos
      internos de una tabla: con `content-visibility: hidden` en el `<tbody>`,
      este sigue midiendo sus 33.208 px y el coste no se mueve. Contener el
      contenido de cada celda (`td > *`) baja de 10,5 a 5,1 ms, que sigue sin
      caber en 8,3.
    - Y no vale animar con `transform` en vez de con ancho: el contenido va
      CENTRADO a `max-w-trabajo`, así que al estrechar el menú 192px la columna
      solo se mueve 96. Cualquier versión que fije la maquetación y la deslice
      acaba con un salto de 96px o con una franja vacía al expandir.

   Así que se pinta una VENTANA de filas y el resto son dos huecos con la altura
   exacta que ocuparían. Arregla mucho más que la animación: es también el tirón
   al ordenar y al filtrar que este proyecto llevaba anotado como pendiente.

   Tres cosas que hay que respetar al usarlo, y las tres se aprendieron aquí:

   1. **EL ALTO DE FILA ES UN CONTRATO** (`ALTO_FILA`, los mismos 48px del `h-12`
      de `ROW`). El hueco de arriba mide `desde * ALTO_FILA`, así que si una fila
      creciera, el hueco mentiría y la ventana se desplazaría respecto a lo que
      de verdad se ve. Por eso el alto lo declara ESTE módulo y no cada pantalla:
      si un día `ROW` cambia de alto, cambia con él.
   2. **LA VENTANA SE ESTIRA, NO SE PERSIGUE.** Solo se recalcula cuando lo que
      hay que ver se sale de lo pintado, y entonces se pinta con COLCHÓN a los
      dos lados. Sin esa histéresis habría un render por cada píxel de scroll, y
      cambiaríamos el tirón de la animación por uno al desplazarse.
   3. **LO QUE SE PAGA, DECLARADO**: el Ctrl+F del navegador solo encuentra lo
      pintado. Es el precio de esta técnica en cualquier producto que la usa, y
      se acepta porque esta app tiene su propio buscador (⌘K) y sus filtros, que
      es como se busca aquí a una persona.
--------------------------------------------------------------------------- */

/**
 * El alto de una fila de datos, en píxeles: los mismos 48 del `h-12` de `ROW`.
 *
 * Bajó de 56 a 48 en sep 2026 (Mario: "las rows un poco menos altas"). Lo que
 * decide el suelo es que la FILA ES EL OBJETIVO DE TOQUE en móvil, donde se abre
 * la ficha pulsándola entera: 48 es exactamente el mínimo, así que por debajo de
 * aquí no se baja sin darle otra diana al dedo. Alrededor de la cara de 28px
 * quedan 10 por lado, que es lo que separa una lista densa de una apretada.
 *
 * Y NO es solo este número: en móvil hay dos celdas (estado y etiquetas) cuyo
 * disparador cubre la fila entera con un `min-h`, y si se quedan en el alto viejo
 * son ELLAS las que estiran la fila. Van juntos o la fila mide dos cosas.
 */
export const ALTO_FILA = 48

/** Filas de más que se pintan por encima y por debajo de lo que se ve. 12 son
 *  672px de margen a cada lado: bastante para que un desplazamiento normal no
 *  llegue nunca al borde de lo pintado, y poco para que un render siga siendo de
 *  unas cuarenta filas y no de seiscientas. */
const COLCHON = 12

/**
 * Qué filas hay que pintar. Devuelve el tramo y la altura de los dos huecos.
 *
 * El desplazamiento es el de la PÁGINA (`main`), no el de la tabla: aquí ninguna
 * tabla tiene scroll vertical propio. Y la posición se mide contra el `<tbody>`,
 * que no se mueve al cambiar la ventana porque el hueco de arriba ocupa
 * exactamente lo que ocuparían las filas que no se pintan.
 */
export function useFilasALaVista(total: number, cuerpo: RefObject<HTMLTableSectionElement | null>) {
  const [[desde, hasta], setTramo] = useState<[number, number]>(() => [
    0,
    Math.min(total, Math.ceil((typeof window === 'undefined' ? 900 : window.innerHeight) / ALTO_FILA) + COLCHON),
  ])

  useLayoutEffect(() => {
    const cuerpoEl = cuerpo.current
    const scroller = cuerpoEl?.closest('main')
    if (!cuerpoEl || !scroller) return
    const mirar = () => {
      const c = cuerpoEl.getBoundingClientRect()
      const s = scroller.getBoundingClientRect()
      const primera = Math.max(0, Math.floor((s.top - c.top) / ALTO_FILA))
      const ultima = Math.min(total, primera + Math.ceil(s.height / ALTO_FILA) + 1)
      // EN TRANSICIÓN, que es la otra mitad del arreglo. Estirar la ventana es un
      // render de unas cuarenta filas, o sea ~20ms: puesto como urgente se come
      // dos fotogramas y se nota como un tirón cada vez que el scroll llega al
      // borde del colchón (medido: 3-6 fotogramas perdidos por cada 600ms de
      // desplazamiento). En transición, React lo trocea y cede el hilo entre
      // trozo y trozo, así que el scroll no espera a nadie. Es el mismo reparto
      // que ya hace el buscador del panel entre lo que se ve y lo que filtra.
      startTransition(() =>
        setTramo(([d, h]) =>
          // Ya está pintado lo que hace falta: no se toca nada. Es la histéresis
          // que evita un render por píxel de scroll.
          primera >= d && ultima <= h && h <= total
            ? [d, h]
            : [Math.max(0, primera - COLCHON), Math.min(total, ultima + COLCHON)],
        ),
      )
    }
    mirar()
    scroller.addEventListener('scroll', mirar, { passive: true })
    window.addEventListener('resize', mirar)
    return () => {
      scroller.removeEventListener('scroll', mirar)
      window.removeEventListener('resize', mirar)
    }
  }, [total, cuerpo])

  return { desde, hasta, huecoArriba: desde * ALTO_FILA, huecoAbajo: (total - hasta) * ALTO_FILA }
}

/**
 * El hueco que dejan las filas que no se pintan.
 *
 * Va sin relleno ni filo: no es una fila, es el sitio de las que no están. Y no
 * se pinta cuando mide cero, para que al llegar al final de la lista la última
 * fila de verdad vuelva a ser `:last-child` y se quede sin su filo inferior, que
 * es lo que cierra la tabla.
 */
export function HuecoFilas({ alto, columnas }: { alto: number; columnas: number }) {
  if (alto <= 0) return null
  return (
    <tr aria-hidden style={{ height: alto }}>
      <td colSpan={columnas} className="p-0" />
    </tr>
  )
}

import { ArrowUp, ArrowUpDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

/** Fila de datos. `group/row` deja que la última celda se quede sin filo inferior. */
export const ROW = 'group/row h-14 transition-colors duration-[var(--duration-control)]'

/** Celda de datos. */
export const CELL = `px-3 align-middle border-b border-b-slate-100 group-last/row:border-b-0 ${LINE}`

/** Celda sin filo derecho (la del checkbox: ver la decisión 3 de arriba). */
export const CELL_FLUSH = 'px-3 align-middle border-b border-b-slate-100 group-last/row:border-b-0'

/** Celda de cabecera. El filo inferior es más oscuro: cierra la banda. */
export const HEAD_CELL = `h-10 px-3 text-left align-middle border-b border-b-slate-200 ${LINE}`

/** Cabecera sin filo derecho, pareja de CELL_FLUSH. */
export const HEAD_CELL_FLUSH = 'h-10 px-3 text-left align-middle border-b border-b-slate-200'

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
}: {
  icon?: LucideIcon
  children: string
  className?: string
  /** Fondo/estado de la banda (lo decide la pantalla: cambia al despegarse). */
  toneClass?: string
  align?: 'left' | 'right'
  flush?: boolean
  sort?: Sort
}) {
  const base = flush ? HEAD_CELL_FLUSH : HEAD_CELL
  const active = sort?.active ?? false
  const inner = `flex w-full min-w-0 items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`
  const label = (
    <>
      {Icon && <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden />}
      <span className="truncate text-[13px] font-medium">{children}</span>
    </>
  )

  if (!sort) {
    return (
      <th scope="col" className={`${base} ${toneClass} ${className}`}>
        <span className={`${inner} text-slate-500`}>{label}</span>
      </th>
    )
  }

  const currentOrder = sort.dir === 'asc' ? 'ascendente' : 'descendente'
  const nextOrder = active && sort.dir === 'asc' ? 'descendente' : 'ascendente'
  const name = sort.label ?? children

  return (
    <th
      scope="col"
      className={`${base} ${toneClass} ${className}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={sort.onToggle}
        aria-label={active
          ? `${name}: orden ${currentOrder}. Cambiar a ${nextOrder}`
          : `${name}: sin ordenar. Ordenar de forma ascendente`}
        className={`group ${inner} rounded-sm transition-colors duration-[var(--duration-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 motion-reduce:transition-none ${
          active ? 'text-slate-700' : 'text-slate-500 hover:text-slate-800'
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
    </th>
  )
}

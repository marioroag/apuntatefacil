// -----------------------------------------------------------------------------
// EL BOTÓN "INSTRUMENTO DE PRECISIÓN". Fuente de verdad ÚNICA.
//
// Hasta ago 2026 esto vivía en dos sitios (aquí y en `components/ui/Button.tsx`,
// con las cadenas copiadas a mano) y encima se recreaba suelto en tres pantallas.
// El resultado fue el previsible: el mismo botón con cinco opacidades de sombra
// distintas y tres copias sin `ring-inset`. Ahora la PINTURA (`BTN_SUPERFICIE`)
// se declara una vez y la componen tanto las constantes de abajo como el
// componente `<Button>`. Si quieres un botón, sale de aquí; no lo reescribas en
// tu pantalla, que es exactamente como empezó el problema.
//
// PLANO Y NÍTIDO (Mario, ago 2026). Se RETIRA el relieve: ni filo de luz, ni
// anillo interno en el sólido, ni sombra de contacto. El color hace el trabajo, y
// al pulsar el botón OSCURECE en vez de hundirse.
//
// Por qué se cambió, y está medido: la pareja primario+secundario estaba
// descompensada en tres ejes a la vez (relleno 16 contra 12, peso 600 contra 500 y
// sombra de contacto 24% contra 6%). Ese 6% es casi invisible, así que el primario
// se leía como un objeto físico y el secundario como una caja plana: DOS LENGUAJES
// puestos en pareja. Y el primario llevaba su anillo oscuro en las cuatro caras con
// un filo de luz encima, o sea que arriba se pisaban; un objeto elevado lleva luz
// arriba y sombra abajo, no oscuro en todo el perímetro.
//
// El argumento de fondo no es la moda: el relieve era de 2026 y ya solo lo
// sostenía el botón. El resto de la app (tabla, chips, lateral, cápsulas de estado,
// buscador) es plana desde hace tiempo, así que el botón era la pieza que
// desentonaba, no la que marcaba el estilo.
//
// Se conserva `--shadow-raised` en el vocabulario porque lo usan dos cosas que SÍ
// son objetos: el pomo del `Switch` (un tirador que se desliza) y nada más. Un
// botón ya no lo toca.
//
// NADA de `scale` en el press, ni antes ni ahora: es lenguaje de dibujo animado.
// Antes se hundía (`translate-y-px`); ahora oscurece. Las dos son físicas
// coherentes; lo que no vale es encoger.
//
// TODOS los anillos van `ring-inset`, y esto no es cosmética: `ring-1` sin inset
// es un box-shadow que se pinta FUERA de la caja, así que un botón de 36px se ve
// de 38. Con el relieve retirado el sólido ya no lleva anillo, pero el de hairline
// sí, y sigue teniendo que medir lo que dice que mide: contra un input con
// `border` (que se pinta dentro) o contra el botón de al lado. No quitar el
// `ring-inset`.
// Ojo al verificarlo: `getBoundingClientRect()` NO ve esta diferencia (el ring no
// ocupa layout); hay que sumar el spread del `box-shadow` computado.
//
// Alto compacto (36px) en escritorio; en punteros táctiles (móvil/tablet) sube a
// 44px (`pointer-coarse:min-h-11`) para que el objetivo de toque cumpla el mínimo,
// sin tocar la densidad de escritorio. Mismo criterio que el 16px de inputs.
// -----------------------------------------------------------------------------

/**
 * Movimiento compartido. Acotado a color/sombra/transform: NUNCA a layout, que es
 * lo que provoca los saltos de un pixel al pasar el ratón. La duración sale del
 * token, no de un número suelto. El foco lo cubre `:focus-visible` en index.css.
 */
export const BTN_MOTION =
  'transition-[background-color,box-shadow,color] duration-[var(--duration-control)] ease-[var(--ease-out)]'

/** Esqueleto: caja y forma. El radio de los controles es 8px (`rounded-lg`). */
const CAJA = 'inline-flex items-center justify-center rounded-lg whitespace-nowrap select-none'

/**
 * LA PINTURA de cada variante, que es lo único que de verdad estaba duplicado.
 *
 * SIN SOMBRA, ninguna: el botón ya no es un objeto elevado (ver la cabecera). Lo
 * sólido se dice con color y lo de hairline con un anillo de 1px. Los tres estados
 * son tres tonos de la misma rampa (600 / 700 / 800 en el sólido; blanco / 50 /
 * 100 en el de línea), que es lo que hace que reposo, hover y press se distingan
 * ENTRE SÍ y no solo del reposo: la lección que ya dio el riel del lateral.
 *
 * El anillo del secundario sube de `slate-300/80` a `slate-200` y se apoya en el
 * hover para engordar: sin sombra de contacto, un anillo al 80% de opacidad se
 * quedaba a medio camino entre "hay una caja" y "no la hay".
 */
export const BTN_SUPERFICIE = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 active:bg-slate-100',
  danger:
    'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 hover:ring-red-300 active:bg-red-100',
  inverted: 'bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
} as const

export type BtnVariant = keyof typeof BTN_SUPERFICIE
export type BtnSize = 'sm' | 'md' | 'lg'

/** Alto, hueco icono-texto y tamaño de letra. Tres alturas y ni una más. */
const TALLA: Record<BtnSize, string> = {
  sm: 'h-8 gap-1.5 text-[13px]',
  md: 'h-9 pointer-coarse:min-h-11 gap-1.5 text-sm',
  lg: 'h-12 gap-2 text-base',
}

/**
 * UN SOLO RELLENO por talla, sólido o de línea. Antes eran dos escalas (16 contra
 * 12 en `md`) con el argumento de que el color se come al texto de un botón
 * relleno. El argumento tiene parte de razón, pero 4px es demasiada: sumado a la
 * diferencia de peso y a la de sombra, dejaba a la pareja Compartir/Editar
 * descompensada en tres ejes a la vez. 14px es el término medio, y con el relieve
 * retirado ya no hay una tercera diferencia que lo agrave.
 */
const AIRE: Record<BtnSize, string> = { sm: 'px-3', md: 'px-3.5', lg: 'px-5' }
const SOLIDAS: readonly BtnVariant[] = ['primary', 'inverted']

/**
 * El peso sigue a la jerarquía, no al tamaño: la acción principal va en semibold y
 * la secundaria en medium. En `lg` (los CTA de la landing) todo sube a semibold,
 * porque ahí compiten contra titulares.
 */
function peso(variant: BtnVariant, size: BtnSize) {
  return size === 'lg' || SOLIDAS.includes(variant) ? 'font-semibold' : 'font-medium'
}

/** Compone la clase completa de un botón. Es la única forma de fabricar uno. */
export function botonClase(variant: BtnVariant = 'primary', size: BtnSize = 'md', extra = '') {
  return [CAJA, BTN_MOTION, BTN_SUPERFICIE[variant], TALLA[size], AIRE[size], peso(variant, size), extra]
    .filter(Boolean)
    .join(' ')
}

// --- Las constantes de siempre, compuestas de lo de arriba --------------------
// No hay cadenas sueltas capaces de derivar por su cuenta: cambiar la pintura de
// un botón en toda la app es cambiar `BTN_SUPERFICIE`, y nada más.

export const BTN_PRIMARY = botonClase('primary', 'md')
export const BTN_SECONDARY = botonClase('secondary', 'md')
export const BTN_DANGER = botonClase('danger', 'md')

/** Compacta (h-8) para botones inline en pills o grupos estrechos. */
export const BTN_PRIMARY_SM = botonClase('primary', 'sm')
export const BTN_SECONDARY_SM = botonClase('secondary', 'sm')

/** CTA grandes de la landing: mismo lenguaje, más cuerpo. */
export const BTN_PRIMARY_LG = botonClase('primary', 'lg')
export const BTN_SECONDARY_LG = botonClase('secondary', 'lg')
/** CTA claro sobre bloque oscuro (cierre de la landing). */
export const BTN_INVERTED_LG = botonClase('inverted', 'lg')

/**
 * BOTÓN DE SOLO ICONO: cuadrado, misma pintura y mismos estados que los demás.
 *
 * Lo único que cambia respecto a `botonClase` es el relleno: sin texto no hay
 * nada a lo que dar aire a los lados, así que el `px-*` se sustituye por un lado
 * fijo. Dejando el relleno horizontal del tamaño, el icono queda descentrado en
 * su caja y el botón sale rectangular sin que nadie lo haya pedido.
 *
 * OBLIGATORIO en quien lo use: `aria-label`. Un botón sin texto accesible no
 * existe para un lector de pantalla, y el nombre que se le quita a la pantalla
 * tiene que reaparecer ahí (y en el `title`, que es además donde cabe el atajo).
 */
const TALLA_ICONO: Record<BtnSize, string> = {
  sm: 'size-8',
  md: 'size-9 pointer-coarse:size-11',
  lg: 'size-12',
}

export function botonIcono(variant: BtnVariant = 'primary', size: BtnSize = 'md', extra = '') {
  return [CAJA, BTN_MOTION, BTN_SUPERFICIE[variant], TALLA_ICONO[size], 'shrink-0', extra]
    .filter(Boolean)
    .join(' ')
}

/**
 * BOTÓN DE BLOQUE: el que cierra un formulario de acceso (entrar, crear cuenta,
 * aceptar invitación, restablecer). Ancho completo, 44px de alto y radio de CAMPO
 * (10px), no de control (8px).
 *
 * No es un capricho ni deriva: un botón que ocupa todo el ancho debajo de una pila
 * de inputs que también lo ocupan tiene que compartir su radio y su ancho, o el
 * bloque se ve descosido por abajo. El 44px es el objetivo de toque, que en una
 * pantalla de login importa más que la densidad.
 *
 * Estaba recreado a mano en seis sitios (Login ×3, Invitación ×2, ResetPassword),
 * cada uno con su propia opacidad de `disabled`. Ahora se declara una vez.
 */
export function botonBloque(variant: BtnVariant = 'primary', extra = '') {
  return [
    'flex w-full items-center justify-center gap-2 rounded-xl whitespace-nowrap select-none',
    'h-11 text-sm font-semibold',
    BTN_MOTION,
    BTN_SUPERFICIE[variant],
    'disabled:pointer-events-none disabled:opacity-60',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

export const BTN_PRIMARY_BLOCK = botonBloque('primary')
export const BTN_SECONDARY_BLOCK = botonBloque('secondary')

/**
 * BLOQUE DE RAÍL: el bloque, pero a 36px en escritorio.
 *
 * Existe porque el bloque tiene DOS contextos y no una talla. En un formulario
 * vive debajo de una pila de inputs y sus 44px son el objetivo de toque, que ahí
 * manda sobre la densidad. En el raíl del lateral vive rodeado de filas de 34px,
 * y a 44 se veía descolgado del sistema, como si fuera de otra pantalla: un
 * botón no puede ser un 30% más alto que todo lo que tiene alrededor.
 *
 * Baja SOLO a partir de `lg`: por debajo el lateral es un cajón que se toca con
 * el dedo y vuelve a sus 44. Se declara aquí y no con un `lg:h-9` pegado en el
 * `className` del lateral, que es exactamente como el botón de esta app llegó a
 * tener nueve clones.
 */
export const BTN_PRIMARY_LATERAL = botonBloque('primary', 'lg:h-9')

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
// EL RELIEVE, que es lo que da el tacto mecanizado y no de caramelo:
//   · filo de luz de 1px arriba por dentro (`--shadow-raised`), coherente con una
//     escena iluminada desde arriba;
//   · anillo interno de 1px, que hace de canto;
//   · sombra de CONTACTO mínima, no una penumbra difusa.
// Al pulsar, el objeto se hunde y la luz cambia con él: el hairline pierde la
// sombra de contacto (ya no hay hueco que sombrear) y el sólido la cambia por una
// interior (`--shadow-pressed`), que es lo que hace un botón rehundido. Nadie lo
// analiza; todo el mundo lo nota.
//
// EL PRESS ES `translate-y-px`, NUNCA `scale`. Un botón físico se hunde, no se
// encoge. El `scale` es lenguaje de dibujo animado: funciona en un juego, no en
// una herramienta de trabajo.
//
// TODOS los anillos van `ring-inset`, y esto no es cosmética: `ring-1` sin inset
// es un box-shadow que se pinta FUERA de la caja, así que un botón de 36px se ve
// de 38. El primario ya era inset y el secundario no, de modo que cada pareja
// primario+secundario (Compartir/Editar) iba desalineada 2px, y lo mismo contra
// cualquier input con `border` (que se pinta dentro). Con inset, el rectángulo
// pintado es siempre igual a la caja de layout. No quitar el `ring-inset`.
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
  'transition-[background-color,box-shadow,transform,color] duration-[var(--duration-control)] ease-[var(--ease-out)] active:translate-y-px'

/** Esqueleto: caja y forma. El radio de los controles es 8px (`rounded-lg`). */
const CAJA = 'inline-flex items-center justify-center rounded-lg whitespace-nowrap select-none'

/**
 * LA PINTURA de cada variante, que es lo único que de verdad estaba duplicado.
 * Las sombras salen de las cinco piezas del vocabulario de elevación (`@theme`),
 * nunca de un `shadow-[...]` suelto.
 *
 * `inverted` comparte `shadow-raised` con el primario a propósito: su filo de luz
 * es blanco sobre blanco y no se ve, pero la sombra de contacto al 24% es justo
 * la que necesita para despegar de un bloque oscuro.
 */
export const BTN_SUPERFICIE = {
  primary:
    'bg-indigo-600 text-white ring-1 ring-inset ring-indigo-800/60 shadow-raised hover:bg-indigo-700 active:shadow-pressed',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-300/80 shadow-control hover:bg-slate-50 hover:ring-slate-300 active:shadow-none',
  danger:
    'bg-white text-red-600 ring-1 ring-inset ring-red-200 shadow-control hover:bg-red-50 active:shadow-none',
  inverted: 'bg-white text-slate-900 shadow-raised hover:bg-slate-100 active:shadow-none',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
 * El relleno horizontal depende de si la variante es SÓLIDA o de hairline: un
 * botón relleno necesita más aire a los lados que uno de línea con el mismo alto,
 * o el color se le come al texto. No es una inconsistencia heredada, es la regla.
 */
const AIRE_SOLIDO: Record<BtnSize, string> = { sm: 'px-3', md: 'px-4', lg: 'px-6' }
const AIRE_HAIRLINE: Record<BtnSize, string> = { sm: 'px-3', md: 'px-3', lg: 'px-5' }
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
  const aire = SOLIDAS.includes(variant) ? AIRE_SOLIDO[size] : AIRE_HAIRLINE[size]
  return [CAJA, BTN_MOTION, BTN_SUPERFICIE[variant], TALLA[size], aire, peso(variant, size), extra]
    .filter(Boolean)
    .join(' ')
}

// --- Las constantes de siempre, ahora compuestas ------------------------------
// Mismo aspecto que antes: lo que cambia es que ya no hay cadenas sueltas capaces
// de derivar por su cuenta. Las variantes `lg` ganan además el cambio de luz al
// pulsar, que se les había olvidado (solo bajaban 1px, sin tocar la sombra).

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
 * BOTÓN DE SOLO ICONO: cuadrado, misma pintura y mismo press que los demás.
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

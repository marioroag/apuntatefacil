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

/**
 * Esqueleto SIN radio, para las pocas variantes que declaran el suyo. Existe
 * separado por la regla de siempre: `rounded-lg` y `rounded-xl` son la misma
 * utilidad y no se resuelven por el orden en que se escriben en el `className`,
 * así que un botón con otro radio no se fabrica añadiéndoselo a `CAJA`, se
 * fabrica con el esqueleto que no lo pone.
 */
const FORMA = 'inline-flex items-center justify-center whitespace-nowrap select-none'

/** Esqueleto: caja y forma. El radio de los controles es 8px (`rounded-lg`). */
const CAJA = `${FORMA} rounded-lg`

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
 *
 * SE PROBÓ PINTARLO CON `filo` (las dos manos de una superficie) Y SE REVIRTIÓ
 * EL MISMO DÍA (sep 2026), y queda escrito para que nadie lo reintente sin un
 * motivo nuevo. La sospecha que lo disparó era que el borde de un botón y el de
 * la tabla se vieran de DISTINTO color; medido con el cuentagotas, son el mismo
 * (`slate-200` los dos), así que lo único que quedaba en pie era el matiz del
 * antialias en el arco de las esquinas: un 23% de pico contra un 13%, en cuatro
 * curvas de 8px. **A cambio, `filo` va con `border` y eso ensancha 2px cada botón
 * de ancho automático** (medido: "Filtros" de 91 a 93), y arrastra tres cuidados
 * (el foco, `outline-none` y mover las dos manos a la vez en el hover). Mal
 * negocio: se paga en toda la app por algo que no se ve.
 *
 * La incoherencia que se acepta a cambio: el campo del buscador y el conmutador
 * SÍ van a dos manos, porque son superficies con `border` propio, y ahí `filo` no
 * cuesta un píxel. La regla queda como estaba: **`filo` es para el marco de una
 * SUPERFICIE; el hairline de un CONTROL lo pinta su anillo, que no ocupa layout.**
 */
export const BTN_SUPERFICIE = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 active:bg-slate-100',
  danger:
    'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 hover:ring-red-300 active:bg-red-100',
  inverted: 'bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  /**
   * El gemelo de `ghost` para vivir SOBRE UNA SUPERFICIE SATURADA (hoy, la barra
   * flotante de selección, que es del color de la marca). Sin caja y sin anillo:
   * un botón de línea blanco por cada acción devuelve el problema que la barra de
   * color vino a quitar, que es una fila de objetos compitiendo. Manda la
   * etiqueta, y la caja aparece al pasar por encima.
   *
   * Los tres peldaños son de opacidad y no de la rampa, porque aquí no hay rampa:
   * el fondo es uno solo. Y siguen distinguiéndose ENTRE SÍ, que es la regla que
   * ya aprendió el riel del lateral, no solo del reposo.
   *
   * LAS OPACIDADES ESTÁN MEDIDAS SOBRE EL FONDO QUE TIENEN, y por eso subieron al
   * pasar la barra de tinta a marca (ago 2026): el mismo velo blanco separa menos
   * cuanto más claro es lo que hay debajo. Con 12/20, que era lo calculado para
   * `slate-900`, sobre `indigo-600` el hover caía de 1,42:1 a 1,27 y se
   * desdibujaba. 18/30 devuelve los mismos peldaños (1,44 y 1,83). **Corolario:
   * un velo de opacidad no se muda de fondo sin volver a medirlo.**
   *
   * No tiene constante con talla (`BTN_..._SM`) porque hoy su único consumidor es
   * una barra SEGMENTADA, donde los tramos no tienen radio ni altura propios: la
   * compone `SEGMENTO` en `Dashboard.tsx`, que coge de aquí la pintura y pone su
   * propia caja. Si algún día hace falta un botón suelto sobre color, se declara.
   */
  sobreOscuro: 'text-white hover:bg-white/18 active:bg-white/30',
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
/** La confirmación de un borrado que se decide DENTRO de una fila estrecha (el
 *  documento de una ficha). Es una talla DECLARADA, no `BTN_DANGER` con un `h-8`
 *  pegado detrás: `h-9` y `h-8` son la misma utilidad y no se resuelven por el
 *  orden de escritura, así que la salida es la variante que no pone la que sobra. */
export const BTN_DANGER_SM = botonClase('danger', 'sm')

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
 * EL BOTÓN DE ICONO DE LA FRANJA DE FILTROS: 40px, no 36.
 *
 * Todo lo que vive en esa fila mide 40 (el buscador, su lupa y el conmutador
 * Activos/Rechazados). Nació más grande que los botones de la cabecera con el
 * argumento de que es la fila con la que más se trabaja; **ese argumento se cayó
 * en sep 2026, cuando Mario subió también los de la cabecera a 40 y el título con
 * ellos**. Lo que queda en pie es lo otro: un icono de 36 al lado de un
 * conmutador de 40 se ve hundido, y ahora eso vale para las dos filas. Los 40 son
 * la altura de un control de pantalla, no la de una franja concreta; el nombre se
 * queda por no mover media app de sitio.
 *
 * Se declara aquí y no se arregla con un `size-10` pegado al final de
 * `botonIcono(...)`: `size-9` y `size-10` son la MISMA utilidad de Tailwind y no
 * se resuelven por el orden en que se escriben. La salida es siempre la variante
 * que no pone la que sobra. Es el mismo motivo por el que existe
 * `BTN_PRIMARY_LATERAL`.
 */
/**
 * LA ALTURA DE UNA FRANJA DE HERRAMIENTAS: 40px, y 44 en táctil.
 *
 * Es el estándar de la casa (Mario, ago 2026: "ese tiene que ser el estándar"),
 * y sale del panel de un puesto, que es donde se afinó: **es la fila con la que
 * más se trabaja de una pantalla**, así que se hizo más grande que los botones
 * de la cabecera, que se usan mucho menos. Lo que se toca a menudo se hace más
 * grande, no más pequeño. Una fila se lee por su línea de base común, así que ahí
 * miden esto TODOS sus habitantes: los chips, el buscador, su lupa, los
 * conmutadores y los botones de texto.
 *
 * Se declara aquí, junto a las tallas de botón, y no en la pantalla que lo
 * estrenó: lo usan el panel de un puesto, Candidatos y la agenda, y tres copias
 * del mismo número acaban siendo tres alturas distintas.
 */
export const ALTO_FRANJA = 'h-10 pointer-coarse:h-11'

/**
 * El botón de TEXTO de una franja de herramientas ("Hoy", "Filtros"): la
 * superficie del secundario a la altura de la fila.
 *
 * No es `BTN_SECONDARY` con un `h-10` pegado detrás: `h-9` y `h-10` son la MISMA
 * utilidad de Tailwind y no se resuelven por el orden en que se escriben. La
 * salida es siempre la variante que no pone la que sobra, igual que en
 * `BTN_ICONO_FRANJA` y `BTN_PRIMARY_LATERAL`.
 */
export const BTN_SECONDARY_FRANJA = [
  CAJA, BTN_MOTION, BTN_SUPERFICIE.secondary, ALTO_FRANJA, 'gap-1.5 px-3.5 text-sm font-medium', 'shrink-0',
].join(' ')

/**
 * El botón de ACENTO a la altura de un control de pantalla (hoy, "Compartir" en
 * la cabecera de un puesto). Hermano de `BTN_SECONDARY_FRANJA`, con el peso que
 * `peso()` le da a un sólido.
 *
 * No es `BTN_PRIMARY` con un `h-10` pegado detrás, por lo de siempre: `h-9` y
 * `h-10` son la MISMA utilidad y no se resuelven por el orden en que se
 * escriben. La salida es la variante que no pone la que sobra.
 */
export const BTN_PRIMARY_FRANJA = [
  CAJA, BTN_MOTION, BTN_SUPERFICIE.primary, ALTO_FRANJA, 'gap-1.5 px-3.5 text-sm font-semibold', 'shrink-0',
].join(' ')

export const BTN_ICONO_FRANJA = [CAJA, BTN_MOTION, BTN_SUPERFICIE.secondary, 'size-10 pointer-coarse:size-11', 'shrink-0'].join(' ')

/**
 * EL GLIFO DE UN BOTÓN DE ICONO: `slate-700`, y uno solo (Mario, sep 2026).
 *
 * Eran CUATRO glifos con TRES grises, y ninguno lo había decidido nadie: el
 * engranaje en `slate-800` (heredado del secundario, que lo pone para su
 * ETIQUETA), el embudo de Filtros en `slate-400`, y la lupa y el `···` de la
 * cabecera en `slate-500`, cada uno escrito a mano por su lado. Tres tonos en la
 * misma pantalla se leen como tres materiales, y una fila se lee por lo que tiene
 * en común.
 *
 * `slate-600` (7,6:1) es el peldaño que sirve para los DOS papeles que hay ahí:
 * el glifo que va SOLO dentro de un botón (la lupa, el engranaje, el `···`) y el
 * que ACOMPAÑA a una palabra (el embudo de "Filtros"). Se lee como un control y
 * no como un adorno, y a la vez se queda un peldaño por debajo de una etiqueta en
 * `slate-800`, que es la misma jerarquía que separa el título de una cabecera de
 * tabla de su icono. En `slate-400` un glifo que va solo se queda pálido siendo lo
 * único que se ve del control; en tinta, el que acompaña a una palabra le compite.
 *
 * Va en el SVG y no en el botón: `BTN_ICONO_FRANJA` trae su `text-slate-800` y
 * dos colores en el mismo `className` se resuelven por orden de emisión, no de
 * escritura. En el hijo gana siempre, porque lo del padre solo se hereda.
 *
 * Lo que sí cambia de tono es el ESTADO: el embudo de Filtros pasa a indigo
 * cuando hay filtros puestos, igual que su etiqueta. Eso no es un cuarto gris, es
 * el acento diciendo que ese control está haciendo algo.
 *
 * No se llama `ICONO_FRANJA` porque no es de la franja: el `···` de la cabecera
 * del puesto llevaba su propio gris escrito a mano, y lo que le faltaba era salir
 * de aquí. Un valor escrito a mano en varios sitios es exactamente como nacieron
 * los tres tonos que esto vino a juntar.
 */
export const ICONO_CONTROL = 'size-4 shrink-0 text-slate-600'

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
export function botonBloque(variant: BtnVariant = 'primary', extra = '', motion = BTN_MOTION) {
  return [
    'flex w-full items-center justify-center gap-2 rounded-xl whitespace-nowrap select-none',
    'h-11 text-sm font-semibold',
    // El movimiento es un parámetro porque el CTA del lateral cambia de FORMA al
    // contraerse y necesita dos velocidades en la misma transición (ver
    // `cta-lateral` en index.css). No se le SUMA a `BTN_MOTION`: las dos declaran
    // `transition-property` y ganaría la que se emita después en el CSS.
    motion,
    BTN_SUPERFICIE[variant],
    'disabled:pointer-events-none disabled:opacity-60',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * EL BOTÓN DE ICONO QUE ACOMPAÑA A UNO DE BLOQUE: 44px y radio de CAMPO.
 *
 * Es el gemelo de `botonBloque` para cuando al lado de un botón de ancho completo
 * hace falta una acción que se dice con un solo glifo (llamar, junto a WhatsApp,
 * en la ficha del candidato). Comparte con él las dos medidas que lo hacen
 * parecer la misma pieza: **44px de alto** y **radio 10**, no los 36 y los 8 de
 * un control de fila. Un cuadrado de 36 al lado de un bloque de 44 se lee como si
 * fuera de otro grupo, que es el mismo argumento que ya obligó a declarar
 * `BTN_ICONO_FRANJA` y `BTN_PRIMARY_LATERAL`.
 *
 * Se declara aquí y no se apaña con un `size-11 rounded-xl` pegado detrás de
 * `botonIcono(...)`: son las mismas utilidades que la pieza ya trae, y ahí gana
 * la que se emita después en el CSS, no la que se escriba al final.
 *
 * La variante es un parámetro, como en `botonBloque`, y por defecto es la SÓLIDA
 * (Mario, sep 2026): donde nació, el cuadrado es la otra mitad de una acción de
 * marca (llamar, junto a escribir por WhatsApp), no un control de apoyo. En línea
 * se leía como si fuera de otro grupo.
 */
export function botonIconoBloque(variant: BtnVariant = 'primary', extra = '') {
  return [
    FORMA, 'rounded-xl', BTN_MOTION, BTN_SUPERFICIE[variant], 'size-11 shrink-0',
    'disabled:pointer-events-none disabled:opacity-60', extra,
  ].filter(Boolean).join(' ')
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
export const BTN_PRIMARY_LATERAL = botonBloque('primary', 'lg:h-9', 'cta-lateral')

// -----------------------------------------------------------------------------
// LOS DOS BOTONES DE LA PANTALLA DE ACCESO (diseño de Mario en Figma, ago 2026).
//
// Rompen tres reglas del sistema a propósito, así que se declaran AQUÍ con el
// motivo escrito en vez de aparecer sueltos en el `className` de `Login.tsx`. Esa
// es la regla que engloba a las demás: lo que se decide, se NOMBRA. El pecado no
// es tener una excepción, es tenerla anónima, porque la anónima es la que nadie
// vuelve a tocar cuando el sistema cambia.
//
// Qué rompen y por qué se acepta:
//
//   · RADIO DE PÍLDORA en vez de los 8px de control. En el sistema la píldora es
//     de chips y avatares, pero esta pantalla no es producto: es la portada por la
//     que se entra, la única superficie donde hay UN botón por decisión y no una
//     fila de controles que tengan que alinearse entre sí. La doctrina ya admite
//     que las superficies externas (landing, formulario público) usen su propia
//     escala de radios; esto es lo mismo un peldaño más allá.
//   · NEGRO en vez de ultramarine. Y el acento no se pierde: sigue siendo lo que
//     pinta el foco y los enlaces de esta misma pantalla. Lo que dice el negro
//     aquí es "esto cierra el formulario", en una pantalla donde no compite con
//     ninguna otra acción.
//   · 56px de alto, por encima de los 44 del bloque. Es el único botón de su
//     pantalla y el último paso de la entrada.
//
// Lo que NO se copia del Figma es la sombra bajo el CTA (`0 6px 8px` al 8%): el
// botón de esta app es PLANO desde ago 2026 y esa decisión se tomó con las
// medidas delante. A esa opacidad la sombra es casi invisible, así que devolverla
// no cambia lo que se ve y sí reabre el "objeto elevado" que se acababa de cerrar.
// Si Mario la quiere, es un token con nombre y una línea aquí.
// -----------------------------------------------------------------------------

/** El CTA que cierra el formulario de acceso: negro, píldora, ancho completo. */
export const BTN_ACCESO = [
  'flex h-14 w-full items-center justify-center gap-2 rounded-full whitespace-nowrap select-none',
  'text-base font-bold text-white',
  'bg-[var(--color-acceso-cta)] hover:bg-slate-900 active:bg-slate-800',
  BTN_MOTION,
  'disabled:pointer-events-none disabled:opacity-60',
].join(' ')

/** El de identidad externa (hoy solo Google): blanco de línea, píldora, 48px. */
export const BTN_ACCESO_SOCIAL = [
  'flex h-12 w-full items-center justify-center gap-2.5 rounded-full whitespace-nowrap select-none',
  'text-sm font-semibold text-slate-900',
  'bg-white filo shadow-control hover:bg-slate-50 hover:filo-slate-300 active:bg-slate-100',
  BTN_MOTION,
  'disabled:pointer-events-none disabled:opacity-60',
].join(' ')

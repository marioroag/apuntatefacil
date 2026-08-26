import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Logo } from './Logo'
import { BRAND, supportMailto } from '../lib/brand'
import { testimoniosPublicables } from '../lib/testimonios'
import lamina from '../assets/acceso.jpg'

// -----------------------------------------------------------------------------
// EL ARMAZÓN DE LAS PANTALLAS DE ACCESO (diseño de Mario en Figma, ago 2026).
//
// Dos columnas, 55 / 45: a la izquierda el formulario, centrado en una columna de
// 418px; a la derecha una lámina con la portada. Sustituye a la tarjeta de 400px
// flotando en el centro de una página gris, que era la misma caja para entrar,
// restablecer la contraseña y aceptar una invitación.
//
// El reparto NO es el 50/50 del Figma (Mario, ago 2026). El 50 estaba dibujado a
// 1440, donde sobra sitio; en un portátil de 1280 dejaba la mitad izquierda en 640
// para una columna de 418 más 80 de relleno, o sea casi sin aire, mientras la
// lámina, que es decoración, se llevaba lo mismo que el formulario. Con 55/45 el
// que trabaja va primero. Los dos anchos se declaran y suman 100: si uno cambia,
// se ve enseguida que el otro tiene que cambiar con él.
//
// POR QUÉ DOS COLUMNAS Y NO UNA TARJETA. La tarjeta centrada trataba el acceso
// como un diálogo: una caja pequeña sobre un fondo vacío, sin nada que mirar. En
// pantalla ancha eso deja el 70% de la superficie sin trabajo que hacer. Partida
// en dos, la mitad izquierda puede respirar (título grande, un solo objetivo por
// fila) y la derecha dice de qué producto es esta puerta, que es lo único que
// falta cuando alguien llega desde un email y no desde la portada.
//
// EN LA LÁMINA VAN LOS TESTIMONIOS, y su contenido tiene una PUERTA. El carrusel
// es el del diseño (cita, persona, flechas), pero solo pinta las entradas marcadas
// como `confirmado` en `lib/testimonios.ts`, y hoy no hay ninguna: la del Figma
// está pendiente de confirmar que la persona es real y ha dado permiso. Mientras el
// array publicable esté vacío, la lámina cae en la promesa del producto en su propia
// voz, que siempre es verdad y no necesita firma.
//
// Esto NO es una objeción de estilo disfrazada de código: la doctrina de copy del
// proyecto prohíbe la prueba social inventada, y una cita firmada por alguien que no
// existe, en la pantalla por la que se entra a un producto que cobra, es justo lo que
// esa regla vino a impedir. La puerta hace que publicarla sea un acto deliberado (ir
// al fichero y poner `true`) en vez de un descuido. El porqué entero está allí.
//
// Las FLECHAS solo aparecen con dos o más: un carrusel de uno es el título repetido,
// que es el mismo argumento que retiró el `tablist` de una sola pestaña del panel.
//
// La columna de la derecha SOLO existe a partir de `lg`. Por debajo, el formulario
// se queda con la pantalla entera: en un móvil no hay sitio para una portada y una
// puerta a la vez, y la que se ha venido a usar es la puerta.
// -----------------------------------------------------------------------------

/**
 * EL CAMPO de estas pantallas. 52px y 16px de letra.
 *
 * Los 16 no son una talla elegida: por debajo de eso, iOS hace zoom al enfocar y la
 * pantalla salta. El diseño los pone en 15 y aquí gana la regla, porque no es
 * estética sino comportamiento. El radio se queda en el del sistema (10px, campos y
 * tarjetas) en vez de los 12 del Figma: la píldora del CTA y los 24 de la lámina SON
 * el gesto del diseño; el radio de un input no.
 *
 * Vive aquí y no en cada pantalla porque ya estaba copiado a mano en dos (`Login` y
 * `ResetPassword`), que es como empiezan siempre.
 */
export const campoAcceso = (invalid: boolean) =>
  `h-[52px] w-full rounded-xl border bg-white px-4 text-base outline-none placeholder:text-slate-500 focus:ring-4 focus:ring-indigo-500/15 ${invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'}`

export const ETIQUETA_ACCESO = 'mb-1.5 block text-sm font-semibold text-slate-800'

/**
 * El titular de cada vista: grande, centrado, y una línea de apoyo.
 *
 * 40px con el tracking de titular, que es lo que el Figma pide y lo que separa esta
 * pantalla del producto: dentro de la app el techo son 24px, pero aquí no hay ni
 * tabla ni filtros compitiendo, solo una decisión. Baja a 32 por debajo de `sm`,
 * donde "¡Bienvenido de nuevo!" a 40 se lleva tres líneas de un móvil.
 */
export function AccesoTitulo({ titulo, sub }: { titulo: string; sub: ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-balance text-[32px] font-bold leading-[1.1] tracking-[-0.012em] text-slate-900 sm:text-[40px]">
        {titulo}
      </h1>
      <p className="mt-3 text-pretty text-base leading-relaxed text-slate-500">{sub}</p>
    </div>
  )
}

/** La promesa del producto, en su propia voz. Es el texto de la portada, no una cita. */
const LAMINA = {
  titular: 'Todas las respuestas a tu anuncio, en un solo lugar.',
  apoyo:
    'Sigue publicando donde siempre. Manda un enlace y cada candidatura entra completa, ordenada y lista para filtrar.',
}

/**
 * La marca, arriba a la izquierda. SOLO donde no hay lámina.
 *
 * En el diseño esta columna no lleva marca: vive como chapa sobre la lámina, y
 * Mario lo confirmó dos veces, primero quitando el wordmark y después el monograma
 * ("con el de la columna derecha nos basta"). Tiene razón en escritorio: dos marcas
 * a la vez en la misma pantalla es la misma cosa dicha dos veces, y encima la de la
 * izquierda competía con el titular de 40px que tiene justo debajo.
 *
 * Se queda POR DEBAJO DE `lg`, y no por nostalgia: ahí la lámina no se monta, así
 * que sin esto la pantalla por la que se entra al producto no diría de qué producto
 * es. A esta se llega desde un enlace de un email tan a menudo como desde la
 * portada, y en ese camino no has visto la marca por ningún sitio. Es la regla de
 * "cada cosa existe una sola vez EN CADA ANCHO": cuando una pieza vive en dos
 * superficies que conviven, una de las dos se apaga por media query.
 *
 * Y va CENTRADA Y PEGADA AL CONTENIDO (Mario, ago 2026). Solo se pinta en una
 * columna, y en una columna todo lo demás está centrado: el titular, su línea de
 * apoyo, el conmutador de modo y el pie. Pegada al filo izquierdo era la única pieza
 * con otro eje, y una marca suelta en una esquina de una columna estrecha se lee
 * como algo que se ha quedado ahí, no como la cabecera de la pantalla.
 *
 * El hueco de debajo se midió antes de tocarlo: eran 56px (32 de su margen más 24
 * del relleno del bloque) contra 28 del filo de arriba, o sea que la marca estaba
 * MÁS CERCA DEL BORDE que del título y por eso se leía como chrome suelto. Sin
 * margen propio se queda en los 24 del bloque, por debajo de esos 28, y pasa a
 * leerse con el titular. Es la regla de que el aire ES jerarquía, en su mitad menos
 * citada: lo que va junto, se junta.
 *
 * Y va en `flex` y no en `inline-flex`: siendo inline arrastraba el interlineado de
 * su caja de línea y el hueco medía 29 en vez de los 24 declarados. Cinco píxeles
 * que nadie pidió y que no aparecen en ninguna clase, que es lo que los hace
 * difíciles de encontrar cuando un día no cuadre.
 */
function Marca() {
  return (
    <Link
      to="/"
      className="mx-auto mb-6 flex w-fit items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 lg:hidden"
    >
      <Logo className="size-8" />
      <span className="sr-only">Volver a la portada de {BRAND}</span>
    </Link>
  )
}

/**
 * El pie legal.
 *
 * El diseño los pinta en `#9ca3af`, que sobre blanco se queda en 2,6:1: son
 * enlaces, o sea texto con significado, y el suelo son 4,5:1. Suben a `slate-500`.
 * Es la regla que esta doctrina ya fijó una vez comparando con una referencia:
 * cuando la referencia y el suelo de contraste chocan, gana el suelo y se anota.
 */
function Pie() {
  const clase = 'rounded-sm hover:text-slate-800'
  return (
    <div className="mt-8 flex shrink-0 items-center justify-center gap-5 text-[13px] font-medium text-slate-500">
      <a href={supportMailto()} className={clase}>
        Ayuda
      </a>
      <span className="h-3 w-px bg-slate-200" aria-hidden />
      <Link to="/terminos" className={clase}>
        Términos
      </Link>
      <span className="h-3 w-px bg-slate-200" aria-hidden />
      <Link to="/privacidad" className={clase}>
        Privacidad
      </Link>
    </div>
  )
}

/** Las dos flechas del carrusel. La de avanzar es la sólida: es la que se usa. */
const FLECHA = 'grid size-10 place-items-center rounded-full outline-none transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2'
const FLECHA_ATRAS = `${FLECHA} bg-[#eeecea] filo-[#e4e2dc] text-[var(--color-acceso-apoyo)] hover:bg-[#e4e2dc]`
const FLECHA_ADELANTE = `${FLECHA} bg-[var(--color-acceso-tinta)] text-white hover:brightness-125`

/**
 * EL CARRUSEL DE TESTIMONIOS.
 *
 * Pinta lo que le den y no conoce ninguna cita: quien decide qué se publica es
 * `lib/testimonios.ts`, y con la lista vacía este componente ni se monta.
 *
 * Marcado de CITA de verdad (`<figure>` + `<blockquote>` + `<figcaption>`) y no
 * tres párrafos: una cita atribuida a una persona tiene etiquetas propias en HTML,
 * y aquí importan más que en ningún sitio, porque lo que se está diciendo es que
 * esto lo ha dicho alguien.
 *
 * El bloque va `justify-end` con la fila de abajo pegada al pie: así las flechas
 * NO se mueven al pasar de una cita a otra, aunque una ocupe dos líneas y la
 * siguiente tres. Un control que se desplaza justo cuando acabas de pulsarlo es lo
 * que obliga a volver a buscarlo con el ratón en cada paso.
 *
 * El `key` en la figura es lo que hace que la entrada se vuelva a animar en cada
 * cambio; `.testimonio-in` es el mismo movimiento que usa el informe de Meridian,
 * declarado una vez en `index.css` y apagado por `prefers-reduced-motion`.
 */
function Testimonios({ lista }: { lista: ReturnType<typeof testimoniosPublicables> }) {
  const [i, setI] = useState(0)
  const varios = lista.length > 1
  const mover = (d: 1 | -1) => setI((n) => (n + d + lista.length) % lista.length)
  const t = lista[i]

  return (
    <div className="relative flex min-h-[233px] flex-col justify-end gap-6 px-9 pb-8 pt-7">
      <figure key={i} className="testimonio-in">
        <blockquote className="text-[26px] font-bold leading-[1.3] tracking-[-0.012em] text-balance text-[var(--color-acceso-tinta)]">
          {`"${t.cita}"`}
        </blockquote>
        <figcaption className="mt-6 text-sm">
          <span className="block font-bold text-[var(--color-acceso-tinta)]">{t.nombre}</span>
          <span className="mt-0.5 block text-[13px] text-[var(--color-acceso-apoyo)]">{t.cargo}</span>
        </figcaption>
      </figure>
      {varios && (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => mover(-1)} className={FLECHA_ATRAS} aria-label="Testimonio anterior">
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => mover(1)} className={FLECHA_ADELANTE} aria-label="Testimonio siguiente">
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * La lámina.
 *
 * `overflow-clip` y no `hidden`: la tarjeta tiene radio y sus hijos son cajas
 * cuadradas que llegan al filo, así que en el arco de la esquina pintarían su
 * fondo encima del borde. `clip` recorta con el mismo radio sin convertirla en
 * contenedor de scroll.
 *
 * La imagen es `object-cover` con las dos medidas atadas al contenedor: la caja
 * cambia de proporción con la ventana y la foto es un fondo abstracto, así que lo
 * que importa es que llene, no qué trozo se ve.
 */
function Lamina() {
  const testimonios = testimoniosPublicables()
  return (
    <div className="relative flex min-h-0 w-full flex-col overflow-clip rounded-3xl bg-[var(--color-acceso-panel)] shadow-acceso">
      <div className="relative min-h-0 flex-1">
        <img src={lamina} alt="" className="absolute inset-0 size-full object-cover" />
        {/* Donde la foto muere en el marfil para que el texto no se apoye en un corte. */}
        <div className="acceso-fundido absolute inset-x-0 bottom-0 h-[250px]" aria-hidden />
      </div>
      {testimonios.length > 0 ? (
        <Testimonios lista={testimonios} />
      ) : (
        <div className="relative flex min-h-[233px] flex-col justify-end px-9 pb-8 pt-7">
          <p className="text-[26px] font-bold leading-[1.3] tracking-[-0.012em] text-balance text-[var(--color-acceso-tinta)]">
            {LAMINA.titular}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-pretty text-[var(--color-acceso-apoyo)]">{LAMINA.apoyo}</p>
        </div>
      )}
      {/* La chapa de marca sobre la foto. Blanca, que es lo que la separa del fondo:
          la sombra solo la confirma, como en cualquier otra superficie apoyada.

          Y ES UN ENLACE, no un adorno. Al quitar la marca de la columna izquierda en
          escritorio se fue con ella la única vuelta a la portada que tenía esta
          pantalla: quedaba el botón del navegador y nada más, y a /login se llega
          tantas veces desde un email como desde la portada. Si la marca de la derecha
          es la que basta, tiene que hacer también lo que hacía la otra. */}
      <Link
        to="/"
        className="absolute left-5 top-5 grid size-9 place-items-center rounded-xl bg-white shadow-card outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      >
        <Logo className="size-5" />
        <span className="sr-only">Volver a la portada de {BRAND}</span>
      </Link>
    </div>
  )
}

/**
 * Tres filas en la columna del formulario: marca, contenido y pie.
 *
 * Y NO una columna centrada con el pie en `absolute`, que es como lo resuelve el
 * Figma: con el pie fuera del flujo, en una ventana baja (o con el formulario de
 * alta desplegado, que es el más largo de los cuatro) se monta encima del último
 * campo. Con la rejilla, el contenido se centra en LO QUE SOBRA y el pie no puede
 * pisarlo nunca.
 *
 * LAS TRES FILAS COMPARTEN LA COLUMNA DE 418px, no solo la de en medio. Con la
 * marca colgada del relleno de la mitad izquierda, se quedaba 87px por delante del
 * filo del formulario (medido): dos bordes izquierdos en una columna que tiene que
 * leerse como una. El aire sobrante se deja donde cae, a los lados, en vez de
 * repartirlo entre piezas que no se alinean con nada.
 *
 * LA PANTALLA MIDE EL VIEWPORT Y NI UN PÍXEL MÁS (Mario, ago 2026): `h-svh`, no
 * `min-h`. Es la lámina la que lo pide: una lámina que asoma por debajo del pliegue
 * deja de ser una lámina y pasa a ser un fondo largo, y con `min-h` el alto de la
 * página lo acababa fijando el formulario de ALTA (el más largo de los cuatro, con
 * sus reglas de contraseña y su casilla de términos), así que la portada crecía o
 * encogía según en qué modo estuvieras.
 *
 * Lo que se paga y dónde se paga: cuando el formulario no cabe, el que se desplaza
 * es ÉL, dentro de su mitad, y la lámina no se mueve. Es la regla de "una
 * superficie, un scroll" aplicada a dos columnas: cada una manda en lo suyo y la
 * página nunca se desplaza entera.
 *
 * Y SE CLAVA SOLO A PARTIR DE `lg`, o sea justo donde hay lámina. Por debajo no hay
 * nada que clavar y sí algo que perder: un scroll interno en un móvil se come el
 * rebote nativo y el repliegue de la barra de direcciones, y deja el contenido
 * atrapado en una caja fija mientras el teclado sube. Ahí manda `min-h-svh` y se
 * desplaza la PÁGINA, como en cualquier formulario de teléfono.
 */
export function AccesoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-white lg:h-svh lg:overflow-hidden">
      {/* `items-start` y NO el estirado por defecto del flex, que es lo que cuesta
          un fallo si se olvida: estirando, la rejilla recibe un ALTO exacto (el de
          la ventana) en vez de un mínimo, así que su fila elástica no puede crecer y
          el formulario de alta se derramaba POR ENCIMA del pie (medido: el pie a
          759 y el botón acabando en 856). Con el alto en `min-h-full`, la rejilla
          mide la ventana cuando sobra sitio y crece cuando no, que es justo lo que
          el scroll de esta columna necesita por debajo. */}
      {/* EL AIRE DE ARRIBA Y ABAJO SE ENCOGE EN PANTALLAS BAJAS, y esto es lo que
          hace que "el alto es el viewport" se sostenga en un portátil de verdad. El
          Figma se dibujó a 900px y ahí sus 72+56 de relleno sobran; a 720, que es
          media de portátil, la entrada se salía 45px y el pie caía por debajo del
          pliegue (medido). Como el contenido va centrado por la fila elástica, este
          relleno solo actúa de MÍNIMO: encogerlo no mueve nada en una pantalla alta y
          en una baja es justo lo que devuelve el pie a su sitio. Se toca el chrome
          antes que el contenido; el formulario no se aprieta. */}
      <div className="flex w-full items-start justify-center px-5 pb-8 pt-7 sm:px-10 lg:w-[55%] lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:px-10 lg:pb-14 lg:pt-[72px] xl:px-20 [@media(max-height:820px)]:lg:pb-8 [@media(max-height:820px)]:lg:pt-8">
        {/* COLUMNA FLEX Y NO UNA REJILLA DE TRES FILAS, y esto costó un fallo real:
            con `grid-rows-[auto_1fr_auto]`, la marca se apaga por media query en
            escritorio (`display:none`), o sea que deja de ser un ítem de la rejilla,
            y las dos piezas que quedan se corren una fila: el formulario se metía en
            la fila FIJA y el pie en la elástica. Resultado medido: el pie a 615 y el
            botón acabando en 712, uno encima del otro. Una columna flex coloca por
            orden y no por número de fila, así que apagar un hijo no descoloca a los
            demás. Regla: si un hijo puede desaparecer por media query, no se le pone
            número de fila. */}
        <div className="flex w-full min-h-full max-w-[418px] flex-col">
          <main className="flex flex-1 items-center justify-center">
            <div className="w-full py-6">
              {/* La marca va DENTRO del bloque centrado, no anclada arriba del todo.
                  Anclada, el hueco hasta el titular no lo ponía su margen sino la
                  holgura que `main` reparte al centrar: 109px medidos en un móvil de
                  812, contra los 28 del filo de arriba. O sea que bajarle el margen no
                  hacía nada, porque el margen no era quien mandaba. Metida en el
                  bloque, viaja con el contenido y su hueco es el que se declara. */}
              <Marca />
              {children}
            </div>
          </main>
          <Pie />
        </div>
      </div>
      <aside className="hidden p-8 lg:flex lg:w-[45%] lg:shrink-0">
        <Lamina />
      </aside>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMenosMovimiento } from '../lib/media'

// El marco del navegador del hero va EN CÓDIGO y solo la pantalla es una captura.
// Dibujado, el cromo queda nítido a cualquier tamaño y no arrastra el peso de un
// PNG; la captura de dentro sale de la demo (`scripts/captura-hero.sh`), así que
// enseña el producto de verdad y se regenera cuando la pantalla cambia, en vez de
// ser una réplica a mano que se queda vieja sin que nadie se entere (que es
// justamente lo que le pasó a `BrowserMock`).
// LA BARRA DEL NAVEGADOR, UNA SOLA VEZ. La usan la ventana grande y la tarjeta
// del tablón, y por eso está aquí y no copiada en las dos: son la misma pieza y
// dos copias se separan al primer retoque.
//
// Rejilla de tres columnas con las dos laterales a 1fr, así que la barra de
// direcciones queda centrada respecto a la VENTANA pase lo que pase a los lados.
// Con un contrapeso escrito a mano hay que reajustarlo cada vez que cambie un
// icono, y se descuadra en silencio.
//
// COMPACTA se queda en el SEMÁFORO, sin flechas ni dirección, y no es un recorte
// por pereza: la tarjeta mide 300px, así que su barra proporcional daría una
// dirección de 3px, o sea una mancha gris donde debería leerse un dominio. Los
// tres círculos son la parte que se reconoce sin leer, igual que la isla basta
// para que el teléfono se lea como un teléfono.
function BarraNavegador({ compacta = false }: { compacta?: boolean }) {
  if (compacta)
    return (
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="size-2 rounded-full bg-[#ff5f57]" />
        <span className="size-2 rounded-full bg-[#febc2e]" />
        <span className="size-2 rounded-full bg-[#28c840]" />
      </div>
    )
  return (
    <div className="grid grid-cols-[1fr_46%_1fr] items-center border-b border-slate-200 bg-slate-100 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57] sm:size-3" />
        <span className="size-2.5 rounded-full bg-[#febc2e] sm:size-3" />
        <span className="size-2.5 rounded-full bg-[#28c840] sm:size-3" />
        <span className="ml-2 hidden items-center gap-1 text-slate-400 sm:flex">
          <ChevronLeft className="size-4" aria-hidden />
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </div>
      <div className="rounded-lg bg-white py-1 text-center text-[10px] text-slate-500 filo sm:py-1.5 sm:text-xs">
        apuntatefacil.com
      </div>
    </div>
  )
}

export function AppShot({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-clip rounded-2xl filo bg-white shadow-pop ${className}`}>
      <BarraNavegador />
      <Pantallas />
    </div>
  )
}

/**
 * LA VENTANA VA PASANDO POR CUATRO PANTALLAS (Mario, ago 2026).
 *
 * Una sola captura enseña UNA cosa, y el hero tenía que decir que esto es un
 * producto entero: dónde se mira el día (Vista general), cómo se mueve la gente
 * (el tablero), qué sabes de una persona (su ficha, con lo que ha mandado) y qué
 * tienes por delante (la agenda). Contado con palabras serían cuatro frases que
 * nadie lee; contado así se ve.
 *
 * Las cuatro salen de la demo con el mismo script y a la misma medida exacta, que
 * es lo que permite apilarlas sin que el marco pegue un salto al cambiar.
 */
// El orden cuenta algo: primero dónde se mira el día, luego el MISMO puesto en
// tablero y en tabla (dos formas de ver lo mismo, y eso solo se entiende viéndolas
// seguidas), después lo que sabes de una persona y por último lo que tienes por
// delante.
//
// LA FICHA NO ES UNA PANTALLA, ES UNA CAPA SOBRE LA TABLA (Mario, ago 2026). Se
// capturó al principio como pantalla entera y traía un problema que no merecía la
// pena arreglar: llevaba SU PROPIO lateral, con otra fila activa que la de la
// tabla, así que al llegar su turno el menú daba un salto. Declarada como `encima`
// del mismo fondo, el paso 3 y el 4 comparten fondo, no se dispara ninguna
// transición debajo y lo único que pasa es que se abre una ficha desde la lista.
// Que es, exactamente, lo que pasa de verdad.
const PANTALLAS: { fondo: string; encima?: string }[] = [
  { fondo: 'panel' },
  { fondo: 'tablero' },
  { fondo: 'tabla' },
  { fondo: 'tabla', encima: 'ficha' },
  { fondo: 'entrevistas' },
]

// Los fondos DISTINTOS, en orden de aparición. La tabla sale una sola vez aunque
// dos pasos la usen: si se montara dos veces, el fundido encadenado la apagaría
// entre el paso 3 y el 4 para volver a encenderla idéntica, o sea un parpadeo por
// nada.
const FONDOS = [...new Set(PANTALLAS.map((p) => p.fondo))]

/**
 * DÓNDE ACABA EL LATERAL: 512 de los 3024 de la captura (el `<aside>` mide 256 CSS
 * y la captura va a 2x). Las dos capas son LA MISMA IMAGEN a tamaño completo, y lo
 * que las separa es un RECORTE, no dos ficheros.
 *
 * Se probó partiendo la captura en dos ficheros y **se perdió nitidez**, que es
 * justo lo que menos se puede perder aquí: las piezas pasaban a medir 191,656 y
 * 940,34px de ancho en vez de los 1132 enteros de la imagen completa, y un ancho
 * fraccionario obliga a remuestrear con fase sub-píxel. En una captura de interfaz
 * ya reducida a un tercio, eso se ve: el texto de 11px se ablanda.
 *
 * `clip-path` no remuestrea, TAPA. Las dos capas se rasterizan con la misma
 * geometría que tenía la imagen entera, así que la nitidez es exactamente la de
 * antes, y encima vuelve a haber un solo fichero por pantalla.
 */
const RECORTE_LATERAL = 'inset(0 83.0688% 0 0)'
const RECORTE_CONTENIDO = 'inset(0 0 0 16.9312%)'

// Cuánto se queda puesta cada pantalla. Subió de 3600 al calmar el paso entre
// ellas (Mario, ago 2026): un cambio suave cada tres segundos sigue siendo un
// cambio cada tres segundos, así que la mitad de "tranquilizar" es dejar más rato
// quieta la que está. Con la transición de 820ms, quedan unos 3,8s de reposo.
const PASO_MS = 4600

function Pantallas() {
  const menosMovimiento = useMenosMovimiento()
  const [actual, setActual] = useState(0)
  const { fondo, encima } = PANTALLAS[actual]

  useEffect(() => {
    // Quien pide menos movimiento se queda en la primera: un carrusel que gira
    // solo es contenido en movimiento, y la salida estándar para eso es no
    // moverlo. Se paga que solo vea una de las cuatro, y es lo correcto: las
    // otras tres son la misma promesa contada de otra manera, no información que
    // falte en ninguna otra parte de la página.
    if (menosMovimiento) return
    const id = setInterval(() => setActual((i) => (i + 1) % PANTALLAS.length), PASO_MS)
    return () => clearInterval(id)
  }, [menosMovimiento])

  return (
    /*
     * La caja declara la PROPORCIÓN de la captura (3024x1720) porque las cuatro
     * van en `absolute` y ninguna puede dar el alto. Es el mismo número que el
     * script garantiza al generarlas juntas.
     *
     * `role="img"` con UNA etiqueta, y las cuatro imágenes con `alt=""`: un
     * carrusel que gira solo anunciando cuatro textos distintos es ruido para
     * quien usa lector, y lo que hay que saber es qué se está enseñando, no en
     * qué fotograma va.
     */
    <div
      // El fondo es el de TRABAJO de la app, y no es decorativo: entre una
      // pantalla y la siguiente no hay ninguna encima (ver `.hero-pantalla` en
      // index.css), así que lo que se ve durante ese hueco es esto. Con blanco
      // pegaría un fogonazo; con el gris de la app parece que se está pintando
      // la pantalla siguiente.
      className="relative aspect-[3024/1720] w-full bg-slate-50"
      role="img"
      aria-label="El producto por dentro: la vista general con su gráfica, el tablero de un puesto, la ficha de un candidato con su CV y su DNI, y la agenda de entrevistas."
    >
      {/* EL LATERAL NO SE VACÍA, SE FUNDE (Mario, ago 2026). De una pantalla a la
          siguiente ahí solo cambia la fila activa, así que apagarlo entero era
          tirar abajo algo que casi no cambia: lo que da la sensación de app es
          justo lo contrario, que el menú se quede y se le encienda otra fila
          mientras el contenido se repinta. Y va ANTES que el contenido, como
          cuando pulsas de verdad: primero se marca a dónde vas y luego llega. */}
      {FONDOS.map((n, i) => (
        <img
          key={`lat-${n}`}
          src={`/hero-${n}.webp`}
          alt=""
          width={3024}
          height={1720}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
          className="hero-lateral absolute inset-0 block size-full"
          style={{ clipPath: RECORTE_LATERAL }}
          data-activa={n === fondo ? 'true' : undefined}
        />
      ))}
      {FONDOS.map((n, i) => (
        <img
          key={`cont-${n}`}
          src={`/hero-${n}.webp`}
          alt=""
          width={3024}
          height={1720}
          loading={i === 0 ? 'eager' : 'lazy'}
          // La primera es la que se ve al entrar y la que mide el LCP; las otras
          // están en pantalla desde el principio (así que `lazy` no las aplaza),
          // pero sí se puede pedir que se descarguen las últimas.
          fetchPriority={i === 0 ? 'high' : 'low'}
          className="hero-pantalla absolute inset-0 block size-full"
          style={{ clipPath: RECORTE_CONTENIDO }}
          data-activa={n === fondo ? 'true' : undefined}
        />
      ))}
      {/* La ficha, sobre transparente y a tamaño completo: se coloca sola. */}
      <img
        src="/hero-ficha.webp"
        alt=""
        width={3024}
        height={1720}
        loading="lazy"
        fetchPriority="low"
        className="hero-ficha absolute inset-0 block size-full"
        data-activa={encima ? 'true' : undefined}
      />
    </div>
  )
}

// EL MISMO PRODUCTO EN EL OTRO LADO: el anuncio que ve el candidato, en su móvil.
// Al lado del panel dice de un vistazo lo que el hero no puede decir con palabras
// sin alargarse: que esto son DOS superficies, la de quien contrata y la de quien
// se apunta, y que la segunda lleva la cara de la empresa.
//
// El marco va en código y la pantalla es una captura de la demo, igual que el
// navegador de arriba; la geometría (canto uniforme y radios concéntricos) vive en
// `index.css` bajo `.hero-movil`, que es donde se explica por qué son tres medidas
// atadas a una sola.
//
// SIN BARRA DE ESTADO, y no es un olvido: la hora y la batería habría que
// INVENTARLAS, y un dato inventado en la pantalla que enseña el producto es
// justamente lo que esta casa no hace. La isla basta para que se lea como un
// teléfono moderno, que es todo lo que tiene que decir el marco.
export function MovilShot({ className = '' }: { className?: string }) {
  return (
    <div className={`hero-movil bg-slate-900 shadow-pop ${className}`}>
      {/* El `relative` va AQUÍ y no en el cuerpo, y no es cosmético: quien monta
          esta pieza la coloca (`absolute`), y `relative` y `absolute` son la MISMA
          utilidad de Tailwind, así que no se resuelven por el orden en que se
          escriben en el `className` sino por el orden en que Tailwind las emite,
          que da la victoria a `relative`. Se vio en pantalla: el teléfono se
          quedaba en el flujo, debajo de la captura, estirando la ventana 486px.
          La salida es la de siempre, la variante que NO pone lo que hay que
          anular; y la isla se cuelga de la pantalla, que es de lo que es parte. */}
      <div className="relative">
        <img
          src="/hero-anuncio.webp"
          alt="El anuncio de un puesto de mozo de almacén en un móvil: la foto del almacén, el sueldo, el contrato y el botón de apuntarse."
          width={780}
          height={1688}
          loading="lazy"
          className="hero-movil-pantalla block w-full"
        />
        <span
          className="hero-movil-isla absolute left-1/2 -translate-x-1/2 rounded-full bg-slate-900"
          aria-hidden
        />
      </div>
    </div>
  )
}

// Y EL TERCER LADO: lo que pasa ENTRE la gente que contrata. El panel enseña los
// datos y el teléfono lo que ve el candidato; esto enseña que detrás hay un equipo
// repartiéndose el trabajo (uno propone dos candidatos de la base, otra le nombra
// para preguntarle quién escribe). Es la parte del producto que no se ve en una
// captura de pantalla llena de filas.
//
// Un recorte de verdad del hilo del tablón, no una recreación: sale de la demo con
// `scripts/captura-hero-tablon.sh`, que lo BUSCA por su texto y lo encuadra solo.
//
// Aquí no hace falta CSS aparte, a diferencia del teléfono: no hay medidas
// derivadas de otras (ni canto, ni radios concéntricos), solo un ancho por talla.
export function TablonShot({ className = '' }: { className?: string }) {
  return (
    <div
      className={`hero-tablon w-64 overflow-clip rounded-xl filo bg-white shadow-pop xl:w-72 ${className}`}
    >
      <BarraNavegador compacta />
      <div className="p-3.5">
        <img
          src="/hero-tablon.webp"
          alt="Un hilo del tablón de equipo: Sergio propone dos candidatos de la base y Laura le menciona para preguntarle quién les escribe."
          width={840}
          height={380}
          loading="lazy"
          className="block w-full"
        />
      </div>
    </div>
  )
}

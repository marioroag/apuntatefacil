// -----------------------------------------------------------------------------
// LA FILA DEL LATERAL. Vocabulario único.
//
// Vive en su propio módulo y no dentro de `Sidebar.tsx` por una razón concreta:
// las Notificaciones son una fila del menú y las pinta `Avisos.tsx` (porque el
// contador y la disponibilidad los sabe él), así que si las clases vivieran en
// el lateral habría un ciclo de imports, y si se copiasen a mano tendríamos dos
// filas que empiezan iguales y se separan al primer retoque. Que es exactamente
// como el botón de la app acabó teniendo nueve clones.
//
// Una sola geometría para todas: icono de 18, hueco de 16 y etiqueta a 48px del
// filo interior de la fila (o sea, 64 desde el filo del menú), que es la columna
// sobre la que está construido todo lo demás y NO se mueve.
//
// EL ICONO BAJÓ DE 20 A 18 Y EL HUECO SUBIÓ DE 14 A 16, y es el hallazgo de la
// referencia de ago 2026: lo que la hacía verse mejor no era el tamaño general,
// era el REPARTO entre glifo y palabra. Medido en proporciones, su icono mide
// **0,94 veces** la altura de mayúscula de su etiqueta; el nuestro medía **1,98**,
// o sea el doble. Un menú se lee por los NOMBRES, y ahí los iconos pesaban el
// doble que las letras a las que acompañan. Su hueco entre glifo y palabra
// también era mayor que el icono (1,16 contra nuestro 0,70).
//
// Los dos cambios se compensan a propósito (18 + 16 = 20 + 14): la etiqueta sigue
// arrancando en los mismos 64px, así que las filas hijas, el raíl de las
// sublistas y el wordmark de la marca no se enteran. Cambiar el reparto sin mover
// la columna es lo que evita una cascada de retoques.
// Lo que cambia de una fila a otra es qué la envuelve (un enlace, un botón, un
// plegable), nunca su forma.
//
// EL ALTO ES 40px EN ESCRITORIO, con 6 de hueco. Dos ajustes, y el segundo NO
// deshace al primero.
//
// (1) De 42+4 a 34+6 (JOIN, ago 2026). Su paso entre filas era de 40 con una
// píldora de 30, o sea 10 de hueco; el nuestro, 46 con una de 42: 4 de hueco.
// Mismo espacio, repartido al revés. Su fila se lee como un OBJETO rodeado de
// aire y la nuestra como una losa que casi toca a su vecina. La regla que quedó:
// **en una lista de filas con fondo, el aire va ENTRE las píldoras, no DENTRO.**
//
// (2) Con la referencia de ago 2026 ("copiemos estos tamaños") la píldora subió a
// 40 y Mario lo revirtió al verlo: "siento que hay demasiado espacio entre
// botones". Tenía razón, y el fallo fue MÍO al medir: de las cuatro proporciones
// que saqué de esa captura me apoyé en la MENOS fiable.
//
//   - `píldora / paso` = 0,90. Es la peor: se lee sobre una imagen sin anclar y
//     ±5px en cualquiera de las dos medidas la mueve entre 0,82 y 0,98.
//   - `altura de mayúscula / píldora` = 0,33. Es mucho mejor: las dos medidas
//     están en el MISMO eje y en el mismo objeto, así que un error de lectura se
//     va en las dos a la vez y el cociente aguanta.
//
// Con texto de 15px (mayúscula ~10,8), ese 0,33 pide una píldora de **32,7**, no
// de 40. La fila se queda en 34 (0,32) y el paso vuelve a 40. La regla que se
// saca, que vale para la próxima captura: **entre dos proporciones que se
// contradicen, gana la que mide dos cosas del mismo eje.**
//
// Lo que sí sobrevive de esa referencia es lo importante, que es el reparto entre
// glifo y palabra (icono 18, hueco 16, texto 15): ver la cabecera de arriba.
//
// En táctil sube a 44px (`h-11`), que es el objetivo de toque mínimo: la densidad
// de escritorio no se paga con un dedo que falla. Mismo criterio que el botón.
//
// El foco lleva `ring-offset` del color del lateral y no del blanco: sobre la
// superficie recesiva, un halo blanco se vería como una segunda línea.
//
// -----------------------------------------------------------------------------
// EL LATERAL CONTRAÍDO: la misma fila, más estrecha. NADA CAMBIA DE SITIO.
//
// Cuando el raíl se estrecha a 64px, `<nav>` se marca con `data-contraido` y de
// ahí cuelgan las variantes `group-data-[contraido]/lateral:` de este fichero. Se
// hace con CSS y no con una prop porque las filas las pintan TRES ficheros (el
// lateral, `Avisos.tsx` y, en el pie, `CuentaMenu`): con una prop habría que
// enhebrarla por los tres y acordarse en cada fila nueva.
//
// LA REGLA QUE MANDA AQUÍ, y que costó rehacer esto entero (Mario, ago 2026: "se
// teletransporta a los lados al darle al botón"): **con el ancho animándose, NADA
// de dentro puede cambiar de caja.** La primera versión ponía a las filas un
// `w-[34px] justify-center px-0`, o sea que en el fotograma 0 el icono saltaba de
// 30 a 22 y las etiquetas desaparecían de golpe, mientras la caja tardaba 240ms
// en llegar. El ojo lee eso como dos movimientos que no van juntos, y da igual lo
// bien que se anime el contenedor.
//
// Lo que se hace en su lugar, y son tres cosas:
//  1. La fila NO cambia de anatomía: sigue `w-full` con su relleno de 14 y su
//     hueco de 14. Su ancho lo dicta el raíl, que se está animando, así que
//     encoge FOTOGRAMA A FOTOGRAMA en vez de saltar.
//  2. Lo que sobra se DESVANECE (`opacity`), que no es una propiedad de layout:
//     la etiqueta, el chevron y las chapas se apagan mientras la caja encoge.
//     Siguen ocupando su sitio en el flujo, y por eso la fila lleva
//     `overflow-hidden`: lo que ya no cabe se recorta por el lado derecho en vez
//     de empujar al icono.
//  3. El ICONO se queda donde está y solo se desplaza lo que le mueva el RELLENO
//     del contenedor, que también se anima (16 -> 8). Esos 8px son justo los que
//     dejan el glifo centrado en un raíl de 64: 8 de contenedor + 14 de fila + 10
//     de medio icono = 32, la mitad exacta.
//
// A `opacity: 0` el texto SIGUE existiendo para el lector de pantalla, así que la
// etiqueta no hace falta esconderla aparte: es el nombre accesible del enlace y
// se queda puesto. El texto visible lo devuelve el tooltip, que monta quien pinta
// la fila.
//
// Las clases van ESCRITAS ENTERAS y no compuestas con una constante de prefijo:
// Tailwind busca nombres de clase COMPLETOS en el código fuente, así que un
// `${PREFIJO}opacity-0` no se generaría nunca y la regla no existiría en el CSS.
// Ya pasó una vez en este proyecto con el chevron del `<select>`.
// -----------------------------------------------------------------------------

/* -----------------------------------------------------------------------------
   EL RELEVO: primero se va lo que sobra, después llega lo que entra.
   -----------------------------------------------------------------------------
   Todo lo que aparece o desaparece con el ancho del raíl (las etiquetas, los
   chevrones, las cifras, y los dos rótulos del CTA del pie) se apaga con
   `opacity` y no con `display`, que es layout y saltaría.

   LO QUE CAMBIÓ EN AGO 2026, y lo pidió Mario mirándolo ("esta animación al
   expandirse/retraerse se ve escalonada"): estos apagados llevaban el reparto de
   un CONTROL (`--duration-control` con `--ease-out`, o sea 150ms con la curva que
   llega al 62% en el 20% del tiempo) y eso los hacía terminar ANTES de que el
   raíl se moviera de sitio. Medido fotograma a fotograma: a los 28ms el relevo
   iba ya 0,31/0,69 y a los 65ms estaba HECHO, con el raíl todavía en 250 de 256.
   El texto se evaporaba y LUEGO se movía la caja: dos movimientos, o sea el
   escalón. La curva no estaba mal elegida por gusto, estaba mal elegida por
   REGLA: `--ease-out` es "responde a tu dedo" y esto no responde a nada, esto
   acompaña a una caja que se transforma.

   Ahora cada mitad ocupa la mitad del recorrido de la forma, y la duración se
   escribe como una CUENTA sobre `--duration-max` en vez de como un cuarto número
   suelto: el vocabulario sigue teniendo tres duraciones.

   Y LO QUE HACE QUE FUNCIONE EN LAS DOS DIRECCIONES ES EL RETARDO, declarado en
   cada ESTADO y no en la clase base: una transición coge sus tiempos del estado
   de DESTINO, así que el retardo que escribe el estado ancho es el que se usa al
   EXPANDIR, y el que escribe el estrecho, el que se usa al CONTRAER. Con eso, en
   los dos sentidos lo que se va sale en la primera mitad y lo que llega entra en
   la segunda, sin pisarse a media opacidad (que es lo que emborrona el centro de
   un botón donde dos rótulos se cruzan en el sitio).

   Además resuelve solo lo que antes obligaba a correr: **el texto no puede estar
   puesto cuando la caja ya lo recorta a media palabra.** La etiqueta de una fila
   se empieza a cortar cuando el raíl baja de ~165px, y eso pasa a los ~115ms de
   los 240; llegando o yéndose en la mitad que le toca, nunca coincide con el
   recorte.
----------------------------------------------------------------------------- */

/** La transición del relevo. Los TIEMPOS no van aquí: los declara cada estado,
 *  porque irse y llegar no duran lo mismo (ver justo debajo). */
const RELEVO = 'transition-opacity ease-[var(--ease-standard)] motion-reduce:transition-none'

/**
 * IRSE TIENE FECHA LÍMITE; LLEGAR NO. De ahí la asimetría.
 *
 * Lo que se va tiene que estar apagado ANTES de que la caja lo recorte a media
 * palabra, así que ocupa media transición y arranca sin retardo. Medido en el
 * raíl: la etiqueta más larga ("Notificaciones", 104px) deja de caber cuando el
 * raíl baja de 177, y eso pasa a los ~96ms de los 240.
 *
 * Lo que llega no tiene esa prisa, así que ocupa la transición ENTERA y solo
 * espera un cuarto: a los 96ms (que es cuando ya cabe) va por el 5% de opacidad,
 * o sea invisible mientras podría verse cortado, y a partir de ahí sube despacio.
 *
 * ESTO ES LO QUE ARREGLA EL PARPADEO (Mario, ago 2026: "al expandir, los botones
 * y el logo aparecen de un parpadeo un poco brusco"). Con las dos mitades iguales
 * (120ms cada una), aparecer costaba **80ms para el 80% del cambio** y encima
 * empezaba con la caja ya casi parada: nada, nada, nada, y de golpe todo. Lo que
 * se nota no es cuándo empieza, es la VELOCIDAD: repartido sobre los 240, el pico
 * de cambio baja de 1,7 a 0,8 puntos de opacidad por milisegundo, la mitad.
 *
 * Se paga que la letra termine de asentarse 60ms después de que el menú haya
 * llegado. Es a propósito, y es el patrón de siempre: **primero llega el
 * continente y después el contenido.**
 *
 * Y van ESCRITOS ENTEROS en cada estado, no compuestos con una constante:
 * Tailwind busca nombres de clase COMPLETOS en el código fuente, así que una
 * clase armada con un prefijo en una variable no se generaría nunca. Ya pasó una
 * vez en este proyecto con el chevron del `<select>`.
 *
 *   · llegar (`duration-max` con un cuarto de retardo)  ->  lo declara el ancho
 *   · irse   (media `duration-max`, sin retardo)        ->  lo declara el estrecho
 */
const DESVANECE =
  `${RELEVO} duration-[var(--duration-max)] delay-[calc(var(--duration-max)/4)] ` +
  'group-data-[contraido]/lateral:opacity-0 ' +
  'group-data-[contraido]/lateral:duration-[calc(var(--duration-max)/2)] ' +
  'group-data-[contraido]/lateral:delay-0'

export const FILA =
  'flex h-11 w-full items-center gap-4 overflow-hidden rounded-xl px-3.5 text-[15px] font-medium outline-none lg:h-[34px] transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)]'

/** LA ETIQUETA de una fila. Se declara aquí y no se escribe en cada sitio porque
 *  contraído tiene que desaparecer de la vista SIN desaparecer del lector: en
 *  `sr-only` sigue siendo el nombre accesible del enlace o del botón, que es lo
 *  único que impide que el raíl contraído sea una columna de dibujos anónimos.
 *  `text-left` va incluido porque la mitad de las filas son `<button>`, y ahí el
 *  texto se centraría solo. */
export const FILA_ETIQUETA = `min-w-0 flex-1 truncate text-left ${DESVANECE}`

/** Lo que solo tiene sentido con el raíl ancho: el chevron de un plegable, la
 *  chapa de avisos, el punto del final de una fila. No se desmonta, se apaga:
 *  desmontarlo cambiaría el ancho del contenido en el fotograma 0 y empujaría al
 *  icono, que es justo lo que esta versión vino a quitar. */
export const FILA_SOLO_ANCHO = DESVANECE

/** En reposo. La etiqueta va en TINTA PLENA (`slate-900`), no en gris de apoyo:
 *  una fila del menú es un destino, no un pie de foto, y en gris medio sobre
 *  blanco la columna entera se lee borrosa. Es la diferencia que se veía
 *  comparando con JOIN, más que ningún tamaño.
 *
 *  SEGUNDA SUBIDA (Mario, ago 2026: "los iconos y los textos más oscuros"): de
 *  `slate-800` a `slate-900`, o sea de 14,7:1 a **17,8:1**. Y no va sola: la
 *  sube el ICONO, que pasa de 700 a 800 (10,4 -> 14,7) y necesita que su
 *  etiqueta se aparte para seguir sentándose medio peldaño por debajo, que es la
 *  regla que impide que la columna de glifos compita con la de nombres.
 *
 *  Lo que se paga y se declara: la fila activa ya NO se distingue por la tinta de
 *  su etiqueta (las dos son 900). La dicen su fondo (`--color-lateral-activo`) y
 *  su icono, que sí sube de 800 a 900. Es coherente con lo que esta doctrina ya
 *  hizo con el peso: el estado no cambia el cuerpo de la letra, y ahora tampoco
 *  su color; lo dice la superficie.
 *
 *  El hover tiene peldaño propio
 *  (`--color-lateral-hover`): tiene que distinguirse del riel Y del activo, y
 *  entre dos grises tan juntos eso no sale de una opacidad puesta a ojo.
 *
 *  El PESO no vive aquí sino en `FILA`, y eso no es un detalle de orden: si cada
 *  estado declarase el suyo, volver a descuadrarlos sería cuestión de tocar uno.
 *  Declarado una vez en la base, ningún estado puede cambiar el cuerpo de la
 *  letra sin que se note al escribirlo. */
export const FILA_QUIETA = 'text-slate-900 hover:bg-[var(--color-lateral-hover)]'

/** ESTÁS AQUÍ. Fondo recesivo + tinta, y **SIN cambiar el peso de la letra**
 *  (Mario, ago 2026). Llegó a subir a `font-semibold` y se retiró por lo mismo
 *  que en las pestañas: una etiqueta que engorda al activarse mueve todo lo que
 *  tiene al lado, y en una columna de nombres el ojo lo lee como un temblor, no
 *  como un énfasis. Aquí además el ancho no era el problema (la fila mide lo
 *  mismo), lo era el propio salto de la letra al pasar de una fila a otra.
 *
 *  Ninguna de las dos señales es color de marca: el acento salió de la
 *  navegación con la identidad nueva y se quedó solo en la acción (Crear
 *  puesto), el foco y la selección. */
export const FILA_ACTIVA = 'bg-[var(--color-lateral-activo)] text-slate-900'

/** La capa que abre esta fila está desplegada.
 *
 *  Pinta lo MISMO que el activo desde que este dejó de llevar peso, y se queda
 *  como constante aparte a propósito: son dos ideas distintas (estar en un sitio
 *  y tener un panel abierto) y no pueden chocar, porque el registro obliga a que
 *  una fila lleve `to` o `capa`, nunca las dos. Separadas, la que se retoque un
 *  día no arrastra a la otra. */
export const FILA_ABIERTA = 'bg-[var(--color-lateral-activo)] text-slate-900'

// -----------------------------------------------------------------------------
// UNA FILA QUE SE PARTE EN DOS: la etiqueta LLEVA y el chevron PLIEGA.
//
// Hace falta desde que "Candidatos" tiene hijos (ago 2026). Es distinta de
// "Puestos", que se pliega con la fila entera, y la diferencia no es un capricho:
// **Puestos no navega porque no hay ninguna pantalla de "todos los puestos" a la
// que ir**, así que su fila solo puede hacer una cosa y la hace entera. Candidatos
// sí tiene un sitio (Activos), y una fila que llevara Y plegara con el mismo
// click obligaría a adivinar cuál de las dos cosas va a pasar. La regla que las
// une: **el chevron siempre pliega; la etiqueta va donde vaya la fila, y si la
// fila no va a ninguna parte, pliega la fila entera.**
//
// Un `<button>` no puede vivir dentro de un `<a>` (interactivo dentro de
// interactivo: el teclado y el lector se quedan sin saber qué están tocando), así
// que son dos hermanos dentro de una caja que solo pinta el fondo.
//
// El FOCO va aquí `ring-inset` y no con el `ring-offset` del resto del menú, y es
// a propósito: con el anillo pintado fuera, enfocar la mitad izquierda derramaba
// el halo por encima de la derecha y no se sabía cuál de las dos tenía el foco.
// Pintado dentro, el anillo dibuja exactamente la mitad que responde al Intro.
// -----------------------------------------------------------------------------

/** La caja: solo el fondo y el alto. No es focusable ni pulsable. */
export const FILA_CAJA =
  'flex h-11 w-full items-center overflow-hidden rounded-xl text-[15px] font-medium lg:h-[34px] transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)]'

/** La mitad que lleva a un sitio. Se queda con todo el ancho menos el chevron, y
 *  repite la geometría de `FILA` (14px de sangría, icono de 20, hueco de 14) para
 *  que su etiqueta arranque en los mismos 48px que todas las demás del menú. */
export const FILA_ENLACE =
  'flex min-w-0 flex-1 items-center gap-4 self-stretch rounded-l-xl pl-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600'

/** El chevron. `px-3.5` y no un ancho fijo: así el glifo queda a los mismos 14px
 *  del filo derecho que el de "Puestos", que va dentro del relleno de su fila. */
export const FILA_CHEVRON =
  'grid shrink-0 place-items-center self-stretch rounded-r-xl px-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600'

/** UNA FILA HIJA (un puesto, una vista de candidatos). Sin icono y sangrada a
 *  48px, que es exactamente donde arranca la etiqueta de su madre.
 *
 *  Ocupa el ancho ENTERO y la sangría la lleva la FILA, no la lista: con la lista
 *  sangrada, el fondo de la hija mide menos que el de la madre y sus señales caen
 *  6px a la izquierda de las demás (medido). Nadie lo nombra al verlo; todo el
 *  mundo lo nota como "descosido".
 *
 *  Vive aquí y no escrita a mano en cada lista porque ya hay dos consumidoras
 *  (los puestos y las vistas de Candidatos) y este proyecto ya sabe cómo acaba
 *  eso: dos filas que empiezan iguales y se separan al primer retoque.
 *
 *  EL RELLENO ES 12 PORQUE LA LISTA TRAE AHORA SU RAÍL (`FILA_SUBLISTA`, ago
 *  2026). Antes eran 48 medidos desde el filo del menú; ahora 23 los pone el
 *  margen de la lista, 1 el propio raíl y 12 su relleno, así que aquí quedan 12
 *  para que el texto siga aterrizando en los MISMOS 64px que la etiqueta de su
 *  madre. El número no es a ojo: es lo que sobra de una cuenta que no ha cambiado
 *  de resultado, y se movió de 11 a 12 al recentrarse el raíl con el icono de 18. */
export const FILA_HIJA =
  'flex h-10 w-full items-center gap-2 rounded-xl pl-3 pr-3.5 text-[15px] font-medium outline-none lg:h-8 transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)]'

/**
 * EL RAÍL DE UNA SUBLISTA: una línea que cae del icono de su madre (Mario, ago
 * 2026, con la referencia de shadcn delante).
 *
 * Lo que resuelve es una pregunta que la sangría sola no contestaba: **hasta
 * dónde llega esta lista.** Con seis puestos seguidos de "Candidatos", el ojo no
 * sabía dónde acababan los hijos y empezaba la siguiente fila de primer nivel; la
 * sangría dice "esto va dentro" pero no dice "y termina aquí". La línea sí, y
 * además ata visualmente la lista a la fila que la abrió.
 *
 * CAE EN EL CENTRO DEL ICONO DE LA MADRE, que es de donde parece salir: el icono
 * ocupa de 30 a 48 desde el filo del menú, así que el raíl va en el **39**, o sea
 * `ml-[23px]` sobre el relleno de 16 del contenedor. Puesto en cualquier otro
 * sitio se lee como una línea decorativa en vez de como la continuación de una
 * fila.
 *
 * Estuvo en 40 (`ml-6`) mientras el icono medía 20, y se quedó 1px descolgado al
 * bajar el icono a 18 (Mario lo vio: "el raíl también déjalo centrado con el
 * icono"). Es el segundo número derivado que cobra ese cambio, después del
 * relleno del raíl contraído: **un número que sale de una cuenta se recalcula
 * cuando cambia un término de la cuenta**, y por eso la cuenta va escrita aquí y
 * no solo su resultado.
 *
 * VA EN EL FILO DE LA CASA (`--color-lateral-filo`, o sea `slate-200`, 1,24:1
 * sobre blanco). Se probó subirlo a `slate-300` (1,48) con el argumento de que un
 * raíl no es el canto de una caja sino una GUÍA que el ojo sigue de arriba abajo,
 * y **Mario lo revirtió el mismo día**. El argumento no era falso, pero pesaba
 * menos que lo que costaba: en una superficie donde todo lo demás (la marca, las
 * tarjetas, el campo del pie) usa un solo hairline, una línea medio tono más
 * oscura no se lee como "más guía", se lee como una línea de OTRO sistema. Un
 * vocabulario de un solo filo vale más que el matiz.
 *
 * NO CONTRADICE "la sangría va en la FILA, no en la lista", que es lo que impedía
 * que las señales de los hijos cayeran 6px a la izquierda de las demás: eso lo
 * rompía un relleno a los DOS lados. Aquí solo se mete el lado izquierdo; el
 * derecho sigue llegando al filo, así que los puntos de novedad siguen cayendo en
 * la misma vertical que el chevron de su madre (medido: 225 en las dos).
 */
export const FILA_SUBLISTA = 'ml-[23px] space-y-0.5 border-l border-[var(--color-lateral-filo)] pb-1 pl-3 pt-1'

/**
 * EL RELLENO DE UNA ZONA DEL LATERAL, animado.
 *
 * 16 con el raíl ancho y 9 con el estrecho, y esos dos números no son de gusto:
 * son los que dejan el icono de una fila centrado en cada ancho. Con 9, el glifo
 * cae en 9 + 14 + 9 = 32, la mitad exacta de 64. Eran 8 mientras el icono medía
 * 20; al bajar a 18 la cuenta se movió medio píxel y hubo que devolverlo. **Un
 * número derivado se recalcula cuando cambia aquello de lo que deriva**, y por eso
 * la cuenta está escrita aquí y no solo el resultado.
 *
 * Se ANIMA (`transition-[padding]`) porque es lo único que mueve al icono de
 * sitio: sin transición, esos 8px serían el salto lateral que esta versión vino a
 * quitar. Es layout, sí, pero solo del raíl y de una docena de filas; lo caro
 * (el contenido de la aplicación) ya se reajusta por el ancho del `<aside>`.
 */
export const ZONA_LATERAL =
  'px-4 group-data-[contraido]/lateral:px-[9px] transition-[padding] duration-[var(--duration-max)] ease-[var(--ease-standard)] motion-reduce:transition-none'

/**
 * EL RELLENO DE LA FILA DE MARCA, animado por el mismo motivo.
 *
 * ASIMÉTRICO A PROPÓSITO: 30 a la izquierda y 16 a la derecha. No es descuido, es
 * que cada lado tiene un vecino distinto y por eso se alinea con cosas distintas.
 *
 * A LA IZQUIERDA MANDA EL GLIFO, Y SE ALINEA POR EL CENTRO, NO POR EL BORDE.
 * 25 deja el monograma (28px) centrado en **39**, que es donde caen los centros
 * de los iconos del menú (18px que arrancan en 30). Se probó bajarlo a 16 para
 * que la caja de la marca empezara donde empiezan las píldoras, y **Mario lo
 * revirtió**: lo que se ve al bajar la vista por el lateral es la COLUMNA DE
 * GLIFOS, y romperla para cuadrar un borde que solo se dibuja al pasar el ratón
 * sale perdiendo.
 *
 * ESTUVO EN 30 Y ESO ERA ALINEARLOS POR EL BORDE IZQUIERDO, que no es como los
 * empareja el ojo: medido, el logo quedaba centrado en 44 contra los 39 de los
 * iconos, o sea 5px descolgado a la derecha (Mario lo vio, ago 2026). Y la nota
 * que había aquí afirmaba que las dos alineaciones (glifo y wordmark) eran
 * incompatibles y había que elegir. **No lo eran**: el hueco entre el logo y el
 * wordmark es libre, así que subiéndolo de 6 a 11 el texto sigue arrancando en
 * los mismos 64 que las etiquetas. 25 + 28 + 11 = 64. La lección: antes de
 * declarar dos medidas incompatibles, mira si hay una tercera que no es fija.
 *
 * A LA DERECHA MANDA LA CAJA. 16 (Mario, ago 2026: "esto llévalo más a la
 * derecha"): el botón de contraer cierra en 240, que es donde acaban los fondos
 * de las filas, así que al pasar por encima su relleno cae en la misma vertical
 * que el de cualquier destino. Y ahí no hay ninguna columna de glifos que
 * respetar: lo que tiene debajo son chevrones y chapas, que viven en el filo del
 * CONTENIDO (226) y no son una columna que se barra con la vista.
 *
 * La regla, en una frase: **se alinea con el vecino que de verdad se ve.** A la
 * izquierda eso es una columna de iconos; a la derecha, el borde de las píldoras.
 *
 * Con el raíl estrecho, los dos lados a 18: es lo que deja el monograma centrado
 * en 64 (18 + 28/2 = 32) y, a la derecha, lo único que garantiza que el botón
 * quede FUERA del recorte (con 8 se asomarían 4px). Entre un ancho y otro el logo
 * se desliza en vez de saltar.
 *
 * El relleno derecho del raíl estrecho NO baja con él, y no es un descuido: ahí
 * es lo único que garantiza que el botón quede FUERA del recorte. Con 8 se
 * asomarían 4px del botón en un raíl de 64 (medido: empieza en 52 y se recortaría
 * en 56). Por eso el estado contraído sigue declarando los dos lados a la vez.
 */
export const ZONA_MARCA =
  'pl-[25px] pr-4 group-data-[contraido]/lateral:px-[18px] transition-[padding] duration-[var(--duration-max)] ease-[var(--ease-standard)] motion-reduce:transition-none'

/** Una etiqueta CENTRADA que se apaga con el raíl (el rótulo del CTA del pie).
 *  Misma idea que `FILA_ETIQUETA` sin el `flex-1`, porque aquí no compite con
 *  nada: va superpuesta a su gemela estrecha. */
export const FILA_ETIQUETA_CENTRADA = `truncate ${DESVANECE}`

/** Lo contrario, y es el MISMO relevo del revés: lo que solo se ve con el raíl
 *  estrecho (el "+" del CTA). Se va en la primera mitad al expandir y llega en la
 *  segunda al contraerse, así que nunca se cruza con el rótulo al que sustituye.
 */
export const FILA_SOLO_ESTRECHO =
  `opacity-0 ${RELEVO} duration-[calc(var(--duration-max)/2)] delay-0 ` +
  'group-data-[contraido]/lateral:opacity-100 ' +
  'group-data-[contraido]/lateral:duration-[var(--duration-max)] ' +
  'group-data-[contraido]/lateral:delay-[calc(var(--duration-max)/4)]'

/**
 * EL CTA DEL PIE, CONTRAÍDO: un círculo del tamaño de la cara (Mario, ago 2026:
 * "el de + colapsado tiene que ser un círculo del tamaño de la foto de perfil").
 *
 * 30px y redondo del todo. Los dos glifos del pie pasan a ser dos discos del mismo
 * calibre, y el raíl estrecho se lee como una columna en vez de como un botón
 * ancho con una cara suelta debajo. Es además la única forma que le queda: un
 * rectángulo de 46x36 en un raíl de 64 no es un botón de bloque, es un botón de
 * bloque recortado.
 *
 * `mx-auto` lo centra sin necesitar una variante: con `w-full` no hay hueco que
 * repartir, así que ancho no hace nada, y contraído deja el círculo en 17..47,
 * centro **32**, la mitad exacta de 64. El mismo truco (un solo valor que acierta
 * los dos anchos) que centra la cara.
 *
 * **EL RADIO ES 15 Y NO `rounded-full`, y no es un detalle de estilo: es lo que
 * impide que la forma SALTE.** `rounded-full` es `calc(infinity * 1px)`, o sea
 * unos 16,7 millones; interpolando desde los 10 del reposo, en el PRIMER
 * fotograma animado ya iba por 483.582 (medido), muy por encima del tope visible
 * (la mitad de la caja, 18px). O sea que el botón se volvía pastilla de golpe y
 * luego encogía despacio, que es justo lo que Mario vio como escalonado. Con 15,
 * que es la mitad de los 30 del círculo, el resultado final es EL MISMO (círculo
 * perfecto) y el recorrido 10 -> 15 sí se anima. **Regla general: un valor
 * "infinito" no se interpola; si una forma redonda tiene que morfarse, su radio
 * se escribe como la mitad de su caja.**
 *
 * La transición de la forma la pone `cta-lateral` en `index.css`, que es donde
 * puede declarar sus dos velocidades.
 */
export const CTA_LATERAL_CONTRAIDO =
  'mx-auto group-data-[contraido]/lateral:lg:h-[30px] group-data-[contraido]/lateral:w-[30px] group-data-[contraido]/lateral:rounded-[15px]'

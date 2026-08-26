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
// Una sola geometría para todas: icono de 20 y etiqueta a 48px del filo interior.
// Lo que cambia de una fila a otra es qué la envuelve (un enlace, un botón, un
// plegable), nunca su forma.
//
// EL ALTO ES 34px EN ESCRITORIO, NO 42, Y ESO NO ES "MÁS DENSO": ES MÁS AIRE.
// Medido contra la referencia (JOIN, ago 2026): su paso entre filas es de 40px
// con una píldora de 30, o sea 10px de hueco entre una y la siguiente. El nuestro
// era de 46 con una píldora de 42: 4px de hueco. Mismo espacio, repartido al
// revés. Su fila se lee como un OBJETO pequeño rodeado de aire y la nuestra como
// una losa que casi toca a su vecina, y esa es la diferencia que se percibe como
// "el suyo respira". La regla que se saca: **en una lista de filas con fondo, el
// aire va ENTRE las píldoras, no DENTRO de ellas.**
//
// En táctil sube a 44px (`h-11`), que es el objetivo de toque mínimo: la densidad
// de escritorio no se paga con un dedo que falla. Mismo criterio que el botón.
//
// El foco lleva `ring-offset` del color del lateral y no del blanco: sobre la
// superficie recesiva, un halo blanco se vería como una segunda línea.
// -----------------------------------------------------------------------------

export const FILA =
  'flex h-11 w-full items-center gap-3.5 rounded-xl px-3.5 text-sm font-medium outline-none lg:h-[34px] transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)]'

/** En reposo. La etiqueta va en TINTA (`slate-800`), no en gris de apoyo: una
 *  fila del menú es un destino, no un pie de foto, y en gris medio sobre blanco
 *  la columna entera se lee borrosa. Es la diferencia que se veía comparando con
 *  JOIN, más que ningún tamaño. El hover tiene peldaño propio
 *  (`--color-lateral-hover`): tiene que distinguirse del riel Y del activo, y
 *  entre dos grises tan juntos eso no sale de una opacidad puesta a ojo.
 *
 *  El PESO no vive aquí sino en `FILA`, y eso no es un detalle de orden: si cada
 *  estado declarase el suyo, volver a descuadrarlos sería cuestión de tocar uno.
 *  Declarado una vez en la base, ningún estado puede cambiar el cuerpo de la
 *  letra sin que se note al escribirlo. */
export const FILA_QUIETA = 'text-slate-800 hover:bg-[var(--color-lateral-hover)] hover:text-slate-900'

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
  'flex h-11 w-full items-center rounded-xl text-sm font-medium lg:h-[34px] transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)]'

/** La mitad que lleva a un sitio. Se queda con todo el ancho menos el chevron, y
 *  repite la geometría de `FILA` (14px de sangría, icono de 20, hueco de 14) para
 *  que su etiqueta arranque en los mismos 48px que todas las demás del menú. */
export const FILA_ENLACE =
  'flex min-w-0 flex-1 items-center gap-3.5 self-stretch rounded-l-xl pl-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600'

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
 *  eso: dos filas que empiezan iguales y se separan al primer retoque. */
export const FILA_HIJA =
  'flex h-10 w-full items-center gap-2 rounded-xl pl-12 pr-3.5 text-sm font-medium outline-none lg:h-[30px] transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-lateral)]'

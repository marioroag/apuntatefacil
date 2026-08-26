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

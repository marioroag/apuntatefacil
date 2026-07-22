# Indicador de orden activo en la tabla de candidatos

Fecha: 2026-07-22

## Objetivo

Hacer evidente por qué aparecen los candidatos en un orden concreto sin añadir ruido visual a una tabla densa. El usuario debe distinguir de un vistazo la columna activa y el sentido del orden, manteniendo una interacción sobria, estable y accesible.

## Alcance

El cambio afecta únicamente a las cabeceras ordenables de la tabla de escritorio en `/app/puestos/:id` y su equivalente de demostración. No cambia el algoritmo de ordenación, el orden inicial, las vistas guardadas, las tarjetas móviles, las columnas no ordenables ni los datos de los candidatos.

## Alternativas consideradas

1. Cambiar instantáneamente entre iconos ascendente y descendente. Es simple, pero el salto de icono hace que la interacción se perciba más brusca.
2. Mantener una única flecha y rotarla al cambiar el sentido. Es la opción elegida: conserva la geometría, comunica el cambio con una transición corta y evita movimiento lateral.
3. Usar dos flechas permanentes y resaltar una. Expone ambos sentidos, pero añade detalle visual constante y se parece más a un control técnico que a una herramienta refinada.

## Diseño aprobado

- La columna activa muestra su texto en `slate-700`; las columnas inactivas permanecen en `slate-500`.
- La columna activa utiliza una sola flecha vertical de 12 px. Parte apuntando hacia arriba para orden ascendente y rota 180 grados para orden descendente.
- La flecha activa utiliza ultramarine, entendido como estado de selección del orden. No se añaden fondos, subrayados ni píldoras.
- Las columnas inactivas mantienen `ArrowUpDown` en `slate-300`; en hover, texto e icono ganan contraste de forma discreta.
- El espacio reservado al icono es idéntico en todos los estados para que el texto y las columnas no se desplacen al cambiar el orden.
- La rotación dura 180 ms con una curva `ease-out`, solo anima `transform` y se desactiva con `prefers-reduced-motion`.
- Al activar una columna distinta, la nueva columna empieza en orden ascendente, preservando el comportamiento actual.
- Al volver a pulsar la columna activa, alterna entre ascendente y descendente.

## Accesibilidad

- `aria-sort` permanece en el `<th>` y refleja `ascending`, `descending` o `none`.
- El botón recibe un `aria-label` que nombra la columna, informa del orden actual cuando está activo y anticipa el resultado de la siguiente pulsación.
- Los iconos continúan con `aria-hidden`; el significado no depende de interpretarlos visualmente.
- El botón muestra un anillo ultramarine discreto con `focus-visible`, contenido dentro de la cabecera y sin alterar sus dimensiones.
- Con movimiento reducido, la flecha cambia de dirección sin transición.

## Implementación prevista

- Sustituir el renderizado fijo de `ArrowUpDown` dentro de `SortHead` por dos estados visuales de tamaño idéntico: indicador neutro e indicador activo.
- Mantener el estado y `toggleSort` actuales; no introducir estado local ni Framer Motion.
- Usar utilidades Tailwind para color, rotación, transición y `motion-reduce`.
- Mantener la implementación dentro de `src/screens/Dashboard.tsx` porque el patrón solo existe en esta tabla y no justifica todavía un componente compartido.

## Verificación

- Confirmar visualmente el estado inicial `Recibida` descendente.
- Pulsar una columna inactiva y comprobar que pasa a ascendente sin desplazamiento de texto.
- Pulsarla de nuevo y comprobar que la flecha rota a descendente.
- Cambiar a otra columna y comprobar que la anterior recupera el indicador neutro.
- Repetir la interacción con teclado y revisar `aria-sort` y el nombre accesible del botón.
- Confirmar que la tabla no cambia de ancho y que las cabeceras truncadas mantienen su comportamiento.
- Ejecutar `npm run build`, `npx tsc --noEmit` y `npm test`.

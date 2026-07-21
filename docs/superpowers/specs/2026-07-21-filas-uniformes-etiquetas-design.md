# Filas uniformes con etiquetas en dos líneas

Fecha: 2026-07-21

## Objetivo

Mantener las etiquetas visibles y fáciles de escanear sin permitir que su presencia cambie la altura de cada fila ni obligue al nombre a competir con ellas en la misma línea.

## Alcance

El cambio afecta únicamente a la tabla de escritorio de `/app/puestos/:id` y su equivalente de demostración. La vista móvil, la gestión y filtrado de etiquetas, las acciones masivas y la ficha del candidato no cambian.

La eliminación previa de los avatares de escritorio se mantiene.

## Diseño aprobado

- Todas las filas de escritorio miden 64 px, tengan cero, una o varias etiquetas.
- La celda «Candidato» se divide en dos líneas estables.
- La primera línea está reservada al nombre y al indicador de candidatura de prueba cuando corresponda.
- La segunda línea está reservada a las etiquetas.
- Las filas sin etiquetas conservan vacía la segunda línea para mantener exactamente la misma geometría.
- La columna «Candidato» recupera 260 px: al no existir avatar, todo ese ancho queda disponible para nombre y etiquetas.
- La línea de etiquetas nunca envuelve. Muestra hasta dos chips neutros y «+N» para el resto.
- Si una etiqueta es demasiado larga para el ancho disponible, su texto se trunca dentro del chip; no aumenta la fila.

## Interacción

- El nombre continúa abriendo la ficha con ratón y teclado y conserva un `title` con su valor completo.
- «+N» mantiene el popover existente con todas las etiquetas.
- Pulsar «+N» detiene la propagación para no abrir simultáneamente la ficha.
- El popover se cierra con `Escape` y clic fuera, igual que en el comportamiento existente.

## Componentes

- `src/components/Tags.tsx`: `TagCell` incorpora una variante de una sola línea para escritorio, conservando su presentación actual en móvil y Bandeja.
- `src/screens/Dashboard.tsx`: elimina el indicador numérico rechazado y utiliza la variante estable de `TagCell` dentro de una celda de dos líneas.
- Las filas bloqueadas y el skeleton adoptan la misma altura de 64 px sin simular etiquetas.

## Estados y casos límite

- Cero etiquetas: segunda línea vacía.
- Una o dos etiquetas: chips visibles en una sola línea.
- Más de dos etiquetas: dos chips visibles y «+N» con acceso a todas.
- Nombres largos: utilizan todo el ancho de la primera línea y solo se truncan cuando exceden físicamente los 260 px; el nombre completo permanece en `title`.
- Etiquetas largas: se truncan dentro del chip, nunca envuelven ni cambian la altura.

## Verificación

- Comparar filas con cero, una, dos y varias etiquetas y confirmar 64 px en todas.
- Confirmar que los nombres disponen del ancho completo de la columna.
- Abrir «+N» y comprobar que no abre la ficha del candidato.
- Confirmar que móvil y Bandeja mantienen su presentación actual.
- Ejecutar `npm run build`, `npx tsc --noEmit` y `npm test`.


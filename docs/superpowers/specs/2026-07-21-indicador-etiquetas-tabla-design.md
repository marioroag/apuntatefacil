# Indicador compacto de etiquetas en la tabla de candidatos

Fecha: 2026-07-21

## Objetivo

Evitar que las etiquetas modifiquen la altura de las filas o recorten prematuramente el nombre del candidato, manteniendo acceso directo a toda la clasificación existente.

## Alcance

El cambio afecta únicamente a la tabla de escritorio de `/app/puestos/:id` y su equivalente de demostración. La vista móvil, la gestión de etiquetas, los filtros, las acciones masivas y la ficha del candidato no cambian.

La eliminación previa de los avatares de escritorio se mantiene.

## Diseño aprobado

- La celda «Candidato» utiliza una sola línea.
- El nombre ocupa todo el espacio flexible disponible y conserva su `title` con el valor completo cuando se trunca por el ancho real de la ventana.
- Si el candidato tiene etiquetas, aparece al final de la celda un botón neutro de ancho estable con el icono `Tag` de Lucide y el número total de etiquetas.
- Si no tiene etiquetas, el indicador no se muestra y el nombre aprovecha todo el ancho.
- El indicador no utiliza ultramarine ni colores de estado: fondo, borde, icono y texto pertenecen a la escala slate.
- Ninguna etiqueta se muestra como chip dentro de la fila, por lo que el contenido nunca genera una segunda línea.
- Todas las filas conservan la misma altura y el mismo padding vertical.

## Interacción

- Pulsar el indicador abre un popover anclado al botón con todas las etiquetas del candidato usando los chips neutros existentes.
- La interacción detiene la propagación para no abrir simultáneamente la ficha del candidato.
- El botón expone un nombre accesible como «Ver 3 etiquetas de Óscar Ortega», `aria-expanded` y `aria-haspopup="dialog"`.
- El popover se cierra con `Escape`, clic fuera, scroll o cambio de tamaño.
- El nombre del candidato sigue abriendo su ficha con ratón y teclado.

## Componentes

- `src/components/Tags.tsx`: variante reutilizable de indicador y popover, sin alterar el comportamiento actual de `TagCell` en móvil o en Bandeja.
- `src/screens/Dashboard.tsx`: sustituye únicamente el `TagCell` bajo el nombre en la fila de escritorio por el nuevo indicador.

## Estados y casos límite

- Cero etiquetas: no se renderiza ningún control.
- Una etiqueta: el indicador muestra `1` y el popover contiene un chip.
- Varias etiquetas: el indicador muestra el total completo y el popover permite leerlas todas.
- Nombres largos: se truncan solo cuando el espacio total de la celda se agota; el valor completo permanece disponible mediante `title`.
- Candidaturas bloqueadas y skeleton: mantienen la misma geometría compacta y no simulan etiquetas visibles.

## Verificación

- Comparar en escritorio filas con cero, una y varias etiquetas y confirmar alturas idénticas.
- Abrir y cerrar el popover con clic, `Escape` y clic fuera.
- Confirmar que pulsar el indicador no abre la ficha y que pulsar el nombre sí lo hace.
- Confirmar que la vista móvil permanece sin cambios.
- Ejecutar `npm run build`, `npx tsc --noEmit` y `npm test`.


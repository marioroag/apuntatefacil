# Tabla de candidatos como instrumento de trabajo

## Objetivo

Hacer que la tabla de `/app/puestos/:id` se perciba robusta, premium y refinada sin reducir su capacidad operativa. La calidad debe venir de una jerarquía predecible, una densidad útil y estados de interacción precisos, no de más decoración.

## Principios aplicados

- Una sola superficie reúne búsqueda, filtros, vistas, contexto, selección masiva y datos.
- Cada columna representa un tipo de dato. Las etiquetas dejan de competir con el nombre y pasan a su propia columna.
- El nombre del candidato es el ancla visual de cada fila. Se eliminan los avatares de iniciales porque no aportan identificación real y multiplican las formas circulares.
- Los encabezados usan sentence case. Solo la columna ordenada muestra su dirección de forma persistente; las demás revelan el control al pasar el ratón o recibir foco.
- El interés se muestra como icono y texto contenido. El estado conserva texto, desplegable y un único punto de su color semántico.
- Las filas mantienen un ritmo vertical constante, divisores finos y un hover que ayuda a seguir horizontalmente los datos.
- La selección masiva ocupa el mismo lugar que la barra de herramientas en escritorio. En móvil se conserva la barra inferior al alcance del pulgar.
- El detalle continúa abriéndose en `CandidatePanel`, sin sacar al usuario de la lista filtrada.

## Estructura de la superficie

1. `StatusSummary` permanece sobre la tabla en escritorio como filtro segmentado, pero se simplifica a punto, etiqueta y recuento. En móvil continúa oculto.
2. Una tarjeta única contiene la barra de herramientas, el contexto de resultados, los filtros activos y la tabla.
3. La barra normal contiene búsqueda y refresco a la izquierda; filtros, vistas y exportación a la derecha.
4. Cuando hay filas seleccionadas, la barra normal se sustituye en escritorio por las acciones masivas: comprobar interés, añadir o quitar etiquetas, exportar y cancelar.
5. La línea de contexto contiene el total visible, los chips de filtros activos y la acción para limpiarlos.
6. La tabla usa estas columnas: selección, candidato, teléfono, etiquetas, hasta dos respuestas destacadas configurables, interés, estado y fecha de recepción.

## Comportamiento conservado

- Búsqueda tolerante y orden por relevancia.
- Filtros por estado, interés, respuestas, rangos numéricos, valoración y etiquetas.
- Vistas guardadas globales y por puesto.
- Exportación de todos los resultados o solo la selección.
- Selección individual, total e indeterminada.
- Acciones masivas de etiquetas y comprobación de interés.
- Cambio de estado desde la fila.
- Candidaturas bloqueadas y su llamada a mejorar el plan.
- Animación breve para candidaturas recién llegadas.
- Skeleton, vacíos, onboarding y estados de carga existentes.
- Vista móvil en tarjetas, pulsación larga para selección y barra inferior.
- Apertura del panel lateral de candidato.

## Componentes afectados

- `src/screens/Dashboard.tsx`: composición de la superficie, resumen de estados y anatomía de la tabla.
- `src/components/InterestSignal.tsx`: variante visual contenida para filas de tabla.
- `src/components/ui/StatusPill.tsx`: variante neutra de selector para filas de tabla.

No cambia el modelo de datos, Supabase, los filtros, las exportaciones ni las mutaciones del store.

## Accesibilidad

- Se mantiene la tabla semántica con `caption`, `th`, `scope` y `aria-sort`.
- Los nombres continúan siendo botones accesibles que abren el panel lateral.
- Los controles de ordenación tienen foco visible y un nombre legible.
- El color nunca comunica un estado por sí solo.
- Los textos significativos conservan contraste AA.
- El desplazamiento horizontal de la tabla queda contenido en su envoltorio y todo el contenido sigue disponible.

## Verificación

- Revisar visualmente escritorio y móvil en `/demo/puestos/:id`.
- Probar búsqueda, filtros, vistas, ordenación, cambio de estado, apertura del candidato, selección múltiple y acciones masivas.
- Revisar estado cargando, sin resultados y candidaturas bloqueadas.
- Confirmar que `descartado` no usa rojo y que el ultramarine solo aparece en acción, foco o selección.
- Ejecutar `npm run build` y `npx tsc --noEmit`.

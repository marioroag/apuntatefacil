# Interés condicional en la lista de candidatos

Fecha: 2026-07-21

## Objetivo

Reducir el protagonismo permanente de una función de uso ocasional sin ocultar las respuestas que sí pueden cambiar una decisión de contratación.

## Alcance

El cambio afecta a las filas de candidatos de `/app/puestos/:id`, su equivalente de demostración y las tarjetas móviles de esa misma pantalla. La ficha del candidato, el filtro por interés, la acción masiva «Comprobar interés», las vistas guardadas y la exportación no cambian.

## Diseño aprobado

- La tabla de escritorio elimina la cabecera y la columna «Interés».
- Las tarjetas móviles eliminan la píldora permanente de interés.
- Las filas no muestran nada para `never`, `sent`, `no_response` o `unavailable`.
- Solo se muestran respuestas reales:
  - `interested`: icono `ThumbsUp` en verde esmeralda discreto.
  - `not_interested`: icono `ThumbsDown` en slate; nunca rojo.
- El icono aparece junto al nombre del candidato, después del indicador de candidatura de prueba cuando exista.
- El icono no utiliza fondo, borde, píldora ni texto permanente y mide 16 px.
- Al no existir una respuesta real, no se reserva ningún hueco.
- La eliminación de la columna permite que las demás columnas utilicen el espacio recuperado sin introducir una nueva columna vacía.

## Contenido y accesibilidad

- El icono expone un texto como «Interesado · respondió hace 2 h» o «No interesado · respondió ayer» mediante `title` y texto accesible.
- Si no existe fecha de respuesta, utiliza únicamente «Interesado» o «No interesado».
- El significado no depende solo del color: la forma del icono y su etiqueta accesible distinguen ambos resultados.
- La ficha del candidato mantiene `InterestSignal` completo con todos los estados y fechas.

## Componentes

- `src/components/InterestSignal.tsx`: incorpora un componente aislado `InterestOutcomeIcon` que devuelve `null` para estados no concluyentes.
- `src/screens/Dashboard.tsx`: elimina las instancias permanentes de `InterestSignal` en escritorio y móvil, y coloca `InterestOutcomeIcon` junto al nombre.
- Las filas bloqueadas y el skeleton eliminan el espacio reservado a la antigua columna.

## Comportamiento existente preservado

- «Comprobar interés» continúa disponible como acción masiva.
- El filtro permite seguir seleccionando cualquier estado, incluidos enviado y sin respuesta.
- Cuando un filtro de interés esté activo, el chip superior mantiene el contexto aunque las filas no muestren un icono para estados no concluyentes.
- Las vistas guardadas conservan sus filtros de interés.
- La ficha del candidato sigue mostrando el estado detallado.

## Verificación

- Confirmar que la columna «Interés» desaparece en escritorio.
- Confirmar que las tarjetas móviles ya no muestran «Sin comprobar» ni otros estados pasivos.
- Confirmar que solo `interested` y `not_interested` producen icono en la fila.
- Revisar tooltip, texto accesible y colores de ambos resultados.
- Probar el filtro por interés y la apertura de la ficha.
- Ejecutar `npm run build`, `npx tsc --noEmit` y `npm test`.


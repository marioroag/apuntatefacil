# Comparativa de coste operativo en la landing

**Fecha:** 2026-07-23
**Superficie:** landing (`/`)
**Estado:** diseño aprobado por Mario y revisado a la composición B: registro comparativo continuo.

## Objetivo

Reemplazar la sección "Contratar desordenado también tiene un coste" por una comparación directa entre la gestión de respuestas dispersas y el resultado de usar Apúntate Fácil. Debe hacer visible el coste operativo de no ordenar el proceso, sin recurrir a cifras, testimonios ni promesas de captación.

## Alcance

- Modificar únicamente `CostAnchor` en `src/screens/Landing.tsx`.
- Conservar su posición: inmediatamente antes de precio.
- Mantener la aclaración honesta: Apúntate Fácil no cambia dónde se publica ni trae candidatos nuevos; ordena las respuestas ya recibidas.
- No cambiar planes, precios, navegación ni funcionalidades del producto.

## Narrativa y copy

### Encabezado

- Eyebrow: "Antes de comparar planes".
- Título: "Contratar desordenado también tiene un coste".
- Introducción: explica que el coste aparece cuando las respuestas quedan repartidas entre chat, llamadas y notas, no como una cifra económica calculada.

### Columna izquierda: coste actual

Etiqueta: "Cuando lo gestionas por chat".

Tres consecuencias, redactadas como resultados operativos:

1. Tiempo que se va en pedir los mismos datos y buscar conversaciones.
2. Seguimiento impreciso entre llamadas, mensajes y notas sueltas.
3. Candidatos válidos que se enfrían o se pierden antes de poder valorarles.

### Columna derecha: resultado con Apúntate Fácil

Etiqueta: "Cuando todo entra en un mismo sitio".

Tres contrapuntos equivalentes:

1. Cada candidatura llega con la información que necesitas desde el inicio.
2. La lista, los filtros y los estados dejan claro qué toca hacer.
3. Puedes decidir y contactar antes, con todos los datos delante.

### Cierre

Una frase bajo la comparativa refuerza la honestidad operativa: no se prometen más candidatos; se evita desaprovechar los que ya responden al anuncio.

## Diseño e interacción

- Una única superficie comparativa con borde exterior. En escritorio se divide en una zona de coste neutra y una zona de resultado en `slate-900`, separadas por una línea vertical precisa.
- Cada fila enfrenta directamente una consecuencia con su contrapunto equivalente. La correspondencia se debe poder leer sin cruzar visualmente dos listas independientes.
- En móvil y tableta, una tabla compacta de dos columnas mantiene cada problema y su alternativa visibles a la vez, con copy más breve. El registro detallado queda reservado a escritorio.
- Las filas usan divisores sutiles, sin cifras ni checks decorativos.
- No usar ultramarine como elemento decorativo. El acento queda reservado para CTAs y foco.
- No se incorporan efectos, datos dinámicos ni interacción adicional. El contenido debe conservar el orden de lectura lógico y funcionar sin JavaScript.

## Accesibilidad y responsive

- Encabezados semánticos (`h2`, `h3`) y listas (`ul`, `li`) para cada grupo.
- Contraste AA para todo el copy significativo, incluido el texto sobre la superficie oscura.
- En móvil, el problema y el resultado equivalente permanecen en la misma fila; los paddings y el tamaño de texto conservan buena legibilidad incluso en anchos estrechos.
- Sin animaciones nuevas ni dependencias.

## Verificación

1. Revisar la sección en navegador en escritorio y móvil.
2. Confirmar que no hay cifras, promesas de captación ni lenguaje de presión.
3. Confirmar uso correcto de neutros, contraste y ausencia de ultramarine decorativo.
4. Ejecutar `npm run build` y `npx tsc --noEmit` desde `/Users/mario/criba`.

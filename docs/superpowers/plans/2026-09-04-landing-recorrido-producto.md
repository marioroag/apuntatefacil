# Plan de implementación: landing con recorrido real del producto

Fecha: 2026-09-04

Especificación: `docs/superpowers/specs/2026-09-04-landing-recorrido-producto-design.md`

## Resultado esperado

La landing de Apúntate Fácil contará un único recorrido general de contratación:

1. Preparar el puesto.
2. Compartirlo donde la empresa ya publica.
3. Recibir candidaturas ordenadas.
4. Revisar, decidir y avanzar.

Una persona no técnica debe comprender en cinco segundos qué hace el producto. La página será luminosa, serena, poco densa y apoyada en placeholders de vídeo que Mario sustituirá posteriormente por grabaciones reales.

La implementación no incluye la producción ni edición de los vídeos.

## Restricciones

- Limitar los cambios a `/`, sus componentes y sus estilos específicos.
- Mantener la marca, el logotipo, Geist y el ultramarine `#3b4fe4`.
- Reservar el ultramarine para acción, foco y selección.
- Mantener un único tema claro.
- Mantener el registro como conversión principal.
- Mantener el precio real desde `src/lib/pricing.ts`.
- Mantener los testimonios publicables desde `src/lib/testimonios.ts`.
- Mantener `BRAND`, `TAGLINE`, `DEMO_URL` y enlaces de soporte desde `src/lib/brand.ts`.
- Mantener la redirección de una sesión activa desde `/` hacia `/app`.
- Mantener las rutas legales y el diálogo de soporte.
- Mantener los identificadores `como-funciona`, `precio` y `faq`.
- No cambiar el producto autenticado, Supabase, precios, permisos ni datos.
- No añadir dependencias.
- No usar formularios, vacantes, ofertas o campañas como lenguaje principal de la landing.
- No representar el producto con componentes HTML falsos.
- No intervenir, fijar ni desplazar programáticamente el scroll.
- No desplegar ni publicar sin una petición separada.

## Archivos previstos

### Crear

- `src/lib/landingMedia.ts`
- `src/lib/landingMedia.test.ts`
- `src/components/landing/ProductMedia.tsx`
- `src/components/landing/LandingShell.tsx`
- `src/components/landing/LandingHero.tsx`
- `src/components/landing/ProductJourney.tsx`
- `src/components/landing/TrustAndConversion.tsx`
- `src/screens/landing.css`

### Modificar

- `src/screens/Landing.tsx`
- `src/index.css`

### Retirar si quedan sin consumidores

- `src/components/AppShot.tsx`

Los recursos actuales de `public/hero-*.webp` no se eliminarán en esta fase. Pueden servir como posters o referencias hasta que Mario entregue los vídeos definitivos.

## Gate técnico común

Antes de editar y después de cada bloque estable:

```bash
cd /Users/mario/criba
npm test
npm run lint
npx tsc -b --noEmit
npm run build
```

Si existe un fallo previo, se registra antes de editar y se comprueba que el trabajo no añade fallos nuevos.

## Tarea 1: capturar la línea base

Archivos: ninguno.

Pasos:

1. Ejecutar el gate técnico común.
2. Arrancar la aplicación con `npm run dev`.
3. Capturar la landing actual en:
   - Escritorio: 1440 x 900.
   - Tablet: 768 x 1024.
   - Móvil: 390 x 844.
4. Registrar visualmente:
   - Posición del CTA antes del primer scroll.
   - Ancho y altura del hero.
   - Comportamiento del scroll al abandonar el hero.
   - Navegación móvil.
   - Precio, FAQ, soporte y pie.
5. Comprobar que `/` redirige a `/app` con una sesión activa.

La línea base permite detectar regresiones de enlaces, foco, soporte o contenido legal durante el rediseño.

Commit: ninguno.

## Tarea 2: crear el contrato de los medios

Archivos:

- Crear `src/lib/landingMedia.ts`.
- Crear `src/lib/landingMedia.test.ts`.
- Crear `src/components/landing/ProductMedia.tsx`.

Pasos:

1. Declarar una unión cerrada de identificadores:
   - `vista-general`
   - `preparar-puesto`
   - `pagina-puesto`
   - `candidaturas`
   - `filtros`
   - `ficha-estado`
2. Mantener para cada medio:
   - Título visible.
   - Proporción.
   - Ruta opcional de vídeo.
   - Ruta opcional de poster.
3. Usar estas proporciones:
   - `Vista general`: 16:9.
   - `Preparar el puesto`: 16:10.
   - `Página del puesto`: 9:19.5.
   - El resto: 16:10.
4. Implementar `ProductMedia` para que:
   - Sin vídeo, pinte un placeholder neutral con el título centrado.
   - Con vídeo, conserve exactamente la misma caja y proporción.
   - Use `muted`, `loop` y `playsInline`.
   - Reserve dimensiones desde el primer render.
   - Muestre el poster con movimiento reducido.
   - No cargue con prioridad salvo `vista-general`.
5. No dibujar controles, filas, filtros ni interfaces falsas dentro del placeholder.
6. Añadir pruebas unitarias que comprueben:
   - Todos los identificadores esperados existen una sola vez.
   - Todos tienen un título y una proporción válida.
   - Solo `vista-general` está marcado como prioritario.

Verificación:

```bash
npm test -- src/lib/landingMedia.test.ts
npx tsc -b --noEmit
```

Commit sugerido: `feat: preparar medios de la nueva landing`

## Tarea 3: separar el shell y recomponer el hero

Archivos:

- Crear `src/components/landing/LandingShell.tsx`.
- Crear `src/components/landing/LandingHero.tsx`.
- Crear `src/screens/landing.css`.
- Modificar `src/screens/Landing.tsx`.

Pasos:

1. Extraer a `LandingShell.tsx`:
   - Skip link.
   - Navegación.
   - Marca.
   - Menú móvil.
   - Pie.
   - Apertura del diálogo de soporte.
2. Conservar una sola línea de navegación en escritorio:
   - Cómo funciona.
   - Precio.
   - Entrar.
   - Empieza gratis.
3. Implementar el nuevo hero con:
   - Titular: `Encuentra a quién contratar. Sin complicarte.`
   - Texto: `Prepara el puesto, recibe cada candidatura ordenada y gestiona todo el proceso desde un solo sitio.`
   - CTA principal a `/login`.
   - CTA secundaria al ancla `como-funciona`.
   - `ProductMedia` con `vista-general`.
4. Colocar la información de la prueba gratuita inmediatamente después del hero, no dentro de su pila de texto.
5. Garantizar que titular, explicación y CTA principal aparecen antes del primer scroll en escritorio y móvil.
6. Mantener el hero asimétrico en escritorio y de una columna en móvil.
7. No portar al nuevo hero:
   - `useHeroMovido`.
   - `useHeroParallax`.
   - `useImanHero`.
   - Arrastre de piezas.
   - Carrusel automático de pantallas.
8. Mantener `Landing.tsx` como compositor de secciones y conservar la redirección autenticada.

Verificación visual:

- 390 x 844: CTA visible, sin scroll horizontal y placeholder legible.
- 768 x 1024: no queda una composición intermedia rota.
- 1440 x 900: el producto domina sin competir con otros marcos.
- Navegación por teclado desde el skip link hasta el CTA.

Commit sugerido: `feat: recomponer shell y hero de landing`

## Tarea 4: construir el recorrido del producto

Archivos:

- Crear `src/components/landing/ProductJourney.tsx`.
- Modificar `src/screens/Landing.tsx`.
- Modificar `src/screens/landing.css`.

Pasos:

1. Crear una sección `Preparar el puesto` que relacione:
   - Placeholder `Preparar el puesto`.
   - Placeholder móvil `Página del puesto`.
2. Dar a ambas superficies una composición conjunta en escritorio y apilarlas en móvil.
3. Añadir la transición breve `Tu anuncio sigue donde siempre`.
4. Mantener esa transición pequeña y sin un vídeo independiente.
5. Crear `Cada candidatura llega lista` con el placeholder `Candidaturas` como visual dominante.
6. Crear `Ve primero a quien encaja` con los placeholders:
   - `Filtros`.
   - `Ficha y estado`.
7. Evitar que ambos placeholders formen dos tarjetas idénticas. Uno debe ser dominante y el otro funcionar como continuación visual.
8. Añadir la declaración final del recorrido:
   - `Contratar bien exige criterio, no perseguir información.`
9. Limitar cada sección a:
   - Un titular corto.
   - Un texto breve.
   - Una composición visual.
10. No añadir una lista de funcionalidades después del recorrido.

Verificación de contenido:

- El recorrido debe entenderse leyendo solo los titulares.
- Ningún texto depende de un candidato, sector o canal concreto.
- No aparecen las palabras prohibidas por el glosario.
- No se presenta Apúntate Fácil como un portal que atrae candidatos.

Commit sugerido: `feat: contar el recorrido de contratación`

## Tarea 5: reconstruir confianza y conversión

Archivos:

- Crear `src/components/landing/TrustAndConversion.tsx`.
- Modificar `src/screens/Landing.tsx`.
- Modificar `src/screens/landing.css`.

Pasos:

1. Leer el testimonio con `testimoniosPublicables()`.
2. Renderizar únicamente testimonios confirmados.
3. Presentar el testimonio actual con:
   - `40 % menos tiempo de contratación` como dato principal.
   - La cita confirmada.
   - Nombre, cargo y empresa reales.
4. No añadir carrusel, estrellas, logos ni cifras inventadas.
5. Construir el precio en una composición dividida, sin tarjeta aislada:
   - `Un precio. Todo incluido.`
   - `PRECIO_PROCESO` y `+ IVA`.
   - Cuatro certezas aprobadas.
   - CTA a `/login`.
   - `PRUEBA_DIAS` y ausencia de tarjeta.
6. Reducir FAQ a cuatro preguntas:
   - Qué hace el producto.
   - Dónde se publican los anuncios.
   - Tiempo necesario para empezar.
   - Precio y cancelación.
7. Mantener el acordeón accesible con `aria-expanded`, `aria-controls`, región etiquetada y contenido fuera del orden de foco cuando está cerrado.
8. Crear el cierre luminoso:
   - `Tu próximo proceso puede ser más fácil.`
   - CTA `Empieza gratis`.
9. Mantener el pie, soporte y enlaces legales.
10. No usar una caja oscura ni invertir el tema en ninguna sección.

Verificación:

- Cambiar temporalmente `PRECIO_PROCESO` en memoria o mediante una prueba para confirmar que no hay una segunda cifra escrita a mano.
- Confirmar que un testimonio no confirmado no se renderiza.
- Abrir y cerrar FAQ con ratón y teclado.
- Abrir y cerrar el diálogo de soporte.

Commit sugerido: `feat: simplificar confianza precio y cierre`

## Tarea 6: aplicar movimiento contenido

Archivos:

- Modificar `src/screens/landing.css`.
- Modificar componentes de `src/components/landing/` únicamente donde necesiten clases o atributos de movimiento.

Pasos:

1. Implementar la entrada inicial del hero con CSS:
   - Opacidad.
   - Desplazamiento vertical pequeño.
   - Sin escala cero, máscara ni diagonal.
2. Implementar apariciones de sección con CSS scroll-driven animation cuando esté soportada.
3. Dejar el contenido completamente visible como fallback cuando no exista soporte.
4. No usar `IntersectionObserver` para ocultar contenido, porque el preview embebido del proyecto no garantiza sus callbacks.
5. No usar `window.addEventListener('scroll')`, cálculos con `scrollY` ni bucles de `requestAnimationFrame`.
6. Limitar las entradas a las composiciones principales. Precio, FAQ y cierre permanecen casi estáticos.
7. Cuando dos medios estén relacionados, aplicar un desfase de 40-80 ms.
8. Usar las curvas y duraciones existentes del proyecto:
   - 500-700 ms para entradas de marketing.
   - 120-220 ms para controles.
9. No aplicar escala al pulsar botones. La doctrina del producto exige los cambios de color definidos en `src/lib/buttons.ts`.
10. Bajo `prefers-reduced-motion`:
    - Eliminar desplazamientos.
    - Mantener como máximo un fundido corto.
    - Mostrar posters en vez de reproducir vídeos.

Verificación visual:

- Probar a velocidad normal y con DevTools ralentizado.
- Confirmar que nada aparece tarde ni permanece invisible.
- Confirmar que el scroll conserva exactamente la velocidad y posición decididas por el usuario.
- Probar `prefers-reduced-motion: reduce`.

Commit sugerido: `feat: añadir movimiento contenido a landing`

## Tarea 7: retirar la landing anterior sin borrar recursos útiles

Archivos:

- Modificar `src/screens/Landing.tsx`.
- Modificar `src/index.css`.
- Retirar `src/components/AppShot.tsx` solo si no tiene consumidores.

Pasos:

1. Eliminar del árbol nuevo:
   - Comparación de chats.
   - Pasos antiguos.
   - Cuadrícula de funcionalidades.
   - Sección independiente de equipo.
   - Comparación de costes.
   - CTA final oscura.
2. Retirar imports, constantes y funciones que solo servían a esos bloques.
3. Retirar de `src/index.css` las reglas exclusivas del hero anterior:
   - Estados `data-hero`.
   - Parallax.
   - Posición y arrastre de mocks.
   - Transiciones automáticas entre capturas.
4. Ejecutar:

   ```bash
   rg -n "useHeroMovido|useHeroParallax|useImanHero|hero-parallax|hero-agarre|AppShot|MovilShot|TablonShot" src
   ```

5. Si `AppShot.tsx` no tiene consumidores, retirarlo.
6. Conservar `public/hero-*.webp` hasta que los vídeos definitivos estén instalados y verificados.
7. Confirmar que ninguna regla global retirada afecta a pantallas fuera de `/`.

Commit sugerido: `refactor: retirar experiencia anterior de landing`

## Tarea 8: revisión de copy, accesibilidad y responsive

Archivos:

- Todos los componentes de `src/components/landing/`.
- `src/screens/Landing.tsx`.
- `src/screens/landing.css`.

Pasos:

1. Releer todas las cadenas visibles, incluidos alt text, botones y FAQ.
2. Confirmar una sola voz: clara, directa y sin lenguaje técnico.
3. Eliminar repeticiones entre hero, recorrido, FAQ y cierre.
4. Confirmar que el hero no supera:
   - Dos líneas de titular en escritorio.
   - Veinte palabras de explicación.
   - Dos acciones.
5. Confirmar una jerarquía de encabezados válida.
6. Confirmar contraste WCAG AA.
7. Confirmar foco visible y orden de teclado.
8. Comprobar que los iconos visibles tienen significado o están ocultos a lectores.
9. Verificar 320, 390, 768, 1024, 1280 y 1440 px de ancho.
10. Buscar desbordamiento horizontal en cada ancho.
11. Verificar zoom de navegador al 200 %.
12. Confirmar que el layout completo se entiende aunque ningún vídeo se reproduzca.

Comprobaciones mecánicas:

```bash
rg -n "vacante|oferta|campaña|formulario|—|–" src/components/landing src/screens/Landing.tsx
rg -n "scrollTo|scrollY|addEventListener\(['\"]scroll|requestAnimationFrame" src/components/landing src/screens/Landing.tsx src/screens/landing.css
```

Cada coincidencia debe eliminarse o justificarse por tratarse de código no visible y estrictamente necesario. El objetivo de scroll es cero coincidencias.

Commit sugerido: `fix: pulir copy accesibilidad y responsive de landing`

## Tarea 9: verificación final completa

Pasos:

1. Ejecutar el gate técnico común completo.
2. Arrancar la aplicación en un navegador real.
3. Comprobar sin sesión:
   - Hero y CTA.
   - Enlace `Ver cómo funciona`.
   - Todo el recorrido.
   - Precio.
   - FAQ.
   - Soporte.
   - Enlaces legales.
   - Registro.
4. Comprobar con sesión activa que `/` redirige a `/app`.
5. Sustituir temporalmente uno de los placeholders por un vídeo de prueba local y verificar que:
   - Conserva dimensiones.
   - No provoca CLS.
   - Se reproduce silenciado y dentro de la página.
   - El poster aparece con movimiento reducido.
6. Retirar el vídeo temporal antes del commit final.
7. Ejecutar Lighthouse en móvil y escritorio.
8. Revisar especialmente:
   - LCP del hero.
   - CLS de los medios.
   - INP de navegación y FAQ.
9. Comparar con la línea base para confirmar que no se perdieron soporte, legales, autenticación ni datos reales.
10. Revisar el diff completo y confirmar que no incluye archivos ajenos a la landing.

Commit sugerido: `test: verificar rediseño completo de landing`

## Orden de entrega de los vídeos posteriores

Cuando Mario tenga las grabaciones:

1. Copiar cada archivo a una carpeta estable bajo `public/landing/`.
2. Exportar un poster WebP con el mismo primer encuadre.
3. Añadir las rutas a `src/lib/landingMedia.ts`.
4. Verificar cada medio de forma aislada y después el recorrido completo.
5. Comprimir hasta que el conjunto no perjudique el LCP ni el uso móvil.
6. Ejecutar build, pruebas, Lighthouse y revisión visual.

El intercambio de placeholders por vídeos debe ser un cambio de datos, no de maquetación.

## Condición de cierre

El rediseño se considera terminado únicamente cuando:

- El producto se entiende en cinco segundos.
- El CTA principal está visible antes del primer scroll.
- El recorrido se entiende sin reproducir los vídeos.
- Ninguna sección repite una explicación anterior.
- Los placeholders se pueden reemplazar sin tocar el layout.
- El scroll permanece completamente natural.
- Móvil, teclado y movimiento reducido están verificados.
- Pruebas, lint, TypeScript y build están en verde.
- La revisión visual confirma una página sencilla, fiable y trabajada, sin apariencia de plantilla.

# Button shadcn para la aplicación

Fecha: 24 de julio de 2026  
Estado: aprobado en conversación, pendiente de revisión del documento

## Objetivo

Introducir `Button` de shadcn como primer componente de la migración gradual de
Apúntate Fácil. El cambio se limita a las superficies de aplicación `/app` y
`/demo`. La landing, el login y las superficies públicas conservan temporalmente
las constantes `BTN_*`.

## Decisión

Se usará la API nativa de shadcn, sin una capa de compatibilidad con los nombres
legacy:

- `default`: acción primaria ultramarine.
- `outline`: acción secundaria.
- `ghost`: acción terciaria o icon-only sin contenedor permanente.
- `destructive`: acción destructiva con tratamiento rojo contenido.
- Tamaños `sm`, `default`, `lg`, `icon-sm` e `icon`.

El estado de carga se compondrá con `Spinner`, texto explícito y `disabled`; el
componente no añadirá propiedades propias como `loading` o `isPending`.

## Tratamiento visual

- Geist, radio de 8 px y alturas de 32, 36 y 44 px.
- Objetivo táctil mínimo de 44 px en punteros gruesos.
- Primario `#374cce`, hover `#2d3fb0`, con relieve nítido y contenido.
- Outline blanco con borde grafito y sombra mínima.
- Ghost neutro, sin ultramarine decorativo.
- Destructive blanco/rojo, reservado para acciones realmente destructivas.
- Press mediante `translateY(1px)`, nunca escala.
- Foco `:focus-visible` claramente perceptible.
- Sin gradientes, springs ni sombras apiladas.

## Arquitectura

1. Configuración mínima de shadcn para Vite, Tailwind v4 y Base UI.
2. Un único componente en `src/components/ui/button.tsx`.
3. Utilidad `cn` compartida para composición de clases.
4. Los enlaces con apariencia de botón usarán `buttonVariants`.
5. `src/lib/buttons.ts` seguirá existiendo durante esta fase para landing,
   login y superficies públicas.
6. El antiguo `src/components/ui/Button.tsx` se retirará al migrar todos sus
   consumidores de aplicación, evitando archivos que solo difieran en mayúsculas.

## Alcance de migración

Se migrarán los botones visibles de:

- Shell y navegación de `/app` y `/demo`.
- Dashboard de candidatos.
- Constructor de formulario.
- Ficha lateral de candidato.
- Diálogos y flujos internos usados exclusivamente dentro de la aplicación.

No se migrarán en esta fase:

- Landing y navegación comercial.
- Login, recuperación y onboarding público.
- Formulario público del candidato.
- Respuestas públicas de comprobación de interés.
- Otros componentes shadcn.

Si un componente es compartido por una superficie interna y una pública, se
mantendrá con `BTN_*` hasta que pueda separarse sin alterar la superficie pública.

## Accesibilidad y comportamiento

- Elementos interactivos reales: `<button>` o enlace real mediante composición.
- `disabled` y `aria-busy` cuando corresponda.
- Iconos decorativos con `aria-hidden`; botones icon-only con nombre accesible.
- Los iconos usan `data-icon` y el tamaño definido por `Button`.
- El texto de carga sustituye al texto normal sin cambiar el ancho de forma brusca.
- El orden de foco y los atajos existentes no cambian.

## Verificación

- Laboratorio de estados: variantes, tamaños, icon-only, disabled y loading.
- Browser QA en 1440×900 y 390×844.
- Probar creación de puesto, editar formulario, exportar, abrir ficha y
  confirmaciones destructivas.
- Confirmar que landing y formulario público no cambian visualmente.
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- Lint de los archivos modificados.

## Fuera de alcance

No se rediseñan layouts, tarjetas, inputs, tablas, navegación ni overlays. No se
añaden funcionalidades ni se modifica el modelo de datos. El siguiente componente
solo se abordará después de revisar y aprobar visualmente `Button`.

---
name: apuntate-design
description: Applies Apúntate Fácil design doctrine ("Instrumento de precisión") when designing, redesigning, polishing, or reviewing UI, UX, copy, tokens, components, landing, dashboard, form builder, or public form. Use for visual changes, new components, layout, motion, accessibility, brand consistency, or when the user mentions design, UX, tokens, Geist, ultramarine, estados de candidato, FieldRenderer, or verificación visual in this repo.
---

# Apúntate Fácil · Design

Sobria, nítida y premium. Registro "SaaS confiable" (Linear). **Multisector neutro**: nunca olor a un solo gremio.

## Before touching UI

1. Read `PRODUCT.md` (usuarios, anti-referencias, principios) and skim `DESIGN.md` frontmatter (tokens).
2. Read at least one source of truth in code: `src/index.css` (`@theme`), `src/lib/buttons.ts`, or the file you will edit.
3. Check scope: solo estas 4 superficies (`/`, `/app/puestos/:id`, `/app/puestos/:id/formulario`, `/a/:slug`). No añadir features fuera sin hablarlo.

## Non-negotiables

### Acento (error nº1)
Ultramarine `#374cce` **solo** para acción, nav activo, foco y selección. **Nunca** para estado ni decoración. Eyebrows, iconos de feature, pasos, checks → slate/tinta. Excepción consciente: chapa "Recomendado" del plan Pro.

Tailwind: la rampa `indigo-*` está reasignada al ultramarine en `@theme`.

### Estados de candidato (paleta propia, nunca acento)
| Estado | Color |
| --- | --- |
| nuevo | slate |
| contactado | azul |
| entrevista | ámbar |
| contratado | verde (único pulse sutil) |
| descartado | slate apagado (**nunca rojo**) |

Punto de color **+** texto. Mapa: `STATUS_META` en `src/lib/types.ts`.

### Neutros, rojo, tipografía
- Grafito: fondo `#f9fafb`, superficie `#FFFFFF`, borde `#e5e7eb`, tinta `#131822` / secundario `#50545e` / terciario `#6f727c`.
- Texto con significado ≥ 4.5:1. `slate-400` solo iconos, no copy.
- Rojo `#DC2626` solo errores reales y destructivas (`BTN_DANGER`), borde + icono.
- **Geist** única familia. Jerarquía por peso/color antes que tamaño. `.num` / `tabular-nums` en números, fechas, teléfonos. Sin mono para datos.

### Radios, botones, sombras
- Inputs/campos/tarjetas/paneles/modales: **10px** (`rounded-xl`). Botones/controles pequeños: **8px** (`rounded-lg`). Pills: 999px. Landing/formulario público: tarjetas grandes hasta 16px.
- Botones: constantes `BTN_*` en `src/lib/buttons.ts`. Relieve nítido, press = `translate-y-px` (nunca `scale`).
- Una sombra por elevación: `shadow-card` tarjetas; `shadow-pop` solo overlays reales. Sin gradientes (salvo skeleton).

### Componentes clave
- `FieldRenderer`: WYSIWYG real (builder preview = formulario público). Tocar uno, tocar ambos.
- Detalle candidato: `SlideOver`, nunca modal a pantalla completa.
- Checkbox de marca: `src/components/ui/Checkbox.tsx` (app). Formulario público usa acento del cliente vía `--accent`, no ultramarine.
- Logo: `src/components/Logo.tsx` (SVG inline).

### Copy y ética
- Español, tuteo, sentence case. Sin guion largo (—).
- Tono sobrio y profesional; el tuteo no implica coloquialismo (evita slang tipo "colgar", "liarte", "montarlo").
- Glosario: puesto, candidato, candidatura, enlace, estado, exportar, formulario.
- Cero dark patterns. Test: "¿funcionaría igual si el usuario supiera cómo está hecho?"

## Workflow

### 1. Shape
- Jerarquía por peso/color, no por tamaño exagerado.
- Plano por defecto: borde + `shadow-card`. Cards solo cuando son el affordance correcto; nunca anidadas.
- Movimiento: 120/180/240 ms, solo `transform`/`opacity`, sin springs. Respeta `prefers-reduced-motion`.
- Reveals en montaje CSS, **no** `whileInView` / `IntersectionObserver` (no dispara en preview embebido).

### 2. Implement
- Reutiliza tokens `@theme`, `BTN_*`, `STATUS_META`, `Checkbox`, `FieldRenderer`.
- Formulario público: mobile-first (480px, inputs 48px/16px, validación al blur y enviar, nunca borrar datos en fallo). Ver `.cursor/rules/public-form.mdc`.
- Acento cliente: guarda AA en `src/lib/colors.ts` (`readableOn`).

### 3. Verify (obligatorio para cambios observables)
Mismo rigor en el cambio pequeño que en el grande.

```
Checklist:
- [ ] Navegador: capturar, mirar, probar interacciones (clicks, toggles, estados)
- [ ] Acento no decorativo; estados sin ultramarine; descartado sin rojo
- [ ] Contraste AA en texto significativo
- [ ] Foco visible (:focus-visible)
- [ ] cd /Users/mario/criba && npm run build
- [ ] cd /Users/mario/criba && npx tsc --noEmit
```

Si algo no cumple, rehacer antes de cerrar. Safari/dnd-kit: no confiar solo en preview Chrome.

## Anti-referencias rápidas

Rechazar: plantilla SaaS genérica, `.99`, urgencia falsa, testimonios inventados, mascotas/emojis, cascos/naranjas de obra, glassmorphism decorativo, sombras apiladas, borde lateral de color como acento, modal fullscreen para detalle candidato.

## Recursos

- Tokens y reglas narrativas: [DESIGN.md](../../../DESIGN.md), [CLAUDE.md](../../../CLAUDE.md)
- Checklist ampliado, mapa de archivos y formulario público: [reference.md](reference.md)
- Reglas Cursor: `.cursor/rules/design-system.mdc`, `copy.mdc`, `public-form.mdc`

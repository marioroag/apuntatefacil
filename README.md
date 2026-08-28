# Apúntate Fácil

App para automatizar la contratación a través de Milanuncios (y similares), **multisector**:
hostelería, construcción, logística, limpieza, comercio, etc.

> **Idea**: la empresa pone su anuncio en Milanuncios como siempre. A quien responde le manda **un enlace**
> en vez de chatear. El enlace abre un **formulario personalizable**; cada envío entra en su **base de datos**
> de candidatos, que puede **filtrar** y **exportar a Excel** cuando quiera.

La marca **Apúntate Fácil** (dominio apuntatefacil.com) se define en un único sitio: [`src/lib/brand.ts`](src/lib/brand.ts).

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173
```

## Las 5 superficies (rutas)

| Ruta | Qué es |
| --- | --- |
| `/` | Landing de marketing |
| `/app` | Panel del cliente (Vista general, puestos, Candidatos, Entrevistas, Equipo, Ajustes, Facturación) |
| `/app/puestos/:id` | Base de datos de candidatos: filtros, estados, export a Excel, detalle |
| `/app/puestos/:id/formulario` | Constructor del formulario (drag & drop) + preview en vivo |
| `/a/:slug` | Anuncio público del puesto y, con `?apuntarse`, el formulario del candidato (mobile-first) |

Datos de ejemplo: una ETT con 6 puestos y ~680 candidatos. Todo vive en `localStorage`
(clave `apuntatefacil.demo.v13`); las fechas se anclan a cada visita para que no
envejezcan. Tus cambios **persisten**. Para reiniciar: borra esa clave o llama a `resetDemo()`.

## Decisiones de diseño (doctrina "Instrumento de precisión"; la fuente de verdad es `CLAUDE.md`)

- Acento **ultramarine `#3b4fe4`** solo para acción, foco y selección. Nunca para estado ni para el nav.
- 5 estados de candidato con paleta propia: nuevo (slate), contactado (azul), entrevista (ámbar),
  contratado (verde), descartado (slate apagado, **nunca rojo**).
- Un único `FieldRenderer` pinta **a la vez** la preview del builder y el formulario público (WYSIWYG real).
- Formulario público mobile-first, validación al blur, guarda de contraste AA para el color del cliente.
- Sin dark patterns en la landing (sin urgencia falsa, sin prueba social inventada).

El sistema de diseño se sintetizó con la skill `ux-ui-mastery` (NNG heuristics, cognitive-psychology-ux,
ui-visual-design-system, accessibility, etc.).

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · react-router · framer-motion · dnd-kit · SheetJS (xlsx) · lucide-react

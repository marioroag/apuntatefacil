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

## Las 4 superficies (rutas)

| Ruta | Qué es |
| --- | --- |
| `/` | Landing de marketing |
| `/app` | Panel del cliente (redirige al primer puesto) |
| `/app/puestos/:id` | Base de datos de candidatos: filtros, estados, export a Excel, detalle |
| `/app/puestos/:id/formulario` | Constructor del formulario (drag & drop) + preview en vivo |
| `/a/:slug` | Formulario público que rellena el candidato (mobile-first) |

Datos de ejemplo: una ETT Multi (sedes, marcas, ~170 candidatos y Equipo). Todo vive en
`localStorage` (clave `apuntatefacil.demo.v3`), así que tus cambios (estados, envíos, edición del
formulario) **persisten**. Para reiniciar la demo: borra esa clave o llama a `resetDemo()`.

## Decisiones de diseño (doctrina "SaaS confiable")

- Acento **índigo `#4F46E5`** solo para acción/nav/foco/selección. Nunca para estado.
- 5 estados de candidato con paleta propia: nuevo (slate), contactado (azul), entrevista (ámbar),
  contratado (verde), descartado (slate apagado, **nunca rojo**).
- Un único `FieldRenderer` pinta **a la vez** la preview del builder y el formulario público (WYSIWYG real).
- Formulario público mobile-first, validación al blur, guarda de contraste AA para el color del cliente.
- Sin dark patterns en la landing (sin urgencia falsa, sin prueba social inventada).

El sistema de diseño se sintetizó con la skill `ux-ui-mastery` (NNG heuristics, cognitive-psychology-ux,
ui-visual-design-system, accessibility, etc.).

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · react-router · framer-motion · dnd-kit · SheetJS (xlsx) · lucide-react

---
name: Apúntate Fácil
description: SaaS de contratación nítido y premium ("Instrumento de precisión"): Geist, ultramarine sobre grafito, una sola sombra por elevación
colors:
  accent: "#374CCE"
  accent-hover: "#2D3FB0"
  accent-bright: "#4761F0"
  accent-wash: "#EEF2FE"
  ink: "#131822"
  ink-strong: "#242833"
  ink-secondary: "#50545E"
  ink-tertiary: "#6F727C"
  surface: "#FFFFFF"
  bg-app: "#F9FAFB"
  fill-muted: "#F4F5F7"
  border: "#E5E7EB"
  border-strong: "#D1D4DB"
  status-new: "#6F727C"
  status-contacted: "#3B82F6"
  status-interview: "#F59E0B"
  status-hired: "#22C55E"
  status-discarded: "#D1D4DB"
  danger: "#DC2626"
typography:
  display:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    note: "Marca (landing y app): wordmark 'apuntatefacil' (.brand-wordmark, extrabold, tinta) y TODOS los titulares (h1/h2/h3). El cuerpo, las tablas y los datos densos siguen en Inter."
  headline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1, 'cv05' 1"
  label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
  overline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "40px"
  "4xl": "64px"
  section: "80px"
  section-lg: "96px"
  roles:
    stack-tight: "8px dentro de un grupo"
    stack: "16px entre grupos relacionados"
    stack-loose: "24px padding de tarjeta"
    block: "40px entre bloques"
    section: "80px / 96px entre secciones (`.section-y`)"
marketing-type:
  micro: "11px"
  caption: "12px"
  label: "13px"
  copy: "14px"
  copy-md: "15px"
  title: "17px"
  lockup: "20px"
  hero: "34px"
  hero-lg: "52px"
  heading-xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  chip-status:
    backgroundColor: "{colors.fill-muted}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Apúntate Fácil

> Migrado al sistema nuevo "Instrumento de precisión" (jun 2026): **tipografía Geist** (familia única, sin mono), **acento ultramarine `#374CCE`** (solo acción/nav/foco/selección; el uso decorativo se neutraliza a slate), **neutros grafito**, radios por rol (inputs/tarjetas 10px, botones 8px), botón con relieve (`lib/buttons.ts`) y logo SVG. Los tokens (frontmatter, arriba) ya reflejan el sistema nuevo; parte de la prosa narrativa aún menciona el viejo (índigo/Inter) y se regenerará con `/impeccable document`. Fuente de verdad: `CLAUDE.md`.

## 1. Overview

**Creative North Star: "La mesa de trabajo despejada"**

Apúntate Fácil recibe el caos de decenas de respuestas sueltas en un chat y las deja en una superficie ordenada donde cada cosa está en su sitio. La interfaz es la mesa de trabajo despejada: sobria, precisa, sin adornos, con bajo coste cognitivo. La herramienta desaparece en la tarea. El registro es el de "SaaS confiable" tipo Linear, Notion y Stripe: familiaridad ganada, no sorpresa. La emoción objetivo es **control y calma sobre el caos**: nada parpadea pidiendo atención, el siguiente paso siempre está claro.

La densidad es la de una herramienta de trabajo: tablas con muchas filas, paneles con muchas etiquetas, datos cuando el usuario los necesita. La jerarquía se construye con **peso y color antes que con tamaño**, porque hay muchos elementos de tipo y el contraste exagerado solo crearía ruido. El color es contenido: un único acento índigo para lo accionable y una escala neutra slate para todo lo demás. Multisector neutro: un bar, una obra y una ETT usan la misma app, así que la estética **nunca** se inclina a un gremio (cero cascos, naranjas de obra, iconografía de oficio).

Este sistema rechaza explícitamente el molde de SaaS de plantilla (rejillas de cards idénticas, eyebrow tracked sobre cada sección, plantilla hero-métrica, degradados de IA), todo lo que huela a ganga (`.99`, urgencia, gradientes chillones), lo infantil (mascotas, emojis, colores de caramelo) y cualquier dark pattern. La calidad se demuestra en la contención y el detalle, no en efectos.

**Key Characteristics:**
- Un solo acento (índigo `#374CCE`) y neutros slate; color = significado, nunca decoración.
- Jerarquía por peso y color antes que por tamaño; una sola familia (Inter).
- Plano por defecto, una sola sombra por elevación, bordes que hacen el trabajo.
- Estado de candidato = punto de color **+** texto, con paleta propia que nunca usa el índigo.
- Mobile-first donde el candidato (y a menudo quien contrata) están; accesibilidad como suelo, no como extra.

## 2. Colors: La paleta de la mesa despejada

Un único acento índigo de confianza sobre una escala neutra slate; el color solo aparece donde hay significado.

### Primary
- **Índigo de confianza** (`#374CCE`): el acento de marca. Aparece SOLO en lo accionable: botón primario, nav activo, anillo de foco, selección y el acento configurable del formulario público. Profundo y sereno, dice "fiable" sin gritar. Variantes: hover/active `#2D3FB0`, brillo superior del relieve `#4761F0`, lavado de fondo (nav activo, tinte de foco) `#EEF2FE`.

### Neutral
- **Tinta** (`#131822`, slate-900): texto principal. **Tinta fuerte** (`#242833`, slate-800): texto de botón secundario y énfasis. **Tinta secundaria** (`#50545E`, slate-600): subtítulos y texto de apoyo legible. **Tinta terciaria** (`#6F727C`, slate-500): metadatos, placeholders con significado. Todo texto con significado cumple ≥ 4.5:1.
- **Superficie** (`#FFFFFF`): tarjetas, paneles, inputs. **Fondo de app** (`#F9FAFB`, slate-50): el lienzo bajo las superficies, una segunda capa neutra. **Relleno tenue** (`#F4F5F7`, slate-100): chips neutros, filas en hover, mini-stats. **Borde** (`#E5E7EB`, slate-200): divisores y contornos de tarjeta. **Borde fuerte** (`#D1D4DB`, slate-300): contorno de input.

### Tertiary (paleta de estado, semántica y fija)
Los cinco estados de candidato tienen color propio y **nunca** usan el índigo de marca:
- **Nuevo** (`#6F727C`, slate): a la espera, neutro. **Contactado** (`#3B82F6`, azul). **Entrevista** (`#F59E0B`, ámbar). **Contratado** (`#22C55E`, verde): el único hito celebrable. **Descartado** (`#D1D4DB`, slate apagado): rutina y reversible, **nunca rojo**.
- **Peligro** (`#DC2626`, red-600): SOLO errores reales y acciones destructivas, con borde + icono, nunca solo color.

### Named Rules
**La regla del acento único.** El índigo `#374CCE` se reserva a acción, navegación activa, foco y selección. Nunca para estado ni para decorar. Es el error número uno a evitar: un índigo decorativo destruye su significado.

**La regla "estado no es marca".** Los estados de candidato usan su paleta fija (slate / azul / ámbar / verde / slate). Si un estado aparece en índigo, está mal. Descartar es rutina: nunca rojo, nunca shake.

**La regla del punto y el texto.** Un estado se comunica con punto de color **y** texto, jamás solo con color (daltonismo, contraste).

## 3. Typography

**Display / Body / Label Font:** Inter Variable (autoalojada), con `system-ui, sans-serif` de reserva. Una sola familia para titulares, botones, etiquetas, cuerpo y datos.

**Character:** Inter es una grotesca neutra y legible que desaparece: ni editorial ni técnica, exactamente la voz "herramienta de confianza" del sistema. La personalidad la dan el peso y el color, no la elección de fuente.

### Hierarchy
- **Headline** (600, 1.25rem / 20px, line-height 1.35): títulos de página ("Vista general", "Sedes"). El elemento de tipo más grande del panel; el producto no necesita display.
- **Title** (600, 1rem / 16px): títulos de sección y de panel/tarjeta.
- **Body** (400, 0.875rem / 14px, line-height 1.5): el texto de UI por defecto. Prosa hasta 65–75ch; datos y UI compacta pueden ir más densos.
- **Label** (500, 0.8125rem / 13px): etiquetas, chips, controles. Verbo-primero, 1–3 palabras, sentence case.
- **Overline** (600, 0.6875rem / 11px, tracking 0.05em, mayúsculas): SOLO las cabeceras de grupo del menú lateral (p. ej. nombres de sede). Es el único uso de mayúsculas tracked del sistema, deliberado y acotado.

### Named Rules
**La regla del peso antes que el tamaño.** La jerarquía se construye subiendo el peso (400 → 500 → 600) y oscureciendo el color (terciaria → secundaria → tinta) antes que agrandando la fuente. Mantiene la densidad sin ruido.

**La regla de los números tabulares.** Todo número, fecha y teléfono usa `tabular-nums` (`tnum`) para que las columnas alineen. Es global; no se desactiva.

## 4. Elevation

> Los valores viven en el `@theme` de `src/index.css` y la doctrina completa en la sección
> **"Acabado"** de `CLAUDE.md`. Esto es el resumen; si divergen, gana el CSS.

Plano por defecto. La profundidad la dan los bordes y la capa de fondo (`#f9fafb` bajo superficies blancas), no las sombras. Cuando hace falta elevación hay **seis piezas con nombre**, y nunca se apilan.

### Shadow Vocabulary
- **`shadow-control`** (`0 1px 2px rgba(18,22,34,0.06)`): un control en reposo, botón hairline o campo.
- **`shadow-raised`** (`inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px rgba(18,22,34,0.24)`): sólido con relieve. Filo de luz de 1px arriba por dentro más sombra de contacto: es lo que da el tacto mecanizado del primario sin convertirlo en un objeto 3D.
- **`shadow-pressed`** (`inset 0 1px 2px rgba(15,20,60,0.35)`): hundido. Sustituye al relieve mientras se pulsa.
- **`shadow-card`** (`0 1px 2px rgba(18,22,34,0.05), 0 2px 6px -2px rgba(18,22,34,0.08)`): tarjeta o panel asentado. Dos capas porque un objeto apoyado produce una línea apretada donde toca más una penumbra ancha; con solo la segunda, flota en niebla.
- **`shadow-pop`** (`0 16px 40px -12px rgba(18,22,34,0.20), 0 6px 16px -8px rgba(18,22,34,0.12)`): SOLO lo que de verdad flota (dropdowns, paneles, modales).
- **`shadow-sticky`** (`0 6px 8px -7px rgba(18,22,34,0.24)`): cabecera pegajosa con contenido pasando por debajo. El spread negativo grande la deja en una banda fina y dirigida.

Ninguna es negro puro: van teñidas con la tinta `#131822`, porque el negro sobre un fondo frío se enturbia. Todas por debajo del 10% de opacidad salvo el relieve.

### Named Rules
**La regla de una sombra por elevación.** Cada elemento usa como mucho una del vocabulario. Apilarlas, usar `shadow-pop` en algo que no flota, o escribir una a mano con `shadow-[...]`, está prohibido: el test `src/lib/acabado.test.ts` lo hace fallar. La escala de Tailwind (`shadow-sm/md/lg/xl`) no pertenece al sistema. En `forced-colors`, las sombras se refuerzan con un borde de 1px.

## 5. Components

Familiar y de confianza: vocabulario estándar, cero affordances inventadas. La herramienta desaparece en la tarea. Misma forma de botón, mismo control de formulario, mismo estilo de icono en toda la app (Lucide a `--stroke-icon`, hoy 1,75; el trazo se gobierna desde `index.css`, la prop `strokeWidth` ya no pinta).

### Buttons
- **Shape:** esquinas de 10px (`rounded-[10px]`), altura fija 36px (`h-9`).
- **Primary:** relieve índigo. Degradado `#4761F0 → #374CCE`, texto blanco 600, anillo interior `rgba(67,56,202,0.5)`, brillo superior + sombra ínfima. Padding `0 16px`.
- **Hover / Active:** hover oscurece el degradado a `#2D3FB0`; active baja 1px (`translateY(1px)`) y cambia a sombra interior. Foco: `outline: 2px solid #374CCE` con `outline-offset: 2px`.
- **Secondary:** superficie blanca con borde `rgba(203,213,225,0.7)`, texto tinta fuerte `#242833` 500, sombra de reposo mínima. Hover a `#F9FAFB`, active baja 1px. Es la acción de menor peso, no un botón fantasma plano.

### Chips
- **Style:** píldora (`rounded-full`), `bg-{estado}-50` + `text-{estado}-700` + anillo interior `ring-{estado}-200`. Punto de color a la izquierda + etiqueta.
- **State:** los chips de estado son lectura (no togglan); los chips de filtro activos llevan una "x" para quitarse. Nunca usan el índigo de marca.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`).
- **Background:** superficie blanca sobre fondo `#F9FAFB`.
- **Shadow Strategy:** `shadow-card` en reposo (ver Elevation). Nunca `shadow-pop` salvo que floten de verdad.
- **Border:** 1px `#E5E7EB` siempre; el borde hace tanto trabajo como la sombra.
- **Internal Padding:** 16–20px (`p-4` / `p-5`). Tarjetas anidadas: prohibidas.

### Inputs / Fields
- **Style:** 12px de radio, borde `#D1D4DB`, fondo blanco, alto 40px en panel (48px y fuente 16px en el formulario público para evitar el zoom de iOS).
- **Focus:** borde a `#374CCE` + halo `0 0 0 4px rgba(79,70,229,0.15)`. Nunca se quita el outline.
- **Error / Disabled:** error con borde + icono `#DC2626` (nunca solo color); validación al blur y al enviar, jamás al teclear. En un envío fallido **nunca** se borra lo que el candidato escribió ni su CV.

### Navigation
- **Style:** menú lateral blanco (240px) con borde derecho `#E5E7EB`; en móvil, drawer deslizante con overlay. Ítems de 36px, radio 12px.
- **States:** inactivo `text-slate-600` con icono `#94A3B8`; hover `bg-slate-100`; **activo** `bg-#EEF2FE` + texto tinta 600 + icono índigo. Los puestos se agrupan por sede bajo cabeceras overline.

### Signature: el FieldRenderer WYSIWYG
Un único componente pinta a la vez la preview del constructor de formularios y el formulario público real. Si tocas uno, tocas los dos: no existe una versión "bonita" distinta del producto. El acento configurable del cliente pasa por una guarda de contraste AA (`src/lib/colors.ts`): si el blanco no llega a 4.5:1 sobre su color, el texto del botón pasa a tinta oscura automáticamente.

### Signature: el detalle en pop-up con pestañas
El detalle de un candidato abre en un **pop-up con pestañas** (`src/screens/CandidateModal.tsx`, jul 2026): reparto fijo, a la izquierda lo que dice el candidato (Resumen / Respuestas / CV) y a la derecha lo que dice tu equipo (Equipo / Historial), con flechas al siguiente de la lista filtrada y enlace directo. Sustituyó al SlideOver de 460px, que obligaba a apilar en una columna estrecha todo lo que hay que saber de una persona; que la lista siga a la vista ya lo da el telón translúcido. El SlideOver sigue siendo lo correcto para detalles SECUNDARIOS (peticiones del tablón).

## 6. Do's and Don'ts

### Do:
- **Do** reservar el índigo `#374CCE` a acción, nav activo, foco y selección; para todo lo demás, slate.
- **Do** comunicar el estado con punto de color **+** texto, usando la paleta fija de estado (slate / azul / ámbar / verde / slate), nunca el índigo.
- **Do** construir jerarquía con peso (400/500/600) y color antes que con tamaño; una sola familia, Inter, con `tabular-nums` en todo número.
- **Do** mantener plano por defecto: borde + `shadow-card` en reposo, `shadow-pop` solo en lo que flota de verdad, una sola sombra por elevación.
- **Do** respetar el suelo de accesibilidad: `:focus-visible` siempre visible, contraste ≥ 4.5:1 (incluido placeholder), `prefers-reduced-motion`, alternativa de teclado al drag, inputs de 16px en táctil.
- **Do** mantener movimiento corto y sobrio (120/180/240 ms, solo transform/opacity); el verde "contratado" es el único hito con un pulse sutil.

### Don't:
- **Don't** usar el índigo de marca para estados ni para decorar; **don't** pintar "descartado" en rojo ni con shake (es rutina y reversible).
- **Don't** caer en el molde de SaaS de plantilla: rejillas de cards idénticas, eyebrow tracked sobre cada sección, plantilla hero-métrica, degradados de IA.
- **Don't** parecer cutre o de ganga: nada de `.99`, contadores de urgencia, gradientes chillones ni prueba social inventada (testimonios, contadores de usuarios, logos). Cero dark patterns: el test es "¿funcionaría igual si el usuario supiera cómo está hecho?".
- **Don't** parecer infantil ni de juguete (mascotas, ilustraciones blandas, emojis decorativos, colores de caramelo) ni sesgar la estética a un gremio (cascos, naranjas de obra, iconografía de oficio).
- **Don't** usar borde lateral de color (`border-left`/`right` > 1px) como acento, texto con degradado (`background-clip: text`), glassmorphism decorativo ni sombras apiladas.
- **Don't** abrir el detalle en un modal a pantalla completa; **don't** anidar tarjetas; **don't** validar al teclear ni borrar lo que el candidato ya escribió en un envío fallido.

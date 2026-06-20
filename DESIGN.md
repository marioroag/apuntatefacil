---
name: Apúntate Fácil
description: SaaS de contratación sobrio y de confianza, índigo sobre slate, una sola sombra por elevación
colors:
  accent: "#4F46E5"
  accent-hover: "#4338CA"
  accent-bright: "#6366F1"
  accent-wash: "#EEF2FF"
  ink: "#0F172A"
  ink-strong: "#1E293B"
  ink-secondary: "#475569"
  ink-tertiary: "#64748B"
  surface: "#FFFFFF"
  bg-app: "#F8FAFC"
  fill-muted: "#F1F5F9"
  border: "#E2E8F0"
  border-strong: "#CBD5E1"
  status-new: "#64748B"
  status-contacted: "#3B82F6"
  status-interview: "#F59E0B"
  status-hired: "#22C55E"
  status-discarded: "#CBD5E1"
  danger: "#DC2626"
typography:
  display:
    fontFamily: "Archivo Variable, Inter Variable, system-ui, sans-serif"
    note: "Solo titulares de la landing (h1/h2/h3, .landing-display). El resto de la app y todo el cuerpo siguen en Inter."
  headline:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1, 'cv05' 1"
  label:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
  overline:
    fontFamily: "Inter Variable, system-ui, sans-serif"
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

## 1. Overview

**Creative North Star: "La mesa de trabajo despejada"**

Apúntate Fácil recibe el caos de decenas de respuestas sueltas en un chat y las deja en una superficie ordenada donde cada cosa está en su sitio. La interfaz es la mesa de trabajo despejada: sobria, precisa, sin adornos, con bajo coste cognitivo. La herramienta desaparece en la tarea. El registro es el de "SaaS confiable" tipo Linear, Notion y Stripe: familiaridad ganada, no sorpresa. La emoción objetivo es **control y calma sobre el caos**: nada parpadea pidiendo atención, el siguiente paso siempre está claro.

La densidad es la de una herramienta de trabajo: tablas con muchas filas, paneles con muchas etiquetas, datos cuando el usuario los necesita. La jerarquía se construye con **peso y color antes que con tamaño**, porque hay muchos elementos de tipo y el contraste exagerado solo crearía ruido. El color es contenido: un único acento índigo para lo accionable y una escala neutra slate para todo lo demás. Multisector neutro: un bar, una obra y una ETT usan la misma app, así que la estética **nunca** se inclina a un gremio (cero cascos, naranjas de obra, iconografía de oficio).

Este sistema rechaza explícitamente el molde de SaaS de plantilla (rejillas de cards idénticas, eyebrow tracked sobre cada sección, plantilla hero-métrica, degradados de IA), todo lo que huela a ganga (`.99`, urgencia, gradientes chillones), lo infantil (mascotas, emojis, colores de caramelo) y cualquier dark pattern. La calidad se demuestra en la contención y el detalle, no en efectos.

**Key Characteristics:**
- Un solo acento (índigo `#4F46E5`) y neutros slate; color = significado, nunca decoración.
- Jerarquía por peso y color antes que por tamaño; una sola familia (Inter).
- Plano por defecto, una sola sombra por elevación, bordes que hacen el trabajo.
- Estado de candidato = punto de color **+** texto, con paleta propia que nunca usa el índigo.
- Mobile-first donde el candidato (y a menudo quien contrata) están; accesibilidad como suelo, no como extra.

## 2. Colors: La paleta de la mesa despejada

Un único acento índigo de confianza sobre una escala neutra slate; el color solo aparece donde hay significado.

### Primary
- **Índigo de confianza** (`#4F46E5`): el acento de marca. Aparece SOLO en lo accionable: botón primario, nav activo, anillo de foco, selección y el acento configurable del formulario público. Profundo y sereno, dice "fiable" sin gritar. Variantes: hover/active `#4338CA`, brillo superior del relieve `#6366F1`, lavado de fondo (nav activo, tinte de foco) `#EEF2FF`.

### Neutral
- **Tinta** (`#0F172A`, slate-900): texto principal. **Tinta fuerte** (`#1E293B`, slate-800): texto de botón secundario y énfasis. **Tinta secundaria** (`#475569`, slate-600): subtítulos y texto de apoyo legible. **Tinta terciaria** (`#64748B`, slate-500): metadatos, placeholders con significado. Todo texto con significado cumple ≥ 4.5:1.
- **Superficie** (`#FFFFFF`): tarjetas, paneles, inputs. **Fondo de app** (`#F8FAFC`, slate-50): el lienzo bajo las superficies, una segunda capa neutra. **Relleno tenue** (`#F1F5F9`, slate-100): chips neutros, filas en hover, mini-stats. **Borde** (`#E2E8F0`, slate-200): divisores y contornos de tarjeta. **Borde fuerte** (`#CBD5E1`, slate-300): contorno de input.

### Tertiary (paleta de estado, semántica y fija)
Los cinco estados de candidato tienen color propio y **nunca** usan el índigo de marca:
- **Nuevo** (`#64748B`, slate): a la espera, neutro. **Contactado** (`#3B82F6`, azul). **Entrevista** (`#F59E0B`, ámbar). **Contratado** (`#22C55E`, verde): el único hito celebrable. **Descartado** (`#CBD5E1`, slate apagado): rutina y reversible, **nunca rojo**.
- **Peligro** (`#DC2626`, red-600): SOLO errores reales y acciones destructivas, con borde + icono, nunca solo color.

### Named Rules
**La regla del acento único.** El índigo `#4F46E5` se reserva a acción, navegación activa, foco y selección. Nunca para estado ni para decorar. Es el error número uno a evitar: un índigo decorativo destruye su significado.

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

Plano por defecto. La profundidad la dan los bordes y la capa de fondo (`#F8FAFC` bajo superficies blancas), no las sombras. Cuando hace falta elevación hay **exactamente dos** sombras, y nunca se apilan.

### Shadow Vocabulary
- **Reposo de tarjeta** (`box-shadow: 0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)`): tarjetas y paneles asentados sobre el fondo. Apenas perceptible, da peso sin dramatismo.
- **Capa flotante** (`box-shadow: 0 8px 24px rgba(15,23,42,0.12)`): SOLO superficies que de verdad flotan sobre el contenido (dropdowns, paneles deslizantes, modales).
- **Relieve de botón primario** (`inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(30,27,75,0.35)`): excepción consciente y única a la planitud; el brillo interior + sombra ínfima dan tacto al botón primario sin convertirlo en un objeto 3D.

### Named Rules
**La regla de una sombra por elevación.** Cada elemento usa como mucho una sombra del vocabulario. Apilar sombras, o usar `shadow-pop` en algo que no flota de verdad, está prohibido. En `forced-colors`, las sombras se refuerzan con un borde de 1px.

## 5. Components

Familiar y de confianza: vocabulario estándar, cero affordances inventadas. La herramienta desaparece en la tarea. Misma forma de botón, mismo control de formulario, mismo estilo de icono en toda la app (Lucide, trazo 2px).

### Buttons
- **Shape:** esquinas de 10px (`rounded-[10px]`), altura fija 36px (`h-9`).
- **Primary:** relieve índigo. Degradado `#6366F1 → #4F46E5`, texto blanco 600, anillo interior `rgba(67,56,202,0.5)`, brillo superior + sombra ínfima. Padding `0 16px`.
- **Hover / Active:** hover oscurece el degradado a `#4338CA`; active baja 1px (`translateY(1px)`) y cambia a sombra interior. Foco: `outline: 2px solid #4F46E5` con `outline-offset: 2px`.
- **Secondary:** superficie blanca con borde `rgba(203,213,225,0.7)`, texto tinta fuerte `#1E293B` 500, sombra de reposo mínima. Hover a `#F8FAFC`, active baja 1px. Es la acción de menor peso, no un botón fantasma plano.

### Chips
- **Style:** píldora (`rounded-full`), `bg-{estado}-50` + `text-{estado}-700` + anillo interior `ring-{estado}-200`. Punto de color a la izquierda + etiqueta.
- **State:** los chips de estado son lectura (no togglan); los chips de filtro activos llevan una "x" para quitarse. Nunca usan el índigo de marca.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`).
- **Background:** superficie blanca sobre fondo `#F8FAFC`.
- **Shadow Strategy:** `shadow-card` en reposo (ver Elevation). Nunca `shadow-pop` salvo que floten de verdad.
- **Border:** 1px `#E2E8F0` siempre; el borde hace tanto trabajo como la sombra.
- **Internal Padding:** 16–20px (`p-4` / `p-5`). Tarjetas anidadas: prohibidas.

### Inputs / Fields
- **Style:** 12px de radio, borde `#CBD5E1`, fondo blanco, alto 40px en panel (48px y fuente 16px en el formulario público para evitar el zoom de iOS).
- **Focus:** borde a `#4F46E5` + halo `0 0 0 4px rgba(79,70,229,0.15)`. Nunca se quita el outline.
- **Error / Disabled:** error con borde + icono `#DC2626` (nunca solo color); validación al blur y al enviar, jamás al teclear. En un envío fallido **nunca** se borra lo que el candidato escribió ni su CV.

### Navigation
- **Style:** menú lateral blanco (240px) con borde derecho `#E2E8F0`; en móvil, drawer deslizante con overlay. Ítems de 36px, radio 12px.
- **States:** inactivo `text-slate-600` con icono `#94A3B8`; hover `bg-slate-100`; **activo** `bg-#EEF2FF` + texto tinta 600 + icono índigo. Los puestos se agrupan por sede bajo cabeceras overline.

### Signature: el FieldRenderer WYSIWYG
Un único componente pinta a la vez la preview del constructor de formularios y el formulario público real. Si tocas uno, tocas los dos: no existe una versión "bonita" distinta del producto. El acento configurable del cliente pasa por una guarda de contraste AA (`src/lib/colors.ts`): si el blanco no llega a 4.5:1 sobre su color, el texto del botón pasa a tinta oscura automáticamente.

### Signature: el detalle en panel lateral
El detalle de un candidato abre en un SlideOver (panel lateral con `shadow-pop`), nunca en un modal a pantalla completa que tape la lista filtrada. El usuario no pierde el contexto de lo que estaba revisando.

## 6. Do's and Don'ts

### Do:
- **Do** reservar el índigo `#4F46E5` a acción, nav activo, foco y selección; para todo lo demás, slate.
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

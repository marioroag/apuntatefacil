---
name: Apúntate Fácil
description: SaaS de contratación nítido y premium ("Instrumento de precisión"): Geist, ultramarine sobre grafito, botón plano, una sola sombra por elevación
colors:
  accent: "#3B4FE4"
  accent-hover: "#2D3FB0"
  accent-active: "#263690"
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
  novedad: "#131822"
  status-new: "#6F727C"
  status-contacted: "#3B82F6"
  status-interview: "#F59E0B"
  status-hired: "#22C55E"
  status-discarded: "#D1D4DB"
  favorito-fill: "amber-400"
  favorito-stroke: "amber-500"
  danger: "#DC2626"
typography:
  display:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    note: "UNA sola familia para todo el producto: wordmark (.brand-wordmark), titulares, cuerpo, etiquetas y datos. Sin mono para datos (se probó Geist Mono y se descartó); las cifras van tabulares (.num)."
  headline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.012em"
    note: "Título de pantalla (PageHeader): 24px/700. No puede perder contra un número de dentro."
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
    note: "Mayúsculas SIEMPRE con tracking positivo, y solo para rótulos de categoría. Un nombre propio (empresa, persona, puesto) va en caja normal: en versalita grita y le cambia el nombre al cliente."
rounded:
  control: "8px (rounded-lg): botones y controles pequeños"
  campo: "10px (rounded-xl): inputs, tarjetas, paneles, modales (radius-xl está reasignado a 10px en @theme)"
  externa: "16px (rounded-2xl): tarjetas grandes de landing y formulario público"
  pill: "9999px: pills de estado, chips de filtro, avatares"
  etiqueta: "4px (rounded-sm): las etiquetas de candidato, que así no se confunden con un estado"
motion:
  control: "150ms (--duration-control) + --ease-out: lo que responde al dedo (hover, press, color)"
  enter: "180ms (--duration-enter): algo aparece o desaparece"
  max: "240ms (--duration-max) + --ease-standard: el techo; overlays grandes y barras que recorren distancia"
  rule: "Solo transform/opacity. Sin springs ni rebotes. prefers-reduced-motion respetado. Un reset no se anima."
shadows:
  control: "0 1px 2px rgba(18,22,34,0.06)"
  raised: "inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px rgba(18,22,34,0.24) (solo el pomo del Switch)"
  card: "0 1px 2px rgba(18,22,34,0.05), 0 2px 6px -2px rgba(18,22,34,0.08)"
  pop: "0 16px 40px -12px rgba(18,22,34,0.20), 0 6px 16px -8px rgba(18,22,34,0.12)"
  sticky: "0 6px 8px -7px rgba(18,22,34,0.24)"
  acceso: "0 24px 64px -8px rgba(18,22,34,0.16), 0 8px 20px -12px rgba(18,22,34,0.10)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "8px"
    height: "36px"
    padding: "0 14px"
    note: "PLANO: sin filo de luz, sin anillo interior, sin sombra de contacto. Hover indigo-700, active indigo-800: tres peldaños de la misma rampa. Press = translate-y-px, nunca scale."
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    ring: "1px slate-300, SIEMPRE ring-inset"
    rounded: "8px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "10px"
    border: "filo (dos manos: border + outline a -1px, ver Acabado) y overflow-clip"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "10px"
    height: "40px (48px y fuente 16px en el formulario público)"
    focus: "borde indigo-500 + ring-4 indigo-500/15"
  sidebar:
    width: "256px (contraíble a 64, preferencia en localStorage)"
    backgroundColor: "var(--color-lateral) (BLANCO; el trabajo va un paso por debajo, slate-50)"
    row: "34px escritorio / 44px táctil, icono 18, hueco 16, texto 15px slate-900"
    active: "var(--color-lateral-activo) + tinta, SIN acento y SIN cambiar el peso"
  status-pill:
    style: "punto de color + texto, rounded-full, relleno tono-100 + texto tono-800, SIN anillo"
  tag-chip:
    style: "rectángulo rounded-sm, relleno tono-100 + texto tono-800; el tono sale del ID (repartirTonos), nunca lo elige nadie"
---

# Design System: Apúntate Fácil

> Resumen del sistema "Instrumento de precisión" tras el reskin de ago 2026 (lateral único,
> botón plano, rejilla de datos, etiquetas con color). **Fuente de verdad: `CLAUDE.md`**
> (doctrina visual + secciones "Nitidez" y "Acabado") y los tokens de `src/index.css`;
> si esto diverge, ganan ellos. Actualizado ago 2026.

## 1. Overview

**Creative North Star: "La mesa de trabajo despejada"**

Apúntate Fácil recibe el caos de decenas de respuestas sueltas en un chat y las deja en una superficie ordenada donde cada cosa está en su sitio. La interfaz es la mesa de trabajo despejada: sobria, precisa, sin adornos, con bajo coste cognitivo. El registro es el de "SaaS confiable" tipo Linear: familiaridad ganada, no sorpresa. La emoción objetivo es **control y calma sobre el caos**.

La densidad es la de una herramienta de trabajo, y la jerarquía se construye con **peso y color antes que con tamaño**. El color es contenido: un único acento para lo accionable y una escala neutra grafito para todo lo demás. Multisector neutro: una obra, un almacén y una ETT usan la misma app, así que la estética **nunca** se inclina a un gremio.

Lo que produce la sensación de caro no es ninguna decisión grande: es **coherencia física** repetida en veinte sitios (el mismo filo, la misma sombra por elevación, el mismo press, las mismas tres duraciones), y **nitidez** (lo que se pulsa va en tinta; el gris de apoyo es para lo que acompaña).

**Key Characteristics:**
- Un solo acento (ultramarine `#3B4FE4`) y neutros grafito; color = significado, nunca decoración.
- Jerarquía por peso y color antes que por tamaño; una sola familia (Geist), cifras tabulares.
- Plano por defecto: el hairline hace la profundidad y la sombra solo la confirma. El botón es plano desde ago 2026.
- Estado de candidato = punto de color **+** texto, con paleta propia que nunca usa el acento.
- Accesibilidad como suelo: AA en texto con significado, foco visible, alternativa de teclado a todo arrastre.

## 2. Colors

### Primary
- **Ultramarine** (`#3B4FE4`, reasignado sobre la rampa `indigo` en `@theme`): SOLO acción, foco y selección. **Desde el reskin de ago 2026 ya no marca ni el nav activo**: la fila activa del lateral se dice con un gris propio y tinta, así el acento solo aparece donde hay algo que pulsar. Rampa: hover `#2D3FB0` (700), press `#263690` (800), lavado `#EEF2FE` (50). **Dos gemelos que se mantienen a mano**: `--color-indigo-600`/`--accent` en `index.css` y `ACENTO_MARCA` en `lib/colors.ts`.

### Neutral (grafito, rampa `slate` reasignada, OKLCH)
- **Tinta** `#131822` (900) / **secundaria** `#50545E` (600) / **terciaria** `#6F727C` (500). Texto con significado siempre ≥ 4.5:1; `slate-400` NO vale para texto con significado, solo iconos. **Lo que se pulsa va en tinta**: una fila de menú o una cabecera de tabla es un destino, no un pie de foto.
- **Superficie** `#FFFFFF`, **fondo de app** `#F9FAFB`, **borde** `#E5E7EB`. El lateral es BLANCO y el trabajo un paso por debajo: el sitio con más texto pequeño por centímetro se lleva el fondo más claro.

### Estados de candidato (paleta propia y fija, nunca el acento)
- Nuevo = slate, contactado = azul, entrevista = ámbar, contratado = verde, descartado = slate apagado (**nunca rojo**: descartar es rutina y reversible). Punto de color **+** texto, jamás solo color. Mapa en `STATUS_META` (`lib/types.ts`). La pastilla es un **relleno teñido sin anillo** (tono-100 + texto tono-800) desde ago 2026.

### Los demás colores con significado
- **Rojo `#DC2626`, UN solo uso**: errores reales y acciones destructivas (borde + icono, nunca solo color). El punto de novedad del menú se probó en rojo y se revirtió: en cuanto el rojo también dice "hay algo sin mirar", deja de avisar de lo que puede salir mal.
- **Favorito = estrella DORADA** (`amber-400` relleno, `amber-500` contorno, `FAVORITO_STAR`): la única excepción a "estado y marca no comparten paleta". No choca con el ámbar de "entrevista" porque el estado jamás usa este glifo: se distinguen por forma.
- **Etiquetas de candidato con color por ID** (`tagTone`/`repartirTonos`): rectángulo de 4px, relleno tono-100 + texto tono-800, sin borde. La FORMA (rectángulo contra píldora) es lo que las separa de un estado. Fuera de su paleta: rojo, rosa y el ultramarine.

## 3. Typography

**Una sola familia: Geist Variable** (autoalojada), para todo: wordmark, titulares, cuerpo, etiquetas y datos. Sin monospace para datos (se probó Geist Mono y se descartó): las cifras van con `tabular-nums` (clase `.num`, y `tnum` global en el body).

### Hierarchy
- **Título de pantalla** (700, 24px, tracking `-0.012em`): `PageHeader`, la misma cabecera en todas las pantallas. Un número de dentro no puede ganarle al nombre de la pantalla.
- **Title** (600, 16px): títulos de sección y de tarjeta.
- **Body** (400, 14px): el texto de UI por defecto.
- **Label** (500, 13px): etiquetas, chips, controles. Verbo-primero, sentence case.
- **Overline** (600, 11px, tracking +0.05em, mayúsculas): solo rótulos de CATEGORÍA. **Un nombre propio se escribe, no se grita**: el nombre de la empresa en el lateral va en caja normal a 13px.
- Las superficies de LECTURA (la página pública del anuncio, la pantalla de acceso) suben la escala entera a propósito: ahí no trabaja nadie, lee una persona con prisa.

### Named Rules
- **Peso antes que tamaño**: la jerarquía sube por peso (400→500→600) y tinta (terciaria→secundaria→tinta), no agrandando.
- **El peso se declara UNA vez y ningún estado lo toca**: una etiqueta que engorda al activarse se lee como un temblor (pestañas, lateral, cabeceras de tabla).
- `font-synthesis-weight: none`: antes que una negrita falsa, que se note que falta.

## 4. Elevation

> Los valores viven en el `@theme` de `src/index.css` y la doctrina en la sección **"Acabado"** de `CLAUDE.md`, vigilada por `src/lib/acabado.test.ts`. Si divergen, gana el CSS.

Plano por defecto: **el hairline hace la profundidad y la sombra solo la confirma**. El marco de una superficie se pinta a dos manos (`filo` = border + outline a −1px, que corrige la esquina) y la superficie con radio recorta con `overflow-clip` (ni `visible` ni `hidden`).

**Seis piezas con nombre, nunca apiladas**: `shadow-control` (control en reposo), `shadow-raised` (solo el pomo del `Switch`), `shadow-card` (tarjeta apoyada), `shadow-pop` (lo que de verdad flota: dropdowns, paneles, modales, la barra de selección), `shadow-sticky` (cabecera pegajosa) y `shadow-acceso` (la lámina de la pantalla de acceso). `--shadow-pressed` se retiró con el botón plano. Prohibidas las de Tailwind (`shadow-sm/md/lg/xl`). Ninguna en negro puro: teñidas con la tinta `#131822`.

**Sin gradientes**, con tres excepciones declaradas que no pintan, informan: el barrido del skeleton, el desvanecido de un scroll que continúa (`lib/desvanecido.ts`) y el velo de legibilidad sobre una foto.

## 5. Components

Familiar y de confianza: vocabulario estándar, cero affordances inventadas. Iconos lucide a trazo 1,75 (`--stroke-icon` gobierna los ~420 desde `index.css`; la prop `strokeWidth` ya no pinta). `size-4` por defecto, `size-3.5` en metadatos.

### Buttons (`src/lib/buttons.ts`, única fuente)
- **PLANO Y NÍTIDO** (ago 2026): ni filo de luz, ni anillo interior en el sólido, ni sombra de contacto. El color hace el trabajo y al pulsar **oscurece** (600→700→800 el sólido; blanco→50→100 el de línea). Press = `translate-y-px`, **nunca `scale`**.
- Radio 8px, alto 36px (44 en táctil), un solo relleno por talla (14px en `md`). El anillo del secundario va **SIEMPRE `ring-inset`** (un `ring` a secas pinta fuera y desalinea 2px, y `getBoundingClientRect` no lo ve).
- Un botón de solo icono se fabrica con `botonIcono()`, **nunca** `BTN_* + px-0` (dos utilidades del mismo eje no se resuelven por orden de escritura).

### Data grid (`ui/DataTable.tsx`, compartida por el panel y Candidatos)
- Rejilla con **filo vertical entre columnas** (interior `slate-100`, marco `slate-200`), cabeceras en frase con el icono de su tipo (semibold, `slate-700`; la que ordena, tinta), filas de 56px, `border-separate`.
- **Anchos de columna del usuario** (arrastrar el filo de la cabecera; mínimo y máximo por contenido), **casilla y candidato fijos** al desplazar, y **solo se pintan las filas a la vista** (`useFilasALaVista`; el alto de fila es un contrato vigilado por `tabla.test.ts`).
- La fila entera abre la ficha (`clickDeFila`); dentro de una fila solo controles imprescindibles.

### Inputs
- 40px de alto, radio 10px, borde `slate-300`; foco borde `indigo-500` + `ring-4 indigo-500/15`. En el formulario público: 48px y fuente 16px (evita el zoom de iOS). Validación al blur y al enviar, jamás al teclear; nunca borrar lo que el candidato escribió.

### Navigation (el lateral, única capa de navegación)
- **256px, blanco, sin sombra** (el filo basta); contraíble a **64px** con asomarse al pasar por encima (el `<aside>` es un hueco y el raíl va absoluto encima: asomarse no reajusta nada). Preferencia en `localStorage`.
- Fila de 34px (44 táctil), icono 18, hueco 16, texto 15 en `slate-900`; activo = fondo `--color-lateral-activo` + tinta, **sin acento y sin engordar la letra**. Sublistas con raíl alineado al centro del icono de su madre. Contadores: la cifra pelada, `slate-500`, tope "15+".
- En móvil: barrita de 56px (marca izquierda, botón derecha) y el menú a pantalla completa con fundido, sin telón y sin gesto de deslizar.

### Signature: el FieldRenderer WYSIWYG
Un único componente pinta a la vez la preview del constructor y el formulario público real. Si tocas uno, tocas los dos. El acento del cliente pasa por guardas de contraste (`readableOn` para el texto encima, `accentOnWhite` para el acento sobre papel).

### Signature: la ficha del candidato
Pop-up con **tres pestañas** (Información · Conversación · Historial) y un **raíl** fijo a la derecha (Datos, Etiquetas, Notas del equipo): los hechos no se piden, están puestos. En móvil, franjas planas separadas por un filo y un solo grupo de pastillas como navegación. Las acciones viven encima de las pestañas: una sola acción principal por estado.

### Signature: la página pública del anuncio
El enlace abre lo que se LEE (el anuncio) y el formulario se abre al pulsar "Apúntate ahora" (`?apuntarse`, misma URL). Ahí la marca es DEL CLIENTE: su acento puede teñir superficies (ficha, filo, CTA), la letra sube de cuerpo y bajo el botón se dice lo que cuesta apuntarse ("9 preguntas · Sin CV · Sin crear cuenta"), que es un cálculo, no una promesa.

## 6. Do's and Don'ts

### Do:
- **Do** reservar el ultramarine a acción, foco y selección; para todo lo demás, grafito. El nav activo ya no lo lleva.
- **Do** comunicar estado con punto + texto (paleta fija) y clasificación con etiquetas rectangulares de color por ID: la forma carga con el significado.
- **Do** construir jerarquía con peso y tinta; una sola familia, cifras tabulares, el peso declarado una vez.
- **Do** mantener plano: `filo` a dos manos + `overflow-clip`, una sombra por elevación, botón que oscurece al pulsar.
- **Do** respetar el suelo: AA en texto con significado, `:focus-visible` siempre, alternativa de teclado a todo arrastre (la trae `ui/ListaOrdenable`), `prefers-reduced-motion`, 16px en campos táctiles.
- **Do** usar los tres tiempos (150/180/240) con su curva: `--ease-out` para lo que responde al dedo, `--ease-standard` para lo que transforma. Lo que flota se coloca contra la ventana, en portal.

### Don't:
- **Don't** usar el acento para estados, para decorar ni para el nav; **don't** pintar "descartado" en rojo ni con shake.
- **Don't** escribir sombras, radios o botones a mano en una pantalla: lo que se decide, se nombra (`buttons.ts`, `@theme`), y los guardianes (`acabado`, `arrastre`, `flotante`, `tabla`) lo hacen fallar.
- **Don't** caer en molde de plantilla, ganga (`.99`, urgencia), infantilismo ni sesgo de gremio; cero dark patterns: "¿funcionaría igual si el usuario supiera cómo está hecho?".
- **Don't** apilar dos utilidades del mismo eje esperando que gane la escrita después; **don't** componer nombres de clase de Tailwind con variables.
- **Don't** validar al teclear, borrar lo escrito por el candidato, ni ofrecer una acción que acabe en un mensaje que no sale (`WHATSAPP_LISTO`).

---
name: apuntate-copy
description: Writes and reviews Spanish product copy for Apúntate Fácil following brand voice, frozen glossary, honest positioning, and zero dark patterns. Use when drafting or editing headlines, subheads, CTAs, labels, onboarding, pricing copy, FAQs, emails, error messages, or when the user asks for copy alternatives, mejorar textos, microcopy, or tono de marca in this repo.
---

# Apúntate Fácil · Copy

Escribe copy que suene a **instrumento de confianza**, no a plantilla SaaS ni a ganga.

## Antes de escribir

1. Lee `PRODUCT.md` (usuarios, propósito, anti-referencias, principios).
2. Lee `.cursor/rules/copy.mdc` (glosario, ética, tono).
3. Lee el **bloque completo** que vas a tocar (eyebrow + h1 + subhead + CTA, no solo el titular).
4. Si es UI visible, cruza con `apuntate-design` para jerarquía y longitud en pantalla.

## Ancla de posicionamiento (no negociable)

El producto **ordena las respuestas que ya llegan**; **no capta candidatos nuevos**.

- Promesa honesta: el anuncio sigue en Milanuncios; tú envías un **enlace**; la **candidatura** entra ordenada en el **panel**.
- Emoción objetivo: **control y calma** sobre el caos del chat.
- Usuario: dueño, encargado o RR. HH. de empresa operativa; **no es de oficina**, poco tiempo, a menudo en móvil.
- Test único: *¿Funcionaría igual si el usuario supiera exactamente cómo está hecho?*

## Voz

| Sí | No |
| --- | --- |
| Directo, sobrio, profesional (Linear / Stripe) | Urgencia falsa, hype, jerga ATS |
| Tuteo consistente | Coloquialismo ("liarte", "montarlo", "colgar") |
| Honesto aunque reste | Prometer captación, "ideal", "mágico" |
| Frases cortas, verbos claros | Párrafos densos, adjetivos vacíos |
| Sentence case en headings y botones | Title Case, MAYÚSCULAS decorativas |
| Números redondos y citables (150 €) | `.99`, "desde", letra pequeña |

**Sin guion largo (—)** en nada visible. Usa comas, dos puntos o puntos.

## Glosario congelado

Usa **exactamente** estos términos:

| Usar | No usar |
| --- | --- |
| puesto | vacante, oferta, campaña |
| candidato | — |
| candidatura | envío (salvo aclaración puntual) |
| enlace | link |
| estado | — |
| exportar | — |
| formulario | — |

Estados: **nuevo**, **contactado**, **entrevista**, **descartado**, **contratado**.

Labels de acción: **verbo primero**, 1-3 palabras ("Exportar", "Ver detalle", "Copiar enlace").

## Cero dark patterns

- Sin testimonios, contadores, logos o "el más elegido" inventados.
- Chapa Pro: **"Recomendado"**, nunca "el más elegido".
- Sin confirmshaming ni preselecciones. Checkboxes de consentimiento **sin marcar** por defecto.
- Sin urgencia/escasez falsa.

## Workflow

### 1. Definir el trabajo del texto

| Superficie | El copy debe… |
| --- | --- |
| Landing hero | Nombrar dolor (chat disperso) o resultado (lista ordenada); no repetir el subhead |
| Landing sección | Una idea por bloque; el h2 vende beneficio, el párrafo explica mecanismo |
| CTA | Verbo + objeto claro; sin fricción oculta ("Pruébalo gratis", "Ver la demo") |
| Panel / app | Instrumento: qué pasa si pulso; sin marketing |
| Formulario público | Tranquilidad, claridad, móvil; validación al blur, nunca culpar al candidato |
| Pricing | Precio redondo, límites por **procesos activos**, candidatos/usuarios ilimitados |
| FAQ | Respuesta en la primera frase; sin evasivas |
| Errores | Qué pasó + qué puede hacer; rojo solo si es error real |

### 2. Elegir el eje del mensaje

Un titular = **un eje**. Mezclar varios debilita.

| Eje | Cuándo | Ejemplo de ángulo |
| --- | --- | --- |
| Dolor → resultado | Hero, Compare | "De decenas de chats a una lista ordenada" |
| Mecánica (enlace) | Hero, How it works | "Envía un enlace. Recibe candidaturas completas." |
| Control / calma | Features, panel | "Todas las respuestas, en un solo sitio" |
| Contraste antes/después | Compare, pricing anchor | Menos ida y vuelta, más selección con datos |
| Honestidad que resta | FAQ, footer, objeciones | "No te traemos gente nueva: ordenamos la que ya llega" |

### 3. Proponer alternativas (cuando el usuario pide opciones)

Entrega **6-10 opciones** agrupadas por eje (2-3 por grupo). Para cada grupo:

1. **2-3 recomendadas** arriba, con una línea de por qué encajan con eyebrow + subhead.
2. Resto como exploración.
3. Sección **"Evitaría"** con 2-3 anti-ejemplos y motivo (captación falsa, genérico SaaS, dark pattern).
4. Cierra pidiendo elección o ofreciendo implementar la favorita.

No implementes en código hasta que el usuario elija (salvo que pida copy + cambio en el mismo mensaje).

### 4. Revisar borrador

Checklist rápido:

```
- [ ] ¿Respeta el glosario (puesto, enlace, candidatura)?
- [ ] ¿Evita prometer captación de candidatos?
- [ ] ¿Sin guion largo, sin slang, sin jerga?
- [ ] ¿Sentence case en headings y botones?
- [ ] ¿Pasa el test de honestidad operativa?
- [ ] ¿El h1 no repite lo que ya dice el subhead?
- [ ] ¿Cabe en móvil sin truncar el sentido? (titulares ~8-12 palabras ideal)
```

### 5. Implementar

- Cambios visibles: verificar en navegador (misma rigor que diseño).
- `cd /Users/mario/criba && npm run build` y `npx tsc -b --noEmit` si tocaste TSX.

## Patrones que funcionan en este producto

**Hero (h1 + subhead):** el h1 = promesa o transformación; el subhead = mecanismo (chat → enlace → panel).

**Subhead tipo:** "Cada puesto recibe decenas de candidaturas que se dispersan en el chat. Apúntate Fácil las recoge en un solo panel: envías un enlace y seleccionas con toda la información delante."

**CTA secundario honesto:** "Ver la demo" (no "Descubre la magia").

**Objeción FAQ:** primera frase = sí/no directo; segunda = detalle operativo.

## Anti-referencias de copy

- Plantilla SaaS: "La forma más fácil de…", "Potencia tu…", "Revoluciona…"
- Ganga: "Gratis para siempre*", "Solo hoy", precios `.99`
- Captación falsa: "Encuentra al candidato perfecto", "Atrae talento"
- Micro-bro: "Toca el panel", "Te lo montamos", emojis decorativos en producto
- Sesgo gremio: cascos, obra, lenguaje solo construcción (es multisector)

## Recursos

- Doctrina completa: `CLAUDE.md` (sección Reglas de copy)
- Reglas Cursor: `.cursor/rules/copy.mdc`, `pricing.mdc`
- Estrategia: `PRODUCT.md`
- Ejemplos buenos/malos: [examples.md](examples.md)

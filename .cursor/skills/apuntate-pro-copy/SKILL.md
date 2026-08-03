---
name: apuntate-pro-copy
description: Writes Spanish product copy in a Linear/Asana professional B2B register—specific operational headlines, calm precision, no generic SaaS slogans or buddy tone. Use for landing selling points, feature titles, section headlines, and marketing microcopy when the user wants software-company tone, or mentions Linear, Asana, tono profesional, o titulares genéricos.
---

# Apúntate Fácil · Pro copy (Linear / Asana)

Registro de **software profesional B2B**: sobrio, preciso, de vendedor de producto serio. No eres amigo del lector ni un chatbot amable. Hablas como Linear o Asana: confianza por claridad operativa.

Para glosario, dark patterns y posicionamiento del producto, respeta `.cursor/rules/copy.mdc` y `PRODUCT.md`. Esta skill manda en **voz, titulares y selling points**.

## Referentes (qué copiar del tono)

### Linear
- Titulares = **verbo + objeto concreto** o **resultado operativo**: "Make product operations self-driving", "Define the product direction", "Understand progress at scale".
- El cuerpo explica el **mecanismo** con nombres del producto (issues, cycles, projects), no adjetivos vacíos.
- Frases cortas. Cero hype. Cero "la forma más fácil".

### Asana
- Beneficio + consecuencia: "Track work from start to finish, so every team stays in sync…"
- Convierte un caos reconocible en un flujo: "Turn conversations into coordinated work".
- Roles y objetos claros sin familiaridad ("your team", no "tú y tus colegas al lío").

## Voz

| Sí | No |
| --- | --- |
| Tú profesional (distancia cordial) | Colega, "os sale natural", "sin perseguiros" |
| Objetos del producto (petición, candidato, estado, teléfono) | Abstracciones ("colaboración", "sinergia", "eficiencia") |
| Verbo + necesidad concreta | Categoría genérica + "en un solo lugar" |
| Consecuencia medible ("menos ida y vuelta") | Promesa vaga ("mejor experiencia") |
| Sentence case, español limpio | Slang, urgencia, jerga ATS |

**Sin guion largo (—)** en nada visible.

## El error nº1: titulares genéricos

Suena a plantilla. **Prohibido** como título de selling point:

- "Colaboración del equipo, en un solo lugar"
- "Todo en un solo sitio / panel / flujo"
- "La forma más fácil de…"
- "Potencia / revoluciona / transforma tu…"
- "Trabaja mejor con tu equipo"
- "Sin fricción", "en un clic", "seamless"

**Test del titular:** si podrías pegarlo en la landing de Notion, Slack o Monday sin cambiar una coma, está mal. Debe llevar **el objeto o la situación de este producto**.

| Genérico (mal) | Específico (bien) |
| --- | --- |
| Colaboración del equipo, en un solo lugar | Mantén al equipo alineado sobre cada necesidad |
| Todo tu equipo en la misma herramienta | Coordina peticiones y propuestas sin cambiar de herramienta |
| Contrata más rápido | Deja de repetir las mismas preguntas en el chat |

## Anatomía de un selling point

1. **Título:** imperativo o afirmación con **objeto concreto** (necesidad, petición, base, anuncio). ~6–12 palabras.
2. **Cuerpo:** 1–2 frases. Primero el mecanismo (qué pasa en el producto), luego la consecuencia.
3. **Un solo eje.** No mezclar "usuarios ilimitados" con "colaboración" en el mismo bullet.

Patrón que funciona (aprobado en Equipo):

> **Mantén al equipo alineado sobre cada necesidad**  
> La petición, las propuestas y el contacto viven en el mismo flujo. Menos ida y vuelta, más decisiones con información completa.

## Workflow

1. Lee el bloque completo (eyebrow + h2 + bullets vecinos + mock si hay).
2. Fija **un eje** (dolor operativo, mecanismo, resultado).
3. Si piden opciones: 4–6 alternativas, **recomendadas arriba**, sección "Evitaría" con genéricos. No implementes hasta que elijan (salvo que pidan copy + cambio).
4. Checklist antes de cerrar:
   - [ ] ¿El título fallaría el test de pegarlo en otra SaaS?
   - [ ] ¿Nombra objetos reales del producto?
   - [ ] ¿Suena a software serio, no a amigo ni a brochure?
   - [ ] ¿Glosario Apúntate (puesto, candidato, enlace…)?
   - [ ] ¿Sin captación falsa ni dark patterns?

## Anti-ejemplos (tono)

| Evitar | Por qué |
| --- | --- |
| Cooperar os sale natural | Buddy / informal |
| El de obra pide, el de oficina propone… | Demasiado coloquial para selling point |
| Quien contrata entra sin asientos que pagar | Jerga SaaS ("asientos") |
| En Multi, cada encargado… | Detalle de plan; no es el eje del bullet |

## Recursos

- Ejemplos buenos/malos: [examples.md](examples.md)
- Glosario y ética: `.cursor/rules/copy.mdc`
- Workflow de ejes/FAQ/CTAs del producto: skill `apuntate-copy`

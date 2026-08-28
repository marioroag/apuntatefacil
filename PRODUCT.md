# Product

## Register

product

## Users

Empresas españolas que contratan perfiles blue-collar y operativos con cierto volumen, **desde una pequeña empresa de construcción hasta una ETT con varias sedes**. Los dos nichos principales son **construcción y logística**; alrededor, limpieza, reformas, almacén, comercio y cuidados. Quien usa la app es el que contrata: dueño, encargado o responsable de personal, normalmente alguien que **no es de oficina**, con poco tiempo y a menudo en el móvil.

No es para el micro-negocio de una persona. Un bar pequeño rara vez contrata lo suficiente (ni puede permitirse un plan premium) para que la herramienta le compense; el cliente que encaja tiene **vacantes recurrentes** y pierde dinero cuando se le escapan buenos candidatos.

Su contexto: ya publican su anuncio en Milanuncios y reciben decenas de respuestas (referencia de sector ~56 por vacante) que se pierden en el chat. Contestan lo mismo treinta veces, copian teléfonos a mano y, cuando llaman al bueno, ya está pillado.

El trabajo que quieren resolver: **recibir todas las respuestas ordenadas en un sitio, filtrarlas (carnet, zona, experiencia), marcar estados y exportar a Excel, sin perder a nadie**. Roles de equipo: propietario (owner), miembro y encargado (acotado por sede, solo ve y exporta lo suyo).

## Product Purpose

Apúntate Fácil ordena la contratación que hoy se hace por chat. La empresa sigue poniendo su anuncio como siempre, pero a quien responde le manda **un enlace** en vez de chatear: el enlace abre la **página del puesto** (dónde es, cuánto paga, qué contrato: lo que se mira antes de decidir) y, al pulsar "Apúntate ahora", un **formulario corto** (las preguntas las elige el cliente). Cada envío entra como **candidato ordenado** en una base que se filtra, se etiqueta, se marca favorito, se anota en equipo y se exporta a Excel; Meridian (IA) lo trilla contra un baremo del puesto.

Decisión de posicionamiento central: el producto **no capta candidatos** (eso lo sigue haciendo el anuncio del cliente); **ordena los que ya llegan**. La promesa es honesta incluso cuando resta: "no te traemos gente nueva".

El éxito se ve cuando el cliente llega al buen candidato antes de que lo pillen, no pierde ni una respuesta, monta su puesto en minutos y confía en el precio (redondo, sin permanencia, "lo que ves es lo que pagas"). Modelo (ago 2026, sustituye a los tiers): **pago por proceso abierto, 49 €/mes + IVA por proceso, todo el producto incluido**; se cobra por escala real, nunca por candidatos ni por usuario. Puerta de entrada: el primer proceso gratis 15 días o 25 candidaturas, sin tarjeta. Cerrar un proceso es un clic y deja de cobrarse; los candidatos siguen siendo del cliente.

## Brand Personality

Sobria, profesional y de confianza: el registro "SaaS confiable" de Linear / Notion / Stripe, serena y competente. La voz es **directa, honesta y sin jerga**, en español con tuteo consistente, para alguien que no es de oficina. Copy honesto incluso cuando resta, y precios redondos y citables (el `.99` grita ganga).

Emoción objetivo: **control y calma sobre el caos**. El usuario llega agobiado por decenas de respuestas sueltas; la interfaz debe transmitir "lo tengo todo, no se me escapa nadie", con bajo coste cognitivo y el siguiente paso siempre claro.

## Anti-references

- **SaaS genérico de plantilla.** Rejillas de cards idénticas, eyebrow tracked en cada sección, plantilla hero-métrica, degradados y brillos de IA. El molde reconocible "esto lo hizo una plantilla".
- **Cutre o de ganga.** Precios `.99`, urgencia y contadores inventados, gradientes chillones, todo lo que grite "barato". Choca de frente con el posicionamiento premium y honesto.
- **Infantil o de juguete.** Mascotas, ilustraciones blandas, emojis decorativos, colores de caramelo. Resta seriedad a una herramienta de trabajo.
- **Sesgo de gremio.** Nada que huela a un solo sector: cero cascos de obra, naranjas de construcción, iconografía de oficio. Es multisector; la estética nunca debe inclinarse a un nicho.
- **Dark patterns de cualquier tipo.** Prueba social inventada (testimonios, contadores de usuarios, logos), confirmshaming, preselecciones, costes ocultos, fricción de salida. Es el posicionamiento, no solo una preferencia.

## Design Principles

1. **Honestidad operativa.** Todo funcionaría igual si el usuario supiera exactamente cómo está hecho. Es el diferenciador y el filtro de cada decisión: cero dark patterns, copy honesto aunque reste, precios transparentes. La interfaz practica lo que la marca predica.
2. **El orden lo pone el sistema, no la persona.** El valor es convertir el caos del chat en una lista accionable. Cada pantalla deja obvio el siguiente paso (revisar, filtrar, contactar, exportar) y baja el coste cognitivo; el usuario no tiene que decidir cómo organizarse.
3. **Multisector neutro.** Un bar, una obra y una ETT usan la misma app. La marca es la confianza, no el sector: la estética nunca se sesga a un gremio, y la personalización (acento, marcas) la pone el cliente, no nosotros.
4. **Premium por confianza, no por ruido.** "Premium" se gana siendo sobrio, claro y honesto, no caro ni llamativo. Números redondos, sin permanencia, una sola sombra, un solo acento: la calidad se nota en la contención y el detalle, no en efectos.
5. **WYSIWYG real: la demo es el producto.** Un único renderizador pinta a la vez la preview del constructor y el formulario público; la demo usa el mismo código que verá el cliente final. Nunca una versión "bonita" distinta de lo que se entrega.

## Accessibility & Inclusion

- **Objetivo WCAG AA.** Texto con significado siempre ≥ 4.5:1 (grande ≥ 3:1), incluido el placeholder; nada de gris claro "por elegancia". El acento configurable del cliente lleva guarda de contraste automática: si el blanco no llega a AA sobre su color, el texto pasa a tinta oscura.
- **Foco y semántica.** `:focus-visible` siempre visible (nunca quitar el outline), `<button>`/`<a>` reales, `<table>` semántica con `aria-sort`. El drag-to-reorder del constructor lleva siempre alternativa de teclado (subir/bajar).
- **Movimiento.** `prefers-reduced-motion` respetado; animación corta y sobria (150/180/240 ms), solo transform/opacity, sin springs ni rebotes.
- **Formulario público mobile-first.** Una columna, inputs de 48px y fuente 16px (evita el zoom de iOS), targets ≥ 44px, teclados correctos (`type=tel/email/number`, `inputmode`), validación al blur y al enviar (nunca al teclear) y nunca borrar lo que el candidato escribió, ni su CV, en un envío fallido.
- **Español primero.** Idioma, €, tuteo consistente. El glosario de producto está congelado (puesto, candidato, candidatura, enlace, estado, exportar) para no confundir.

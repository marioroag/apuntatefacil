# Prompt: nueva sección "Equipo" en la landing

Diseña y construye una nueva sección de la landing (`src/screens/Landing.tsx`) dedicada a la feature **Equipo**. Antes de escribir código, ejecuta las skills `apuntate-design` y `apuntate-copy` y lee PRODUCT.md. Al final, ejecuta `verify-before-close`.

## Qué es la feature (descríbela bien, no la inventes)

Equipo NO es un organigrama ni una lista de empleados. Es la capa de **colaboración** del panel (`/app/equipo`, disponible desde Pro), con dos piezas:

1. **Tablón de peticiones.** Cualquiera del equipo publica lo que necesita cubrir en lenguaje natural ("3 electricistas oficiales para una reforma en Paterna", "2 carretilleros con carnet para el turno de noche"). Cada petición tiene estado Abierta/Completada, sede opcional y un hilo de actividad. Los compañeros responden con mensajes y, sobre todo, **proponen candidatos que ya existen en vuestra base**: la propuesta aparece como fila con nombre, estado del candidato, puesto y contacto directo (teléfono y WhatsApp). Cuando se cubre, se marca Completada. Hay un badge en el menú con la actividad nueva.
2. **Miembros.** El propietario invita por email, sin límite y sin coste por usuario. En Multi, rol Encargado: solo ve los candidatos de sus sedes.

El flujo real del usuario: el jefe de obra o el encargado pide, la persona de oficina que gestiona los anuncios rebusca en la base y propone, el que pidió llama o escribe por WhatsApp al candidato desde la misma petición. Referencias de código si necesitas ver el producto real: `src/screens/EquipoTablon.tsx`, `src/screens/TeamRequestPanel.tsx`, `src/screens/EquipoMiembros.tsx`, seed demo en `src/lib/seed.ts` (SEED_TEAM_REQUESTS).

## Puntos de venta, en orden de fuerza

1. **Sustituye al grupo de WhatsApp de "¿alguien tiene un carretillero?"**. La misma conversación informal, pero con la base de candidatos enchufada: cada propuesta es un perfil real con estado y teléfono, no un "creo que Juan tenía a uno". Este es el ángulo central de la sección: un problema que el lector reconoce al instante.
2. **Tu base de candidatos se revaloriza.** Los perfiles de procesos anteriores dejan de morir en un Excel: el equipo los rescata para cubrir la siguiente necesidad sin publicar otro anuncio.
3. **Usuarios ilimitados, de verdad.** Invita a toda la oficina y a todos los encargados sin coste por asiento. Es un diferenciador frente a herramientas que cobran por usuario y conecta con la doctrina de pricing (nunca limitar por usuario).
4. **Cada encargado, sus sedes** (Multi): el de Madrid solo ve lo de Madrid. Menciónalo como detalle, no como protagonista.

No prometas nada que la feature no hace (no hay asignación de tareas, ni turnos, ni chat general).

## Cómo mostrarla

- **Visual protagonista: un mini-mockup estático del tablón**, al estilo de los mocks inline que ya usa la landing (tarjeta de candidato en `Compare`, `FEATURE_MINI`). Propuesta: una tarjeta de petición realista con título tipo "2 carretilleros con carnet para el turno de noche", chip "Abierta", y debajo el hilo condensado: un mensaje de respuesta con 2 candidatos propuestos (avatar de iniciales, nombre, punto de estado + label, icono de teléfono/WhatsApp). Datos ficticios coherentes con la demo (Laura, Sergio). Esto es representación del producto, no prueba social: no lo disfraces de testimonio ni de actividad en vivo.
- Al lado, headline + 3 bullets cortos con los puntos de venta 1-3. Un solo CTA secundario hacia la demo (`/demo/equipo` lleva directo al tablón con datos).
- **Colocación: entre `<Features />` y `<Pricing />`** en `Landing()`. Pricing ya dice "Equipo desde Pro"; esta sección prepara ese gancho. Cuida el ritmo de bandas: Features es blanca y Pricing es `slate-50`, decide el fondo para no juntar dos bandas iguales.
- Reusa el patrón de sección existente: `max-w-6xl` + `section-x`/`section-y`, `Reveal` (animación CSS en montaje, nunca IntersectionObserver), tarjetas `rounded-2xl border-slate-200 shadow-card`, iconos lucide en cuadros `bg-slate-100`.
- Etiqueta "Desde el plan Pro" visible pero discreta (texto, no badge ultramarine).

## Reglas que no se negocian (resumen, CLAUDE.md manda)

- Acento ultramarine solo para acción/enlaces, nunca decorativo ni para estado. Estados con su paleta propia de `STATUS_META` (punto + texto).
- Copy: tuteo, sentence case, sin guion largo, glosario congelado (puesto, candidato, enlace). Cero dark patterns: nada de contadores, actividad falsa "en vivo" ni urgencia.
- Una sola sombra por elevación, sin gradientes, movimiento sobrio (120/180/240ms, solo transform/opacity), `tabular-nums` en números y fechas.
- Accesibilidad: el mockup decorativo con `aria-hidden`, foco visible en el CTA, contraste AA en todo texto con significado.

## Entrega y verificación

1. Propón el copy (headline, subtítulo, bullets, CTA) con 2-3 alternativas de headline antes de fijarlo, usando `apuntate-copy`.
2. Implementa la sección y añádela a `Landing()`.
3. Verifica en navegador: captura la sección en desktop y móvil (para capturar abajo: ocultar secciones superiores con `display:none` + `scrollTo(0,0)`), revisa jerarquía, ritmo de bandas y el mockup en 375px. Rehaz lo que no esté a la altura del resto de la landing.
4. `npm run build` y `npx tsc --noEmit` en verde.

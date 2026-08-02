# Apúntate Fácil — App de contratación vía Milanuncios

> Este fichero se autocarga en cada sesión. Es la fuente de verdad de la **doctrina
> de diseño, las reglas y el estándar de rigor** del proyecto. Si una sesión futura
> propone algo que contradice esto, gana este documento (salvo que Mario lo cambie a propósito).

## Qué es
Web app (prototipo de frontend) para automatizar la contratación a través de Milanuncios y similares. **Multisector**: hostelería, construcción, logística, limpieza, comercio, ETTs. La empresa pone su anuncio como siempre; a quien responde le manda **un enlace** en vez de chatear; el enlace abre un **formulario personalizable**; cada envío entra en su **base de datos** de candidatos, que puede **filtrar** y **exportar a Excel**.

- Fundador: Mario, España. Tiene un **listón de diseño muy alto** y nota cualquier bajón de calidad.
- La marca es **Apúntate Fácil** (dominio apuntatefacil.com), nombre definitivo. Se define en un único sitio: `src/lib/brand.ts`.
- Proyecto **independiente** de plain-points (otra app suya). No mezclar nunca: vive en su propio repo `/Users/mario/criba`.

## Cómo arrancar y VERIFICAR
```bash
npm install
supabase start   # stack local: Postgres + Auth + Storage + Studio (necesita Docker)
cp .env.example .env.local   # claves locales de Supabase (anon key + URL)
npm run dev      # http://localhost:5173
npm run build    # debe quedar verde
npx tsc -b --noEmit # sin errores de tipos (OJO: `tsc --noEmit` a secas NO comprueba nada,
                    # el tsconfig raíz usa project references y no tiene ficheros propios)
```
- Login local: email + contraseña (con confirmación de email obligatoria) y Google. Los emails de acceso (confirmación, reset) llegan a Mailpit (http://127.0.0.1:54324). Google OAuth necesita credenciales reales (pendiente).
- Migraciones en `supabase/migrations/`. Tras tocar el esquema: `supabase db reset`. Tras tocar `config.toml`: `supabase stop && supabase start`.
- **Verificar siempre en navegador** cualquier cambio observable: capturar, mirarlo, probar interacciones (clicks, toggles, estados) y **rehacer si no cumple**. No dar nada por bueno sin verlo.
- Gotcha del preview embebido de Claude: `IntersectionObserver` no dispara callbacks (rompe `whileInView` de framer-motion). Para reveals usar **animación CSS en montaje**, no IO. Para capturar una sección de abajo, ocultar temporalmente las de arriba (`display:none`) + `scrollTo(0,0)`.

## Alcance (4 superficies). NO añadir features fuera de esto sin hablarlo
| Ruta | Qué es |
| --- | --- |
| `/` | Landing de marketing |
| `/app/puestos/:id` | Panel: base de datos de candidatos (filtros, estados, detalle, export a Excel) |
| `/app/puestos/:id/formulario` | Constructor del formulario (drag & drop) + preview en vivo |
| `/a/:slug` | Formulario público que rellena el candidato (mobile-first) |

Datos demo: una ETT con 6 puestos (construcción + logística), ~680 candidatos (80–160 por puesto) y tablón de Equipo en `localStorage` (clave `apuntatefacil.demo.v8`). Las fechas se anclan a la visita para que no envejezcan. Los emails de la demo nunca pueden ser de una persona real: el equipo usa `@apuntatefacil.com` y los candidatos, los dominios reservados por la RFC 2606 (`example.com/.org/.net`). Reinicio: borrar la clave o `resetDemo()`.

## Doctrina visual "Instrumento de precisión" (NO cambiar sin debate)
Sobria, nítida y premium, carácter Linear (registro "SaaS confiable"). **Multisector**: nunca debe oler a construcción (cero cascos, naranjas de obra, mascotas). La identidad vieja (índigo `#4F46E5` + Inter/Manrope + slate) está **retirada**: Mario aprobó el remake total (jun 2026). Tokens en `src/index.css`; botones en `src/lib/buttons.ts`.

- **Acento ULTRAMARINE `#374cce` SOLO para acción, nav activo, foco y selección. NUNCA para estado ni decorativo.** Es el error nº1. El uso decorativo del acento (eyebrows, iconos de feature, círculos de paso, checks) se neutraliza a slate/tinta; el acento se reserva a CTAs/enlaces + el plan "Recomendado". (Reasignado sobre la rampa `indigo` de Tailwind en `@theme`, así cada `bg-indigo-*`/`text-indigo-*` pinta el ultramarine.)
- **5 estados de candidato, paleta propia y fija** (nunca el acento de marca): nuevo = slate, contactado = azul, entrevista = ámbar, contratado = verde, descartado = slate apagado (**nunca rojo**: descartar es rutina y es reversible). Estado = punto de color **+** texto, nunca solo color. Mapa en `src/lib/types.ts` (`STATUS_META`).
- **Neutros GRAFITO** (rampa `slate` reasignada en `@theme`, OKLCH, AA verificado): fondo app `#f9fafb`, superficies `#FFFFFF`, borde `#e5e7eb`, texto `#131822` / secundario `#50545e` / terciario `#6f727c`. Texto con significado siempre ≥ 4.5:1 (`slate-400` NO vale para texto con significado, solo iconos).
- **Rojo `#DC2626` solo** para errores reales y acciones destructivas (borde + icono, nunca solo color; `BTN_DANGER`).
- **Tipografía**: una sola familia, **Geist** (variable, autoalojada). Jerarquía por peso/color antes que por tamaño. `tabular-nums` global (clase `.num`) en cualquier número/fecha/teléfono. **Sin monospace para datos** (se probó Geist Mono y Mario lo descartó).
- **Radios por rol** (consistencia absoluta): inputs/campos/tarjetas/paneles/modales **10px** (`rounded-xl`); botones y controles pequeños **8px** (`rounded-lg`); pills/chips/avatares 999px. Las superficies externas (landing, formulario público) pueden usar 16px en sus tarjetas grandes.
- **Botón "instrumento"**: relieve nítido (filo de luz interior + anillo 1px + sombra mínima), press = `translate-y-px` (nunca `scale`). Constantes `BTN_PRIMARY/SECONDARY/DANGER/_LG/_SM` en `lib/buttons.ts`. **El anillo va SIEMPRE `ring-inset`** (ago 2026): `ring-1` a secas es un box-shadow que se pinta FUERA de la caja, así que un control de 36px se ve de 38 y desalinea 2px contra cualquier vecino que pinte dentro. El primario ya era inset y el secundario no, y por eso toda pareja Compartir/Editar y el buscador del panel iban descuadrados. Con inset, el rectángulo pintado es igual a la caja de layout, como el `border` de los inputs. **Ojo al verificarlo: `getBoundingClientRect()` NO ve esta diferencia** (el ring no ocupa layout); hay que sumar el spread del `box-shadow` computado. **Logo** = SVG inline (baldosa ultramarine + "A") en `src/components/Logo.tsx`, no PNG.
- **Una sola sombra por elevación**: `shadow-card` para tarjetas; `shadow-pop` solo para overlays reales (dropdowns, paneles, modales). Nunca apilar sombras. **Sin gradientes** (salvo el barrido del skeleton).
- **Un único `FieldRenderer`** (`src/components/FieldRenderer.tsx`) pinta **a la vez** la preview del builder y el formulario público: WYSIWYG real. Si tocas uno, tocas los dos. No hacer una versión "bonita" distinta del producto.
- **Formulario público mobile-first**: una columna, max 480px, inputs 48px alto y **16px de fuente** (evita zoom iOS), targets ≥ 44px. Validación **al blur y al enviar, nunca al teclear**. **Nunca borrar lo que el candidato escribió** (ni el CV) en un envío fallido. Teclados correctos (`type=tel/email/number`, `inputmode`).
- **Acento configurable del cliente** con **guarda de contraste AA** (`src/lib/colors.ts`): si el blanco no llega a 4.5:1 sobre su color, el texto del botón pasa a tinta oscura automáticamente.
- **Detalle del candidato** = **pop-up con pestañas** (`src/screens/CandidateModal.tsx`, jul 2026). Sustituyó al SlideOver de 460 px: el panel lateral protegía que la lista siguiera a la vista, pero eso lo da igual el telón translúcido, y a cambio obligaba a apilar en una columna estrecha todo lo que hay que saber de una persona. Reparto fijo: izquierda lo que dice el candidato (Resumen / Respuestas / CV), derecha lo que dice tu equipo (Equipo / Historial); por debajo de 1024px la conversación entra como una pestaña más. Trae lo que faltaba: **flechas para pasar al siguiente candidato** de la lista filtrada y **enlace directo** (`?candidato=<id>`). El SlideOver sigue siendo lo correcto para detalles secundarios (peticiones del tablón).
- **Sede y marca son atributos del puesto, NO destinos** (ago 2026). Se borraron las pantallas `/app/sedes` y `/app/marcas` y sus dos entradas del menú: a esos sitios solo se entraba a configurar algo que se usa en otro lado. Ahora la **sede** se elige y se crea en los ajustes del puesto (`SedeSetting`), y se renombra o borra **solo** en el bloque "Por sede" de **Vista general**, que ya la lista con sus cifras (nuevos, sin contactar +7 días, contratados). El menú lateral no administra nada: la sede es ahí un separador plegable sin un solo botón, y **solo agrupa si separa algo** (con todos los puestos en la misma sede, lista plana). Sin ninguna sede creada, los ajustes del puesto no enseñan un selector vacío sino una línea, "Agrupar por sede": quien no la necesita no ve el concepto. La **marca** es la cara del formulario y se edita en el bloque **Identidad** del constructor (`Identidad` en `Builder.tsx`), que absorbió el editor duplicado de Marcas: nombre, foto y banner, en vivo y compartidos por sus puestos; el color y los textos siguen siendo del puesto (`campaign.branding`). Con una sola marca no hay selector ni la palabra "marca": es la identidad de la casa y se asigna sola a cada puesto. No volver a crear tabs para esto.
- **Barra superior = capa de servicio** (`src/components/TopBar.tsx`, ago 2026, referencia declarada: el dashboard de Stripe). Altura 56px y tres zonas: a la izquierda **dónde estás** (la empresa), en el centro **cómo llegar a alguien** (el buscador), a la derecha **lo que reclama tu atención** (ayuda, avisos, primeros pasos). Debajo, el trabajo.
  - La esquina izquierda es la **empresa**, no el logo de Apúntate Fácil (dentro de tu casa no hace falta la valla) y **no tu cara**: se construyó al revés, "tú fuera, empresa dentro", y Mario lo invirtió tomando Stripe de referencia. Tú vives **al fondo de ese mismo menú**, con tu avatar, tu nombre y cerrar sesión. La celda mide `w-60` y su filo continúa el borde del menú lateral: es una celda, no un elemento flotando.
  - El **menú** abre con cabecera **centrada** (baldosa grande, nombre de la empresa, su plan), luego lo de la empresa (plan y facturación, cambio de equipo si hay varias) y al final la persona. Todas las filas comparten un hueco izquierdo de 26px (`Slot`) para que iconos de 16px y avatares de 26px alineen su texto.
  - **NI UN PIXEL DE ULTRAMARINE en la barra, salvo el foco**: no contiene ninguna acción primaria (esa es "Nuevo puesto", en el lateral, y ahí sí va el acento). El contador de avisos y el anillo de progreso van en **tinta**.
  - **NO reparte la app en secciones**: se construyó un par de pestañas Inicio/Panel (Vista general arriba, el resto abajo) y Mario lo descartó, porque Vista general es una pantalla más del Panel y sacarla partía en dos algo que se recorre seguido. Volvió al lateral como primera entrada, y el ítem de admin volvió a llamarse "Panel". No rehacer las pestañas sin una segunda mitad de verdad que las justifique.
  - **Ayuda y Primeros pasos ascienden a la barra a partir de `sm`; por debajo son filas del menú.** Cada cosa existe una sola vez en cada ancho, nunca las dos. Ojo al navegar con flechas: `display:none` NO saca las filas de `querySelectorAll`, hay que filtrarlas (`visibles()`).
  - Se vació el pie del menú lateral y desapareció `CompanySwitcher`: el lateral navega y nada más. La marca sigue en la landing, el login y el formulario público, que es donde hay algo que presentar.
- **Buscador global** (`src/components/GlobalSearch.tsx`): personas y puestos de todos los puestos a la vez, que es lo único que no se podía hacer en ninguna pantalla. **Sin red**: el store ya tiene los candidatos en memoria y se puntúa con `searchScore` de `lib/search.ts`, la misma función que usa el panel (tolera acentos, erratas y teléfono por dígitos). Campo en el centro desde `md`, capa a pantalla completa por debajo, `⌘K` solo donde el campo existe.
- **Avisos** (`src/components/Avisos.tsx` + `src/lib/avisos.ts`): timbre con contador. Todo **derivado**, sin tabla de notificaciones: menciones `@` en el chat de un candidato (índice GIN en `candidate_comments.mentions`) y movimiento del tablón. "Visto" en localStorage por empresa, como `seen` y `boardSeen`. **Los candidatos nuevos NO son un aviso**: ya los cuenta la Bandeja, y 272 avisos no avisan de nada. Si el plan no tiene equipo, nada puede generar un aviso y el timbre no se pinta. Añadir una fuente (las entrevistas de la rama de agenda son la siguiente) es empujar al array del `useMemo`; el panel, el contador y el visto ya funcionan por fecha.
- **Ajustes: un registro, no pantallas** (`/app/ajustes`, `src/lib/settings.tsx` + `src/screens/Ajustes.tsx`, ago 2026). Se entra por el engranaje de la barra, pegado al timbre. La pantalla lleva su propio menú (columna a partir de `lg`, fila de pestañas por debajo) y **no conoce ningún ajuste**: pinta lo que declare el registro. **Añadir un ajuste es una entrada en `settings.tsx`, nunca UI nueva**; añadir una sección, un objeto más en `SECCIONES`. Cada ajuste trae su `get`, su `set` y, si procede, su `bloqueado` (que devuelve el MOTIVO, y ese motivo sustituye a la explicación en la fila).
  - Tres reglas que impiden que esto se pudra: **nada que no gobierne algo de verdad** (antes de declarar un interruptor, que exista quien lo lea); **lo que no está disponible no se pinta** (`disponible` en sección y grupo: ni menú ni URL, no se enseña bloqueado); y **lo que no se puede cambiar se dice** (`nota`, por ejemplo que los correos de acceso no se desactivan).
  - **Dos ejes, dos sitios.** Lo que TÚ recibes es de la persona y vive en `profiles.email_prefs` (JSONB: añadir un aviso no puede costar una migración, y **solo se guarda lo apagado**, así una cuenta nueva no necesita fila ni arrastra un `true` fosilizado). Lo que hace la EMPRESA vive en columnas de `companies`; ojo con las dos trampas: el UPDATE está **acotado por columnas** desde el endurecimiento de facturación (hace falta `grant update (columna)`) y **`my_companies` arma el objeto campo a campo**, así que una columna que no se añada ahí nunca llega al cliente y el ajuste parece no guardarse.
  - **Un interruptor solo vale si detiene el envío.** Las claves de `EMAIL_KEYS` son las mismas que preguntan las edge functions a `email_recipients(ids, clave)`, el único sitio donde se decide quién recibe. Es **fail-closed**: si esa consulta falla no sale nada, porque mandar un correo que alguien apagó es peor que no mandarlo y el aviso sigue estando en el timbre.
  - **`Switch` (nuevo) para ajustes, `Checkbox` para elegir de una lista.** Un checkbox dice "he elegido esto", un interruptor dice "esto está funcionando". Se guarda al instante, sin botón de guardar. La **fila entera es el control** (`<button role="switch">` con `aria-labelledby`): un `<label>` alrededor NO activa un `<button>`.
  - **Lo que merece un ajuste se detecta solo** (`src/lib/settings.test.ts`, "el guardián de los ajustes"). No es una nota que haya que recordar: es una prueba que **falla** cuando aparece algo configurable sin su interruptor. Vigila cuatro cosas: (1) toda edge function que mande correo pasa por `conPreferencia`, (2) las claves de `EMAIL_KEYS` y las que consultan las funciones son las mismas, sin inventadas ni huérfanas, (3) toda columna de `companies` con `grant update (...) to authenticated` tiene su fila en el registro **y** viaja en `my_companies`, y (4) el registro es coherente (ids únicos, todo ajuste con `hint`, cero guiones largos). Al fallar, el mensaje dice qué hacer. Solo hay dos salidas honestas: declarar el ajuste, o apuntar el caso en `CORREOS_SIN_AJUSTE` / `COLUMNAS_SIN_AJUSTE` **con su motivo escrito** (una excepción sin motivo es un olvido con permiso). Los tres detectores se probaron rompiéndolos a propósito.
  - La sección del **asistente de WhatsApp está declarada y apagada** (`WHATSAPP_ASSISTANT_ENABLED`): la feature vive en `claude/interview-invitation-planning-ea35a6`. Al fusionar, encender el flag y colgarle sus grupos.
- **Perfil de usuario** (`profiles`, migración `20260802210000_user_profiles.sql`; `src/lib/profiles.tsx`). La fila es de la **persona**, no de la empresa (`user_id` es la PK), y los compañeros de equipo se ven entre sí vía `current_user_peer_ids()`. Nombre y foto, nada más: el **horario de trabajo y las preferencias de notificación se dejaron fuera a propósito** hasta que existan notificaciones, porque un control que no gobierna nada es una promesa falsa. Fotos en el bucket **público** `avatars` (espejo de `brand-assets`, rutas por uuid, así no hay que firmar una URL por fila; los CV siguen en su bucket privado), recortadas a 256px cuadrados y reenvasadas a WebP en el cliente. `profiles.nameFor(userId, email)` es la **única** fuente de "cómo se llama esta persona" y `src/components/ui/Avatar.tsx` la única primitiva de su cara: chat de candidato, tablón y lista de miembros pasan por ahí. Los avisos llegaron después y **NO viven en este menú**: tienen timbre propio en la barra (se decidió primero meterlos aquí y se cambió con la referencia de Stripe delante).
- **Favorito (una estrella) sustituye a la valoración de 5 estrellas** (jul 2026). Es un interruptor ("a este lo quiero"), no una nota con matices. Va en el acento porque es **selección**, no en ámbar: el ámbar ya significa "entrevista" y aparece en la misma cabecera. Migración: `rating >= 4` pasó a favorito.
- **El chat de equipo sustituye a las notas internas** (`candidate_comments`). Con autor, fecha y menciones `@` que avisan por correo. Es una capacidad **Pro** (misma llave que el tablón, `planHas(plan, 'teamBoard')`); en Esencial la pestaña Equipo enseña el bloqueo. Una sola primitiva de conversación, `src/components/ui/Chat.tsx`, para el candidato y para el tablón: si tocas una, tocas las dos.
- **Historial del candidato** (`candidate_events`): lo escriben triggers de base de datos, y el TEXTO se compone en el cliente (`eventoTexto`) para poder usar las etiquetas de estado reales sin migrar filas. Los comentarios NO son eventos: el chat está en la pestaña de al lado.
- **Accesibilidad suelo**: foco visible con `:focus-visible` (nunca quitar el outline), `<button>`/`<a>` reales, `<table>` semántica con `aria-sort`, drag-to-reorder SIEMPRE con alternativa de teclado y subir/bajar, `prefers-reduced-motion` respetado.
- **Movimiento**: corto y sobrio (120/180/240ms), solo `transform`/`opacity`. Sin springs ni rebotes. El verde "contratado" es el único hito con un pulse sutil; "descartado" solo cambia de color, sin shake ni rojo.

## Reglas de copy (toda la app)
- **Sin guion largo (—)** en nada visible. Usar comas, dos puntos o puntos.
- Español con **tuteo** consistente. Sentence case en headings/botones/labels. Labels verbo-primero (1-3 palabras).
- **Glosario congelado**: puesto (no vacante/oferta/campaña), candidato, candidatura (el envío), enlace (no link), estado, exportar, formulario. Estados: nuevo / contactado / entrevista / descartado / contratado.
- **Cero dark patterns** (es el posicionamiento): sin urgencia/escasez falsa, sin prueba social inventada (testimonios, contadores, logos), sin confirmshaming, sin preselecciones. Test: "¿funcionaría igual si el usuario supiera cómo está hecho?".
- Para **redactar o revisar** copy (titulares, CTAs, alternativas, microcopy, FAQs): ejecutar la skill **`apuntate-copy`** (`.cursor/skills/apuntate-copy/SKILL.md`). Esta sección manda; la skill añade workflow, ejes de mensaje y ejemplos en `examples.md`.

## Pricing (decidido: premium, no el más barato. "Los mejores")
Good-better-best. Presentación por neuromarketing (Mario, jul 2026; **sustituye** a la doctrina anterior de números redondos). Editable en `src/lib/pricing.ts`; los importes de cobro reales viven en los prices de Stripe (recrearlos si cambian estos números).
- **Esencial 149 €/mes** (2 procesos activos), **Pro 249 €/mes** (10 procesos), **Multi 499 €/mes** (ilimitado, multi-local, ETT). Anual = ×10 (2 meses gratis exactos). Efecto dígito izquierdo (149/249); **Multi es el ancla del catálogo**, no un producto a optimizar: sube antes que bajar, para que Pro se lea como "la mitad del tope con casi todo".
- **Presentación del precio** (componente único `src/components/TierPrice.tsx`, landing y /app/plan): número protagonista con **símbolo € pequeño y arriba** (menos dolor de pago). En anual: mensual **tachado** al lado, equivalente mensual grande y debajo "Pagas X € una vez al año. Ahorras Y €" (la rebaja se ve, no se calcula; ahorro **en euros, nunca en %**: regla de 100). "Sin permanencia" pegado al precio; **"Precios sin IVA." aparte y en letra pequeña** al pie de la sección (el positivo no comparte línea con el negativo). En la landing el toggle carga en **Mensual por defecto** (Mario, jul 2026); la rebaja anual se descubre al alternar.
- **Señuelo explícito en Pro**: microtexto bajo el badge de procesos, "5× la capacidad de Esencial", calculado de los datos reales. Sin reencuadres de "€/día" ni "coste de una mala contratación" bajo las tarjetas (Mario los quitó, jul 2026). Reencuadres bajo las tarjetas: Pro ≈ 8 €/día y "una mala contratación puede costar hasta 5.000 €; un mes de Pro es el 5 % de esa cifra".
- Chapa del plan Pro: **"Recomendado"**, NUNCA "el más elegido" (sin usuarios reales sería prueba social inventada: viola la regla de cero dark patterns).
- Diferenciar por **procesos/anuncios activos**, **nunca por nº de candidatos** (no estrangular en plena oleada) ni por usuario (castigaría al bar de 1-2 personas). **Usuarios siempre ilimitados.**
- **No se cobra por primitivas, se cobra por escala** (ago 2026). Sedes y marcas salieron de `PLAN_FEATURES`: poner el nombre del local a un puesto y tu logo en tu formulario no cuesta nada y son de **todos** los planes, Prueba incluida (sedes sin tope; una marca por empresa, `PLAN_BRAND_LIMIT`). Multi cobra lo que sí escala: **encargados por sede** (`managers`) y **más de una marca** (`multiBrand`, espejo del trigger `plan_brand_limit`).
- En la landing, **anclar el coste real ANTES** del precio, como **dos verdades**: hacerlo **a mano** (56 candidatos/vacante, horas, perfiles perdidos) frente a **pagando** (InfoJobs 295-369 €/oferta, empresa de selección 15-20% del salario, mala contratación hasta 3 sueldos). Sin jerga tipo "ATS". Cifras fechadas a junio 2026.

## Principios de trabajo
- **Mismo rigor en el cambio pequeño que en el grande**, también en follow-ups cortos. Aplicar principios de diseño, verificar visualmente y rehacer si no está perfecto. Mario lo pidió explícitamente tras un follow-up flojo.
- **El cwd del shell se resetea entre llamadas Bash**: para compilar/verificar hacer `cd /Users/mario/criba` explícito y comprobar `pwd` (una vez un build salió del proyecto equivocado por esto).
- El sistema de diseño se sintetizó con la skill `ux-ui-mastery`. Para nuevas piezas, ejecutar esa misma doctrina, no inventar otra dirección.

## Backend (Supabase)
Producto full-stack: el frontend (Vite/React) habla con **Supabase** (Postgres + Auth + Storage + RLS).
- **Multi-tenant**: `companies` <- `memberships` -> `auth.users`. Cada empresa tiene `campaigns` (puestos, con `fields`/`branding` en JSONB) y `candidates`. RLS acota todo por empresa vía `current_user_company_ids()`.
- **El formulario público es anónimo**: NO toca las tablas directo. Lee con el RPC `get_public_campaign(slug)` y escribe con `submit_application(slug, answers, source, cv_path)` (ambos `security definer`, concedidos a `anon`). El rol `anon` no tiene acceso directo a las tablas; `authenticated` sí (acotado por RLS).
- **Auth**: Google OAuth + email con contraseña (confirmación de email obligatoria; política de longitud/complejidad + rechazo de filtradas). `auth.tsx` gestiona sesión + empresa; primer login sin empresa => onboarding (`create_company`). Reset de contraseña en `/restablecer`.
- **CVs**: bucket privado `cvs`. El candidato anónimo sube (policy insert); el merchant descarga con URL firmada (`createSignedUrl`).
- **Store**: `store.tsx` es un caché en memoria de la empresa (getters síncronos, mutaciones optimistas a Supabase). El acento de empresa/puesto y los enlaces públicos usan el origen real (`publicFormUrl`).

## Pagos y emails (código escrito, faltan SOLO las claves)
Edge functions en `supabase/functions/` (Deno), listas para enchufar secrets:
- `stripe-checkout` (auth): crea sesión de Stripe Checkout para un plan. Página `/app/plan` la invoca.
- `stripe-webhook` (sin JWT): actualiza `plan`/`subscription_status` de la empresa según Stripe.
- `notify-new-candidate` (sin JWT): email al dueño vía Resend al entrar una candidatura (lo llama el formulario público con el `candidate_id`). No-op si falta `RESEND_API_KEY`.
- Secrets necesarios (`supabase secrets set ...` o env del deploy): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ESENCIAL|PRO|MULTI`, `RESEND_API_KEY`, `NOTIFY_FROM`, `APP_URL`.
- Servir local: `supabase functions serve`. Webhook local: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`.

## Estado actual
Full-stack funcionando en local, verificado end-to-end (login magic link, onboarding, datos demo, dashboard real, formulario público anónimo que persiste, aislamiento multi-tenant comprobado en SQL, wizard de puestos con plantillas). Stripe/Resend con el código listo, faltan las claves. **Pendiente**: enchufar claves (Stripe/Resend), Google OAuth (credenciales) y deploy. Build verde, repo git propio.

## Skills Cursor (proyecto)

Skills en `.cursor/skills/<nombre>/SKILL.md`. Invocar con `/nombre` cuando aplique.

| Skill | Cuándo |
| --- | --- |
| `apuntate-design` | UI, UX, tokens, componentes, verificación visual |
| `apuntate-copy` | Titulares, CTAs, alternativas de texto, microcopy, tono de marca |
| `supabase-workflow` | Migraciones, RLS, RPCs, edge functions, auth/store |
| `verify-before-close` | Checklist final antes de cerrar un cambio |
| `pr-review` | Revisar PRs y diffs de rama |

## Contexto de diseño (impeccable)
La skill `impeccable` mantiene dos documentos en la raíz que cualquier trabajo de diseño lee antes de empezar:
- **`PRODUCT.md`** (estrategia): register (`product`), usuarios, propósito, personalidad, anti-referencias y principios. Quién/qué/por qué. El cliente que encaja va de una pequeña constructora a una ETT (no micro-bares); nichos núcleo construcción y logística.
- **`DESIGN.md`** (sistema visual): colores, tipografía, componentes y layout. Cómo se ve. PENDIENTE de generar con `/impeccable document` (capturará los tokens reales de `index.css`).

Esta doctrina visual ("SaaS confiable", arriba) sigue siendo la fuente de verdad; PRODUCT.md/DESIGN.md la formalizan para las herramientas de diseño, no la sustituyen.

# Comprobación de interés de candidatos por email

Fecha: 21 de julio de 2026

Estado: diseño aprobado

## Resumen

Apúntate Fácil permitirá seleccionar candidatos de un puesto y enviarles un correo para confirmar si siguen interesados. El candidato responderá mediante dos botones y la respuesta aparecerá en el panel como una señal independiente del estado de selección.

La primera versión será exclusivamente por email. Los envíos serán manuales, usarán una plantilla fija y no incluirán automatizaciones programadas ni WhatsApp.

## Problema

Cuando una empresa conserva candidatos durante semanas, parte de ellos deja de estar disponible. Antes de contactar personalmente, el equipo necesita comprobar quién sigue interesado sin escribir el mismo mensaje uno por uno.

El resultado debe reducir llamadas improductivas sin convertir Apúntate Fácil en una herramienta de campañas o marketing.

## Objetivos

- Comprobar el interés de varios candidatos desde la selección existente del panel.
- Recoger una respuesta explícita con el mínimo esfuerzo para el candidato.
- Mostrar la respuesta y su antigüedad sin modificar automáticamente el estado del candidato.
- Permitir un único recordatorio y nuevas comprobaciones controladas cuando corresponda.
- Evitar envíos duplicados, enlaces activados por analizadores de correo y accesos entre empresas.
- Mantener el email como dato configurable del formulario, con una advertencia clara si la empresa deja de solicitarlo.

## Fuera de alcance

- WhatsApp, SMS u otros canales.
- Envíos automáticos por antigüedad o inactividad.
- Mensajes, asuntos o cadencias editables por la empresa.
- Seguimiento de aperturas o píxeles invisibles.
- Cambios automáticos a `nuevo`, `contactado`, `entrevista`, `contratado` o `descartado`.
- Más de un recordatorio para una comprobación sin respuesta.

La automatización programada se conserva como idea futura en `docs/ideas-futuras.md`.

## Experiencia del panel

### Entrada

La acción aparece en la barra de selección múltiple ya existente de `/app/puestos/:id`:

- Escritorio: botón principal claro dentro de la barra ultramarine de selección.
- Móvil: acción disponible en la barra inferior del modo selección.
- Etiqueta: **Comprobar interés**.

La acción solo aparece cuando hay al menos un candidato seleccionado.

### Confirmación previa

Al pulsar la acción se abre un cuadro con:

- Número de candidatos que recibirán el correo.
- Número de candidatos omitidos, agrupados por motivo.
- Vista previa de asunto y cuerpo.
- Acciones **Cancelar** y **Enviar a N**.

Motivos de omisión:

- Sin email o con email inválido.
- Candidatura bloqueada por el plan.
- Dirección duplicada dentro de la selección.
- Comprobación o recordatorio todavía dentro de su plazo de espera.
- El candidato ya indicó que no le interesa.
- Ya se utilizó el único recordatorio permitido y continúa sin responder.

Si varias candidaturas seleccionadas del mismo puesto comparten email, se envía un solo correo. La comprobación queda vinculada a todas esas candidaturas y la respuesta se muestra en todas ellas.

Solo se vinculan candidaturas elegibles. Si una candidatura asociada a esa dirección ya indicó que no le interesa o agotó sus envíos, se omite aunque otra candidatura con el mismo email sí pueda recibir la comprobación.

El email se obtiene del primer campo de tipo `email` con valor no vacío, respetando el orden del formulario. La normalización elimina espacios exteriores y convierte a minúsculas; no altera puntos, alias ni otras reglas específicas de cada proveedor.

El máximo por acción será de 200 direcciones únicas elegibles.

### Resultado del envío

El resultado distingue:

- Enviados.
- Omitidos.
- Fallidos.

Un fallo parcial no invalida los demás envíos. Solo los mensajes aceptados por Resend quedan marcados como enviados. Los fallidos pueden reintentarse sin duplicar los que ya salieron.

### Señal de interés

La tabla y el detalle del candidato muestran una señal separada del estado:

- **Enviado hoy** o **Enviado hace N días**.
- **Sigue interesado/a**, con la fecha de respuesta.
- **Ya no le interesa**, con la fecha de respuesta.
- **Sin respuesta**, cuando hayan pasado 7 días desde el último envío de esa comprobación.
- **No disponible**, cuando el candidato no tiene email.

El panel permite filtrar por:

- Sigue interesado.
- Ya no le interesa.
- Comprobación enviada.
- Sin respuesta.
- Nunca comprobado.

El ultramarine se reserva para la acción y la selección. La respuesta positiva puede usar verde semántico. La negativa y la falta de respuesta usan grafito, nunca rojo.

## Reglas de contacto

### Primer envío

La empresa puede iniciar una comprobación cuando el candidato nunca haya sido comprobado o cuando cumpla las reglas de una nueva comprobación.

### Sin respuesta

- A los 7 días, la señal pasa a **Sin respuesta**.
- Desde ese momento se permite un único reenvío manual.
- Si tampoco responde al recordatorio, esa candidatura no recibe más correos mediante esta función.

### Respuesta positiva

- Si responde que sigue interesado, la empresa puede iniciar una nueva comprobación después de 30 días.
- La nueva comprobación crea un registro nuevo y conserva el historial anterior.
- Al crearla, el enlace de la comprobación anterior queda sustituido.

### Respuesta negativa

- Si responde que ya no le interesa, no se permiten nuevas comprobaciones sobre esa candidatura.
- Su estado de selección no cambia automáticamente.

### Corrección de la respuesta

Mientras el enlace siga vigente y no haya sido sustituido, el candidato puede entrar de nuevo y confirmar la otra opción. Se conserva la respuesta más reciente y su fecha.

Estas reglas solo afectan a la acción masiva de comprobación. No impiden que la empresa llame o contacte personalmente al candidato por otros medios.

## Plantilla de email

La plantilla es fija. Solo cambian el nombre del candidato, la identidad de la empresa o marca y el puesto.

Identidad visible:

- Si el puesto está vinculado a una marca, se usa el nombre de esa marca.
- En caso contrario, se usa el nombre de la empresa.

Asunto:

> ¿Sigues interesado/a en el puesto de [puesto]?

Contenido:

> Hola, [nombre].
>
> [Empresa] está revisando las candidaturas para el puesto de [puesto] y quiere saber si sigues interesado/a.

Botones:

- **Sí, sigo interesado/a**
- **No, ya no me interesa**

Nota al pie:

> Recibes este correo porque enviaste una candidatura para este puesto.

Si no se puede obtener un nombre fiable, el saludo será simplemente **Hola.**

El correo reutiliza la plantilla compartida de Resend y la doctrina visual de Apúntate Fácil. No incluye seguimiento de apertura.

El único recordatorio también usa una plantilla fija.

Asunto del recordatorio:

> Recordatorio: ¿sigues interesado/a en el puesto de [puesto]?

Contenido del recordatorio:

> Hola, [nombre].
>
> Hace unos días, [Empresa] te preguntó si sigues interesado/a en el puesto de [puesto]. Como todavía no hemos recibido respuesta, puedes indicarlo con una de estas opciones.

Los botones y la nota al pie son los mismos que en el primer correo.

## Respuesta pública

Se añade la ruta pública mínima `/respuesta/:token`.

El enlace de cada botón lleva el token y la opción elegida, pero abrirlo no escribe en la base de datos. La página muestra:

- Identidad de Apúntate Fácil.
- Empresa o marca.
- Puesto.
- Respuesta elegida.
- Botón **Confirmar respuesta**.

La escritura solo ocurre al pulsar ese botón. Esto evita respuestas falsas causadas por analizadores de seguridad que abren enlaces automáticamente.

Tras confirmar:

> Tu respuesta se ha guardado. [Empresa] podrá verla en tu candidatura.

La página no muestra nombre, email, teléfono, respuestas del formulario ni otros datos de la candidatura. Tampoco permite navegar al formulario o al panel.

Estados de error:

- Token inexistente: **Este enlace no es válido.**
- Token caducado: **Esta comprobación ha caducado. La empresa puede enviarte una nueva si todavía corresponde.**
- Token sustituido: **Hay una comprobación más reciente. Usa el último correo que recibiste.**
- Fallo temporal al confirmar: se conserva la opción y se ofrece **Intentar de nuevo**.

El token caduca a los 60 días. Se almacena únicamente su hash.

## Email en los formularios

Todos los puestos nuevos incluyen el campo **Email** como obligatorio por defecto:

- Puestos creados desde cero.
- Plantillas de hostelería, construcción, logística, limpieza y demás sectores.

La empresa puede hacerlo opcional o eliminarlo. Antes del cambio se muestra una confirmación informativa.

Al hacerlo opcional:

> **El email dejará de ser obligatorio**
>
> Podrás seguir recibiendo candidaturas, pero no podrás comprobar el interés por email de quienes no lo rellenen.

Acciones: **Mantener obligatorio** y **Hacer opcional**.

Al eliminarlo:

> **Este puesto dejará de pedir email**
>
> No podrás comprobar el interés por email de los candidatos que entren a partir de ahora.

Acciones: **Mantener campo** y **Eliminar email**.

Los formularios existentes no se modifican automáticamente. Si un puesto no tiene campo de email, el panel explica la limitación y ofrece **Añadir email al formulario**.

## Modelo de datos

Se utiliza un modelo normalizado para conservar el historial y agrupar direcciones duplicadas.

### `candidate_interest_batches`

Representa una acción iniciada desde el panel:

- `id`
- `company_id`
- `campaign_id`
- `initiated_by`
- `created_at`

### `candidate_interest_checks`

Representa una dirección única dentro de un ciclo de comprobación:

- `id`
- `batch_id`
- `company_id`
- `campaign_id`
- `recipient_email`
- `delivery_status`: `pending`, `sent` o `failed`
- `response`: `interested`, `not_interested` o `null`
- `token_hash`
- `provider_message_id`
- `sent_at`
- `responded_at`
- `reminder_sent_at`
- `reminder_provider_message_id`
- `expires_at`
- `superseded_at`
- `created_at`

El estado mostrado en el panel se deriva de estos campos y de la fecha actual. **Sin respuesta** no necesita persistirse como estado independiente.

### `candidate_interest_check_candidates`

Relaciona una comprobación con una o más candidaturas:

- `check_id`
- `candidate_id`
- Clave primaria compuesta.

Al borrar un puesto se eliminan sus lotes, comprobaciones y relaciones. Al borrar una candidatura se elimina su relación; si una comprobación queda sin candidaturas vinculadas, también se elimina. Borrar una candidatura duplicada no elimina la comprobación mientras conserve otra candidatura vinculada.

El historial registra el usuario que inició el lote, los envíos, el recordatorio y la respuesta.

## Backend y permisos

### Envío autenticado

Una Edge Function autenticada recibe el puesto y los identificadores seleccionados.

La función:

1. Resuelve al usuario desde el JWT.
2. Lee candidatos mediante el alcance que ya aplican RLS y las sedes del encargado.
3. Comprueba que todos pertenecen al puesto solicitado y a la empresa activa.
4. Excluye candidaturas bloqueadas y aplica las reglas de elegibilidad.
5. Extrae el primer campo de tipo `email` con valor y agrupa por email normalizado.
6. Crea el lote y sus comprobaciones.
7. Envía mediante Resend.
8. Devuelve conteos y motivos de omisión o fallo.

El uso de credenciales administrativas, si es necesario para el envío, ocurre solo después de autorizar los candidatos con el contexto del usuario.

La operación lleva una clave de idempotencia para que un doble clic o reintento de red no duplique correos.

### Lectura y respuesta anónimas

El rol anónimo no recibe acceso directo a las tablas. Dos operaciones públicas con privilegios mínimos resuelven el token:

- Obtener el contexto no sensible para pintar `/respuesta/:token`.
- Confirmar `interested` o `not_interested` mediante una petición explícita.

Ambas comparan el hash del token, validan caducidad y sustitución, y limitan estrictamente los campos que leen o escriben.

## Demo

En `/demo` el flujo se simula localmente:

- Se muestra la misma confirmación y los mismos estados.
- Se indica claramente que es una simulación.
- Nunca se invoca Resend ni se envían correos a los datos de ejemplo.

## Privacidad y entregabilidad

- El correo es una comunicación operativa ligada a una candidatura, no una campaña comercial.
- No se añaden píxeles de apertura ni seguimiento invisible.
- Antes del despliegue se revisa el aviso de privacidad del formulario para describir la comprobación de interés.
- Resend ya figura como subencargado en la documentación legal.
- Los errores del proveedor se guardan de forma saneada, sin exponer secretos ni contenido personal innecesario.

## Manejo de errores

- Falta `RESEND_API_KEY`: la función falla de forma explícita en producción y no marca envíos como realizados.
- Dirección rechazada por Resend: la comprobación queda en `failed` y puede reintentarse.
- Fallo parcial: los correos aceptados conservan `sent`; los demás no se reenvían salvo acción explícita.
- Pérdida de conexión en el panel: la idempotencia permite consultar o repetir la operación sin duplicar envíos.
- Error al confirmar respuesta: no se pierde la opción elegida y la página permite reintentar.

## Verificación

### Base de datos y permisos

- Un usuario de la empresa A no puede leer, enviar ni responder por datos de la empresa B.
- Un encargado solo puede incluir candidatos de sus sedes.
- El rol anónimo no tiene acceso directo a las tablas nuevas.
- Un token no revela si existe una candidatura fuera del contexto mínimo permitido.
- Borrar candidaturas y puestos limpia las relaciones previstas.

### Reglas de negocio

- Una selección con emails ausentes, duplicados y bloqueados produce los conteos correctos.
- Una dirección duplicada recibe un solo email y actualiza todas las candidaturas vinculadas.
- El doble clic no duplica envíos.
- **Sin respuesta** aparece a los 7 días.
- Solo se permite un recordatorio.
- Una respuesta positiva permite nueva comprobación a los 30 días.
- Una respuesta negativa impide nuevas comprobaciones.
- Un enlace antiguo queda sustituido al crear un ciclo nuevo.
- Abrir el enlace no registra la respuesta; confirmar sí.
- La corrección de respuesta conserva el valor y fecha más recientes.

### Interfaz

- Barra de selección y cuadro de confirmación en escritorio y móvil.
- Filtros y señales con contraste AA y texto, no solo color.
- Foco visible y navegación por teclado.
- Avisos al hacer opcional o eliminar el email.
- Formularios nuevos validan el email obligatorio al blur y al enviar, sin borrar datos ante errores.
- La ruta pública funciona en móvil y no expone datos personales.
- La demo no realiza llamadas de envío reales.

### Integración

- Correos locales visibles en Mailpit.
- Fallo parcial y reintento controlados.
- `npm run build` sin errores.
- `npx tsc --noEmit` sin errores.

## Criterios de aceptación

La funcionalidad se considera terminada cuando una empresa puede seleccionar candidatos, conocer exactamente quién recibirá el correo, enviar una plantilla fija, recoger una respuesta confirmada y filtrar el panel por esa señal sin alterar estados de selección ni enviar mensajes duplicados.

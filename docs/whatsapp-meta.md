# Configurar WhatsApp en Meta

Guía en el orden en que se puede hacer de verdad.

**Los pasos 1 a 4 no necesitan nada de la aplicación**: se hacen enteros en el
panel de Meta, hoy, sin desplegar nada y sin esperar a nadie. Solo el paso 5
(el webhook) necesita una dirección pública nuestra, y por eso va el último.

Regla que no se salta nunca: **ningún token ni clave secreta se pega en un chat,
ni en un commit, ni en una captura.** Todo entra por `./scripts/whatsapp-secrets.sh`,
que los pide por teclado sin mostrarlos y los escribe donde toca. Ese script se
puede ejecutar las veces que haga falta y dejar en blanco lo que aún no tengas:
lo que no rellenes se queda como estaba.

---

## 1. Las plantillas (empieza por aquí, hoy)

Es lo único que no se acelera trabajando: Meta tarda de unas horas a varios
días y rechaza por detalles del texto. Todo lo demás depende de que estén.

Fuera de la ventana de 24 horas, WhatsApp solo deja mandar plantillas
aprobadas. Sin ellas no hay primer mensaje, o sea que no hay producto.

**Esto no se hace a mano.** Con el token puesto:

```bash
node scripts/whatsapp-templates.mjs
```

Mira qué hay y no toca nada. Para crear las que falten y mandarlas a revisión,
lo mismo con `--crear`. Y para ver cómo van luego, otra vez sin `--crear`.

Va por API y no por el panel a propósito: los botones tienen que estar en un
orden EXACTO (el código los identifica por posición, así que cambiarlos de sitio
hace que "No me interesa" se lea como "Ver horarios") y los nombres tienen que
coincidir carácter a carácter con `_shared/whatsapp/render.ts`. Un dedazo ahí no
da error: da un 132000 semanas después, cuando un candidato se queda sin
invitación y nadie se entera.

El texto de cada una queda escrito abajo por si hay que revisarlo o rehacerlo a
mano. Categoría **Utilidad** (no marketing: son mensajes de un proceso que la
persona ya inició al apuntarse) e idioma **Español**.

### `invitacion_entrevista` (imprescindible)

**Cuerpo:**

```
Hola {{1}}. Soy el asistente de IA de {{2}} y te escribo por tu candidatura a {{3}}. Me encargo de cuadrar la cita, y la entrevista la harás con una persona del equipo. Vamos a buscar un horario que te venga bien.
```

> Se presenta como IA en la primera línea porque lo exige el **artículo 50 del
> Reglamento europeo de IA**, en vigor desde el 2 de agosto de 2026: quien habla
> con una máquina tiene derecho a saberlo sin preguntar. (Las obligaciones de
> alto riesgo del Anexo III sí se aplazaron a diciembre de 2027; la
> transparencia no.) La segunda frase no es relleno legal: sin ella, enterarte
> de que te escribe una máquina se lee como que no han querido dedicarte ni un
> minuto. Diciendo que lo automático es la CITA y que la entrevista es con una
> persona, se lee como lo que es.
>
> **Si ya la tenías aprobada con el texto viejo**, hay que editarla en WhatsApp
> Manager (vuelve a revisión) o darla de alta con otro nombre. El script solo
> crea las que faltan, no reescribe las que existen.

**Botones** (tipo *Respuesta rápida*, **en este orden exacto**, que el código los
identifica por posición):

1. `Ver horarios`
2. `No me interesa`
3. `Tengo una pregunta`

**Ejemplos** que pide Meta para revisar: `{{1}}` Rubén, `{{2}}` Construcciones
Ledesma, `{{3}}` Peón de albañil.

### `retomar_eleccion` (imprescindible)

Para cuando pasaron 24 horas desde su último mensaje y ya no se le puede
escribir texto libre.

**Cuerpo:**

```
Hola {{1}}. Seguimos con tu entrevista de {{3}} en {{2}}. ¿Quieres ver los horarios disponibles?
```

**Botón** (respuesta rápida): `Ver horarios`

### `recordatorio_vispera` (imprescindible)

El aviso del día antes. Va por plantilla porque a un día vista la ventana de 24
horas está cerrada casi siempre, y una plantilla es lo único que WhatsApp deja
entrar. **Hasta que Meta la apruebe, este envío falla con el error 132000** y el
candidato no recibe nada.

**Cuerpo:**

```
Hola {{1}}. Mañana es tu entrevista para el puesto de {{2}}. Queda el {{3}}. Dónde: {{4}}. Dinos si sigue en pie o si prefieres que busquemos otro hueco.
```

**Botones** (tipo *Respuesta rápida*, **en este orden exacto**, que el código los
identifica por posición):

1. `Ahí estaré`
2. `Cambiar cita`

**Ejemplos** para la revisión: `{{1}}` Rubén, `{{2}}` Peón de albañil, `{{3}}`
lunes, 3 de agosto a las 11:00, `{{4}}` Calle Marina 32, nave 4, 35008 Las
Palmas.

> Sale la víspera a las **18:00 de la hora del puesto**, no 24 horas justas
> antes: una cita del lunes a las 09:00 mandaría si no un WhatsApp a las 09:00
> del domingo. Si esa hora ya ha pasado cuando se cierra la cita, no se manda:
> queda el recordatorio de 2 horas antes.

### `recordatorio_entrevista` (imprescindible)

Es el aviso de **dos horas antes**, que ya sale solo. Sin botones: a esas horas
no hay nada que decidir, solo que no se te olvide.

```
Hola {{1}}. Te recordamos tu entrevista para el puesto de {{2}}. Queda el {{3}}. Dónde: {{4}}. Si te surge algo y no puedes venir, contéstanos por aquí y buscamos otro hueco.
```

> La primera versión de esta, más corta, la rechazó Meta: exige texto fijo
> suficiente en proporción al número de variables.

### `entrevista_cancelada` (el código aún no la usa)

Créala igual **ahora**, porque la aprobación es lo que tarda y así está lista
cuando toque.

```
Hola {{1}}. Tu entrevista de {{2}} del {{3}} se ha cancelado. Sentimos el cambio.
```

### `interes_sigue_activo` (el código aún no la usa)

La comprobación de interés por WhatsApp: la misma pregunta que hoy se manda por
correo, en el canal que sí abre el candidato de obra o de almacén. Créala ahora
por lo mismo que la anterior, porque lo que tarda es la aprobación.

```
Hola {{1}}. Te escribimos de {{2}} por tu candidatura a {{3}}. Estamos revisando los perfiles y queremos saber si sigues interesado/a en el puesto antes de seguir adelante.
```

**Botones** (tipo *Respuesta rápida*, **en este orden exacto**):

1. `Sí, sigo interesado/a`
2. `No, ya no me interesa`

**Ejemplos** para la revisión: `{{1}}` Rubén, `{{2}}` Construcciones Ledesma,
`{{3}}` Peón de albañil.

> Los botones dicen palabra por palabra lo mismo que las dos opciones del correo
> (`src/lib/interestEmail.ts`). Es la misma pregunta por otro canal: si cada uno
> la formula a su manera, las respuestas dejan de poder juntarse.

> Si Meta rechaza alguna, casi siempre es por sonar a promoción o por empezar
> con una variable. El texto de arriba empieza por saludo y no promete nada, que
> es justo lo que buscan.

## 2. Los destinatarios de prueba

**Dónde**: tu app -> WhatsApp -> **Configuración de la API** -> apartado
**Destinatario** -> Administrar lista.

Añade tu móvil. Mientras la app esté en desarrollo solo se puede escribir a
hasta 5 números dados de alta ahí. Sin esto, cualquier envío falla con el error
131030 y no se puede probar nada de verdad.

## 3. Los identificadores

En esa misma pantalla de **Configuración de la API**:

- **Identificador de número de teléfono** -> `WHATSAPP_PHONE_NUMBER_ID`
- **Identificador de la cuenta de WhatsApp Business** -> `WHATSAPP_WABA_ID`

Y en Configuración de la app -> **Información básica** -> Clave secreta de la
aplicación -> Mostrar:

- -> `WHATSAPP_APP_SECRET`

Con esa clave se firma cada webhook que llega. Sin ella el webhook **rechaza
todo**, que es lo correcto: una firma que no se comprueba no protege de nada.

## 4. El token permanente

El que da Meta en la pantalla de configuración **caduca a las 24 horas**. Vale
para mirar, no para que esto funcione.

1. business.facebook.com -> Configuración del negocio -> **Usuarios del sistema**
2. Añadir usuario, rol **Administrador**
3. **Agregar activos** -> Apps -> tu app -> control total
4. También la cuenta de WhatsApp como activo
5. **Generar nuevo token** -> elige la app -> caducidad **Nunca**
6. Permisos: `whatsapp_business_messaging` y `whatsapp_business_management`

-> `WHATSAPP_TOKEN`

### Guarda lo de los pasos 3 y 4

```bash
./scripts/whatsapp-secrets.sh local
```

Deja en blanco lo que aún no tengas.

---

## 5. El webhook (lo único que necesita algo nuestro)

Meta exige una dirección **pública y con HTTPS** que responda a su comprobación
de alta. Ahí hay un huevo y una gallina, y se rompe así: **lo único que hace
falta para que Meta dé el webhook por bueno es el token de verificación, que te
inventas tú.** Ni el número, ni el token de WhatsApp, ni la base de datos.

### Opción A: publicar solo esa función (recomendada)

Publicar `whatsapp-webhook` no enciende nada. Mientras no haya un WABA apuntando
a ella no le llega nada, y lo que llegue sin firma válida lo rechaza. Es una
puerta cerrada con la cerradura ya puesta.

Desde `/Users/mario/criba`:

```bash
supabase secrets set WHATSAPP_VERIFY_TOKEN=lo-que-tu-quieras-largo-y-raro
```

```bash
supabase functions deploy whatsapp-webhook
```

Comprueba tú mismo que responde, **antes** de tocar el panel de Meta:

```bash
curl "https://<tu-proyecto>.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=lo-que-tu-quieras-largo-y-raro&hub.challenge=PRUEBA"
```

Tiene que contestar exactamente `PRUEBA`. Si contesta otra cosa, el problema es
tuyo y no de Meta, y lo arreglas sin salir de la terminal.

### Opción B: un túnel a tu portátil

Si prefieres no publicar nada todavía:

```bash
cloudflared tunnel --url http://127.0.0.1:54321
```

Te da una URL pública temporal, y el webhook sería
`https://<lo-que-te-den>/functions/v1/whatsapp-webhook`. Funciona igual, pero la
URL cambia cada vez que reinicias el túnel y hay que volver a configurarla en
Meta. Para una comprobación puntual vale; para dejarlo funcionando, no.

### Y ya en Meta

**Dónde**: tu app -> WhatsApp -> Configuración -> Webhooks -> Editar.

- **URL de devolución de llamada**: la de arriba
- **Token de verificación**: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
- **Campos a los que suscribirse**: `messages` (ese basta: trae los mensajes
  entrantes y los estados de entrega)

Meta llama con un GET, compara el token y guarda. A partir de ahí ya recibes.

> Los mensajes entrantes seguirán rechazándose hasta que pongas
> `WHATSAPP_APP_SECRET`, porque sin ella no se puede comprobar la firma. Es lo
> correcto y es reversible: pones la clave, vuelves a desplegar, y empieza a
> entrar. El alta del webhook, mientras tanto, ya está hecha.

---

## Probar en local, sin Meta

Con `supabase functions serve --env-file supabase/functions/.env` levantado:

```bash
node scripts/whatsapp-sim.mjs texto 34612345678 "el martes me viene mejor"
```

El simulador **firma los payloads con tu mismo secreto**, así que ejercita el
código entero, comprobación de firma incluida. Un simulador que se salta la
firma no prueba la parte que más importa.

Para saber qué conversación tocar:

```bash
docker exec -i supabase_db_apuntatefacil psql -U postgres -d postgres -c "select id, wa_id, agent_state from candidate_conversations order by created_at desc limit 3;"
```

Y con ese id:

```bash
node scripts/whatsapp-sim.mjs boton 34612345678 "c:<id>:ver"
```

---

## Cuando toque desplegar todo

El webhook por sí solo no basta para que el sistema funcione: hacen falta las
tablas y el latido de la cola.

```bash
supabase db push --linked
```

```bash
supabase functions deploy interview-tick whatsapp-webhook
```

```bash
./scripts/whatsapp-secrets.sh prod
```

Y el número desde el que escribimos, en la base de producción:

```sql
select public.upsert_whatsapp_sender('TU_PHONE_NUMBER_ID', 'TU_WABA_ID', '+34 ...');
```

Más el latido, que es lo que hace que la cola avance sola. En el vault de
producción:

```sql
select vault.create_secret('https://<tu-proyecto>.supabase.co/functions/v1/interview-tick', 'interview_tick_url');
select vault.create_secret('<el mismo INTERVIEW_TICK_SECRET>', 'interview_tick_secret');
```

## Qué falta que no depende de nosotros

| Cosa | Quién manda | Cuánto tarda |
| --- | --- | --- |
| Aprobación de las plantillas | Meta | horas o días, con idas y venidas |
| Verificación del negocio | Meta | días |
| Número de producción | Meta, después de verificar | |

Sin verificar el negocio se puede hacer todo contra el número de pruebas y los 5
destinatarios dados de alta. **No es una maqueta: es el mismo código que pasa a
producción el día que aprueben el número.**

## Antes de escribir a un candidato real

El aviso en el formulario público de que podemos escribir por WhatsApp, y su
aceptación guardada con fecha. Está pendiente y es **bloqueante**: no se puede
escribir a alguien que dejó su teléfono para apuntarse a una oferta sin
habérselo dicho antes.

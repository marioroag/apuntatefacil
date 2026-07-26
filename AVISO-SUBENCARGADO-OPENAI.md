# Preaviso de nuevo subencargado: OpenAI

Borrador para enviar a **todos los clientes con cuenta activa**, no solo a los de
Pro y Multi: el compromiso del apartado 6 de la Política de Privacidad es con
todos, y quien esté en Esencial hoy puede subir de plan mañana.

## Por qué hay que mandarlo

La Política de Privacidad promete por escrito, en el apartado 6:

> "Si en el futuro queremos añadir o sustituir un subencargado, te lo
> comunicaremos con antelación razonable (...) **antes de que el cambio entre en
> vigor**. Si no estás de acuerdo con el nuevo subencargado por motivos
> razonables de protección de datos, podrás comunicárnoslo; si no encontramos una
> solución, podrás dar de baja el servicio sin penalización."

O sea que esto no es cortesía: es una cláusula del contrato que los clientes ya
aceptaron. Saltárselo sería incumplirlo, además del artículo 28.2 del RGPD.

**Manda el aviso ANTES de poner `OPENAI_API_KEY` en producción.** Ese secreto es
lo que enciende Meridian; hasta entonces no sale ni un dato.

## Cuánta antelación

El texto dice "antelación razonable" sin concretar. Lo habitual en el sector son
**30 días**. Si tienes prisa, 15 es defendible para un cambio que solo afecta a
planes de pago y que el cliente puede desactivar sin usar la función, pero 30 es
lo que no te va a discutir nadie.

---

## Asunto

Nuevo proveedor en Apúntate Fácil: OpenAI, a partir del [FECHA]

## Cuerpo

Hola [NOMBRE]:

Te escribo porque en Apúntate Fácil vamos a empezar a usar un proveedor nuevo y
tu contrato dice que tengo que avisarte antes, no después.

**Qué cambia.** Estamos lanzando Meridian, una función que lee cada candidatura
que te entra, la resume y calcula cómo de bien encaja con el puesto, para que
veas primero a quien más te interesa. Por debajo funciona con OpenAI, así que
OpenAI pasa a ser un subencargado del tratamiento de los datos de tus
candidatos, junto a Stripe, Resend, Supabase, Vercel y Google.

**Qué datos recibe OpenAI.** Las respuestas del formulario y, cuando el
candidato lo adjunta, el texto de su CV. **No le enviamos el correo ni el
teléfono** que el candidato escribe en el formulario, ni el archivo del CV en sí.

**Qué NO pasa con esos datos.** No se usan para entrenar los modelos de OpenAI.
OpenAI los conserva un máximo de 30 días en registros para detectar abusos y
después los borra, salvo que la ley le obligue a guardarlos más. Tenemos firmado
con ellos el acuerdo de tratamiento de datos del artículo 28 del RGPD.

**Meridian no decide nada.** Resume y ordena. No descarta candidatos, no cambia
estados y no manda correos por su cuenta: cualquier acción la confirmas tú con
un botón. No hay decisiones automatizadas sobre las personas candidatas.

**A quién afecta.** Meridian está en los planes Pro y Multi. Si estás en
Esencial o en el plan de Prueba, hoy no te afecta; te aviso igual porque el
cambio de proveedor es de la plataforma.

**Desde cuándo.** A partir del **[FECHA, mínimo 30 días desde este email]**.

**Si no estás de acuerdo.** Contéstame a este correo y lo hablamos. Si no
encontramos una solución, puedes dar de baja el servicio sin penalización, tal y
como dice la Política de Privacidad.

Tienes el detalle completo en el apartado 6 de la política:
https://apuntatefacil.com/privacidad

Un saludo,
Mario
Apúntate Fácil
privacidad@apuntatefacil.com

---

## Antes de darle a enviar

- [ ] Rellenar `[FECHA]` en el asunto y en el cuerpo (la misma en los dos sitios).
- [ ] Comprobar que la frase del DPA es verdad: **firmarlo antes de mandar esto**.
- [ ] Desplegar la política actualizada ANTES o A LA VEZ que el email, para que
      el enlace del final lleve al texto que menciona a OpenAI y no al viejo.
- [ ] Guardar constancia de a quién y cuándo se envió. Si algún día hay una
      inspección, el preaviso hay que poder demostrarlo.
- [ ] Que lo lea alguien de legal. Yo he redactado el borrador cotejándolo con
      lo que el código hace de verdad, pero no soy tu asesor jurídico.

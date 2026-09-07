# Registro de actividades de tratamiento (borrador para revisar)

> Artículo 30 del RGPD. Apúntate Fácil actúa en dos papeles: **responsable** de los
> datos de las cuentas de empresa y **encargado** de los datos de los candidatos, que
> son de cada empresa cliente. Un encargado también tiene que llevar este registro
> (art. 30.2) cuando el tratamiento no es ocasional, y aquí es diario. Borrador escrito
> a partir del código y de la política de privacidad el 7 de septiembre de 2026; los
> corchetes son lo que solo puede rellenar Mario.

## Datos del encargado / responsable

| | |
|---|---|
| Entidad | SOLERA CANARIAS TÉCNICA, S.L., NIF B-13789649 |
| Domicilio | Calle Quiquirá Bajo, 1, 38300 La Orotava, Santa Cruz de Tenerife |
| Contacto de privacidad | privacidad@apuntatefacil.com |
| Delegado de Protección de Datos | No designado (no obligatorio por tamaño y actividad; política, apartado 1) |
| Representante | [no procede: establecido en la UE] |

## A. Tratamientos como RESPONSABLE

### A1. Cuentas de empresa cliente
- **Finalidad**: prestar el servicio (alta, acceso, equipo, facturación, soporte). Base: ejecución del contrato (art. 6.1.b); obligaciones legales de facturación (6.1.c).
- **Interesados**: personas de contacto de las empresas cliente (propietarios, miembros, encargados).
- **Datos**: nombre, correo, contraseña cifrada (bcrypt, gestionada por Supabase Auth) o identidad de Google, foto opcional, empresa, rol, preferencias de la interfaz, ajustes de correo.
- **Destinatarios**: Supabase (base de datos y autenticación, región eu-west-3, París), Vercel (alojamiento del frontend y analítica sin cookies), Resend (correos transaccionales), Stripe (cobro; ver A2), Google (solo si la persona conecta su calendario; ver A3).
- **Transferencias**: Vercel, Resend y Stripe con cláusulas contractuales tipo (política, apartado 7).
- **Plazo**: mientras la cuenta esté activa; tras la baja, [30 días / 6 meses] salvo obligación legal (política, apartado 8).
- **Medidas**: cifrado en tránsito y en reposo, RLS por empresa en toda tabla, contraseña mínima de 8 con mayúscula, minúscula y número y rechazo de contraseñas filtradas, PKCE en los flujos de acceso, sesiones limitadas a 30 días, registro de auditoría de altas, bajas y cambios de rol.

### A2. Facturación y pago
- **Finalidad**: cobrar el servicio y cumplir la normativa fiscal. Base: contrato (6.1.b) y obligación legal (6.1.c).
- **Datos**: identificación fiscal de la empresa, importes, estado de la suscripción. Los datos de tarjeta o cuenta los trata Stripe directamente; aquí solo llega el identificador de cliente y el estado.
- **Plazo**: 4 años (Ley General Tributaria) y 6 años (art. 30 del Código de Comercio).

### A3. Conexión con Google Calendar
- **Finalidad**: leer las horas ocupadas del anfitrión y escribir en su calendario las entrevistas que agenda. Base: consentimiento de la persona al conectar (6.1.a), revocable desde Ajustes.
- **Datos**: identidad de la cuenta de Google, token de acceso (en el vault cifrado de la base, nunca en una tabla), franjas ocupadas (sin título ni asistentes), eventos que creamos nosotros.
- **Destinatario**: Google Ireland Ltd. **El candidato nunca va como invitado del evento**; su nombre aparece en el título del evento del anfitrión.

### A4. Soporte
- **Finalidad**: atender consultas. Base: contrato (6.1.b) e interés legítimo (6.1.f) en las consultas anónimas desde la web.
- **Datos**: correo, nombre opcional, mensaje, página desde la que se escribe.
- **Plazo**: hasta 5 años (art. 1964 del Código Civil), política apartado 8.

## B. Tratamientos como ENCARGADO (por cuenta de cada empresa cliente)

### B1. Candidaturas
- **Responsable**: cada empresa cliente que publica un puesto. **Instrucciones**: las condiciones del encargo de la política (apartados 5, 6 y 11) y los Términos; contrato de encargo firmado a petición.
- **Finalidad del responsable**: seleccionar personal para el puesto publicado. El candidato acepta al enviar el formulario un texto versionado (`candidates.consent_version`, con fecha puesta por el servidor).
- **Interesados**: personas que se apuntan a un puesto. Menores: la política los excluye (apartado 14).
- **Datos**: los que pida el formulario de cada empresa (nombre, teléfono, correo, respuestas a las preguntas del puesto) y, si lo adjunta, el CV y otros documentos (bucket privado `cvs`, 8 MiB por fichero). Notas, etiquetas y estado que anota el equipo de la empresa. Entrevistas agendadas. Si la empresa lo usa, la lectura de Meridian (resumen y ajuste al puesto, sin decidir nada).
- **Subencargados** (política, apartado 6): Supabase (datos y ficheros, eu-west-3), Vercel (formulario público; no guarda candidaturas), Resend (aviso a la empresa con nombre y teléfono del candidato), OpenAI (solo con Meridian: respuestas y texto del CV, sin correo ni teléfono; sin entrenamiento; registros hasta 30 días), Google (nombre del candidato en el título del evento del calendario del anfitrión, solo si conecta su calendario).
- **Transferencias**: las de los subencargados de fuera de la UE con cláusulas contractuales tipo, por cuenta del responsable (política, apartado 7).
- **Plazo**: lo decide la empresa. Herramientas que le damos: eliminación de cualquier candidatura desde su panel, que borra también los ficheros (con 15 minutos para deshacer); borrado automático opcional de las candidaturas de un proceso a los 12 meses de cerrarlo, sin tocar a las personas contratadas; exportación completa. Lo suprimido permanece en las copias de seguridad del proveedor hasta 7 días. Al terminar el servicio, devolución o supresión según elija la empresa.
- **Derechos**: los atiende la empresa responsable; la plataforma le traslada sin demora lo que reciba (política, apartado 9) y le da la herramienta para cumplirlos (eliminar, exportar, editar).
- **Medidas**: las de A1 más: acceso al formulario solo por RPC (el rol anónimo no lee ninguna tabla), ficheros legibles solo por miembros de la empresa con el puesto visible, tope de tamaño y cuota de altas por puesto y hora, registro de auditoría de las purgas.
- **Decisiones automatizadas**: ninguna. Meridian es una lectura asistida que no descarta ni ordena por su cuenta; se informa en la política (apartado 10). [Revisar cuando entre en vigor la obligación del Reglamento de IA para sistemas de selección, prevista para diciembre de 2027.]

### B2. Comprobación de interés y entrevistas
- **Finalidad**: preguntar al candidato si sigue interesado y agendar entrevistas, por cuenta de la empresa. Base del responsable: el mismo proceso de selección.
- **Datos**: los de B1 más la respuesta de interés (token de un solo uso, hasheado) y las citas.
- **Canales**: correo (Resend). El canal de WhatsApp se retiró en septiembre de 2026 y no se envía nada por él.

## C. Medidas de seguridad comunes (art. 32)
- Cifrado en tránsito (TLS) y en reposo (proveedor). Aislamiento por empresa con políticas de fila en todas las tablas y en el almacenamiento de ficheros.
- Secretos de integración fuera del repositorio y del cliente; el token de Google en el vault cifrado.
- Firma verificada en todos los webhooks entrantes (Stripe, Resend, latido interno).
- Copias de seguridad diarias del proveedor con 7 días de retención (sin recuperación a un punto en el tiempo). [Prueba de restauración: pendiente.]
- Auditoría de seguridad de septiembre de 2026 con sus doce medidas aplicadas.

## D. Brechas de seguridad
Procedimiento de la política (apartado 13): aviso a la empresa responsable sin dilación indebida cuando afecte a candidatos; notificación a la AEPD en 72 horas cuando afecte a datos de los que somos responsables y haya riesgo. [Persona que decide y canal de aviso: rellenar.]

---
Revisado por última vez: [fecha]. Se revisa al añadir un subencargado, una finalidad o un tipo de dato.

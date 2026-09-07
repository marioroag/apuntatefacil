// Documentos legales de Apúntate Fácil (privacidad y términos).
//
// Revisión (sep 2026): retirado META de la lista de subencargados. Se apoyaba
// en el asistente de WhatsApp, que ya no existe, así que la plataforma no le
// manda nada. Un subencargado listado que no trata ningún dato es una lista de
// proveedores que no dice la verdad, y el Anexo de Encargo (art. 28) tampoco lo
// nombraba: ahora los dos dicen lo mismo.
//
// PENDIENTE al registrar la empresa (jul 2026): firmar el DPA de OpenAI y
// añadir aquí la frase de que está suscrito. Hoy NO se afirma, porque todavía
// no hay entidad que pueda firmarlo. Lo que sí se afirma es verdad por defecto
// en la API de OpenAI: no se entrena con estos datos y la retención es de hasta
// 30 días. La retención cero exige aprobación previa y contrato enterprise, así
// que NO se promete. El apartado 6 promete avisar antes de añadir un
// subencargado: con más de un cliente, usar AVISO-SUBENCARGADO-OPENAI.md.
// Privacidad: revisada y ampliada por panel experto RGPD/LOPDGDD (20 jun 2026).
// Revisión 1.1 (17 jul 2026), tras cotejar el texto con el producto real:
// declarada la analítica sin cookies (Vercel Analytics + Speed Insights) y Vercel
// como proveedor y transferencia a EEUU; añadidos miembros de equipo e
// invitaciones, buzón de soporte (soporte@), tablón de Equipo y etiquetas; plan
// de Prueba incluido en la enumeración. Términos: corregida la contradicción del
// "no hay plan gratuito" (existe el plan de Prueba con candidaturas bloqueadas
// al superar el tope, jul 2026).
// Términos: reforzados por un panel de defensa (prestador-side) + revisor de
// ejecutabilidad/nulidad (20 jun 2026), para proteger al prestador dentro de lo
// VÁLIDO en Derecho B2B español: exención de garantías y "tal cual"/sin SLA,
// límite de responsabilidad con dolo/culpa grave a salvo, indemnidad del cliente,
// repercusión y regreso del art. 82.5 RGPD (reparto interno, sin excluir la
// solidaridad frente al candidato), morosidad (Ley 3/2004), PI con la salvedad
// imperativa del art. 100 TRLPI, y un Anexo de Encargo del Tratamiento (art. 28).
//
// PENDIENTE antes de publicar (esto NO es asesoramiento legal; revisar con abogado):
//  - Rellenar SOLERA CANARIAS TÉCNICA, S.L., B-13789649, calle Quiquirá Bajo, 1, 38300 La Orotava, Santa Cruz de Tenerife (España), eu-west-3 (París, Francia).
//  - Validar con abogado colegiado: tope de responsabilidad, indemnidad y
//    repercusión de sanciones AEPD (solo parte imputable al cliente), jurisdicción,
//    y la suficiencia del Anexo de Encargo (art. 28) frente a clientes con DPO.
//  - Verificar los DPA y garantías de transferencia internacional vigentes.

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

export type LegalSection = { heading: string; blocks: LegalBlock[] }

export type LegalDoc = {
  slug: string
  title: string
  intro: string
  sections: LegalSection[]
}

export const PRIVACY_DOC: LegalDoc = {
  "slug": "privacidad",
  "title": "Política de privacidad",
  "intro": "En Apúntate Fácil nos tomamos en serio tu privacidad y la de las personas que se postulan a tus ofertas. En esta política te contamos, sin rodeos, qué datos personales tratamos, para qué, con qué base legal, con quién los compartimos y qué derechos tienes. Está dirigida tanto a las empresas y profesionales que contratan nuestro servicio como a los candidatos que rellenan los formularios públicos. Está redactada conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).",
  "sections": [
    {
      "heading": "1. Quién es el responsable del tratamiento",
      "blocks": [
        {
          "type": "p",
          "text": "El responsable del tratamiento de los datos de las cuentas de empresa cliente es Apúntate Fácil, titularidad de SOLERA CANARIAS TÉCNICA, S.L., con NIF B-13789649 y domicilio en calle Quiquirá Bajo, 1, 38300 La Orotava, Santa Cruz de Tenerife (España). Apúntate Fácil presta un servicio en la nube (SaaS) que permite a empresas y profesionales publicar ofertas de empleo, recibir candidaturas a través de un formulario corto y gestionarlas en un panel filtrable que pueden exportar a Excel."
        },
        {
          "type": "p",
          "text": "Para cualquier cuestión relacionada con esta política o con el tratamiento de tus datos puedes escribirnos a privacidad@apuntatefacil.com. Atendemos las solicitudes en lenguaje claro y sin papeleo innecesario."
        },
        {
          "type": "p",
          "text": "Por nuestro tamaño y por la naturaleza de nuestra actividad no estamos obligados a designar un Delegado de Protección de Datos y, por ahora, no hemos designado uno. Aun así, puedes plantear cualquier cuestión de privacidad en privacidad@apuntatefacil.com, que es nuestro canal específico para protección de datos. Si en algún momento designamos un Delegado de Protección de Datos, publicaremos aquí sus datos de contacto."
        },
        {
          "type": "p",
          "text": "Importante: cuando hablamos de los datos de los candidatos, el responsable del tratamiento NO es Apúntate Fácil, sino la empresa cliente que publica la oferta. En ese caso Apúntate Fácil actúa como encargado del tratamiento. Lo explicamos en detalle en el apartado 5."
        },
        {
          "type": "p",
          "text": "Esta política se complementa con los Términos del servicio, que regulan la contratación y el uso de la plataforma. Conviene leer ambos documentos como un conjunto."
        }
      ]
    },
    {
      "heading": "2. A quién se dirige esta política",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil es un servicio entre empresas (B2B). Distinguimos dos grupos de personas cuyos datos se tratan a través de la plataforma, con roles legales diferentes:"
        },
        {
          "type": "ul",
          "items": [
            "Empresa cliente: la empresa o profesional autónomo que se registra, contrata un plan y usa el panel para gestionar sus procesos de selección. De sus datos somos responsables nosotros.",
            "Candidatos: las personas que responden a una oferta y rellenan el formulario público con sus datos (nombre, teléfono y los campos que cada empresa configure). De sus datos es responsable la empresa cliente que publicó la oferta; nosotros solo los procesamos por cuenta de esa empresa."
          ]
        },
        {
          "type": "p",
          "text": "Si eres un candidato y quieres ejercer tus derechos o saber por qué se tratan tus datos, debes dirigirte en primer lugar a la empresa que publicó la oferta a la que te postulaste, porque es la responsable. Nosotros te ayudaremos a redirigir tu solicitud si lo necesitas, como te explicamos en el apartado 9."
        }
      ]
    },
    {
      "heading": "3. Qué datos tratamos, de quién y de dónde proceden",
      "blocks": [
        {
          "type": "p",
          "text": "Tratamos únicamente los datos necesarios para prestar el servicio. No pedimos datos de más ni hacemos perfiles comerciales. Estos son los datos según el grupo de personas:"
        },
        {
          "type": "p",
          "text": "a) Datos de la cuenta de empresa cliente (responsable: Apúntate Fácil):"
        },
        {
          "type": "ul",
          "items": [
            "Email y contraseña de cada persona de tu equipo con acceso a la cuenta (con los que accede, o bien entra con su cuenta de Google). La contraseña se guarda siempre cifrada, nunca en claro.",
            "Email de las personas que invitas a unirse a tu equipo y estado de la invitación, para poder enviarles el enlace de alta.",
            "Nombre o razón social de la empresa.",
            "Color o acento de marca y color que identifica a cada miembro del equipo dentro del panel, como personalización visual.",
            "Plan de la cuenta (Prueba, Esencial, Pro o Multi) y estado de la suscripción.",
            "Mensajes de soporte que intercambias con nosotros, desde el panel o por email a soporte@apuntatefacil.com: su contenido, tu dirección y las fechas, para poder atenderte y seguir el hilo de la conversación.",
            "Contenido interno que tu equipo escribe en el panel, como las peticiones y comentarios del tablón de Equipo.",
            "Identificadores de cliente y de suscripción en Stripe, que conectan tu cuenta con tu pago.",
            "Los datos de pago (tarjeta, titularidad, facturación) los recoge y custodia directamente Stripe; nosotros no almacenamos el número de tu tarjeta."
          ]
        },
        {
          "type": "p",
          "text": "b) Datos de las candidaturas (responsable: la empresa cliente; encargado: Apúntate Fácil):"
        },
        {
          "type": "ul",
          "items": [
            "Nombre del candidato y teléfono.",
            "Email del candidato. Los formularios nuevos lo solicitan por defecto, aunque la empresa puede hacerlo opcional o eliminarlo.",
            "Campos personalizados que cada empresa decida pedir: experiencia, carnet, zona, disponibilidad o cualquier otro que configure en su formulario.",
            "Archivo adjunto opcional, como un CV o documento, almacenado en un espacio privado.",
            "Respuestas a las preguntas del formulario, respuesta a las comprobaciones de interés y fechas de envío o respuesta, estado de la candidatura (nuevo, contactado, entrevista, contratado, descartado), calificación de 0 a 3 estrellas, etiquetas, y notas internas o comentarios sobre la candidatura que escriba la empresa, por ejemplo en el tablón de Equipo. Esas señales, calificaciones y estados los inicia o usa una persona de la empresa, no un algoritmo: lo aclaramos en el apartado 6.",
            "Fuente de la candidatura (por ejemplo la web de empleo donde publiques, como Milanuncios, un enlace o un QR) y fecha y hora de envío."
          ]
        },
        {
          "type": "p",
          "text": "Origen de los datos. Los datos de tu cuenta de empresa nos los facilitas tú directamente al registrarte y contratar. Los datos de los candidatos los aporta directamente cada candidato al rellenar el formulario público. Si una empresa cliente carga o reenvía datos de candidatos por otra vía, esa empresa es la responsable de que el candidato haya sido informado y de la licitud de ese origen."
        },
        {
          "type": "p",
          "text": "Apúntate Fácil no decide qué campos se piden a los candidatos ni para qué se usan: eso lo configura cada empresa cliente. Te pedimos que, como empresa, no solicites a los candidatos más datos de los que de verdad necesites para el puesto."
        }
      ]
    },
    {
      "heading": "4. Para qué tratamos los datos y con qué base legítima",
      "blocks": [
        {
          "type": "p",
          "text": "Cada tratamiento tiene una finalidad concreta y una base de legitimación del artículo 6 del RGPD. Estas son las nuestras como responsable de la cuenta de empresa cliente:"
        },
        {
          "type": "ul",
          "items": [
            "Dar de alta tu cuenta y permitirte acceder con tu email y contraseña, o con tu cuenta de Google, incluido el envío del email de confirmación al registrarte y, si lo pides, del email para restablecer la contraseña. Base: ejecución del contrato de prestación del servicio que aceptas al registrarte (art. 6.1.b RGPD).",
            "Gestionar la facturación y el cobro de tu suscripción a través de Stripe. Base: ejecución del contrato (art. 6.1.b) y cumplimiento de obligaciones legales fiscales y contables (art. 6.1.c RGPD).",
            "Enviarte emails operativos imprescindibles: aviso de nueva candidatura y avisos de tu suscripción (activación, renovación, cancelación). Base: ejecución del contrato (art. 6.1.b), ya que son comunicaciones necesarias para usar el servicio, no publicidad. El aviso de nueva candidatura incluye el nombre y el teléfono del candidato; respecto a esos datos de candidato actuamos como encargado y los enviamos siguiendo tus instrucciones como empresa responsable, no para fines propios.",
            "Prestar soporte y responder a tus consultas sobre el uso del servicio que has contratado, desde el panel o por email a soporte@apuntatefacil.com. Base: ejecución del contrato (art. 6.1.b RGPD).",
            "Atender consultas previas a la contratación o no estrictamente contractuales. Base: nuestro interés legítimo en ofrecerte una buena atención (art. 6.1.f RGPD).",
            "Medir de forma agregada el uso y el rendimiento de la web con una analítica sin cookies (Vercel Analytics y Speed Insights): cuenta páginas vistas y tiempos de carga, sin cookies ni identificadores que te sigan entre sitios, y no nos permite identificarte. Base: interés legítimo en saber si el servicio funciona bien y mejorarlo (art. 6.1.f RGPD).",
            "Mantener la seguridad de la plataforma y prevenir abusos o fraudes. Base: interés legítimo en proteger el servicio y a sus usuarios (art. 6.1.f RGPD)."
          ]
        },
        {
          "type": "p",
          "text": "Conservamos los datos de facturación durante los plazos que nos exige la normativa fiscal y mercantil, aunque te des de baja, por una obligación legal (art. 6.1.c RGPD). Lo detallamos en el apartado 8."
        },
        {
          "type": "p",
          "text": "Hoy no enviamos comunicaciones comerciales ni newsletters a partir de los datos de tu cuenta. Si en el futuro quisiéramos enviarte novedades del producto, lo haríamos solo con tu consentimiento previo (art. 6.1.a RGPD y art. 21 de la LSSI), que podrías retirar en cualquier momento con un clic en el propio email, sin que ello afecte al servicio que tienes contratado. No usamos tus datos para publicidad ni los vendemos a nadie."
        },
        {
          "type": "p",
          "text": "Respecto a los datos de los candidatos, Apúntate Fácil no fija la finalidad ni la base de legitimación: lo hace la empresa cliente como responsable. La empresa es quien debe tener una base legal válida (normalmente la ejecución de medidas precontractuales a petición del candidato, su consentimiento o el interés legítimo del proceso de selección) y quien debe informar a los candidatos. Nosotros solo procesamos esos datos siguiendo sus instrucciones para que pueda gestionar la selección, incluida la comprobación manual de si una persona sigue interesada en un puesto."
        }
      ]
    },
    {
      "heading": "5. El doble rol responsable / encargado y qué significa en la práctica",
      "blocks": [
        {
          "type": "p",
          "text": "Este es el punto más importante de esta política, así que lo explicamos sin tecnicismos."
        },
        {
          "type": "p",
          "text": "Sobre los datos de tu cuenta de empresa (email, nombre, plan, pagos) somos nosotros, Apúntate Fácil, el responsable: decidimos cómo se tratan y respondemos de ellos ante ti y ante la ley."
        },
        {
          "type": "p",
          "text": "Sobre los datos de los candidatos somos un encargado del tratamiento. Esto quiere decir que esos datos son tuyos como empresa cliente: tú eres la responsable, tú decides para qué se usan y tú informas a los candidatos. Nosotros solo somos la herramienta: guardamos y procesamos esos datos por cuenta tuya, siguiendo únicamente tus instrucciones, sin darles ningún otro uso, sin cederlos a terceros por nuestra cuenta y sin emplearlos para fines propios."
        },
        {
          "type": "p",
          "text": "En la práctica, como encargado nos comprometemos a:"
        },
        {
          "type": "ul",
          "items": [
            "Tratar los datos de candidatos solo para prestarte el servicio y conforme a tus instrucciones documentadas.",
            "Guardar confidencialidad y exigir lo mismo a quien tenga acceso a los datos.",
            "Aplicar medidas de seguridad apropiadas (las del apartado 11).",
            "Ayudarte a responder a las solicitudes de derechos de los candidatos y a tus obligaciones de seguridad y notificación de brechas.",
            "Recurrir solo a los subencargados que aparecen en el apartado 6, avisarte por anticipado si queremos añadir o sustituir alguno y respetar tu derecho a oponerte.",
            "Devolverte o suprimir los datos de candidatos cuando termine el servicio, según tu elección."
          ]
        },
        {
          "type": "p",
          "text": "El registro y la aceptación del servicio incluyen las condiciones del encargo de tratamiento exigidas por el artículo 28 del RGPD, que se recogen en esta Política de Privacidad (en especial en este apartado y en los apartados 6 y 11) y en los Términos del servicio. Si necesitas un acuerdo de encargado del tratamiento firmado aparte para tu documentación, escríbenos a privacidad@apuntatefacil.com y te lo facilitamos."
        }
      ]
    },
    {
      "heading": "6. Destinatarios y subencargados del tratamiento (proveedores)",
      "blocks": [
        {
          "type": "p",
          "text": "No vendemos tus datos ni los de los candidatos, y no los cedemos a terceros salvo obligación legal. Para funcionar, la plataforma se apoya en un número reducido de proveedores que actúan como encargados del tratamiento (o subencargados, cuando se trata de datos de candidatos de los que la responsable eres tú) y que solo tratan los datos para prestarnos su servicio. Esta es la lista vigente de proveedores:"
        },
        {
          "type": "ul",
          "items": [
            "Stripe (Stripe, Inc.): procesa los pagos. Gestiona el cobro de tu suscripción según tu plan (185, 237 o 533 EUR más IVA), emite facturas y trata los datos de pago y facturación.",
            "Resend (Resend, Inc.): envía los emails transaccionales y los de acceso. Manda el aviso al responsable de la empresa cuando entra una nueva candidatura (ese email incluye el nombre y el teléfono del candidato), las comprobaciones de interés que la empresa decide enviar a candidatos, los avisos de suscripción y los emails de confirmación de cuenta o restablecimiento de contraseña. Las comprobaciones de interés no incorporan seguimiento de aperturas ni de clics por parte de Apúntate Fácil.",
            "Supabase (Supabase, Inc.): es la infraestructura. Aloja la base de datos con las tablas de empresas, candidatos, puestos y campañas, gestiona la autenticación y las sesiones, y almacena los CV y documentos adjuntos en un espacio de archivos privado. Los datos se alojan en la región eu-west-3 (París, Francia).",
            "Vercel (Vercel, Inc.): aloja y sirve la aplicación web, es decir, las páginas que se cargan en el navegador, incluido el formulario público que rellenan los candidatos. Como cualquier servidor web, procesa datos técnicos de conexión (dirección IP, navegador) para entregar las páginas, y nos proporciona la medición de audiencia y rendimiento sin cookies descrita en el apartado 4, con datos agregados.",
            "Google (Google LLC): interviene en dos funciones opcionales. Si eliges entrar con tu cuenta de Google, trata tu email conforme a sus propias políticas, como responsable independiente de ese dato de inicio de sesión. Y si conectas tu Google Calendar, tratamos los datos de tu calendario según se detalla en el apartado 15. Si entras con email y contraseña y no conectas ningún calendario, Google no interviene.",
            "OpenAI (OpenAI Ireland Ltd.): solo en los planes Pro y Multi, y solo si tu empresa usa Meridian. Es el modelo de lenguaje que resume cada candidatura, calcula su ajuste al puesto y responde a lo que le preguntas en el panel. Le enviamos las respuestas del formulario y, cuando el candidato lo adjunta, el texto de su CV, que puede contener datos de contacto y trayectoria. NO le enviamos el correo ni el teléfono que el candidato escribe en el formulario, ni el archivo del CV en sí. Meridian nunca decide ni descarta por su cuenta: solo resume y ordena, y cualquier acción la confirmas tú. Estos datos no se usan para entrenar los modelos de OpenAI. OpenAI conserva las llamadas hasta 30 días en registros de detección de abusos y después las elimina, salvo que la ley le obligue a guardarlas más tiempo."
          ]
        },
        {
          "type": "p",
          "text": "Esta es la lista actual de subencargados que intervienen en el tratamiento de los datos de candidatos. Si en el futuro queremos añadir o sustituir un subencargado, te lo comunicaremos con antelación razonable, por ejemplo por email a la dirección de tu cuenta o mediante un aviso en la plataforma, antes de que el cambio entre en vigor. Si no estás de acuerdo con el nuevo subencargado por motivos razonables de protección de datos, podrás comunicárnoslo; si no encontramos una solución, podrás dar de baja el servicio sin penalización."
        },
        {
          "type": "p",
          "text": "Con cada uno de estos proveedores tenemos suscrito un contrato de encargado del tratamiento conforme al artículo 28 del RGPD, que les obliga a tratar los datos solo siguiendo nuestras instrucciones, a guardar confidencialidad y a aplicar medidas de seguridad adecuadas. Puedes solicitarnos la lista actualizada de proveedores escribiendo a privacidad@apuntatefacil.com."
        },
        {
          "type": "p",
          "text": "También podemos comunicar datos a las autoridades públicas, juzgados o cuerpos de seguridad cuando exista una obligación legal de hacerlo. Fuera de eso, nadie más accede a tus datos."
        }
      ]
    },
    {
      "heading": "7. Transferencias internacionales de datos",
      "blocks": [
        {
          "type": "p",
          "text": "Procuramos que los datos se alojen dentro del Espacio Económico Europeo. Nuestra infraestructura de base de datos y almacenamiento (Supabase) está configurada en la región eu-west-3 (París, Francia)."
        },
        {
          "type": "p",
          "text": "Algunos proveedores son compañías con sede o infraestructura en Estados Unidos, por lo que ciertos tratamientos pueden implicar una transferencia internacional de datos fuera del EEE. En concreto, Stripe, Resend, Vercel y Google pueden tratar datos en Estados Unidos."
        },
        {
          "type": "p",
          "text": "En todos los casos en que un proveedor trate datos fuera del EEE, nos aseguramos de que la transferencia esté amparada por una garantía válida y vigente del Capítulo V del RGPD, normalmente las Cláusulas Contractuales Tipo aprobadas por la Comisión Europea y, cuando el proveedor está adherido, el EU-U.S. Data Privacy Framework. Puedes pedirnos copia o referencia de las garantías aplicables a cada proveedor escribiendo a privacidad@apuntatefacil.com."
        },
        {
          "type": "p",
          "text": "En relación con los datos de candidatos, cualquier transferencia internacional realizada por nuestros subencargados se efectúa por cuenta de tu empresa como responsable y bajo la autorización que aceptas al contratar el servicio, con las mismas garantías del Capítulo V del RGPD descritas arriba."
        }
      ]
    },
    {
      "heading": "8. Cuánto tiempo conservamos los datos",
      "blocks": [
        {
          "type": "p",
          "text": "Conservamos los datos solo el tiempo necesario para la finalidad por la que se trataron y para cumplir nuestras obligaciones legales:"
        },
        {
          "type": "ul",
          "items": [
            "Datos de tu cuenta de empresa: mientras tengas la cuenta activa. Si te das de baja, eliminamos o anonimizamos los datos de tu cuenta en un plazo máximo de [30 días / 6 meses] desde la cancelación efectiva, salvo lo que debamos conservar por ley.",
            "Datos de facturación y pago: durante los plazos exigidos por la normativa. Con carácter general, 4 años conforme a la Ley General Tributaria (Ley 58/2003) y 6 años conforme al artículo 30 del Código de Comercio, contados desde la última operación o el cierre del ejercicio correspondiente.",
            "Datos de los candidatos: se conservan mientras prestamos el servicio a la empresa responsable y según las instrucciones de esa empresa. La empresa cliente decide cuándo se borran; cuando finaliza el servicio, te devolvemos o suprimimos los datos de candidatos según tu elección.",
            "Datos de soporte y comunicaciones: el tiempo necesario para atender tu consulta y, después, mientras pueda existir responsabilidad derivada de ella, normalmente hasta 5 años conforme al artículo 1964 del Código Civil."
          ]
        },
        {
          "type": "p",
          "text": "Pasados esos plazos, bloqueamos los datos mientras puedan derivarse responsabilidades legales y después los suprimimos de forma segura."
        }
      ]
    },
    {
      "heading": "9. Tus derechos sobre tus datos",
      "blocks": [
        {
          "type": "p",
          "text": "La normativa de protección de datos te reconoce una serie de derechos que puedes ejercer de forma gratuita:"
        },
        {
          "type": "ul",
          "items": [
            "Acceso: saber qué datos tuyos tratamos y obtener una copia.",
            "Rectificación: corregir datos inexactos o incompletos.",
            "Supresión (derecho al olvido): pedir que borremos tus datos cuando ya no sean necesarios.",
            "Oposición: oponerte a un tratamiento basado en nuestro interés legítimo.",
            "Limitación: pedir que suspendamos el tratamiento en ciertos casos, conservando los datos sin usarlos.",
            "Portabilidad: recibir tus datos en un formato estructurado y de uso común, o que los enviemos a otro proveedor cuando sea técnicamente posible.",
            "Retirar el consentimiento en cualquier momento, cuando el tratamiento se base en él, sin que afecte a lo ya realizado."
          ]
        },
        {
          "type": "p",
          "text": "Si eres empresa cliente, puedes ejercer estos derechos escribiendo a privacidad@apuntatefacil.com, indicando qué derecho quieres ejercer. Podremos pedirte que acredites tu identidad. Responderemos en el plazo máximo de un mes, ampliable en casos complejos."
        },
        {
          "type": "p",
          "text": "El ejercicio de estos derechos es gratuito. Solo si una solicitud es manifiestamente infundada o excesiva, en particular por repetitiva, podremos cobrar un canon razonable o negarnos a actuar, explicándote siempre el motivo, conforme al artículo 12.5 del RGPD."
        },
        {
          "type": "p",
          "text": "Si eres candidato, recuerda que la responsable de tus datos es la empresa que publicó la oferta: dirige tu solicitud a esa empresa. Si nos escribes a privacidad@apuntatefacil.com para ejercer un derecho, no podemos resolverlo nosotros porque no somos la responsable de tus datos, pero sin demora trasladaremos tu solicitud a la empresa que publicó la oferta e intentaremos indicarte con quién debes contactar, para que pueda atenderte dentro del plazo de un mes que marca el RGPD."
        },
        {
          "type": "p",
          "text": "Además, como empresa cliente tienes a tu disposición una herramienta de autoservicio: puedes exportar tus candidatos a Excel desde el panel en cualquier momento, sin tener que pedírnoslo."
        },
        {
          "type": "p",
          "text": "Si consideras que no hemos atendido bien tu solicitud, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD), conforme al artículo 77 del RGPD, en www.aepd.es o en su sede de la calle Jorge Juan 6, 28001 Madrid. Antes, si quieres, puedes contactarnos para intentar resolverlo."
        }
      ]
    },
    {
      "heading": "10. Decisiones automatizadas y elaboración de perfiles",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil no toma decisiones automatizadas que produzcan efectos jurídicos sobre los candidatos ni les afecten de modo similarmente significativo, y tampoco elabora perfiles automáticos de los candidatos."
        },
        {
          "type": "p",
          "text": "La calificación de 0 a 3 estrellas, los estados de la candidatura y los filtros del panel son simples herramientas de organización: las introduce y las usa una persona de la empresa cliente, que es quien decide a quién contacta, entrevista o contrata. La plataforma no puntúa, clasifica ni descarta candidatos de forma automática, y no cruzamos sus datos con fuentes externas. La decisión final siempre la toma una persona de la empresa responsable."
        },
        {
          "type": "p",
          "text": "Si como empresa cliente decides usar la puntuación o cualquier otra función para automatizar decisiones de selección, te corresponde a ti, como responsable, cumplir el artículo 22 del RGPD frente a los candidatos. Si en el futuro añadiéramos alguna función de cribado automático, te lo informaríamos y aplicaríamos las garantías que exige ese artículo."
        }
      ]
    },
    {
      "heading": "11. Acceso a tu cuenta y cookies",
      "blocks": [
        {
          "type": "p",
          "text": "Para acceder a Apúntate Fácil eliges una contraseña al registrarte con tu email, o entras con tu cuenta de Google (botón 'Continuar con Google'). Si te registras con email, te pedimos que lo confirmes pulsando un enlace que te enviamos, para verificar que es tuyo. Tu contraseña se guarda siempre cifrada (con el algoritmo bcrypt); nunca la vemos ni la guardamos en claro."
        },
        {
          "type": "p",
          "text": "Sobre cookies y rastreo: no usamos cookies de seguimiento ni de publicidad. No tenemos Google Analytics, ni Mixpanel, ni Segment, ni ninguna herramienta que te siga por internet o elabore un perfil de tu comportamiento. La única medición que hacemos es la analítica sin cookies de Vercel (Analytics y Speed Insights) descrita en el apartado 4: cuenta páginas vistas y tiempos de carga de forma agregada, no guarda nada en tu dispositivo, no usa identificadores que te sigan entre sitios y no nos permite identificarte."
        },
        {
          "type": "p",
          "text": "Solo usamos el almacenamiento imprescindible para que funcione el servicio. En concreto, Supabase guarda en tu navegador (en memoria y, si eliges que te recordemos, en localStorage) un token de sesión para mantenerte identificado y refrescar tu sesión mientras la usas. Además guardamos en localStorage pequeñas preferencias de uso del panel, como la empresa activa, tu elección de recordar o no la sesión y los avisos que ya has cerrado. En la demo pública, sin login real, solo guardamos en localStorage el estado de ejemplo para que puedas probar la herramienta. Nada de esto rastrea tu navegación ni te perfila."
        },
        {
          "type": "p",
          "text": "Este almacenamiento es técnicamente imprescindible para el inicio de sesión y el funcionamiento del panel, por lo que está exento del deber de consentimiento conforme al artículo 22.2 de la LSSI-CE (Ley 34/2002) y a las directrices de la AEPD sobre cookies. Su base jurídica es la ejecución del contrato (art. 6.1.b RGPD). La medición de audiencia, por su parte, no guarda nada en tu dispositivo, así que tampoco requiere ese consentimiento. Por eso no usamos un banner de consentimiento de cookies."
        }
      ]
    },
    {
      "heading": "12. Medidas de seguridad",
      "blocks": [
        {
          "type": "p",
          "text": "Aplicamos medidas técnicas y organizativas apropiadas para proteger los datos frente a accesos no autorizados, pérdida o alteración:"
        },
        {
          "type": "ul",
          "items": [
            "Cifrado en tránsito (HTTPS/TLS) en todas las comunicaciones con la plataforma.",
            "Acceso con email y contraseña, que se guarda cifrada (bcrypt) y nunca en claro, con una longitud y complejidad mínimas obligatorias y rechazo de contraseñas que aparecen en filtraciones conocidas; o con tu cuenta de Google.",
            "Los CV y documentos adjuntos se guardan en un espacio de archivos privado, no accesible públicamente; solo los miembros autenticados de la empresa pueden descargarlos.",
            "Control de acceso por roles y aislamiento de los datos de cada empresa dentro de la base de datos.",
            "Registro de la actividad de acceso a la plataforma, que permite detectar y revisar accesos indebidos.",
            "Copias de seguridad periódicas gestionadas por nuestro proveedor de infraestructura, para poder recuperar los datos ante una incidencia.",
            "Uso de proveedores de infraestructura y pago (Supabase, Vercel, Stripe) que mantienen estándares reconocidos de seguridad.",
            "Principio de minimización: pedimos y guardamos solo los datos necesarios."
          ]
        },
        {
          "type": "p",
          "text": "Ninguna medida ofrece seguridad absoluta, pero trabajamos para mantenerlas actualizadas y llevamos un registro interno de las incidencias de seguridad que se produzcan."
        }
      ]
    },
    {
      "heading": "13. Qué hacemos si se produce una brecha de seguridad",
      "blocks": [
        {
          "type": "p",
          "text": "Si se produce una brecha de seguridad (una violación que afecte a datos personales), actuamos según nuestro papel:"
        },
        {
          "type": "p",
          "text": "Cuando la brecha afecte a datos de candidatos, de los que tu empresa es la responsable, te avisaremos a ti sin dilación indebida en cuanto tengamos constancia, con la información de que dispongamos (naturaleza de la brecha, datos y candidatos afectados de forma aproximada, posibles consecuencias y medidas adoptadas), para que decidas si procede notificar a la Agencia Española de Protección de Datos y, en su caso, a los candidatos afectados."
        },
        {
          "type": "p",
          "text": "Cuando la brecha afecte a los datos de tu cuenta de empresa, de los que somos responsables, la notificaremos a la Agencia Española de Protección de Datos en un plazo máximo de 72 horas desde que tengamos constancia, siempre que suponga un riesgo para tus derechos, y te informaremos a ti si el riesgo es alto."
        }
      ]
    },
    {
      "heading": "14. Menores de edad",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil es un servicio dirigido a empresas y profesionales, no a menores de edad. No está pensado para que lo usen menores ni recogemos datos de menores de forma consciente a través de las cuentas de empresa."
        },
        {
          "type": "p",
          "text": "Los formularios de candidatura están pensados para personas en edad de trabajar según la legislación laboral española, que con carácter general fija la edad mínima de admisión al trabajo en 16 años. Como empresa responsable, te corresponde no recoger candidaturas de menores de esa edad salvo en los supuestos legalmente admitidos y con las garantías que la ley exige, y asegurarte de que cumples los requisitos legales de edad para trabajar y de tratamiento de datos."
        },
        {
          "type": "p",
          "text": "Si detectamos que se han tratado datos de un menor sin la base adecuada, colaboraremos con la empresa responsable para subsanarlo."
        }
      ]
    },
    {
      "heading": "15. Conexión con Google Calendar",
      "blocks": [
        {
          "type": "p",
          "text": "Conectar tu Google Calendar es opcional y no hace falta para usar el servicio. Si no lo conectas, nada de este apartado te aplica. Lo describimos con detalle porque son datos de tu cuenta de Google y creemos que tienes que saber exactamente qué tocamos."
        },
        {
          "type": "p",
          "text": "Al conectarlo te pedimos dos permisos y ninguno más, y son los más estrechos que permiten hacer el trabajo:"
        },
        {
          "type": "ul",
          "items": [
            "Ver y editar eventos de tus calendarios (calendar.events): lo usamos para escribir en tu calendario las entrevistas que agendas en la aplicación, moverlas si las reprogramas y borrarlas si las cancelas. Solo creamos, modificamos y borramos los eventos que ha creado la propia aplicación, que identificamos por el identificador que guardamos al crearlos. No leemos, modificamos ni borramos ningún otro evento tuyo.",
            "Ver tu disponibilidad (calendar.freebusy): lo usamos para no ofrecer horas de entrevista que ya tengas ocupadas. Este permiso devuelve únicamente los tramos en los que estás ocupado, es decir una hora de inicio y una de fin. No devuelve títulos, descripciones, ubicaciones ni asistentes, y lo elegimos precisamente por eso, en lugar del permiso de lectura del calendario."
          ]
        },
        {
          "type": "p",
          "text": "Qué guardamos: la credencial que Google nos entrega para poder seguir actuando en tu nombre, cifrada en un almacén de secretos separado de la base de datos; la dirección de la cuenta de Google que has conectado, para poder enseñártela en Ajustes; y el identificador del evento que hemos creado para cada entrevista. NO guardamos el contenido de tu calendario: los tramos ocupados se consultan en el momento y no se almacenan."
        },
        {
          "type": "p",
          "text": "Con quién los compartimos: con nadie. Estos datos no se venden, no se ceden a terceros, no se usan para publicidad ni para elaborar perfiles, y no se emplean para entrenar modelos de inteligencia artificial, ni nuestros ni de nadie. Solo se usan para las dos funciones descritas arriba, que son las que tú has pedido al conectar el calendario."
        },
        {
          "type": "p",
          "text": "El uso que hacemos de la información recibida de las API de Google se ajusta a la Política de Datos de Usuario de los Servicios de las API de Google (Google API Services User Data Policy), incluidos sus requisitos de Uso Limitado (Limited Use)."
        },
        {
          "type": "p",
          "text": "Cómo se corta: desde Ajustes, en el bloque \"Tu calendario\", pulsando Desconectar. Al hacerlo retiramos el permiso en Google y borramos la credencial y la dirección de la cuenta. También puedes retirárnoslo tú desde la página de permisos de tu cuenta de Google. Los eventos que ya estén en tu calendario se quedan como están: son tuyos, y sin permiso no podríamos tocarlos aunque quisiéramos."
        }
      ]
    },
    {
      "heading": "16. Cambios en esta política",
      "blocks": [
        {
          "type": "p",
          "text": "Podemos actualizar esta política de privacidad para reflejar cambios en el servicio, en los proveedores que usamos o en la normativa aplicable. Cuando lo hagamos, actualizaremos la fecha de 'última actualización' que figura al principio."
        },
        {
          "type": "p",
          "text": "Si los cambios son relevantes y afectan a cómo tratamos tus datos, te avisaremos por un medio adecuado, por ejemplo por email a la dirección de tu cuenta o mediante un aviso visible en la plataforma, con antelación razonable antes de que entren en vigor. Te recomendamos revisar esta página de vez en cuando."
        },
        {
          "type": "p",
          "text": "Si tienes cualquier duda sobre esta política o sobre cómo tratamos tus datos, escríbenos a privacidad@apuntatefacil.com y te responderemos en lenguaje claro."
        }
      ]
    }
  ]
}

export const TERMS_DOC: LegalDoc = {
  "slug": "terminos",
  "title": "Términos del servicio",
  "intro": "Estos términos regulan el acceso y uso de Apúntate Fácil, el servicio de gestión de candidaturas que encontrarás en apuntatefacil.com. Es un servicio para empresas y profesionales (B2B): al contratarlo declaras que actúas en el marco de tu actividad económica y no como consumidor. Léelos con calma, porque al registrarte o usar el servicio aceptas todo lo que aquí se dice. Están escritos en español claro y de tú, pero son las condiciones legales completas del contrato entre tu empresa y nosotros.",
  "sections": [
    {
      "heading": "1. Quiénes somos y cómo contactarnos",
      "blocks": [
        {
          "type": "p",
          "text": "El servicio Apúntate Fácil lo presta SOLERA CANARIAS TÉCNICA, S.L., con NIF B-13789649 y domicilio en calle Quiquirá Bajo, 1, 38300 La Orotava, Santa Cruz de Tenerife (España) (en adelante, \"Apúntate Fácil\", \"nosotros\" o \"el prestador\"). Somos los titulares de la web apuntatefacil.com y de la plataforma que se ofrece a través de ella."
        },
        {
          "type": "p",
          "text": "Para cualquier asunto relacionado con estos términos, la contratación o el soporte, puedes escribirnos a hola@apuntatefacil.com. Para todo lo relativo a datos personales y privacidad, el canal es privacidad@apuntatefacil.com. Te contestamos por el mismo medio."
        },
        {
          "type": "p",
          "text": "Estos términos conviven con la Política de Privacidad y, en lo que afecta a los datos de tus candidatos, con el Anexo de Encargo del Tratamiento que figura al final de este documento. Donde estos textos se solapen, debes leerlos como un conjunto coherente."
        }
      ]
    },
    {
      "heading": "2. Qué es el servicio",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil es una herramienta para gestionar la contratación en pequeñas y medianas empresas. Tú publicas tu anuncio donde quieras (la web de empleo que prefieras, por ejemplo Milanuncios) y a quien responde le envías un enlace a un formulario corto. Cada candidatura entra ordenada en un panel filtrable que puedes exportar a Excel."
        },
        {
          "type": "p",
          "text": "Con el servicio puedes, entre otras cosas:"
        },
        {
          "type": "ul",
          "items": [
            "Crear y personalizar el formulario público de candidatura, con los campos que tú decidas (por ejemplo nombre, teléfono, carnet, zona, experiencia o disponibilidad).",
            "Recibir las candidaturas en un panel, filtrarlas, ordenarlas, puntuarlas y cambiar su estado (nuevo, contactado, entrevista, contratado, descartado).",
            "Recibir un aviso por email cuando entra una nueva candidatura.",
            "Seleccionar candidatos y enviarles una comprobación por email para saber si siguen interesados, mostrando la respuesta como una señal independiente del estado de la candidatura.",
            "Exportar tus candidaturas a un archivo Excel desde tu propio navegador.",
            "Guardar adjuntos de los candidatos, como un CV, en un almacenamiento privado."
          ]
        },
        {
          "type": "p",
          "text": "El servicio se presta tal y como se describe en la web en cada momento. Podemos mejorar, ampliar o ajustar las funciones para mantener la plataforma al día, siempre que esos cambios no degraden de forma sustancial lo que has contratado. Algunas funciones podemos ofrecerlas marcadas como beta, en pruebas o como previsualización: en ese caso se prestan tal cual, pueden cambiar o retirarse en cualquier momento y no llevan asociada garantía ni compromiso de disponibilidad."
        }
      ]
    },
    {
      "heading": "3. Alta, cuenta y acceso",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil solo se ofrece a empresas, autónomos y profesionales que contratan en el marco de su actividad económica. Si no actúas en ese marco, no debes contratar el servicio. Debes ser mayor de edad y tener capacidad para obligar a tu empresa o ejercer tu actividad."
        },
        {
          "type": "p",
          "text": "Para usar el servicio tienes que crear una cuenta con un email válido y los datos de tu empresa. Al registrarte declaras que la información que facilitas es veraz y que tienes capacidad para obligar a tu empresa o ejercer tu actividad profesional."
        },
        {
          "type": "p",
          "text": "Accedes de dos formas: con tu email y una contraseña, o con tu cuenta de Google. Si te registras con email, deberás confirmar tu cuenta a través de un enlace que te enviamos antes de poder entrar. La seguridad de tu cuenta depende de mantener tu contraseña, tu correo y, en su caso, tu cuenta de Google protegidos."
        },
        {
          "type": "p",
          "text": "Eres responsable de la actividad que ocurra bajo tu cuenta y de las personas de tu equipo a las que des acceso. Si crees que alguien ha accedido sin permiso a tu email, a tu cuenta de Google o a la plataforma, avísanos cuanto antes a hola@apuntatefacil.com para que podamos ayudarte."
        }
      ]
    },
    {
      "heading": "4. Planes, precios e IVA",
      "blocks": [
        {
          "type": "p",
          "text": "El servicio se ofrece por suscripción, en tres planes de pago:"
        },
        {
          "type": "ul",
          "items": [
            "Esencial: 185 EUR al mes (1.850 EUR si pagas el año por adelantado).",
            "Pro: 237 EUR al mes (2.370 EUR si pagas el año por adelantado).",
            "Multi: 533 EUR al mes (5.330 EUR si pagas el año por adelantado)."
          ]
        },
        {
          "type": "p",
          "text": "Todos los precios se indican sin IVA. Al importe del plan se le suma el IVA que corresponda según la normativa vigente, que verás reflejado en la factura. Las funciones y límites concretos de cada plan son los que aparecen descritos en la web en el momento de la contratación."
        },
        {
          "type": "p",
          "text": "Puedes pagar mes a mes o de forma anual. Si en el momento de contratar el pago anual lleva asociado algún descuento, lo verás indicado en la plataforma antes de confirmar. Si cambias de plan, el nuevo precio se aplica desde el siguiente periodo de facturación, salvo que en la propia plataforma se indique otra cosa al confirmar el cambio."
        },
        {
          "type": "p",
          "text": "Además, al registrarte tu cuenta empieza en un plan de Prueba gratuito y limitado (un puesto activo y un número reducido de candidaturas visibles, el que se indique en la web en cada momento), pensado para que pruebes el servicio con datos reales antes de contratar. En el plan de Prueba, las candidaturas que superan ese tope se siguen recibiendo y guardando con normalidad, pero quedan bloqueadas y no puedes verlas; al contratar un plan de pago se desbloquean todas. El plan de Prueba se ofrece tal cual, sin compromiso de disponibilidad, y podemos ajustar sus límites en cualquier momento."
        }
      ]
    },
    {
      "heading": "5. Facturación y pagos con Stripe",
      "blocks": [
        {
          "type": "p",
          "text": "Los cobros se gestionan a través de Stripe, nuestro proveedor de pagos. Al contratar un plan, introduces tus datos de pago en el entorno seguro de Stripe; nosotros no almacenamos los datos completos de tu tarjeta. Para entender cómo se tratan esos datos, consulta nuestra Política de Privacidad y las condiciones de Stripe."
        },
        {
          "type": "p",
          "text": "El cargo del plan se realiza por adelantado al inicio de cada periodo: cada mes en el pago mensual y cada año en el pago anual. Emitimos la factura correspondiente a través de Stripe con tus datos de empresa, que eres responsable de mantener actualizados. Si tu empresa está sujeta a un régimen fiscal distinto (por ejemplo, operaciones intracomunitarias con número de IVA válido), aplicaremos el tratamiento del impuesto que proceda según la normativa y los datos fiscales que nos facilites, que eres responsable de mantener correctos."
        },
        {
          "type": "p",
          "text": "Si un cobro falla, podemos reintentarlo durante un plazo razonable. Si el pago sigue sin completarse, podemos suspender o cancelar el acceso al servicio según lo previsto en la cláusula de suspensión y terminación. Salvo que la ley imponga otra cosa o lo indiquemos expresamente, los importes ya pagados por un periodo no se reembolsan de forma proporcional cuando te das de baja antes de que termine ese periodo."
        },
        {
          "type": "p",
          "text": "Al tratarse de una operación comercial entre empresas, las cantidades que no pagues a su vencimiento devengarán de forma automática, sin necesidad de requerimiento previo, el interés de demora previsto en el artículo 7 de la Ley 3/2004 de lucha contra la morosidad en las operaciones comerciales, y nos deberás además la indemnización por costes de cobro de su artículo 8, junto con los gastos razonables y justificados en que incurramos para reclamar la deuda. La suspensión por impago no te exime de pagar las cuotas ya devengadas."
        },
        {
          "type": "p",
          "text": "Si retrocedes o disputas ante tu banco o ante Stripe un cargo correspondiente a un servicio que te hemos prestado de forma efectiva, podremos repercutirte las comisiones que esa retrocesión nos genere y suspender tu acceso conforme a la cláusula de suspensión y terminación hasta que la situación quede regularizada, sin perjuicio de reclamar el importe debido. Esto no te impide disputar de buena fe un cargo realmente erróneo."
        },
        {
          "type": "p",
          "text": "Si somos nosotros quienes dejamos de prestar el servicio o cancelamos tu suscripción sin que medie incumplimiento tuyo, te devolveremos la parte proporcional del periodo ya pagado que no hayas podido disfrutar."
        }
      ]
    },
    {
      "heading": "6. Renovación, sin permanencia y baja",
      "blocks": [
        {
          "type": "p",
          "text": "La suscripción se renueva automáticamente al final de cada periodo (mensual o anual) por otro periodo igual, para que el servicio no se interrumpa, hasta que la canceles."
        },
        {
          "type": "p",
          "text": "No hay permanencia ni penalización por baja. Puedes cancelar la renovación con un clic desde la propia plataforma. Al cancelar, tu plan sigue activo hasta el final del periodo ya pagado y no se renueva para el siguiente; a partir de ahí dejamos de cobrarte."
        },
        {
          "type": "p",
          "text": "Antes de que tu acceso termine, conviene que exportes a Excel las candidaturas y descargues los archivos que quieras conservar. Tras la baja mantendremos disponibles tus datos de candidatos para que puedas exportarlos durante un plazo razonable de [por ejemplo, 30 días] desde la cancelación; pasado ese plazo, y a tu elección, te los devolveremos o los suprimiremos conforme a los plazos descritos en la Política de Privacidad y en el Anexo de Encargo del Tratamiento."
        }
      ]
    },
    {
      "heading": "7. Probar antes de contratar (demo)",
      "blocks": [
        {
          "type": "p",
          "text": "Puedes ver cómo funciona la plataforma sin registrarte ni introducir ninguna tarjeta a través de la demo pública con datos de ejemplo. Si quieres probar con tus propios datos, al registrarte tu cuenta empieza en el plan de Prueba gratuito descrito en el apartado 4, con sus límites. Para usar el servicio sin esos límites necesitas contratar uno de los planes de pago."
        },
        {
          "type": "p",
          "text": "La demo se ofrece tal cual, solo con fines de prueba y sin garantía de ningún tipo. Funciona en tu navegador con datos de ejemplo guardados en local; no crea una cuenta ni procesa candidaturas reales, y puede cambiar o no estar disponible en cualquier momento. No introduzcas en la demo datos personales reales de candidatos: no es un entorno para tratar datos reales. No asumimos responsabilidad por el uso que hagas de la demo ni por los datos que introduzcas en ella."
        },
        {
          "type": "p",
          "text": "Al registrarte, tu cuenta queda activa en el plan de Prueba y puedes empezar a recibir candidaturas reales desde el primer momento, dentro de sus límites. Sin permanencia: puedes contratar un plan de pago, cambiarlo o cancelarlo cuando quieras."
        }
      ]
    },
    {
      "heading": "8. Tu papel como responsable de los datos de los candidatos",
      "blocks": [
        {
          "type": "p",
          "text": "Este es uno de los puntos más importantes del contrato, así que lo decimos claro. Respecto a los datos personales de los candidatos que entran por tu formulario (nombre, teléfono y los campos que tú configures), tu empresa es la responsable del tratamiento y Apúntate Fácil actúa como encargado del tratamiento. Es decir, nosotros tratamos esos datos por cuenta tuya, siguiendo tus instrucciones y solo para prestarte el servicio."
        },
        {
          "type": "p",
          "text": "Como responsable, te corresponde a ti, no a nosotros:"
        },
        {
          "type": "ul",
          "items": [
            "Tener una base de legitimación válida para recoger y tratar los datos de cada candidato conforme al RGPD (Reglamento UE 2016/679) y a la LOPDGDD (Ley Orgánica 3/2018).",
            "Informar a los candidatos de quién eres tú como responsable, para qué usas sus datos, durante cuánto tiempo y cómo pueden ejercer sus derechos.",
            "Atender las solicitudes de los candidatos sobre sus derechos (acceso, rectificación, supresión y demás), apoyándote en las herramientas que te da la plataforma.",
            "Configurar el formulario para pedir solo los datos que de verdad necesitas para el proceso de selección, sin excederte."
          ]
        },
        {
          "type": "p",
          "text": "Como responsable de los datos de los candidatos, nos manifiestas y garantizas que: (a) cuentas con una base de licitud válida del artículo 6 del RGPD para recoger y tratar cada candidatura; (b) antes de recoger sus datos, has informado a los candidatos de quién eres, para qué tratas sus datos, cuánto los conservas y cómo ejercer sus derechos, conforme a los artículos 13 y 14 del RGPD; (c) configuras el formulario para pedir solo datos adecuados, pertinentes y no excesivos para el puesto; (d) el origen de los datos que entran por tu formulario es lícito; y (e) no usas la plataforma para recoger ni tratar categorías especiales de datos del artículo 9 del RGPD (entre otras, salud, origen racial o étnico, afiliación sindical, religión, vida u orientación sexual) ni datos del artículo 10, salvo que cuentes con una base válida y con las garantías que la ley exige, en cuyo caso lo haces bajo tu exclusiva responsabilidad. Estas garantías son una condición esencial para que te prestemos el servicio: su incumplimiento es un incumplimiento grave del contrato y activa tu obligación de indemnidad."
        },
        {
          "type": "p",
          "text": "Reconoces y aceptas que las decisiones de selección, descarte y contratación, la relación con los candidatos y el cumplimiento de la normativa laboral, de igualdad y no discriminación, y de protección de datos frente a los candidatos son de tu exclusiva responsabilidad como empleadora y responsable del tratamiento. Apúntate Fácil es solo la herramienta que te ayuda a organizar las candidaturas y no participa, asesora ni decide en esos procesos. Cualquier consecuencia de esas decisiones o de ese cumplimiento te corresponde a ti."
        },
        {
          "type": "p",
          "text": "Apúntate Fácil no toma decisiones automatizadas con efectos jurídicos o significativos sobre los candidatos. La calificación de 0 a 3 estrellas, el estado de la candidatura y los filtros del panel son simples herramientas de organización que introduce y usa una persona de tu empresa: la decisión de a quién contactar, entrevistar o contratar la tomas siempre tú. Si decides usar esa puntuación para automatizar decisiones de selección, te corresponde a ti, como responsable, cumplir el artículo 22 del RGPD frente a los candidatos."
        },
        {
          "type": "p",
          "text": "El uso de la plataforma conforme a estos términos constituye tu instrucción documentada para que tratemos los datos de candidatos por cuenta tuya. Si una instrucción tuya nos parece, a nuestro juicio razonable, que infringe el RGPD, la LOPDGDD u otra norma de protección de datos, te lo advertiremos sin demora conforme al artículo 28.3 del RGPD y podremos no ejecutarla o suspender el tratamiento afectado hasta que la corrijas o la confirmes, sin que esa suspensión suponga un incumplimiento del servicio por nuestra parte ni genere derecho a indemnización a tu favor. No estamos obligados a ejecutar instrucciones manifiestamente ilícitas. Si, tras nuestra advertencia, mantienes la instrucción, la decisión sobre el tratamiento es tuya como responsable y asumes las consecuencias que de ella se deriven."
        },
        {
          "type": "p",
          "text": "Las condiciones detalladas de este reparto de papeles (instrucciones, subencargados, seguridad, notificación de brechas, auditoría y devolución o supresión de datos al terminar) se recogen en el Anexo de Encargo del Tratamiento que figura al final de estos términos y forma parte de ellos, y se complementan con la Política de Privacidad."
        }
      ]
    },
    {
      "heading": "9. Uso aceptable de la plataforma",
      "blocks": [
        {
          "type": "p",
          "text": "Te comprometes a usar Apúntate Fácil de forma legal y responsable. En particular, no debes:"
        },
        {
          "type": "ul",
          "items": [
            "Subir o tratar datos personales de candidatos sin una base de legitimación válida o sin haberles informado como te exige la normativa.",
            "Usar el servicio para discriminar a candidatos por razón de sexo, edad, origen racial o étnico, religión o convicciones, discapacidad, orientación o identidad sexual, estado civil, embarazo, afiliación sindical o cualquier otra condición protegida por la legislación laboral y de igualdad. Las decisiones de selección deben basarse en criterios objetivos y relacionados con el puesto.",
            "Usar el servicio para fines ilícitos, fraudulentos o contrarios a la legislación laboral o de protección de datos.",
            "Pedir a los candidatos datos especialmente sensibles o desproporcionados que no necesites para el puesto.",
            "Intentar acceder a cuentas o datos de otras empresas, vulnerar la seguridad de la plataforma o saltarte sus límites técnicos.",
            "Descompilar, desensamblar o realizar ingeniería inversa sobre el software para acceder a su código fuente o a su lógica, salvo en la estricta medida que una norma imperativa te lo permita pese a esta prohibición (como el derecho de interoperabilidad del artículo 100 de la Ley de Propiedad Intelectual).",
            "Extraer, copiar o reutilizar de forma masiva o sistemática el contenido, la estructura, el diseño o las bases de datos del servicio, ni mediante scraping, robots o cualquier acceso automatizado no autorizado.",
            "Revender, sublicenciar o alquilar el servicio, ofrecerlo a terceros como si fuera tuyo, o usarlo, su software o los datos a los que accedas a través de él, para desarrollar, entrenar o ayudar a desarrollar un producto, modelo o servicio que compita con Apúntate Fácil.",
            "Publicar mediciones, comparativas o benchmarks del servicio sin nuestro consentimiento previo por escrito.",
            "Introducir código malicioso, hacer un uso que sobrecargue de forma anómala el servicio o perjudique a otros clientes."
          ]
        },
        {
          "type": "p",
          "text": "Si incumples estas reglas, podemos suspender o cancelar tu acceso conforme a la cláusula de suspensión y terminación, y eres responsable de los daños que ese incumplimiento cause a los candidatos, a nosotros o a terceros."
        }
      ]
    },
    {
      "heading": "10. Tus datos son tuyos y exportación a Excel",
      "blocks": [
        {
          "type": "p",
          "text": "Los datos que tú y tu equipo introducís en la plataforma, y las candidaturas que recibes, son tuyos. No los usamos para fines propios ni los vendemos. Solo los tratamos para prestarte el servicio y mantenerlo en funcionamiento, como encargado y según las instrucciones que has aceptado."
        },
        {
          "type": "p",
          "text": "En cualquier momento mientras tu cuenta esté activa puedes exportar tus candidaturas a un archivo Excel. La exportación se genera en tu propio navegador y se descarga en tu dispositivo, sin pasar por terceros. Así puedes llevarte tus datos cuando quieras, también si decides dejar de usar el servicio."
        },
        {
          "type": "p",
          "text": "La única excepción es el plan de Prueba: las candidaturas bloqueadas por superar su tope se exportan solo como filas con la fecha de entrada, sin datos personales, hasta que contratas un plan de pago y se desbloquean todas. Esas candidaturas siguen siendo tuyas y tú sigues siendo su responsable: si necesitas atender la solicitud de un candidato sobre una candidatura bloqueada (por ejemplo, de acceso o supresión), o quieres que te devolvamos o suprimamos esos datos, escríbenos a soporte@apuntatefacil.com y lo haremos siguiendo tus instrucciones, sin coste. Al terminar el servicio, la devolución o supresión alcanza a todos los datos de candidatos, bloqueados incluidos."
        },
        {
          "type": "p",
          "text": "La exportación a Excel es la herramienta que ponemos a tu disposición para que conserves tus datos: te corresponde a ti exportar y guardar lo que necesites mientras tu cuenta esté activa y durante el plazo razonable posterior a la baja. Transcurrido ese plazo, suprimiremos o te devolveremos los datos según lo previsto en la cláusula de baja y en el Anexo de Encargo del Tratamiento, y no responderemos de la pérdida de datos que hubieras podido evitar exportándolos a tiempo. Esta previsión no afecta a la conservación que nos exija la ley."
        }
      ]
    },
    {
      "heading": "11. Tratamiento de datos y privacidad",
      "blocks": [
        {
          "type": "p",
          "text": "Tratamos dos grupos de datos personales. Por un lado, los datos de tu cuenta de empresa (email, nombre o razón social, datos del plan y de pago a través de Stripe); de estos somos nosotros los responsables del tratamiento. Por otro lado, los datos de los candidatos, de los que eres tú el responsable y nosotros el encargado, tal y como se explica más arriba."
        },
        {
          "type": "p",
          "text": "Para prestar el servicio nos apoyamos en proveedores que, frente a los datos de tu cuenta de empresa, son encargados nuestros, y frente a los datos de los candidatos, son subencargados que actúan por cuenta tuya: Stripe para los pagos, Resend para los emails transaccionales (aviso de nueva candidatura y avisos de facturación), Supabase para el alojamiento de la base de datos, la autenticación y el almacenamiento de archivos, Vercel para servir la aplicación web y medir su uso de forma agregada y sin cookies, y Google para el inicio de sesión opcional con cuenta de Google. No usamos publicidad ni rastreo entre sitios, y solo empleamos el almacenamiento imprescindible para mantener tu sesión y tus preferencias, como se detalla en la Política de Privacidad."
        },
        {
          "type": "p",
          "text": "Algunas funciones se apoyan en servicios de terceros con sus propias condiciones: los pagos los procesa Stripe (con sus condiciones y su política de privacidad) y el inicio de sesión opcional lo gestiona Google (con sus condiciones y su política de privacidad). Al usar esas funciones aceptas también las condiciones del tercero correspondiente en lo que te resulten aplicables. No respondemos del funcionamiento, la disponibilidad ni las condiciones de esos servicios de terceros, que escapan a nuestro control."
        },
        {
          "type": "p",
          "text": "Toda la información detallada sobre qué datos tratamos, con qué fines, durante cuánto tiempo, dónde se alojan (eu-west-3 (París, Francia)) y cómo ejercer tus derechos está en la Política de Privacidad. Para los datos de candidatos, las condiciones específicas del encargo están en el Anexo de Encargo del Tratamiento que figura al final de estos términos. Estos términos deben leerse junto con esos documentos."
        }
      ]
    },
    {
      "heading": "12. Propiedad intelectual del software",
      "blocks": [
        {
          "type": "p",
          "text": "El software, la plataforma, la marca Apúntate Fácil, el diseño, los textos y todos los elementos del servicio son de su titular, SOLERA CANARIAS TÉCNICA, S.L., o de quienes nos han cedido los derechos. Están protegidos por la normativa de propiedad intelectual e industrial."
        },
        {
          "type": "p",
          "text": "Mientras tu suscripción esté vigente, te concedemos un derecho de uso del servicio personal, limitado, no exclusivo y no transferible, solo para gestionar tus propios procesos de selección dentro de tu actividad y dentro de estos términos. Este contrato no te transfiere la propiedad del software ni ningún derecho más allá del uso, y no incluye revender, sublicenciar, alquilar ni ofrecer el servicio a terceros como si fuera tuyo."
        },
        {
          "type": "p",
          "text": "No puedes copiar, modificar, distribuir, sublicenciar ni explotar el software o la marca fuera de lo que estos términos permiten. La prohibición de copiar, descompilar, realizar ingeniería inversa, extraer el código o la estructura de la plataforma, revender o sublicenciar el servicio, o usarlo para desarrollar, entrenar o ayudar a desarrollar un producto que compita con él, salvo en la estricta medida que una norma imperativa lo permita (como el derecho de interoperabilidad del artículo 100 de la Ley de Propiedad Intelectual), es esencial en este contrato. Su incumplimiento se considera grave y nos faculta para suspender o cancelar tu acceso de inmediato y para terminar el contrato, sin perjuicio de las acciones de cesación, de daños y perjuicios y de propiedad intelectual e industrial que nos correspondan, y sin que la limitación de responsabilidad prevista en estos términos ampare al infractor. Reconoces que el incumplimiento de esta cláusula puede causarnos un daño difícilmente reparable, por lo que podremos solicitar las medidas cautelares que procedan para hacerlo cesar. Esta obligación sigue vigente tras la terminación del contrato."
        },
        {
          "type": "p",
          "text": "Si nos haces llegar comentarios, sugerencias o ideas de mejora sobre el servicio, podremos usarlos libremente para mejorar la plataforma sin que ello te dé ningún derecho ni nos obligue a compensarte, y sin que dejes de poder usar tú esas mismas ideas. Además, podemos generar y usar datos estadísticos agregados y anonimizados de forma irreversible (por ejemplo, número de candidaturas por sector o tiempos medios de respuesta) para operar, mantener, medir y mejorar el servicio. Esos datos agregados no permiten identificar a ninguna empresa ni a ningún candidato, por lo que no son datos personales y su uso no afecta a tu condición de responsable ni a la nuestra de encargado sobre los datos identificables de tus candidatos, que seguimos tratando solo por cuenta tuya. Esta cláusula no afecta a la propiedad de tus datos, que siguen siendo tuyos como se explica en la cláusula correspondiente."
        }
      ]
    },
    {
      "heading": "13. Disponibilidad del servicio y garantías",
      "blocks": [
        {
          "type": "p",
          "text": "Ponemos un esfuerzo razonable en mantener el servicio disponible y funcionando correctamente. Aun así, ningún servicio en internet está disponible el 100% del tiempo: puede haber cortes, mantenimientos planificados o incidencias de nuestros proveedores (como Supabase, Vercel, Stripe, Resend o Google) que escapan a nuestro control directo."
        },
        {
          "type": "p",
          "text": "El servicio se presta tal cual y según esté disponible en cada momento, sin ningún compromiso de nivel de servicio ni de disponibilidad garantizada (no ofrecemos un SLA). Más allá de las garantías que la ley imponga con carácter imperativo, no garantizamos que el servicio esté libre de errores o interrupciones, que se adapte a un fin concreto distinto del descrito, ni que su uso te garantice encontrar candidatos, cubrir un puesto o cumplir tus obligaciones laborales o de protección de datos, que dependen de tus propias decisiones. Apúntate Fácil es una herramienta de organización: no garantizamos ningún resultado concreto del proceso de selección, como el número o la calidad de las candidaturas que recibas, que dependen de tu anuncio, tu sector y factores ajenos a la plataforma. En lo que la ley permita entre empresas, renuncias a cualquier garantía implícita de comerciabilidad, calidad satisfactoria o adecuación a un propósito particular."
        },
        {
          "type": "p",
          "text": "No respondemos del funcionamiento, la disponibilidad ni las condiciones de los servicios de terceros de los que depende la plataforma (entre otros Supabase, Vercel, Stripe, Resend o Google), que escapan a nuestro control. Cuando tengamos que hacer un mantenimiento que pueda afectar al uso normal, intentaremos avisarte con antelación y elegir momentos de menor impacto siempre que sea posible."
        }
      ]
    },
    {
      "heading": "14. Limitación de responsabilidad",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil es una herramienta para gestionar candidaturas; las decisiones de selección y contratación, y el cumplimiento de la normativa laboral y de protección de datos frente a los candidatos, son tuyos como responsable. No respondemos de tus decisiones de contratación ni del uso que hagas de los datos de los candidatos."
        },
        {
          "type": "p",
          "text": "En la medida en que la ley lo permita, no respondemos de los daños indirectos o consecuenciales, el lucro cesante, la pérdida de oportunidades, contratos o clientes, el daño reputacional o de imagen, la pérdida de fondo de comercio, ni la pérdida o corrupción de datos que tú podrías haber evitado con tus propias exportaciones y copias de seguridad. Tampoco respondemos de las sanciones, multas o indemnizaciones que se te impongan a ti como responsable, ni de las reclamaciones de candidatos o de terceros, cuando tengan su origen en tus decisiones de selección, en tu incumplimiento de la normativa laboral o de protección de datos o en el uso que hagas del servicio. Esta exclusión se aplica con independencia de la teoría jurídica en que se funde la reclamación, salvo en lo que la ley no permita excluir."
        },
        {
          "type": "p",
          "text": "Nuestra responsabilidad total y acumulada frente a ti, por el conjunto de las reclamaciones relacionadas con el servicio en cualquier periodo de doce meses, se limita a la mayor de estas dos cantidades: el importe que nos hayas pagado por la suscripción en los doce meses anteriores al primer hecho que origine la reclamación, o cien euros. Este límite es un tope conjunto, no se multiplica por el número de reclamaciones o de incidencias."
        },
        {
          "type": "p",
          "text": "Este límite y la exclusión de daños indirectos operan a nuestro favor y no limitan ni reducen las cantidades que tú nos debas en virtud de tu obligación de indemnidad, de la repercusión y el derecho de regreso en materia de protección de datos previstos en estos términos, por infringir la propiedad intelectual o industrial del servicio, por incumplir las reglas de uso aceptable, ni por las cuotas devengadas. Esas obligaciones tuyas quedan fuera de este límite y no se ven limitadas por él."
        },
        {
          "type": "p",
          "text": "Nada en estos términos excluye o limita nuestra responsabilidad en aquello que la ley no permita limitar, como el dolo o la culpa grave. Como este es un servicio entre empresas (B2B), estas limitaciones se entienden pactadas entre profesionales y no afectan a derechos de consumidores, que aquí no aplican."
        }
      ]
    },
    {
      "heading": "15. Tu indemnidad",
      "blocks": [
        {
          "type": "p",
          "text": "Como responsable de los datos de tus candidatos y del uso que haces del servicio, te comprometes a dejarnos indemnes y a asumir los daños, reclamaciones, sanciones, gastos y costes de defensa razonables que se nos deriven de:"
        },
        {
          "type": "ul",
          "items": [
            "Tratar datos de candidatos sin una base legal válida o sin haberles informado como exige la normativa.",
            "Pedir datos excesivos o sensibles que no necesitabas para el puesto.",
            "Usar el servicio de forma ilícita, fraudulenta o discriminatoria, o tomar decisiones de selección o de contratación contrarias a la normativa laboral, de igualdad o de no discriminación.",
            "Incumplir estos términos o la legislación aplicable."
          ]
        },
        {
          "type": "p",
          "text": "Esta indemnidad cubre, en particular, las reclamaciones que cualquier candidato o tercero dirija contra nosotros, incluidas las que se amparen en el artículo 82 del RGPD, así como las investigaciones, requerimientos o sanciones de la Agencia Española de Protección de Datos o de otra autoridad, cuando tengan su origen en tus decisiones, instrucciones o incumplimientos como responsable (entre otros, falta de base de licitud, falta de información a los candidatos, datos excesivos o sensibles, o uso discriminatorio del servicio). En esos casos nos mantendrás indemnes de las indemnizaciones, multas, intereses, gastos y costes de defensa razonables que tengamos que asumir, incluida la parte que nos corresponda repercutirte por la responsabilidad solidaria que el artículo 82 del RGPD impone a responsable y encargado, en la medida en que el daño sea imputable a tu actuación como responsable."
        },
        {
          "type": "p",
          "text": "Esta indemnidad no alcanza a la parte de responsabilidad que derive de nuestro propio dolo o culpa grave, ni del incumplimiento de las obligaciones que el RGPD impone específicamente al encargado, que asumimos nosotros."
        },
        {
          "type": "p",
          "text": "Te informaremos sin demora de cualquier reclamación cubierta por esta cláusula. Podremos asumir la dirección de nuestra propia defensa con asesores de nuestra elección y a tu cargo razonable, y no aceptarás ningún acuerdo que nos imponga obligaciones o reconozca culpa por nuestra parte sin nuestro consentimiento previo por escrito; del mismo modo, nosotros no aceptaremos sin tu consentimiento, que no podrás negar sin un motivo razonable, un acuerdo que te imponga obligaciones a ti. Esta obligación no se ve afectada por la limitación de responsabilidad de la cláusula anterior."
        }
      ]
    },
    {
      "heading": "16. Repercusión y derecho de regreso en materia de protección de datos",
      "blocks": [
        {
          "type": "p",
          "text": "Como tú eres la responsable de los datos de los candidatos y quien decide qué se les pide y para qué, asumes frente a nosotros las consecuencias de cualquier tratamiento ilícito que tenga su origen en tus decisiones o instrucciones."
        },
        {
          "type": "p",
          "text": "El RGPD permite que un candidato reclame la totalidad de un daño a cualquiera de los responsables o encargados implicados: ese derecho del candidato no se ve afectado por este contrato y no lo limitamos. Esta cláusula no pretende excluir la responsabilidad que la ley nos impone de forma solidaria frente al candidato o ante la autoridad, sino repartir entre tu empresa y la nuestra, en nuestra relación interna, quién soporta finalmente el coste según quién haya causado el daño."
        },
        {
          "type": "p",
          "text": "Si un candidato u otra persona nos reclama, o si una autoridad nos sanciona, por un tratamiento de datos de candidatos que derive de tus instrucciones, de la falta de base legal, de la falta de información a los candidatos o de cualquier incumplimiento tuyo, y nosotros tenemos que pagar una indemnización o una sanción en virtud de la responsabilidad solidaria que el artículo 82 del RGPD impone a responsable y encargado, podremos reclamarte después, conforme al artículo 82.5 del RGPD, el importe que hayamos pagado por la parte de responsabilidad que te corresponda a ti como responsable, más los gastos e intereses. A la inversa, si la parte del daño nos fuera imputable a nosotros como encargado, soportaremos nosotros esa parte."
        },
        {
          "type": "p",
          "text": "Te avisaremos sin demora de cualquier reclamación de este tipo y podrás participar en la defensa. Ni tú ni nosotros aceptaremos una transacción que reconozca responsabilidad de la otra parte, o que le imponga obligaciones, sin su consentimiento previo, que no podrá negarse sin un motivo razonable."
        }
      ]
    },
    {
      "heading": "17. Fuerza mayor",
      "blocks": [
        {
          "type": "p",
          "text": "Ninguna de las partes responde por el incumplimiento o el retraso de sus obligaciones cuando se deba a causas razonablemente ajenas a su control, como fallos generalizados de internet o de los proveedores de infraestructura o de telecomunicaciones de los que dependemos, cortes de suministro, ciberataques de gran escala, catástrofes naturales, conflictos, huelgas ajenas a la propia organización o decisiones de una autoridad pública."
        },
        {
          "type": "p",
          "text": "La parte afectada avisará a la otra en cuanto sea razonable y pondrá un esfuerzo proporcionado en reducir el impacto y reanudar el servicio cuanto antes. Esta cláusula no exime del pago de los importes ya devengados. Si la situación se prolonga más de treinta días seguidos y deja el servicio prácticamente inutilizable, cualquiera de las partes puede dar de baja la suscripción sin penalización."
        }
      ]
    },
    {
      "heading": "18. Cesión del contrato",
      "blocks": [
        {
          "type": "p",
          "text": "No puedes ceder ni transferir este contrato, ni los derechos y obligaciones que nacen de él, sin nuestro consentimiento previo por escrito."
        },
        {
          "type": "p",
          "text": "Nosotros sí podemos cederlo a una empresa de nuestro grupo o a un tercero en caso de reorganización, fusión, aportación de rama de actividad o venta del negocio, siempre que el cesionario asuma estas mismas condiciones y ello no reduzca tus derechos. Te avisaremos si eso ocurre. La Política de Privacidad y el Anexo de Encargo del Tratamiento siguen aplicándose a cualquier cesionario; si la cesión implica un cambio de quien trata los datos de tus candidatos, te informaremos y respetaremos lo previsto en dicho anexo."
        }
      ]
    },
    {
      "heading": "19. Comunicaciones",
      "blocks": [
        {
          "type": "p",
          "text": "Salvo que estos términos digan otra cosa, nuestras comunicaciones contigo se hacen al email asociado a tu cuenta o mediante un aviso dentro de la plataforma, y las tuyas con nosotros a hola@apuntatefacil.com (o a privacidad@apuntatefacil.com para asuntos de datos personales)."
        },
        {
          "type": "p",
          "text": "Una comunicación se entiende recibida el día hábil siguiente al envío, salvo prueba en contra. Eres responsable de mantener actualizada la dirección de email de tu cuenta; si dejas de tener acceso a ella, avísanos."
        }
      ]
    },
    {
      "heading": "20. Suspensión y terminación",
      "blocks": [
        {
          "type": "p",
          "text": "Tú puedes terminar el contrato en cualquier momento dándote de baja con un clic, sin permanencia, como se explica en la cláusula de baja."
        },
        {
          "type": "p",
          "text": "Nosotros podemos suspender o cancelar tu acceso, total o parcialmente, si se da alguno de estos casos:"
        },
        {
          "type": "ul",
          "items": [
            "Falta de pago tras los reintentos razonables que hayamos realizado.",
            "Incumplimiento grave de estos términos, en especial de las reglas de uso aceptable o de tus obligaciones como responsable de los datos de candidatos.",
            "Uso del servicio que ponga en riesgo la seguridad, la legalidad o el funcionamiento de la plataforma para otros clientes.",
            "Cuando una norma o una autoridad competente nos obligue a hacerlo."
          ]
        },
        {
          "type": "p",
          "text": "Como regla general, cuando sea posible y proporcionado, te avisaremos antes de suspender y te daremos un plazo razonable para corregir el problema. No obstante, podremos suspender tu acceso de forma inmediata y sin preaviso, durante el tiempo imprescindible, cuando exista un riesgo serio e inmediato para la seguridad o la integridad de la plataforma o de los datos de otros clientes, cuando detectemos un uso manifiestamente ilícito, fraudulento o que vulnere gravemente la cláusula de uso aceptable, cuando exista un indicio fundado de tratamiento ilícito de datos, o cuando una autoridad competente nos lo exija. También podremos suspender el acceso cuando, tras los reintentos razonables de cobro, la cuota lleve impagada más de quince días desde su vencimiento. La suspensión inmediata se mantendrá solo mientras dure la causa que la motiva y, en cuanto sea razonable, te informaremos del motivo y, si procede, de cómo resolverlo. Esta facultad no nos obliga a vigilar de forma continua el uso que haces del servicio."
        },
        {
          "type": "p",
          "text": "La suspensión o la terminación por una causa que te sea imputable no genera derecho a reembolso de los importes ya pagados. Tras la terminación, dejas de tener acceso al servicio y gestionamos tus datos según la Política de Privacidad y el Anexo de Encargo del Tratamiento, dándote la oportunidad de exportar lo que necesites cuando las circunstancias lo permitan."
        }
      ]
    },
    {
      "heading": "21. Cambios en los términos y en los precios",
      "blocks": [
        {
          "type": "p",
          "text": "Podemos actualizar estos términos para reflejar mejoras del servicio, cambios legales o ajustes operativos. Cuando el cambio sea relevante, te lo comunicaremos por un medio razonable (por ejemplo, por email a la dirección de tu cuenta o dentro de la plataforma) con una antelación suficiente antes de que entre en vigor. Cada vez que cambiemos estos términos actualizaremos la fecha de última actualización que figura al principio."
        },
        {
          "type": "p",
          "text": "También podemos modificar los precios de los planes. Te avisaremos con un preaviso razonable antes de que el nuevo precio se aplique a tu suscripción. El cambio nunca afecta a un periodo ya pagado: se aplica a partir de la siguiente renovación."
        },
        {
          "type": "p",
          "text": "Si no estás de acuerdo con un cambio de términos o de precio, tu opción es no renovar y darte de baja antes de que entre en vigor, sin penalización. Si sigues usando el servicio después de la fecha de entrada en vigor, se entiende que aceptas la nueva versión."
        }
      ]
    },
    {
      "heading": "22. Supervivencia de cláusulas",
      "blocks": [
        {
          "type": "p",
          "text": "La terminación del contrato no afecta a las cláusulas que, por su naturaleza, deben seguir vigentes después: en particular las de propiedad intelectual del software, tus obligaciones y garantías como responsable de los datos de los candidatos, tu indemnidad, la repercusión y el derecho de regreso en materia de protección de datos, la limitación de responsabilidad, las cuotas devengadas y el interés de demora por impago, la conservación de los datos de facturación por obligación legal, las condiciones del Anexo de Encargo del Tratamiento que deban perdurar tras el servicio, y la legislación y la jurisdicción aplicables."
        }
      ]
    },
    {
      "heading": "23. Legislación aplicable y resolución de conflictos",
      "blocks": [
        {
          "type": "p",
          "text": "Estos términos se rigen por la legislación española. En lo relativo a la protección de datos, se aplican el RGPD (Reglamento UE 2016/679) y la LOPDGDD (Ley Orgánica 3/2018)."
        },
        {
          "type": "p",
          "text": "Como se trata de un contrato entre empresas o profesionales, y salvo que una norma imperativa diga otra cosa, para cualquier conflicto que pueda surgir las partes se someten a los juzgados y tribunales del domicilio del prestador. Antes de acudir a los tribunales, te pedimos que intentemos resolverlo de buena fe escribiéndonos a hola@apuntatefacil.com."
        },
        {
          "type": "p",
          "text": "Si alguna cláusula de estos términos se declarara nula o inaplicable, el resto seguirá en vigor. Estos términos, junto con la Política de Privacidad y el Anexo de Encargo del Tratamiento, forman el acuerdo completo entre tu empresa y nosotros sobre el uso del servicio. Si hubiera contradicción entre estos documentos, en materia de datos personales prevalecen el Anexo de Encargo del Tratamiento y la Política de Privacidad; en lo demás, prevalecen estos términos."
        }
      ]
    },
    {
      "heading": "24. Anexo: condiciones del encargo de tratamiento (artículo 28 del RGPD)",
      "blocks": [
        {
          "type": "p",
          "text": "Este anexo regula el tratamiento de los datos de los candidatos, de los que tu empresa es la responsable y Apúntate Fácil el encargado, y forma parte de estos términos. Si necesitas una copia firmada de este anexo para tu documentación, escríbenos a privacidad@apuntatefacil.com."
        },
        {
          "type": "p",
          "text": "Objeto y duración: tratamos los datos de candidatos solo para prestarte el servicio de gestión de candidaturas descrito en estos términos, durante la vigencia de tu suscripción y hasta la devolución o supresión de los datos."
        },
        {
          "type": "p",
          "text": "Naturaleza y finalidad: recogida a través del formulario, almacenamiento, organización, consulta, filtrado, comunicación operativa por email, registro de respuestas, exportación y supresión de candidaturas, por cuenta tuya."
        },
        {
          "type": "p",
          "text": "Tipo de datos: datos identificativos y de contacto de los candidatos (nombre, teléfono y email, que se solicita por defecto pero puedes hacer opcional o eliminar), los campos personalizados que definas, los archivos adjuntos (por ejemplo, el CV) y los datos de gestión (respuesta y fechas de las comprobaciones de interés, estado, calificación, etiquetas, notas y comentarios internos, como los del tablón de Equipo, fuente y fecha). Categorías de interesados: las personas candidatas a tus ofertas."
        },
        {
          "type": "p",
          "text": "Como encargado nos obligamos a:"
        },
        {
          "type": "ul",
          "items": [
            "Tratar los datos solo siguiendo tus instrucciones documentadas, incluidas las relativas a transferencias internacionales, salvo que una norma nos obligue a otra cosa, en cuyo caso te informaremos antes salvo prohibición legal.",
            "Garantizar la confidencialidad de quien trate los datos por nuestra cuenta.",
            "Aplicar las medidas de seguridad del artículo 32 del RGPD descritas en la Política de Privacidad.",
            "Respetar las condiciones para recurrir a subencargados previstas más abajo.",
            "Asistirte, en la medida de lo posible, para que atiendas las solicitudes de derechos de los candidatos.",
            "Ayudarte a cumplir tus obligaciones de seguridad, notificación de brechas y evaluaciones de impacto.",
            "A tu elección, devolverte o suprimir los datos de candidatos al terminar el servicio, salvo la conservación que nos exija la ley.",
            "Poner a tu disposición la información necesaria para demostrar el cumplimiento de estas obligaciones y permitir las auditorías razonables previstas más abajo."
          ]
        },
        {
          "type": "p",
          "text": "Instrucciones ilícitas. Si en algún momento consideramos, a nuestro juicio razonable, que una instrucción tuya infringe el RGPD, la LOPDGDD u otra norma de protección de datos, te lo advertiremos sin demora, conforme al artículo 28.3 del RGPD, y podremos no ejecutarla o suspender el tratamiento afectado hasta que la corrijas, sin que ello suponga un incumplimiento del servicio por nuestra parte ni genere derecho a indemnización a tu favor. La decisión sobre el tratamiento es tuya como responsable: si, tras nuestra advertencia, mantienes la instrucción, la ejecutaremos bajo tu exclusiva responsabilidad y tú asumes las consecuencias que de ella se deriven. No estamos obligados a ejecutar instrucciones manifiestamente ilícitas ni a tratar datos para finalidades ajenas a la prestación del servicio."
        },
        {
          "type": "p",
          "text": "Reparto de responsabilidad. Conforme al artículo 82 del RGPD, solo respondemos del daño causado por el tratamiento cuando hayamos incumplido las obligaciones que el RGPD dirige específicamente a los encargados o hayamos actuado al margen de tus instrucciones lícitas. La licitud del tratamiento, la base de legitimación, la información a los candidatos y la proporcionalidad de los datos que pides son tu responsabilidad como responsable. Si frente a un candidato o ante la autoridad respondiéramos solidariamente por una causa que te sea imputable, te repercutiremos la parte que te corresponda en los términos de la cláusula de indemnidad y de la cláusula de repercusión y derecho de regreso de estos términos, conforme al artículo 82.5 del RGPD. Nada de lo anterior limita la responsabilidad solidaria que ambos podamos tener frente al candidato como tercero, que el RGPD no permite excluir entre nosotros con efectos frente a él."
        },
        {
          "type": "p",
          "text": "Subencargados. Autorizas con carácter general que recurramos a los subencargados necesarios para prestar el servicio. A la fecha de estos términos son: Stripe (pagos), Resend (emails transaccionales), Supabase (alojamiento de base de datos, autenticación y almacenamiento de archivos, en la región eu-west-3 (París, Francia)), Vercel (servicio de la aplicación web) y Google (inicio de sesión opcional y conexión opcional con Google Calendar). Si vamos a sustituir o añadir un subencargado, te lo comunicaremos por un medio razonable (por email a tu cuenta o mediante un aviso en la plataforma) con antelación suficiente antes de que el cambio entre en vigor, y dispondrás de un plazo razonable para oponerte por motivos fundados de protección de datos. Si te opones y no podemos ofrecerte una alternativa, podrás resolver la parte del servicio afectada sin penalización. Exigimos a cada subencargado, por contrato, obligaciones de protección de datos equivalentes a las de este anexo."
        },
        {
          "type": "p",
          "text": "Notificación de brechas. Si detectamos una violación de la seguridad que afecte a los datos de candidatos que tratamos por cuenta tuya, te lo notificaremos sin dilación indebida tras tener constancia, con la información de que dispongamos (naturaleza de la brecha, datos y candidatos afectados de forma aproximada, posibles consecuencias y medidas adoptadas), para que puedas cumplir tus obligaciones de notificación a la autoridad y a los candidatos como responsable."
        },
        {
          "type": "p",
          "text": "Transferencias internacionales. Cualquier transferencia internacional de datos de candidatos que realicen nuestros subencargados se efectúa por cuenta tuya como responsable y bajo la autorización que aceptas en este anexo, con las garantías del Capítulo V del RGPD descritas en la Política de Privacidad."
        },
        {
          "type": "p",
          "text": "Auditoría. Para que verifiques el cumplimiento de este anexo, te facilitaremos la información razonable que nos pidas y, en su caso, los certificados o informes de seguridad de nuestros proveedores de infraestructura. Si necesitas una auditoría adicional, se realizará con preaviso razonable, en horario laboral, sin interrumpir el servicio, con confidencialidad y, salvo que la ley diga otra cosa, a tu cargo, como máximo una vez al año salvo que medie un incidente de seguridad acreditado."
        },
        {
          "type": "p",
          "text": "Fin del servicio. Al terminar el servicio mantendremos disponibles tus datos de candidatos para que puedas exportarlos durante el plazo razonable indicado en la cláusula de baja; pasado ese plazo, y a tu elección, te los devolveremos o los suprimiremos de forma segura, salvo la conservación que nos exija la ley."
        }
      ]
    }
  ]
}

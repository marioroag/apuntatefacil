// Documentos legales de Apúntate Fácil (privacidad y términos).
// Redactados y revisados por el flujo "paginas-legales" (RGPD/LOPDGDD) el 14 jun 2026.
// Contienen placeholders entre corchetes pendientes de rellenar antes de publicar:
// [RAZÓN SOCIAL], [NIF/DNI], [DIRECCIÓN POSTAL], [EMAIL DE CONTACTO], [REGIÓN DE ALOJAMIENTO].
// Conviene una revisión por un abogado antes del lanzamiento.

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
  "intro": "En Apúntate Fácil nos tomamos en serio tu privacidad y la de las personas que se postulan a tus ofertas. En esta política te contamos, sin rodeos, qué datos personales tratamos, para qué, con qué base legal, con quién los compartimos y qué derechos tienes. Está dirigida tanto a las empresas y profesionales que contratan nuestro servicio como a los candidatos que rellenan los formularios públicos. Está redactada conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).",
  "sections": [
    {
      "heading": "1. Quién es el responsable del tratamiento",
      "blocks": [
        {
          "type": "p",
          "text": "El responsable del tratamiento de los datos de las cuentas de empresa cliente es Apúntate Fácil, titularidad de [RAZÓN SOCIAL], con NIF/DNI [NIF/DNI] y domicilio en [DIRECCIÓN POSTAL]. Apúntate Fácil presta un servicio en la nube (SaaS) que permite a empresas y profesionales publicar ofertas de empleo, recibir candidaturas a través de un formulario corto y gestionarlas en un panel filtrable que pueden exportar a Excel."
        },
        {
          "type": "p",
          "text": "Para cualquier cuestión relacionada con esta política o con el tratamiento de tus datos puedes escribirnos a [EMAIL DE CONTACTO] (sugerido: privacidad@apuntatefacil.com). Atendemos las solicitudes en lenguaje claro y sin papeleo innecesario."
        },
        {
          "type": "p",
          "text": "Importante: cuando hablamos de los datos de los candidatos, el responsable del tratamiento NO es Apúntate Fácil, sino la empresa cliente que publica la oferta. En ese caso Apúntate Fácil actúa como encargado del tratamiento. Lo explicamos en detalle en el apartado 5."
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
          "text": "Si eres un candidato y quieres ejercer tus derechos o saber por qué se tratan tus datos, debes dirigirte en primer lugar a la empresa que publicó la oferta a la que te postulaste, porque es la responsable. Nosotros te ayudaremos a redirigir tu solicitud si lo necesitas."
        }
      ]
    },
    {
      "heading": "3. Qué datos tratamos y de quién",
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
            "Email de la cuenta y contraseña (con los que accedes, o bien entras con tu cuenta de Google). La contraseña se guarda siempre cifrada, nunca en claro.",
            "Nombre o razón social de la empresa.",
            "Color o acento de marca, como personalización visual de tu cuenta.",
            "Datos del plan de suscripción contratado (esencial, pro o multi) y estado de la suscripción.",
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
            "Email del candidato, si la empresa configura ese campo (es opcional).",
            "Campos personalizados que cada empresa decida pedir: experiencia, carnet, zona, disponibilidad o cualquier otro que configure en su formulario.",
            "Archivo adjunto opcional, como un CV o documento, almacenado en un espacio privado.",
            "Respuestas a las preguntas del formulario, estado de la candidatura (nuevo, contactado, entrevista, contratado, descartado), calificación de 0 a 3 estrellas y notas internas que escriba la empresa.",
            "Fuente de la candidatura (Milanuncios, enlace o QR) y fecha y hora de envío."
          ]
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
            "Enviarte emails operativos imprescindibles: aviso de nueva candidatura y avisos de tu suscripción (activación, renovación, cancelación). Base: ejecución del contrato (art. 6.1.b), ya que son comunicaciones necesarias para usar el servicio, no publicidad.",
            "Prestar soporte y responder a tus consultas. Base: ejecución del contrato y nuestro interés legítimo en atenderte bien (art. 6.1.b y 6.1.f RGPD).",
            "Mantener la seguridad de la plataforma y prevenir abusos o fraudes. Base: interés legítimo en proteger el servicio y a sus usuarios (art. 6.1.f RGPD)."
          ]
        },
        {
          "type": "p",
          "text": "Conservamos los datos de facturación durante los plazos que nos exige la normativa fiscal y mercantil, aunque te des de baja, por una obligación legal (art. 6.1.c RGPD). Lo detallamos en el apartado 8."
        },
        {
          "type": "p",
          "text": "No enviamos comunicaciones comerciales ni newsletters a partir de los datos de tu cuenta sin tu consentimiento previo. No usamos tus datos para publicidad ni los vendemos a nadie."
        },
        {
          "type": "p",
          "text": "Respecto a los datos de los candidatos, Apúntate Fácil no fija la finalidad ni la base de legitimación: lo hace la empresa cliente como responsable. La empresa es quien debe tener una base legal válida (normalmente la ejecución de medidas precontractuales a petición del candidato, su consentimiento o el interés legítimo del proceso de selección) y quien debe informar a los candidatos. Nosotros solo procesamos esos datos siguiendo las instrucciones de la empresa, para que pueda gestionar su selección."
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
            "Recurrir solo a los subencargados indicados en el apartado 6 e informarte de cambios.",
            "Devolverte o suprimir los datos de candidatos cuando termine el servicio, según tu elección."
          ]
        },
        {
          "type": "p",
          "text": "El registro y aceptación del servicio incluye las condiciones del encargo de tratamiento exigidas por el artículo 28 del RGPD. Si necesitas un acuerdo de encargado del tratamiento firmado aparte para tu documentación, escríbenos a [EMAIL DE CONTACTO] y te lo facilitamos."
        }
      ]
    },
    {
      "heading": "6. Destinatarios y encargados del tratamiento (proveedores)",
      "blocks": [
        {
          "type": "p",
          "text": "No vendemos tus datos ni los de los candidatos, y no los cedemos a terceros salvo obligación legal. Para funcionar, la plataforma se apoya en un número reducido de proveedores que actúan como encargados del tratamiento (o subencargados, cuando se trata de datos de candidatos) y que solo tratan los datos para prestarnos su servicio:"
        },
        {
          "type": "ul",
          "items": [
            "Stripe (Stripe, Inc.): procesa los pagos. Gestiona tu suscripción mensual o anual, cobra el importe según tu plan (150, 250 o 450 EUR más IVA), emite facturas y aplica promociones. Stripe trata los datos de pago y facturación.",
            "Resend (Resend, Inc.): envía los emails transaccionales y los de acceso. Manda el aviso al responsable de la empresa cuando entra una nueva candidatura (ese email incluye el nombre y el teléfono del candidato), los avisos de tu suscripción (activación, cancelación, renovación) y los emails de confirmación de cuenta y de restablecimiento de contraseña.",
            "Supabase (Supabase, Inc.): es la infraestructura. Aloja la base de datos con las tablas de empresas, candidatos, puestos y campañas, gestiona la autenticación y las sesiones, y almacena los CV y documentos adjuntos en un espacio de archivos privado.",
            "Google (Google LLC): solo si eliges entrar con tu cuenta de Google. En ese caso Google interviene en la autenticación y se procesa únicamente tu email de Google para iniciar sesión. Si entras con tu email y contraseña, Google no interviene."
          ]
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
          "text": "Procuramos que los datos se alojen dentro del Espacio Económico Europeo. Nuestra infraestructura de base de datos y almacenamiento (Supabase) está configurada en la región [REGIÓN DE ALOJAMIENTO]."
        },
        {
          "type": "p",
          "text": "Algunos proveedores, como Stripe, Resend o Google, son compañías con sede o infraestructura en Estados Unidos, por lo que ciertos tratamientos pueden implicar una transferencia internacional de datos fuera del EEE."
        },
        {
          "type": "p",
          "text": "Cuando eso ocurre, garantizamos que la transferencia cuenta con las garantías adecuadas exigidas por el RGPD: cláusulas contractuales tipo aprobadas por la Comisión Europea, la adhesión del proveedor al EU-U.S. Data Privacy Framework cuando proceda, u otros mecanismos válidos del Capítulo V del RGPD. Puedes solicitarnos más información sobre estas garantías escribiendo a [EMAIL DE CONTACTO]."
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
            "Datos de tu cuenta de empresa: mientras tengas la cuenta activa. Si te das de baja, los eliminamos o anonimizamos en un plazo razonable tras la cancelación, salvo lo que debamos conservar por ley.",
            "Datos de facturación y pago: durante los plazos exigidos por la normativa fiscal y mercantil (con carácter general, hasta varios años desde la última operación).",
            "Datos de los candidatos: se conservan mientras prestamos el servicio a la empresa responsable y según las instrucciones de esa empresa. La empresa cliente decide cuándo se borran; cuando finaliza el servicio, te devolvemos o suprimimos los datos de candidatos según tu elección.",
            "Datos de soporte y comunicaciones: el tiempo necesario para atender tu consulta y, después, mientras pueda existir responsabilidad derivada de ella."
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
          "text": "Si eres empresa cliente, puedes ejercer estos derechos escribiendo a [EMAIL DE CONTACTO] (sugerido: privacidad@apuntatefacil.com), indicando qué derecho quieres ejercer. Podremos pedirte que acredites tu identidad. Responderemos en el plazo máximo de un mes, ampliable en casos complejos."
        },
        {
          "type": "p",
          "text": "Si eres candidato, recuerda que la responsable de tus datos es la empresa que publicó la oferta: dirige tu solicitud a esa empresa. Como encargado, si nos llega tu petición la trasladaremos a la empresa responsable y la asistiremos para responderte."
        },
        {
          "type": "p",
          "text": "Además, como empresa cliente tienes a tu disposición una herramienta de autoservicio: puedes exportar tus candidatos a Excel desde el panel en cualquier momento, sin tener que pedírnoslo."
        },
        {
          "type": "p",
          "text": "Si consideras que no hemos atendido bien tu solicitud, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD), en www.aepd.es o en su sede de la calle Jorge Juan 6, 28001 Madrid. Antes, si quieres, puedes contactarnos para intentar resolverlo."
        }
      ]
    },
    {
      "heading": "10. Acceso a tu cuenta y cookies",
      "blocks": [
        {
          "type": "p",
          "text": "Para acceder a Apúntate Fácil eliges una contraseña al registrarte con tu email, o entras con tu cuenta de Google (botón 'Continuar con Google'). Si te registras con email, te pedimos que lo confirmes pulsando un enlace que te enviamos, para verificar que es tuyo. Tu contraseña se guarda siempre cifrada (con el algoritmo bcrypt); nunca la vemos ni la guardamos en claro."
        },
        {
          "type": "p",
          "text": "Sobre cookies y rastreo, somos tajantes: no usamos cookies de seguimiento, ni publicidad, ni analítica de terceros. No tenemos Google Analytics, ni Mixpanel, ni Segment, ni ninguna herramienta de seguimiento del comportamiento."
        },
        {
          "type": "p",
          "text": "Solo usamos el almacenamiento imprescindible para que funcione el inicio de sesión. En concreto, Supabase guarda en tu navegador (en memoria y en localStorage) un token de sesión para mantenerte identificado y refrescar tu sesión mientras la usas. En la demo pública, sin login real, solo guardamos en localStorage el estado de ejemplo para que puedas probar la herramienta. Nada de esto rastrea tu navegación ni te perfila, y por eso no requiere un banner de consentimiento de cookies."
        }
      ]
    },
    {
      "heading": "11. Medidas de seguridad",
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
            "Uso de proveedores de infraestructura y pago (Supabase, Stripe) que mantienen estándares reconocidos de seguridad.",
            "Principio de minimización: pedimos y guardamos solo los datos necesarios."
          ]
        },
        {
          "type": "p",
          "text": "Ninguna medida ofrece seguridad absoluta, pero trabajamos para mantenerlas actualizadas. Si se produjera una brecha de seguridad que afecte a tus datos y suponga un riesgo, lo notificaremos conforme exige el RGPD."
        }
      ]
    },
    {
      "heading": "12. Menores de edad",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil es un servicio dirigido a empresas y profesionales, no a menores de edad. No está pensado para que lo usen menores ni recogemos datos de menores de forma consciente a través de las cuentas de empresa."
        },
        {
          "type": "p",
          "text": "En cuanto a los candidatos, corresponde a la empresa responsable, en su proceso de selección, asegurarse de que cumple los requisitos legales de edad para trabajar y de tratamiento de datos. Si detectamos que se han tratado datos de un menor sin la base adecuada, colaboraremos con la empresa responsable para subsanarlo."
        }
      ]
    },
    {
      "heading": "13. Cambios en esta política",
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
          "text": "Si tienes cualquier duda sobre esta política o sobre cómo tratamos tus datos, escríbenos a [EMAIL DE CONTACTO] y te responderemos en lenguaje claro."
        }
      ]
    }
  ],
  "slug": "privacidad",
  "title": "Política de privacidad"
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
          "text": "El servicio Apúntate Fácil lo presta [RAZÓN SOCIAL], con NIF [NIF/DNI] y domicilio en [DIRECCIÓN POSTAL] (en adelante, \"Apúntate Fácil\", \"nosotros\" o \"el prestador\"). Somos los titulares de la web apuntatefacil.com y de la plataforma que se ofrece a través de ella."
        },
        {
          "type": "p",
          "text": "Para cualquier asunto relacionado con estos términos, la contratación o el soporte, puedes escribirnos a hola@apuntatefacil.com. Para todo lo relativo a datos personales y privacidad, el canal es privacidad@apuntatefacil.com. Te contestamos por el mismo medio."
        },
        {
          "type": "p",
          "text": "Estos términos conviven con la Política de Privacidad y, en lo que afecta a los datos de tus candidatos, con el acuerdo de encargado del tratamiento. Donde estos documentos se solapen, debes leerlos como un conjunto coherente."
        }
      ]
    },
    {
      "heading": "2. Qué es el servicio",
      "blocks": [
        {
          "type": "p",
          "text": "Apúntate Fácil es una herramienta para gestionar la contratación en pequeñas y medianas empresas. Tú publicas tu anuncio donde quieras (Milanuncios u otras webs de empleo) y a quien responde le envías un enlace a un formulario corto. Cada candidatura entra ordenada en un panel filtrable que puedes exportar a Excel."
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
            "Exportar tus candidaturas a un archivo Excel desde tu propio navegador.",
            "Guardar adjuntos de los candidatos, como un CV, en un almacenamiento privado."
          ]
        },
        {
          "type": "p",
          "text": "El servicio se presta tal y como se describe en la web en cada momento. Podemos mejorar, ampliar o ajustar las funciones para mantener la plataforma al día, siempre que esos cambios no degraden de forma sustancial lo que has contratado."
        }
      ]
    },
    {
      "heading": "3. Alta, cuenta y acceso",
      "blocks": [
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
          "text": "El servicio se ofrece por suscripción, en tres planes:"
        },
        {
          "type": "ul",
          "items": [
            "Esencial: 150 EUR al mes.",
            "Pro: 250 EUR al mes.",
            "Multi: 450 EUR al mes."
          ]
        },
        {
          "type": "p",
          "text": "Todos los precios se indican sin IVA. Al importe del plan se le suma el IVA que corresponda según la normativa vigente, que verás reflejado en la factura. Las funciones y límites concretos de cada plan son los que aparecen descritos en la web en el momento de la contratación."
        },
        {
          "type": "p",
          "text": "Puedes pagar mes a mes o de forma anual. Si en el momento de contratar el pago anual lleva asociado algún descuento, lo verás indicado en la plataforma antes de confirmar. Si cambias de plan, el nuevo precio se aplica desde el siguiente periodo de facturación, salvo que en la propia plataforma se indique otra cosa al confirmar el cambio."
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
          "text": "El cargo del plan se realiza por adelantado al inicio de cada periodo: cada mes en el pago mensual y cada año en el pago anual. Emitimos la factura correspondiente a través de Stripe con tus datos de empresa, que eres responsable de mantener actualizados."
        },
        {
          "type": "p",
          "text": "Si un cobro falla, podemos reintentarlo durante un plazo razonable. Si el pago sigue sin completarse, podemos suspender o cancelar el acceso al servicio según lo previsto en la cláusula de suspensión y terminación. Salvo que la ley imponga otra cosa o lo indiquemos expresamente, los importes ya pagados por un periodo no se reembolsan de forma proporcional cuando te das de baja antes de que termine ese periodo."
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
          "text": "Antes de que tu acceso termine, conviene que exportes a Excel las candidaturas y descargues los archivos que quieras conservar, porque tras la baja podremos eliminar tus datos conforme a los plazos descritos en la Política de Privacidad."
        }
      ]
    },
    {
      "heading": "7. Probar antes de contratar (demo)",
      "blocks": [
        {
          "type": "p",
          "text": "Puedes ver cómo funciona la plataforma sin registrarte ni introducir ninguna tarjeta a través de la demo pública con datos de ejemplo. Para usar el servicio con tu propia cuenta y datos reales necesitas contratar uno de los planes de pago: no hay un plan gratuito de uso."
        },
        {
          "type": "p",
          "text": "La demo es a título orientativo. Funciona en tu navegador con datos de ejemplo guardados en local; no crea una cuenta ni procesa candidaturas reales, y puede cambiar o no estar disponible en cualquier momento."
        },
        {
          "type": "p",
          "text": "Al registrarte, tu cuenta queda lista pero el panel no se activa hasta que eliges un plan de pago. Sin permanencia: puedes cambiar de plan o cancelar cuando quieras."
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
          "text": "Las condiciones detalladas de este reparto de papeles (instrucciones, subencargados, seguridad, devolución o supresión de datos al terminar) se recogen en el acuerdo de encargado del tratamiento, que forma parte de estos términos y se rige por la Política de Privacidad."
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
            "Usar el servicio para fines ilícitos, fraudulentos, discriminatorios o contrarios a la legislación laboral o de protección de datos.",
            "Pedir a los candidatos datos especialmente sensibles o desproporcionados que no necesites para el puesto.",
            "Intentar acceder a cuentas o datos de otras empresas, vulnerar la seguridad de la plataforma o saltarte sus límites técnicos.",
            "Realizar ingeniería inversa, copiar o revender el software, ni usar el servicio para crear un producto que compita con él.",
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
          "text": "Te recomendamos hacer copias de tus exportaciones por tu cuenta. Tras la baja podremos eliminar tus datos en los plazos de la Política de Privacidad, por lo que conviene que exportes lo que necesites conservar antes de que tu acceso termine."
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
          "text": "Para prestar el servicio nos apoyamos en proveedores que actúan como encargados o subencargados: Stripe para los pagos, Resend para los emails transaccionales (aviso de nueva candidatura y avisos de facturación), Supabase para el alojamiento de la base de datos, la autenticación y el almacenamiento de archivos, y Google para el inicio de sesión opcional con cuenta de Google. No usamos analítica de terceros, ni publicidad, ni rastreo, y solo empleamos el almacenamiento imprescindible para mantener tu sesión."
        },
        {
          "type": "p",
          "text": "Toda la información detallada sobre qué datos tratamos, con qué fines, durante cuánto tiempo, dónde se alojan ([REGIÓN DE ALOJAMIENTO]) y cómo ejercer tus derechos está en la Política de Privacidad. Para los datos de candidatos, las condiciones específicas están en el acuerdo de encargado del tratamiento. Estos términos deben leerse junto con esos documentos."
        }
      ]
    },
    {
      "heading": "12. Propiedad intelectual del software",
      "blocks": [
        {
          "type": "p",
          "text": "El software, la plataforma, la marca Apúntate Fácil, el diseño, los textos y todos los elementos del servicio son de su titular, [RAZÓN SOCIAL], o de quienes nos han cedido los derechos. Están protegidos por la normativa de propiedad intelectual e industrial."
        },
        {
          "type": "p",
          "text": "Mientras tu suscripción esté vigente, te concedemos un derecho de uso del servicio personal, limitado, no exclusivo y no transferible, solo para tu actividad y dentro de estos términos. Este contrato no te transfiere la propiedad del software ni ningún derecho más allá del uso."
        },
        {
          "type": "p",
          "text": "No puedes copiar, modificar, distribuir, sublicenciar ni explotar el software o la marca fuera de lo que estos términos permiten. Esta cláusula no afecta a la propiedad de tus datos, que siguen siendo tuyos como se explica en la cláusula correspondiente."
        }
      ]
    },
    {
      "heading": "13. Disponibilidad del servicio y garantías",
      "blocks": [
        {
          "type": "p",
          "text": "Ponemos un esfuerzo razonable en mantener el servicio disponible y funcionando correctamente. Aun así, ningún servicio en internet está disponible el 100% del tiempo: puede haber cortes, mantenimientos planificados o incidencias de nuestros proveedores (como Supabase, Stripe, Resend o Google) que escapan a nuestro control directo."
        },
        {
          "type": "p",
          "text": "El servicio se presta tal cual está disponible en cada momento. Más allá de las garantías que la ley impone con carácter imperativo, no ofrecemos garantías de que el servicio vaya a estar siempre libre de errores o interrupciones, ni de que se adapte a un fin concreto distinto del descrito."
        },
        {
          "type": "p",
          "text": "Cuando tengamos que hacer un mantenimiento que pueda afectar al uso normal, intentaremos avisarte con antelación y elegir momentos de menor impacto siempre que sea posible."
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
          "text": "En la medida que la ley permite, no respondemos de daños indirectos, lucro cesante, pérdida de oportunidades de negocio ni pérdida de datos que tú podrías haber evitado con tus propias exportaciones y copias. Nuestra responsabilidad total frente a ti por cualquier reclamación relacionada con el servicio se limita al importe que nos hayas pagado por la suscripción en los doce meses anteriores al hecho que origine la reclamación."
        },
        {
          "type": "p",
          "text": "Nada en estos términos excluye o limita nuestra responsabilidad en aquello que la ley no permita limitar, como el dolo o la culpa grave. Como este es un servicio entre empresas (B2B), estas limitaciones se entienden pactadas entre profesionales y no afectan a derechos de consumidores, que aquí no aplican."
        }
      ]
    },
    {
      "heading": "15. Suspensión y terminación",
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
          "text": "Cuando sea posible y proporcionado, te avisaremos antes de suspender y te daremos un plazo razonable para corregir el problema. Tras la terminación, dejas de tener acceso al servicio y gestionamos tus datos según la Política de Privacidad y el acuerdo de encargado, dándote la oportunidad de exportar lo que necesites cuando las circunstancias lo permitan."
        }
      ]
    },
    {
      "heading": "16. Cambios en los términos y en los precios",
      "blocks": [
        {
          "type": "p",
          "text": "Podemos actualizar estos términos para reflejar mejoras del servicio, cambios legales o ajustes operativos. Cuando el cambio sea relevante, te lo comunicaremos por un medio razonable (por ejemplo, por email o dentro de la plataforma) con una antelación suficiente antes de que entre en vigor."
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
      "heading": "17. Legislación aplicable y resolución de conflictos",
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
          "text": "Si alguna cláusula de estos términos se declarara nula o inaplicable, el resto seguirá en vigor. Estos términos, junto con la Política de Privacidad y el acuerdo de encargado del tratamiento, forman el acuerdo completo entre tu empresa y nosotros sobre el uso del servicio."
        }
      ]
    }
  ]
}

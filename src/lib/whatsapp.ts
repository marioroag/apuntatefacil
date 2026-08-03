/**
 * ¿Podemos escribirle NOSOTROS a un candidato por WhatsApp?
 *
 * Hoy no, y por eso esto está en `false`: falta el número propio dado de alta
 * en Meta con sus plantillas aprobadas. El código del canal está entero y
 * probado (el agente, la cola, el webhook), pero mientras no haya número, cada
 * botón que acabe en un mensaje es una promesa que la app no puede cumplir: o
 * falla en silencio, o sale desde un número de pruebas que no es el de la
 * empresa. Las dos cosas las paga el candidato, que es quien recibe.
 *
 * Con la bandera apagada, ninguna superficie ofrece una acción que termine en un
 * WhatsApp nuestro: en su lugar se dice qué falta y cuál es el camino que SÍ
 * funciona hoy (apuntar la cita a mano y avisar tú, o preguntar por correo).
 *
 * Lo que esta bandera NO apaga, a propósito:
 *
 *   * Los enlaces `wa.me` de la ficha, del tablón y del resumen de Meridian. Ahí
 *     el WhatsApp es el DEL EMPRESARIO: se abre en su teléfono, lo escribe él y
 *     funciona hoy igual que antes.
 *   * El consentimiento del formulario público. Se sigue pidiendo porque es
 *     permiso para el día que se encienda: quien se apunta hoy no tendrá que
 *     volver a apuntarse. Apagarlo dejaría al canal empezando con la base de
 *     candidatos entera fuera.
 *   * La agenda de entrevistas ni agendar a mano: no mandan nada. Ni los ajustes
 *     de calendario, que la cita a mano también usa.
 *
 * Para encenderlo, cuando el número esté: `true` aquí y los secrets del canal
 * (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) puestos. No hay nada más que
 * tocar, y lo vigila `whatsapp.test.ts`: cada camino que manda un mensaje pasa
 * por esta constante.
 */
// El tipo se declara a mano (como `MERIDIAN_CHAT_ENABLED`): sin él, TypeScript
// la estrecha al literal `false` y cada `if (WHATSAPP_LISTO)` se convierte en
// una comparación "imposible" que el compilador señala como error.
export const WHATSAPP_LISTO: boolean = false

/**
 * Lo que se dice mientras tanto, en UN solo sitio.
 *
 * Es la regla de siempre: si el texto se escribe en cada pantalla, el día que se
 * encienda quedarán dos o tres avisos vivos contando algo que ya no pasa. Y
 * "WIP" no se le enseña a nadie: quien lo lee es un empresario esperando a
 * llamar a un candidato, no alguien mirando nuestro tablero.
 */
export const WHATSAPP_WIP = {
  /** Para chapas y pestañas. Dos palabras, sentence case. */
  etiqueta: 'En preparación',
  titulo: 'Todavía no escribimos por WhatsApp',
  /** El párrafo del panel: qué falta y qué puedes hacer hoy. */
  cuerpo:
    'Estamos dando de alta nuestro número de WhatsApp para poder hablar con tus candidatos. ' +
    'Hasta que esté, esto no manda ningún mensaje.',
  /** Una línea, para donde el WhatsApp era una opción y no el asunto. */
  linea: 'WhatsApp todavía no está disponible: estamos dando de alta el número.',
} as const

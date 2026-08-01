// El vocabulario del canal, normalizado.
//
// Esto es la abstracción de proveedor de verdad. No está en la carpeta: está en
// que el dominio SOLO habla este idioma y nunca ve un `wamid`, ni un código
// 131047, ni la forma que Meta le da a un webhook. `whatsappMeta.ts` es hoy la
// única implementación y el único sitio donde vive esa traducción. Cambiar a
// Twilio o a 360dialog mañana es escribir un segundo fichero, no repasar la
// aplicación entera buscando llamadas sueltas.
//
// Sin imports a propósito, igual que schedule/: lo cargan Deno y vitest.

/** Una opción pulsable. El id vuelve tal cual en el webhook, así que lo usamos
 *  para llevar dentro la conversación y la ronda: nunca hay que adivinar a qué
 *  contestaba el candidato. */
export interface Opcion {
  id: string
  titulo: string        // <= 24 caracteres en botones, <= 24 en filas de lista
  descripcion?: string  // solo en listas, <= 72
}

export interface Plantilla {
  nombre: string
  idioma: string
  /** Variables del cuerpo, en orden. Meta las numera {{1}}, {{2}}... */
  variables: string[]
  /**
   * Carga de los botones de respuesta rápida, en el orden en que están
   * aprobados en la plantilla. Es lo que vuelve cuando el candidato los pulsa,
   * así que aquí va la conversación dentro: una plantilla es la misma para
   * todos, y sin esto no habría forma de saber quién contestó.
   */
  botonesPayload?: string[]
}

/**
 * El punto del mapa. Es un mensaje aparte y no un enlace dentro del texto
 * porque en WhatsApp se ve como un mapa y se abre en Maps de un toque, que es
 * exactamente lo que hace una persona cuando queda contigo en una nave.
 */
export interface Ubicacion {
  lat: number
  lng: number
  nombre?: string
  direccion?: string
}

export interface MensajeSaliente {
  /** Texto libre. Solo válido dentro de la ventana de 24 h. */
  texto?: string
  /** Plantilla aprobada. Lo único que se puede mandar fuera de la ventana. */
  plantilla?: Plantilla
  /** Botones (hasta 3) o lista (hasta 10). También solo dentro de la ventana. */
  opciones?: Opcion[]
  /** Encabezado de la lista de opciones. */
  cabecera?: string
  /** Punto del mapa. Como el texto libre, solo dentro de la ventana. */
  ubicacion?: Ubicacion
}

/**
 * Las clases de fallo que el dominio necesita distinguir para decidir. Ni una
 * más: si hiciera falta mirar el número del error para saber qué hacer, la
 * abstracción no estaría haciendo su trabajo.
 */
export type ClaseFallo =
  | 'ventana_cerrada'   // fuera de las 24 h: hay que mandar plantilla
  | 'no_entregable'     // ese número no recibe WhatsApp. Terminal, avisa al cliente
  | 'limite'            // demasiados mensajes. Reintentar más tarde
  | 'config'            // plantilla mal, token caducado... culpa NUESTRA, no del cliente
  | 'cuenta'            // la cuenta de WhatsApp tiene un problema. Culpa nuestra
  | 'transitorio'       // se cayó algo. Reintentar

export interface FalloCanal {
  clase: ClaseFallo
  codigo: number
  detalle: string
}

export interface ResultadoEnvio {
  ok: boolean
  providerMessageId?: string
  /** El wa_id REAL que el proveedor dice que corresponde a ese número. Puede no
   *  coincidir con el que mandamos (el 9 inicial de algunos países, por
   *  ejemplo): a partir de aquí manda este. */
  waId?: string
  fallo?: FalloCanal
}

export interface EventoEntrante {
  providerMessageId: string
  waId: string
  /** El número nuestro al que escribió: identifica el sender cuando haya varios. */
  destinoPhoneNumberId: string
  tipo: 'texto' | 'opcion' | 'no_soportado'
  texto?: string
  /** Id de la opción pulsada, tal cual se lo dimos. */
  opcionId?: string
  timestamp: string
}

export interface EstadoEntrega {
  providerMessageId: string
  estado: 'enviado' | 'entregado' | 'leido' | 'fallido'
  codigo?: number
  detalle?: string
}

export interface Sender {
  phoneNumberId: string
  token: string
}

export interface MessagingProvider {
  enviar(sender: Sender, destinoWaId: string, msg: MensajeSaliente): Promise<ResultadoEnvio>
  /**
   * Traduce el cuerpo CRUDO del webhook. Crudo y no parseado porque la firma se
   * comprueba sobre los bytes exactos que llegaron: volver a serializar un
   * objeto ya cambia el orden de las claves y la firma deja de cuadrar.
   */
  normalizarWebhook(cuerpoCrudo: string): { entrantes: EventoEntrante[]; estados: EstadoEntrega[] }
}

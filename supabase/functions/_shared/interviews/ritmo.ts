// Cuánto se espera antes de contestar. Dominio puro: SIN imports, para que lo
// carguen igual Deno (el webhook) y vitest (las pruebas).
//
// El problema, tal cual: en un chat la gente escribe a ráfagas, así que hay que
// esperar antes de responder o se contestan trozos sueltos. Pero una espera
// fija es o demasiado corta (parte frases) o demasiado larga (la conversación
// se siente muerta). Con 20 segundos fijos, Mario lo describió como que tardaba
// demasiado, y tenía razón: la mayoría de los mensajes ya estaban terminados.
//
// La salida es no preguntarse "cuánto espero" sino "¿ha terminado de hablar?".
// Y eso el texto lo dice bastante bien:
//
//   * "hola"                      -> casi seguro que viene más. Espera larga.
//   * "es que el martes no puedo y" -> está a media frase. Espera larga.
//   * "¿qué horas tienes el jueves?" -> ya ha dicho lo que quería. Espera corta.
//
// Equivocarse por corto solo cuesta contestar dos veces, que en un chat tampoco
// es raro. Equivocarse por largo cuesta que parezca que no hay nadie.

/** Un arranque: saludo suelto o frase a medias. Casi siempre viene más. */
export const ARRANQUE = 18
/** Lo normal cuando no hay señales claras. */
export const NORMAL = 9
/** Ha cerrado la idea (una pregunta entera). Se le contesta ya. */
export const CERRADO = 5

const SALUDOS = new Set([
  'hola', 'holaa', 'holaaa', 'buenas', 'wenas', 'buenos dias', 'buenas tardes',
  'buenas noches', 'hey', 'ey', 'hi', 'saludos', 'que tal', 'como estas',
  'buenas!', 'holi',
])

/**
 * Palabras con las que nadie termina un mensaje si ha dicho todo lo que quería.
 * Si el mensaje acaba en una de estas, está a media frase.
 */
const CONECTORES = new Set([
  'y', 'e', 'o', 'u', 'que', 'pero', 'porque', 'aunque', 'cuando', 'mientras',
  'para', 'por', 'de', 'del', 'con', 'sin', 'en', 'a', 'al', 'la', 'el', 'los',
  'las', 'un', 'una', 'unos', 'unas', 'mi', 'tu', 'su', 'es', 'esta', 'estoy',
  'seria', 'sera', 'tengo', 'puedo', 'quiero', 'me', 'te', 'se', 'lo', 'le',
  // 'si' solo cuenta como conector cuando NO es el mensaje entero ("quería
  // preguntar si"), y de eso se encarga el `palabras.length > 1` de abajo. Un
  // "si" a secas es una respuesta completa y está en RESPUESTAS.
  'si',
])

/**
 * Respuestas cortas que SÍ son un mensaje entero. Sin esto caerían en la regla
 * de "muy corto, seguro que sigue" y un simple "vale" esperaría 18 segundos,
 * que es justo la sensación de que no hay nadie al otro lado.
 */
const RESPUESTAS = new Set([
  'si', 'sip', 'no', 'nop', 'vale', 'ok', 'okey', 'claro', 'perfecto', 'genial',
  'gracias', 'venga', 'de acuerdo', 'me interesa', 'adelante', 'correcto', 'exacto',
])

/** Sin acentos y en minúsculas, para comparar "miércoles" con "miercoles". */
function plano(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Segundos de silencio que hay que ver antes de contestar a este mensaje.
 *
 * La ventana se REINICIA con cada mensaje suyo, así que esto no es "cuánto
 * tarda la respuesta" sino "cuánto callo desde lo último que dijo". Si sigue
 * escribiendo, seguimos esperando.
 */
export function esperaSegundos(texto: string): number {
  const t = plano(texto).trim()
  if (!t) return NORMAL

  // Se quitan los signos de los DOS extremos: en español los hay de apertura, y
  // sin ellos "¿qué tal?" no se reconocía como el saludo que es.
  const desnudo = t.replace(/^[¿¡]+/g, '').replace(/[¿?¡!.,;:…]+$/g, '')
    .replace(/\s+/g, ' ').trim()
  if (!desnudo) return NORMAL
  const palabras = desnudo.split(' ')
  const ultima = palabras[palabras.length - 1]

  // Un saludo a secas nunca es el mensaje: es el carraspeo antes del mensaje.
  if (SALUDOS.has(desnudo)) return ARRANQUE
  // A media frase.
  if (palabras.length > 1 && CONECTORES.has(ultima)) return ARRANQUE
  // Puntos suspensivos: literalmente "sigo".
  if (/[.…]{2,}\s*$/.test(t)) return ARRANQUE

  // Cortas pero completas. Van antes de la regla de longitud a propósito.
  if (RESPUESTAS.has(desnudo)) return NORMAL

  // Un trozo muy corto y sin cerrar casi siempre tiene continuación.
  if (desnudo.length <= 12 && !/[?!.]\s*$/.test(t)) return ARRANQUE

  // Una pregunta entera ya ha dicho lo que quería: se le contesta pronto.
  if (/\?\s*$/.test(t) && desnudo.length >= 12) return CERRADO

  return NORMAL
}

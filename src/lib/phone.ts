// El teléfono que teclea el candidato -> el identificador con el que WhatsApp
// lo conoce (wa_id: dígitos, con prefijo de país, sin '+').
//
// ESPEJO de `public.wa_id_de(text)` (migración 20260801220000_whatsapp_channel).
// La de SQL es la que manda: es la que decide de verdad a quién se escribe, y
// corre dentro de la misma transacción que crea la conversación. Esta copia
// existe para poder CONTAR a cuántos se va a escribir antes de enviar, sin
// pedirle al servidor que resuelva 600 teléfonos para pintar un número.
//
// Si divergen, lo que se rompe es el recuento de la vista previa, no el envío:
// el servidor vuelve a decidir y devuelve los omitidos. Aun así conviene que
// digan lo mismo, y por eso las reglas están en el mismo orden que allí.

/** Todo lo que en el texto tenga pinta de número de teléfono. */
function trozos(bruto: string): string[] {
  // Se detectan ANTES de limpiar: limpiar dos números pegados daría uno solo,
  // y de ahí saldría un número que no existe.
  const hallados = bruto.match(/\+?\d[\d \-().]{6,}\d/g)
  return hallados?.length ? hallados : [bruto]
}

function normalizarUno(trozo: string): string | null {
  let internacional = /^\s*\+/.test(trozo)
  let d = trozo.replace(/\D/g, '')
  if (d.startsWith('00')) {
    d = d.slice(2)
    internacional = true
  }
  // Nueve dígitos empezando por 6, 7, 8 o 9: español sin prefijo. Sin
  // ambigüedad posible, porque en España ningún número empieza por 3.
  if (d.length === 9 && /^[6789]/.test(d)) return `34${d}`
  // Once empezando por 34 y con forma española detrás: ya lo trae puesto.
  if (d.length === 11 && d.startsWith('34') && /^[6789]/.test(d.slice(2))) return d
  // Dice ser español pero no lo parece. De España sí sabemos cómo son los
  // números: un +34 con ocho dígitos es una errata, y mandarlo es escribirle
  // a otro.
  if (d.startsWith('34')) return null
  // Con '+' o con '00': internacional de un país que no conocemos. Se acepta
  // con una longitud plausible y que Meta diga si existe. Mejor eso que
  // rechazar a un portugués o a un rumano, que en este sector son muchos.
  if (internacional && d.length >= 8 && d.length <= 15) return d
  return null
}

/**
 * Null ante cualquier duda, incluida la casilla con dos números distintos:
 * escribirle a quien no toca es peor que no escribir.
 */
export function waIdDe(bruto: string | null | undefined): string | null {
  if (!bruto || !bruto.trim()) return null
  const validos = new Set<string>()
  for (const trozo of trozos(bruto)) {
    const uno = normalizarUno(trozo)
    if (uno) validos.add(uno)
  }
  // Uno solo y reconocible, o varios que dicen lo mismo.
  return validos.size === 1 ? [...validos][0] : null
}

/**
 * El teléfono de una candidatura. La clave es fija (`telefono`) y no se busca
 * por tipo de campo como el correo: el formulario público la escribe siempre
 * ahí, y es lo mismo que lee `start_interview_invitation`.
 */
export function extractCandidatePhone(answers: Record<string, unknown>): string | null {
  const bruto = answers.telefono
  return typeof bruto === 'string' ? waIdDe(bruto) : null
}

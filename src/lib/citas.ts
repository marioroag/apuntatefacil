// ============================================================================
// Localización de citas de Meridian dentro del texto de un PDF. Es la mitad
// CLIENTE del contrato del subrayado: el evaluador está obligado a citar
// literal y contiguo (prompt en _shared/triaje.ts), y este módulo busca esa
// cita en los items de texto que extrae pdf.js para poder pintarla encima del
// documento. La verificación la hace el código, no el prompt: una cita que no
// se encuentra NO se subraya, y eso es lo que convierte el subrayado en la
// prueba física de que Meridian no se inventa nada.
//
// El módulo es PURO (sin pdf.js, sin DOM): recibe items con su texto y
// devuelve tramos por item. Así lo comparten el visor (items de pdf.js) y el
// guardián de la demo (el texto plano de los CVs ficticios), y lo carga vitest.
//
// La decisión que lo hace robusto: la normalización BORRA el whitespace en
// los dos lados. El servidor extrae con unpdf y el cliente con pdf.js, y cada
// uno trocea las líneas y los espacios a su manera ("Exper"+"iencia" en dos
// items, dobles espacios, saltos); quitándolo entero, todas esas variantes
// colapsan en la misma cadena y la búsqueda deja de depender del troceado.
// ============================================================================

/** Tramo de una cita dentro de UN item: offsets sobre el texto ORIGINAL del
 *  item (los que el visor convierte en un rect). Una cita que cruza varios
 *  items (líneas) sale en varios tramos. */
export interface TramoCita {
  item: number
  desde: number
  hasta: number
}

/** Una cita más corta que esto (sin espacios) no se busca: con tan poco texto
 *  los falsos positivos ganan a los aciertos, y subrayar el trozo equivocado
 *  es peor que no subrayar. */
export const MIN_CITA = 12

/**
 * Normaliza para COMPARAR, no para enseñar: minúsculas, sin acentos, comillas
 * y guiones tipográficos unificados, guion blando fuera y whitespace BORRADO.
 * Se aplica igual a la cita y al texto del documento; solo así da igual que
 * el modelo escriba "camión" y el PDF tenga "CAMIÓN" partido en dos items.
 */
export function normalizarCita(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas diacríticas sueltas tras NFD
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u00b4`]/g, "'") // comillas simples tipográficas
    .replace(/[\u201c\u201d\u201e]/g, '"') // comillas dobles tipográficas
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-') // guiones tipográficos
    .replace(/\u00ad/g, '') // guion blando
    .replace(/\s+/g, '')
}

interface PosChar {
  item: number
  offset: number
}

// Aplana los items en una sola cadena normalizada, guardando por cada carácter
// de qué item y de qué posición original salió (el camino de vuelta al rect).
function aplanar(items: { str: string }[]): { chars: string[]; pos: PosChar[] } {
  const chars: string[] = []
  const pos: PosChar[] = []
  items.forEach((it, item) => {
    for (let offset = 0; offset < it.str.length; offset++) {
      const norm = normalizarCita(it.str[offset])
      // Un espacio, un guion blando o una marca diacrítica normalizan a nada:
      // ese carácter original no aporta nada que buscar.
      for (const ch of norm) {
        chars.push(ch)
        pos.push({ item, offset })
      }
    }
  })
  return { chars, pos }
}

// Agrupa las posiciones en un tramo [desde, hasta) por item. Las posiciones
// llegan en orden, y los huecos DENTRO de un item son solo caracteres que
// normalizan a nada (espacios, guion blando): el tramo los cubre, porque el
// subrayado de "una frase con espacios" es un rect, no uno por palabra.
function aTramos(pos: PosChar[]): TramoCita[] {
  const tramos: TramoCita[] = []
  for (const p of pos) {
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.item === p.item && p.offset >= ultimo.desde) {
      ultimo.hasta = Math.max(ultimo.hasta, p.offset + 1)
    } else {
      tramos.push({ item: p.item, desde: p.offset, hasta: p.offset + 1 })
    }
  }
  return tramos
}

/**
 * Busca la cita en los items y devuelve sus tramos, o null si no está (y
 * entonces no se subraya nada: la degradación silenciosa es el diseño). El
 * segundo intento quita los guiones de los dos lados, que es como se cuela la
 * partición de línea de un PDF ("instala-" + "ciones" contra "instalaciones").
 */
export function localizarCita(cita: string, items: { str: string }[]): TramoCita[] | null {
  const needle = normalizarCita(cita)
  if (needle.length < MIN_CITA) return null
  const { chars, pos } = aplanar(items)
  const idx = chars.join('').indexOf(needle)
  if (idx >= 0) return aTramos(pos.slice(idx, idx + needle.length))

  // Sin guiones a ambos lados. Se filtra el pajar una vez, conservando el mapa.
  const needle2 = needle.replace(/-/g, '')
  if (needle2.length < MIN_CITA) return null
  const chars2: string[] = []
  const pos2: PosChar[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '-') continue
    chars2.push(chars[i])
    pos2.push(pos[i])
  }
  const idx2 = chars2.join('').indexOf(needle2)
  if (idx2 < 0) return null
  return aTramos(pos2.slice(idx2, idx2 + needle2.length))
}

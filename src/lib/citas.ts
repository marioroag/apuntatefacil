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
 * entonces no se subraya nada: la degradación silenciosa es el diseño). Tres
 * intentos, del más estricto al más tolerante:
 *  1. exacto (normalizado);
 *  2. sin guiones a los dos lados, que es como se cuela la partición de línea
 *     de un PDF ("instala-" + "ciones" contra "instalaciones");
 *  3. APROXIMADO: la mejor ventana del documento a distancia de edición ≤ 25%
 *     de la cita. Existe porque el evaluador debe citar literal y el modelo a
 *     veces parafrasea un pelo ("en WIERTZ" donde el CV pone "· WIERTZ"), y
 *     sin este intento la cita real se quedaba sin marca y el enlace del
 *     informe saltaba a ninguna parte. El umbral es la frontera de la
 *     honestidad: por debajo se subraya lo que ES la cita con otra puntuación;
 *     por encima sería subrayar un trozo que se le parece.
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
  if (idx2 >= 0) return aTramos(pos2.slice(idx2, idx2 + needle2.length))

  const aprox = mejorVentana(chars2.join(''), needle2)
  if (!aprox) return null
  return aTramos(pos2.slice(aprox.desde, aprox.hasta))
}

// Alineamiento semiglobal (la cita entera contra cualquier ventana del pajar),
// con seguimiento del inicio de la ventana para poder volver a los items. Es
// O(pajar x cita): con un CV normalizado de ~8000 caracteres y citas de ≤200,
// decenas de milisegundos, y solo corre cuando los intentos exactos fallan.
function mejorVentana(pajar: string, cita: string): { desde: number; hasta: number } | null {
  const N = pajar.length
  const M = cita.length
  if (N === 0 || M === 0) return null
  let prevD = new Array<number>(N + 1).fill(0)
  let prevS = Array.from({ length: N + 1 }, (_, j) => j)
  for (let i = 1; i <= M; i++) {
    const curD = new Array<number>(N + 1)
    const curS = new Array<number>(N + 1)
    curD[0] = i
    curS[0] = 0
    const c = cita.charCodeAt(i - 1)
    for (let j = 1; j <= N; j++) {
      let d = prevD[j - 1] + (pajar.charCodeAt(j - 1) === c ? 0 : 1)
      let s = prevS[j - 1]
      if (prevD[j] + 1 < d) {
        d = prevD[j] + 1
        s = prevS[j]
      }
      if (curD[j - 1] + 1 < d) {
        d = curD[j - 1] + 1
        s = curS[j - 1]
      }
      curD[j] = d
      curS[j] = s
    }
    prevD = curD
    prevS = curS
  }
  let mejor = Infinity
  let fin = -1
  for (let j = 0; j <= N; j++) {
    if (prevD[j] < mejor) {
      mejor = prevD[j]
      fin = j
    }
  }
  const tope = Math.max(2, Math.round(M * 0.25))
  if (mejor > tope || fin <= prevS[fin]) return null
  return { desde: prevS[fin], hasta: fin }
}

// ----------------------------------------------------------------------------
// Geometría de la marca: dos ayudas puras para que el rect caiga donde caen
// las letras. pdf.js da el ancho del ITEM entero, no de cada carácter, así que
// el recorte parcial se estima; estimarlo por NÚMERO de caracteres derrapaba
// una letra o dos con fuentes proporcionales (una "i" no mide lo que una "m").
// ----------------------------------------------------------------------------

/** Un marcador de verdad cubre palabras enteras: el tramo se estira hasta los
 *  límites de palabra, y de paso absorbe el pelo de deriva que le quede a la
 *  estimación de anchos. */
export function ajustarAPalabras(str: string, desde: number, hasta: number): { desde: number; hasta: number } {
  let d = Math.max(0, Math.min(desde, str.length))
  while (d > 0 && !/\s/.test(str[d - 1])) d--
  let h = Math.max(d, Math.min(hasta, str.length))
  while (h < str.length && !/\s/.test(str[h])) h++
  return { desde: d, hasta: h }
}

const ESTRECHO = /[iíìîïjltf!.,:;'"|()[\]{}\s·-]/
const ANCHO = /[mwMW@ÑÆŒ]/
const MAYUSCULA = /[A-ZÁÉÍÓÚÜ0-9]/

function pesoChar(ch: string): number {
  if (ESTRECHO.test(ch)) return 0.5
  if (ANCHO.test(ch)) return 1.5
  if (MAYUSCULA.test(ch)) return 1.15
  return 1
}

/** Qué fracción del ancho del item queda a la IZQUIERDA de `offset`, pesando
 *  cada carácter por su anchura típica. Heurística, no medición: para un
 *  marcador basta, y la alternativa de verdad (pintar la capa de texto de
 *  pdf.js y medir con el navegador) cuesta una pieza entera. */
export function fraccionAvance(str: string, offset: number): number {
  const fin = Math.max(0, Math.min(offset, str.length))
  let hasta = 0
  let total = 0
  for (let i = 0; i < str.length; i++) {
    const w = pesoChar(str[i])
    total += w
    if (i < fin) hasta += w
  }
  return total > 0 ? hasta / total : 0
}

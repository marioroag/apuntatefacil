// EL CARRIL DE UN FILTRO NUMÉRICO NO SE LO CREE TODO (sep 2026).
//
// El slider de una pregunta numérica no tiene rango propio: se lo calcula de las
// RESPUESTAS, así que un solo valor imposible define el carril entero. Pasó en un
// puesto real de Solera Canarias: "años de experiencia en obra" ofrecía de -1 a
// 642943969 porque alguien escribió su móvil (642 94 39 69) donde iban los años y
// otro escribió "-1". Con ese recorrido, los 214 candidatos de verdad (0-40 años)
// caben en menos de un píxel del carril: el filtro queda inservible para todos por
// culpa de dos respuestas.
//
// Aquí se contestan las dos preguntas que lo arreglan, y se contestan JUNTAS
// porque son la misma decisión: qué es un número válido y hasta dónde llega el
// carril. Escritas por separado, el campo aceptaría lo que el carril luego
// descarta.
//
// LA REGLA DE ORO, Y ES LO QUE HACE QUE ESTO SE PUEDA HACER SIN MIEDO: recortar el
// carril NO deja a nadie fuera del resultado. Con un mango en su tope, ese lado se
// guarda como `null` (sin límite), así que el candidato de 45 años sigue entrando
// en "de 20 en adelante" aunque el carril acabe en 38. El percentil decide la
// ESCALA del control, nunca quién sale en la lista. Por eso el error de recortar
// de más es barato (el carril se estrecha) y el de recortar de menos es
// catastrófico (el carril no se puede usar), y por eso el recorte se elige
// generoso.

/**
 * El suelo de una pregunta numérica. Todo lo que este producto pregunta en
 * números es una cantidad (años de experiencia, kilómetros hasta la obra, salario
 * deseado): ninguna puede ser negativa, así que un negativo no es un dato bajo,
 * es basura, y se descarta igual que se descarta un texto.
 *
 * Lo leen los DOS lados: el `min` del campo del formulario (que impide escribir
 * uno nuevo) y esta lectura (que impide que un negativo ya guardado estire el
 * carril). Escrito en un solo sitio, la puerta y la aduana no pueden separarse.
 */
export const MINIMO_NUMERICO = 0

/**
 * Fracción de valores que se descarta por cada extremo antes de medir el carril:
 * el percentil 5 y el 95, dicho de la forma que se puede leer.
 *
 * Se aplica por RANGO y no interpolando, o sea "quita los k más altos y los k más
 * bajos", con k = floor(n * 0,05). Eso trae de regalo el suelo de muestra sin
 * declararlo aparte: por debajo de 20 valores k sale 0 y no se recorta nada, que
 * es lo correcto porque con quince candidatos un percentil no significa nada (y
 * las quince filas se leen a ojo). Interpolando no valdría: con cinco valores, el
 * p95 interpolado cae ENTRE el cuarto y el quinto, o sea que el propio valor
 * absurdo contamina el número con el que ibas a descartarlo.
 */
const RECORTE = 0.05

/**
 * Cuánto tiene que sobresalir un extremo, medido en anchuras del cuerpo de la
 * distribución, para que se le considere absurdo y se recorte.
 *
 * Existe para NO estrechar el carril cuando los datos están limpios: con 215
 * respuestas de 1 a 40 años, el percentil 95 vale 38 y el máximo real es 40, o sea
 * que sobresale una fracción de anchura y el carril se queda en [1, 40], que es lo
 * que había antes de todo esto. Con el móvil dentro, el máximo sobresale
 * diecisiete millones de anchuras y se recorta.
 *
 * El 3 es el criterio de Tukey para un valor atípico extremo, con percentiles en
 * vez de cuartiles. No se afina más: entre 2 y 5 la respuesta es la misma en todos
 * los casos que hemos visto, porque lo que separa a una cola larga legítima (un
 * salario deseado de 200.000) de una respuesta equivocada (un teléfono) son varios
 * órdenes de magnitud, no un factor.
 */
const VECES_ANCHURA = 3

/**
 * El carril de un slider: el tramo donde de verdad están los candidatos.
 *
 * Devuelve `null` cuando no hay slider que pintar (sin valores válidos, o todos
 * iguales: un carril de un solo punto no filtra nada).
 *
 * Acepta lo que venga en `answers`, que es un jsonb y puede traer cualquier cosa:
 * la aduana es esta función, como `leerAnuncio` lo es del anuncio.
 */
export function rangoNumerico(crudos: unknown[]): [number, number] | null {
  const vals: number[] = []
  for (const v of crudos) {
    if (typeof v !== 'string' && typeof v !== 'number') continue
    // Una respuesta EN BLANCO no es un cero, y esto es lo que más veces se cuela:
    // `Number('')` vale 0, no NaN, así que cada pregunta opcional sin contestar
    // metía un 0 en el carril y lo estiraba hacia abajo por su cuenta. Lo cazó su
    // guardián al primer intento.
    if (typeof v === 'string' && v.trim() === '') continue
    const n = Number(v)
    // `Number.isFinite` y no `!Number.isNaN`: el segundo deja pasar Infinity, que
    // en un Math.max se lleva el carril entero. Y el suelo del campo se aplica
    // aquí, descartando el valor en vez de subirlo a cero: una respuesta de "-1"
    // no significa "cero años", significa que no sabemos qué quiso decir.
    if (Number.isFinite(n) && n >= MINIMO_NUMERICO) vals.push(n)
  }
  if (vals.length < 2) return null

  const orden = [...vals].sort((a, b) => a - b)
  const lo = orden[0]
  const hi = orden[orden.length - 1]

  // El cuerpo de la distribución, sin sus dos colas.
  const k = Math.floor(orden.length * RECORTE)
  const pLo = orden[k]
  const pHi = orden[orden.length - 1 - k]
  const anchura = pHi - pLo

  // Sin anchura no hay con qué juzgar si un extremo sobresale (todo el cuerpo es
  // el mismo número), así que no se recorta: el carril es el real. Con quince
  // respuestas de "5 años" y una de "12", el carril correcto es [5, 12].
  if (anchura <= 0) return hi > lo ? [lo, hi] : null

  // El criterio es el mismo por los dos lados, pero conviene saber que ABAJO casi
  // nunca hará falta, y que está bien que así sea: con el suelo del campo en cero,
  // lo más lejos que puede caer un valor bajo es el propio cero, así que el daño
  // está acotado por construcción (lo peor es que el cuerpo ocupe media pista, no
  // una millonésima). Solo actúa cuando el cuerpo está muy apretado y alguien se
  // deja un dígito.
  const techo = pHi + anchura * VECES_ANCHURA
  const suelo = pLo - anchura * VECES_ANCHURA
  const desde = lo < suelo ? pLo : lo
  const hasta = hi > techo ? pHi : hi

  return hasta > desde ? [desde, hasta] : null
}

/**
 * Lo que dice la etiqueta del rango, y dice lo que el FILTRO hace, no dónde están
 * los mangos.
 *
 * Con el carril recortado, un mango en su tope ya no significa "hasta 38",
 * significa "de 38 en adelante, sin límite"; escribir el número sería mentirle a
 * quien lo lee sobre a quién está dejando fuera. Un control que no puede decir la
 * verdad sobre lo que hace es peor que no tenerlo.
 */
export function textoRango(desde: number, hasta: number, lo: number, hi: number): string {
  const abierto = desde <= lo
  const cerrado = hasta >= hi
  if (abierto && cerrado) return 'Cualquiera'
  if (abierto) return `Hasta ${hasta}`
  if (cerrado) return `Desde ${desde}`
  return `${desde} – ${hasta}`
}

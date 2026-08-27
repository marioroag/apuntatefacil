// Guarda de contraste AA para el acento que elige el cliente.
// Si el texto blanco no llega a 4.5:1 sobre el acento, devolvemos tinta oscura
// para el texto del botón. Así el formulario público siempre se lee bien.

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a))
  const lb = luminance(hexToRgb(b))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
}

export function normalizeHex(hex: string): string {
  let h = hex.trim()
  if (!h.startsWith('#')) h = '#' + h
  return h.toLowerCase()
}

/** Texto legible (blanco o tinta) sobre un fondo de acento. */
export function readableOn(accent: string): string {
  const ink = '#1e1b2e'
  const white = '#ffffff'
  return contrastRatio(white, accent) >= 4.5 ? white : ink
}

/**
 * EL ACENTO, SOBRE BLANCO. Es la pregunta CONTRARIA a `readableOn`: aquella da
 * el texto que se lee ENCIMA del acento; esta da un acento que se lee sobre el
 * papel.
 *
 * Hace falta desde que la página pública del anuncio tiñe con la marca del
 * cliente cosas que van sobre blanco (los iconos de la ficha, su filo). El
 * acento lo elige la empresa y puede ser cualquier cosa: medido, un amarillo
 * (#fbbf24) se queda en **1,67:1** sobre blanco, o sea invisible, y una ficha
 * con cinco glifos que no se ven parece rota.
 *
 * Se OSCURECE con la tinta de la casa en vez de sustituirse por gris: así el
 * amarillo sigue siendo cálido y el azul sigue siendo azul, que es de lo que va
 * prestarle la cara a cada empresa.
 *
 * OSCURECE LO JUSTO, no un porcentaje fijo. Empezó con un 70% para todos, que
 * salía de medir un amarillo concreto (#fbbf24); su propio guardián encontró en
 * el acto uno más claro (#facc15) que con ese 70% se quedaba en 2,86. Ese es el
 * fallo de fondo de una constante calculada a mano: cubre los casos que a uno
 * se le ocurrieron. Buscando el mínimo, un acento ya oscuro sale INTACTO (no se
 * desvirtúa nada) y cualquiera que llegue mañana pasa por construcción.
 */
export function accentOnWhite(accent: string): string {
  const hex = normalizeHex(accent)
  const n = parseInt(hex.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const tinta = [0x13, 0x18, 0x22]
  const aHex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
  // De más claro a más oscuro, en pasos del 5%. El primero que llega al suelo de
  // 3:1 (el de un gráfico con significado) es el que menos toca el color.
  for (let p = 100; p > 0; p -= 5) {
    const c = rgb.map((v, i) => Math.round((v * p + tinta[i] * (100 - p)) / 100))
    if (contrastRatio('#ffffff', aHex(c)) >= 3) return aHex(c)
  }
  return aHex(tinta)
}

/** ¿El blanco rinde AA sobre el acento? (para avisar al merchant) */
export function accentPassesWhite(accent: string): boolean {
  return contrastRatio('#ffffff', accent) >= 4.5
}

/**
 * EL ACENTO DE MARCA. Fuente única en TypeScript.
 *
 * Estaba escrito a mano en ocho sitios (dos en `index.css`, el logo, el swatch,
 * el alta de empresa, el fallback del builder, la demo y el playground), o sea
 * que cambiarlo era una cacería y bastaba olvidarse de uno para que la app
 * conviviera con dos azules de marca casi iguales. Ahora TS sale de aquí.
 *
 * **Su gemelo en CSS es `--color-indigo-600` (y `--accent`) en `index.css`, y
 * los dos valores tienen que ser el mismo.** No se puede leer una variable CSS
 * desde un módulo sin tocar el DOM, así que la sincronía es a mano: si cambias
 * uno, cambias el otro. Lo dice también el comentario de `index.css`.
 */
export const ACENTO_MARCA = '#3b4fe4'

export const SWATCHES = [
  ACENTO_MARCA, // ultramarine (marca)
  '#0f766e', // teal
  '#b91c1c', // rojo
  '#c2410c', // naranja
  '#15803d', // verde
  '#7c3aed', // violeta
  '#0369a1', // azul
  '#be185d', // magenta
]

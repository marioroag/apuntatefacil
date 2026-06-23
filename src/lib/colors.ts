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

/** ¿El blanco rinde AA sobre el acento? (para avisar al merchant) */
export function accentPassesWhite(accent: string): boolean {
  return contrastRatio('#ffffff', accent) >= 4.5
}

export const SWATCHES = [
  '#374cce', // ultramarine (marca)
  '#0f766e', // teal
  '#b91c1c', // rojo
  '#c2410c', // naranja
  '#15803d', // verde
  '#7c3aed', // violeta
  '#0369a1', // azul
  '#be185d', // magenta
]

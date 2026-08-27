import { describe, expect, it } from 'vitest'
import { SWATCHES, accentOnWhite, contrastRatio, isValidHex, readableOn } from './colors'

/**
 * EL GUARDIÁN DEL ACENTO SOBRE BLANCO.
 *
 * El acento lo elige cada empresa y puede ser cualquier color, así que lo que se
 * tiñe con él sobre papel blanco (los iconos de la ficha del anuncio público, su
 * filo) tiene que seguir viéndose con el peor acento posible, no solo con el
 * azul de la casa. Sin esto, un cliente con un amarillo corporativo estrena una
 * ficha con cinco glifos invisibles y nadie se entera hasta que lo cuenta.
 */
describe('accentOnWhite', () => {
  it('el peor acento posible se sigue leyendo sobre blanco', () => {
    // 3:1 es el suelo de un gráfico con significado. El amarillo crudo se queda
    // en 1,67 y es el caso que obligó a existir a esta función.
    for (const c of ['#fbbf24', '#eab308', '#facc15', '#22c55e', '#f59e0b', '#ffffff'])
      expect(contrastRatio('#ffffff', accentOnWhite(c)), c).toBeGreaterThanOrEqual(3)
  })

  it('todos los colores que ofrecemos pasan', () => {
    for (const c of SWATCHES)
      expect(contrastRatio('#ffffff', accentOnWhite(c)), c).toBeGreaterThanOrEqual(3)
  })

  it('oscurece, nunca aclara', () => {
    // Si aclarase, un acento ya oscuro perdería cuerpo justo donde hace falta.
    for (const c of ['#2f6db5', '#3b4fe4', '#fbbf24'])
      expect(contrastRatio('#ffffff', accentOnWhite(c))).toBeGreaterThanOrEqual(contrastRatio('#ffffff', c))
  })

  it('devuelve un hex válido, también con entradas raras', () => {
    for (const c of ['#3b4fe4', '3b4fe4', '#000000', '#ffffff'])
      expect(isValidHex(accentOnWhite(c)), c).toBe(true)
  })

  it('no lo confunde con `readableOn`, que contesta la pregunta contraria', () => {
    // `readableOn` da el texto que va ENCIMA del acento; esta da el acento que
    // va sobre el papel. Con un amarillo, una dice tinta y la otra un oliva.
    expect(readableOn('#fbbf24')).toBe('#1e1b2e')
    expect(accentOnWhite('#fbbf24')).not.toBe('#1e1b2e')
  })
})

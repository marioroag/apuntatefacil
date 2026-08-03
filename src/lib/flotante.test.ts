import { describe, expect, it } from 'vitest'
import { colocarFlotante } from './flotante'

/**
 * EL GUARDIÁN DE LO QUE FLOTA.
 *
 * Vigila dos cosas. La primera es la única promesa de `colocarFlotante`: pase lo
 * que pase, lo que flota cabe entero en la ventana. Nunca se sale por un filo ni
 * se corta a media palabra, que es como empezó esto (la ayuda de "Etiquetas" en
 * la ficha del candidato se leía "as etiquetas son internas de tu mpresa").
 *
 * La segunda es lo que impide que el arreglo se pudra: que no vuelva a haber un
 * tooltip escrito a mano. Arreglar el de Etiquetas no arregla nada si la próxima
 * pantalla se pinta el suyo con `absolute left-1/2`, porque ese va a salir mal
 * exactamente igual y nadie lo verá hasta que un cliente pase el ratón por ahí.
 */

const VISTA = { width: 1000, height: 800 }
const GLOBO = { width: 240, height: 80 }

/** Ancla de 16px (un icono de info) centrada en (x, y). */
const icono = (x: number, y: number) => ({ left: x - 8, right: x + 8, top: y - 8, bottom: y + 8 })

describe('colocarFlotante', () => {
  it('abre abajo y centrado cuando hay sitio', () => {
    const { top, left, lado } = colocarFlotante(icono(500, 400), GLOBO, VISTA)
    expect(lado).toBe('abajo')
    expect(top).toBe(414) // 408 (bottom) + 6 de hueco
    expect(left).toBe(380) // 500 - 240/2
  })

  it('sube si abajo no cabe y arriba sí', () => {
    const { top, lado } = colocarFlotante(icono(500, 760), GLOBO, VISTA)
    expect(lado).toBe('arriba')
    expect(top).toBe(666) // 752 (top) - 6 - 80
  })

  it('se queda abajo si no cabe en ninguno de los dos lados', () => {
    const alto = { width: 240, height: 700 }
    expect(colocarFlotante(icono(500, 400), alto, VISTA).lado).toBe('abajo')
  })

  it('se aprieta contra el filo izquierdo en vez de salirse', () => {
    // Es el caso del bug: el icono estaba a 40px del borde y el globo de 240
    // centrado pedía empezar en -80.
    expect(colocarFlotante(icono(40, 100), GLOBO, VISTA).left).toBe(8)
  })

  it('se aprieta contra el filo derecho en vez de salirse', () => {
    expect(colocarFlotante(icono(980, 100), GLOBO, VISTA).left).toBe(752) // 1000 - 240 - 8
  })

  it('nunca da un left negativo aunque no quepa de ancho', () => {
    const ancho = { width: 2000, height: 80 }
    expect(colocarFlotante(icono(500, 100), ancho, VISTA).left).toBe(8)
  })

  it('respeta la alineación pedida mientras quepa', () => {
    const ancla = { left: 400, right: 600, top: 100, bottom: 130 }
    expect(colocarFlotante(ancla, GLOBO, VISTA, { alinear: 'izquierda' }).left).toBe(400)
    expect(colocarFlotante(ancla, GLOBO, VISTA, { alinear: 'derecha' }).left).toBe(360) // 600 - 240
  })

  it('devuelve pixeles enteros: medio pixel emborrona el texto', () => {
    const { top, left } = colocarFlotante({ left: 100.5, right: 117.5, top: 50.3, bottom: 66.7 }, GLOBO, VISTA)
    expect(Number.isInteger(top)).toBe(true)
    expect(Number.isInteger(left)).toBe(true)
  })
})

// Los ficheros se leen con el glob de Vite y no con `node:fs`: el tsconfig de la
// app no tiene los tipos de node. Mismo apaño que el guardián del acabado.
const FUENTES = import.meta.glob('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** El único sitio donde puede vivir un globo de ayuda. */
const PRIMITIVA = 'components/ui/Tooltip.tsx'

describe('un solo tooltip en toda la app', () => {
  it('nadie se pinta el suyo a mano', () => {
    const culpables = Object.entries(FUENTES)
      .map(([ruta, src]) => [ruta.replace(/^\.\.\//, ''), src] as const)
      .filter(([ruta, src]) => ruta !== PRIMITIVA && /role="tooltip"/.test(src))
      .map(([ruta]) => ruta)

    expect(
      culpables,
      `Un tooltip escrito a mano en: ${culpables.join(', ')}.\n` +
        'Un globo colocado con `absolute` se mide contra su padre, no contra la ventana, ' +
        'y cualquier antepasado con overflow lo recorta: se va a cortar igual que se cortó ' +
        'el de Etiquetas. Usa <Tooltip> (o <InfoTooltip>) de components/ui/Tooltip.tsx, que ' +
        'se pinta en un portal y se coloca con colocarFlotante.',
    ).toEqual([])
  })
})

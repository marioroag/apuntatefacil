import { describe, expect, it } from 'vitest'
import { UMBRAL_AGOTADA, UMBRALES_PRUEBA, tocaAvisar, umbralPrueba } from './avisoPrueba'
import { diasDePruebaRestantes, pruebaAgotada } from './pricing'

/**
 * EL GUARDIÁN DEL AVISO DE FIN DE PRUEBA.
 *
 * Las dos formas de romper esto son SILENCIOSAS, que es justo lo que pide un
 * guardián: un aviso que sale de más se ve enseguida y molesta; uno que NO sale
 * no lo nota nadie hasta que un cliente se va sin enterarse de que su prueba
 * había terminado.
 *
 * La peor de las dos es el ORDEN de la lista: está escrita de más urgente a
 * menos porque el algoritmo coge el primero que encaja, así que escribirla al
 * revés (que es como se lee de forma natural, "tres días, un día, el final")
 * hace que al terminar la prueba se enseñe el aviso de "te quedan 3 días" y el
 * del final no se enseñe NUNCA. No hay nada en pantalla que delate eso.
 */

describe('qué umbral toca', () => {
  it('a mitad de prueba no se avisa de nada', () => {
    expect(umbralPrueba(15)).toBeNull()
    expect(umbralPrueba(4)).toBeNull()
    expect(umbralPrueba(null)).toBeNull() // el reloj no ha arrancado
    expect(umbralPrueba(undefined)).toBeNull()
  })

  it('gana siempre el MÁS urgente que encaje', () => {
    expect(umbralPrueba(3)).toBe(3)
    expect(umbralPrueba(2)).toBe(3) // sigue siendo "quedan pocos días"
    expect(umbralPrueba(1)).toBe(3)
    expect(umbralPrueba(0)).toBe(0) // el último día, con el puesto AÚN en línea
  })

  it('CERO DÍAS NO ES "SE ACABÓ": la prueba agotada es su propio umbral', () => {
    // Con el redondeo hacia abajo, cero días duran toda la última jornada. Si
    // el aviso del final saliera con `dias === 0`, diríamos "tu prueba ha
    // terminado" con el puesto recibiendo candidaturas: afirmar algo falso.
    expect(umbralPrueba(0, false)).toBe(0)
    expect(umbralPrueba(0, true)).toBe(UMBRAL_AGOTADA)
    expect(UMBRAL_AGOTADA).toBeLessThan(Math.min(...UMBRALES_PRUEBA))
  })

  it('la lista está ordenada de más urgente a menos: ese orden ES el algoritmo', () => {
    const ordenada = [...UMBRALES_PRUEBA].sort((a, b) => a - b)
    expect([...UMBRALES_PRUEBA]).toEqual(ordenada)
  })
})

describe('los días se redondean HACIA ABAJO, como Stripe', () => {
  // Iba con `Math.ceil` y decía "quedan 10 días" mientras la página de pago de
  // Stripe, en la misma sesión, decía "9 días gratis". Manda la de Stripe, que
  // es la que factura.
  const dentroDe = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()

  it('9 días y 17 horas son 9 días, no 10', () => {
    expect(diasDePruebaRestantes(dentroDe(9 * 24 + 17))).toBe(9)
  })

  it('el último día son 0 días y la prueba NO está agotada', () => {
    expect(diasDePruebaRestantes(dentroDe(10))).toBe(0)
    expect(pruebaAgotada(dentroDe(10))).toBe(false)
  })

  it('pasada la fecha sí está agotada, y nunca da días negativos', () => {
    expect(pruebaAgotada(dentroDe(-1))).toBe(true)
    expect(diasDePruebaRestantes(dentroDe(-72))).toBe(0)
  })

  it('sin reloj no hay ni días ni final', () => {
    expect(diasDePruebaRestantes(null)).toBeNull()
    expect(pruebaAgotada(null)).toBe(false)
    expect(diasDePruebaRestantes('el jueves')).toBeNull()
  })
})

describe('cuándo se enseña', () => {
  it('cada umbral una sola vez, y los más urgentes sí se enseñan después', () => {
    expect(tocaAvisar(3, undefined)).toBe(true) // primera vez
    expect(tocaAvisar(3, 3)).toBe(false) // ya lo vio: no se repite al bajar a 2 días
    expect(tocaAvisar(0, 3)).toBe(true) // termina hoy: noticia nueva
    expect(tocaAvisar(UMBRAL_AGOTADA, 0)).toBe(true) // ha terminado: noticia nueva
    expect(tocaAvisar(UMBRAL_AGOTADA, UMBRAL_AGOTADA)).toBe(false) // y ya no se repite
  })

  it('sin umbral no se enseña nada', () => {
    expect(tocaAvisar(null, undefined)).toBe(false)
    expect(tocaAvisar(null, 3)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { UMBRALES_PRUEBA, tocaAvisar, umbralPrueba } from './avisoPrueba'

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
    expect(umbralPrueba(1)).toBe(1) // termina mañana: tiene aviso propio
    expect(umbralPrueba(0)).toBe(0) // ha terminado, y este es el que se perdía
  })

  it('la lista está ordenada de más urgente a menos: ese orden ES el algoritmo', () => {
    const ordenada = [...UMBRALES_PRUEBA].sort((a, b) => a - b)
    expect([...UMBRALES_PRUEBA]).toEqual(ordenada)
    expect(UMBRALES_PRUEBA[0]).toBe(0) // el fin de la prueba, el más urgente de todos
  })
})

describe('cuándo se enseña', () => {
  it('cada umbral una sola vez, y los más urgentes sí se enseñan después', () => {
    expect(tocaAvisar(3, undefined)).toBe(true) // primera vez
    expect(tocaAvisar(3, 3)).toBe(false) // ya lo vio: no se repite al bajar a 2 días
    expect(tocaAvisar(1, 3)).toBe(true) // termina mañana: noticia nueva
    expect(tocaAvisar(0, 1)).toBe(true) // ha terminado: noticia nueva
    expect(tocaAvisar(0, 0)).toBe(false) // y ya no se vuelve a decir ningún día
  })

  it('sin umbral no se enseña nada', () => {
    expect(tocaAvisar(null, undefined)).toBe(false)
    expect(tocaAvisar(null, 3)).toBe(false)
  })
})

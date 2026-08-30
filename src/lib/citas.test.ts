import { describe, expect, it } from 'vitest'
// El guardián de la localización de citas: el contrato que hace que el
// subrayado del CV sea de fiar. Si la búsqueda encuentra lo que no está o se
// pierde lo que sí está, el visor subraya mentiras o calla verdades, y ninguna
// de las dos se ve en una revisión de código. Cada detector se probó
// rompiéndolo a propósito antes de darlo por bueno.
import { MIN_CITA, ajustarAPalabras, fraccionAvance, localizarCita, normalizarCita } from './citas'

describe('normalizarCita: la misma cadena desde los dos lados', () => {
  it('ignora mayúsculas, acentos y whitespace', () => {
    expect(normalizarCita('CAMIÓN  de\nreparto')).toBe(normalizarCita('camión de reparto'))
    expect(normalizarCita('camión de reparto')).toBe('camiondereparto')
  })

  it('unifica comillas y guiones tipográficos y tira el guion blando', () => {
    expect(normalizarCita('2019 – 2022')).toBe(normalizarCita('2019 - 2022'))
    expect(normalizarCita('“carnet”')).toBe(normalizarCita('"carnet"'))
    expect(normalizarCita('insta­laciones')).toBe('instalaciones')
  })
})

describe('localizarCita: encuentra lo que está, calla lo que no', () => {
  it('encuentra una cita aunque el PDF la parta en varios items', () => {
    const items = [
      { str: 'Exper' },
      { str: 'iencia como carret' },
      { str: 'illero en almacén' },
    ]
    const tramos = localizarCita('experiencia como carretillero', items)
    expect(tramos).not.toBeNull()
    expect(tramos!.map((t) => t.item)).toEqual([0, 1, 2])
    // El primer tramo cubre el item entero y el último para donde acaba la cita.
    expect(tramos![0]).toEqual({ item: 0, desde: 0, hasta: 5 })
    expect(tramos![2].desde).toBe(0)
  })

  it('encuentra "CAMIÓN" escrito "camión", y con espacios de más', () => {
    const items = [{ str: 'Carnet C  y CAMIÓN   propio desde 2019' }]
    expect(localizarCita('camión propio desde 2019', items)).not.toBeNull()
  })

  it('sobrevive a la partición de línea con guion', () => {
    const items = [{ str: 'mantenimiento de instala-' }, { str: 'ciones frigoríficas' }]
    expect(localizarCita('instalaciones frigoríficas', items)).not.toBeNull()
  })

  it('una cita que no está en el documento devuelve null, no el tramo que menos se parece', () => {
    const items = [{ str: 'Peón de obra en Construcciones del Este entre 2019 y 2022' }]
    expect(localizarCita('carnet de carretillero en vigor', items)).toBeNull()
  })

  it('una cita demasiado corta no se busca: mejor sin subrayado que subrayar el trozo equivocado', () => {
    const items = [{ str: 'Sí. Sí. Sí. Carnet B. Sí.' }]
    expect(localizarCita('Sí', items)).toBeNull()
    expect(normalizarCita('Sí').length).toBeLessThan(MIN_CITA)
  })

  it('los offsets devueltos apuntan al texto ORIGINAL del item', () => {
    const items = [{ str: 'Carnet de carretillero (2027) y PRL de 20 horas' }]
    const tramos = localizarCita('carretillero (2027)', items)
    expect(tramos).toHaveLength(1)
    const { desde, hasta } = tramos![0]
    expect(items[0].str.slice(desde, hasta)).toBe('carretillero (2027)')
  })
})

describe('el intento aproximado: tolera la paráfrasis leve, no el parecido', () => {
  it('una cita con la puntuación cambiada por el modelo se localiza igual', () => {
    // El caso real: el CV escribe "Mozo de almacén · WIERTZ - SHIMANO" y el
    // modelo cita "Mozo de almacén en WIERTZ SHIMANO". No es exacta y ES la
    // misma cita: se subraya.
    const items = [{ str: 'Mozo de almacén · WIERTZ - SHIMANO · julio - agosto 2025' }]
    const tramos = localizarCita('Mozo de almacén en WIERTZ SHIMANO', items)
    expect(tramos).not.toBeNull()
    const { desde, hasta } = tramos![0]
    expect(items[0].str.slice(desde, hasta)).toContain('WIERTZ')
  })

  it('una errata pequeña dentro de la cita tampoco la pierde', () => {
    const items = [{ str: 'Curso de manipulación de cargas de 20 horas en 2024' }]
    expect(localizarCita('curso de manipulacion de carga de 20 horas', items)).not.toBeNull()
  })

  it('lo que solo SE PARECE no se subraya: por encima del umbral, null', () => {
    // Comparte palabras sueltas con el documento pero no es esa cita: marcarla
    // sería subrayar una mentira con cara de prueba.
    const items = [{ str: 'Experiencia de dos años como mozo de almacén en Valencia' }]
    expect(localizarCita('cinco años de experiencia como carretillero en Madrid', items)).toBeNull()
  })
})

describe('la geometría de la marca: palabras enteras y anchos pesados', () => {
  it('ajustarAPalabras estira el tramo hasta los límites de palabra', () => {
    const str = 'Carnet de carretillero elevador'
    // Un tramo que empieza a media palabra ("rnet") cubre la palabra entera.
    expect(ajustarAPalabras(str, 2, 9)).toEqual({ desde: 0, hasta: 9 })
    expect(ajustarAPalabras(str, 10, 14)).toEqual({ desde: 10, hasta: 22 })
    // Fuera de rango no revienta.
    expect(ajustarAPalabras(str, -5, 999)).toEqual({ desde: 0, hasta: str.length })
  })

  it('fraccionAvance pesa los caracteres: una "i" avanza menos que una "m"', () => {
    expect(fraccionAvance('iiiimmmm', 4)).toBeLessThan(0.5)
    expect(fraccionAvance('mmmmiiii', 4)).toBeGreaterThan(0.5)
    expect(fraccionAvance('abc', 0)).toBe(0)
    expect(fraccionAvance('abc', 3)).toBe(1)
    expect(fraccionAvance('', 0)).toBe(0)
  })
})

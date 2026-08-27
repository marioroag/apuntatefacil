import { describe, expect, it } from 'vitest'
import {
  CONTRATOS, ESTUDIOS, EXPERIENCIAS, JORNADAS, MODALIDADES, NIVELES_IDIOMA, PERIODOS,
  anuncioSinEmpezar, anuncioVacio, faltaEnAnuncio, leerAnuncio, resumenAnuncio,
  type Anuncio,
} from './anuncio'

/**
 * EL GUARDIÁN DEL ANUNCIO.
 *
 * El anuncio vive en un `jsonb`, o sea en la única columna del puesto que la
 * base de datos NO valida: lo que haya escrito ahí una versión anterior (o una
 * escritura a medias) llega tal cual al cliente. `leerAnuncio` es la aduana, y
 * una aduana sin pruebas es una aduana abierta.
 *
 * Lo otro que vigila es que las tres preguntas que le hacen los consumidores
 * (quién entra, qué falta, está sin empezar) sigan diciendo lo mismo: el paso
 * del asistente, el bloque del constructor y la futura página pública se apoyan
 * en ellas y no se hablan entre sí.
 */

const lleno = (): Anuncio => ({
  descripcion: 'Obra nueva en el centro.',
  modalidad: 'presencial',
  salarioMin: 22000,
  salarioMax: 26000,
  salarioPeriodo: 'año',
  contrato: 'Indefinido',
  jornada: 'Completa',
  experiencia: 'De 1 a 2 años',
  estudios: 'Bachillerato',
  idiomas: [{ idioma: 'Español', nivel: 'Nativo o bilingüe' }],
  conocimientos: ['Encofrado'],
})

describe('leerAnuncio: la aduana del jsonb', () => {
  it('devuelve un anuncio entero aunque no llegue nada', () => {
    for (const basura of [null, undefined, 'texto', 42, [], { descripcion: 7 }]) {
      const a = leerAnuncio(basura)
      expect(Object.keys(a).sort()).toEqual(Object.keys(anuncioVacio()).sort())
      expect(a.idiomas).toEqual([])
      expect(a.conocimientos).toEqual([])
      expect(a.descripcion).toBe('')
    }
  })

  it('ida y vuelta: lo guardado se lee igual', () => {
    expect(leerAnuncio(JSON.parse(JSON.stringify(lleno())))).toEqual(lleno())
  })

  it('descarta valores que no están en el vocabulario', () => {
    // Una modalidad inventada no puede llegar a la pantalla: el selector se
    // quedaría con un valor que no está entre sus opciones y se vería vacío
    // sin que nadie pueda saber qué había.
    const a = leerAnuncio({
      ...lleno(), modalidad: 'astral', salarioPeriodo: 'quincena',
      contrato: 'Por obra o servicio', jornada: 'Intensiva',
      experiencia: '3 años y medio', estudios: 'EGB',
    })
    expect(a.modalidad).toBe('')
    expect(a.salarioPeriodo).toBe('año')
    // "Por obra o servicio" ya no existe desde la reforma laboral: un anuncio
    // guardado con él no puede seguir pintándolo como si se pudiera firmar.
    expect(a.contrato).toBe('')
    expect(a.jornada).toBe('')
    expect(a.experiencia).toBe('')
    expect(a.estudios).toBe('')
  })

  it('tira los idiomas sin nombre y los conocimientos vacíos', () => {
    const a = leerAnuncio({
      ...lleno(),
      idiomas: [{ idioma: '  ', nivel: 'Básico' }, { idioma: 'Rumano', nivel: 'Avanzado' }],
      conocimientos: ['Carretilla', '', '   ', 3],
    })
    expect(a.idiomas).toEqual([{ idioma: 'Rumano', nivel: 'Avanzado' }])
    expect(a.conocimientos).toEqual(['Carretilla'])
  })

  it('un salario que no es número se queda sin poner, no en cero', () => {
    // Cero es una cifra: significaría "este puesto paga 0 €". Lo que no se
    // puede leer es `null`, que es "no lo han dicho".
    const a = leerAnuncio({ ...lleno(), salarioMin: '22000', salarioMax: NaN })
    expect(a.salarioMin).toBeNull()
    expect(a.salarioMax).toBeNull()
  })
})

describe('faltaEnAnuncio: qué se pide para crear el puesto', () => {
  it('pide los ocho y ni uno más', () => {
    expect(faltaEnAnuncio(anuncioVacio(), '').sort()).toEqual(
      ['contrato', 'descripcion', 'estudios', 'experiencia', 'jornada', 'location', 'modalidad', 'salario'],
    )
  })

  it('no pide idiomas ni conocimientos: hay puestos que no piden ninguno', () => {
    const a = { ...lleno(), idiomas: [], conocimientos: [] }
    expect(faltaEnAnuncio(a, 'Valencia')).toEqual([])
  })

  it('el espacio en blanco no rellena nada', () => {
    expect(faltaEnAnuncio({ ...lleno(), descripcion: '   ' }, '   ')).toEqual(['location', 'descripcion'])
  })

  it('con la cifra de partida basta: la horquilla es opcional', () => {
    expect(faltaEnAnuncio({ ...lleno(), salarioMax: null }, 'Valencia')).toEqual([])
  })
})

describe('anuncioSinEmpezar: abrir el bloque solo si hay algo que hacer', () => {
  it('sin empezar es sin empezar', () => {
    expect(anuncioSinEmpezar(anuncioVacio(), '')).toBe(true)
  })

  it('a medias NO es sin empezar, ni siquiera por lo opcional', () => {
    // Si lo único puesto son los conocimientos, el bloque ya no puede abrirse
    // solo: alguien estuvo ahí y decidió dejarlo así.
    expect(anuncioSinEmpezar({ ...anuncioVacio(), conocimientos: ['Carretilla'] }, '')).toBe(false)
    expect(anuncioSinEmpezar(anuncioVacio(), 'Valencia')).toBe(false)
    expect(anuncioSinEmpezar({ ...anuncioVacio(), salarioMax: 26000 }, '')).toBe(false)
    expect(anuncioSinEmpezar({ ...anuncioVacio(), contrato: 'Indefinido' }, '')).toBe(false)
    expect(anuncioSinEmpezar({ ...anuncioVacio(), jornada: 'Parcial' }, '')).toBe(false)
  })
})

describe('resumenAnuncio: la línea de la fila plegada', () => {
  it('dice dónde, cómo y desde cuánto, con los miles a la española', () => {
    expect(resumenAnuncio(lleno(), 'Valencia')).toBe('Valencia · Presencial · Desde 22.000 €')
  })

  it('vacío no inventa separadores', () => {
    expect(resumenAnuncio(anuncioVacio(), '')).toBe('')
    expect(resumenAnuncio(anuncioVacio(), 'Valencia')).toBe('Valencia')
  })
})

describe('los vocabularios', () => {
  it('no repiten valores', () => {
    const listas: [string, readonly string[]][] = [
      ['modalidades', MODALIDADES.map((m) => m.value)],
      ['periodos', PERIODOS.map((p) => p.value)],
      ['experiencias', EXPERIENCIAS],
      ['estudios', ESTUDIOS],
      ['niveles', NIVELES_IDIOMA],
      ['contratos', CONTRATOS],
      ['jornadas', JORNADAS],
    ]
    for (const [nombre, l] of listas) expect(new Set(l).size, nombre).toBe(l.length)
  })

  it('un anuncio vacío usa valores que existen', () => {
    // `salarioPeriodo` nace con un valor puesto (no hay "sin periodo"): si
    // alguien renombra el token, el selector arrancaría en blanco.
    expect(PERIODOS.some((p) => p.value === anuncioVacio().salarioPeriodo)).toBe(true)
  })
})

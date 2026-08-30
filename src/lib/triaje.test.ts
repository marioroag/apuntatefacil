import { describe, expect, it } from 'vitest'
// El guardián de la triada de Meridian. El módulo es puro (sin Deno, sin red),
// así que vitest lo carga directo, igual que guion.test.ts con el del agente.
//
// Lo que se prueba NO es la IA (eso no se puede probar): son los CONTRATOS que
// el código hace cumplir aunque los modelos fallen, que es justo lo que hace
// que el triaje sea de fiar:
//
//   * la agregación: el número lo pone el código, no_consta no diluye, y la
//     importancia se dice con PESO, nunca con una categoría eliminatoria
//     (Mario vetó "imprescindible" por subjetivo: nada descarta a nadie);
//   * el juez: solo puede rebajar la aserción del evaluador, nunca subirla,
//     cambiarle el signo, ni colar puntos que el evaluador no escribió;
//   * la evidencia: un juicio sin cita no llega nunca al usuario;
//   * el CV: sus criterios salen enteros del baremo cuando el puesto ni lo
//     recoge (no se castiga por información que nadie pidió);
//   * la fuente de un juicio: solo viaja pegada a su evidencia (una cita es lo
//     único que el visor puede localizar en el PDF);
//   * los contrastes y la trayectoria: techos duros de saneo, para que
//     candidates.ai (20000 chars) no pueda desbordarse por diseño;
//   * la ilegibilidad de un CV: el umbral que dispara el respaldo de visión.
//
// Cada detector se probó rompiéndolo a propósito (invirtiendo la regla que
// vigila) antes de darlo por bueno.
import {
  FIT_BIEN, MAX_CONTRASTES, MAX_CRITERIOS,
  agregarJuicios, criteriosEfectivos, esCvIlegible, fusionarJuicio, hashPuesto,
  normalizarJuicios, sanearContrastes, sanearCriterios, sanearTrayectoria,
  serializarContraste, soloConservados,
  type BaremoCriterio, type Juicio, type Nivel, type Valor,
} from '../../supabase/functions/_shared/triaje'

function crit(clave: string, nivel: Nivel, fuente: 'formulario' | 'cv' = 'formulario'): BaremoCriterio {
  return {
    clave, nivel, fuente,
    familia: 'requisitos',
    nombre: `Criterio ${clave}`,
    anclas: { cumple: 'sí', parcial: 'a medias', no_cumple: 'no' },
  }
}

const j = (clave: string, valor: Valor, evidencia = 'lo dice el formulario'): Juicio =>
  valor === 'no_consta' ? { clave, valor } : { clave, valor, evidencia }

describe('agregación: el número lo pone el código', () => {
  it('no_consta sale del denominador: lo que no se preguntó no baja la nota', () => {
    // Candidatura perfecta en un formulario corto: antes el techo era ~86
    // (no_consta puntuaba 0.3 sobre denominador fijo) y ahora es 100.
    const baremo = [crit('a', 'clave'), crit('b', 'importante'), crit('c', 'deseable')]
    const { fit } = agregarJuicios(baremo, [j('a', 'cumple'), j('b', 'cumple'), j('c', 'no_consta')])
    expect(fit).toBe(100)
    expect(fit).toBeGreaterThanOrEqual(FIT_BIEN)
  })

  it('candidatura vacía: fit 0 y cero evaluados, no un 30 de regalo', () => {
    const baremo = [crit('a', 'importante'), crit('b', 'deseable')]
    const out = agregarJuicios(baremo, [j('a', 'no_consta'), j('b', 'no_consta')])
    expect(out.fit).toBe(0)
    expect(out.evaluados).toBe(0)
    expect(out.total).toBe(2)
  })

  it('la importancia se dice con peso: fallar lo clave duele más que fallar lo deseable', () => {
    const baremo = [crit('a', 'clave'), crit('b', 'importante'), crit('c', 'deseable')]
    const fallaClave = agregarJuicios(baremo, [j('a', 'no_cumple'), j('b', 'cumple'), j('c', 'cumple')])
    const fallaDeseable = agregarJuicios(baremo, [j('a', 'cumple'), j('b', 'cumple'), j('c', 'no_cumple')])
    expect(fallaClave.fit).toBe(50)
    expect(fallaDeseable.fit).toBe(83)
    expect(fallaClave.fit).toBeLessThan(fallaDeseable.fit)
  })

  it('NINGÚN criterio es eliminatorio: un no_cumple pesa, jamás descarta', () => {
    // Decisión de Mario (ago 2026): "imprescindible" es subjetivo; se pondera,
    // no se sentencia. Con todo lo demás excelente, el número es su media
    // ponderada y puede seguir alto: descartar es SIEMPRE de la persona.
    const baremo = [
      crit('carnet', 'clave'),
      crit('a', 'importante'), crit('b', 'importante'), crit('c', 'importante'), crit('d', 'importante'),
    ]
    const juicios = [j('carnet', 'no_cumple'), j('a', 'cumple'), j('b', 'cumple'), j('c', 'cumple'), j('d', 'cumple')]
    const { fit } = agregarJuicios(baremo, juicios)
    expect(fit).toBe(73)
    expect(fit).toBeGreaterThanOrEqual(FIT_BIEN)
  })

  it('un importante pesa el doble que un deseable', () => {
    const baremo = [crit('a', 'importante'), crit('b', 'deseable')]
    const cumpleLoGrande = agregarJuicios(baremo, [j('a', 'cumple'), j('b', 'no_cumple')])
    const cumpleLoChico = agregarJuicios(baremo, [j('a', 'no_cumple'), j('b', 'cumple')])
    expect(cumpleLoGrande.fit).toBe(67)
    expect(cumpleLoChico.fit).toBe(33)
  })

  it('un juicio que falta cuenta como no_consta: fuera del denominador', () => {
    const baremo = [crit('a', 'clave'), crit('b', 'importante')]
    const { fit, evaluados } = agregarJuicios(baremo, [j('b', 'cumple')])
    expect(fit).toBe(100)
    expect(evaluados).toBe(1)
  })
})

describe('CV: fuente opcional, nunca castigo', () => {
  it('sin CV posible, sus criterios salen ENTEROS del baremo efectivo', () => {
    const baremo = [crit('exp', 'importante'), crit('continuidad', 'deseable', 'cv')]
    expect(criteriosEfectivos(baremo, false).map((c) => c.clave)).toEqual(['exp'])
    expect(criteriosEfectivos(baremo, true).map((c) => c.clave)).toEqual(['exp', 'continuidad'])
  })

  it('candidatura perfecta sin CV en un puesto sin CV llega a "Encaja bien"', () => {
    const baremo = [crit('carnet', 'clave'), crit('exp', 'importante'), crit('continuidad', 'deseable', 'cv')]
    const efectivos = criteriosEfectivos(baremo, false)
    const { fit } = agregarJuicios(efectivos, [j('carnet', 'cumple'), j('exp', 'cumple')])
    expect(fit).toBeGreaterThanOrEqual(FIT_BIEN)
  })
})

describe('el juez solo puede rebajar', () => {
  it('rebaja hacia no_consta y de un juicio fuerte a parcial', () => {
    expect(fusionarJuicio('cumple', 'no_consta')).toBe('no_consta')
    expect(fusionarJuicio('no_cumple', 'no_consta')).toBe('no_consta')
    expect(fusionarJuicio('parcial', 'no_consta')).toBe('no_consta')
    expect(fusionarJuicio('cumple', 'parcial')).toBe('parcial')
    expect(fusionarJuicio('no_cumple', 'parcial')).toBe('parcial')
  })

  it('NUNCA sube una aserción ni le cambia el signo', () => {
    expect(fusionarJuicio('no_consta', 'cumple')).toBe('no_consta')
    expect(fusionarJuicio('no_consta', 'no_cumple')).toBe('no_consta')
    expect(fusionarJuicio('parcial', 'cumple')).toBe('parcial')
    expect(fusionarJuicio('parcial', 'no_cumple')).toBe('parcial')
    expect(fusionarJuicio('cumple', 'no_cumple')).toBe('cumple')
    expect(fusionarJuicio('no_cumple', 'cumple')).toBe('no_cumple')
  })

  it('en las listas solo conserva o quita: lo que no escribió el evaluador se descarta', () => {
    const delEvaluador = ['Carnet en vigor', 'Vive cerca']
    expect(soloConservados(delEvaluador, ['Vive cerca'])).toEqual(['Vive cerca'])
    expect(soloConservados(delEvaluador, ['Vive cerca', 'Inventado por el juez'])).toEqual(['Vive cerca'])
    expect(soloConservados(delEvaluador, [])).toEqual([])
  })
})

describe('sin evidencia no hay juicio', () => {
  it('un no_cumple (o cumple) sin cita se queda en no_consta', () => {
    const claves = new Set(['a', 'b'])
    const out = normalizarJuicios(
      [
        { clave: 'a', valor: 'no_cumple', evidencia: '   ' },
        { clave: 'b', valor: 'cumple', evidencia: 'dice que sí' },
      ],
      claves,
    )
    expect(out).toEqual([
      { clave: 'a', valor: 'no_consta' },
      { clave: 'b', valor: 'cumple', evidencia: 'dice que sí' },
    ])
  })

  it('descarta claves que no están en el baremo y recorta la evidencia', () => {
    const out = normalizarJuicios(
      [
        { clave: 'fantasma', valor: 'cumple', evidencia: 'x' },
        { clave: 'a', valor: 'parcial', evidencia: 'e'.repeat(500) },
      ],
      new Set(['a']),
    )
    expect(out).toHaveLength(1)
    expect(out[0].evidencia).toHaveLength(200)
  })
})

describe('la fuente de un juicio solo viaja pegada a su evidencia', () => {
  it('con evidencia se propaga; sin ella (o degradado a no_consta) se tira', () => {
    const claves = new Set(['a', 'b', 'c'])
    const out = normalizarJuicios(
      [
        { clave: 'a', valor: 'cumple', evidencia: '2019 - 2022 · Peón en obra', fuente: 'cv' },
        { clave: 'b', valor: 'cumple', evidencia: '', fuente: 'cv' },
        { clave: 'c', valor: 'no_consta', fuente: 'respuesta' },
      ],
      claves,
    )
    expect(out).toEqual([
      { clave: 'a', valor: 'cumple', evidencia: '2019 - 2022 · Peón en obra', fuente: 'cv' },
      { clave: 'b', valor: 'no_consta' },
      { clave: 'c', valor: 'no_consta' },
    ])
  })

  it('una fuente fuera del vocabulario no pasa', () => {
    const out = normalizarJuicios(
      [{ clave: 'a', valor: 'cumple', evidencia: 'dice que sí', fuente: 'linkedin' as never }],
      new Set(['a']),
    )
    expect(out[0].fuente).toBeUndefined()
    expect(out[0].evidencia).toBe('dice que sí')
  })
})

describe('contrastes: techo duro y campos completos', () => {
  it('recorta a MAX_CONTRASTES y a 160 chars por campo, y tira los cojos', () => {
    const out = sanearContrastes([
      { respuesta: 'Dice 5 años de experiencia', cv: 'x'.repeat(500) },
      { respuesta: '', cv: 'el CV dice otra cosa' },
      { respuesta: 'solo respuesta' },
      { respuesta: 'Dice carnet C', cv: 'El CV solo lista el carnet B' },
      { respuesta: 'sobra', cv: 'sobra' },
    ])
    expect(out).toHaveLength(MAX_CONTRASTES)
    expect(out[0].cv).toHaveLength(160)
    expect(out[1]).toEqual({ respuesta: 'Dice carnet C', cv: 'El CV solo lista el carnet B' })
  })

  it('lo que no es una lista devuelve vacío, sin reventar', () => {
    expect(sanearContrastes(null)).toEqual([])
    expect(sanearContrastes('texto')).toEqual([])
  })

  it('el juez los conserva o quita por su serialización compartida', () => {
    // Mismo contrato que "a favor": lo que el juez devuelva reescrito no casa
    // con serializarContraste y se descarta solo.
    const contrastes = [
      { respuesta: 'Dice 5 años', cv: 'Las etapas suman 2' },
      { respuesta: 'Dice carnet C', cv: 'Solo lista el B' },
    ]
    const serializados = contrastes.map(serializarContraste)
    const delJuez = [serializados[1], 'dice "otra cosa" pero el CV dice "inventada"']
    expect(soloConservados(serializados, delJuez)).toEqual([serializados[1]])
  })
})

describe('trayectoria: transcripción con techos', () => {
  it('acota empleos, carnets y formación, y tira las filas vacías', () => {
    const out = sanearTrayectoria({
      empleos: [
        ...Array.from({ length: 14 }, (_, i) => ({
          empresa: `Empresa ${i}`, puesto: 'Mozo/a', desde: '2020', hasta: '2021',
        })),
        { empresa: '', puesto: '', desde: '2019', hasta: '2020' },
      ],
      carnets: [
        ...Array.from({ length: 10 }, (_, i) => ({ nombre: `Carnet ${i}`, vigencia: '' })),
        { nombre: '', vigencia: '2027' },
      ],
      formacion: ['ESO', '', 'x'.repeat(500)],
    })
    expect(out?.empleos).toHaveLength(10)
    expect(out?.carnets).toHaveLength(8)
    expect(out?.formacion).toHaveLength(2)
    expect(out?.formacion[1]).toHaveLength(80)
  })

  it('sin nada que transcribir devuelve null, no un objeto de listas vacías', () => {
    expect(sanearTrayectoria({ empleos: [], carnets: [], formacion: [] })).toBeNull()
    expect(sanearTrayectoria(null)).toBeNull()
    expect(sanearTrayectoria('texto')).toBeNull()
  })

  it('la misma empresa con las mismas fechas es UNA etapa (el clon del primer CV real)', () => {
    // Caso de producción (ago 2026): la plantilla del CV traía un bloque
    // duplicado INVISIBLE en la capa de texto (mismo empleador y fechas, otro
    // título), y la ficha pintaba dos empleos donde el candidato tuvo uno.
    const out = sanearTrayectoria({
      empleos: [
        { empresa: 'WIERTZ - SHIMANO', puesto: 'Mozo de almacén', desde: 'julio', hasta: 'agosto 2025' },
        { empresa: 'BP (Sustitución por vacaciones)', puesto: 'Expendedor de gasolinera', desde: 'junio', hasta: 'septiembre 2024' },
        { empresa: 'BP (SUSTITUCIÓN POR VACACIONES)', puesto: 'Área de Marketing Digital', desde: 'JUNIO', hasta: 'SEPTIEMBRE 2024' },
      ],
      carnets: [],
      formacion: ['Bachillerato de Ciencias', 'Certificado Inglés B1', 'Certificado Inglés B1'],
    })
    expect(out?.empleos.map((e) => e.puesto)).toEqual(['Mozo de almacén', 'Expendedor de gasolinera'])
    expect(out?.formacion).toEqual(['Bachillerato de Ciencias', 'Certificado Inglés B1'])
  })

  it('un ascenso de verdad no se deduplica: misma empresa, fechas distintas', () => {
    const out = sanearTrayectoria({
      empleos: [
        { empresa: 'Turia Levante', puesto: 'Oficial de 2ª', desde: '2016', hasta: '2019' },
        { empresa: 'Turia Levante', puesto: 'Oficial de 1ª', desde: '2019', hasta: 'actualidad' },
      ],
      carnets: [],
      formacion: [],
    })
    expect(out?.empleos).toHaveLength(2)
  })

  it('lo que no está escrito en el CV no se guarda: verificación contra el texto', () => {
    const cvTexto =
      'Mozo de almacén en WIERTZ - SHIMANO, julio a agosto 2025. ' +
      'Formación: Bachillerato de Ciencias. Carnet de conducir B.'
    const out = sanearTrayectoria(
      {
        empleos: [
          // La empresa aparece con otra puntuación: se queda (normalización).
          { empresa: 'Wiertz (Shimano)', puesto: 'Mozo de almacén', desde: 'julio', hasta: 'agosto 2025' },
          // Ni la empresa ni el puesto están en el CV: invento, fuera.
          { empresa: 'Consultora Fantasma S.L.', puesto: 'Director de Marketing', desde: '2023', hasta: '2024' },
        ],
        carnets: [
          { nombre: 'Carnet de conducir B', vigencia: '' },
          { nombre: 'Carnet de camión C+E', vigencia: '' },
        ],
        formacion: ['Bachillerato de Ciencias', 'Máster inventado en logística'],
      },
      cvTexto,
    )
    expect(out?.empleos.map((e) => e.empresa)).toEqual(['Wiertz (Shimano)'])
    expect(out?.carnets.map((c) => c.nombre)).toEqual(['Carnet de conducir B'])
    expect(out?.formacion).toEqual(['Bachillerato de Ciencias'])
  })

  it('sin texto de CV que comprobar, la verificación no tira nada', () => {
    const out = sanearTrayectoria({
      empleos: [{ empresa: 'Cualquiera', puesto: 'Mozo/a', desde: '', hasta: '' }],
      carnets: [],
      formacion: [],
    })
    expect(out?.empleos).toHaveLength(1)
  })

  it('el peor caso saneado cabe de sobra en el techo de candidates.ai', () => {
    // El constraint es 20000 chars para el objeto ai ENTERO; la trayectoria
    // saneada al máximo tiene que dejar sitio al resto del análisis.
    const lleno = sanearTrayectoria({
      empleos: Array.from({ length: 10 }, () => ({
        empresa: 'e'.repeat(200), puesto: 'p'.repeat(200), desde: 'd'.repeat(80), hasta: 'h'.repeat(80),
      })),
      carnets: Array.from({ length: 8 }, () => ({ nombre: 'n'.repeat(200), vigencia: 'v'.repeat(80) })),
      formacion: Array.from({ length: 6 }, () => 'f'.repeat(200)),
    })
    expect(JSON.stringify(lleno).length).toBeLessThan(6000)
  })
})

describe('esCvIlegible: el disparador de la visión', () => {
  it('null, vacío o ruido corto es ilegible; un CV normal no', () => {
    expect(esCvIlegible(null)).toBe(true)
    expect(esCvIlegible('')).toBe(true)
    expect(esCvIlegible('  \n '.repeat(200))).toBe(true)
    expect(esCvIlegible('x'.repeat(199) + ' '.repeat(300))).toBe(true)
    expect(esCvIlegible('x'.repeat(200))).toBe(false)
    expect(
      esCvIlegible(
        'Experiencia laboral: peón de obra en Construcciones del Este, 2019 a 2022. ' +
          'Oficial de segunda en Reformas Integrales del Sur, 2022 a 2024, encofrado y ' +
          'tabiquería. Carnet de conducir B con vehículo propio. Curso de PRL de 20 horas ' +
          'de la construcción. Disponible para incorporación inmediata en Valencia y ' +
          'alrededores. Estudios: ESO completa. Idiomas: castellano nativo, rumano nativo.',
      ),
    ).toBe(false)
  })
})

describe('saneo del baremo generado', () => {
  it('tira claves duplicadas, familias o niveles inválidos, y acota el total', () => {
    const bruto = [
      ...Array.from({ length: 12 }, (_, i) => ({
        clave: `c${i}`, familia: 'requisitos', nombre: `C${i}`, nivel: 'importante',
        fuente: 'formulario', anclas: { cumple: 's', parcial: 'm', no_cumple: 'n' },
      })),
      { clave: 'c0', familia: 'requisitos', nombre: 'Duplicado', nivel: 'importante', fuente: 'formulario', anclas: { cumple: '', parcial: '', no_cumple: '' } },
      { clave: 'mala_familia', familia: 'astrologia', nombre: 'X', nivel: 'importante', fuente: 'formulario', anclas: { cumple: '', parcial: '', no_cumple: '' } },
      { clave: 'sin_nombre', familia: 'requisitos', nombre: '', nivel: 'importante', fuente: 'formulario', anclas: { cumple: '', parcial: '', no_cumple: '' } },
    ]
    const out = sanearCriterios(bruto)
    expect(out.length).toBeLessThanOrEqual(MAX_CRITERIOS)
    expect(out.map((c) => c.clave)).not.toContain('mala_familia')
    expect(out.map((c) => c.clave)).not.toContain('sin_nombre')
    expect(new Set(out.map((c) => c.clave)).size).toBe(out.length)
  })
})

describe('hash del puesto: misma vara mientras el puesto no cambie', () => {
  const puesto = {
    title: 'Carretillero/a', sector: 'Logística', location: 'Madrid',
    fields: [{ id: 'carnet', label: '¿Carnet en vigor?', type: 'boolean', required: true }],
  }

  it('es estable para el mismo puesto', async () => {
    expect(await hashPuesto(puesto)).toBe(await hashPuesto({ ...puesto }))
  })

  it('cambia si cambia cualquier pregunta del formulario', async () => {
    const cambiado = {
      ...puesto,
      fields: [{ ...puesto.fields[0], label: '¿Carnet de carretillas en vigor?' }],
    }
    expect(await hashPuesto(cambiado)).not.toBe(await hashPuesto(puesto))
  })
})

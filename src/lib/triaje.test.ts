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
//     recoge (no se castiga por información que nadie pidió).
//
// Cada detector se probó rompiéndolo a propósito (invirtiendo la regla que
// vigila) antes de darlo por bueno.
import {
  FIT_BIEN, MAX_CRITERIOS,
  agregarJuicios, criteriosEfectivos, fusionarJuicio, hashPuesto, normalizarJuicios,
  sanearCriterios, soloConservados,
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

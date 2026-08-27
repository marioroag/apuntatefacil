import { describe, expect, it } from 'vitest'
import { resumenApuntarse, senalesApuntarse } from './apuntarse'
import type { FormField } from './types'

const f = (p: Partial<FormField> & { id: string }): FormField => ({
  type: 'text', label: p.id, required: false, ...p,
})

/**
 * EL GUARDIÁN DE LO QUE CUESTA APUNTARSE.
 *
 * Esto se pinta en la única pantalla donde alguien decide si se fía, así que no
 * puede exagerar en ninguna dirección: ni prometer menos trabajo del que hay ni
 * decir que se pide un CV que nadie pide. Se calcula del formulario real, y
 * estos detectores son los que impiden que el cálculo derive.
 */
describe('resumenApuntarse', () => {
  it('cuenta TODOS los campos, también nombre y teléfono', () => {
    // Lo que se anuncia es el esfuerzo, y escribir tu nombre es esfuerzo. Contar
    // solo "las preguntas del puesto" diría 2 donde hay 4.
    const r = resumenApuntarse([
      f({ id: 'nombre', label: 'Nombre y apellidos', system: true }),
      f({ id: 'telefono', label: 'Teléfono', type: 'phone', system: true }),
      f({ id: 'exp', label: 'Años de experiencia', type: 'number' }),
      f({ id: 'carnet', label: '¿Tienes carnet B?', type: 'boolean' }),
    ])
    expect(r.preguntas).toBe(4)
    expect(r.etiquetas).toEqual(['Nombre y apellidos', 'Teléfono', 'Años de experiencia', '¿Tienes carnet B?'])
  })

  it('un campo sin etiqueta no se cuenta ni se enseña', () => {
    // No se puede anunciar una pregunta que no dice nada.
    const r = resumenApuntarse([f({ id: 'a', label: 'Teléfono' }), f({ id: 'b', label: '   ' })])
    expect(r.preguntas).toBe(1)
    expect(r.etiquetas).toEqual(['Teléfono'])
  })

  it('detecta si se pide un documento', () => {
    expect(resumenApuntarse([f({ id: 'cv', label: 'CV', type: 'file' })]).pideDocumento).toBe(true)
    expect(resumenApuntarse([f({ id: 'n', label: 'Nombre' })]).pideDocumento).toBe(false)
  })
})

describe('senalesApuntarse', () => {
  it('dice las tres, y el singular cuando toca', () => {
    expect(senalesApuntarse(resumenApuntarse([f({ id: 'n', label: 'Nombre' })])))
      .toEqual(['1 pregunta', 'Sin CV', 'Sin crear cuenta'])
  })

  it('no dice "Sin CV" cuando sí se pide uno', () => {
    // El fallo que importa: prometer menos trabajo del que hay.
    const s = senalesApuntarse(resumenApuntarse([
      f({ id: 'n', label: 'Nombre' }),
      f({ id: 'cv', label: 'Tu CV', type: 'file' }),
    ]))
    expect(s).toEqual(['2 preguntas', 'Te pedimos un documento', 'Sin crear cuenta'])
    expect(s).not.toContain('Sin CV')
  })

  it('"Sin crear cuenta" se dice SIEMPRE', () => {
    // Es verdad en todos los casos y es la diferencia más grande con un portal:
    // quien viene de uno no da por hecho que aquí no hace falta registrarse.
    for (const campos of [[], [f({ id: 'cv', label: 'CV', type: 'file' })]])
      expect(senalesApuntarse(resumenApuntarse(campos))).toContain('Sin crear cuenta')
  })
})

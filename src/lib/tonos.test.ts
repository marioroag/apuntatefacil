import { describe, expect, it } from 'vitest'
import { memberAvatarTone } from './format'
import { INTERVIEW_STATUS_META, type InterviewStatus } from './types'
import fuenteFormat from './format.ts?raw'

/**
 * EL GUARDIÁN DEL COLOR DE UNA PERSONA.
 *
 * El problema que resuelve, con nombre y apellidos: desde ago 2026 el bloque de
 * una cita en la agenda se tiñe del color de su anfitrión, y ese color sale de la
 * MISMA tabla que su cara (`memberAvatarTone`) porque el filtro de anfitrión pinta
 * esas caras justo encima de la rejilla: **las caras son la leyenda de los
 * bloques**. En cuanto una entrada de la tabla pinte la cara de un hue y el bloque
 * de otro, la leyenda deja de serlo y nadie se entera, porque cada superficie por
 * separado sigue viéndose bien.
 *
 * No vigila cómo se ve nada. Vigila las cuatro cosas de las que depende que ese
 * color signifique algo.
 */
describe('el guardián del color de una persona', () => {
  /**
   * Las diez entradas, leídas del fuente porque la tabla es privada a propósito.
   * Se acota al bloque de MEMBER_AVATAR_TONES y no se buscan `{ bg: ... }` sueltos
   * por todo el fichero: las etiquetas tienen su propia tabla con la misma forma y
   * sin estos dos campos, así que sin acotar el guardián fallaría por mirar donde
   * no debe (pasó a la primera).
   */
  const bloque = /const MEMBER_AVATAR_TONES = \[([\s\S]*?)\] as const/.exec(fuenteFormat)?.[1] ?? ''
  const entradas = [...bloque.matchAll(/\{[^}]*\}/g)].map((m) => m[0])
  const hue = (clase: string, campo: string) =>
    new RegExp(`${campo}: '(?:bg|ring|text)-([a-z]+)-\\d+'`).exec(clase)?.[1] ?? null

  it('la tabla se lee (si no, todo lo de abajo pasaría en verde sin mirar nada)', () => {
    expect(entradas.length).toBeGreaterThanOrEqual(8)
  })

  /**
   * LA CARA Y EL BLOQUE SON EL MISMO HUE. Es la razón de ser de la tabla: una
   * persona, un color, lo pinte quien lo pinte. `bg` es su disco y `suave`/`canto`
   * su relleno claro en el calendario.
   */
  it('cada entrada pinta sus dos superficies con el mismo color', () => {
    for (const e of entradas) {
      const cara = hue(e, 'bg')
      expect(hue(e, 'suave'), `falta o no coincide "suave" en ${e}`).toBe(cara)
      expect(hue(e, 'canto'), `falta o no coincide "canto" en ${e}`).toBe(cara)
    }
  })

  /**
   * TRES FAMILIAS ESTÁN VETADAS Y CADA UNA POR SU MOTIVO:
   * - grafito: en un calendario ese gris ya significa "hueco libre" (una cita
   *   caída), así que las citas vivas de esa persona se leerían como canceladas;
   * - rojo: reservado a errores y a lo que no se deshace;
   * - índigo y azul: son la marca, que solo dice "esto se pulsa".
   * (El rosa SÍ vale aquí: en la rejilla van teñidos TODOS los bloques, así que
   * uno rosa es otra persona y no una alarma. En un chip suelto no valdría.)
   */
  it('no usa ningún color que ya signifique otra cosa', () => {
    const vetados = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'indigo', 'blue']
    for (const e of entradas) {
      expect(vetados, `${hue(e, 'bg')} ya significa otra cosa en esta app`).not.toContain(hue(e, 'bg'))
    }
  })

  /** La misma semilla, el mismo tono, siempre: es lo que lo hace una identidad. */
  it('la misma persona sale siempre del mismo color', () => {
    expect(memberAvatarTone('laura@apuntatefacil.com')).toBe(memberAvatarTone('LAURA@apuntatefacil.com '))
    expect(memberAvatarTone('a').bg).not.toBe('')
  })

  /**
   * EL FILO DEL ESTADO TIENE QUE PODER LEERSE SOBRE UN RELLENO TEÑIDO. Al mudarse
   * el relleno a la persona, ese filo de 3px pasó a ser el ÚNICO portador del
   * estado, y el tono de `dot` se quedaba en 1,86:1 contra el relleno, por debajo
   * del 3:1 que esta casa exige a un gráfico con significado. `barra` es el mismo
   * color dos peldaños más oscuro, y separa por LUMINOSIDAD, que es lo único
   * fiable cuando el hue de enfrente es arbitrario.
   */
  it('cada estado de entrevista declara su barra, del mismo color y más oscura', () => {
    for (const [estado, meta] of Object.entries(INTERVIEW_STATUS_META) as [InterviewStatus, { dot: string; barra: string }][]) {
      const [, colorPunto, pesoPunto] = /^bg-([a-z]+)-(\d+)$/.exec(meta.dot) ?? []
      const [, colorBarra, pesoBarra] = /^bg-([a-z]+)-(\d+)$/.exec(meta.barra ?? '') ?? []
      expect(colorBarra, `${estado}: la barra tiene que ser del color del punto`).toBe(colorPunto)
      expect(Number(pesoBarra), `${estado}: la barra tiene que ser más oscura que el punto`).toBeGreaterThan(
        Number(pesoPunto),
      )
    }
  })
})

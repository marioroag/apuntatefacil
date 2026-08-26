import { describe, expect, it } from 'vitest'
import { fechaCorta, relativeDate } from './format'

/* ---------------------------------------------------------------------------
   LA FECHA DE UNA COLUMNA (`fechaCorta`), Mario ago 2026.

   Se prueba aquí y no a ojo en el navegador porque sus tres casos difíciles no
   se ven mirando: el cambio de hora, el salto de año y el mes más ancho. Los
   dos primeros solo aparecen dos días al año, y el tercero solo en mayo.
--------------------------------------------------------------------------- */

/** Una fecha LOCAL, que es en lo que piensa quien mira la columna. */
const local = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString()

describe('fechaCorta', () => {
  it('dice Hoy y Ayer, con mayúscula, porque va sola en su columna', () => {
    const ahora = new Date(2026, 7, 26, 15, 30).getTime()
    expect(fechaCorta(local(2026, 8, 26, 9), ahora)).toBe('Hoy')
    expect(fechaCorta(local(2026, 8, 26, 0, 1), ahora)).toBe('Hoy')
    expect(fechaCorta(local(2026, 8, 25, 23, 59), ahora)).toBe('Ayer')
  })

  it('a partir de ahí escribe la fecha, con el mes en mayúscula', () => {
    const ahora = new Date(2026, 7, 26, 15, 30).getTime()
    expect(fechaCorta(local(2026, 8, 24), ahora)).toBe('24 Ago, 2026')
    expect(fechaCorta(local(2026, 5, 28), ahora)).toBe('28 May, 2026')
    expect(fechaCorta(local(2025, 12, 31), ahora)).toBe('31 Dic, 2025')
  })

  it('NO cuenta minutos ni horas: lo que se compara en una lista es el día', () => {
    const ahora = new Date(2026, 7, 26, 15, 30).getTime()
    // Lo que `relativeDate` diría "hace 20 min" / "hace 3 h" aquí es todo "Hoy":
    // en una columna, saber si dos candidaturas son del mismo día no puede
    // depender de hacer la cuenta.
    expect(fechaCorta(local(2026, 8, 26, 15, 10), ahora)).toBe('Hoy')
    expect(fechaCorta(local(2026, 8, 26, 12, 30), ahora)).toBe('Hoy')
  })

  it('el día se compara por CALENDARIO, así que el cambio de hora no lo mueve', () => {
    // En España el reloj se atrasa la madrugada del último domingo de octubre:
    // ese día dura 25 horas. Restando 86.400.000 ms, "ayer por la mañana" caía
    // dentro de "hoy" y la columna decía Hoy a algo de la víspera.
    const lunes = new Date(2026, 9, 26, 10, 0).getTime() // 26-oct-2026, tras el cambio
    expect(fechaCorta(local(2026, 10, 25, 9), lunes)).toBe('Ayer')
    expect(fechaCorta(local(2026, 10, 25, 23), lunes)).toBe('Ayer')
    expect(fechaCorta(local(2026, 10, 26, 0, 30), lunes)).toBe('Hoy')
  })

  it('cruza el fin de año sin marearse', () => {
    const enero = new Date(2027, 0, 1, 10, 0).getTime()
    expect(fechaCorta(local(2026, 12, 31, 20), enero)).toBe('Ayer')
    expect(fechaCorta(local(2026, 12, 30, 20), enero)).toBe('30 Dic, 2026')
  })

  it('una fecha ilegible no pinta "NaN" en la celda', () => {
    expect(fechaCorta('vete a saber')).toBe('')
  })
})

describe('relativeDate no se toca: es la de DENTRO de una frase', () => {
  it('sigue en minúscula y sigue contando minutos y horas', () => {
    const ahora = new Date(2026, 7, 26, 15, 30).getTime()
    // "Actualizado hace 2 h" se lee bien; "Actualizado Hoy" no dice lo mismo, y
    // "Actualizado Hace 2 h" se lee como un error de mayúsculas.
    expect(relativeDate(local(2026, 8, 26, 13, 30), ahora)).toBe('hace 2 h')
    expect(relativeDate(local(2026, 8, 26, 15, 10), ahora)).toBe('hace 20 min')
    expect(relativeDate(local(2026, 8, 25, 15, 30), ahora)).toBe('ayer')
  })
})

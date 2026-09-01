import { describe, expect, it } from 'vitest'
import { clickDeFila, invasionDeSeleccion } from './fila'
import fuenteFila from './fila.ts?raw'

/**
 * EL GUARDIÁN DE LAS FILAS PULSABLES.
 *
 * El problema que resuelve, con nombre y apellidos: el pop-up del candidato no
 * abría "la mayoría de las veces" en pantalla ancha, y sí al estrechar la
 * ventana. No era el navegador ni una carrera de estados: cada celda con
 * `onClick={e => e.stopPropagation()}` es un trozo de fila que deja de abrir, y
 * en `table-fixed` la columna sin ancho declarado (Etiquetas en el puesto,
 * Puesto en la bandeja) se queda con TODO el sobrante: 350px de los 1174 de la
 * fila. Al estrechar por debajo de `xl` esa columna desaparecía y el fallo
 * "se arreglaba solo".
 *
 * Por eso esto no vigila cómo se ve nada: vigila que la regla siga siendo
 * "toda la fila abre menos los controles" y que nadie vuelva a apagar celdas
 * enteras. Cuando falle, el mensaje dice qué hacer.
 */

// Los ficheros se leen con los globs de Vite y no con `node:fs`, igual que en el
// guardián del acabado: el tsconfig de la app no tiene los tipos de node.
const FICHEROS = Object.entries(
  import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
).map(([ruta, código]) => ({ ruta: ruta.replace('../', ''), código }))

/**
 * Celdas que a propósito NO abren la ficha. Una excepción sin motivo escrito es
 * un olvido con permiso, así que aquí el motivo es obligatorio.
 */
const CELDAS_MUDAS: { ruta: string; motivo: string }[] = [
  {
    ruta: 'screens/Dashboard.tsx',
    motivo:
      'La celda del checkbox es la zona de puntería de su casilla (40px de 1174), no un hueco de la fila: pulsar ahí es querer seleccionar, no abrir.',
  },
]

/**
 * Las etiquetas `<tr ...>` completas. No vale una expresión regular hasta el
 * primer `>`: el `=>` de cualquier manejador la cortaría por la mitad y el
 * detector daría verde justo en las filas que sí tienen onClick. Se recorre
 * contando llaves y la etiqueta acaba en el primer `>` a nivel cero.
 */
function etiquetasTr(código: string): string[] {
  const out: string[] = []
  for (const m of código.matchAll(/<tr\b/g)) {
    let nivel = 0
    for (let i = m.index; i < código.length; i++) {
      const ch = código[i]
      if (ch === '{') nivel++
      else if (ch === '}') nivel--
      else if (ch === '>' && nivel === 0) {
        out.push(código.slice(m.index, i + 1))
        break
      }
    }
  }
  return out
}

describe('la fila abre entera', () => {
  it('ninguna celda apaga el click de su fila sin motivo declarado', () => {
    for (const { ruta, código } of FICHEROS) {
      const apaga = /<td[^>]*onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(código)
      if (!apaga) continue
      const permitida = CELDAS_MUDAS.some((c) => c.ruta === ruta)
      expect(
        permitida,
        `${ruta} apaga el click de una celda entera. En table-fixed la columna elástica se queda con todo el ancho sobrante, así que eso deja muerto un tercio de la fila (y solo en pantalla ancha, que es lo que hace el fallo tan difícil de creer). Deja que el click llegue a la fila y filtra en el <tr> con clickDeFila(e), o declara la celda en CELDAS_MUDAS con su motivo.`,
      ).toBe(true)
    }
  })

  it('toda fila que abre una ficha filtra con clickDeFila', () => {
    for (const { ruta, código } of FICHEROS) {
      for (const tag of etiquetasTr(código)) {
        if (!tag.includes('onClick')) continue
        expect(
          tag.includes('clickDeFila'),
          `${ruta} tiene una <tr> pulsable que llama a su acción sin filtrar el origen del click: un click en su pill de estado o en un enlace de dentro abrirá además la ficha. Envuélvelo en clickDeFila(e) (src/lib/fila.ts).`,
        ).toBe(true)
      }
    }
  })
})

describe('clickDeFila distingue la fila de sus controles', () => {
  const evento = (dentroDeControl: boolean) => ({
    target: { closest: (sel: string) => (dentroDeControl && sel.includes('button') ? {} : null) },
  })

  it('deja pasar el click que nace en la superficie de la fila', () => {
    expect(clickDeFila(evento(false) as never)).toBe(true)
  })

  it('se aparta cuando el click nace dentro de un control', () => {
    expect(clickDeFila(evento(true) as never)).toBe(false)
  })

  it('deja pasar si el origen no sabe decir dónde está', () => {
    // Sin `closest` (un target raro) la fila abre: el fallo caro es no abrir.
    expect(clickDeFila({ target: null } as never)).toBe(true)
  })

  it('cubre los controles reales que hay dentro de una fila', () => {
    // La lista se lee del propio módulo: si alguien quita `a` o `input` de ahí,
    // esto lo cuenta en vez de descubrirlo pulsando.
    for (const control of ['a', 'button', 'input', 'label']) {
      expect(
        new RegExp(`(^|[\\s'])${control}[,']`).test(fuenteFila),
        `clickDeFila ya no reconoce <${control}> como control: un click dentro de uno abrirá además la ficha.`,
      ).toBe(true)
    }
  })
})

/**
 * EL GUARDIÁN DE LA INVASIÓN.
 *
 * Lo que de verdad vigila, porque es lo único que aquí se puede romper sin que
 * se note: la regla de que solo invade la fila marcada SOLA. Sin ella, un
 * "seleccionar todo" con una fila ya marcada deja una rezagada animándose
 * mientras las otras cien aparecen de golpe, y eso solo se ve en el clic
 * concreto que lo provoca. El resto de casos son la especificación escrita: qué
 * filo elige cada vecindad, y que el orden que manda es en el que se PINTA (la
 * tabla se ordena por seis columnas, así que "contiguo" cambia con el orden).
 */
describe('la selección invade desde la fila de al lado', () => {
  const filas = ['a', 'b', 'c', 'd']
  const set = (...ids: string[]) => new Set(ids)

  it('entra por arriba cuando la vecina de arriba ya estaba marcada', () => {
    expect(invasionDeSeleccion(filas, set('a'), set('a', 'b')).get('b')).toBe('arriba')
  })

  it('entra por abajo cuando la que ya estaba marcada es la de abajo', () => {
    expect(invasionDeSeleccion(filas, set('c'), set('b', 'c')).get('b')).toBe('abajo')
  })

  it('entra por los dos filos al rellenar un hueco', () => {
    expect(invasionDeSeleccion(filas, set('a', 'c'), set('a', 'b', 'c')).get('b')).toBe('ambos')
  })

  it('una fila marcada sola no invade: no hay de dónde venga el color', () => {
    expect(invasionDeSeleccion(filas, set(), set('b')).size).toBe(0)
    // Y tampoco vale una marcada que no esté PEGADA: `a` y `c` no se tocan.
    expect(invasionDeSeleccion(filas, set('a'), set('a', 'c')).size).toBe(0)
  })

  it('marcarlas todas de golpe no invade ninguna, ni aunque una toque a otra ya marcada', () => {
    expect(invasionDeSeleccion(filas, set(), set(...filas)).size).toBe(0)
    // Este es el caso que hay que sostener, y el que falla en cuanto alguien
    // quita la regla de "solo una": `d` ya estaba marcada y `c` llega pegada a
    // ella, pero llega con otras dos, así que no se ha unido a nadie, han
    // llegado todas juntas.
    expect(invasionDeSeleccion(filas, set('d'), set(...filas)).size).toBe(0)
  })

  it('desmarcar no invade', () => {
    expect(invasionDeSeleccion(filas, set('a', 'b'), set('a')).size).toBe(0)
  })

  it('el vecino se busca en el orden en que se PINTA la tabla', () => {
    // Las mismas dos filas con la tabla ordenada al revés: `b` deja de tener a
    // `a` encima y pasa a tenerla debajo, así que el tinte entra por el filo
    // contrario. Es lo que obliga a que quien llama pase las filas ya ordenadas.
    expect(invasionDeSeleccion(['d', 'c', 'b', 'a'], set('a'), set('a', 'b')).get('b')).toBe('abajo')
  })

  it('la primera y la última fila solo miran hacia dentro', () => {
    expect(invasionDeSeleccion(filas, set('b'), set('a', 'b')).get('a')).toBe('abajo')
    expect(invasionDeSeleccion(filas, set('c'), set('c', 'd')).get('d')).toBe('arriba')
  })
})

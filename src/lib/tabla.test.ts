import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DE LA VENTANA DE FILAS.
 *
 * Las dos tablas de la app pintan solo las filas que caben en pantalla y dejan
 * el sitio de las demás con dos huecos de altura calculada (ver la nota larga en
 * `components/ui/DataTable.tsx`). Eso descansa en un CONTRATO que nadie ve:
 *
 *   el hueco de arriba mide `desde * ALTO_FILA`,
 *   así que ALTO_FILA tiene que ser exactamente lo que mide una fila.
 *
 * Si un día `ROW` cambia de alto y `ALTO_FILA` se queda como está, no se rompe
 * nada de golpe: la ventana se va desplazando respecto a lo que de verdad se ve,
 * y a mitad de una lista larga aparece una franja en blanco donde debería haber
 * gente. Es el peor tipo de fallo, el que solo se nota lejos de donde se causó.
 * Por eso esto no es un comentario: es una prueba que falla.
 *
 * Y vigila una segunda cosa: que quien recorta las filas pinte LOS DOS huecos.
 * Con uno solo, la barra de desplazamiento mide menos de lo que hay y la lista
 * se acaba antes de tiempo.
 *
 * LO QUE NO PUEDE VIGILAR, y sigue siendo abrir el navegador: si el colchón es
 * bastante para que un desplazamiento rápido no llegue al borde de lo pintado.
 */

const FUENTES = import.meta.glob('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PRIMITIVA = '../components/ui/DataTable.tsx'

/** Lo que mide en píxeles una utilidad de altura de Tailwind (`h-14` = 56). */
const enPixeles = (utilidad: string) => Number(utilidad) * 4

describe('el guardián de la ventana de filas', () => {
  it('ALTO_FILA es lo que de verdad mide una fila', () => {
    const src = FUENTES[PRIMITIVA]
    expect(src, 'falta components/ui/DataTable.tsx').toBeTruthy()

    const declarado = src.match(/export const ALTO_FILA = (\d+)/)
    expect(declarado, 'DataTable ya no declara ALTO_FILA').toBeTruthy()

    // `ROW` es la única fuente del alto de una fila de datos.
    const fila = src.match(/export const ROW = `[^`]*\bh-(\d+)\b/)
    expect(fila, 'ROW ya no declara su alto con una utilidad `h-N`').toBeTruthy()

    expect(
      Number(declarado![1]),
      `ROW mide h-${fila![1]} (${enPixeles(fila![1])}px) y ALTO_FILA dice ${declarado![1]}.\n` +
        'Los huecos que sustituyen a las filas que no se pintan se calculan con ALTO_FILA,\n' +
        'así que con un alto distinto la ventana se desplaza respecto a lo que se ve.\n' +
        'Cuadra los dos números.',
    ).toBe(enPixeles(fila![1]))
  })

  it('quien recorta las filas pinta los dos huecos', () => {
    const aMedias = Object.entries(FUENTES)
      .filter(([ruta, src]) => ruta !== PRIMITIVA && src.includes('useFilasALaVista'))
      .filter(([, src]) => (src.match(/<HuecoFilas\b/g) ?? []).length < 2)
      .map(([ruta]) => ruta)

    expect(
      aMedias,
      `Estas pantallas recortan las filas y no dejan los dos huecos:\n  ${aMedias.join('\n  ')}\n` +
        'Hacen falta el de arriba (`huecoArriba`) y el de abajo (`huecoAbajo`), o la\n' +
        'barra de desplazamiento mide menos de lo que hay y la lista se acaba antes.',
    ).toEqual([])
  })
})

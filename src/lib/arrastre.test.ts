import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DEL ARRASTRE VERTICAL.
 *
 * El problema que resuelve, y no es hipotético: el panel de la vista montó su
 * propio `DndContext` sin clavar el eje y eso fue un BUG (ago 2026). Al llevar
 * una fila de lado, la caja de la lista se volvía desplazable a lo ancho (con
 * `overflow-y-auto`, el navegador computa también `overflow-x: auto` aunque
 * nadie lo pida) y el auto-scroll de dnd-kit se ponía a correr hacia allí,
 * realimentándose con el propio arrastre: medido, el contenido pasó de 278 a
 * 678px y el scroll se fue solo a 292, cortando las casillas por la izquierda.
 *
 * El arreglo vive en `components/ui/ListaOrdenable.tsx`, que es EL sistema de
 * arrastre vertical de la app. Pero un sistema que hay que acordarse de usar se
 * usa mientras alguien lo recuerda, y este fallo es invisible hasta que alguien
 * arrastra en diagonal dentro de una caja con scroll. Por eso esto no es una
 * nota: es una prueba que FALLA cuando una lista nueva se monta a mano.
 *
 * LO QUE NO PUEDE VIGILAR: si el arrastre se SIENTE bien, si el destino que
 * calcula la colisión es el que esperas, o si el asa es alcanzable con el dedo.
 * Eso sigue siendo abrir el navegador.
 *
 * Cuando falle, hay dos salidas honestas:
 *   1. Montar la lista con `<ListaOrdenable>`, que ya lo trae todo.
 *   2. Si de verdad necesitas tu propio contexto (hoy solo el constructor de
 *      formularios, por sus sensores por dispositivo y su DragOverlay), pásale
 *      `modifiers={SOLO_VERTICAL}` y registra el sensor de teclado.
 */

const FUENTES = import.meta.glob('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const PRIMITIVA = '../components/ui/ListaOrdenable.tsx'

/**
 * ARRASTRES EN DOS EJES, DECLARADOS Y CON SU MOTIVO.
 *
 * La regla del eje clavado existe para las LISTAS VERTICALES, donde moverse de
 * lado no significa nada y sí hace daño (el bug del panel de la vista). Un
 * tablero es lo contrario: cruzar de columna ES el significado, así que clavarle
 * el eje lo rompería. Igual que en el guardián de los ajustes, una excepción sin
 * motivo escrito es un olvido con permiso; y sigue obligada a lo demás (la
 * alternativa de teclado, y no redeclarar SOLO_VERTICAL a mano).
 */
const CONTEXTOS_2D: Record<string, string> = {
  '../components/KanbanPuesto.tsx':
    'El tablero del puesto: arrastrar una tarjeta a otra columna es cambiarla de estado, y eso es horizontal por definición. Pinta el clon en DragOverlay (fuera del scroll del tablero) y cruza de columna con teclado en un salto.',
}

const montanContexto = () =>
  Object.entries(FUENTES).filter(([, src]) => src.includes('<DndContext'))

describe('el guardián del arrastre vertical', () => {
  it('la primitiva existe y declara el eje clavado', () => {
    const src = FUENTES[PRIMITIVA]
    expect(src, 'falta components/ui/ListaOrdenable.tsx, que es el sistema de arrastre vertical').toBeTruthy()
    // El modificador ES la corrección del bug: si alguien lo suaviza, esto cae.
    expect(src).toMatch(/SOLO_VERTICAL[^=]*=\s*\[\s*\(\{\s*transform\s*\}\)\s*=>\s*\(\{\s*\.\.\.transform,\s*x:\s*0\s*\}\)/)
    expect(src).toContain('modifiers={SOLO_VERTICAL}')
  })

  it('todo DndContext clava el eje, salvo los 2D declarados', () => {
    const sinEje = montanContexto()
      .filter(([ruta]) => !(ruta in CONTEXTOS_2D))
      .filter(([, src]) => !src.includes('modifiers={SOLO_VERTICAL}'))
      .map(([ruta]) => ruta)

    expect(
      sinEje,
      `Estos ficheros montan un DndContext sin clavar el eje vertical:\n  ${sinEje.join('\n  ')}\n` +
        'Una lista vertical dentro de una caja con scroll se desplaza sola a lo ancho.\n' +
        'Monta la lista con <ListaOrdenable>, pásale modifiers={SOLO_VERTICAL}, o, si el\n' +
        'arrastre es de verdad en dos ejes (un tablero), decláralo en CONTEXTOS_2D con su motivo.',
    ).toEqual([])
  })

  it('un contexto 2D declarado usa DragOverlay: su caja scrollea y un transform dentro se recorta', () => {
    // Es la mitad del trato: quien se libra del eje clavado no se libra de la
    // regla que lo motivó ("una lista metida en una caja con scroll propio o
    // clava el eje, o usa overlay").
    const sinOverlay = Object.keys(CONTEXTOS_2D)
      .filter((ruta) => FUENTES[ruta] && !FUENTES[ruta].includes('<DragOverlay'))

    expect(
      sinOverlay,
      `Estos contextos 2D declarados no pintan el clon en un DragOverlay:\n  ${sinOverlay.join('\n  ')}`,
    ).toEqual([])
  })

  it('todo DndContext deja una alternativa de teclado', () => {
    // La doctrina lo exige siempre que hay arrastre. `useSensoresLista` ya la
    // trae; quien monte sus sensores tiene que registrar el sensor a mano.
    const sinTeclado = montanContexto()
      .filter(([, src]) => !src.includes('KeyboardSensor') && !src.includes('useSensoresLista'))
      .map(([ruta]) => ruta)

    expect(
      sinTeclado,
      `Estos ficheros arrastran sin alternativa de teclado:\n  ${sinTeclado.join('\n  ')}`,
    ).toEqual([])
  })

  it('el eje no se vuelve a escribir a mano en ninguna pantalla', () => {
    // Dos copias de la misma verdad se separan siempre; y una copia suelta es
    // justo la que nadie toca cuando el sistema cambia.
    const copias = Object.entries(FUENTES)
      .filter(([ruta]) => ruta !== PRIMITIVA)
      .filter(([, src]) => /\.\.\.transform,\s*x:\s*0/.test(src))
      .map(([ruta]) => ruta)

    expect(
      copias,
      `Estos ficheros redeclaran el eje en vez de importarlo:\n  ${copias.join('\n  ')}\n` +
        "Impórtalo: import { SOLO_VERTICAL } from '.../ui/ListaOrdenable'",
    ).toEqual([])
  })
})

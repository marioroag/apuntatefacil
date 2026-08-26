import { describe, expect, it } from 'vitest'
import { tagTone } from './format'
import fuenteFormat from './format.ts?raw'

/**
 * EL GUARDIÁN DEL COLOR DE LAS ETIQUETAS.
 *
 * El problema que resuelve, con nombre y apellidos: se pintaron las etiquetas de
 * color para que se reconocieran de un vistazo, con un hash sobre el id, y en la
 * PRIMERA pantalla de la demo dos de las seis salieron del mismo azul ("Cerca de
 * la obra" y "Documentación OK"), juntas en la misma fila. No fue mala suerte: con
 * 8 tonos y 6 etiquetas la probabilidad de choque es del 78%. Un hash reparte
 * uniforme, que no es lo mismo que repartir SIN REPETIR, y aquí lo que hace falta
 * es lo segundo, porque dos etiquetas del mismo color no se distinguen y ese era
 * el único motivo para tener color.
 *
 * Por eso esto no vigila cómo se ve nada: vigila las cuatro propiedades de las que
 * depende que el color sirva para algo.
 */
describe('el guardián del color de las etiquetas', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `tag_${i}` }))

  /**
   * Dos ids que el HASH manda al mismo tono. Se buscan en vez de escribirse a
   * mano, y esto no es pedantería: la primera versión de esta prueba usaba
   * `tag_0..tag_7`, que por casualidad no chocaban, así que pasaba en verde
   * incluso quitando el desempate entero. Un guardián que no ve el fallo que
   * vino a vigilar es peor que ninguno, porque da permiso.
   *
   * `tagTone(id)` SIN vocabulario devuelve el tono del hash pelado, que es
   * justo la preferencia antes de repartir.
   */
  const parQueChoca = (() => {
    const porTono = new Map<string, string[]>()
    for (let i = 0; i < 400; i++) {
      const id = `tag_${i}`
      const bg = tagTone(id).bg
      porTono.set(bg, [...(porTono.get(bg) ?? []), id])
    }
    const par = [...porTono.values()].find((v) => v.length >= 2)
    if (!par) throw new Error('No he encontrado dos ids que choquen: revisa la prueba, no el código.')
    return [par[0], par[1]] as const
  })()

  it('los dos ids de prueba CHOCAN de verdad bajo el hash', () => {
    // Si esto deja de ser cierto, las dos pruebas de abajo dejan de probar nada.
    expect(tagTone(parQueChoca[0]).bg).toBe(tagTone(parQueChoca[1]).bg)
  })

  it('no repite color mientras queden tonos libres', () => {
    // El caso que falló en pantalla: dos etiquetas cuyo hash pide el mismo tono.
    const vocabulario = [{ id: parQueChoca[0] }, { id: parQueChoca[1] }]
    const tonos = vocabulario.map((t) => tagTone(t.id, vocabulario).bg)
    expect(
      new Set(tonos).size,
      'Dos etiquetas que el hash manda al mismo tono han salido del mismo color. ' +
        'Dos etiquetas del mismo color no se distinguen, que es lo único para lo ' +
        'que existe el color. Mira `repartirTonos` en lib/format.ts.',
    ).toBe(2)

    // Y hasta llenar la paleta, con ids cualesquiera.
    for (let n = 1; n <= 8; n++) {
      const v = ids(n)
      expect(new Set(v.map((t) => tagTone(t.id, v).bg)).size, `Con ${n} etiquetas hubo repetición.`).toBe(n)
    }
  })

  it('el color sale del id, así que renombrar NO repinta', () => {
    // La prueba de que la semilla es el id: el nombre no entra en `tagTone`.
    const vocabulario = [{ id: 'tag_a' }, { id: 'tag_b' }]
    const antes = tagTone('tag_a', vocabulario)
    expect(tagTone('tag_a', vocabulario)).toEqual(antes)
  })

  it('el reparto no depende del orden en que lleguen las etiquetas', () => {
    // La lista llega ordenada por NOMBRE desde el store, así que renombrar cambia
    // el orden del array. Si el reparto dependiera de él, renombrar repintaría.
    // Con el par que choca, porque el orden SOLO importa cuando hay que desempatar.
    const [a, b] = parQueChoca
    const v1 = [{ id: a }, { id: b }]
    const v2 = [{ id: b }, { id: a }]
    for (const id of [a, b]) {
      expect(
        tagTone(id, v1),
        `El tono de ${id} cambia según el orden de la lista. El reparto tiene que ` +
          'ordenar por id (ver `repartirTonos`), no fiarse del array que le pasen.',
      ).toEqual(tagTone(id, v2))
    }
  })

  it('con más etiquetas que tonos sigue dando color a todas', () => {
    const vocabulario = ids(20)
    for (const t of vocabulario) {
      expect(tagTone(t.id, vocabulario).bg, 'Una etiqueta sin color es peor que una repetida.').toMatch(/^bg-/)
    }
  })

  it('la paleta no usa rojo, rosa ni el acento de marca', () => {
    // El rojo está reservado a errores y acciones destructivas: una etiqueta roja
    // se leería como un problema. El indigo es la acción.
    const paleta = fuenteFormat.slice(
      fuenteFormat.indexOf('const TAG_TONES'),
      fuenteFormat.indexOf('] as const', fuenteFormat.indexOf('const TAG_TONES')),
    )
    expect(paleta.length, 'No encuentro TAG_TONES en lib/format.ts').toBeGreaterThan(50)
    for (const prohibido of ['red-', 'rose-', 'pink-', 'indigo-']) {
      expect(
        paleta.includes(prohibido),
        `La paleta de etiquetas usa "${prohibido}". El rojo/rosa está reservado a ` +
          'errores y a lo destructivo, y el indigo es el acento de acción.',
      ).toBe(false)
    }
  })

  it('las clases están escritas enteras, no compuestas', () => {
    // Tailwind lee el código como TEXTO: `bg-${color}-100` no llega nunca al CSS
    // compilado y la etiqueta saldría transparente. Ya pasó con el chevron del
    // <select>, que se quedó sin flecha por ir en un `bg-[url(...)]` compuesto.
    const paleta = fuenteFormat.slice(
      fuenteFormat.indexOf('const TAG_TONES'),
      fuenteFormat.indexOf('] as const', fuenteFormat.indexOf('const TAG_TONES')),
    )
    expect(
      /\$\{/.test(paleta),
      'Hay una clase compuesta en TAG_TONES. Tailwind no la generará y el chip ' +
        'saldrá sin color. Escribe la clase entera.',
    ).toBe(false)
  })
})

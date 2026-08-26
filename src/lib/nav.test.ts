import { describe, expect, it } from 'vitest'
import { navGroups, type NavContext } from './nav'

/**
 * EL GUARDIÁN DEL MENÚ.
 *
 * El problema que resuelve, con nombre y apellidos: "Ajustes" acabó colgando del
 * `showEntrevistas` de su vecino, así que en Esencial y en Prueba desaparecía
 * del menú entero. Nadie lo escribió mal a propósito; pasó porque cada destino
 * era un `div` suelto y colgar uno del `&&` de al lado era lo cómodo. Ahora los
 * destinos se declaran (`nav.ts`) y esto vigila que la declaración se sostenga.
 *
 * No comprueba cómo se ve el menú: comprueba que **lo que se declara sea
 * coherente**, que es lo que se rompe cuando dentro de tres meses se añada una
 * tab nueva. Cuando falle, el mensaje dice qué hacer.
 */

const CONTEXTO_BASE: NavContext = {
  plan: 'multi',
  empresa: 'Construcciones Teide',
  isStaff: false,
  demo: false,
  counts: { bandeja: 0, equipo: 0 },
}

const ctx = (parcial: Partial<NavContext>): NavContext => ({ ...CONTEXTO_BASE, ...parcial })

const items = (c: NavContext) => navGroups(c).flatMap((g) => g.items)
const ids = (c: NavContext) => items(c).map((i) => i.id)

describe('el menú se declara, no se improvisa', () => {
  it('ningún grupo llega con la cabecera huérfana', () => {
    // Un grupo sin ítems visibles no es "un grupo vacío": es una cabecera
    // anunciando nada y un hueco en el menú. Se filtra en `navGroups`.
    for (const plan of ['trial', 'esencial', 'pro', 'multi']) {
      for (const isStaff of [false, true]) {
        const grupos = navGroups(ctx({ plan, isStaff }))
        for (const g of grupos) {
          expect(g.items.length, `El grupo "${g.id}" (plan ${plan}) se pinta sin ítems: fíltralo en navGroups.`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('toda señal de novedad dice de qué es', () => {
    // El menú pinta un PUNTO, no una cifra: el número entero solo existe para
    // quien usa lector de pantalla. Sin ese texto, la señal es un punto mudo.
    for (const it of items(ctx({ counts: { bandeja: 3, equipo: 3 } }))) {
      if (it.novedades !== undefined) {
        expect(it.novedadesLabel, `"${it.label}" lleva señal de novedad y no dice de qué: añádele novedadesLabel.`).toBeTypeOf('function')
        // Aquí el número SÍ va en el texto (es lo único que lo lleva), pero el
        // singular y el plural tienen que distinguirse.
        expect(it.novedadesLabel!(1), `El novedadesLabel de "${it.label}" no distingue singular de plural.`).not.toBe(it.novedadesLabel!(2))
        // Y tiene que decir CUÁNTAS. Esta comprobación llegó tarde: la de arriba
        // pasaba en verde con la Bandeja leyéndose "candidaturas nuevas", sin
        // cifra, porque distinguir singular de plural no obliga a contar. El
        // punto rojo no lleva número, así que si no está aquí no está en ninguna
        // parte, y quien no ve la pantalla se quedaba sin el dato entero.
        expect(it.novedadesLabel!(7), `El novedadesLabel de "${it.label}" no dice CUÁNTAS: el punto no lleva cifra, así que el número solo puede vivir aquí.`).toContain('7')
      }
    }
  })

  it('el menú no pinta ninguna cifra por su cuenta', () => {
    // La única cifra del lateral es la de Notificaciones, y la pinta ella misma
    // (`Avisos.tsx`), no el registro. Si vuelve a aparecer un `count` aquí, es
    // que alguien ha vuelto a colar un número en el menú.
    for (const it of items(ctx({ isStaff: true }))) {
      expect('count' in it, `"${it.label}" declara un contador: en el lateral las novedades se dicen con un punto (novedades/novedadesLabel).`).toBe(false)
    }
  })

  it('las rutas son relativas a la base y los ids no chocan', () => {
    // Las rutas se concatenan a `/app` o `/demo`: una sin barra inicial se
    // pegaría al base y llevaría a ninguna parte.
    const vistos = new Set<string>()
    for (const it of items(ctx({ isStaff: true }))) {
      if (it.to !== undefined) {
        expect(it.to.startsWith('/'), `La ruta de "${it.label}" tiene que empezar por "/": es relativa a /app o /demo.`).toBe(true)
      }
      expect(vistos.has(it.id), `El id "${it.id}" está declarado dos veces.`).toBe(false)
      vistos.add(it.id)
    }
  })

  it('un ítem lleva a un sitio o abre una capa, nunca las dos ni ninguna', () => {
    // Desde el reskin hay dos clases de fila: las que navegan (`to`) y las que
    // abren algo encima (`capa`: Buscar, Notificaciones). Un ítem con las dos no
    // se sabe qué hace al pulsarlo, y uno sin ninguna es una fila muerta que se
    // pinta igual que las vivas. El lateral se fía de esto para elegir si pinta
    // un <NavLink> o un <button>.
    for (const it of items(ctx({ isStaff: true }))) {
      const declara = [it.to, it.capa].filter((x) => x !== undefined).length
      expect(declara, `"${it.label}" declara ${declara === 0 ? 'ni ruta ni capa' : 'ruta Y capa'}: tiene que ser una de las dos.`).toBe(1)
    }
  })

  it('lo que abre una capa no lleva señal propia', () => {
    // Notificaciones tiene número, pero se lo pinta el propio timbre, que es
    // quien lo sabe. Declararlo aquí sería llevar la misma cuenta en dos sitios
    // y verlos discrepar el día que una se quede atrás.
    for (const it of items(ctx({ counts: { bandeja: 3, equipo: 3 } }))) {
      if (it.capa) {
        expect(it.novedades, `"${it.label}" abre una capa y además declara señal: que la lleve quien pinta la capa.`).toBeUndefined()
      }
    }
  })

  it('sin guiones largos ni gritos en las etiquetas', () => {
    for (const g of navGroups(ctx({ isStaff: true }))) {
      expect(g.label ?? '', `La cabecera "${g.label}" lleva guion largo, que no se usa en ningún texto visible.`).not.toContain('—')
      for (const it of g.items) {
        expect(it.label, `La etiqueta "${it.label}" lleva guion largo.`).not.toContain('—')
      }
    }
  })
})

describe('el menú es el mismo para todos los planes', () => {
  it('Equipo y Entrevistas las tiene todo el mundo', () => {
    // Con el pago por proceso (ago 2026) el producto entero está incluido: los
    // candados por plan murieron. Se comprueba en TODOS los planes, también los
    // tiers retirados, que ganaron las features al retirarse el gating.
    for (const plan of ['trial', 'proceso', 'esencial', 'pro', 'multi']) {
      expect(ids(ctx({ plan })), `Equipo falta en ${plan}.`).toContain('equipo')
      expect(ids(ctx({ plan })), `Entrevistas falta en ${plan}.`).toContain('entrevistas')
    }
  })

  it('Vista general y Bandeja también', () => {
    // Son el suelo del producto: sin ellas no hay dónde volver ni dónde mirar.
    for (const plan of ['trial', 'proceso', 'esencial', 'pro', 'multi']) {
      expect(ids(ctx({ plan })), `Vista general falta en ${plan}.`).toContain('resumen')
      expect(ids(ctx({ plan })), `Bandeja falta en ${plan}.`).toContain('bandeja')
    }
  })

  it('el hilo de Meridian no deja entrada en el menú', () => {
    // Se retiró en ago 2026 y no vuelve. El guardián se queda para que nadie la
    // devuelva sin darse cuenta: el TRIAJE sigue vivo, la pantalla no.
    expect(ids(ctx({ plan: 'proceso' })).includes('meridian')).toBe(false)
  })
})

describe('la zona de admin es del equipo de Apúntate Fácil', () => {
  it('no existe para quien no es staff', () => {
    expect(navGroups(ctx({ isStaff: false })).some((g) => g.id === 'admin')).toBe(false)
  })

  it('tampoco en la demo, aunque seas staff', () => {
    expect(navGroups(ctx({ isStaff: true, demo: true })).some((g) => g.id === 'admin')).toBe(false)
  })

  it('y sí para el staff fuera de la demo', () => {
    expect(ids(ctx({ isStaff: true }))).toEqual(expect.arrayContaining(['admin-panel', 'admin-soporte']))
  })
})

describe('lo que bajó de la barra al lateral está y está una sola vez', () => {
  // La regla de antes era la contraria ("Ajustes no vuelve al lateral") porque
  // Ajustes vivía en el engranaje de la barra superior y llegó a estar en los dos
  // sitios. Con el reskin (ago 2026) la barra se retiró entera, así que Ajustes,
  // Buscar y Notificaciones bajaron aquí. Es una DECISIÓN, y lo que hay que
  // vigilar ahora es que estén, en todos los planes, y que no se dupliquen.
  it('Ajustes, Buscar y Notificaciones están en el menú, en cualquier plan', () => {
    for (const plan of ['trial', 'proceso', 'esencial', 'pro', 'multi']) {
      const del = items(ctx({ plan, isStaff: true }))
      expect(del.map((i) => i.to), `Ajustes falta en ${plan}: se quedó sin barra donde vivir.`).toContain('/ajustes')
      expect(del.map((i) => i.capa), `Buscar falta en ${plan}.`).toContain('buscar')
      expect(del.map((i) => i.capa), `Notificaciones falta en ${plan}.`).toContain('avisos')
    }
  })

  it('cada capa se abre desde un solo sitio', () => {
    const capas = items(ctx({ isStaff: true })).map((i) => i.capa).filter(Boolean)
    expect(new Set(capas).size, 'Hay dos filas que abren la misma capa: déjala en una.').toBe(capas.length)
  })
})

describe('el bloque de la empresa se llama como la empresa', () => {
  it('la cabecera es su nombre, no una etiqueta fija', () => {
    // Es lo que sustituyó a la esquina de empresa de la barra: el segundo bloque
    // del menú no se presenta como "Empresa", se presenta diciendo de quién es.
    const g = navGroups(ctx({ empresa: 'Logística Anaga' })).find((x) => x.id === 'empresa')
    expect(g?.label).toBe('Logística Anaga')
  })

  it('los puestos entran en ese bloque y no en otro', () => {
    // `conPuestos` es lo único que el registro dice de los puestos: en qué bloque
    // caen y con qué vecinos. Su contenido son datos y lo pinta el lateral.
    const conPuestos = navGroups(ctx({})).filter((g) => g.conPuestos)
    expect(conPuestos.map((g) => g.id), 'Los puestos tienen que colgar de un bloque y de uno solo.').toEqual(['empresa'])
  })
})

import { describe, expect, it } from 'vitest'
import { navGroups, type NavContext } from './nav'
import { MERIDIAN_CHAT_ENABLED } from './meridian'

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
  isStaff: false,
  demo: false,
  counts: { bandeja: 0, entrevistas: 0, equipo: 0, meridian: 0 },
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

  it('todo contador dice qué cuenta', () => {
    // "272" a secas no informa a quien no ve la pantalla. Si un ítem admite
    // contador, tiene que traer el texto que lo explica.
    for (const it of items(ctx({ counts: { bandeja: 3, entrevistas: 3, equipo: 3, meridian: 3 } }))) {
      if (it.count !== undefined) {
        expect(it.contarLabel, `"${it.label}" lleva contador y no dice qué cuenta: añádele contarLabel.`).toBeTypeOf('function')
        // La chapa ya enseña el número: repetirlo en el texto accesible haría
        // que se leyera dos veces ("Bandeja 272 272 candidaturas nuevas").
        expect(it.contarLabel!(3), `El contarLabel de "${it.label}" repite el número; deja solo lo que cuenta.`).not.toMatch(/\d/)
        expect(it.contarLabel!(1), `El contarLabel de "${it.label}" no distingue singular de plural.`).not.toBe(it.contarLabel!(2))
      }
    }
  })

  it('las rutas son relativas a la base y los ids no chocan', () => {
    // Las rutas se concatenan a `/app` o `/demo`: una sin barra inicial se
    // pegaría al base y llevaría a ninguna parte.
    const vistos = new Set<string>()
    for (const it of items(ctx({ isStaff: true }))) {
      expect(it.to.startsWith('/'), `La ruta de "${it.label}" tiene que empezar por "/": es relativa a /app o /demo.`).toBe(true)
      expect(vistos.has(it.id), `El id "${it.id}" está declarado dos veces.`).toBe(false)
      vistos.add(it.id)
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

  it('Meridian sigue la llave de su flag, no la del plan', () => {
    // Mientras el hilo esté fuera no hay entrada, tenga el plan lo que tenga.
    expect(ids(ctx({ plan: 'proceso' })).includes('meridian')).toBe(MERIDIAN_CHAT_ENABLED)
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

describe('Ajustes no vuelve al lateral', () => {
  it('no hay ninguna entrada a /ajustes en el menú', () => {
    // Vive en el engranaje de la barra superior, a todos los anchos. Estuvo
    // duplicado aquí y encima colgando del plan del vecino: si vuelve, que sea
    // una decisión y no un descuido, y entonces quítese de la barra.
    for (const plan of ['trial', 'esencial', 'pro', 'multi']) {
      expect(items(ctx({ plan, isStaff: true })).map((i) => i.to)).not.toContain('/ajustes')
    }
  })
})

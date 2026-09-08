import { describe, expect, it } from 'vitest'
import { acabarPrueba, finDePrueba as finServidor, MARGEN_PRUEBA_MS } from '../../supabase/functions/_shared/prueba'
import { finDePrueba as finCliente, MARGEN_PRUEBA_MS as MARGEN_CLIENTE } from './pricing'

/**
 * EL GUARDIÁN DE LOS DÍAS DE PRUEBA AL PAGAR.
 *
 * Hasta sep 2026, activar el pago durante la prueba creaba la suscripción sin
 * `trial_end`: se cobraba el mes entero ese mismo día, así que quien pagaba el
 * día 3 de 15 tiraba doce días gratis. Nadie se lo decía, y el incentivo iba al
 * revés del modelo: durante la prueba no hay muro, así que quien paga antes es
 * quien más valor está viendo, y era a quien se le cobraba por adelantarse.
 *
 * Lo que estas pruebas vigilan son las DOS formas de romperlo, y las dos son
 * silenciosas: que el checkout deje de posponer (y volvamos a cobrar de más sin
 * que se note, porque la factura sale bien y nadie reclama) y que la prueba se
 * extienda a MÁS DE UN PROCESO (el trial de Stripe es de la suscripción entera,
 * no de una unidad, así que con la cantidad a dos los dos saldrían gratis hasta
 * el día 15: exactamente el agujero que cerró "la prueba es el primer puesto, y
 * solo ese", que Mario tuvo que arreglar en sep 2026 después de probarlo él).
 */

const CHECKOUT = import.meta.glob('../../supabase/functions/stripe-checkout/index.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/**
 * El fuente SIN COMENTARIOS. Escrito sin esto, el detector de abajo pasaba en
 * verde con el `trial_end` COMENTADO, porque este fichero lleva su explicación
 * al lado y el detector estaba leyendo la prosa. Un guardián que no ve el fallo
 * que vino a vigilar es peor que ninguno, porque da permiso. El `[^:]` protege
 * a los `https://` de que se los coma el recorte de línea.
 */
const sinComentarios = (texto: string): string => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const fuenteCheckout = sinComentarios(Object.values(CHECKOUT)[0])

const AHORA = Date.parse('2026-09-08T10:00:00.000Z')
const enHoras = (h: number) => new Date(AHORA + h * 3600_000).toISOString()

describe('finDePrueba', () => {
  it('pospone el primer cobro al fin de la prueba', () => {
    expect(finServidor('trial', enHoras(24 * 12), 1, AHORA)).toBe(
      Math.floor(Date.parse(enHoras(24 * 12)) / 1000),
    )
  })

  it('NO pospone si el pago cubre más de un proceso: la prueba es el primer puesto y solo ese', () => {
    // Con dos, el trial de Stripe dejaría gratis también al segundo hasta el
    // día 15, que es el agujero que esta regla cierra.
    expect(finServidor('trial', enHoras(24 * 12), 2, AHORA)).toBeNull()
    expect(finServidor('trial', enHoras(24 * 12), 7, AHORA)).toBeNull()
  })

  it('respeta el mínimo de Stripe: por debajo del margen se cobra al momento', () => {
    // "trial_end [...] Has to be at least 48 hours in the future". Se pide una
    // hora más de margen, porque entre calcularlo y llegar a Stripe pasa tiempo
    // y un rechazo aquí dejaría al cliente sin poder pagar.
    expect(MARGEN_PRUEBA_MS).toBeGreaterThanOrEqual(48 * 3600_000)
    expect(finServidor('trial', enHoras(47), 1, AHORA)).toBeNull()
    expect(finServidor('trial', enHoras(48.5), 1, AHORA)).toBeNull()
    expect(finServidor('trial', enHoras(50), 1, AHORA)).not.toBeNull()
  })

  it('no pospone sin prueba que respetar', () => {
    expect(finServidor('proceso', enHoras(24 * 12), 1, AHORA)).toBeNull() // ya paga
    expect(finServidor('pro', enHoras(24 * 12), 1, AHORA)).toBeNull() // tier antiguo
    expect(finServidor('trial', null, 1, AHORA)).toBeNull() // el reloj no ha arrancado
    expect(finServidor('trial', 'ayer por la tarde', 1, AHORA)).toBeNull() // ilegible
    expect(finServidor('trial', enHoras(-24), 1, AHORA)).toBeNull() // agotada
  })
})

describe('acabarPrueba', () => {
  it('solo termina la prueba cuando se abre un proceso MÁS', () => {
    expect(acabarPrueba('trialing', 2)).toBe(true)
    expect(acabarPrueba('trialing', 1)).toBe(false) // reabrir lo que ya cubría
    expect(acabarPrueba('active', 2)).toBe(false) // ya paga: no hay prueba
    expect(acabarPrueba('past_due', 2)).toBe(false)
    expect(acabarPrueba(null, 2)).toBe(false)
  })
})

describe('el cliente y el servidor dicen lo mismo', () => {
  it('la misma fecha de primer cobro en los mismos casos', () => {
    // La frase de Facturación ("hoy no se te cobra nada, el primer cobro es el
    // X") sale del espejo del cliente y el cobro lo hace el servidor: si se
    // separan, la pantalla promete una fecha y Stripe cobra otra.
    const casos: [string, string | null, number][] = [
      ['trial', enHoras(24 * 12), 1],
      ['trial', enHoras(24 * 12), 2],
      ['trial', enHoras(47), 1],
      ['trial', enHoras(50), 1],
      ['trial', null, 1],
      ['trial', enHoras(-24), 1],
      ['proceso', enHoras(24 * 12), 1],
    ]
    for (const [plan, fin, procesos] of casos) {
      const servidor = finServidor(plan, fin, procesos, AHORA)
      const cliente = finCliente(plan, fin, procesos, AHORA)
      expect(cliente === null ? null : Math.floor(cliente.getTime() / 1000)).toBe(servidor)
    }
  })

  it('el mismo margen', () => {
    expect(MARGEN_CLIENTE).toBe(MARGEN_PRUEBA_MS)
  })
})

describe('el checkout sigue posponiendo', () => {
  it('la sesión de Checkout pasa el trial_end', () => {
    // Quitarlo no rompe nada visible: la suscripción se crea igual y la factura
    // sale bien. Lo único que pasa es que el cliente vuelve a pagar de más por
    // adelantarse, y eso no lo reclama nadie.
    expect(fuenteCheckout).toMatch(/const trialEnd = finDePrueba\(/)
    expect(fuenteCheckout).toMatch(/trial_end: trialEnd/)
  })

  it('abrir un proceso más acaba la prueba, y su previsualización lo dice', () => {
    // Las dos mitades: si solo se acabara la prueba al cobrar, el diálogo
    // enseñaría "no te cobra nada" y el cargo llegaría un segundo después.
    const veces = fuenteCheckout.match(/acabarPrueba\(/g) ?? []
    expect(veces.length).toBeGreaterThanOrEqual(3) // preview, addProcess y la adopción
    expect(fuenteCheckout).toMatch(/trial_end: 'now'/)
  })
})

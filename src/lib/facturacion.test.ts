// Guardián de FACTURACIÓN: la pantalla no puede ofrecer una acción que el
// servidor no pueda ejecutar.
//
// Lo escribe un fallo de producción (sep 2026): una empresa con `plan = 'pro'`
// puesto a mano, SIN cliente ni suscripción en Stripe, abría Facturación y solo
// veía "Gestionar pago y facturas" y "Cancelar suscripción". Los dos botones
// llaman a `stripe-checkout`, que responde 400 porque no hay nada que gestionar
// ni que cancelar, así que el cliente no tenía NINGUNA forma de empezar a
// pagar: los dos únicos botones de la pantalla daban error.
//
// La causa de fondo es una sola: se decidía por el NOMBRE DEL PLAN cuando lo
// que manda es el ESTADO DE LA SUSCRIPCIÓN. Este guardián fija esa frontera.
import { describe, expect, it } from 'vitest'
import { hayPagoActivo } from './pricing'

// Se lee la fuente como el resto de guardianes de la casa (import.meta.glob con
// ?raw), no con `node:fs`: aquí no hay tipos de Node y esto ya funciona.
import PLAN_FUENTE from '../screens/Plan.tsx?raw'

describe('hayPagoActivo', () => {
  it('un plan antiguo puesto a mano NO tiene pago activo (el caso de producción)', () => {
    // Es exactamente la fila que rompió: plan legacy, cero Stripe detrás.
    expect(hayPagoActivo({ subscription_status: null })).toBe(false)
  })

  it('cobrando de verdad = pago activo, y past_due cuenta', () => {
    // 'past_due' es viva a propósito: los reintentos siguen en curso y hay un
    // método de pago detrás, así que el portal de Stripe sí tiene qué enseñar.
    for (const estado of ['active', 'trialing', 'past_due']) {
      expect(hayPagoActivo({ subscription_status: estado })).toBe(true)
    }
  })

  it('una suscripción muerta no es pago activo', () => {
    for (const estado of ['canceled', 'unpaid', 'incomplete_expired', 'incomplete', '']) {
      expect(hayPagoActivo({ subscription_status: estado })).toBe(false)
    }
  })

  it('sin empresa todavía no hay pago', () => {
    expect(hayPagoActivo(null)).toBe(false)
    expect(hayPagoActivo(undefined)).toBe(false)
    expect(hayPagoActivo({})).toBe(false)
  })
})

describe('la pantalla de Facturación', () => {
  const fuente = PLAN_FUENTE

  it('siempre deja una salida para activar el pago: el alta no cuelga solo de la prueba', () => {
    // `ActivarPago` se monta en la prueba Y en un plan antiguo sin suscripción.
    // Si vuelve a quedar en un solo sitio, el plan huérfano se queda otra vez
    // sin ninguna puerta y esto falla.
    const veces = fuente.match(/<ActivarPago\b/g)?.length ?? 0
    expect(
      veces,
      'El alta del pago tiene que ofrecerse también cuando un plan antiguo se ha quedado sin suscripción detrás: si no, esa empresa no puede pagar.',
    ).toBeGreaterThanOrEqual(2)
  })

  it('las acciones legacy van detrás de una suscripción viva', () => {
    // Cancelar y reanudar solo existen si hay algo que cancelar. La comprobación
    // mira que el bloque legacy se parta por `conPago`, que es lo único que
    // distingue un plan pagado de uno puesto a mano.
    expect(fuente).toMatch(/\{!conPago \?/)
    expect(fuente).toContain('const conPago = hayPagoActivo(company)')
    expect(
      fuente,
      'El estado de pago no se deduce del nombre del plan: se pregunta a hayPagoActivo.',
    ).not.toMatch(/\['active', 'trialing', 'past_due'\]/)
  })

  it('un fallo del servidor se lee en pantalla, no en los registros', () => {
    // Sin esto, "ya tienes una suscripción de un plan anterior" se leía como un
    // "inténtalo de nuevo" y había que ir a la base de datos para saber qué pasaba.
    for (const generico of [
      'No se pudo abrir el pago',
      'No se pudo abrir el portal de facturación',
      'No se pudo cancelar',
      'No se pudo reanudar',
    ]) {
      const i = fuente.indexOf(generico)
      expect(i, `Falta el aviso: ${generico}`).toBeGreaterThan(-1)
      expect(
        fuente.slice(Math.max(0, i - 120), i),
        `"${generico}" tiene que caer solo cuando el servidor no da motivo (await motivo(error) ??).`,
      ).toContain('await motivo(error) ??')
    }
  })
})

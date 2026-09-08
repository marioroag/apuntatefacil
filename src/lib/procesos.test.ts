// Guardián de la PUERTA DE UN PROCESO NUEVO (revisión del circuito de pago,
// sep 2026). Dos puertas preguntan lo mismo (Crear puesto y Duplicar) y la
// respuesta vive en `modoProceso`; y la prueba cuenta lo ABIERTO (no cerrado),
// igual que el pago, porque pausar no libera hueco y al activar el pago se
// cobran también los pausados. Escrita en dos sitios con dos reglas, la
// pantalla decía "3 de 1".
import { describe, expect, it } from 'vitest'
import { modoProceso, pendienteDePago } from './pricing'

const abierto = { status: 'activa' as const }
const pausado = { status: 'pausada' as const }
const cerrado = { status: 'cerrada' as const }

describe('modoProceso', () => {
  it('en la prueba, un pausado ocupa el hueco igual que uno en línea', () => {
    const prueba = { id: 'c', plan: 'trial', paid_processes: 0 }
    expect(modoProceso(prueba, [])).toBe('libre')
    expect(modoProceso(prueba, [cerrado])).toBe('libre')
    expect(modoProceso(prueba, [abierto])).toBe('checkout')
    expect(modoProceso(prueba, [pausado])).toBe('checkout')
  })

  it('pagando: hueco libre, cobrar uno más, o checkout si la suscripción no está viva', () => {
    const conHueco = { id: 'c', plan: 'proceso', paid_processes: 2, subscription_status: 'active' }
    expect(modoProceso(conHueco, [abierto])).toBe('libre')
    expect(modoProceso(conHueco, [abierto, pausado])).toBe('cobrar')
    // Un impago agotado no es una suscripción viva: alta nueva, no cobro.
    expect(modoProceso({ ...conHueco, subscription_status: 'unpaid' }, [abierto, pausado])).toBe('checkout')
    expect(modoProceso({ ...conHueco, subscription_status: 'canceled', paid_processes: 0 }, [])).toBe('checkout')
  })

  it('los tiers antiguos conservan su muro por puestos ACTIVOS', () => {
    const pro = { id: 'c', plan: 'pro', paid_processes: 0, subscription_status: 'active' }
    expect(modoProceso(pro, Array(10).fill(abierto))).toBe('bloqueado')
    expect(modoProceso(pro, [...Array(9).fill(abierto), pausado])).toBe('libre')
  })

  it('la demo nunca cobra', () => {
    expect(modoProceso({ id: 'demo', plan: 'proceso', paid_processes: 0 }, [abierto, abierto])).toBe('libre')
  })
})

describe('pendienteDePago', () => {
  it('un cerrado sin fecha de cierre nunca llegó a abrirse', () => {
    expect(pendienteDePago({ status: 'cerrada', closedAt: null })).toBe(true)
    expect(pendienteDePago({ status: 'cerrada', closedAt: '2026-09-01T00:00:00Z' })).toBe(false)
    expect(pendienteDePago({ status: 'activa', closedAt: null })).toBe(false)
  })
})

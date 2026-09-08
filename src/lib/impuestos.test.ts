// Guardián de los IMPUESTOS del pago por proceso (sep 2026). Somos una empresa
// canaria: a un cliente canario se le cobra IGIC, a uno peninsular no se le
// cobra IVA (inversión del sujeto pasivo) y a uno de Ceuta o Melilla tampoco.
// Lo que vigila: que el código postal se lea bien (35 y 38 son Canarias, 51 y
// 52 Ceuta y Melilla), que cada región tenga su tipo con la mención correcta,
// que el tipo se busque por metadata y no se cree dos veces, y que el
// vocabulario del cliente sea el mismo que el del servidor.
import { describe, expect, it } from 'vitest'
import { REGIONES, TIPO_POR_REGION, regionDePostal, tipoImpositivo } from '../../supabase/functions/_shared/impuestos'
import { REGIONES_FISCALES } from './pricing'

describe('regionDePostal', () => {
  it('Canarias son 35 y 38; Ceuta y Melilla, 51 y 52; el resto, Península y Baleares', () => {
    expect(regionDePostal('38300')).toBe('canarias')
    expect(regionDePostal('35001')).toBe('canarias')
    expect(regionDePostal('51001')).toBe('ceuta_melilla')
    expect(regionDePostal('52001')).toBe('ceuta_melilla')
    expect(regionDePostal('28001')).toBe('peninsula')
    expect(regionDePostal('07001')).toBe('peninsula') // Baleares: territorio del IVA
    expect(regionDePostal(' 46 001 ')).toBe('peninsula')
  })
  it('lo que no es un código postal español no dice nada', () => {
    expect(regionDePostal('')).toBeNull()
    expect(regionDePostal(null)).toBeNull()
    expect(regionDePostal('1234')).toBeNull()
    expect(regionDePostal('75008')).toBeNull() // París
    expect(regionDePostal('SW1A 1AA')).toBeNull()
  })
})

describe('los tipos por región', () => {
  it('Canarias lleva IGIC al 7 y las otras dos van al 0 con su mención impresa', () => {
    expect(TIPO_POR_REGION.canarias).toMatchObject({ display_name: 'IGIC', percentage: 7 })
    expect(TIPO_POR_REGION.peninsula.percentage).toBe(0)
    expect(TIPO_POR_REGION.peninsula.description).toMatch(/inversión del sujeto pasivo/i)
    expect(TIPO_POR_REGION.peninsula.description).toMatch(/84\.Uno\.2º/)
    expect(TIPO_POR_REGION.ceuta_melilla.percentage).toBe(0)
  })

  it('el cliente y el servidor manejan las mismas regiones', () => {
    expect([...REGIONES].sort()).toEqual(REGIONES_FISCALES.map((r) => r.value).sort())
  })

  it('el tipo se reconoce por metadata y no se crea dos veces', async () => {
    const creados: unknown[] = []
    const existentes: { id: string; metadata: Record<string, string>; percentage: number }[] = [
      { id: 'txr_viejo', metadata: { af_region: 'canarias' }, percentage: 7 },
      // Un tipo de Canarias con OTRO porcentaje (alguien lo cambió en el panel) no vale.
      { id: 'txr_raro', metadata: { af_region: 'peninsula' }, percentage: 21 },
    ]
    const stripe = {
      taxRates: {
        list: async () => ({ data: existentes }),
        create: async (p: unknown) => { creados.push(p); return { id: 'txr_nuevo' } },
      },
    }
    expect(await tipoImpositivo(stripe, 'canarias')).toBe('txr_viejo')
    expect(creados).toHaveLength(0)
    expect(await tipoImpositivo(stripe, 'peninsula')).toBe('txr_nuevo')
    expect(creados).toHaveLength(1)
    expect(creados[0]).toMatchObject({ percentage: 0, inclusive: false, metadata: { af_region: 'peninsula' } })
  })
})

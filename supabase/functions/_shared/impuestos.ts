// ============================================================================
// IMPUESTOS DEL PAGO POR PROCESO: la empresa es CANARIA (sep 2026).
//
// Canarias está fuera del territorio del IVA, así que Stripe Tax (que con un
// registro en España cobraría el 21 % a todo el mundo) no sirve. La regla,
// para un servicio por internet vendido a EMPRESAS:
//
//   - cliente en Canarias:            IGIC 7 % (lo cobramos y declaramos).
//   - cliente en Península/Baleares:  sin IVA en la factura, con la mención de
//                                     "inversión del sujeto pasivo" (art.
//                                     84.Uno.2º Ley 37/1992): el IVA lo declara
//                                     el cliente. No sujeto a IGIC (se localiza
//                                     fuera de Canarias).
//   - cliente en Ceuta o Melilla:     sin IVA (territorio con IPSI).
//
// Se aplica con TIPOS FIJOS de Stripe (tax rates), uno por región, que se
// crean la primera vez que hacen falta y se reconocen por su metadata. Un tipo
// del 0 % con descripción es lo que imprime la mención en la factura.
//
// La región la dice el cliente al dar de alta el pago (companies.region_fiscal)
// y el webhook la contrasta con el código postal que Stripe recoge en la página
// de pago: Canarias es 35xxx y 38xxx, Ceuta 51xxx, Melilla 52xxx.
//
// Este módulo es puro salvo por el cliente de Stripe que se le pasa: lo prueba
// vitest (src/lib/impuestos.test.ts) sin Deno.
// ============================================================================

export type RegionFiscal = 'canarias' | 'peninsula' | 'ceuta_melilla'
export const REGIONES: readonly RegionFiscal[] = ['canarias', 'peninsula', 'ceuta_melilla']

export const esRegion = (v: unknown): v is RegionFiscal =>
  typeof v === 'string' && (REGIONES as readonly string[]).includes(v)

/** La región que dice un código postal español, o null si no se puede saber. */
export function regionDePostal(cp: string | null | undefined): RegionFiscal | null {
  const d = (cp ?? '').replace(/\s+/g, '')
  if (!/^\d{5}$/.test(d)) return null
  const p = d.slice(0, 2)
  if (p === '35' || p === '38') return 'canarias'
  if (p === '51' || p === '52') return 'ceuta_melilla'
  const n = Number(p)
  return n >= 1 && n <= 52 ? 'peninsula' : null
}

/** Cómo se define cada tipo en Stripe. `description` es lo que sale impreso. */
export const TIPO_POR_REGION: Record<RegionFiscal, {
  display_name: string
  percentage: number
  jurisdiction: string
  description: string
}> = {
  canarias: {
    display_name: 'IGIC',
    percentage: 7,
    jurisdiction: 'ES-CN',
    description: 'IGIC 7 % (Canarias)',
  },
  peninsula: {
    display_name: 'IVA',
    percentage: 0,
    jurisdiction: 'ES',
    description: 'Inversión del sujeto pasivo, art. 84.Uno.2º Ley 37/1992: el IVA lo declara el destinatario',
  },
  ceuta_melilla: {
    display_name: 'IVA',
    percentage: 0,
    jurisdiction: 'ES',
    description: 'Operación no sujeta a IVA (Ceuta y Melilla)',
  },
}

/** Lo mínimo del cliente de Stripe que hace falta aquí, para poder probarlo
 *  con un doble sin cargar el paquete. */
export interface StripeTiposImpositivos {
  taxRates: {
    list(params: { active: boolean; limit: number }): Promise<{ data: { id: string; metadata?: Record<string, string> | null; percentage: number }[] }>
    create(params: {
      display_name: string
      percentage: number
      inclusive: boolean
      jurisdiction: string
      description: string
      metadata: Record<string, string>
    }): Promise<{ id: string }>
  }
}

/** El id del tipo impositivo de una región, creándolo si no existe. Se busca
 *  por metadata y no por nombre: el nombre lo puede tocar alguien en el panel. */
export async function tipoImpositivo(stripe: StripeTiposImpositivos, region: RegionFiscal): Promise<string> {
  const def = TIPO_POR_REGION[region]
  const { data } = await stripe.taxRates.list({ active: true, limit: 100 })
  const existente = data.find((t) => t.metadata?.af_region === region && Number(t.percentage) === def.percentage)
  if (existente) return existente.id
  const creado = await stripe.taxRates.create({
    ...def,
    inclusive: false,
    metadata: { af_region: region, app: 'apuntatefacil' },
  })
  return creado.id
}

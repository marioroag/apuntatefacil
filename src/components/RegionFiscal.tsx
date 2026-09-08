import { REGIONES_FISCALES, type RegionFiscal } from '../lib/pricing'

/**
 * La pregunta que decide el impuesto de la factura, hecha UNA vez, justo antes
 * de salir a pagar. Somos una empresa canaria: a un cliente canario se le cobra
 * IGIC, a uno peninsular no se le cobra IVA (lo declara él, inversión del
 * sujeto pasivo). Sin esto la primera factura, que se cobra en la propia
 * página de Stripe, saldría mal. Se pinta en los cuatro sitios desde los que se
 * sale a pagar (Facturación, reabrir, crear y duplicar) y por eso es una pieza.
 * Con la región ya dicha (companies.region_fiscal) no se pinta: quien la monta
 * lo decide.
 */
export function RegionFiscalRadio({ value, onChange, falta = false }: {
  value: RegionFiscal | null
  onChange: (v: RegionFiscal) => void
  /** Se intentó seguir sin contestar: el aviso se enciende y se queda hasta que
   *  se elige. Nunca se enciende solo, como el resto de avisos del anuncio. */
  falta?: boolean
}) {
  return (
    <fieldset className="mt-4" aria-invalid={falta || undefined} aria-describedby={falta ? 'falta-region' : undefined} data-region-fiscal>
      <legend className="text-sm font-medium text-slate-900">¿Dónde tiene tu empresa su domicilio fiscal?</legend>
      <p className="mt-0.5 text-[13px] text-slate-500">Decide el impuesto de tu factura. Se pregunta una sola vez.</p>
      {falta && <p id="falta-region" className="mt-1 text-[12px] text-red-600">Elige dónde está tu empresa para preparar la factura.</p>}
      <div className="mt-2 grid gap-1.5">
        {REGIONES_FISCALES.map((r) => (
          <label key={r.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 ring-1 ring-inset ${value === r.value ? 'bg-indigo-50 ring-indigo-300' : 'ring-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="region-fiscal"
              value={r.value}
              checked={value === r.value}
              onChange={() => onChange(r.value)}
              className="mt-1 size-3.5 accent-indigo-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{r.label}</span>
              <span className="block text-[12px] text-slate-500">{r.impuesto.charAt(0).toUpperCase() + r.impuesto.slice(1)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

import { PRECIO_PROCESO } from '../lib/pricing'

// El precio del pago por proceso, con el número protagonista y el símbolo €
// pequeño y arriba (cuanto más discreta la moneda, menos "dolor de pago").
// Los impuestos se dicen al lado, siempre (la LSSI obliga a decir si el precio
// los incluye), pero desde sep 2026 como "impuestos no incluidos" y no "+ IVA":
// somos una empresa canaria y no cobramos IVA a nadie (IGIC a Canarias, nada
// con inversión del sujeto pasivo a la Península), así que prometer IVA era
// prometer una línea que no aparece en la factura. Va en pequeño y debajo,
// como "Sin permanencia". Un único componente para todas las superficies.
export function PrecioProceso({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <div className={`flex flex-wrap items-baseline ${compact ? 'gap-x-1.5' : 'gap-x-2'}`}>
        <span className={`flex items-start font-bold tracking-tight text-slate-900 ${compact ? 'text-3xl' : 'text-5xl'}`}>
          <span className="num">{PRECIO_PROCESO}</span>
          <span className={`font-semibold text-slate-600 ${compact ? 'ml-0.5 mt-0.5 text-base' : 'ml-1 mt-1.5 text-xl'}`}>€</span>
        </span>
        <span className={`text-slate-500 ${compact ? 'text-sm' : 'text-lg'}`}>al mes, por proceso abierto</span>
      </div>
      <p className={`text-slate-500 ${compact ? 'mt-0.5 text-[12px]' : 'mt-1 text-sm'}`}>Impuestos no incluidos.</p>
    </div>
  )
}

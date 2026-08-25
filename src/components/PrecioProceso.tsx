import { PRECIO_PROCESO } from '../lib/pricing'

// El precio del pago por proceso, con el número protagonista y el símbolo €
// pequeño y arriba (cuanto más discreta la moneda, menos "dolor de pago").
// El IVA se dice al lado, siempre: somos B2B y el precio se comunica "+ IVA"
// (doctrina del modelo, ago 2026). Un único componente para que el precio se
// presente igual en todas las superficies.
export function PrecioProceso({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline ${compact ? 'gap-x-1.5' : 'gap-x-2'}`}>
      <span className={`flex items-start font-bold tracking-tight text-slate-900 ${compact ? 'text-3xl' : 'text-5xl'}`}>
        <span className="num">{PRECIO_PROCESO}</span>
        <span className={`font-semibold text-slate-600 ${compact ? 'ml-0.5 mt-0.5 text-base' : 'ml-1 mt-1.5 text-xl'}`}>€</span>
      </span>
      <span className={`text-slate-500 ${compact ? 'text-sm' : 'text-lg'}`}>al mes + IVA, por proceso abierto</span>
    </div>
  )
}

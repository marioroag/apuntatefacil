import { annualPerMonth, annualSavings, fmtEs, type Tier } from '../lib/pricing'

// Precio con el número protagonista y el símbolo € pequeño y arriba (cuanto más
// discreta la moneda, menos "dolor de pago"). En anual: mensual tachado al lado,
// equivalente mensual grande y, debajo, el total facturado + ahorro en euros
// (la rebaja se ve, no se calcula; en euros y no en %, que el importe supera 100 €).
// Lo usan la landing y /app/plan: un único componente para que el precio se
// presente igual en las dos superficies.
export function TierPrice({ tier: t, annual, compact = false }: { tier: Tier; annual: boolean; compact?: boolean }) {
  return (
    <>
      <div className={`flex flex-wrap items-baseline ${compact ? 'mt-4 gap-x-1.5' : 'mt-5 gap-x-2'}`}>
        {annual && (
          <s className={`font-medium text-slate-500 num ${compact ? 'text-base' : 'text-lg'}`}>
            <span className="sr-only">Antes </span>
            {t.monthly} €
          </s>
        )}
        <span className={`flex items-start font-bold tracking-tight text-slate-900 ${compact ? 'text-3xl' : 'text-4xl'}`}>
          <span className="num">{annual ? annualPerMonth(t) : t.monthly}</span>
          <span className={`font-semibold text-slate-600 ${compact ? 'ml-0.5 mt-0.5 text-base' : 'ml-1 mt-1 text-lg'}`}>€</span>
        </span>
        <span className={`text-slate-500 ${compact ? 'text-sm' : ''}`}>al mes</span>
      </div>
      {annual ? (
        <p className={`mt-1 text-slate-500 num ${compact ? 'text-[13px]' : 'text-label'}`}>
          Pagas {fmtEs(t.annual)} € una vez al año.{' '}
          <span className="font-semibold text-slate-700">Ahorras {fmtEs(annualSavings(t))} €.</span>
        </p>
      ) : (
        <p className={`mt-1 text-slate-500 ${compact ? 'text-[13px]' : 'text-label'}`}>Sin permanencia</p>
      )}
    </>
  )
}

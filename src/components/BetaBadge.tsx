// Etiqueta "Beta" que señala el estado del producto. Es ESTADO, no acción, así que
// va en slate (la doctrina reserva el ultramarine para acción/foco/selección).
// Tamaño único, reutilizada junto al wordmark (app y landing) y en el footer.
export function BetaBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 ring-1 ring-inset ring-slate-200 ${className}`}
    >
      Beta
    </span>
  )
}

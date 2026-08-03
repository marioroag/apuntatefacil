import { forwardRef, useEffect, useImperativeHandle, useRef, type ComponentPropsWithoutRef } from 'react'
import { Check, Minus } from 'lucide-react'

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'> & {
  /** Estado indeterminado: p. ej. "seleccionar todos" con selección parcial. */
  indeterminate?: boolean
}

// Checkbox de marca. El checkbox nativo del navegador se veía genérico y fuera de marca
// (sin @tailwindcss/forms, las clases no lo estilaban). Esto es un input real (accesible,
// foco visible por teclado) con caja propia: borde nítido en reposo y relleno ULTRAMARINE
// al marcar (el acento se reserva a la selección). El `className` va a la envoltura, para
// alinear (p. ej. mt-0.5 junto a etiquetas de varias líneas). `className` se aplica a la
// envoltura para posicionar/alinear; el tamaño de la caja es fijo (16px) para ser consistente.
export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { className, indeterminate = false, ...props },
  ref,
) {
  const innerRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)
  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <span className={`relative inline-flex shrink-0 ${className ?? ''}`}>
      <input
        ref={innerRef}
        type="checkbox"
        className="peer size-4 cursor-pointer appearance-none rounded-[5px] border border-slate-300 bg-white transition-colors hover:border-slate-400 checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        {...props}
      />
      {/* Tilde (marcado) y guion (indeterminado): blancos y nítidos sobre el relleno acento.
          Aparecen con un fundido corto y sobrio (transform/opacity), respetando reduced-motion.
          Trazo GRUESO a propósito y con `[stroke-width:]`, no con la prop `strokeWidth`: son
          12px sobre relleno sólido y al trazo del sistema se ven anémicos. La prop de lucide
          ya no pinta, la pisa la regla `.lucide` de index.css; la propiedad arbitraria sí. */}
      <Check
        className="pointer-events-none absolute inset-0 m-auto size-3 scale-90 text-white opacity-0 transition-[opacity,transform] duration-[var(--duration-control)] [stroke-width:3.5] peer-checked:scale-100 peer-checked:opacity-100 peer-indeterminate:opacity-0 motion-reduce:transition-none"
        aria-hidden
      />
      <Minus
        className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 transition-opacity duration-[var(--duration-control)] [stroke-width:3.5] peer-indeterminate:opacity-100 motion-reduce:transition-none"
        aria-hidden
      />
    </span>
  )
})

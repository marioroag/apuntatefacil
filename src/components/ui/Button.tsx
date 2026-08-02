import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Botón "instrumento de precisión" (mismo lenguaje que BTN_PRIMARY/BTN_SECONDARY
// en lib/buttons.ts): primario ULTRAMARINE sólido con filo de luz superior y
// anillo interno oscuro a 1px; secundario/peligro claros con hairline y sombra
// mínima. Ghost sigue plano (texto). Radio 8px (rounded-lg).
const base =
  'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold ' +
  'transition-[background-color,box-shadow,transform,color] duration-150 ease-[var(--ease-out)] ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white ring-1 ring-inset ring-indigo-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(18,22,34,0.24)] hover:bg-indigo-700 active:shadow-[inset_0_1px_2px_rgba(15,20,60,0.35)]',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-300/80 shadow-[0_1px_2px_rgba(18,22,34,0.06)] hover:bg-slate-50 hover:ring-slate-300 active:shadow-none',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger:
    'bg-white text-red-600 ring-1 ring-inset ring-red-200 shadow-[0_1px_2px_rgba(18,22,34,0.06)] hover:bg-red-50 active:shadow-none',
}

// Alturas alineadas con BTN_PRIMARY/SECONDARY de lib/buttons.ts (una sola escala):
// md = 36px (h-9), el alto por defecto del sistema. sm 32px, lg 44px.
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  loadingLabel?: string
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, loadingLabel, icon, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  )
})

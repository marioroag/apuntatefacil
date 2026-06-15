import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Estilo "con relieve" tipo Shopify (mismo lenguaje que BTN_PRIMARY/BTN_SECONDARY
// en lib/buttons.ts): primario índigo con degradado, brillo superior y sombra;
// secundario/peligro claros con borde y sombra suave. Ghost sigue plano (texto).
const base =
  'relative inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold ' +
  'transition duration-[120ms] ease-[var(--ease-standard)] ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-indigo-600 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white ring-1 ring-inset ring-indigo-700/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(30,27,75,0.35)] hover:to-indigo-700 active:shadow-[inset_0_1px_3px_rgba(30,27,75,0.4)]',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-300/70 shadow-[0_1px_2px_rgba(16,24,40,0.07)] hover:bg-slate-50 active:shadow-none',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger:
    'bg-white text-red-600 ring-1 ring-red-200 shadow-[0_1px_2px_rgba(16,24,40,0.07)] hover:bg-red-50 active:shadow-none',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
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

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { botonClase, type BtnSize, type BtnVariant } from '../../lib/buttons'

type Variant = BtnVariant
type Size = BtnSize

// Este componente NO define el botón: lo define `src/lib/buttons.ts` y aquí solo
// se le añade lo que un <button> real necesita y una constante de clase no puede
// llevar (estado deshabilitado y de carga). Hasta ago 2026 redeclaraba la pintura
// entera con las cadenas copiadas a mano, y ahí fue donde se colaron una sombra
// con otra opacidad y una escala de alturas distinta (`lg` era h-11 aquí y h-12
// en las constantes). Si necesitas tocar el aspecto, se toca allí.
const ESTADOS = 'relative disabled:pointer-events-none disabled:opacity-50'

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return botonClase(variant, size, `${ESTADOS} ${extra}`.trim())
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

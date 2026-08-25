// Marca "Apúntate Fácil": el monograma "A" bicolor oficial. Base en tinta grafito
// (#131822) + ápice ultramarine (ACENTO_MARCA). SVG en línea, transparente y con
// colores de marca FIJOS (no themeable: es el logo). El tamaño lo fija quien lo
// los colores de marca: el ápice sale de `ACENTO_MARCA`, y NO del acento
// configurable del cliente (`--accent`), que es otra cosa. El tamaño lo fija
// quien lo usa con `className` (size-6, size-7, ...).
//
// `tone` NO es un tema: son las DOS versiones de un mismo logo, la de fondo claro
// y la de fondo oscuro, que es lo que necesita cualquier marca que se ponga sobre
// una baldosa de tinta (aquí, la del lateral). La versión oscura conserva el
// bicolor, que es lo que hace reconocible la marca: la base pasa a blanco y el
// ápice sube a indigo-400, el peldaño de la rampa que sí se ve sobre #131822 (el
// 600 sobre tinta es azul sobre azul). No hay una tercera.
import { ACENTO_MARCA } from '../lib/colors'

const TONOS = {
  claro: { base: '#131822', apice: ACENTO_MARCA },
  oscuro: { base: '#ffffff', apice: '#6e8cf9' },
} as const

export function Logo({ className = 'size-7', tone = 'claro' }: { className?: string; tone?: keyof typeof TONOS }) {
  const { base, apice } = TONOS[tone]
  return (
    <svg
      viewBox="0 0 500 457.46"
      className={`${className} shrink-0`}
      role="img"
      aria-label="Apúntate Fácil"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={base}
        d="M448.72,337,347.79,351.25h-.09L172.16,375.84A59.87,59.87,0,0,0,125,413l-17.77,44.45H0l19.13-43.91,7.38-17.12v-.09a169,169,0,0,1,131.17-99.56l14.67-2,144.92-20.31,98.83-13.94Z"
      />
      <polygon fill={base} points="500 457.46 390.05 457.46 358.26 377.3 459.74 363 459.74 363.09 500 457.46" />
      <path
        fill={apice}
        d="M405,234.38l-50.3,7.1A61.49,61.49,0,0,1,289,203.39L249,103.3,205.78,211.15A123.69,123.69,0,0,1,108,287.76l-36.25,5.1L199.4,0H305.16Z"
      />
    </svg>
  )
}

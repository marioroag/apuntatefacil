// Marca "Apúntate Fácil": el monograma "A" bicolor oficial. Base en tinta grafito
// (#131822) + ápice ultramarine (#374cce). SVG en línea, transparente y con los
// colores de marca FIJOS (no themeable: es el logo). El tamaño lo fija quien lo
// usa con `className` (size-6, size-7, ...).
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 457.46"
      className={`${className} shrink-0`}
      role="img"
      aria-label="Apúntate Fácil"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#131822"
        d="M448.72,337,347.79,351.25h-.09L172.16,375.84A59.87,59.87,0,0,0,125,413l-17.77,44.45H0l19.13-43.91,7.38-17.12v-.09a169,169,0,0,1,131.17-99.56l14.67-2,144.92-20.31,98.83-13.94Z"
      />
      <polygon fill="#131822" points="500 457.46 390.05 457.46 358.26 377.3 459.74 363 459.74 363.09 500 457.46" />
      <path
        fill="#374cce"
        d="M405,234.38l-50.3,7.1A61.49,61.49,0,0,1,289,203.39L249,103.3,205.78,211.15A123.69,123.69,0,0,1,108,287.76l-36.25,5.1L199.4,0H305.16Z"
      />
    </svg>
  )
}

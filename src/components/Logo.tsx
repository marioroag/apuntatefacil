import brandMark from '../assets/brand-mark.png'

// Marca "Apúntate Fácil": el monograma "A" bicolor (índigo + tinta) del nuevo
// logo. El tamaño lo fija quien lo usa con `className` (size-6, size-8, ...).
export function Logo({ className = 'size-7' }: { className?: string }) {
  return <img src={brandMark} alt="Apúntate Fácil" className={`${className} shrink-0 object-contain`} />
}

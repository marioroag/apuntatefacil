// Marca "Apúntate Fácil": un check redondeado sobre tile índigo. Apuntarse, hecho, fácil.
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Apúntate Fácil" fill="none">
      <rect width="64" height="64" rx="15" fill="#4F46E5" />
      <path
        d="M18 33.5 27.5 43 46 22.5"
        stroke="white"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="22.5" r="3.6" fill="#A5B4FC" />
    </svg>
  )
}

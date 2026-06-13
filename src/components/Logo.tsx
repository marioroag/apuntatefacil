// Motivo de marca: una "criba"/embudo geométrico. Neutro, multisector.
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Criba" fill="none">
      <rect width="64" height="64" rx="15" fill="#4F46E5" />
      <path
        d="M16 20h32a2 2 0 0 1 1.6 3.2L37 39.5V49a2 2 0 0 1-3 1.7l-6-3.6a2 2 0 0 1-1-1.7v-5.9L14.4 23.2A2 2 0 0 1 16 20Z"
        fill="white"
      />
      <circle cx="44.5" cy="19.5" r="3.5" fill="#A5B4FC" />
    </svg>
  )
}

// Muestra un teléfono ocultando los 3 últimos dígitos. CLAVE de privacidad:
// esos dígitos NO se renderizan en el DOM (se quitan antes), así que no se pueden
// ver ni copiando ni inspeccionando. La cola son tres rectángulos borrosos, nunca
// cifras ficticias.
// Se usa SOLO en la demo pública y en el mockup de la landing, nunca con datos
// reales de un merchant (que sí necesita ver el teléfono completo de su candidato).

export function MaskedPhone({ value, className = '' }: { value: string; className?: string }) {
  // Quita el último grupo de 3 dígitos del string (no llega al DOM).
  const m = value.match(/^(.*?)(\d{3})(\D*)$/)
  const prefix = m ? m[1] : value
  return (
    <span className={`tnum whitespace-nowrap ${className}`}>
      {prefix}
      {m ? (
        <span aria-hidden className="phone-mask-rects">
          <span className="phone-mask-rect" />
          <span className="phone-mask-rect" />
          <span className="phone-mask-rect" />
        </span>
      ) : null}
      <span className="sr-only">(últimos dígitos ocultos por privacidad)</span>
    </span>
  )
}

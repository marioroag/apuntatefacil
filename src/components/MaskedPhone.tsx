// Muestra un teléfono ocultando los 3 últimos dígitos. CLAVE de privacidad:
// esos dígitos NO se renderizan en el DOM (se quitan antes), así que no se pueden
// ver ni copiando ni inspeccionando. En su lugar se pinta un placeholder borroso.
// Se usa SOLO en la demo pública y en el mockup de la landing, nunca con datos
// reales de un merchant (que sí necesita ver el teléfono completo de su candidato).

export function MaskedPhone({ value, className = '' }: { value: string; className?: string }) {
  // Quita el último grupo de 3 dígitos del string (no llega al DOM).
  const m = value.match(/^(.*?)(\d{3})(\D*)$/)
  const prefix = m ? m[1] : value
  return (
    <span className={`tnum whitespace-nowrap ${className}`}>
      {prefix}
      {/* Tres bloques borrosos: NO hay dígitos en el DOM, así que copiar o
          inspeccionar no revela ningún número. Visualmente parecen 3 cifras borrosas. */}
      <span aria-hidden className="ml-1 inline-flex select-none items-center gap-[2px] align-baseline blur-[2px]">
        <span className="inline-block h-[0.72em] w-[0.52em] rounded-[1.5px] bg-slate-300" />
        <span className="inline-block h-[0.72em] w-[0.52em] rounded-[1.5px] bg-slate-300" />
        <span className="inline-block h-[0.72em] w-[0.52em] rounded-[1.5px] bg-slate-300" />
      </span>
      <span className="sr-only">(últimos dígitos ocultos por privacidad)</span>
    </span>
  )
}

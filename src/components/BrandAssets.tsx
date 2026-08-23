import { useRef } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'

// Una de las dos imágenes. La caja entera es el botón de elegir archivo; su forma
// y su radio son los del formulario público, así que vacía o llena se lee lo que
// va a ser. La equis para quitarla NO se pinta a todas horas (estaba encima de la
// imagen tapando justo el logo que acabas de subir): aparece al pasar por encima
// o al recibir el foco, que es cuando puedes usarla.
export function AssetBox({
  label,
  empty,
  url,
  busy,
  className,
  onPick,
  onRemove,
}: {
  label: string
  /** Texto dentro de la caja vacía. Sin él solo va el icono (cajas pequeñas). */
  empty?: string
  url: string | null
  busy: boolean
  className: string
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={`group/asset relative shrink-0 overflow-hidden bg-slate-50 ${url ? 'filo' : 'border border-dashed border-slate-300'} ${className}`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={url ? `Cambiar ${label}` : `Subir ${label}`}
        // La caja pequeña (la foto) no lleva su nombre escrito dentro: el título lo
        // dice al pasar por encima, sin gastar la línea que necesita el nombre.
        title={url ? `Cambiar ${label}` : `Subir ${label}`}
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500 transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] hover:bg-white/45 hover:text-slate-600"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          !url && (
            <>
              <ImagePlus className="size-5" aria-hidden />
              {empty && <span className="text-[12px] font-medium">{empty}</span>}
            </>
          )
        )}
      </button>
      {url && !busy && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${label}`}
          // `group-hover` de Tailwind va dentro de `@media (hover: hover)`, así que en
          // táctil no se revelaría NUNCA y la imagen no habría forma de quitarla:
          // donde no hay puntero que pase por encima, se pinta siempre.
          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-slate-900/60 text-white opacity-0 transition-opacity duration-[var(--duration-control)] ease-[var(--ease-out)] hover:bg-slate-900/80 focus-visible:opacity-100 group-hover/asset:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

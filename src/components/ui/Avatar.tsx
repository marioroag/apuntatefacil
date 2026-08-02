import { useState } from 'react'
import { initials, memberAvatarTone } from '../../lib/format'

/**
 * La cara de una persona del equipo. Foto si la tiene; si no, sus iniciales
 * sobre un tono estable derivado de la semilla (email o id), para que la misma
 * persona tenga siempre el mismo color en la barra, en el chat y en la lista de
 * miembros. La paleta de tonos NUNCA usa el ultramarine de marca: ese color es
 * acción, no decoración.
 *
 * Una sola primitiva para toda la app: antes cada pantalla repintaba su círculo
 * con iniciales a mano y ninguna sabía de fotos.
 */
export function Avatar({
  name,
  seed,
  src,
  size = 28,
  className = '',
}: {
  /** Nombre ya resuelto (real o derivado del email). De aquí salen las iniciales. */
  name: string
  /** Semilla del color: el email o el id. Estable entre pantallas. */
  seed?: string | null
  src?: string | null
  size?: number
  className?: string
}) {
  // Una foto que no carga (borrada del bucket, red caída) cae a las iniciales en
  // vez de dejar el icono roto del navegador.
  const [failed, setFailed] = useState(false)
  const tone = memberAvatarTone(seed ?? name)
  const px = `${size}px`
  // El tamaño de letra sigue al del círculo; por debajo de 24px dos iniciales no
  // caben legibles, así que se reduce el peso visual, no la caja.
  const fontSize = Math.max(9, Math.round(size * 0.4))

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: px, height: px }}
        className={`shrink-0 rounded-full object-cover ring-1 ring-slate-900/10 ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ width: px, height: px, fontSize: `${fontSize}px` }}
      className={`grid shrink-0 place-items-center rounded-full font-bold leading-none ${tone.bg} ${tone.text} ${className}`}
    >
      {initials(name)}
    </span>
  )
}

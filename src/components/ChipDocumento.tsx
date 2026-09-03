import { Paperclip } from 'lucide-react'

/**
 * "Hay un documento" en una fila o en una tarjeta, en un solo sitio.
 *
 * Lo pintan la columna Documentos de la tabla y la línea del tablero, y por eso
 * no vive en ninguna de las dos: son la misma pieza y tienen que envejecer juntas.
 *
 * NO ES UN CONTROL, y eso es doctrina: dentro de una fila solo entra lo
 * imprescindible, y descargar el CV pide una URL firmada cuya lógica no puede
 * vivir en dos sitios. Se dice si LO HAY; para verlo se abre la ficha, que es lo
 * que hace la fila entera al pulsarla.
 *
 * Lleva la piel de un chip gris, la misma familia que una etiqueta: en una fila
 * de un solo cuerpo y una sola tinta, lo que va dentro de una cápsula gris es
 * "algo que acompaña al dato".
 */
export function ChipDocumento() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-etiqueta-fondo px-1.5 py-0.5 font-medium text-slate-700">
      <Paperclip className="size-3 shrink-0 text-slate-500" aria-hidden /> CV
    </span>
  )
}

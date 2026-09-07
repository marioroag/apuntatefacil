import { Paperclip } from 'lucide-react'

/**
 * "Hay un documento" en una fila o en una tarjeta, en un solo sitio.
 *
 * Lo pintan la columna Documentos de las DOS tablas (el panel de un puesto y
 * Candidatos) y la línea del tablero, y por eso no vive en ninguna de las tres:
 * son la misma pieza y tienen que envejecer juntas.
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


/**
 * LA CELDA ENTERA DE LA COLUMNA DOCUMENTOS, que es la pieza que de verdad se
 * repite (sep 2026, al estrenar la columna en Candidatos).
 *
 * Estaba escrita dentro del panel de un puesto, y la segunda tabla que la
 * necesitaba tenía que copiar cuatro cosas que no son el chip: que el chip ES el
 * botón, su nombre accesible, el hover que oscurece y, sobre todo, QUÉ SE PINTA
 * CUANDO NO HAY NADA. Ese vacío es información ("esta persona no ha mandado
 * ningún documento", no "aquí no se piden"), así que dos copias suyas se separan
 * a la primera vez que alguien afine una.
 *
 * SIN DOCUMENTO NO HAY BOTÓN, y no es un descuido: un botón que no puede hacer
 * nada es peor que ninguno. Queda la raya, en el gris de "no hay dato", con la
 * frase entera para quien no la ve.
 *
 * El chip es el botón, como en la ficha: lo que se pulsa para ver un documento
 * es su nombre, no una lupa al lado.
 */
export function CeldaDocumento({
  cvPath,
  nombre,
  onAbrir,
}: {
  /** La ruta del documento, si esta persona mandó alguno. */
  cvPath: string | null | undefined
  /** De quién es, para el nombre accesible del botón. */
  nombre: string
  onAbrir: () => void
}) {
  if (!cvPath)
    return (
      <>
        <span className="text-slate-500" aria-hidden>–</span>
        <span className="sr-only">Sin documentos</span>
      </>
    )
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Ver los documentos de ${nombre}`}
      className="rounded-sm outline-none transition-[filter] duration-[var(--duration-control)] hover:brightness-[0.96] focus-visible:ring-2 focus-visible:ring-indigo-500/40 motion-reduce:transition-none"
    >
      <ChipDocumento />
    </button>
  )
}

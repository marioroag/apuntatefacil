import type { LucideIcon } from 'lucide-react'

// -----------------------------------------------------------------------------
// LA BALDOSA DE UN ESTADO VACÍO. Vocabulario único.
//
// ES UNA CAJA DE CONTORNO, NO UNA MANCHA GRIS (Mario, ago 2026: "no me gusta el
// fondo gris que les damos, y la manera tan blanda de presentar los iconos").
// Era `bg-slate-100`, y el problema se midió: sobre el blanco de una tarjeta ese
// relleno da **1,09:1**, que es exactamente el umbral que esta doctrina ya
// declaró insuficiente dos veces (fue lo que subió la cápsula de estado del
// puesto del 50 al 200, y la pastilla de estado del 50 al 100). O sea que la
// baldosa **no llegaba a leerse como forma**: no era una caja, era una mancha.
//
// Y encima trabajaba en contra de lo que envolvía: el icono en `slate-400`
// dentro del relleno se quedaba en **2,42:1**, por debajo del 3:1 que pide un
// gráfico con significado, cuando suelto sobre el blanco ya daba 2,64. La caja
// le quitaba contraste al único objeto del vacío. Eso es lo que se lee como
// "blando": una forma que no se ve, atenuando algo que sí debería verse.
//
// La salida es la del resto del sistema desde el reskin: **el filo hace el
// trabajo y el relleno desaparece**, igual que en el botón plano, en la pastilla
// de estado sin anillo y en las franjas de la ficha en móvil. El contorno se
// lee como canto mecanizado a 1px; el relleno a 1,09 no se lee de ninguna forma.
// Con la caja en contorno, el icono recupera el blanco de debajo y sube a
// `slate-500` (4,64:1), que ya cumple el suelo de un gráfico con significado.
//
// LA REGLA QUE SE SACA, y es la hermana de una que ya está escrita en "Nitidez"
// ("una raya solo vale si separa algo que el hueco no separa"):
// **una caja solo vale si contiene algo que el aire no contiene.**
//
// POR QUÉ ESTO ES UNA PIEZA Y NO UNA CLASE COPIADA. Estaba escrita a mano en
// diecisiete pantallas y ya había derivado en dos ejes sin que nadie lo
// decidiera: `text-slate-400` en unas y `text-slate-500` en otras, `rounded-xl`
// en dieciséis y `rounded-2xl` en Login. Es el mismo camino que llevó a
// `PageHeader` y a `botonIcono()`. Lo que NO se unifica es el bloque entero:
// alrededor de esta baldosa hay `h1`, `h2` y `h3` según la pantalla, con y sin
// tarjeta, y homogeneizar eso es una decisión semántica distinta.
// -----------------------------------------------------------------------------

/** Un vacío de éxito (la única variante con color): el acuse de "hecho" de
 *  `InterestResponse`. Va en verde porque ahí el icono SÍ informa (es la
 *  diferencia entre haber confirmado y no), y por eso conserva relleno: el
 *  teñido es el mensaje, no el envoltorio. */
type Tono = 'neutro' | 'exito'

const TONO: Record<Tono, string> = {
  neutro: 'filo text-slate-500',
  exito: 'bg-emerald-50 text-emerald-700',
}

export function IconoVacio({
  Icon,
  tono = 'neutro',
  /** Casi todos los vacíos van centrados en su hueco. Los de un PANEL estrecho
   *  (la pestaña Conversación) van a la izquierda, porque ahí el texto también
   *  se alinea a la izquierda y un icono centrado sobre un párrafo en bandera se
   *  lee como si fuera de otro bloque. */
  alineado = 'centro',
}: {
  Icon: LucideIcon
  tono?: Tono
  alineado?: 'centro' | 'izquierda'
}) {
  return (
    <div
      className={`grid size-12 place-items-center rounded-xl ${TONO[tono]} ${alineado === 'centro' ? 'mx-auto' : ''}`}
    >
      <Icon className="size-6" aria-hidden />
    </div>
  )
}

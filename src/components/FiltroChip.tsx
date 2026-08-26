import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Checkbox } from './ui/Checkbox'
import { colocarFlotante } from '../lib/flotante'
import { BTN_SUPERFICIE } from '../lib/buttons'

/* ---------------------------------------------------------------------------
   EL CHIP DE UN FILTRO. Pieza compartida.
   ---------------------------------------------------------------------------
   Vivia dentro de `Dashboard.tsx`, que es donde nacio, y salio de ahi cuando la
   Bandeja necesito su propio filtro por puesto (ago 2026). La alternativa era
   copiarlo, y esa es exactamente la forma en que dos piezas que empiezan iguales
   se separan al primer retoque: el panel del puesto tiene seis dimensiones y la
   Bandeja una, pero **un chip de filtro se abre, se marca y se quita igual en las
   dos**, y quien lo vea tiene que reconocerlo.

   Lo que NO sale de aqui es el menu de varias paginas (`MenuAnadirFiltro`): ese
   sirve para ELEGIR entre muchas categorias y guardar vistas, y la Bandeja no
   tiene ni lo uno ni lo otro. Se queda en el panel hasta que haga falta dos veces.
--------------------------------------------------------------------------- */

/**
 * BARRA DE FILTROS POR CATEGORÍAS (referencia que dio Mario, ago 2026).
 *
 * Lo que sustituye eran TRES franjas para una sola idea: una fila de controles que
 * no decía nada ("Filtros", "Vistas", un cuadrado de buscar), debajo una línea gris
 * con "127 candidatos, 2 filtros activos", y debajo una tira de chips con lo que
 * había puesto. Ponías el filtro arriba y leías la consecuencia abajo, en dos
 * sitios distintos. Ahora el control y su lectura son la misma cosa.
 *
 * La idea que lo ordena todo, y que es de la referencia: **"Filtros" no abre un
 * panel con todo dentro, AÑADE una dimensión.** Cada dimensión añadida es un chip
 * que enseña cuántos valores tiene puestos, y se puede quitar. Eso tiene una
 * consecuencia que vale más que el aspecto: **las preguntas de ESTE puesto son
 * dimensiones igual que Estado o Etiquetas**, así que el panel aparte que hacía
 * falta para la cola larga desaparece. Un solo mecanismo en vez de dos.
 *
 * **Un chip existe si FILTRA, y punto.** Hubo un estado paralelo de "categorías
 * añadidas" para poder enseñar una cápsula vacía nada más elegirla, y el efecto
 * fue el contrario del buscado: al desmarcar el último valor el chip seguía ahí,
 * diciendo "Estado" sin filtrar por ningún estado. Derivarlo de `n > 0` lo arregla
 * y además hace que una vista guardada enseñe sus filtros sola.
 */
export type DimensionFiltro = {
  id: string
  label: string
  icon: LucideIcon
  /** Cuántos valores tiene puestos. 0 = no filtra, y entonces no se pinta chip. */
  n: number
  /**
   * Las preguntas de ESTE puesto viven dentro de una categoría "Preguntas" en vez
   * de sueltas en la raíz: son las únicas que cambian de puesto en puesto, así que
   * en la raíz eran cinco filas de títulos largos ("¿Vehículo propio para
   * desplaza…") que empujaban hacia abajo a las cuatro que sí están siempre. Se
   * DECLARA aquí y no se deduce del prefijo del id: el id es una clave, no una
   * taxonomía.
   */
  grupo?: 'preguntas'
  limpiar: () => void
  /**
   * Sus valores. Se declaran como DATOS y no como un panel ya pintado, porque los
   * pinta quien los enseña: la página de la categoría dentro de "Filtros" y el
   * desplegable del chip son la misma lista, y además el campo de arriba tiene que
   * poder filtrarla ("Elegir estado" con quince opciones no se barre de un vistazo).
   * Con el panel pre-pintado, ese buscador no podía existir.
   */
  opciones?: { valor: string; label: string; leading?: ReactNode }[]
  seleccionadas?: Set<string>
  onToggle?: (valor: string) => void
  /** Escotilla para las dimensiones que NO son una lista (los rangos numéricos). */
  panel?: ReactNode
}

/** Lo que se ve dentro de una dimensión: su lista filtrable, o su panel a medida. */
export function ValoresDimension({ dim, q }: { dim: DimensionFiltro; q: string }) {
  if (dim.panel) return <>{dim.panel}</>
  const busca = q.trim().toLowerCase()
  const lista = (dim.opciones ?? []).filter((o) => !busca || o.label.toLowerCase().includes(busca))
  if (lista.length === 0) return <p className="px-2.5 py-3 text-[13px] text-slate-500">Ningún valor se llama así.</p>
  return (
    <>
      {lista.map((o) => (
        <label
          key={o.valor}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[14px] text-slate-700 hover:bg-slate-50 sm:py-1.5 sm:text-[13px]"
        >
          <Checkbox checked={dim.seleccionadas?.has(o.valor) ?? false} onChange={() => dim.onToggle?.(o.valor)} />
          {o.leading}
          <span className="min-w-0 flex-1 truncate">{o.label}</span>
        </label>
      ))}
    </>
  )
}

/**
 * Alto de la franja: 36px, el mismo que TODO lo que hay en su línea (el buscador y
 * el conmutador Activos/Rechazados). Estuvo a 32 con el argumento de que un chip de
 * filtro no es una acción y conviene que se lea en otro registro; el argumento no
 * era malo, pero el resultado sí: en la misma fila convivían controles de 32 y de
 * 36 y se veía descuadrada. **Una fila se lee por su línea de base común**, así que
 * el registro se dice con la pintura (tinte y peso), no con la altura.
 * En táctil sube a 44, que es el objetivo de toque.
 *
 * 40px y no 36 (Mario, ago 2026): es la fila con la que más se trabaja de la
 * pantalla y estaba a la misma talla que los botones de la cabecera, que se usan
 * mucho menos. Lo que se toca a menudo se hace más grande, no más pequeño.
 */
export const CHIP_ALTO = 'h-10 pointer-coarse:h-11'

export function ChipDimension({ dim }: { dim: DimensionFiltro }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // EN UN PORTAL Y CON POSICIÓN FIJA, no `absolute` dentro del chip. La tira de
  // chips se desplaza en horizontal, y `overflow-x` obliga al navegador a
  // recortar también en vertical: colgado del chip, el desplegable se quedaba
  // dentro de una caja de 40px de alto y no se veía. Es la misma regla que ya
  // gobierna los tooltips y el panel de avisos: lo que flota se coloca contra la
  // VENTANA, así ningún `overflow` de un antepasado puede alcanzarlo.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const colocar = () => {
      const ancla = ref.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!ancla || !panel) return
      const { top, left } = colocarFlotante(
        ancla,
        { width: panel.width, height: panel.height },
        { width: window.innerWidth, height: window.innerHeight },
        // Alineado a la IZQUIERDA del chip, que es de donde parece colgar; si no
        // cabe, `colocarFlotante` lo aprieta contra el filo en vez de sacarlo.
        { alinear: 'izquierda' },
      )
      setPos({ top, left })
    }
    colocar()
    window.addEventListener('resize', colocar)
    // El main y la propia tira se desplazan: sin reposicionar, el panel se queda
    // huérfano flotando donde estaba el chip.
    const main = document.getElementById('contenido')
    main?.addEventListener('scroll', colocar, { passive: true })
    const tira = ref.current?.parentElement
    tira?.addEventListener('scroll', colocar, { passive: true })
    return () => {
      window.removeEventListener('resize', colocar)
      main?.removeEventListener('scroll', colocar)
      tira?.removeEventListener('scroll', colocar)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const dentro = (t: Node | null) =>
      (ref.current?.contains(t as Node) ?? false) || (panelRef.current?.contains(t as Node) ?? false)
    const onDoc = (e: MouseEvent) => !dentro(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => { if (!open) setPos(null) }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        // TEÑIDO SOLO CUANDO FILTRA. En el panel del puesto un chip no llega a
        // existir sin valores puestos, asi que alli siempre esta teñido. La
        // Bandeja lo usa al reves: es su UNICO filtro, asi que se pinta tambien
        // vacio, y entonces tiene que leerse como lo que es, un control por
        // pulsar y no un filtro activo. Sin esto, la Bandeja arrancaba diciendo
        // en acento que estaba filtrando por un puesto cuando no filtraba nada.
        className={`${CHIP_ALTO} inline-flex items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium outline-none transition-colors duration-[var(--duration-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
          dim.n > 0
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : `${BTN_SUPERFICIE.secondary} ${open ? 'bg-slate-50' : ''}`
        }`}
      >
        {dim.icon && <dim.icon className={`size-4 shrink-0 ${dim.n > 0 ? 'text-indigo-500' : 'text-slate-400'}`} aria-hidden />}
        <span className="truncate">{dim.label}</span>
        {/* El recuento entre parentesis dice cuanto hay puesto sin tener que
            abrir. Vacio no se pinta: "(0)" seria contar la nada. */}
        {dim.n > 0 && <span className="num shrink-0">({dim.n})</span>}
        <ChevronDown className={`size-3 shrink-0 opacity-70 transition-transform duration-[var(--duration-control)] ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 w-64 overflow-clip rounded-xl filo bg-white p-1.5 shadow-pop"
          // Hasta que está medido se pinta fuera de la vista: colocado en 0,0 y
          // saltando después, se vería el salto en el primer fotograma.
          style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
        >
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            <ValoresDimension dim={dim} q="" />
          </div>
          {/* Quitar la dimensión vive DENTRO de su desplegable y no como una equis
              en el chip: en una fila que puede llevar seis chips, seis equis son
              seis controles más, y la doctrina dice que en una fila no se meten
              controles que no sean imprescindibles. */}
          <button
            type="button"
            onClick={() => { dim.limpiar(); setOpen(false) }}
            className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-2.5 pb-0.5 pt-2 text-left text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <X className="size-3.5" aria-hidden /> Quitar este filtro
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}


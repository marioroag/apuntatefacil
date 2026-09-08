import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Bookmark, Briefcase, ChevronDown, ChevronLeft, ChevronRight, Filter, Globe, ListFilter, Plus, Search, Trash2, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Checkbox } from './ui/Checkbox'
import { colocarFlotante } from '../lib/flotante'
import { useEsTactil } from '../lib/media'
import { BTN_SUPERFICIE, ALTO_FRANJA, ICONO_CONTROL, botonIcono } from '../lib/buttons'
import type { SavedView } from '../lib/types'

/* ---------------------------------------------------------------------------
   EL CHIP DE UN FILTRO. Pieza compartida.
   ---------------------------------------------------------------------------
   Vivia dentro de `Dashboard.tsx`, que es donde nacio, y salio de ahi cuando la
   pantalla de Candidatos necesito su propio filtro por puesto (ago 2026). La alternativa era
   copiarlo, y esa es exactamente la forma en que dos piezas que empiezan iguales
   se separan al primer retoque: el panel del puesto tiene seis dimensiones y la
   Candidatos una, pero **un chip de filtro se abre, se marca y se quita igual en las
   dos**, y quien lo vea tiene que reconocerlo.

   El MENÚ de varias páginas (`MenuAnadirFiltro`) vive también aquí desde ago
   2026, por lo mismo: era exclusivo del panel hasta que Candidatos necesitó
   filtrar por algo más que el puesto.
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
  /**
   * Valores que ahora mismo no se pueden marcar, porque marcarlos no daría ningún
   * resultado. Hoy solo lo usa Estado: "descartado" y los otros cuatro viven en
   * lados distintos del conmutador Activos/Rechazados, así que pedir los dos a la
   * vez es pedir una lista que no existe.
   *
   * REGLA QUE NO SE PUEDE SALTAR: aquí NUNCA entra un valor que ya esté marcado. Un
   * checkbox marcado y deshabilitado es una trampa: no hay forma de quitarlo. Quien
   * rellene este conjunto tiene que descontar lo que ya está puesto, y eso es
   * justamente lo que deja salir de una vista guardada con una combinación vieja.
   */
  bloqueadas?: Set<string>
  /** Por qué están bloqueadas. Lo que no se puede cambiar se dice, no se deja mudo. */
  motivoBloqueo?: string
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
      {lista.map((o) => {
        const bloqueada = dim.bloqueadas?.has(o.valor) ?? false
        return (
          <label
            key={o.valor}
            // El motivo va en el `title` y no en un globo: es una lista de cinco
            // filas dentro de un desplegable, y la causa está a dos dedos (la
            // casilla que sí está marcada). Un tooltip aquí taparía la propia lista.
            title={bloqueada ? dim.motivoBloqueo : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-[14px] sm:py-1.5 sm:text-[13px] ${
              // `slate-400` es el único sitio donde esta doctrina lo admite para
              // texto: un control deshabilitado está exento del suelo de contraste
              // justamente porque no se puede usar, y apagarlo es lo que lo dice.
              bloqueada ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Checkbox
              checked={dim.seleccionadas?.has(o.valor) ?? false}
              disabled={bloqueada}
              onChange={() => dim.onToggle?.(o.valor)}
            />
            <span className={bloqueada ? 'opacity-40' : undefined}>{o.leading}</span>
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
          </label>
        )
      })}
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
export const CHIP_ALTO = ALTO_FRANJA

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
        // Candidatos lo usa al reves: es su UNICO filtro, asi que se pinta tambien
        // vacio, y entonces tiene que leerse como lo que es, un control por
        // pulsar y no un filtro activo. Sin esto, Candidatos arrancaba diciendo
        // en acento que estaba filtrando por un puesto cuando no filtraba nada.
        className={`${CHIP_ALTO} inline-flex items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium outline-none transition-colors duration-[var(--duration-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
          dim.n > 0
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : `${BTN_SUPERFICIE.secondary} ${open ? 'bg-slate-50' : ''}`
        }`}
      >
        {/* Neutro va al gris de control (`ICONO_CONTROL`), como el embudo de
            Filtros que tiene al lado: en Candidatos el chip de Puesto se pinta
            aunque no filtre, así que en `slate-400` era otra vez un cuarto gris en
            la misma fila. Con filtros puestos pasa a indigo, igual que su
            etiqueta: eso no es un gris, es el acento diciendo que este control
            está haciendo algo. */}
        {dim.icon && <dim.icon className={dim.n > 0 ? 'size-4 shrink-0 text-indigo-500' : ICONO_CONTROL} aria-hidden />}
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

/* ---------------------------------------------------------------------------
   EL MENÚ DE FILTROS. Bajó aquí desde `Dashboard.tsx` en ago 2026.
   ---------------------------------------------------------------------------
   El comentario de arriba decía que este menú se quedaba en el panel "hasta que
   haga falta dos veces". Hizo falta: Mario pidió que Candidatos filtre por algo
   más que el puesto, y una lista de gente se filtra igual venga de un proceso o
   de todos. Lo único que el panel tiene y Candidatos no son las VISTAS
   GUARDADAS, que se guardan con el id de un puesto; por eso son opcionales y su
   página no se pinta si no llegan.
--------------------------------------------------------------------------- */
/** Fila de categoría del menú de filtros: lleva a otra página de la misma caja. */
function FilaCategoria({
  icon: Icon,
  label,
  n,
  onClick,
}: {
  icon: LucideIcon
  label: string
  n: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-slate-800 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 sm:py-1.5 sm:text-[13px]"
    >
      <Icon className="size-4 shrink-0 text-slate-500" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {/* El recuento ahorra entrar a mirar si esta categoría ya filtra. */}
      {n > 0 && <span className="num shrink-0 text-[12px] font-medium text-indigo-600">({n})</span>}
      <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}

/**
 * "FILTROS": elige la CATEGORÍA y dentro sus valores, en la misma caja.
 *
 * Dos páginas, no dos capas: la raíz lista las categorías y al pulsar una, el mismo
 * desplegable pasa a enseñar SUS valores, con el campo de arriba convertido en
 * "Elegir <categoría>". Es un gesto continuo (abrir, categoría, valores) en vez de
 * dos (añadir el chip, luego abrirlo), y sobre todo **evita que la fila se llene de
 * chips del mismo tipo**: los tres estados que quieres van dentro de "Estado", no
 * en tres cápsulas seguidas. Mario, ago 2026.
 *
 * Una segunda capa colgando de la primera se saldría de la pantalla y en móvil no
 * tendría dónde ponerse; es la misma decisión que ya tomó el submenú de Sede.
 *
 * "Limpiar todos los filtros" solo aparece cuando hay algo que limpiar: una acción
 * que no puede hacer nada es una puerta cerrada pintada en la pared.
 */
export function MenuAnadirFiltro({
  dimensiones,
  onLimpiarTodo,
  hayFiltros,
  vistas,
  onAplicarVista,
  onBorrarVista,
  onGuardarVista,
  puedeGuardar = false,
}: {
  dimensiones: DimensionFiltro[]
  onLimpiarTodo: () => void
  hayFiltros: boolean
  /**
   * Las vistas guardadas viven DENTRO de Filtros desde ago 2026 (Mario), no en un
   * botón aparte: una vista guardada ES una combinación de filtros, así que fuera
   * estaba en otro dominio. En la raíz aparece como una página más (`Vistas ›`),
   * junto a "Limpiar todos": esa zona del pie es la de las operaciones sobre el
   * CONJUNTO de filtros (recuperar uno entero, vaciarlos todos), y las categorías
   * de arriba son las de añadir uno.
   *
   * SON OPCIONALES desde ago 2026, que es cuando este menú dejó de ser del panel
   * del puesto y pasó a servir también a Candidatos. Allí una vista guardada no
   * existe: se guardan con el id de un puesto y esa pantalla los mezcla todos.
   * Sin ellas, la página de Vistas sencillamente no se pinta, que es la misma
   * regla que gobierna todo lo demás en este proyecto: lo que no está disponible
   * no se enseña bloqueado, no se enseña.
   */
  vistas?: SavedView[]
  onAplicarVista?: (v: SavedView) => void
  onBorrarVista?: (id: string) => void
  onGuardarVista?: () => void
  puedeGuardar?: boolean
}) {
  const hayVistas = !!vistas
  const [open, setOpen] = useState(false)
  // RUTA y no una sola página: hay tres niveles (raíz -> Preguntas -> una pregunta)
  // y volver atrás desde una pregunta tiene que devolverte a la LISTA de preguntas,
  // no a la raíz. Con un solo `pagina` no hay forma de saber por dónde entraste.
  const [ruta, setRuta] = useState<string[]>([])
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // COMO SU HERMANO `ChipDimension`: portal con posición fija y `colocarFlotante`,
  // no `absolute` colgando del botón (Mario, ago 2026).
  //
  // Esto ya se arregló UNA VEZ a mano, con `max-sm:right-0`, y la nota que había
  // aquí explicaba por qué: en el panel del puesto, Filtros vive pegado al filo
  // derecho en móvil, así que colgarlo de la izquierda lo sacaba 205px. Pero ese
  // arreglo depende de DÓNDE esté el botón, y en Candidatos no está pegado a
  // ningún filo (tiene la cápsula de Puesto a su izquierda): medido allí, el
  // panel empezaba en **-106**, o sea 106px fuera de la pantalla.
  //
  // La regla de la casa ya lo resolvía y esta pieza no la usaba: **lo que flota
  // se coloca contra la VENTANA**, y `colocarFlotante` aprieta contra el filo en
  // vez de salirse, en cualquier pantalla y con el botón donde esté. Una copia a
  // mano de lo que ya hace la pieza de al lado es justo lo que este proyecto
  // sabe que se separa al primer retoque.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const hoja = ruta[ruta.length - 1] ?? null
  const PAGINAS = ['preguntas', 'vistas']
  const dim = hoja && !PAGINAS.includes(hoja) ? dimensiones.find((d) => d.id === hoja) ?? null : null
  const enPreguntas = hoja === 'preguntas'
  const enVistas = hayVistas && hoja === 'vistas'
  const preguntas = dimensiones.filter((d) => d.grupo === 'preguntas')
  const raizDims = dimensiones.filter((d) => !d.grupo)
  const nPreguntas = preguntas.reduce((t, d) => t + d.n, 0)

  useLayoutEffect(() => {
    if (!open) return
    const colocar = () => {
      const ancla = botonRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!ancla || !panel) return
      setPos(
        colocarFlotante(
          ancla,
          { width: panel.width, height: panel.height },
          { width: window.innerWidth, height: window.innerHeight },
          { alinear: 'izquierda' },
        ),
      )
    }
    colocar()
    window.addEventListener('resize', colocar)
    const main = document.getElementById('contenido')
    main?.addEventListener('scroll', colocar, { passive: true })
    return () => {
      window.removeEventListener('resize', colocar)
      main?.removeEventListener('scroll', colocar)
    }
    // La RUTA y la búsqueda cambian el alto del panel (una página con tres filas
    // no mide lo que una con quince), así que hay que volver a colocarlo: si no,
    // al entrar en una categoría el panel crece hacia abajo y se sale.
  }, [open, ruta, q])

  const entrar = (id: string) => { setRuta((r) => [...r, id]); setQ('') }
  const volver = () => { setRuta((r) => r.slice(0, -1)); setQ('') }

  const cerrar = useCallback(() => {
    setOpen(false)
    // La ruta vuelve a la raíz al CERRAR, no al abrir: al abrir se vería el salto
    // de vuelta durante la animación.
    setRuta([])
    setQ('')
  }, [])

  useEffect(() => {
    if (!open) return
    // EL PANEL VIVE EN UN PORTAL, así que NO está dentro de `ref`: hay que
    // preguntarle a él también o cualquier clic DENTRO del menú se lee como un
    // clic fuera y lo cierra (pasó al sacarlo al portal para que dejara de
    // salirse de la pantalla en móvil). Es lo mismo que ya hacen su hermano
    // `ChipDimension` y el panel de avisos. Corolario: **al sacar algo a un
    // portal hay que repasar todo lo que preguntaba "¿está dentro?"**, porque en
    // el DOM ha dejado de estarlo aunque en la pantalla siga dentro.
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      const dentro = (ref.current?.contains(t) ?? false) || (panelRef.current?.contains(t) ?? false)
      if (!dentro) cerrar()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape sube UN nivel; en la raíz, cierra. Así no se sale de todo por querer
      // deshacer un paso, ni hacen falta dos Escapes para salir de tres niveles.
      if (ruta.length) {
        e.stopPropagation()
        volver()
        return
      }
      cerrar()
      botonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ruta, cerrar])

  // El foco entra al campo en un efecto y no en el click: al pulsar todavía no
  // existe. Se repite al cambiar de página, que es cuando el campo cambia de papel.
  //
  // EN TÁCTIL NO SE ENFOCA NADA (Mario, ago 2026). Con teclado físico enfocar es
  // un acierto: abres y escribes. En un móvil levanta el teclado del sistema, que
  // se come media pantalla y tapa la lista que ibas a mirar, y como este menú
  // tiene páginas lo volvía a levantar EN CADA PASO aunque no pensaras escribir.
  // Quien quiera buscar toca el campo, que está ahí.
  const esTactil = useEsTactil()
  useEffect(() => {
    if (open && !esTactil) campoRef.current?.focus()
  }, [open, hoja, esTactil])

  const busca = q.trim().toLowerCase()
  // Buscando desde la raíz se mira TODO, preguntas incluidas: quien escribe
  // "carnet" quiere ese filtro, no que le manden a abrir "Preguntas" primero. El
  // agrupado es para ojear, no una jaula.
  const vistasFiltradas = (vistas ?? []).filter((v) => !busca || v.name.toLowerCase().includes(busca))
  const enBusqueda = !!busca && !dim && !enVistas
  const listaRaiz = enBusqueda
    ? dimensiones.filter((d) => d.label.toLowerCase().includes(busca))
    : enPreguntas
      ? preguntas
      : raizDims

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        ref={botonRef}
        type="button"
        onClick={() => (open ? cerrar() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Filtros"
        // En móvil el botón es SOLO EL ICONO y cuadrado (referencia de Mario, ago
        // 2026): comparte fila con el buscador, que es quien tiene que llevarse el
        // ancho. `aspect-square` y no un `w-*` fijo para que el lado siga a la
        // altura, que en táctil sube a 44. El nombre no se pierde, se muda al
        // `aria-label`, que además está puesto siempre: así lo que anuncia el
        // lector no depende del ancho de la ventana.
        className={`${CHIP_ALTO} inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium outline-none transition-colors duration-[var(--duration-control)] max-sm:aspect-square sm:px-3.5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
          // Teñido cuando hay filtros puestos: el botón dice el estado de la franja
          // entera, igual que cada chip dice el suyo. Sin teñir, la pintura sale de
          // `BTN_SUPERFICIE` y NO se escribe a mano: pintada aquí se quedó con el
          // anillo y la sombra del botón con relieve, así que al pasar el sistema a
          // plano fue el único control de la fila que no se enteró.
          hayFiltros
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : `${BTN_SUPERFICIE.secondary} ${open ? 'bg-slate-50' : ''}`
        }`}
      >
        {/* Neutro, el mismo gris que la lupa y el engranaje (`ICONO_CONTROL`): eran
            tres tonos en la misma fila. Con filtros puestos pasa a indigo, igual
            que su etiqueta, y eso no es un cuarto gris: es el acento diciendo que
            este control está haciendo algo. */}
        <Filter className={hayFiltros ? 'size-4 shrink-0 text-indigo-500' : ICONO_CONTROL} aria-hidden />
        <span className="max-sm:hidden">Filtros</span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={dim ? `Elegir ${dim.label}` : enPreguntas ? 'Preguntas de este puesto' : enVistas ? 'Vistas guardadas' : 'Filtros'}
          // El ancho se acota a la ventana además de colocarse contra ella: en un
          // móvil de 320px, 288 de panel más los 8 de margen que deja
          // `colocarFlotante` no caben, y lo que sobra se saldría igualmente.
          className="fixed z-50 w-72 max-w-[calc(100vw-16px)] overflow-clip rounded-xl filo bg-white p-1.5 shadow-pop"
          // Hasta que está medido se pinta fuera de la vista, como el chip: en
          // 0,0 se vería saltar en el primer fotograma.
          style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
        >
          {/* El campo cambia de papel según la página: busca CATEGORÍAS en la raíz
              y VALORES dentro de una. El placeholder es lo que dice dónde estás. */}
          <div className="relative mb-1 flex items-center gap-1">
            {ruta.length > 0 && (
              <button
                type="button"
                onClick={volver}
                aria-label="Volver"
                className={botonIcono('ghost', 'sm')}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
            )}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                ref={campoRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={dim ? `Elegir ${dim.label.toLowerCase()}` : enPreguntas ? 'Buscar pregunta' : enVistas ? 'Buscar vista' : 'Buscar filtro'}
                aria-label={dim ? `Buscar en ${dim.label}` : enPreguntas ? 'Buscar una pregunta' : enVistas ? 'Buscar una vista' : 'Buscar un filtro'}
                className="h-9 w-full rounded-lg bg-slate-100 pl-8 pr-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
              />
            </div>
          </div>

          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {enVistas ? (
              <>
                {vistasFiltradas.length === 0 ? (
                  <p className="px-2.5 py-3 text-[13px] leading-relaxed text-slate-500">
                    {q
                      ? 'Ninguna vista se llama así.'
                      : 'Aún no has guardado ninguna vista. Filtra como quieras y guarda la combinación.'}
                  </p>
                ) : (
                  vistasFiltradas.map((v) => (
                    <div key={v.id} className="group flex items-center gap-1 rounded-lg hover:bg-slate-50">
                      <button
                        type="button"
                        onClick={() => { onAplicarVista?.(v); cerrar() }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-slate-800 outline-none sm:py-1.5 sm:text-[13px]"
                      >
                        {/* Global (vale para cualquier puesto) o de ESTE puesto: el
                            glifo lo dice sin gastar una palabra. */}
                        {v.campaignId === null
                          ? <Globe className="size-4 shrink-0 text-slate-500" aria-hidden />
                          : <Briefcase className="size-4 shrink-0 text-slate-500" aria-hidden />}
                        <span className="min-w-0 flex-1 truncate">{v.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onBorrarVista?.(v.id)}
                        aria-label={`Eliminar vista ${v.name}`}
                        className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition-opacity hover:bg-slate-200 hover:text-slate-900 focus-visible:opacity-100 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  ))
                )}
              </>
            ) : dim ? (
              <ValoresDimension dim={dim} q={q} />
            ) : listaRaiz.length === 0 && !(!enBusqueda && !enPreguntas && preguntas.length > 0) ? (
              <p className="px-2.5 py-3 text-[13px] text-slate-500">
                {enPreguntas ? 'Ninguna pregunta se llama así.' : 'Ningún filtro se llama así.'}
              </p>
            ) : (
              <>
                {listaRaiz.map((d) => (
                  <FilaCategoria key={d.id} icon={d.icon} label={d.label} n={d.n} onClick={() => entrar(d.id)} />
                ))}
                {/* "Preguntas" solo en la raíz y solo si el puesto tiene alguna.
                    Buscando NO se pinta, porque ahí la lista ya trae las preguntas
                    mezcladas y entrar en el grupo sería dar un rodeo. */}
                {!enBusqueda && !enPreguntas && preguntas.length > 0 && (
                  <FilaCategoria
                    icon={ListFilter}
                    label="Preguntas del puesto"
                    n={nPreguntas}
                    onClick={() => entrar('preguntas')}
                  />
                )}
              </>
            )}
          </div>

          {/* El PIE es la zona de las operaciones sobre el CONJUNTO de filtros:
              recuperar uno entero (Vistas) o vaciarlos todos. Las categorías de
              arriba son para añadir uno. */}
          {!dim && !enPreguntas && !enVistas && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              {hayVistas && (
                <FilaCategoria icon={Bookmark} label="Vistas guardadas" n={vistas.length} onClick={() => entrar('vistas')} />
              )}
              {hayFiltros && (
                <button
                  type="button"
                  onClick={() => { onLimpiarTodo(); cerrar() }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:py-1.5"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          )}

          {/* Guardar vive DENTRO de Vistas, que es donde estás cuando piensas en
              ellas. Apagado sin nada que guardar, y SIN una nota explicándolo: el
              vacío de la lista, justo encima, ya dice "filtra como quieras y guarda
              la combinación". Dos frases para el mismo hecho es una de más. */}
          {enVistas && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => { cerrar(); onGuardarVista?.() }}
                disabled={!puedeGuardar}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-transparent sm:py-1.5"
              >
                <Plus className="size-4 shrink-0" aria-hidden /> Guardar los filtros de ahora
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

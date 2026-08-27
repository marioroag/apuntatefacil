import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Settings2 } from 'lucide-react'
import { SwitchTrack } from './ui/Switch'
import { BTN_ICONO_FRANJA } from '../lib/buttons'
import type { ColumnaVista, VistaTabla } from '../lib/vistaTabla'

/* ---------------------------------------------------------------------------
   AJUSTES DE LA VISTA: qué columnas se ven, y en qué orden.
   ---------------------------------------------------------------------------
   Un engranaje a la derecha del conmutador Activos/Rechazados, que es donde
   acaba la fila de herramientas: primero se decide QUÉ lista miras (filtros,
   buscador, mitad), y al final, cómo se te presenta.

   ES EL PANEL DE LA PRESENTACIÓN, NO OTRO FILTRO, y esa frontera es lo único que
   impide que acabe siendo un cajón de sastre: aquí no entra nada que cambie
   QUIÉN sale en la lista. Filtrar ya tiene su sitio, y tenerlo en dos sería la
   contradicción que el conmutador y el filtro de estado tuvieron que aprender a
   coordinar.

   SÍ SE ORDENA AQUÍ, Y NO ES UN DUPLICADO DE LA CABECERA (Mario, ago 2026).
   Llegó a quitarse con el argumento de que ordenar ya se hace pulsando la
   cabecera de la columna, que es donde está la columna. El argumento es bueno y
   aun así está mal, y el propio panel es la razón: **la cabecera es el ÚNICO
   control de orden, así que apagar una columna esconde su control dejando el
   orden puesto**. Apagas Recibida y la lista sigue ordenada por fecha, sin nada
   en pantalla que lo diga ni forma de cambiarlo. Aquí no hay dos puertas para lo
   mismo: hay una que siempre está y otra que es un atajo cuando la columna se ve.

   De la referencia se coge la idea y no las palabras: en vez de un "Old to new"
   genérico, cada columna trae su par escrito EN PARALELO ("De la A a la Z", "De
   la más nueva a la más antigua", "Primero los que sí"). Así la diferencia entre
   las dos opciones se ve sin leerlas enteras, que es lo mismo que hace el menú de
   estado del puesto.

   El vocabulario es el de siempre: `Switch` porque son ajustes que se aplican al
   instante (un checkbox diría "he elegido esto"; un interruptor dice "esto está
   funcionando"), y la fila entera es el control.
--------------------------------------------------------------------------- */

/** Una columna por la que se puede ordenar, con sus dos sentidos escritos. */
export type OpcionOrden = {
  key: string
  /** El nombre de la columna, igual que en su cabecera. */
  label: string
  /** Cómo se lee el orden ascendente en ESTA columna. */
  asc: string
  /** Y el descendente. Los dos en paralelo: mismas palabras, del revés. */
  desc: string
}

const CAMPO =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none'

function FilaColumna<K extends string>({ col, vista }: { col: ColumnaVista<K>; vista: VistaTabla<K> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key })
  const seVe = vista.visible(col.key)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-lg ${isDragging ? 'relative z-10 bg-white shadow-pop' : ''}`}
    >
      {/* EL ASA ES LO ÚNICO QUE ARRASTRA: el interruptor de al lado tiene que
          seguir pulsándose sin que el gesto se lo lleve.

          Y ES TAMBIÉN LA ALTERNATIVA DE TECLADO, que esta doctrina exige siempre
          que hay arrastre: dnd-kit la trae puesta en `attributes` (rol de botón,
          tabulable y su descripción), y con el `KeyboardSensor` se coge con Espacio,
          se mueve con las flechas y se suelta con Espacio. Se probó en el navegador
          antes de quitar los botones de subir y bajar que había aquí; si algún día
          se cambia de sensor, vuelven. */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab rounded-lg p-1.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:cursor-grabbing"
        aria-label={`Mover ${col.label}`}
      >
        <GripVertical className="size-4" aria-hidden />
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={seVe}
        onClick={() => vista.alternar(col.key)}
        className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
      >
        {col.icon && <col.icon className="size-3.5 shrink-0 text-slate-500" aria-hidden />}
        <span className="flex-1 truncate">{col.label}</span>
        <SwitchTrack checked={seVe} size="sm" />
      </button>
    </li>
  )
}

export function AjustesVista<K extends string>({
  ordenes,
  sort,
  onOrdenar,
  ordenPorDefecto,
  onRestablecerOrden,
  vista,
  buscando,
}: {
  ordenes: OpcionOrden[]
  sort: { key: string; dir: 'asc' | 'desc' }
  onOrdenar: (key: string, dir: 'asc' | 'desc') => void
  /** Con el orden en su valor de fábrica no hay nada que restablecer. */
  ordenPorDefecto: boolean
  onRestablecerOrden: () => void
  vista: VistaTabla<K>
  /** Hay búsqueda escrita: entonces el orden por defecto lo pisa la relevancia. */
  buscando: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Con distancia: sin ella, un click en el asa empieza un arrastre de 0px y se
  // come el foco del teclado.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const alSoltar = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) vista.reordenar(active.id as K, over.id as K)
  }

  // Las FIJAS no se pintan (Mario, ago 2026). Se probó enseñar la del candidato
  // con un "Siempre" en vez de interruptor, con el argumento de que lo que no se
  // puede cambiar se dice; y sobra, porque en una lista de interruptores una fila
  // que no es un interruptor es la única que hay que pararse a entender. Que la
  // columna de quién es la fila no se pueda quitar se descubre no buscándola.
  const movibles = vista.lista.filter((c) => !c.fija)
  const actual = ordenes.find((o) => o.key === sort.key) ?? ordenes[0]
  // La relevancia solo pisa al orden POR DEFECTO: en cuanto eliges una columna,
  // mandas tú, y decirlo aquí sería mentir sobre lo que estás viendo.
  const mandaLaRelevancia = buscando && ordenPorDefecto

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Ajustes de la vista"
        title="Ajustes de la vista"
        className={BTN_ICONO_FRANJA}
      >
        <Settings2 className="size-4" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-[19rem] overflow-clip rounded-xl filo bg-white shadow-pop">
          <section className="p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-slate-700">Cómo se ordena</h3>
              {!ordenPorDefecto && (
                <button
                  type="button"
                  onClick={onRestablecerOrden}
                  className="rounded-sm text-[13px] font-medium text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                >
                  Restablecer
                </button>
              )}
            </div>
            {/* El rótulo va ENCIMA y no al lado, y es consecuencia de escribir las
                frases en las palabras de cada columna: "De la más nueva a la más
                antigua" mide 241px con su chevron, y al lado de una etiqueta se
                quedaba en 182 y truncaba. Una opción que hay que desplegar para
                leerla entera no se puede comparar con su pareja. */}
            {/* "Por" y "Sentido", no "Ordenar por" y "Orden" (Mario, ago 2026).
                Con el título encima, eran TRES palabras de la misma raíz apiladas
                y ninguna decía en qué se diferenciaban los dos selectores. El
                título ya dice el verbo; los campos solo tienen que nombrar sus dos
                ejes, la columna y hacia dónde. Tampoco valía "Columna": chocaría
                con el rótulo de la sección de abajo y sería el mismo problema
                mudado de sitio. Y "Dirección" está descartada en esta app, que va
                de personas con domicilio. */}
            <div className="mt-2.5 space-y-2.5">
              <label className="block">
                <span className="block text-[12px] font-medium text-slate-600">Por</span>
                <select value={actual.key} onChange={(e) => onOrdenar(e.target.value, sort.dir)} className={`mt-1 ${CAMPO}`}>
                  {ordenes.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-slate-600">Sentido</span>
                <select
                  value={sort.dir}
                  onChange={(e) => onOrdenar(sort.key, e.target.value as 'asc' | 'desc')}
                  className={`mt-1 ${CAMPO}`}
                >
                  <option value="asc">{actual.asc}</option>
                  <option value="desc">{actual.desc}</option>
                </select>
              </label>
            </div>
            {/* LA ÚNICA NOTA QUE QUEDA, y se gana el sitio porque sin ella el
                panel MIENTE: buscando y con el orden de fábrica, la lista sale
                por relevancia y no por lo que dicen los dos selectores de arriba.

                Hubo otra ("quien no ha contestado va siempre al final") y Mario
                la retiró: eso se ve en la propia lista en cuanto la miras, y una
                advertencia permanente para algo que no puedes cambiar es letra
                pequeña. La regla que queda: **una nota se gana el sitio si avisa
                de que lo que ves NO es lo que el control dice**, no por explicar
                cómo funciona algo por dentro. */}
            {mandaLaRelevancia && (
              <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                Mientras buscas manda lo que mejor coincide con lo que has escrito.
              </p>
            )}
          </section>

          <div className="h-px bg-slate-100" />

          <section className="p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-700">Qué columnas se ven</h3>
            {/* Sin nada tocado no hay nada que restablecer, y no se pinta: una
                acción que no puede hacer nada es una puerta pintada en la pared. */}
            {vista.personalizada && (
              <button
                type="button"
                onClick={vista.restablecer}
                className="rounded-sm text-[13px] font-medium text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
              >
                Restablecer
              </button>
            )}
          </div>
          {/* Su propio desplazamiento: con las preguntas del formulario dentro, un
              puesto con quince campos haría un panel más alto que la pantalla. El
              bloque de arriba se queda quieto, que es donde están los selectores. */}
          <div className="mt-2.5 max-h-64 overflow-y-auto overscroll-contain">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={alSoltar}>
              <SortableContext items={movibles.map((c) => c.key)} strategy={verticalListSortingStrategy}>
                <ul>
                  {movibles.map((c) => (
                    <FilaColumna key={c.key} col={c} vista={vista} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
          </section>
        </div>
      )}
    </div>
  )
}

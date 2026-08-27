import { useCallback, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

/* ---------------------------------------------------------------------------
   LISTA ORDENABLE: el sistema de arrastre VERTICAL de la app.
   ---------------------------------------------------------------------------
   Una lista que se reordena arrastrando se monta con esto y no a mano (Mario,
   ago 2026). No es orden por el orden: cada vez que se escribía suelta salían
   los mismos cuatro cabos (el eje, los sensores, la alternativa de teclado y el
   asa), y el primero de ellos ya nos costó un bug de verdad.

   **EL EJE SE CLAVA: en una lista vertical la `x` vale 0 siempre.** Moverse de
   lado no significa nada aquí, y sí hace daño: si la lista vive dentro de una
   caja con `overflow-y-auto`, el navegador **computa también `overflow-x: auto`**
   aunque nadie lo haya pedido (la misma regla del CSS que ya cazó el grupo de
   pestañas de subrayado, por el otro eje). Entonces llevar una fila a la derecha
   ensancha el contenido, la caja se vuelve desplazable a lo ancho y el
   auto-scroll de dnd-kit se pone a correr hacia allí. Y se REALIMENTA: el
   desplazamiento arrastra a la fila, que ensancha más, que da más recorrido al
   auto-scroll. Medido en el panel de la vista con un arrastre real de 140px, el
   contenido pasó de 278 a 678 y el scroll se fue solo a 292.
     * No se arregla apagando el auto-scroll, que se llevaría por delante el
       vertical, y ese sí hace falta (esa lista mide 256px y tiene doce filas).
     * Ni con `overflow-x: clip`: con `overflow-y: auto` al lado, el CSS lo
       degrada a `hidden`, o sea que la caja sigue siendo contenedor de scroll y
       el auto-scroll, que mueve `scrollLeft` por código, seguiría teniendo por
       dónde.
     * Se corta en el ORIGEN: sin ancho de más, no hay nada que desplazar.

   **DOS NIVELES, como `Switch` y `SwitchTrack`**, porque una pieza que necesita
   un mando nuevo por cada consumidor deja de ser una pieza:
     * `<ListaOrdenable>` para el caso normal, una lista que se coge por su asa.
       Trae el contexto, la estrategia vertical, los sensores y el eje clavado.
     * `SOLO_VERTICAL`, `useSensoresLista()` y `<AsaOrdenar>` sueltos, para quien
       tenga que montar su propio `DndContext` con motivo. Hoy lo hace el
       constructor de formularios, y sus motivos están escritos allí: separa el
       activador táctil del de ratón, pinta la fila en un `DragOverlay` y ajusta
       la compensación de layout por un fallo de Safari. Envolverlo habría
       pedido siete escotillas, que es tener un `DndContext` con otro nombre.
--------------------------------------------------------------------------- */

/** El modificador. Una lista vertical no se mueve de lado. */
export const SOLO_VERTICAL: Modifier[] = [({ transform }) => ({ ...transform, x: 0 })]

/**
 * Los sensores de una lista que se coge por su ASA.
 *
 * El puntero con distancia: sin ella, un click en el asa empieza un arrastre de
 * 0px y se come el foco del teclado. Y el teclado NO es un extra, es la
 * alternativa que esta doctrina exige siempre que hay arrastre: con
 * `sortableKeyboardCoordinates` el asa se coge con Espacio, se mueve con las
 * flechas y se suelta con Espacio.
 */
export function useSensoresLista() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

export function ListaOrdenable({
  items,
  onReordenar,
  className,
  children,
}: {
  /** Los ids en el orden en que se pintan. */
  items: string[]
  /** Mover `id` a donde está `destino`. */
  onReordenar: (id: string, destino: string) => void
  className?: string
  children: ReactNode
}) {
  const sensores = useSensoresLista()
  const alSoltar = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      if (over && active.id !== over.id) onReordenar(String(active.id), String(over.id))
    },
    [onReordenar],
  )

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} modifiers={SOLO_VERTICAL} onDragEnd={alSoltar}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className={className}>{children}</ul>
      </SortableContext>
    </DndContext>
  )
}

/** Lo que necesita una fila: dónde va, cómo se pinta mientras viaja y su asa. */
export function useFilaOrdenable(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return {
    ref: setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition },
    arrastrando: isDragging,
    /** Se reparte sobre `<AsaOrdenar>`, nunca sobre la fila entera. */
    asa: { ...attributes, ...listeners },
  }
}

/**
 * La TINTA del asa, declarada aparte porque la comparten dos asas que no pueden
 * ser la misma pieza: esta y la del constructor de formularios, que es un
 * `<button>` con placa al pasar por encima y una etiqueta que dice la posición.
 * Son distintas por dentro y tienen que verse iguales por fuera; con el valor
 * escrito dos veces, se separan al primer retoque.
 *
 * `slate-400` es gris de apoyo a propósito: un asa es TEXTURA, no un rótulo, y
 * una columna de nueve en tinta competiría con los nombres de las filas, que es
 * lo que de verdad se lee. Se paga que reordenar se descubra un poco más tarde;
 * si algún día molesta, se sube AQUÍ y suben las dos a la vez.
 */
export const TINTA_ASA = 'text-slate-400 hover:text-slate-600'

/**
 * El asa, y es lo ÚNICO que arrastra: lo que haya en la fila (una casilla, un
 * botón) tiene que seguir pulsándose sin que el gesto se lo lleve. Va siempre
 * FUERA de cualquier `<label>` de la fila, o cogerla marcaría su control.
 */
export function AsaOrdenar({ asa, etiqueta }: { asa: Record<string, unknown>; etiqueta: string }) {
  return (
    <span
      {...asa}
      className={`shrink-0 cursor-grab rounded-lg p-1.5 ${TINTA_ASA} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:cursor-grabbing`}
      aria-label={etiqueta}
    >
      <GripVertical className="size-4" aria-hidden />
    </span>
  )
}

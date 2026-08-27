import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Checkbox } from './ui/Checkbox'
import { AsaOrdenar, ListaOrdenable, useFilaOrdenable } from './ui/ListaOrdenable'
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

   El arrastre lo pone `ui/ListaOrdenable`, que es el sistema vertical de la
   app: el eje clavado, los sensores, la alternativa de teclado y el asa. Ahí
   está escrito por qué la `x` vale 0 (resumen: con `overflow-y-auto`, el
   navegador hace la caja desplazable también a lo ancho, y el auto-scroll de
   dnd-kit se realimentaba con el propio arrastre).

   AQUÍ SE MARCA, NO SE ENCIENDE: la lista va con CASILLAS (Mario, ago 2026, con
   una referencia de la competencia). Estuvo con interruptores, y era el
   vocabulario equivocado: la doctrina dice `Switch` para un ajuste que está
   FUNCIONANDO y `Checkbox` para ELEGIR DE UNA LISTA, y esto es literalmente lo
   segundo, escoger cuáles de las columnas disponibles quieres delante. Una
   columna apagada no es un servicio parado, es una que no has elegido.

   La prueba de que la pieza no encajaba estaba en su propio historial: hubo que
   fabricarle una talla `sm` al interruptor ("son demasiado brutos") para que
   sobreviviera en una lista de textos de 13px. **Cuando una pieza necesita una
   talla nueva para caber, casi siempre es que es la pieza equivocada**; con la
   casilla, que mide 16 de fábrica, no hace falta inventar nada (y esa talla se
   borró de `Switch`, porque un vocabulario sin consumidor invita a que alguien
   reintroduzca lo que se quitó).

   Y LA CASILLA VA A LA IZQUIERDA, CON EL ASA AL OTRO EXTREMO. Con el interruptor
   al final, la distancia entre el nombre de una columna y su estado la ponía el
   LARGO del nombre: "Encaje" tenía su control a un palmo y "¿Vehículo propio para
   desplazarte?" pegado. Con la casilla delante, los estados caen todos en una
   vertical, que es la que se barre para ver qué está puesto. El asa se va al filo
   derecho porque reordenar se hace mucho menos que encender y apagar, y porque
   tres glifos antes de la palabra (asa, casilla, icono) son un preámbulo.

   El ICONO se queda, aunque la referencia no lo lleve: la mitad de estas filas
   son preguntas del formulario y el glifo dice de qué TIPO es cada una. Va pegado
   al texto (10px de la casilla, 8 al nombre) porque pertenece al nombre y no al
   control: la proximidad es lo que agrupa.
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
  const { ref, style, arrastrando, asa } = useFilaOrdenable(col.key)
  const seVe = vista.visible(col.key)

  return (
    <li
      ref={ref}
      style={style}
      className={`flex items-center rounded-lg ${
        arrastrando ? 'relative z-10 bg-white shadow-pop' : 'hover:bg-slate-50'
      }`}
    >
      {/* La casilla y el nombre son UN control, y por eso van dentro de un
          <label>: un <input> no puede vivir dentro de un <button>, así que aquí
          no vale el `role="switch"` de una pantalla de ajustes. El asa se queda
          FUERA de la etiqueta a propósito: dentro, cogerla para arrastrar
          marcaría la casilla. */}
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pl-1.5 text-[13px] text-slate-700">
        <Checkbox checked={seVe} onChange={() => vista.alternar(col.key)} />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {col.icon && <col.icon className="size-3.5 shrink-0 text-slate-500" aria-hidden />}
          <span className="truncate">{col.label}</span>
        </span>
      </label>

      <AsaOrdenar asa={asa} etiqueta={`Mover ${col.label}`} />
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

  // Las FIJAS no se pintan (Mario, ago 2026). Se probó enseñar la del candidato
  // con un "Siempre" en vez de casilla, con el argumento de que lo que no se
  // puede cambiar se dice; y sobra, porque en una lista de casillas una fila
  // que no es una casilla es la única que hay que pararse a entender. Que la
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
            <ListaOrdenable
              items={movibles.map((c) => c.key)}
              onReordenar={(id, destino) => vista.reordenar(id as K, destino as K)}
            >
              {movibles.map((c) => (
                <FilaColumna key={c.key} col={c} vista={vista} />
              ))}
            </ListaOrdenable>
          </div>
          </section>
        </div>
      )}
    </div>
  )
}

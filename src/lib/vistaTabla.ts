import { useCallback, useMemo } from 'react'
import { guardarSeccion, leerSeccion, usePreferencia } from './preferencias'
import type { LucideIcon } from 'lucide-react'

/* ---------------------------------------------------------------------------
   CÓMO HA DEJADO EL USUARIO ESTA REJILLA: qué columnas ve y en qué orden.
   ---------------------------------------------------------------------------
   Es el hermano de `columnas.ts` (que guarda los ANCHOS) y vive aparte a
   propósito: un ancho se ajusta con la ventana que tienes delante y se toca a
   diario; qué columnas te importan es una preferencia de fondo y casi no cambia.
   Mezclarlas en la misma clave obligaría a borrar una para restablecer la otra.
   Los dos cajones viajan con TU CUENTA desde sep 2026: ver `preferencias.ts`.

   TRES REGLAS QUE NO SON NEGOCIABLES, y las tres salen de doctrina ya escrita:

   1. **HAY COLUMNAS QUE NO SE PUEDEN QUITAR NI MOVER** (`fija`). La del candidato
      es de quién es la fila: sin ella la rejilla es una cuadrícula de datos sin
      dueño. Y además es la que se queda quieta al desplazar, o sea que tiene que
      ser la primera o el `sticky` no cuadra. El panel NO las pinta (ver `fija`).

   2. **LO GUARDADO NO MANDA SOBRE LO QUE EXISTE.** Las columnas disponibles
      cambian con la empresa (Encaje solo si el plan tiene Meridian, Etiquetas
      solo si hay vocabulario) y con el producto (mañana habrá otra). Así que lo
      guardado se usa como ORDEN DE PREFERENCIA, no como la lista: lo que ya no
      existe se cae, y lo que es nuevo entra en su sitio declarado en vez de
      aparecer al final. Sin esto, estrenar una columna la mandaría al último
      puesto de todos los que ya usaban la app.

   3. **NO SE GUARDA LO VISIBLE NI LO OCULTO: SE GUARDA LO QUE HAS CAMBIADO.**
      Cada columna trae su valor de fábrica (las del producto nacen encendidas;
      las respuestas del formulario, apagadas, porque son de ESTE puesto y
      encendidas todas de golpe la tabla no cabría en ninguna pantalla). Guardar
      una lista de "visibles" o de "ocultas" obligaría a saber cuál de las dos era
      el defecto de cada una, y al añadir una columna nueva habría que decidir en
      qué lista meter a quien nunca la ha visto. Guardando la DIFERENCIA, un
      ajuste vacío o corrupto deja a todo el mundo en el valor de fábrica, que es
      siempre el correcto.
--------------------------------------------------------------------------- */

export type ColumnaVista<K extends string = string> = {
  key: K
  /** Cómo se llama en el panel. Es el mismo texto que su cabecera. */
  label: string
  /**
   * No se puede ocultar ni mover, y NO se pinta en el panel: en una lista de
   * interruptores, una fila que no es un interruptor es la única que hay que
   * pararse a entender. Que la columna de quién es la fila no se pueda quitar se
   * descubre no buscándola. Hoy solo la del candidato.
   */
  fija?: boolean
  /**
   * Nace APAGADA. Lo son las respuestas del formulario: son de este puesto, hay
   * tantas como preguntas tenga, y encendidas de golpe la tabla no cabría en
   * ninguna pantalla. Existen para que las pidas, no para que lleguen.
   */
  apagada?: boolean
  /**
   * El icono de su cabecera. El panel lo repite, y no es decoración: es lo que
   * distingue de un vistazo una columna del producto de una respuesta del
   * formulario en una lista que puede tener quince interruptores seguidos.
   *
   * Se probó antes con un RÓTULO de grupo ("De este puesto") y se retiró: en
   * cuanto arrastras una pregunta por encima de una columna del producto, el
   * rótulo se queda mintiendo sobre todo lo que tiene debajo. Y prohibir ese
   * arrastre era peor, porque poner el carnet al lado del nombre es justo para
   * lo que se pide reordenar. El icono no puede mentir: va pegado a su fila.
   */
  icon?: LucideIcon
}

type Guardado = {
  orden?: string[]
  /** Las que NO están en su valor de fábrica. Ver la regla 3. */
  cambiadas?: string[]
}

const SECCION = 'vistaTabla'

/** Referencia estable para "esta tabla está de fábrica" (ver `columnas.ts`). */
const DE_FABRICA: Guardado = {}

const leer = (): Record<string, Guardado> => leerSeccion<Record<string, Guardado>>(SECCION) ?? {}

function escribir(tablaId: string, valor: Guardado | null) {
  const todo = { ...leer() }
  if (valor) todo[tablaId] = valor
  else delete todo[tablaId]
  guardarSeccion(SECCION, Object.keys(todo).length ? todo : undefined)
}

/**
 * Ordena las columnas DISPONIBLES según la preferencia guardada.
 *
 * El criterio para lo que no está guardado es el de la regla 2: una columna
 * nueva no va al final, va donde su vecina declarada la deja. Se recorre la
 * lista de disponibles y cada una se coloca detrás de la última que sí estaba
 * guardada, que es lo más parecido a "donde el producto la puso".
 */
function aplicarOrden<K extends string>(disponibles: ColumnaVista<K>[], guardado?: string[]): ColumnaVista<K>[] {
  if (!guardado?.length) return disponibles
  const posicion = new Map(guardado.map((k, i) => [k, i]))
  let ultima = -1
  // Cada columna recibe un índice: el suyo si estaba guardada, y si no, el de la
  // anterior más una pizca, para que caiga justo detrás de ella.
  const conIndice = disponibles.map((c, i) => {
    const p = posicion.get(c.key)
    if (p !== undefined) ultima = p
    return { c, i, orden: p ?? ultima + 0.5 }
  })
  return conIndice
    .sort((a, b) => a.orden - b.orden || a.i - b.i)
    .map((x) => x.c)
}

export type VistaTabla<K extends string> = {
  /** Las columnas a pintar, ya ordenadas y sin las ocultas. */
  visibles: K[]
  /** Todas las disponibles en su orden actual, para el panel. */
  lista: ColumnaVista<K>[]
  visible: (key: K) => boolean
  alternar: (key: K) => void
  /** Soltar `key` en la posición que ocupa `destino`. */
  reordenar: (key: K, destino: K) => void
  restablecer: () => void
  /** ¿Se ha tocado algo? De aquí cuelga si "Restablecer" se puede pulsar. */
  personalizada: boolean
}

/**
 * @param tablaId    Su propio cajón: el puesto y Candidatos no comparten ajuste
 *                   aunque tengan columnas que se llamen igual.
 * @param columnas   Las DISPONIBLES ahora mismo, en el orden que declara la
 *                   pantalla. Tiene que ser estable (`useMemo`), porque de aquí
 *                   sale una prop de una tabla memoizada.
 */
export function useVistaTabla<K extends string>(tablaId: string, columnas: ColumnaVista<K>[]): VistaTabla<K> {
  // La fuente de verdad es la cuenta (`preferencias.ts`) y no un estado local:
  // el panel se recoloca solo cuando llega lo que dejaste en el otro ordenador.
  const guardado = usePreferencia<Record<string, Guardado>>(SECCION)?.[tablaId] ?? DE_FABRICA

  const lista = useMemo(() => aplicarOrden(columnas, guardado.orden), [columnas, guardado.orden])

  const cambiadas = useMemo(() => new Set(guardado.cambiadas ?? []), [guardado.cambiadas])

  // Visible = su valor de fábrica, invertido si la has tocado.
  const seVe = useCallback(
    (c: ColumnaVista<K>) => !!c.fija || (c.apagada ? cambiadas.has(c.key) : !cambiadas.has(c.key)),
    [cambiadas],
  )

  const visibles = useMemo(() => lista.filter(seVe).map((c) => c.key), [lista, seVe])

  // Se guarda el orden ENTERO de lo que hay a la vista, no solo lo movido: es lo
  // que deja que la lista guardada siga siendo legible cuando mañana cambien las
  // columnas disponibles.
  const guardar = useCallback((siguiente: Guardado) => {
    const vacio = !siguiente.orden?.length && !siguiente.cambiadas?.length
    escribir(tablaId, vacio ? null : siguiente)
  }, [tablaId])

  const alternar = useCallback((key: K) => {
    const col = columnas.find((c) => c.key === key)
    if (col?.fija) return
    // Se lee lo guardado AHORA y no un `prev` del render: el cajón vive fuera de
    // React, así que dos pulsaciones seguidas ven las dos lo que dejó la anterior.
    const prev = leer()[tablaId] ?? DE_FABRICA
    const set = new Set(prev.cambiadas ?? [])
    set.has(key) ? set.delete(key) : set.add(key)
    guardar({ ...prev, cambiadas: [...set] })
  }, [columnas, guardar, tablaId])

  const colocar = useCallback((desde: number, hasta: number) => {
    const claves = lista.map((c) => c.key)
    if (desde < 0 || hasta < 0 || desde === hasta) return
    // Ninguna fija se mueve, y nada se cuela por delante de ellas: son el ancla
    // de la fila (y la primera es además la que se queda quieta al desplazar).
    if (lista[desde].fija || lista[hasta].fija) return
    const siguiente = [...claves]
    siguiente.splice(hasta, 0, siguiente.splice(desde, 1)[0])
    guardar({ ...guardado, orden: siguiente })
  }, [lista, guardado, guardar])

  const reordenar = useCallback((key: K, destino: K) => {
    colocar(lista.findIndex((c) => c.key === key), lista.findIndex((c) => c.key === destino))
  }, [lista, colocar])

  const restablecer = useCallback(() => guardar({}), [guardar])

  return {
    visibles,
    lista,
    visible: useCallback((key: K) => {
      const col = lista.find((c) => c.key === key)
      return col ? seVe(col) : false
    }, [lista, seVe]),
    alternar,
    reordenar,
    restablecer,
    personalizada: !!guardado.orden?.length || !!guardado.cambiadas?.length,
  }
}

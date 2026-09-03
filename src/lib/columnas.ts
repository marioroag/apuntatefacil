import { useCallback, useRef, useState } from 'react'

/* ---------------------------------------------------------------------------
   COLUMNAS AJUSTABLES · el ancho de una columna es del USUARIO
   ---------------------------------------------------------------------------
   Referencia que dio Mario (ago 2026): al pasar por encima del filo que separa
   dos cabeceras aparece una barra de acento, y de ahí se tira para ensanchar o
   estrechar la columna.

   POR QUÉ HACE FALTA. Los anchos de la rejilla están medidos y son buenos para
   el caso medio, pero el caso medio no existe en el nombre de una persona: hay
   empresas cuyos candidatos se llaman "Ana Gil" y otras donde media plantilla
   son apellidos compuestos, y una etiqueta puede llamarse "OK" o "Documentación
   pendiente de revisar". Lo que la doctrina lleva diciendo desde el principio es
   que el nombre es lo único que no se puede truncar sin perder de quién es la
   fila; esto deja resolverlo a quien tiene los datos delante, sin que nadie
   tenga que adivinar un número que valga para todos.

   TRES DECISIONES QUE VIVEN AQUÍ Y NO EN CADA PANTALLA:

   1. **Durante el arrastre NO se re-renderiza.** El ancho se escribe directo en
      el `style` del `<th>` y solo se COMETE al soltar. Con `setState` en cada
      `pointermove`, una tabla de 142 filas se repinta entera sesenta veces por
      segundo y el filo va por detrás del dedo; es el mismo motivo por el que el
      buscador del puesto separa lo que se ve de lo que filtra. Con `table-fixed`
      basta con tocar el `<th>`: la columna entera lo sigue.
   2. **Tirar de un filo mueve UNA columna y solo una** (Mario, ago 2026). Es lo
      primero que falló: en la tabla de Candidatos hay DOS columnas sin ancho
      declarado (Candidato y Puesto), que en `table-fixed` se reparten el hueco
      sobrante; al ensanchar una, la otra encogía sola y parecía que el filo
      empujaba a su vecina. Al empezar un arrastre se CONGELAN todas las columnas
      a su ancho medido, así que a partir de ahí ninguna se reparte nada y la que
      se mueve es la que agarras.
      **TODO EL SOBRANTE SE LO QUEDA LA ÚLTIMA COLUMNA** (Mario, ago 2026): es la
      única que se pinta sin ancho, así que la tabla sigue midiendo lo que mide la
      tarjeta y no hay que inventar una columna de relleno ni dejar un hueco
      blanco al final. Alguien tiene que absorber la diferencia, y la última es la
      que menos molesta: va al filo derecho, su contenido es corto y nadie compara
      dos fechas por su ancho.
      Su SUELO no puede ser un `min-w-*` en la celda: en `table-fixed` el ancho de
      una columna sale del ancho declarado en la primera fila y el `min-width` de
      la celda se ignora (medido: la fecha se quedaba en 16px). El suelo se pone
      en la TABLA (`minTabla` = la suma de todos los anchos congelados), que sí lo
      respeta: mientras quepa, la última absorbe; cuando ya no, la tabla deja de
      encoger y aparece el desplazamiento horizontal, que es la salida correcta.
   3. **La última columna no se ajusta**, y por lo tanto tampoco lleva asa. No hay
      filo a su derecha del que tirar (`last:border-r-0`), y tirar del canto de la
      tarjeta no es un gesto: sería un asa que no se ve. Encaja además con lo
      anterior: es la que absorbe, así que su ancho es una consecuencia y no una
      decisión. Lo decide esta pieza a partir del orden, no cada pantalla, porque
      una pantalla que se olvide deja un asa colgando fuera.
   4. **Hay alternativa de teclado, y no es opcional**: el asa es un
      `role="separator"` enfocable, las flechas mueven de 16 en 16 (48 con Shift)
      y Home devuelve la columna a su ancho de fábrica. Doble clic hace lo mismo
      que Home, que es lo que la gente ya intenta. La doctrina de accesibilidad
      exige alternativa de teclado en todo lo que se arrastra.

   Se guarda en `localStorage` y no en el servidor: el ancho cómodo depende de la
   pantalla que tienes delante, no de quién eres, así que viajar de portátil a
   monitor con los anchos del otro sitio sería peor que no guardarlos.
--------------------------------------------------------------------------- */

const CLAVE = 'apuntatefacil.columnas.v1'

/**
 * Suelo de última instancia, para una columna que no declare el suyo. El bueno es
 * el que declara cada pantalla, porque **el mínimo de una columna lo dice su
 * CONTENIDO** (Mario, ago 2026): no es lo mismo una fecha que una pastilla de
 * estado, y una columna que se puede estrechar hasta que su dato deja de leerse
 * no es ajustable, es rompible.
 */
export const ANCHO_MINIMO = 72

/**
 * Techo de última instancia. Como el suelo, el bueno lo declara cada pantalla:
 * **el máximo de una columna es el punto donde deja de enseñar algo nuevo.** Una
 * pastilla de estado mide siempre lo mismo, así que darle 600px no revela nada y
 * sí se los quita al nombre, que es lo único de la fila que crece sin techo.
 */
export const ANCHO_MAXIMO = 640

/**
 * Clave reservada: lo que ocupan las cabeceras que NO son columnas de datos y por
 * lo tanto no se ajustan (hoy solo la de la casilla de selección, de 40px). Entra
 * en el suelo de la tabla porque ocupa sitio igual; no puede chocar con el id de
 * ninguna columna porque esos son palabras y este empieza por almohadilla.
 */
const FIJO = '#fijo'

/** Lo que se mueve con una flecha, y con Shift. */
const PASO = 16
const PASO_LARGO = 48

type Guardado = Record<string, Record<string, number>>

function leer(): Guardado {
  try {
    const raw = localStorage.getItem(CLAVE)
    return raw ? (JSON.parse(raw) as Guardado) : {}
  } catch {
    // Ventana privada, almacenamiento lleno o bloqueado: se sigue sin anchos
    // guardados, que es exactamente el estado de fábrica.
    return {}
  }
}

function escribir(g: Guardado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(g))
  } catch {
    /* si no se puede guardar, el ajuste vale para esta sesión y ya está */
  }
}

/** Lo que `ColHead` necesita para pintar y gobernar su asa. */
export type AsaColumna = {
  nombre: string
  min: number
  max: number
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void
  onDoubleClick: () => void
}

/**
 * @param tablaId  Con qué nombre se guardan estos anchos. Dos tablas distintas
 *                 no comparten el suyo aunque tengan columnas que se llamen igual.
 * @param orden    Las columnas que se están pintando, EN ORDEN. De aquí sale cuál
 *                 es la última, que es la que no lleva asa.
 * @param activo   `false` en móvil: allí los anchos están medidos al píxel para
 *                 que quepan nombre y estado sin empujar, y un asa de 8px es
 *                 además un objetivo de toque imposible.
 */
export function useColumnasAjustables(
  tablaId: string,
  orden: string[],
  activo: boolean,
  /**
   * Lo que mide de fábrica una columna que NADIE ha ajustado. Solo se usa para el
   * suelo de la tabla, y existe por un fallo real: los anchos guardados son los de
   * las columnas que había el día del arrastre, así que cuando aparece una NUEVA
   * (la columna Documentos de sep 2026, o una respuesta que enciendes después) no
   * está en el mapa. Contándola como 0, el suelo se quedaba corto y `table-fixed`
   * tenía que estrujar a alguien: se vio en pantalla con "Recibida" reducida a 8px.
   * Con su ancho de fábrica, el suelo vuelve a decir la verdad y la tabla se
   * DESPLAZA en vez de matar una columna.
   */
  baseDe?: (k: string) => number,
) {
  const [anchos, setAnchos] = useState<Record<string, number>>(() => (activo ? leer()[tablaId] ?? {} : {}))
  // El arrastre vive en una ref y no en el estado: nada de lo que pasa mientras
  // se arrastra tiene que provocar un render (ver la decisión 1 de arriba).
  const arrastre = useRef<{
    th: HTMLElement
    /** La tabla, para mover su suelo A LA VEZ que la columna (ver `alMover`). */
    tabla: HTMLElement | null
    key: string
    min: number
    max: number
    x0: number
    w0: number
    /** El suelo de la tabla al empezar, para irlo recalculando sin pasar por el estado. */
    min0: number
  } | null>(null)
  // Espejo de `anchos` para poder leerlos y encadenarlos SIN pasar por el estado.
  // Hace dos cosas que el estado solo no puede: deja calcular el siguiente valor
  // fuera del updater (guardar en `localStorage` dentro de él sería un efecto
  // colateral en una función que React puede llamar dos veces), y hace que dos
  // pulsaciones de flecha en el mismo tick se sumen en vez de pisarse, porque la
  // segunda ya ve lo que dejó la primera.
  const anchosRef = useRef(anchos)
  anchosRef.current = anchos
  // El orden cambia con el ancho de la ventana; `congelar` necesita el de AHORA
  // para saber cuál es la última, y no el del render en que se creó.
  const ordenRef = useRef(orden)
  ordenRef.current = orden
  // Los mínimos que ha declarado cada columna. Se llena solo: `col()` se llama en
  // cada render para todas, así que cuando empieza un arrastre ya están todos. Es
  // lo que deja que `congelar` respete el suelo de una columna que ahora mismo
  // está más estrecha que él (o escondida por media query).
  const minimosRef = useRef<Record<string, number>>({})

  const guardar = useCallback(
    (key: string, ancho: number | null) => {
      const next = { ...anchosRef.current }
      if (ancho === null) delete next[key]
      else next[key] = ancho
      anchosRef.current = next
      setAnchos(next)
      const g = leer()
      if (Object.keys(next).length === 0) delete g[tablaId]
      else g[tablaId] = next
      escribir(g)
    },
    [tablaId],
  )

  /**
   * Fija TODAS las columnas a su ancho de ahora mismo. Es lo que hace que tirar
   * de un filo mueva una sola columna (ver la decisión 2).
   *
   * Dos exclusiones, y las dos importan:
   *  · **Las ocultas por media query** (Teléfono por debajo de `lg`, Etiquetas
   *    por debajo de `xl`): congelarlas a cero las dejaría invisibles para
   *    siempre al ensanchar la ventana.
   */
  const congelar = useCallback(
    (th: HTMLElement) => {
      const fila = th.parentElement
      if (!fila) return
      const ultima = ordenRef.current[ordenRef.current.length - 1]
      const next = { ...anchosRef.current }
      const celdas: HTMLElement[] = []
      let cambio = false
      let fijo = 0
      fila.querySelectorAll<HTMLElement>('th').forEach((el) => {
        const w = Math.round(el.getBoundingClientRect().width)
        const k = el.dataset.columna
        if (!k) {
          // Cabecera que no es una columna de datos (la casilla): no se ajusta,
          // pero ocupa, así que cuenta para el suelo de la tabla.
          fijo += w
          return
        }
        celdas.push(el)
        if (next[k] !== undefined) return
        const min = minimosRef.current[k] ?? ANCHO_MINIMO
        // Ancho 0 = escondida por media query. Se congela a su MÍNIMO y no se
        // salta: saltándola se quedaba sin ancho declarado, y al ensanchar la
        // ventana aparecía como una segunda columna elástica, que es justo el
        // reparto que todo esto viene a quitar.
        next[k] = Math.max(min, w)
        cambio = true
      })
      if (!cambio) return
      next[FIJO] = fijo

      // Y SE APLICAN AL DOM AQUÍ MISMO, sin esperar al render que trae el estado.
      //
      // El arrastre empieza en este mismo gesto y pinta escribiendo estilos a
      // mano; si la mitad de las columnas todavía se están repartiendo el hueco
      // como antes, durante todo el primer arrastre se ve una cosa y al comitir
      // otra. Pasó de las dos formas posibles: la última pegaba un saltito de 4px
      // al final, y al arreglar eso pasó a flotar en 198 en vez de quedarse en su
      // mínimo, porque era la única declarada entre dos columnas elásticas.
      for (const el of celdas) {
        const k = el.dataset.columna!
        el.style.width = k === ultima ? 'auto' : `${next[k]}px`
      }
      anchosRef.current = next
      setAnchos(next)
      const g = leer()
      g[tablaId] = next
      escribir(g)
    },
    [tablaId],
  )

  /**
   * Devuelve la tabla a sus anchos de fábrica. ENTERA y no una columna: una vez
   * congelada, el ancho de cada columna depende del de las demás (la última vive
   * de lo que sobra), así que "devolver una sola a su sitio" no es un estado que
   * signifique nada. Un solo gesto, un solo resultado.
   */
  const restablecer = useCallback(() => {
    anchosRef.current = {}
    setAnchos({})
    const g = leer()
    delete g[tablaId]
    escribir(g)
  }, [tablaId])

  const asaDe = useCallback(
    (
      key: string,
      nombre: string,
      min: number,
      max: number,
    ): Omit<AsaColumna, 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'> => ({
      nombre,
      min,
      max,
      onPointerDown: (e) => {
        // Solo el botón principal: con el secundario se abre el menú del sistema
        // y el arrastre se quedaría enganchado sin que nadie suelte.
        if (e.button !== 0) return
        const th = (e.currentTarget as HTMLElement).closest('th')
        if (!th) return
        e.preventDefault()
        congelar(th)
        // El suelo de la tabla AHORA, leído de la ref (que `congelar` acaba de
        // dejar al día) y no del estado, que todavía no ha comitido.
        const ult = ordenRef.current[ordenRef.current.length - 1]
        const min0 = ordenRef.current.reduce(
          (t, k) =>
            t + (k === ult ? (minimosRef.current[k] ?? ANCHO_MINIMO) : (anchosRef.current[k] ?? 0)),
          anchosRef.current[FIJO] ?? 0,
        )
        const w0 = th.getBoundingClientRect().width
        arrastre.current = {
          th,
          tabla: th.closest('table'),
          key,
          min,
          // EL TECHO NUNCA ESTÁ POR DEBAJO DE DONDE EMPIEZAS. Si la columna ya
          // venía más ancha que su máximo (el reparto natural se lo dio, con la
          // ventana grande), sujetarla al máximo la encogería de golpe al primer
          // píxel de arrastre. Así se puede estrechar pero no seguir creciendo,
          // que es lo que el máximo quiere decir.
          max: Math.max(max, Math.round(w0)),
          x0: e.clientX,
          w0,
          min0,
        }
        // La captura es lo que hace que el arrastre siga funcionando cuando el
        // puntero se sale de la tabla, que es justo lo que pasa al estrechar. Va
        // en un try: si el navegador no reconoce ese puntero, lanza, y perder la
        // captura solo significa que el arrastre acaba antes, no que se rompa.
        try {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          /* sin captura: el arrastre sigue mientras el puntero esté encima */
        }
      },
      onKeyDown: (e) => {
        const th = (e.currentTarget as HTMLElement).closest('th')
        if (!th) return
        // Del espejo y no del estado: si no, dos flechas seguidas leerían las dos
        // el mismo valor de partida y la segunda desharía a la primera.
        const actual = anchosRef.current[key] ?? Math.round(th.getBoundingClientRect().width)
        const paso = e.shiftKey ? PASO_LARGO : PASO
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          guardar(key, Math.min(Math.max(max, actual), actual + paso))
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          guardar(key, Math.max(min, actual - paso))
        } else if (e.key === 'Home') {
          e.preventDefault()
          restablecer()
        }
      },
      onDoubleClick: restablecer,
    }),
    [guardar, congelar, restablecer],
  )

  /** Los manejadores del arrastre. Se ponen en el asa, que es quien captura. */
  const alMover = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const a = arrastre.current
    if (!a) return
    const ancho = Math.min(a.max, Math.max(a.min, Math.round(a.w0 + (e.clientX - a.x0))))
    // Directo al DOM: ver la decisión 1. El estado se entera al soltar.
    a.th.style.width = `${ancho}px`
    // Y EL SUELO DE LA TABLA SE MUEVE CON ÉL, en el mismo fotograma.
    //
    // Sin esto, ensanchar una columna estrujaba a la última por debajo de su
    // mínimo durante todo el arrastre (la tabla no podía crecer, porque su suelo
    // solo se recalculaba al comitir el estado) y al soltar la última PEGABA UN
    // SALTO de vuelta a su mínimo. Mario lo describió exacto: brusco, y no es lo
    // que el usuario está pidiendo hacer. Moviendo los dos a la vez, la última se
    // queda clavada en su mínimo y lo que crece es la tabla, de forma continua;
    // al soltar, el estado calcula este mismo número y no se mueve nada.
    if (a.tabla) a.tabla.style.minWidth = `${a.min0 - a.w0 + ancho}px`
  }, [])

  const alSoltar = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const a = arrastre.current
      if (!a) return
      arrastre.current = null
      const el = e.currentTarget as HTMLElement
      try {
        if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
      } catch {
        /* ya se había soltado */
      }
      guardar(a.key, Math.round(a.th.getBoundingClientRect().width))
    },
    [guardar],
  )

  /**
   * Lo que se le pasa a `ColHead`. Devuelve objetos nuevos en cada render a
   * propósito: esto se usa DENTRO de una tabla que ya está memoizada, así que no
   * cruza ninguna frontera de `memo`.
   */
  /** ¿Hay algún ancho puesto a mano? Hasta que lo haya, la tabla se reparte el
   *  sitio como siempre y no se toca nada. (`FIJO` no cuenta: no es una columna
   *  que nadie haya ajustado, es lo que mide lo que no se ajusta.) */
  const congelado = orden.some((k) => anchos[k] !== undefined)

  const col = useCallback(
    (
      key: string,
      nombre: string,
      /** Su suelo, en píxeles. Lo declara la pantalla porque sale de su CONTENIDO. */
      minimo = ANCHO_MINIMO,
      /** Su techo. También sale del contenido: hasta dónde enseña algo nuevo. */
      maximo = ANCHO_MAXIMO,
    ): { columna: string; ancho?: number | 'auto'; asa?: AsaColumna } => {
      minimosRef.current[key] = minimo
      const esUltima = orden[orden.length - 1] === key
      return {
        // Lo lee `congelar` para encontrar las hermanas de esta columna.
        columna: key,
        // La última se queda con TODO el sobrante, y para eso hay que anular el
        // ancho que trae escrito en su clase: en `table-fixed`, la única columna
        // sin ancho declarado es la que absorbe. Su suelo lo pone el `min-w-*`
        // que la pantalla declara a su lado, así que estrujar las demás acaba
        // sacando el desplazamiento horizontal en vez de matar la fecha.
        ancho: esUltima ? (congelado ? 'auto' : undefined) : anchos[key],
        asa:
          activo && !esUltima
            ? { ...asaDe(key, nombre, minimo, maximo), onPointerMove: alMover, onPointerUp: alSoltar, onPointerCancel: alSoltar }
            : undefined,
      }
    },
    [anchos, congelado, orden, activo, asaDe, alMover, alSoltar],
  )

  /**
   * El suelo de la tabla: lo que miden las columnas congeladas más **el MÍNIMO de
   * la última**, no lo que la última mida ahora.
   *
   * Es lo que hace que la última tenga suelo de verdad: mientras quepa, absorbe;
   * cuando llega a su mínimo, la tabla deja de encoger y empieza a DESPLAZARSE,
   * en vez de seguir estrujándola hasta que su dato no se lee (Mario, ago 2026).
   *
   * Y es su mínimo DECLARADO y no el ancho que tenía al congelarse, que es lo que
   * había y estaba mal: congelando con la ventana ancha, la última se quedaba con
   * un suelo de 200px que ya no había forma de repartir, y la tabla empezaba a
   * desplazarse mucho antes de hacer falta. El suelo de una columna es una
   * propiedad de su contenido, no de en qué momento la tocaste por primera vez.
   *
   * `minimosRef` lo llena `col()` al pintar, o sea DESPUÉS de esta línea. No es un
   * problema: `congelado` solo se pone a true al soltar un arrastre, y para
   * entonces la tabla ya se ha pintado entera al menos una vez. Mientras es false,
   * esto vale `undefined` y manda el `min-w-*` de la propia tabla.
   */
  const ultima = orden[orden.length - 1]
  const minTabla = congelado
    ? orden.reduce(
        (t, k) => t + (k === ultima ? (minimosRef.current[k] ?? ANCHO_MINIMO) : (anchos[k] ?? baseDe?.(k) ?? 0)),
        anchos[FIJO] ?? 0,
      ) || undefined
    : undefined

  return { col, minTabla }
}

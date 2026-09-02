import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { lunesDe, partesClave, sumarDias } from '../lib/agenda'
import { MESES } from '../lib/format'
import { botonClase } from '../lib/buttons'

/**
 * EL MES EN PEQUEÑO, para saltar a cualquier día y ver dónde está la carga
 * (referencia que dio Mario, ago 2026).
 *
 * Es lo que de verdad aporta esa referencia y lo que a esta pantalla le faltaba:
 * hasta ahora, para llegar a una semana de dentro de un mes había que pulsar la
 * flecha cuatro veces, mirando cada tramo por el camino. Aquí se pulsa el día y
 * ya está. Y de paso contesta una pregunta que la rejilla no puede contestar
 * porque solo enseña siete días: **en qué días hay citas**, que es lo que dice
 * hacia dónde merece la pena moverse.
 *
 * Decisiones que no son de pintura:
 *
 *  - **UN SOLO PUNTO POR DÍA, no uno por cita.** La referencia pinta hasta tres
 *    puntitos de colores por celda; en una celda de 36px eso es ruido, y el
 *    color aquí no puede significar nada (el nuestro está reservado al ESTADO de
 *    la cita, y un día tiene varias). Lo que hace falta saber de un vistazo es
 *    si hay algo, y cuántas se dice en voz alta (`aria-label`), que es lo que
 *    esta casa hace siempre con los contadores.
 *
 *  - **HOY SE DICE COMO EN LA REJILLA**: disco de tinta relleno. Es la misma
 *    pieza de información en dos sitios de la misma pantalla, así que no puede
 *    tener dos formas. El acento no entra aquí: la rejilla de al lado ya dejó de
 *    usarlo para decir "estás en este día" cuando el reskin lo sacó del nav.
 *
 *  - **LO QUE ESTÁS MIRANDO SE PINTA COMO UNA BANDA**, no como un día suelto: en
 *    vista de semana la rejilla enseña SIETE, y marcar solo uno mentiría sobre
 *    lo que hay delante. Las celdas se tocan (sin hueco entre ellas) justamente
 *    para que la banda se lea como un tramo continuo y no como siete parches.
 *
 *  - **EL MES SE PASA SIN MOVER LA REJILLA.** Ojear octubre no es irse a
 *    octubre: la rejilla se mueve cuando pulsas un día, que es cuando lo has
 *    decidido. Si el cursor cambia desde fuera (con las flechas de la barra o
 *    con "Hoy"), el mes visible le sigue.
 */
export function MiniMes({
  cursor,
  dias,
  hoy,
  porDia,
  onDia,
  onHoy,
  grande = false,
}: {
  /** El día de referencia de la rejilla (aaaa-mm-dd). */
  cursor: string
  /** Los días que la rejilla está enseñando: siete en semana, uno en día. */
  dias: string[]
  hoy: string
  /** Cuántas citas tiene cada día. Se calcula fuera: aquí solo se pinta. */
  porDia: Map<string, number>
  onDia: (clave: string) => void
  /**
   * "Hoy", DENTRO de la cabecera del mes. Opcional a propósito: en escritorio ese
   * botón ya vive en la fila de herramientas, y dos "Hoy" en la misma pantalla
   * serían dos puertas para lo mismo. En móvil esa fila no existe (el mes con su
   * día ES la pantalla), así que el botón se muda aquí, que es donde cualquier
   * calendario lo pone: al lado de las flechas que pasan páginas.
   *
   * Sin él no se pierde la función del todo (hoy siempre lleva su disco de tinta
   * y basta con tocarlo), pero sí desde otro mes: hay que volver pasando páginas,
   * y "qué tengo hoy" es la pregunta que más se hace aquí.
   */
  onHoy?: { alPulsar: () => void; apagado: boolean }
  /**
   * A ANCHO DE PANTALLA, para el móvil (Mario, ago 2026).
   *
   * En el raíl el mes es un mapa que se mira de reojo con la semana al lado, y
   * 36px de celda son de sobra para un ratón. En un teléfono es el CONTROL con
   * el que se navega la agenda entera y se pulsa con el dedo, así que la celda
   * sube al objetivo de toque y el número con ella. No es un tamaño: es otro
   * papel, y por eso se declara aquí en vez de pegarle clases desde fuera.
   */
  grande?: boolean
}) {
  const mesDelCursor = cursor.slice(0, 7)
  const [mes, setMes] = useState(mesDelCursor)
  // RESINCRONIZACIÓN DURANTE EL RENDER, no en un efecto ni con un `useRef`: es
  // el patrón que la doctrina ya fijó para "el valor llegó de fuera". Con un ref,
  // un render descartado lo deja ya movido y la resincronización no vuelve a
  // ocurrir; con un efecto se pinta un fotograma con el mes viejo.
  const [mesVisto, setMesVisto] = useState(mesDelCursor)
  if (mesVisto !== mesDelCursor) {
    setMesVisto(mesDelCursor)
    setMes(mesDelCursor)
  }

  const primeroDelMes = `${mes}-01`
  const p = partesClave(primeroDelMes)
  // Seis semanas SIEMPRE, aunque el mes quepa en cinco: si la rejilla cambiara
  // de alto al pasar de mes, todo lo que tiene debajo daría un salto justo al
  // pulsar la flecha.
  const celdas = useMemo(() => {
    const inicio = lunesDe(primeroDelMes)
    return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i))
  }, [primeroDelMes])

  const enVista = useMemo(() => new Set(dias), [dias])
  const moverMes = (n: number) => setMes(sumarDias(`${mes}-15`, n * 30).slice(0, 7))

  return (
    <section aria-label="Mes" className={`rounded-xl filo bg-white ${grande ? 'p-4' : 'p-3.5'}`}>
      <header className={`flex items-center justify-between ${grande ? 'mb-3' : 'mb-2'}`}>
        <h3 className={`font-semibold capitalize text-slate-900 ${grande ? 'text-[15px]' : 'text-[13px]'}`}>
          {MESES[p.mes]} {p.anio}
        </h3>
        <div className="flex items-center gap-0.5">
          {onHoy && (
            <button
              type="button"
              onClick={onHoy.alPulsar}
              disabled={onHoy.apagado}
              // FANTASMA, como los dos chevrones con los que comparte fila: un
              // botón de línea entre dos fantasmas se lee como si fuera de otro
              // grupo, que es lo que ya obligó a quitarle la caja al `···` de la
              // cabecera de una ficha.
              className={botonClase('ghost', 'sm', 'mr-1 shrink-0 px-2.5 pointer-coarse:min-h-11 disabled:pointer-events-none disabled:opacity-40')}
            >
              Hoy
            </button>
          )}
          <button
            type="button"
            onClick={() => moverMes(-1)}
            aria-label="Mes anterior"
            className={`grid place-items-center rounded-md text-slate-600 outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${grande ? 'size-11' : 'size-7'}`}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => moverMes(1)}
            aria-label="Mes siguiente"
            className={`grid place-items-center rounded-md text-slate-600 outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${grande ? 'size-11' : 'size-7'}`}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* La semana empieza en LUNES, como la rejilla y como España. */}
      <div aria-hidden className="grid grid-cols-7 text-center">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className={`font-medium text-slate-400 ${grande ? 'py-1.5 text-[12px]' : 'py-1 text-[11px]'}`}>
            {d}
          </span>
        ))}
      </div>

      {/* Sin hueco entre celdas a propósito: es lo que deja que la banda del
          tramo que estás mirando se lea como un tramo y no como siete parches. */}
      <div className="grid grid-cols-7">
        {celdas.map((clave) => {
          const c = partesClave(clave)
          const delMes = clave.slice(0, 7) === mes
          const esHoy = clave === hoy
          const mirando = enVista.has(clave)
          const n = porDia.get(clave) ?? 0
          return (
            <button
              key={clave}
              type="button"
              onClick={() => onDia(clave)}
              aria-current={esHoy ? 'date' : undefined}
              aria-label={`${c.diaLargo} ${c.dia} ${MESES[c.mes]}${n > 0 ? `, ${n === 1 ? '1 entrevista' : `${n} entrevistas`}` : ', sin entrevistas'}`}
              className={`relative grid place-items-center outline-none transition-colors duration-[var(--duration-control)] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
                grande ? 'h-11' : 'h-9'
              } ${
                mirando ? 'bg-slate-100' : 'hover:bg-slate-50'
              } ${enVista.has(sumarDias(clave, -1)) ? '' : 'rounded-l-lg'} ${
                enVista.has(sumarDias(clave, 1)) ? '' : 'rounded-r-lg'
              }`}
            >
              <span
                className={`num grid place-items-center rounded-full leading-none ${
                  grande ? 'size-9 text-[15px]' : 'size-7 text-[13px]'
                } ${
                  esHoy
                    ? 'bg-slate-900 font-semibold text-white'
                    : delMes
                      ? 'font-medium text-slate-800'
                      : 'text-slate-400'
                }`}
              >
                {c.dia}
              </span>
              {/* El punto va en TINTA y no en el color de un estado: un día tiene
                  varias citas y cada una está en el suyo, así que teñirlo sería
                  elegir una. Sobre el disco de hoy se pinta en blanco, o se
                  perdería dentro. */}
              {n > 0 && (
                <span
                  aria-hidden
                  className={`absolute rounded-full ${grande ? 'bottom-1 size-1.5' : 'bottom-[3px] size-1'} ${
                    esHoy ? 'bg-white' : 'bg-slate-900'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

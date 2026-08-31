import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCheck, MapPin, Phone, Video } from 'lucide-react'
import { bloquesDelDia, franja, reloj, partesClave, type Bloque } from '../lib/agenda'
import { INTERVIEW_STATUS_META, type Interview } from '../lib/types'
import { clockTimeInZone, fullDateTimeInZone } from '../lib/format'

/**
 * La semana (o el día) con sus citas colocadas a la hora que son.
 *
 * La lista dice QUÉ tienes; esto dice CUÁNDO, que es la pregunta que no se
 * podía contestar de un vistazo: dónde queda la mañana libre, si el jueves está
 * cargado, cuánto hueco hay entre dos. Por eso el hueco vacío se pinta: una
 * agenda sin aire no se ve en una lista, se ve aquí.
 *
 * Cada bloque va en la HORA DE SU ZONA (ver bloquesDelDia): la etiqueta y la
 * posición cuentan lo mismo.
 */

/** Alto de una hora. Con 80px una cita de 30 min tiene sitio para hora y nombre. */
const PX_HORA = 80
/** Aire por arriba para que la primera etiqueta de hora no salga cortada. */
const PAD_TOP = 12
const PX_MIN = PX_HORA / 60
/** Por debajo de esto la rejilla deja de enseñar una jornada y no vale para nada. */
const ALTO_MINIMO = 320

export function AgendaGrid({
  dias,
  interviews,
  hoy,
  ahoraMin,
  nombreDe,
  puestoDe,
  atencionDe,
  onDia,
  onAbrir,
}: {
  /** Claves aaaa-mm-dd a pintar: siete en la semana, una en el día. */
  dias: string[]
  interviews: Interview[]
  /** Clave de hoy en la zona de quien mira. */
  hoy: string
  /** Minutos desde medianoche AHORA, para la línea de la hora actual. */
  ahoraMin: number
  nombreDe: (i: Interview) => string
  puestoDe: (i: Interview) => string
  atencionDe: (candidateId: string) => string | null
  /** Abrir un día suelto al pulsar su cabecera. */
  onDia: (clave: string) => void
  /** Abrir la ficha del candidato SIN salir de la agenda. */
  onAbrir: (candidateId: string) => void
}) {
  const scroll = useRef<HTMLDivElement>(null)

  const columnas = useMemo(
    () => dias.map((dia) => ({ dia, bloques: bloquesDelDia(interviews, dia) })),
    [dias, interviews],
  )
  const todos = useMemo(() => columnas.flatMap((c) => c.bloques), [columnas])
  const { desde, hasta } = useMemo(() => franja(todos), [todos])
  const alto = ((hasta - desde) / 60) * PX_HORA + PAD_TOP
  const horas = useMemo(() => {
    const lista: number[] = []
    for (let m = desde; m <= hasta; m += 60) lista.push(m)
    return lista
  }, [desde, hasta])

  const y = (min: number) => (min - desde) * PX_MIN + PAD_TOP
  const hoyALaVista = dias.includes(hoy)
  const ahoraDentro = hoyALaVista && ahoraMin >= desde && ahoraMin <= hasta

  // Al abrir (y al cambiar de tramo) se enseña lo que importa: la hora actual si
  // el tramo la contiene, y si no, la primera cita. Empezar siempre a las 8:00
  // dejaría la tarde escondida bajo el pliegue.
  // EL ALTO LO PONE LO QUE SOBRA DE PANTALLA (Mario, ago 2026: "aprovecha el
  // espacio vertical que hay vacío"). Estaba en `max-h-[62vh]`, un número
  // inventado que en un monitor dejaba media ventana en blanco por debajo y en un
  // portátil apretaba la jornada a 450px. Es la misma decisión que ya toma la
  // gráfica de Vista general: el hueco es exactamente el que dejan la cabecera y
  // la barra de herramientas.
  //
  // SE MIDE LA POSICIÓN DENTRO DEL CONTENIDO, no el `top` contra la ventana: el
  // `top` cambia al desplazar la página, así que la rejilla crecería sola
  // mientras bajas. Con `scrollTop` sumado, el número es el mismo se desplace o
  // no. Y no hay bucle de medida aunque se observe el DOM: lo que se lee es la
  // POSICIÓN, que no depende del alto que le acabamos de poner.
  const [maxAlto, setMaxAlto] = useState<number>()
  useLayoutEffect(() => {
    const caja = scroll.current
    const main = caja?.closest('main')
    if (!caja || !main) return
    // El aire de debajo NO se inventa: es el relleno que la propia pantalla ya
    // pone al pie (`py-6`). Puesto a mano se contaba dos veces y la página se
    // quedaba con dos píxeles de scroll que no llevaban a ninguna parte.
    //
    // Y se descuentan LOS FILOS DE LA TARJETA: el `max-height` va en la caja que
    // desplaza, que vive DENTRO del marco, así que lo que ocupa la pantalla es
    // ese alto más los 2px de borde. Sin restarlos sobraba 1px de scroll, que es
    // de los que no llevan a ninguna parte pero encienden la barra.
    const marco = caja.parentElement
    const pagina = caja.closest('.mx-auto')
    const medir = () => {
      if (!marco) return
      const dentro = marco.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
      const aire = pagina ? parseFloat(getComputedStyle(pagina).paddingBottom) || 0 : 0
      const filos = marco.offsetHeight - caja.offsetHeight
      setMaxAlto(Math.max(ALTO_MINIMO, main.clientHeight - dentro - aire - filos))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(main)
    return () => ro.disconnect()
  }, [])

  const clave = dias.join()
  useLayoutEffect(() => {
    const caja = scroll.current
    if (!caja) return
    const primera = todos.reduce<number | null>((min, b) => (min === null || b.desde < min ? b.desde : min), null)
    const objetivo = ahoraDentro ? ahoraMin : primera
    if (objetivo === null) return
    caja.scrollTop = Math.max(0, y(objetivo) - 72)
    // Solo al cambiar de tramo: mientras se mira, el scroll es de quien mira.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, desde])

  return (
    // El marco, a DOS MANOS (`filo`): el hairline de 1px solo es nítido mientras
    // cae en la rejilla de píxeles, y en el arco de la esquina pierde hasta un 23%
    // de tinta. Aquí importa más que en otras tarjetas, porque la cabecera de días
    // es una caja CUADRADA con fondo propio que llega hasta el filo y en la curva
    // pintaría encima del borde. Y `overflow-clip` y no `hidden` porque es la regla
    // de la casa para toda superficie con radio: recorta igual y no convierte la
    // caja en contenedor de scroll. (Aquí el `sticky` de dentro no dependía de
    // esto: cuelga del div con `overflow-y-auto` de la línea de abajo, que es su
    // contenedor de scroll más cercano se ponga lo que se ponga aquí fuera.)
    // `isolate` (CONTEXTO DE APILAMIENTO PROPIO), y no es cosmético: la cabecera
    // de días es `sticky z-30` y el raíl del lateral es `absolute z-30`, así que
    // empataban, y entre dos empatados gana el que va DESPUÉS en el DOM. Se veía
    // en cuanto el lateral se contrae y se asoma al pasar por encima: el raíl se
    // despliega ENCIMA del contenido y la rejilla se le dibujaba por delante.
    //
    // La salida NO es subirle el z al lateral (el contenido llega hasta z-50 con
    // la barra de selección, y un raíl por encima taparía esa barra) ni bajar la
    // cabecera a z-20, que es donde viven la línea de la hora actual y el bloque
    // al pasar por encima: empatada con ellos y yendo antes en el DOM, se le
    // colarían por delante al desplazar. Con `isolate`, los z de dentro solo
    // compiten ENTRE ELLOS y la tarjeta entera se apila donde le toca, por
    // debajo del lateral. Regla general: **una caja con z-index dentro se aísla,
    // o sus números salen a competir con los de toda la página.**
    <div className="isolate overflow-clip rounded-xl filo bg-white shadow-card">
      <div ref={scroll} style={{ maxHeight: maxAlto }} className="overflow-y-auto overscroll-contain">
        {/* Cabecera de días. Pegada arriba: al bajar por la tarde hay que seguir
            sabiendo de qué día es cada columna. La vista de un día la pinta
            igual (antes se escondía por no repetir el rótulo de la barra): al
            bajar por la rejilla el rótulo se va y quedaba una columna de horas
            sin fecha, sin nada que dijera qué se está mirando. Su día no es un
            botón: ya estás en él y no hay ningún sitio al que llevarte. */}
        <div className="sticky top-0 z-30 flex border-b border-slate-200 bg-white">
          <div className="w-14 shrink-0" />
          {dias.map((dia) => {
            const p = partesClave(dia)
            const esHoy = dia === hoy
            const solo = dias.length === 1
            const dentro = (
              <>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${esHoy ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  {solo ? p.diaLargo : p.diaCorto}
                </span>
                <span
                  className={`num grid size-7 place-items-center rounded-full text-[15px] font-semibold ${
                    esHoy ? 'bg-slate-900 text-white' : 'text-slate-800'
                  }`}
                >
                  {p.dia}
                </span>
              </>
            )
            return (
              <div key={dia} className="min-w-0 flex-1 border-l border-slate-100 px-1 py-2 text-center">
                {solo ? (
                  <div className="mx-auto flex w-full flex-col items-center gap-0.5 py-1">{dentro}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDia(dia)}
                    className="mx-auto flex w-full flex-col items-center gap-0.5 rounded-lg py-1 transition-colors hover:bg-slate-50"
                    title={`Ver el ${p.diaLargo} ${p.dia} suelto`}
                  >
                    {dentro}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="relative flex" style={{ height: alto }}>
          {/* Regla de horas. */}
          <div className="relative w-14 shrink-0">
            {horas.map((m) =>
              // La hora en punto se calla cuando la chapa de "ahora" le cae
              // encima: dos cifras pisadas no se leen ninguna de las dos.
              ahoraDentro && Math.abs(m - ahoraMin) < 22 ? null : (
                <span
                  key={m}
                  style={{ top: y(m) - 7 }}
                  className="num absolute right-2 text-[11px] leading-none text-slate-400"
                >
                  {reloj(m)}
                </span>
              ),
            )}
            {ahoraDentro && (
              <span
                style={{ top: y(ahoraMin) - 8 }}
                className="num absolute right-1.5 rounded bg-slate-900 px-1 py-0.5 text-[10px] font-semibold leading-none text-white"
              >
                {reloj(ahoraMin)}
              </span>
            )}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Líneas de hora, por debajo de todo lo demás. */}
            {horas.map((m) => (
              <div key={m} style={{ top: y(m) }} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" aria-hidden />
            ))}

            <div className="flex h-full">
              {columnas.map(({ dia, bloques }) => (
                <div
                  key={dia}
                  className={`relative min-w-0 flex-1 border-l border-slate-100 ${dia === hoy ? 'bg-slate-50/60' : ''}`}
                >
                  {bloques.map((b) => (
                    <BloqueCita
                      key={b.entrevista.id}
                      bloque={b}
                      top={y(b.desde)}
                      nombre={nombreDe(b.entrevista)}
                      puesto={puestoDe(b.entrevista)}
                      atencion={atencionDe(b.entrevista.candidateId)}
                      pasada={dia < hoy || (dia === hoy && b.hasta <= ahoraMin)}
                      holgado={dias.length === 1 && b.columnas === 1}
                      onAbrir={onAbrir}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* La hora actual. En tinta: es información, no una acción, y el
                acento está reservado. */}
            {ahoraDentro && (
              <div style={{ top: y(ahoraMin) }} className="pointer-events-none absolute inset-x-0 z-20 flex items-center" aria-hidden>
                <span className="-ml-[3px] size-1.5 rounded-full bg-slate-900" />
                <span className="h-px flex-1 bg-slate-900/35" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function BloqueCita({
  bloque,
  top,
  nombre,
  puesto,
  atencion,
  pasada,
  holgado,
  onAbrir,
}: {
  bloque: Bloque
  top: number
  nombre: string
  puesto: string
  atencion: string | null
  pasada: boolean
  /** Un día entero para él solo: cabe el puesto en la misma línea del nombre. */
  holgado: boolean
  onAbrir: (candidateId: string) => void
}) {
  const { entrevista: i, columna, columnas } = bloque
  const meta = INTERVIEW_STATUS_META[i.status]
  const altura = Math.max((bloque.hasta - bloque.desde) * PX_MIN, 26)
  const inicio = clockTimeInZone(i.startsAt!, i.timezone)
  const fin = i.endsAt ? clockTimeInZone(i.endsAt, i.timezone) : null
  // Tres alturas de contenido: una cita de 15 min no puede pedir tres líneas, y
  // una de una hora no puede quedarse en la hora suelta.
  const dosLineas = altura >= 40
  const conPuesto = altura >= 66 && !holgado
  // Compartiendo columna cada bloque se queda en la mitad o menos: cada píxel
  // de relleno se lo come al nombre, que es lo único que hay que poder leer, y
  // la hora de fin se calla antes de salir cortada por la mitad ("10:3").
  const estrecho = columnas > 1
  const Icono = i.mode === 'videollamada' ? Video : i.mode === 'telefonica' ? Phone : MapPin
  const sitio = i.mode === 'presencial' && i.locationText ? i.locationText : ''

  return (
    // La ficha se abre AQUÍ, en su pop-up: mirar quién viene el jueves no es
    // motivo para sacarte de la agenda y dejarte en el panel de otro puesto,
    // con la semana perdida y el camino de vuelta a tu cargo.
    <button
      type="button"
      onClick={() => onAbrir(i.candidateId)}
      title={`${inicio}${fin ? ` a ${fin}` : ''}, ${nombre}. ${puesto}. ${meta.label}${atencion ? `. ${atencion}` : ''}`}
      style={{
        top,
        height: altura,
        left: `calc(${(columna / columnas) * 100}% + 2px)`,
        width: `calc(${100 / columnas}% - 4px)`,
      }}
      className={`absolute z-10 flex flex-col overflow-hidden rounded-lg py-1 text-left ring-1 ring-inset transition-shadow hover:z-20 hover:shadow-card ${
        estrecho ? 'pl-1.5 pr-1' : 'pl-2.5 pr-1.5'
      } ${meta.chip} ${meta.borde} ${pasada ? 'opacity-60' : ''}`}
    >
      {/* El filo de color dice el estado sin gastar una palabra de las pocas que caben. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${meta.dot}`} aria-hidden />

      <span className="flex items-center gap-1 leading-none">
        <span className="num text-[11px] font-semibold">{inicio}</span>
        {dosLineas && fin && !estrecho && <span className="num text-[11px] opacity-70">{fin}</span>}
        {i.reconfirmedAt && (
          <CheckCheck
            className="size-3 shrink-0 text-emerald-600"
            aria-label={`Confirmó que viene, el ${fullDateTimeInZone(i.reconfirmedAt, i.timezone)}`}
          />
        )}
        {atencion && <AlertCircle className="size-3 shrink-0 text-slate-900" aria-label={atencion} />}
        {!dosLineas && <span className="truncate text-[12px] font-semibold text-slate-900">{nombre}</span>}
      </span>

      {dosLineas && (
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-semibold leading-tight text-slate-900">{nombre}</span>
          {holgado && (
            <span className="flex min-w-0 items-center gap-1 text-[11.5px] leading-tight text-slate-500">
              <Icono className="size-3 shrink-0 text-slate-400" aria-hidden />
              <span className="truncate">{sitio ? `${puesto}, ${sitio}` : puesto}</span>
            </span>
          )}
        </span>
      )}
      {conPuesto && (
        <span className="mt-auto flex items-center gap-1 truncate text-[11px] leading-none text-slate-500">
          <Icono className="size-3 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{sitio || puesto}</span>
        </span>
      )}
    </button>
  )
}

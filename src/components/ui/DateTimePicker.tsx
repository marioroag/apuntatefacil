import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { colocarFlotante } from '../../lib/flotante'
import { useEsTactil } from '../../lib/media'
import { useDesvanecido } from '../../lib/desvanecido'

/* ---------------------------------------------------------------------------
   DÍA Y HORA: DOS CONTROLES NUESTROS, NO EL DEL NAVEGADOR.
   ---------------------------------------------------------------------------
   El `<input type="datetime-local">` es lo único de esta app que no lo dibujamos
   nosotros, y se notaba: cada navegador pinta el suyo, el calendario que abre
   Chrome no se parece a nada del producto, y sobre todo **se maneja como un
   formulario de 1998** (tres casillas de dígitos que hay que ir sobrescribiendo,
   con una rueda para los minutos). Para lo que aquí se hace de verdad, que es
   "el jueves a las diez", pedía más trabajo del que vale la tarea.

   Se parte en DOS controles, y no es cosmética: **son dos decisiones distintas y
   casi siempre solo se toca una**. El día se elige mirando una semana (¿cae en
   sábado?, ¿es pasado mañana?), y para eso hace falta ver el mes. La hora se
   elige de una lista de huecos redondos. Metidas en la misma casilla, cambiar
   solo la hora obligaba a pasar por encima de la fecha.

   El VALOR sigue siendo el mismo de antes, `YYYY-MM-DDTHH:mm` en hora local, que
   es lo que espera `createInterview`. Esta pieza cambia cómo se elige, no lo que
   se guarda.
--------------------------------------------------------------------------- */

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const SEMANA_CORTA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** Los tres días a los que de verdad se agenda una entrevista. */
const ATAJOS = [
  { dias: 0, label: 'Hoy' },
  { dias: 1, label: 'Mañana' },
  { dias: 2, label: 'Pasado' },
]

/** Cada cuántos minutos hay un hueco en la lista de horas. */
const PASO = 15

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Del texto del formulario a una fecha, SIN pasar por `new Date(texto)`.
 *
 * `new Date('2026-08-28T20:00')` lo interpretan como local los navegadores de
 * hoy, pero la misma cadena con segundos o con una Z cambia de significado, y no
 * hace falta arriesgarse: los cinco números están ahí escritos.
 */
function leer(valor: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor)
  const ahora = new Date()
  if (!m) return ahora
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0)
}

function escribir(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Mismo día del calendario. Se compara por partes y no restando milisegundos:
 *  en el cambio de hora de octubre un día dura 25. */
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Lunes primero, que es como se lee un calendario en España. */
const columna = (d: Date) => (d.getDay() + 6) % 7

/**
 * Las seis semanas de la rejilla. SIEMPRE seis, aunque el mes quepa en cinco: si
 * la rejilla cambia de alto al pasar de mes, el panel entero da un salto y los
 * botones de mover mes se mueven debajo del dedo.
 */
function rejilla(mes: Date): Date[] {
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const arranque = new Date(primero)
  arranque.setDate(1 - columna(primero))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(arranque)
    d.setDate(arranque.getDate() + i)
    return d
  })
}

/** "jue 28 ago" y, solo si no es de este año, "jue 28 ago 2027". */
function etiquetaDia(d: Date, hoy: Date): string {
  const base = `${SEMANA_CORTA[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
  return d.getFullYear() === hoy.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/* ---------------------------------------------------------------------------
   El panel flotante que comparten el calendario y la lista de horas.
--------------------------------------------------------------------------- */

const CAMPO =
  'flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-[15px] text-slate-900 transition-colors hover:border-slate-400 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 aria-expanded:border-indigo-500'

function Flotante({
  anclaRef,
  onClose,
  ancho,
  children,
  label,
}: {
  anclaRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  ancho: number
  children: React.ReactNode
  label: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Se monta invisible, se mide y solo entonces se coloca: sin el alto no se
  // puede decidir si cabe debajo. Mismo patrón que el globo de `ui/Tooltip`.
  useLayoutEffect(() => {
    const a = anclaRef.current?.getBoundingClientRect()
    const p = panelRef.current?.getBoundingClientRect()
    if (!a || !p) return
    setPos(
      colocarFlotante(
        { left: a.left, right: a.right, top: a.top, bottom: a.bottom },
        { width: ancho, height: p.height },
        { width: window.innerWidth, height: window.innerHeight },
        { alinear: 'izquierda' },
      ),
    )
  }, [anclaRef, ancho])

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (anclaRef.current?.contains(t) || panelRef.current?.contains(t)) return
      onClose()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Cierra el panel, no el diálogo de detrás.
      e.stopPropagation()
      onClose()
      anclaRef.current?.focus()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [anclaRef, onClose])

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: ancho,
        visibility: pos ? undefined : 'hidden',
      }}
      className="z-[80] overflow-hidden rounded-xl filo bg-white shadow-pop"
    >
      {children}
    </div>,
    document.body,
  )
}

/* ---------------------------------------------------------------------------
   CALENDARIO
--------------------------------------------------------------------------- */

function Calendario({
  valor,
  hoy,
  minimo,
  onElegir,
}: {
  valor: Date
  hoy: Date
  minimo: Date
  onElegir: (d: Date) => void
}) {
  const [mes, setMes] = useState(() => new Date(valor.getFullYear(), valor.getMonth(), 1))
  // El día que tiene el foco dentro de la rejilla. Es lo que mueven las flechas,
  // y es distinto del día ELEGIDO: se recorre el calendario mirando, y solo se
  // elige al pulsar. Con un solo estado, moverse ya cambiaba la cita.
  const [cursor, setCursor] = useState(valor)
  const rejillaRef = useRef<HTMLDivElement>(null)
  const moverFoco = useRef(false)

  const dias = useMemo(() => rejilla(mes), [mes])

  // El foco sigue al cursor SOLO cuando lo han movido las flechas: si se moviera
  // también al abrir, el panel le robaría el foco al campo nada más aparecer.
  useEffect(() => {
    if (!moverFoco.current) return
    moverFoco.current = false
    rejillaRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.focus()
  }, [cursor])

  const mover = (dias: number) => {
    const d = new Date(cursor)
    d.setDate(d.getDate() + dias)
    moverFoco.current = true
    setCursor(d)
    if (d.getMonth() !== mes.getMonth() || d.getFullYear() !== mes.getFullYear()) {
      setMes(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }

  const saltarMes = (n: number) => setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1))

  return (
    <div className="w-[300px] max-w-full shrink-0 p-3">
      {/* ATAJOS ARRIBA (referencia de Mario, ago 2026). Casi ninguna entrevista se
          pone dentro de dos meses: se pone mañana, o pasado, o esta misma tarde.
          Con tres pastillas, el caso normal deja de necesitar el calendario, y el
          calendario queda para el caso raro, que es justo para lo que sirve.

          NO se marcan como activas aunque caigan en el día elegido: son verbos
          ("llévame a mañana"), no un estado, y el estado ya lo dice la casilla
          rellena de abajo. Marcarlas sería el mismo hecho pintado dos veces.

          Los tres se reparten el ancho a partes iguales (Mario, ago 2026): son
          las tres puertas de la misma decisión, así que se leen de un vistazo
          como una fila y no como tres pastillas sueltas de distinto tamaño. */}
      <div className="mb-3 flex gap-1.5">
        {ATAJOS.map((a) => (
          <button
            key={a.dias}
            type="button"
            onClick={() => {
              const d = new Date(hoy)
              d.setDate(d.getDate() + a.dias)
              onElegir(d)
            }}
            className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* EL MES A LA IZQUIERDA Y LOS DOS CONTROLES JUNTOS A LA DERECHA, que es lo
          contrario del calendario de siempre (título centrado con una flecha en
          cada esquina). Dos motivos: "Septiembre 2026" es un NOMBRE y los nombres
          se leen desde el margen, no centrados como el titular de un cartel; y
          las flechas son un par que se usa a golpes seguidos, así que puestas en
          los dos extremos obligan a cruzar el panel para retroceder después de
          avanzar. */}
      <div className="mb-3 flex items-center justify-between">
        <span aria-live="polite" className="text-sm font-semibold text-slate-900">
          {MESES_LARGOS[mes.getMonth()]} <span className="num text-slate-500">{mes.getFullYear()}</span>
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => saltarMes(-1)}
            className="grid size-7 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => saltarMes(1)}
            className="grid size-7 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7" aria-hidden>
        {DIAS.map((d, i) => (
          <span key={i} className="grid h-7 place-items-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {d}
          </span>
        ))}
      </div>

      {/* Las flechas se escuchan en la REJILLA y no en cada botón: el que tiene el
          foco es siempre uno, y así el manejador no se monta cuarenta y dos veces. */}
      <div
        ref={rejillaRef}
        className="grid grid-cols-7 gap-1"
        onKeyDown={(e) => {
          const salto =
            e.key === 'ArrowLeft' ? -1
            : e.key === 'ArrowRight' ? 1
            : e.key === 'ArrowUp' ? -7
            : e.key === 'ArrowDown' ? 7
            : e.key === 'PageUp' ? -28
            : e.key === 'PageDown' ? 28
            : null
          if (salto === null) return
          e.preventDefault()
          mover(salto)
        }}
      >
        {dias.map((d) => {
          const deEsteMes = d.getMonth() === mes.getMonth()
          const pasado = d < minimo && !mismoDia(d, minimo)
          const elegido = mismoDia(d, valor)
          const esHoy = mismoDia(d, hoy)
          return (
            <button
              key={d.getTime()}
              type="button"
              disabled={pasado}
              data-cursor={mismoDia(d, cursor)}
              tabIndex={mismoDia(d, cursor) ? 0 : -1}
              aria-current={esHoy ? 'date' : undefined}
              aria-label={`${d.getDate()} de ${MESES_LARGOS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`}
              onClick={() => onElegir(d)}
              // La casilla es CUADRADA (`aspect-square`) y no un rectángulo alto:
              // una rejilla de siete columnas se lee como rejilla cuando sus
              // huecos lo son, y con celdas más altas que anchas el mes se ve
              // estirado. El ancho del panel sale de aquí, no al revés.
              className={`num relative grid aspect-square place-items-center rounded-lg text-[13px] transition-colors ${
                elegido
                  ? 'bg-indigo-600 font-semibold text-white'
                  : pasado
                    ? 'text-slate-300'
                    : esHoy
                      // HOY se dice con un ANILLO y el ELEGIDO con relleno
                      // (referencia de Mario): son la misma forma, la casilla,
                      // en sus dos estados, así que se distinguen sin pararse a
                      // mirar. Tiñendo el número, "hoy" y "el día que has
                      // elegido" competían por la misma señal. Va `ring-inset`,
                      // como todo anillo de un control: por fuera, la casilla se
                      // vería 2px más grande que sus vecinas.
                      ? 'text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50'
                      : deEsteMes
                        ? 'text-slate-800 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-slate-100'
              }`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   LISTA DE HORAS
--------------------------------------------------------------------------- */

/**
 * La lista de horas de ESCRITORIO: una columna pegada al calendario, como la
 * referencia. Es la forma buena cuando hay ancho, porque el ojo baja por las
 * horas mientras el mes sigue a la vista y no hay que cerrar nada para cambiar
 * de idea sobre el día. En un teléfono no cabe al lado y manda la rueda.
 */
function Horas({
  valor,
  onElegir,
}: {
  valor: Date
  /** `cerrar` distingue las dos formas de elegir: con el ratón se ha decidido y
   *  el panel sobra; con las flechas se está RECORRIENDO, y cerrar en el primer
   *  salto dejaría al teclado sin poder llegar a la siguiente. */
  onElegir: (h: number, m: number, cerrar: boolean) => void
}) {
  const listaRef = useRef<HTMLDivElement>(null)
  const actual = valor.getHours() * 60 + valor.getMinutes()
  // Noventa y seis huecos en una caja de diez: sin el desvanecido, la lista
  // parece acabarse en el filo. Aquí el eje es el vertical, y el mecanismo es el
  // mismo que anuncia que la tira de pastillas se desliza.
  const mascara = useDesvanecido(listaRef, 'y')

  // Todas las del día, de cuarto en cuarto. NO se recorta a horario de oficina:
  // aquí se agendan turnos de noche y entradas a las seis de la mañana, y una
  // lista que se salta la hora que necesitas te obliga a pelearte con ella.
  const huecos = useMemo(() => Array.from({ length: (24 * 60) / PASO }, (_, i) => i * PASO), [])

  // Se abre por donde estás, no por medianoche.
  useLayoutEffect(() => {
    listaRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div
      ref={listaRef}
      role="listbox"
      aria-label="Hora"
      tabIndex={-1}
      style={mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
      className="absolute inset-0 overflow-y-auto overscroll-contain p-2"
      onKeyDown={(e) => {
        const salto = e.key === 'ArrowDown' ? PASO : e.key === 'ArrowUp' ? -PASO : null
        if (salto === null) return
        e.preventDefault()
        const siguiente = (actual + salto + 24 * 60) % (24 * 60)
        onElegir(Math.floor(siguiente / 60), siguiente % 60, false)
      }}
    >
      {huecos.map((min) => {
        const elegido = min === actual
        const enPunto = min % 60 === 0
        return (
          <button
            key={min}
            type="button"
            role="option"
            aria-selected={elegido}
            onClick={() => onElegir(Math.floor(min / 60), min % 60, true)}
            // La hora EN PUNTO va en tinta y el cuarto un peldaño por debajo: son
            // las que se eligen nueve de cada diez veces, y así la lista tiene
            // dónde engancharse en vez de leerse como noventa y seis iguales.
            className={`num block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
              elegido
                ? 'bg-indigo-600 font-semibold text-white'
                : enPunto
                  ? 'font-medium text-slate-800 hover:bg-slate-100'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {dos(Math.floor(min / 60))}:{dos(min % 60)}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   LA RUEDA DE MÓVIL
--------------------------------------------------------------------------- */

/** Alto de cada peldaño de la rueda y cuántos se ven a la vez (impar, para que
 *  haya el mismo número arriba y abajo del que está elegido). */
const PELDANO = 36
const VISIBLES = 3
const ALTO_RUEDA = PELDANO * VISIBLES

/**
 * El desvanecido de la rueda es CONSTANTE, no condicional como el de una lista.
 * Una lista se desvanece por el lado que le queda contenido, y al llegar al final
 * se apaga para decir "hasta aquí". Una rueda no tiene final que anunciar: lo que
 * dice el difuminado es "esto gira", y por eso está siempre en los dos filos.
 *
 * Y NO llega a transparente: con tres peldaños a la vista, apagar del todo los
 * filos borraría el de arriba y el de abajo, que son justo los que dicen hacia
 * dónde se gira. Se quedan al 35%, que es lo que hace la rueda de iOS: se leen,
 * pero no compiten con el que está elegido.
 */
const VELO_RUEDA =
  'linear-gradient(to bottom, rgba(0,0,0,0.35) 0, black 40%, black 60%, rgba(0,0,0,0.35) 100%)'

function Rueda({
  valores,
  valor,
  onChange,
  etiqueta,
  pinta,
  lado,
}: {
  valores: number[]
  valor: number
  onChange: (v: number) => void
  etiqueta: string
  pinta: (v: number) => string
  /**
   * Hacia qué lado se arriman los números dentro de su mitad.
   *
   * CADA RUEDA OCUPA MEDIA CAJA aunque su número mida treinta píxeles (Mario,
   * ago 2026): girar una rueda es un gesto de dedo, y un carril del ancho de dos
   * dígitos obliga a acertar antes de poder empezar. Con la mitad entera, la
   * izquierda son las horas y la derecha los minutos, se toque donde se toque.
   *
   * Y los números se arriman al centro, no se centran en su mitad: centrados,
   * quedarían al 25% y al 75%, lejos de los dos puntos, y "12 : 00" dejaría de
   * leerse como una hora para leerse como dos cifras sueltas.
   */
  lado: 'derecha' | 'izquierda'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pendiente = useRef(0)
  // ¿Ya se ha colocado por primera vez? Hasta que no lo esté, lo que diga el
  // scroll no es una decisión de nadie: ver abajo.
  const puesta = useRef(false)

  /**
   * LA PRIMERA COLOCACIÓN ESPERA UN FOTOGRAMA, y esto costó una hora cambiada
   * sola. El panel se monta invisible para medirse, así que en el primer efecto
   * de layout la rueda todavía no tiene su alto definitivo: `scrollTo(360)` se
   * recortaba contra un máximo que aún no era el bueno y aterrizaba en 216, o
   * sea cuatro horas antes de la que venía puesta (medido: la sugerencia de las
   * 10:00 se abría en las 06:00). Con el alto ya definitivo, el número cuadra.
   *
   * Después de eso el valor manda sobre la posición, salvo cuando ya coinciden:
   * durante un giro el índice que se lee del scroll ES el valor, y sin esa
   * guarda la rueda se pelearía consigo misma y daría tirones bajo el dedo.
   */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const i = valores.indexOf(valor)
    if (i < 0) return
    if (puesta.current) {
      if (Math.round(el.scrollTop / PELDANO) !== i) el.scrollTop = i * PELDANO
      return
    }
    const id = requestAnimationFrame(() => {
      el.scrollTop = i * PELDANO
      puesta.current = true
    })
    return () => cancelAnimationFrame(id)
  }, [valor, valores])

  useEffect(() => () => cancelAnimationFrame(pendiente.current), [])

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={etiqueta}
      tabIndex={0}
      style={{ height: ALTO_RUEDA, maskImage: VELO_RUEDA, WebkitMaskImage: VELO_RUEDA }}
      // `snap-mandatory` es lo que hace que esto sea una rueda y no una lista:
      // el dedo la suelta donde sea y ella se para en un peldaño. El relleno de
      // arriba y abajo (dos peldaños) es lo que deja que el primero y el último
      // lleguen al centro.
      // SIN `scroll-smooth`, y esto costó un valor cambiado solo: al colocarse en
      // su peldaño, la animación pasa por todas las posiciones intermedias, y el
      // `onScroll` las lee como si el dedo estuviera girando. La rueda se cambiaba
      // el valor a sí misma mientras se colocaba (arrancaba en las 10 y acababa en
      // las 12, medido). Puesta de golpe, el único `scroll` que llega es el del
      // sitio definitivo, que ya coincide con el valor y no dispara nada.
      className="min-w-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onScroll={() => {
        // Mientras no esté colocada, lo que se lea del scroll es la propia
        // colocación, no un giro de nadie.
        if (!puesta.current || pendiente.current) return
        pendiente.current = requestAnimationFrame(() => {
          pendiente.current = 0
          const el = ref.current
          if (!el) return
          const i = Math.min(valores.length - 1, Math.max(0, Math.round(el.scrollTop / PELDANO)))
          if (valores[i] !== valor) onChange(valores[i])
        })
      }}
      onKeyDown={(e) => {
        const paso = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
        if (!paso) return
        e.preventDefault()
        const i = valores.indexOf(valor)
        const siguiente = valores[(i + paso + valores.length) % valores.length]
        onChange(siguiente)
      }}
    >
      <div style={{ height: (ALTO_RUEDA - PELDANO) / 2 }} aria-hidden />
      {valores.map((v) => {
        const elegido = v === valor
        return (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={elegido}
            tabIndex={-1}
            onClick={() => onChange(v)}
            style={{ height: PELDANO }}
            className={`num flex w-full snap-center items-center text-[15px] transition-colors ${
              lado === 'derecha' ? 'justify-end pr-2' : 'justify-start pl-2'
            } ${elegido ? 'font-semibold text-indigo-700' : 'text-slate-500'}`}
          >
            {pinta(v)}
          </button>
        )
      })}
      <div style={{ height: (ALTO_RUEDA - PELDANO) / 2 }} aria-hidden />
    </div>
  )
}

const HORAS = Array.from({ length: 24 }, (_, i) => i)
const MINUTOS = Array.from({ length: 60 / PASO }, (_, i) => i * PASO)

/**
 * LA HORA EN MÓVIL SE GIRA, NO SE BUSCA (Mario, ago 2026, con la rueda de iOS
 * como referencia). Dos ruedas, hora y minuto, en vez de una lista de noventa y
 * seis huecos: ir de las diez a las cinco y media pasa de recorrer veintidós
 * peldaños a girar siete en una rueda de veinticuatro. Y la banda del centro es
 * lo que hace que se entienda sin instrucciones: **el hueco marcado no se
 * mueve, lo que se mueve son los valores**.
 *
 * Más baja que la de iOS (cinco peldaños, 180px): esto vive dentro de un
 * diálogo que ya tiene seis campos más, no ocupando la mitad de la pantalla.
 */
function RuedaHora({ valor, onElegir }: { valor: Date; onElegir: (h: number, m: number) => void }) {
  return (
    <div className="relative flex items-stretch p-2" style={{ height: ALTO_RUEDA + 16 }}>
      {/* La banda va DEBAJO de los números (`-z-0` contra el `relative` de las
          ruedas no basta: se pinta antes en el DOM) y no captura el dedo, o
          taparía el peldaño que marca. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 rounded-lg bg-slate-100"
        style={{ top: 8 + (ALTO_RUEDA - PELDANO) / 2, height: PELDANO }}
      />
      <Rueda
        valores={HORAS}
        valor={valor.getHours()}
        onChange={(h) => onElegir(h, valor.getMinutes())}
        etiqueta="Hora"
        pinta={dos}
        lado="derecha"
      />
      <span className="num relative self-center text-[15px] text-slate-400" aria-hidden>
        :
      </span>
      <Rueda
        valores={MINUTOS}
        valor={valor.getMinutes()}
        onChange={(m) => onElegir(valor.getHours(), m)}
        etiqueta="Minutos"
        pinta={dos}
        lado="izquierda"
      />
    </div>
  )
}

/* ---------------------------------------------------------------------------
   LA PIEZA
--------------------------------------------------------------------------- */

export function SelectorFechaHora({
  id,
  value,
  onChange,
  /** Nada anterior a este instante. Por defecto, ahora: una entrevista en el
   *  pasado no es una entrevista, y el servidor la rechaza igualmente. */
  min,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  min?: Date
}) {
  const [abierto, setAbierto] = useState(false)
  const campoRef = useRef<HTMLButtonElement>(null)
  // El calendario se ENSANCHA en táctil, no solo se le suben los botones de
  // alto: con 288px sus siete columnas salen a 37 de ancho, o sea por debajo del
  // objetivo de toque aunque midan 44 de alto. Se pregunta por el PUNTERO y no
  // por el ancho, porque la causa es el dedo.
  const tactil = useEsTactil()

  const fecha = leer(value)
  const hoy = new Date()
  const minimo = min ?? hoy

  const cerrar = () => {
    setAbierto(false)
    campoRef.current?.focus()
  }

  /**
   * ELEGIR DÍA NO CIERRA; ELEGIR HORA SÍ.
   *
   * Son dos decisiones dentro del mismo panel, y el orden natural es de
   * izquierda a derecha: el día y luego la hora. Cerrando al pulsar el día, la
   * mitad de la derecha no llegaría a usarse nunca; sin cerrar nunca, el panel
   * se queda puesto encima del formulario después de haber terminado. La hora es
   * el último movimiento, así que es la que cierra. Y quien quiera cambiar solo
   * el día lo tiene igual: pulsa fuera o Escape.
   */
  const ponerDia = (d: Date) => {
    const nueva = new Date(d)
    nueva.setHours(fecha.getHours(), fecha.getMinutes(), 0, 0)
    onChange(escribir(nueva))
  }

  const ponerHora = (h: number, m: number, cerrarlo: boolean) => {
    const nueva = new Date(fecha)
    nueva.setHours(h, m, 0, 0)
    onChange(escribir(nueva))
    if (cerrarlo) cerrar()
  }

  return (
    <>
      {/* UN SOLO CAMPO, y dentro el día y la hora separados por un middot: es UNA
          fecha, no dos datos. Se probó con dos casillas (día | hora) y cada una
          con su panel, y contaba la misma historia dos veces: dos bordes, dos
          desplegables y dos sitios donde mirar para leer una sola cosa. */}
      <button
        id={id}
        ref={campoRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className={CAMPO}
      >
        <CalendarDays className="size-4 shrink-0 text-slate-500" aria-hidden />
        <span className="num truncate">
          {etiquetaDia(fecha, hoy)} <span className="text-slate-400">·</span> {dos(fecha.getHours())}:
          {dos(fecha.getMinutes())}
        </span>
      </button>

      {abierto && (
        <Flotante
          anclaRef={campoRef}
          onClose={cerrar}
          ancho={tactil ? 336 : 412}
          label="Elegir día y hora"
        >
          {/* Las dos mitades, con un filo entre ellas. En un teléfono no caben una
              al lado de la otra (el calendario se quedaría con 220px y sus
              casillas por debajo del dedo), así que se apilan y la lista de horas
              pasa a rejilla. */}
          <div className={tactil ? 'flex flex-col' : 'flex items-stretch'}>
            <Calendario valor={fecha} hoy={hoy} minimo={minimo} onElegir={ponerDia} />
            {/* EL ALTO DEL PANEL LO PONE EL CALENDARIO, Y LAS HORAS SE AJUSTAN A
                ÉL. La lista tiene noventa y seis huecos, así que en el flujo
                normal estiraba la fila hasta el techo que se le pusiera y dejaba
                un palmo de blanco debajo del calendario (medido: 630px de panel
                para 340 de calendario). Metida en `absolute inset-0` deja de
                tener voz en el alto de la fila: lo fija el calendario, que es lo
                único con alto propio, y ella scrollea dentro. */}
            <div className={tactil ? 'border-t border-slate-200' : 'relative w-[112px] shrink-0 border-l border-slate-200'}>
              {tactil ? (
                <RuedaHora valor={fecha} onElegir={(h, m) => ponerHora(h, m, false)} />
              ) : (
                <Horas valor={fecha} onElegir={ponerHora} />
              )}
            </div>
          </div>
        </Flotante>
      )}
    </>
  )
}

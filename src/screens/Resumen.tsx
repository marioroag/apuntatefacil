import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, Calendar, CalendarClock, Check, ChevronDown, ChevronRight, Clock, Inbox } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useProfiles } from '../lib/profiles'
import { useAppBase } from '../lib/useAppBase'
import { candidateName, clockTimeInZone, dayLabelInZone, miles, plural } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { SOURCE_META } from '../lib/types'
import type { Campaign, Candidate, CandidateSource } from '../lib/types'
import { IconoVacio } from '../components/ui/IconoVacio'

const STALE_DAYS = 7

/**
 * VISTA GENERAL (rediseño de Figma, Mario, ago 2026).
 *
 * Tres franjas y ni una más: **saludo**, **acciones rápidas** y la **gráfica de
 * por dónde entra la gente**. Lo que había era una pantalla-inventario: cuatro
 * cifras grandes, una gráfica, dos paneles de listas y un bloque por sede, o sea
 * seis bloques que contestaban a la vez a preguntas distintas y ninguno decía por
 * dónde empezar el día.
 *
 * QUÉ SE FUE Y A DÓNDE, que es la parte que hay que saber:
 *
 *  · **Los cuatro KPIs** (candidatos, nuevos sin revisar, contratados, puestos
 *    abiertos). Ninguno cambiaba una decisión desde aquí: para triar ya está
 *    Candidatos, y el número de procesos abiertos, que es el único del que
 *    depende la factura, vive donde se paga (el menú de cuenta y Facturación).
 *  · **"Piden atención"** no se borró: es la tarjeta del medio. Un panel con
 *    seis filas para decir "tres personas llevan una semana esperando" era la
 *    misma frase repartida en seis líneas.
 *  · **"Nuevos sin revisar"** es la primera tarjeta, y por lo mismo: la lista de
 *    puestos ordenada por cuántos nuevos tienen es el menú lateral.
 *  · **"Por sede"** era el ÚNICO sitio donde se renombraba o se borraba una
 *    sede, así que antes de quitarlo se le dio casa propia: `SedesDialog`, que
 *    abre desde el submenú Sede de un puesto y desde el buscador ("Gestionar
 *    sedes"). Una sede sigue sin ser un destino, que es la doctrina de siempre.
 *
 * La gráfica ya no cuenta candidaturas por semana a secas: las cuenta POR
 * ORIGEN, que es la única lectura de aquí que cambia lo que haces mañana (dónde
 * vuelves a anunciarte). El total ya lo dicen el puesto y Candidatos.
 */
export function Resumen() {
  const { campaigns, candidates, newCountFor, interviews } = useStore()
  const { user } = useAuth()
  const profiles = useProfiles()
  const base = useAppBase()
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // El nombre de pila, no el nombre entero: un saludo es la voz de alguien que te
  // conoce. Sale de `nameFor`, que es la única fuente de "cómo se llama esta
  // persona" en toda la app; sin perfil cae al correo (mario.rodriguez -> Mario),
  // y sin correo no se saluda por el nombre en vez de inventarse uno.
  const email = user?.email ?? null
  const nombre = email || profiles.me ? profiles.nameFor(user?.id, email).split(' ')[0] : ''

  const ahora = Date.now()
  const staleCut = ahora - STALE_DAYS * 86400000

  const nuevosTotal = campaigns.reduce((s, c) => s + newCountFor(c.id), 0)

  // Piden atención: primero quien lleva esperando, y si no hay nadie, los puestos
  // pausados. Se enseña UNA cosa, la más urgente, con su enlace: dos frases en una
  // tarjeta de tres líneas es un panel disfrazado.
  const esperando = useMemo(() => {
    const porPuesto = campaigns
      .map((c) => ({
        c,
        n: candidates.filter(
          (x) => x.campaignId === c.id && x.status === 'nuevo' && new Date(x.submittedAt).getTime() < staleCut,
        ).length,
      }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
    return { porPuesto, total: porPuesto.reduce((s, x) => s + x.n, 0) }
  }, [campaigns, candidates, staleCut])
  const pausados = campaigns.filter((c) => c.status === 'pausada')

  // La próxima entrevista confirmada que todavía no ha pasado. 'confirmada' es el
  // único estado con hueco reservado de verdad: las invitadas y las que están
  // eligiendo hora no tienen cuándo, así que anunciarlas sería inventar una cita.
  const proxima = useMemo(() => {
    const vivas = interviews
      .filter((i) => i.status === 'confirmada' && i.startsAt && Date.parse(i.startsAt) > ahora)
      .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))
    const i = vivas[0]
    if (!i) return null
    const cand = candidates.find((c) => c.id === i.candidateId)
    return { i, quien: cand ? candidateName(cand) : 'un candidato' }
  }, [interviews, candidates, ahora])

  return (
    <div className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8 [@media(max-height:820px)]:py-4">
      {/* El h1 es el saludo, no "Vista general". El nombre de la pantalla sigue
          escrito en el menú, que es donde se elige a dónde ir; aquí ya has
          llegado, y lo primero que se lee es a quién le hablamos. */}
      <PageHeader titulo={`${saludoDe(new Date(ahora).getHours())}${nombre ? `, ${nombre}` : ''}`} sub="Aquí tienes un resumen de tu actividad reciente." />

      {campaigns.length === 0 ? (
        <Empty text="Aún no tienes puestos. Crea el primero para ver aquí cómo va tu actividad." />
      ) : (
        <>
          <h2 className="text-base font-semibold text-slate-900">Acciones rápidas</h2>
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3 [@media(max-height:820px)]:mt-3">
            <AccionRapida
              icono={Inbox}
              titulo="Ver nuevos candidatos"
              texto={
                nuevosTotal > 0
                  ? `Empieza el día revisando ${plural(nuevosTotal, 'candidatura nueva', 'candidaturas nuevas')} sin catalogar.`
                  : 'No queda ninguna candidatura por revisar. Estás al día.'
              }
              to={`${base}/candidatos`}
              enlace="Candidatos"
            />
            <AccionRapida
              icono={Clock}
              titulo="Piden atención"
              texto={textoAtencion(esperando, pausados.length)}
              to={destinoAtencion(esperando, pausados, base)}
              enlace={
                esperando.porPuesto[0]?.c.title ?? pausados[0]?.title ?? undefined
              }
            />
            <AccionRapida
              icono={CalendarClock}
              titulo="Próxima entrevista"
              texto={
                proxima
                  ? `${dayLabelInZone(proxima.i.startsAt!, tz)} a las ${clockTimeInZone(proxima.i.startsAt!, tz)} con ${proxima.quien}.`
                  : 'No tienes ninguna entrevista con hora confirmada.'
              }
              to={`${base}/entrevistas`}
              enlace={proxima ? 'Ver detalles' : 'Ver agenda'}
            />
          </div>

          <GraficaOrigen candidates={candidates} campaigns={campaigns} />
        </>
      )}
    </div>
  )
}

/**
 * El saludo por la hora. Los cortes son los españoles y no los ingleses: aquí a
 * la una y media de la tarde se siguen dando los buenos días, y a las nueve de la
 * noche ya se dan las buenas noches.
 */
function saludoDe(hora: number): string {
  if (hora < 14) return 'Buenos días'
  if (hora < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

type Atencion = { porPuesto: { c: { id: string; title: string }; n: number }[]; total: number }

function textoAtencion(a: Atencion, pausados: number): string {
  if (a.total > 0) {
    const donde = a.porPuesto.length > 1 ? ` en ${plural(a.porPuesto.length, 'puesto', 'puestos')}` : ''
    return `${plural(a.total, 'candidato lleva', 'candidatos llevan')} más de ${STALE_DAYS} días esperando respuesta${donde}.`
  }
  if (pausados > 0)
    return `${plural(pausados, 'puesto pausado', 'puestos pausados')}: su enlace no acepta candidaturas y el proceso se sigue cobrando.`
  return 'Nadie lleva esperando y ningún puesto está pausado.'
}

function destinoAtencion(a: Atencion, pausados: { id: string }[], base: string): string | undefined {
  if (a.total > 0) return `${base}/puestos/${a.porPuesto[0].c.id}?estado=nuevo`
  if (pausados.length > 0) return `${base}/puestos/${pausados[0].id}`
  return undefined
}

/**
 * Una tarjeta de acción rápida. Tres piezas: qué es, qué pasa ahora mismo, y a
 * dónde vas. El pie repite la geometría del diseño (glifo de 32px a la izquierda,
 * el destino a la derecha) con un icono nuestro en vez del logo de relleno que
 * traía el mockup.
 *
 * SIN `to` LA TARJETA NO ES UN ENLACE, y no desaparece. Cuando no hay nada que
 * atender, una tarjeta que lleva a alguna parte sería una puerta pintada en la
 * pared; y quitarla dejaría la fila saltando entre dos y tres tarjetas según el
 * día, que es peor que una tarjeta tranquila diciendo que no hay nada.
 */
function AccionRapida({
  icono: Icono,
  titulo,
  texto,
  to,
  enlace,
}: {
  icono: typeof Clock
  titulo: string
  texto: string
  to?: string
  enlace?: string
}) {
  // Radio de tarjeta del sistema (10px), no los 20 del mockup: esta tarjeta vive
  // al lado de tablas, paneles y diálogos que van todos a 10, y un radio propio
  // aquí se lee como una pieza de otra pantalla.
  const caja =
    'flex h-full flex-col rounded-xl filo bg-white p-6 shadow-card max-sm:p-5'
  const cuerpo = (
    <>
      {/* El texto CRECE (`flex-1`) y el pie se queda pegado abajo. Las tres
          descripciones no miden lo mismo (una entrevista se cuenta en una línea y
          lo que pide atención en dos), así que sin esto el filo y su fila caían a
          alturas distintas en cada tarjeta y la fila entera se leía descosida. Va
          con `flex-1` en el texto y NO con `mt-auto` en el pie: `mt-auto` y el
          `mt-6` de abajo son la misma utilidad de Tailwind y no se resuelven por
          orden de escritura, que es el mismo tropiezo de `botonIcono()`. Así el
          `mt-6` sigue siendo el hueco MÍNIMO cuando el texto ya llena la tarjeta. */}
      <div className="flex-1">
        <p className="text-base font-bold text-slate-900">{titulo}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{texto}</p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:pt-4">
        <Icono className="size-5 shrink-0 text-slate-700" aria-hidden />
        {enlace && (
          <span className="flex min-w-0 items-center gap-1 text-[12px] font-semibold text-slate-500">
            <span className="truncate">{enlace}</span>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          </span>
        )}
      </div>
    </>
  )
  if (!to) return <div className={caja}>{cuerpo}</div>
  return (
    <Link
      to={to}
      className={`${caja} transition-colors duration-[var(--duration-control)] hover:bg-slate-50`}
    >
      {cuerpo}
    </Link>
  )
}

// --- La gráfica: por dónde entra la gente -----------------------------------

type Bucket = 'dia' | 'semana' | 'mes'
type Rango = { id: string; label: string; dias: number; bucket: Bucket }

/**
 * Los rangos son TRES y cada uno trae su cubo. No son un rango libre con dos
 * calendarios: el mockup dibujaba "Dec 27, 2023 - Jan 03, 2024" y elegir dos
 * fechas a mano es un control caro para una pregunta que casi siempre es "¿cómo
 * ha ido el último mes?". El cubo va con el rango porque son la misma decisión:
 * 365 puntos diarios en 900px no se leen, y 30 puntos mensuales no existen.
 */
const RANGOS: Rango[] = [
  { id: '30d', label: 'Últimos 30 días', dias: 30, bucket: 'dia' },
  { id: '3m', label: 'Últimos 3 meses', dias: 90, bucket: 'semana' },
  { id: '12m', label: 'Últimos 12 meses', dias: 365, bucket: 'mes' },
]

/** El valor de "todos los puestos". Vacío y no `null`: es un id que no existe. */
const TODOS = ''

function GraficaOrigen({ candidates, campaigns }: { candidates: Candidate[]; campaigns: Campaign[] }) {
  const [rango, setRango] = useState<Rango>(RANGOS[0])
  const [puesto, setPuesto] = useState<string>(TODOS)

  // Con un solo puesto no hay nada que elegir y el selector no se pinta: un
  // control que solo puede decir lo que ya se ve es un botón que no hace nada.
  const opcionesPuesto = useMemo(
    () => [{ id: TODOS, label: 'Todos los puestos' }, ...campaigns.map((c) => ({ id: c.id, label: c.title }))],
    [campaigns],
  )

  // Si el puesto elegido desaparece (se borra, o cambias de empresa), se vuelve a
  // Todos en vez de dejar la gráfica vacía sin decir por qué.
  const elegido = campaigns.some((c) => c.id === puesto) ? puesto : TODOS

  const datos = useMemo(
    () => construir(elegido === TODOS ? candidates : candidates.filter((c) => c.campaignId === elegido), rango),
    [candidates, rango, elegido],
  )

  return (
    <section className="mt-8 [@media(max-height:820px)]:mt-5">
      {/* El título vive FUERA de la tarjeta, igual que "Acciones rápidas" (Mario,
          ago 2026): los dos rotulan un bloque de la pantalla, y uno dentro y otro
          fuera dejaban la página con dos alturas de titular sin motivo. El
          SELECTOR, en cambio, se queda DENTRO y arriba del todo, como en el
          diseño: no rotula el bloque, gobierna lo que se pinta debajo, y fuera se
          leía como un control suelto flotando entre dos tarjetas. */}
      <h2 className="mb-4 text-base font-semibold text-slate-900">Por dónde entra la gente</h2>

      {datos.series.length === 0 ? (
        <p className="rounded-xl filo bg-white px-6 py-12 text-center text-[13px] text-slate-500 shadow-card">
          No ha entrado ninguna candidatura en este periodo.
        </p>
      ) : (
        <div className="rounded-xl filo bg-white p-6 shadow-card max-sm:p-5">
          {/* Una sola fila: las plataformas a la izquierda y el rango a la
              derecha (Mario, ago 2026). El selector no rotula nada, dice CON QUÉ
              VARA están medidas esas cifras, así que va en su misma línea y no
              en un renglón propio por encima, que lo dejaba suelto en el aire.
              Las cifras van a 20px y no a los 28 del mockup: el título de la
              pantalla va a 24, y un número de dentro no puede ganarle al nombre
              de la pantalla en la que está. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {datos.series.map((s) => (
                <div key={s.origen}>
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                    <span className={`size-2 shrink-0 rounded-full ${SOURCE_META[s.origen].punto}`} aria-hidden />
                    {SOURCE_META[s.origen].label}
                  </p>
                  <p className="mt-1 num text-xl font-bold text-slate-900">{miles(s.total)}</p>
                </div>
              ))}
            </div>
            {/* Dos cápsulas hermanas: con qué recorte y con qué vara. Primero el
                puesto y luego el periodo, que es como se lee la frase. */}
            <div className="flex flex-wrap items-center gap-2">
              {campaigns.length > 1 && (
                <SelectorPill
                  icono={Briefcase}
                  etiqueta="Puesto"
                  valor={elegido}
                  opciones={opcionesPuesto}
                  onChange={setPuesto}
                />
              )}
              <SelectorPill
                icono={Calendar}
                etiqueta="Periodo"
                valor={rango.id}
                opciones={RANGOS.map((r) => ({ id: r.id, label: r.label }))}
                onChange={(id) => setRango(RANGOS.find((r) => r.id === id) ?? RANGOS[0])}
              />
            </div>
          </div>

          <Lienzo datos={datos} rango={rango} />
        </div>
      )}
    </section>
  )
}

/**
 * UNA CÁPSULA QUE ELIGE, con su menú. La usan el puesto y el periodo, y por eso
 * es una pieza y no dos: dos cápsulas que empiezan iguales se separan al primer
 * retoque, que es la lección que este proyecto ya ha pagado varias veces.
 *
 * Es un `menuitemradio` de verdad: eliges uno de varios, no ejecutas un verbo.
 * Al elegir, el menú se cierra pero lo que queda escrito en la cápsula es el
 * estado en el que estás, que es el reverso exacto de un menú de acciones.
 */
function SelectorPill({
  icono: Icono,
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  icono: typeof Calendar
  /** Qué se elige, para quien no ve la cápsula. */
  etiqueta: string
  valor: string
  opciones: { id: string; label: string }[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cerrar = useCallback(() => setOpen(false), [])
  const actual = opciones.find((o) => o.id === valor) ?? opciones[0]

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) cerrar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrar()
      }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [open, cerrar])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${etiqueta}: ${actual?.label ?? ''}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 max-w-[240px] items-center gap-2 rounded-full filo bg-white px-3.5 text-[13px] font-semibold text-slate-800 transition-colors duration-[var(--duration-control)] pointer-coarse:h-11 hover:bg-slate-50"
      >
        <Icono className="size-3.5 shrink-0 text-slate-500" aria-hidden />
        <span className="min-w-0 truncate">{actual?.label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-500" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={etiqueta}
          className="absolute right-0 top-full z-20 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-xl filo bg-white p-1 shadow-pop"
        >
          {opciones.map((o) => {
            const marcado = o.id === actual?.id
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={marcado}
                onClick={() => {
                  onChange(o.id)
                  cerrar()
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-[var(--duration-control)] ${
                  marcado ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Check className={`size-4 shrink-0 ${marcado ? 'text-indigo-600' : 'text-transparent'}`} aria-hidden />
                <span className="min-w-0 truncate">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Serie = { origen: CandidateSource; valores: number[]; total: number }
type Datos = { cubos: { inicio: number; label: string }[]; series: Serie[]; techo: number; lineas: number[] }

/**
 * El lienzo. Un área por origen, DIBUJADAS UNA ENCIMA DE OTRA y no apiladas: lo
 * que se pregunta aquí es cuánto trae cada canal, no cuánto suman, y en una pila
 * la altura de una banda depende de la que tenga debajo. La más grande se pinta
 * primero para que las pequeñas no queden tapadas.
 *
 * El ancho se MIDE (no `preserveAspectRatio="none"`, que deforma el texto y los
 * puntos): así las coordenadas del SVG son píxeles de verdad.
 */
function Lienzo({ datos, rango }: { datos: Datos; rango: Rango }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  // EL ALTO LO PONE LO QUE SOBRA DE PANTALLA, no un número fijo (Mario, ago
  // 2026: "no puede ocupar más que el viewport"). La gráfica es lo último de la
  // pantalla, así que su hueco es exactamente el que dejan el saludo, las
  // tarjetas y su propia cabecera; con un alto fijo, la misma página cabe en un
  // monitor y obliga a desplazar en un portátil.
  //
  // No hay bucle de medida aunque se mida dentro de un ResizeObserver: lo que se
  // lee es la POSICIÓN del lienzo (dónde empieza), y eso no depende de su alto,
  // que es lo único que esto cambia.
  const [alto, setAlto] = useState(260)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      setW(Math.max(280, el.clientWidth))
      const scroller = el.closest('main')
      if (!scroller) return
      const arriba =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      // Lo que hay que dejar libre por debajo: el relleno de la tarjeta más el de
      // la página. Si cambian esos dos, cambia este número.
      const libre = scroller.clientHeight - arriba - 52
      // Suelo y techo: por debajo de 200 una serie de treinta días deja de leerse,
      // y por encima de 340 el lienzo se estira sin decir nada más.
      setAlto(Math.round(Math.max(200, Math.min(340, libre))))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    const scroller = el.closest('main')
    if (scroller) ro.observe(scroller)
    return () => ro.disconnect()
  }, [])

  const n = datos.cubos.length
  const H = alto
  const padL = 36
  const padR = 10
  const padTop = 14
  const padBottom = 24
  const innerH = H - padTop - padBottom
  const x = (i: number) => (n === 1 ? padL + (w - padL - padR) / 2 : padL + (i / (n - 1)) * (w - padL - padR))
  const y = (v: number) => padTop + innerH - (v / datos.techo) * innerH
  const baseY = padTop + innerH

  // Etiquetas del eje X: siempre la primera y la última, y hasta seis en total.
  const k = Math.min(n, w < 420 ? 3 : 6)
  const idx = [...new Set(Array.from({ length: k }, (_, j) => (k === 1 ? 0 : Math.round((j * (n - 1)) / (k - 1)))))]

  const resumen = datos.series
    .map((s) => `${SOURCE_META[s.origen].label} ${s.total}`)
    .join(', ')

  return (
    <div ref={ref} className="mt-4">
      <svg
        viewBox={`0 0 ${w} ${H}`}
        height={H}
        className="w-full"
        role="img"
        aria-label={`Candidaturas por origen, ${rango.label.toLowerCase()}: ${resumen}.`}
      >
        {/* Rejilla. Las cifras van en slate-500 y no en 400: son texto con
            significado y su suelo de contraste es 4,5:1. */}
        {datos.lineas.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={w - padR} y2={y(v)} className="stroke-slate-100" />
            <text x={padL - 8} y={y(v) + 3.5} textAnchor="end" className="num fill-slate-500 text-[10px]">
              {v}
            </text>
          </g>
        ))}
        <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} className="stroke-slate-200" />

        {datos.series.map((s) => {
          const pts = s.valores.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
          const linea = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ')
          const area = `${linea} L${x(n - 1).toFixed(1)} ${baseY} L${x(0).toFixed(1)} ${baseY} Z`
          return (
            <g key={s.origen}>
              <path d={area} className={SOURCE_META[s.origen].area} />
              <path
                d={linea}
                fill="none"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className={SOURCE_META[s.origen].trazo}
              />
            </g>
          )
        })}

        {idx.map((i, j) => (
          <text
            key={datos.cubos[i].inicio}
            x={x(i)}
            y={H - 6}
            textAnchor={j === 0 ? 'start' : j === idx.length - 1 ? 'end' : 'middle'}
            className="fill-slate-500 text-[11px]"
          >
            {datos.cubos[i].label}
          </text>
        ))}
      </svg>
    </div>
  )
}

// --- Los datos ---------------------------------------------------------------

/** El principio del cubo al que cae un instante, en hora LOCAL. */
function inicioCubo(t: number, bucket: Bucket): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  if (bucket === 'semana') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // lunes
  if (bucket === 'mes') d.setDate(1)
  return d.getTime()
}

function etiquetaCubo(t: number, bucket: Bucket): string {
  const d = new Date(t)
  if (bucket === 'mes')
    return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).replace(/\./g, '')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace(/\./g, '')
}

/**
 * Los cubos del rango, avanzando por CALENDARIO (`setDate`/`setMonth`) y no
 * sumando milisegundos: así el cambio de hora de octubre no corre un día entero
 * y los meses no duran todos 30.
 */
function cubosDe(rango: Rango, ahora: number): number[] {
  const desde = inicioCubo(ahora - (rango.dias - 1) * 86400000, rango.bucket)
  const hasta = inicioCubo(ahora, rango.bucket)
  const out: number[] = []
  const d = new Date(desde)
  while (d.getTime() <= hasta) {
    out.push(d.getTime())
    if (rango.bucket === 'dia') d.setDate(d.getDate() + 1)
    else if (rango.bucket === 'semana') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
  }
  return out
}

/**
 * Una escala que se lea: pasos de 1, 2, 5 o 10 (por su magnitud) y unas cuatro
 * líneas. Un techo pegado al máximo real deja la línea de arriba rozando el
 * trazo, y una rejilla con pasos de 37 no se lee de un vistazo.
 */
function escalaBonita(max: number): { techo: number; lineas: number[] } {
  const bruto = Math.max(1, max)
  const crudo = bruto / 4
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)))
  const paso = Math.max(1, ([1, 2, 5, 10].map((m) => m * mag).find((p) => p >= crudo) ?? 10 * mag))
  const techo = Math.ceil(bruto / paso) * paso
  const lineas: number[] = []
  for (let v = paso; v <= techo + 1e-9; v += paso) lineas.push(Math.round(v))
  return { techo, lineas }
}

function construir(candidates: Candidate[], rango: Rango): Datos {
  const ahora = Date.now()
  const inicios = cubosDe(rango, ahora)
  const indice = new Map(inicios.map((t, i) => [t, i]))

  const acumulado = new Map<CandidateSource, number[]>()
  for (const c of candidates) {
    const t = Date.parse(c.submittedAt)
    if (Number.isNaN(t)) continue
    const i = indice.get(inicioCubo(t, rango.bucket))
    if (i === undefined) continue
    let fila = acumulado.get(c.source)
    if (!fila) {
      fila = new Array(inicios.length).fill(0)
      acumulado.set(c.source, fila)
    }
    fila[i]++
  }

  const series: Serie[] = [...acumulado.entries()]
    .map(([origen, valores]) => ({ origen, valores, total: valores.reduce((s, v) => s + v, 0) }))
    .filter((s) => s.total > 0)
    // La más grande primero: se pinta detrás y no tapa a las pequeñas.
    .sort((a, b) => b.total - a.total)

  const max = series.reduce((m, s) => Math.max(m, ...s.valores), 0)
  const { techo, lineas } = escalaBonita(max)

  return {
    cubos: inicios.map((t) => ({ inicio: t, label: etiquetaCubo(t, rango.bucket) })),
    series,
    techo,
    lineas,
  }
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <IconoVacio Icon={Building2} />
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  )
}

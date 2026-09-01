import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CalendarDays, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, List, MapPin, Phone, Video } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useProfiles } from '../lib/profiles'
import { WHATSAPP_LISTO } from '../lib/whatsapp'
import { ALTO_FRANJA, BTN_SECONDARY_FRANJA } from '../lib/buttons'
import { Avatar } from '../components/ui/Avatar'
import { useToast } from '../components/ui/Toast'
import { AgendaGrid } from '../components/AgendaGrid'
import { MiniMes } from '../components/MiniMes'
import { CandidateModal } from './CandidateModal'
import { groupByDay, splitInterviews } from '../lib/interviews'
import { claveDeHoy, partesClave, rotuloRango, semanaDe, sumarDias } from '../lib/agenda'
import { INTERVIEW_STATUS_META, type Interview } from '../lib/types'
import { PageHeader } from '../components/ui/PageHeader'
import {
  candidateName, clockTimeInZone, dayKeyInZone, fullDateTimeInZone, memberAvatarTone, minutesInZone,
  personLabel, plural, type MemberTone,
} from '../lib/format'

// Agenda de entrevistas de toda la empresa: a quién ves, cuándo y dónde, y su
// ficha a un clic.
//
// Dos maneras de leer lo mismo, y las dos hacen falta. El CALENDARIO contesta
// "cómo tengo el jueves": dónde queda hueco, si dos se pisan, cuánto aire hay
// entre una y otra, algo que una lista no puede enseñar porque el tiempo vacío
// no ocupa ninguna fila. La LISTA contesta "qué tengo por delante" sin navegar
// semana a semana, y es la que aguanta cuando la próxima cita cae en octubre.
// Seguimos sin ser un calendario completo: aquí no se arrastra, ni se crea una
// cita desde un hueco, ni se ven los eventos ajenos del anfitrión. Eso es
// competir con Google para hacerlo peor.
/* LO QUE MIDE EL RAÍL, Y CUÁNDO CABE. Escrito como CUENTA y no como número
   redondo, para que el día que cambie una pieza se recalcule el resto en vez de
   quedarse un umbral heredado que ya no significa nada. */
const RAIL_ANCHO = 256 // gemelo del `_256px` escrito en la clase de la rejilla
/** La regla de horas de la rejilla (`w-14`). */
const REGLA_HORAS = 56
/**
 * El suelo de una columna de día. Por debajo de esto un nombre normal empieza a
 * salir cortado: el bloque le da a la línea del nombre el ancho de la columna
 * menos 16 de relleno, y un "Rafael Molina" a 12,5px semibold mide 85.
 */
const COLUMNA_MINIMA = 110
/** Lo que tiene que medir la caja de CONTENIDO para que quepan los dos (con el
 *  hueco de 16 que los separa, el `gap-4` de la rejilla). */
const RAIL_MINIMO = COLUMNA_MINIMA * 7 + REGLA_HORAS + RAIL_ANCHO + 16

/** Cómo se presenta la agenda: el calendario o la lista de lo que viene. */
type Modo = 'calendario' | 'lista'
/** Qué tramo enseña el calendario. Solo significa algo en modo calendario. */
type Intervalo = 'semana' | 'dia'
/** Lo que de verdad se pinta, derivado de los dos: una sola pieza, como en la
 *  ficha del candidato, para que no puedan contradecirse. */
type Vista = Intervalo | 'lista'

// El envoltorio sin hooks se conserva aunque el corte por plan haya muerto con
// el pago por proceso (todo incluido, ago 2026): la agenda vive en un
// componente aparte y cualquier corte futuro se escribiría aquí, donde no hay
// un solo hook que pueda quedar por debajo de un `return` temprano (ver el
// guardián de los hooks en src/lib/hooks.test.ts).
export function Entrevistas() {
  const { company } = useAuth()
  const demo = company?.id === 'demo'
  // `demo` viaja como prop: es la misma decisión que abre la puerta, así que se
  // toma una vez y no se recalcula dentro.
  return <Agenda demo={demo} />
}

function Agenda({ demo }: { demo: boolean }) {
  const { interviews, candidates, campaigns, members, loading, conversationFor, getCampaign, restoreCandidate } = useStore()
  const toast = useToast()
  const profiles = useProfiles()
  const [params, setParams] = useSearchParams()
  const compacto = useCompacto()

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  // El reloj se lee en estado, no en el render: pintar Date.now() directamente
  // es impuro y la línea de la hora actual se quedaría clavada donde se montó.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60000)
    return () => window.clearInterval(t)
  }, [])
  const hoy = claveDeHoy(tz, ahora)
  const ahoraMin = useMemo(() => minutesInZone(new Date(ahora).toISOString(), tz), [ahora, tz])
  const [cursor, setCursor] = useState(hoy)

  // La ficha del candidato se abre AQUÍ (ago 2026). Antes cada cita era un
  // enlace al panel de su puesto: abría la misma ficha, pero de paso te cambiaba
  // de pantalla y te dejaba en otra pestaña, con la semana que estabas mirando
  // perdida. El pop-up ya se sabe pintar solo en cualquier pantalla (la Bandeja
  // hace lo mismo), así que la agenda se queda donde está.
  const [abierto, setAbierto] = useState<string | null>(null)

  // Filtro por anfitrión. Solo existe cuando hay más de una agenda: en una
  // empresa de una persona no hay nada que separar y sería un control vacío.
  //
  // EN MÓVIL NO SE PINTA, Y POR LO TANTO NO FILTRA (Mario, ago 2026). La segunda
  // mitad de la frase es la que importa: **un recorte invisible que no se puede
  // deshacer no es un filtro, es una lista mutilada**, y es exactamente lo que
  // pasaría al estrechar la ventana con "solo las de Laura" puesto. Es la misma
  // regla que ya gobierna el conmutador Activos/Rechazados del panel de un
  // puesto, que tampoco se pinta ni filtra en un teléfono.
  //
  // El estado se conserva a propósito: al volver a un ancho grande, el filtro que
  // habías puesto sigue ahí. Lo que se apaga es su EFECTO, no tu elección.
  const [soloDeCrudo, setSoloDe] = useState<string | null>(null)
  const soloDe = compacto ? null : soloDeCrudo
  const anfitriones = useMemo(() => {
    const ids = [...new Set(interviews.map((i) => i.hostUserId))]
    return ids.map((id) => {
      const email = members.find((m) => m.userId === id)?.email ?? null
      return {
        id,
        nombre: profiles.nameFor(id, email) || personLabel(email),
        email,
        foto: profiles.avatarFor(id),
      }
    })
  }, [interviews, members, profiles])
  const visibles = useMemo(
    () => (soloDe ? interviews.filter((i) => i.hostUserId === soloDe) : interviews),
    [interviews, soloDe],
  )

  const buckets = useMemo(() => splitInterviews(visibles), [visibles])

  // El agente se aparta cuando hay algo que solo puede decidir una persona (una
  // pregunta sobre el puesto, un audio, un número que no recibe WhatsApp). Se
  // dice en la propia cita, en la rejilla y en el raíl: no mandamos un correo por
  // cada duda a propósito, así que la pantalla es el único aviso.
  const atencionDe = (candidateId: string): string | null => {
    const c = conversationFor(candidateId)
    return c && c.agentState === 'necesita_intervencion'
      ? c.attentionReason ?? 'Hay algo que no podemos resolver solos.'
      : null
  }

  // DOS EJES, DOS CONTROLES, DOS PARÁMETROS (Mario, ago 2026). Antes los tres
  // valores compartían un grupo segmentado, y eso ponía en la misma fila una
  // pregunta de PRESENTACIÓN ("calendario o lista") con una de ENCUADRE ("qué
  // tramo del calendario"), que solo significa algo dentro de la primera. Ahora
  // el modo es el conmutador de iconos de la casa (el mismo que Tabla/Tablero en
  // el panel de un puesto) y el tramo es un desplegable que solo existe en
  // calendario, porque en la lista no encuadra nada.
  //
  // Se quedan como dos parámetros y no como uno de tres valores para que elegir
  // "Día", irse a la lista y volver te devuelva al día: con un solo valor, el
  // tramo se pierde al pasar por la lista.
  const rawModo = params.get('v')
  // SIN PARÁMETRO NO ES "calendario", ES "no lo has dicho". En escritorio manda
  // el calendario, y el modo elegido se escribe SIEMPRE, también cuando es el de
  // fábrica: si "calendario" fuera la ausencia del parámetro, un enlace
  // compartido significaría una cosa en un portátil y otra en un móvil.
  // (`?v=dia` es de la versión anterior, cuando el parámetro llevaba los tres
  // valores; se sigue leyendo para no romper un enlace ya compartido.)
  const modoGuardado: Modo =
    rawModo === 'lista' ? 'lista' : 'calendario'
  const intervaloGuardado: Intervalo = params.get('i') === 'dia' || rawModo === 'dia' ? 'dia' : 'semana'
  // EN MÓVIL HAY UNA SOLA VISTA: el mes con el día debajo (Mario, ago 2026: "el
  // nuevo layout es el único en móvil"). El conmutador no se pinta, así que
  // tampoco se ofrece la lista: un enlace con `?v=lista` abierto en un teléfono
  // aterriza en el calendario, y el parámetro se conserva intacto para cuando se
  // abra en una pantalla ancha.
  //
  // Siete columnas no caben en 375px, así que allí el calendario solo puede
  // enseñar un día; el selector de tramo tampoco se ofrece, porque no hay nada
  // que elegir y un control con una sola salida es un control que miente.
  const intervalo: Intervalo = compacto ? 'dia' : intervaloGuardado
  const modo: Modo = compacto ? 'calendario' : modoGuardado
  const vista: Vista = modo === 'lista' ? 'lista' : intervalo

  const cambiar = (next: { modo?: Modo; intervalo?: Intervalo }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('v', next.modo ?? modoGuardado)
        const i = next.intervalo ?? intervaloGuardado
        if (i === 'semana') p.delete('i')
        else p.set('i', i)
        return p
      },
      { replace: true },
    )

  const dias = vista === 'dia' ? [cursor] : semanaDe(cursor)
  const salto = vista === 'dia' ? 1 : 7
  // El día civil es el de SU zona, igual que en la rejilla: si no, una cita de
  // Canarias a las 23:30 contaría en el día siguiente al mirarla desde Madrid.
  const dentro = (i: Interview) => {
    if (!i.startsAt) return false
    const k = dayKeyInZone(i.startsAt, i.timezone)
    return k >= dias[0] && k <= dias[dias.length - 1]
  }
  const enTramo = visibles.filter(dentro)

  // CUÁNTAS CITAS TIENE CADA DÍA, para los puntos del mes en pequeño. Se calcula
  // aquí y no dentro de la pieza porque el día civil es el de SU zona (igual que
  // en la rejilla): una cita de Canarias a las 23:30 contaría en el día
  // siguiente si se mirara desde Madrid.
  const porDia = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of visibles) {
      if (!i.startsAt) continue
      const k = dayKeyInZone(i.startsAt, i.timezone)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [visibles])

  // EL RAÍL SOLO EXISTE DONDE NO LE CUESTA LA SEMANA A LA REJILLA, y eso se
  // MIDE, no se supone con una media query.
  //
  // Se probó con `(min-width: 1280px)` y el precio se vio en pantalla: en una
  // ventana de 1400 con el menú desplegado, la columna de un día caía de 129px a
  // 101 y dos de los tres nombres de la semana pasaban a salir cortados. El raíl
  // devuelve los nombres de UN día y se los quita a los siete: mal negocio.
  //
  // Por debajo de su suelo no sale a cuenta y no se monta (ver `RAIL_MINIMO`,
  // que está escrito como la cuenta que es).
  //
  // OJO CON LO QUE SE MIDE: `contentRect` es la caja de CONTENIDO, o sea sin el
  // relleno lateral de la página (64 en escritorio). Con el umbral puesto contra
  // el ancho de fuera, el raíl no aparecía nunca ni en una ventana de 1560.
  //
  // Y se mide el CONTENEDOR, no la ventana, porque el ancho útil depende también
  // de si el menú lateral está contraído: en una ventana de 1400, con el menú
  // estrecho sobran los 1212 y con el menú ancho no. Preguntando por la ventana
  // habría que adivinar el estado del lateral; preguntando por la caja, no hay
  // nada que adivinar.
  const contenedor = useRef<HTMLDivElement>(null)
  const [anchoUtil, setAnchoUtil] = useState(0)
  useLayoutEffect(() => {
    const el = contenedor.current
    if (!el) return
    // En un `useLayoutEffect`: el `setState` se resuelve ANTES de pintar, así que
    // el raíl no se ve aparecer un fotograma después de la rejilla.
    const ro = new ResizeObserver(([e]) => setAnchoUtil(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const hayRail = anchoUtil >= RAIL_MINIMO
  // Las citas del día que estás señalando, que es lo que el raíl detalla.
  const delDia = useMemo(
    () =>
      visibles
        .filter((i) => i.startsAt && dayKeyInZone(i.startsAt, i.timezone) === cursor)
        .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '')),
    [visibles, cursor],
  )
  const nombreDe = (i: Interview) => {
    const c = candidates.find((x) => x.id === i.candidateId)
    return c ? candidateName(c) : 'Candidato'
  }
  const puestoDe = (i: Interview) => campaigns.find((c) => c.id === i.campaignId)?.title ?? 'Puesto'
  const nombreDelFiltro = anfitriones.find((a) => a.id === soloDe)?.nombre ?? ''

  // EL BLOQUE DE UNA CITA SE TIÑE DEL COLOR DE SU ANFITRIÓN (Mario, ago 2026).
  // En una semana con tres agendas encima, lo primero que se pregunta al mirar
  // la rejilla no es en qué estado está cada cita, es cuáles son MÍAS; y eso solo
  // se podía contestar leyendo el filtro de arriba y volviendo a bajar.
  //
  // SALE DEL MISMO SITIO QUE SU CARA (`memberAvatarTone`, con la misma semilla),
  // y eso no es un detalle de implementación: el filtro de anfitrión pinta esas
  // caras justo encima de la rejilla, así que LAS CARAS SON LA LEYENDA. Con una
  // paleta propia habría que aprenderse dos códigos para las mismas personas, y
  // se separarían al primer retoque.
  //
  // CON UNA SOLA AGENDA NO SE TIÑE. No hay nada que distinguir, así que el color
  // no diría de quién es sino que sería adorno, y encima le quitaría al bloque el
  // relleno con el que hoy dice su estado. Es la misma regla que ya decide que el
  // filtro de anfitrión no exista en una empresa de una persona.
  const tonos = useMemo(() => {
    if (anfitriones.length < 2) return null
    return new Map<string, MemberTone>(anfitriones.map((a) => [a.id, memberAvatarTone(a.email ?? a.id)]))
  }, [anfitriones])
  const tonoDe = (i: Interview) => tonos?.get(i.hostUserId) ?? null

  // La ficha abierta y su puesto. El puesto sale del propio candidato, como en
  // la Bandeja: la agenda mezcla puestos, y así la cabecera del pop-up acompaña
  // al pasar de uno a otro con las flechas.
  const candidatoAbierto = abierto ? candidates.find((c) => c.id === abierto) ?? null : null
  const puestoAbierto = candidatoAbierto ? getCampaign(candidatoAbierto.campaignId) ?? null : null
  // Las flechas recorren lo que estás viendo, en el mismo orden: las citas del
  // tramo si miras el calendario, y las que tienes por delante si miras la lista.
  const hermanos = useMemo(() => {
    const orden = vista === 'lista' ? buckets.proximas : enTramo
    return orden
      .map((i) => candidates.find((c) => c.id === i.candidateId))
      .filter((c): c is NonNullable<typeof c> => !!c)
  }, [vista, buckets.proximas, enTramo, candidates])

  return (
    <div ref={contenedor} className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      <PageHeader
        titulo="Entrevistas"
        sub="Todas tus citas con candidatos, del puesto que sean."
        acciones={
          !compacto && anfitriones.length > 1 ? (
            <FiltroAnfitrion lista={anfitriones} valor={soloDe} onChange={setSoloDe} />
          ) : undefined
        }
      />

      {/* AQUÍ HUBO TRES PESTAÑAS: Agenda, En marcha y Pasadas (Mario las retiró,
          ago 2026). La pantalla es la AGENDA, y el calendario ya contesta lo que
          contestaban las otras dos: las pasadas están donde siempre estuvieron,
          en su semana, a un par de flechas o a un clic en el mes de al lado.
          Con una sola sección, una fila de pestañas no navega a ninguna parte:
          es el título repetido, que es el mismo motivo por el que se retiraron
          las de Solicitudes / Tienda / Publicaciones en el panel de un puesto.

          LO QUE SE PAGA, Y HAY QUE SABERLO EL DÍA QUE SE ENCIENDA WHATSAPP: "En
          marcha" eran las citas SIN FECHA todavía (se está negociando la hora
          con el candidato), y ésas no pueden salir en una rejilla que coloca por
          hora. Hoy no se pierde nada porque con `WHATSAPP_LISTO` en false no se
          crea ninguna: la negociación es justo lo que ese canal hace. Cuando se
          encienda, esa lista necesita casa otra vez, y su sitio natural es un
          aviso DENTRO de esta pantalla (no una pestaña), porque lo que pide es
          atención, no navegación. */}
      {loading ? (
        <ListaSkeleton />
      ) : (
          // Sin ninguna cita NO se esconde el calendario. La semana vacía es la
          // respuesta a "cómo tengo la semana" y enseña dónde van a aparecer las
          // citas; una tarjeta de cartón en su sitio no dice ninguna de las dos.
          <>
            {/* Un solo ancho en toda la pantalla, el del calendario: al alternar
                entre Semana y Lista no se puede mover el borde de sitio. */}
            {/* EL AIRE, MEDIDO, y hubo que rehacerlo al quitar las pestañas: se
                quedó en 25 por encima y 13 por debajo, o sea la barra colgando
                del título en vez de centrada en su hueco. Con 28 abajo el blanco
                sale 27 y 29 (la caja de la barra acaba 1px por debajo de sus
                controles), que es lo mismo que da la franja de filtros del panel
                de un puesto y de Candidatos: al ir de una pantalla a otra, la
                fila de herramientas no puede cambiar de sitio. */}
            {/* LA FRANJA DE HERRAMIENTAS NO EXISTE EN MÓVIL (Mario, ago 2026).
                Allí no le queda nada dentro: el conmutador se fue (una sola
                vista), el selector de tramo también (un solo tramo), el rótulo
                del rango lo escribe la cabecera de la lista y las flechas de día
                las sustituye tocar un día en el mes. Lo único que quedaba era
                "Hoy", y una franja de 40px con un botón suelto y un hueco es
                chrome que se paga en la pantalla más apretada.

                "Hoy" NO se pierde, se muda a la cabecera del mes, que es donde
                cualquier calendario lo pone: pegado a las flechas que pasan
                páginas. El filtro de anfitrión se queda donde siempre estuvo, en
                la cabecera de la pantalla. */}
            {!compacto && (
              <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
                {vista === 'lista' ? (
                  <p className="text-[13px] text-slate-500">
                    {buckets.proximas.length > 0
                      ? `${plural(buckets.proximas.length, 'entrevista', 'entrevistas')} por delante`
                      : 'Nada por delante'}
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Grupo segmentado: no es un botón, es la CARCASA de dos. Lleva la
                        misma pintura de hairline que el secundario (y su `ring-inset`,
                        o el grupo se vería 2px más ancho que el botón "Hoy" de al lado).
                        Llevaba `shadow-control` y `ring-slate-300/80`, que es la pintura
                        del secundario de ANTES del botón plano (ago 2026): el anillo subió
                        a `slate-200` y la sombra de contacto se retiró entera. Aquí se
                        notaba porque en esta misma fila hay un `BTN_SECONDARY_SM` de
                        verdad, o sea dos lenguajes en pareja.
                        `overflow-clip` y no `hidden`: recorta igual con el radio (los dos
                        hijos son cajas cuadradas que llegan al filo) pero no convierte la
                        carcasa en contenedor de scroll. */}
                    {/* `filo` y no `ring-1 ring-inset`: es la misma superficie con radio que el
                        conmutador que tiene 8px a la derecha, y con dos vocabularios en la misma
                        fila una corregía el antialias de la esquina y la otra no. `filo` es
                        `border`, ocupa hacia dentro con `border-box`, así que la carcasa sigue
                        midiendo sus 32px contra el botón de al lado. */}
                    <div className={`flex items-center overflow-clip rounded-lg filo bg-white ${ALTO_FRANJA}`}>
                      <button
                        type="button"
                        onClick={() => setCursor((c) => sumarDias(c, -salto))}
                        aria-label={vista === 'dia' ? 'Día anterior' : 'Semana anterior'}
                        className="grid h-full w-10 place-items-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 pointer-coarse:w-11"
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </button>
                      <span className="h-4 w-px bg-slate-200" aria-hidden />
                      <button
                        type="button"
                        onClick={() => setCursor((c) => sumarDias(c, salto))}
                        aria-label={vista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
                        className="grid h-full w-10 place-items-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 pointer-coarse:w-11"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCursor(hoy)}
                      disabled={dias.includes(hoy)}
                      className={`${BTN_SECONDARY_FRANJA} disabled:pointer-events-none disabled:opacity-40`}
                    >
                      Hoy
                    </button>
                    <h2 className="ml-1 truncate text-[15px] font-semibold text-slate-900">
                      {rotuloRango(dias, hoy)}
                    </h2>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* EL TRAMO SOLO EXISTE EN CALENDARIO (Mario, ago 2026): en la
                      lista no encuadra nada, y un control que no gobierna nada es
                      la misma promesa falsa que un ajuste que no apaga nada. Va a
                      la IZQUIERDA del conmutador porque es lo que refina lo que el
                      conmutador acaba de elegir, y el conmutador cierra la fila
                      como en el panel de un puesto.
                      En móvil no se ofrece: allí la semana no cabe (siete columnas
                      en 375px) y el único tramo posible es el día. */}
                  {modo === 'calendario' && !compacto && (
                    <SelectorIntervalo valor={intervaloGuardado} onChange={(i) => cambiar({ intervalo: i })} />
                  )}
                  {/* EL CONMUTADOR NO EXISTE EN MÓVIL, y por eso esta franja
                      entera es de escritorio: allí hay una sola vista, así que un
                      control de dos posiciones con una sola posible es el mismo
                      botón que miente que el selector de tramo.

                      LO QUE SE PAGA: en un teléfono se pierde la lista de "qué
                      tengo por delante", que recorre semanas de una tirada. Lo
                      sustituye el mes con sus puntos, que dice DÓNDE hay algo y
                      lleva allí de un toque; lo que ya no se hace de un vistazo es
                      leer diez citas seguidas de tres semanas distintas. */}
                  <ConmutadorVista modo={modo} onChange={(m) => cambiar({ modo: m })} />
                </div>
              </div>
            )}

            {vista === 'lista' ? (
              buckets.proximas.length === 0 ? (
                <Vacio filtrado={!!soloDe} />
              ) : (
                <PorDias
                  lista={buckets.proximas}
                  nombreDe={nombreDe}
                  puestoDe={puestoDe}
                  atencionDe={atencionDe}
                  onAbrir={setAbierto}
                />
              )
            ) : (
              <>
                {/* Solo el vacío de verdad: sin NINGUNA entrevista, esto es lo
                    único que cuenta dónde se cuadra la primera. El aviso por
                    tramo ("ninguna esta semana", con sus saltos a la siguiente)
                    se quitó a propósito (Mario, ago 2026): aparecía y
                    desaparecía al pasar de semana, empujando la rejilla hacia
                    abajo cada vez, y eso costaba más que lo que ahorraba. La
                    semana vacía ya se ve vacía. */}
                {/* LA REJILLA Y SU RAÍL (referencia que dio Mario, ago 2026).
                    A la izquierda la FORMA de la semana; a la derecha el mes en
                    pequeño (para saltar a cualquier día y ver dónde hay carga) y
                    el DETALLE del día que señalas, que es lo que una columna de
                    123px no puede enseñar entero.

                    Se MONTA o no se monta, nunca se esconde con `hidden`: dentro
                    hay botones de día y de cita, y ocultos seguirían en el
                    tabulador y en el lector, con las mismas citas dos veces. Es
                    la regla que ya obliga a montar el raíl de la ficha. */}
                {/* El ancho va ESCRITO (`_256px`) y no interpolado desde `RAIL_ANCHO`:
                    Tailwind busca nombres de clase COMPLETOS en el código y una
                    clase compuesta desde una variable no la genera nunca. La
                    constante existe para la CUENTA de `RAIL_MINIMO`; si cambia
                    una, cambia la otra. */}
                {/* EN MÓVIL EL CALENDARIO ES EL MES Y EL DÍA DEBAJO (referencia
                    de Mario, ago 2026), no la rejilla de horas de un día.
                    La rejilla vertical en un teléfono enseña unas pocas horas y
                    obliga a desplazarse para ver una jornada; el mes contesta de
                    un vistazo en qué días hay algo, lleva a cualquiera de ellos
                    con un toque y la lista de debajo cuenta ese día entero.
                    Lo que se paga, y se dice: se pierde la FORMA del día (los
                    huecos, dos citas pegadas, la línea de "ahora"), que es lo que
                    la rejilla hace bien. En escritorio no cambia nada.
                    No hay pieza nueva: es el mismo `MiniMes` del raíl a otra
                    talla y la misma `Fila` de la lista de "por delante". */}
                {/* DÓNDE SE CUADRA LA PRIMERA: fuera de las dos ramas, porque
                    es la misma frase en las dos. Metido solo en la de escritorio,
                    un móvil sin ninguna cita se quedaba con "hoy no tienes
                    ninguna" y sin decir dónde se crea, que es justo lo único que
                    hace falta saber cuando no hay nada. */}
                {visibles.length === 0 && (
                  <div className="mb-3 rounded-xl filo bg-white px-3.5 py-2.5 text-[13px] text-slate-500 shadow-card">
                    {soloDe
                      ? `${nombreDelFiltro} todavía no tiene ninguna entrevista.`
                      : WHATSAPP_LISTO
                        ? 'Todavía no hay ninguna entrevista. Las cuadras desde la ficha de un candidato, con "Invitar a entrevista".'
                        : 'Todavía no hay ninguna entrevista. Las cuadras desde la ficha de un candidato, con "Agendar entrevista".'}
                  </div>
                )}
                {compacto ? (
                  <div className="space-y-4">
                    <MiniMes
                      cursor={cursor}
                      dias={dias}
                      hoy={hoy}
                      porDia={porDia}
                      onDia={setCursor}
                      onHoy={{ alPulsar: () => setCursor(hoy), apagado: dias.includes(hoy) }}
                      grande
                    />
                    <DiaDelRail
                      ancho
                      dia={cursor}
                      hoy={hoy}
                      lista={delDia}
                      nombreDe={nombreDe}
                      puestoDe={puestoDe}
                      tonoDe={tonoDe}
                      atencionDe={atencionDe}
                      onAbrir={setAbierto}
                    />
                  </div>
                ) : (
                <div className={hayRail ? 'grid grid-cols-[minmax(0,1fr)_256px] items-start gap-4' : ''}>
                  <div className="min-w-0">
                    <AgendaGrid
                      dias={dias}
                      interviews={visibles}
                      hoy={hoy}
                      ahoraMin={ahoraMin}
                      nombreDe={nombreDe}
                      puestoDe={puestoDe}
                      atencionDe={atencionDe}
                      tonoDe={tonoDe}
                      onDia={(clave) => {
                        setCursor(clave)
                        cambiar({ intervalo: 'dia' })
                      }}
                      onAbrir={setAbierto}
                    />
                  </div>

                  {hayRail && (
                    <aside className="flex flex-col gap-4">
                      <MiniMes cursor={cursor} dias={dias} hoy={hoy} porDia={porDia} onDia={setCursor} />
                      {/* El detalle del día SOLO en vista de semana: en la de un
                          día la rejilla de al lado ya ES ese detalle, y a lo
                          ancho de una columna entera lo cuenta mejor. Un panel
                          que repite lo que tienes al lado es una lista de más. */}
                      {vista === 'semana' && (
                        <DiaDelRail
                          dia={cursor}
                          hoy={hoy}
                          lista={delDia}
                          nombreDe={nombreDe}
                          puestoDe={puestoDe}
                          tonoDe={tonoDe}
                          atencionDe={atencionDe}
                          onAbrir={setAbierto}
                        />
                      )}
                    </aside>
                  )}
                </div>
                )}
              </>
            )}
          </>
      )}

      {puestoAbierto && (
        <CandidateModal
          campaign={puestoAbierto}
          candidate={candidatoAbierto}
          maskPhone={demo}
          onClose={() => setAbierto(null)}
          onDeleted={(c) =>
            toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
          }
          siblings={hermanos}
          onNavigate={setAbierto}
        />
      )}
    </div>
  )
}

/**
 * EL DÍA QUE SEÑALAS, DETALLADO (raíl de la agenda, ago 2026).
 *
 * No es la vista de Lista con otro nombre y no compite con ella: aquella
 * contesta "qué tengo por delante" y llega hasta octubre; esto contesta "quién
 * viene ESE día", que es justo lo que una columna de 123px no puede enseñar
 * entera. Es el reparto de la referencia: la rejilla da la FORMA de la semana
 * (dónde hay hueco, qué se pisa) y el raíl da los NOMBRES.
 *
 * El día lo manda el cursor, no "hoy" a secas: mirando la semana que viene, un
 * panel clavado en hoy no cuenta nada de lo que tienes delante. Al entrar el
 * cursor ES hoy, así que se abre en lo de hoy, que es lo que hace la referencia.
 */
function DiaDelRail({
  dia,
  hoy,
  lista,
  nombreDe,
  puestoDe,
  atencionDe,
  tonoDe,
  onAbrir,
  ancho = false,
}: {
  dia: string
  hoy: string
  lista: Interview[]
  nombreDe: (i: Interview) => string
  puestoDe: (i: Interview) => string
  atencionDe: (candidateId: string) => string | null
  /** El tono del anfitrión, o null si teñir no diría nada (una sola agenda). */
  tonoDe: (i: Interview) => MemberTone | null
  onAbrir: (candidateId: string) => void
  /**
   * A ANCHO DE PANTALLA (el móvil, ago 2026). Ahí esto no acompaña a una rejilla:
   * ES el contenido, así que el título sube de cuerpo y cada cita se pinta con la
   * `Fila` de siempre en vez de con la tarjeta apretada del raíl. La tarjeta
   * existe porque en 296px la hora no cabe en su columna; con 343 sí cabe, y una
   * cita tiene que leerse igual aquí que en la lista de "por delante".
   */
  ancho?: boolean
}) {
  const p = partesClave(dia)
  const esHoy = dia === hoy
  return (
    <section aria-label={`Citas del ${p.diaLargo} ${p.dia}`}>
      <header className={`flex items-baseline justify-between gap-2 px-0.5 ${ancho ? 'mb-2.5' : 'mb-2'}`}>
        <h3 className={`truncate font-semibold text-slate-900 ${ancho ? 'text-[15px]' : 'text-[13px]'}`}>
          {esHoy ? 'Hoy' : `${p.diaLargo.charAt(0).toUpperCase()}${p.diaLargo.slice(1)} ${p.dia}`}
        </h3>
        {/* La cifra pelada, sin chapa, como los contadores del lateral. */}
        {lista.length > 0 && (
          <span className={`num shrink-0 text-slate-500 ${ancho ? 'text-sm' : 'text-[13px]'}`}>
            {lista.length}
            <span className="sr-only"> {lista.length === 1 ? 'entrevista' : 'entrevistas'}</span>
          </span>
        )}
      </header>
      {lista.length === 0 ? (
        // El vacío se dice, no se esconde: un raíl que aparece y desaparece según
        // el día obliga a releer la pantalla entera cada vez que mueves el cursor.
        <p className={`rounded-xl filo bg-white px-3.5 text-slate-500 ${ancho ? 'py-4 text-sm' : 'py-3 text-[13px]'}`}>
          {esHoy ? 'Hoy no tienes ninguna cita.' : 'Ese día no tienes ninguna cita.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((i) =>
            ancho ? (
              <li key={i.id}>
                <Fila
                  entrevista={i}
                  nombre={nombreDe(i)}
                  puesto={puestoDe(i)}
                  atencion={atencionDe(i.candidateId)}
                  onAbrir={onAbrir}
                />
              </li>
            ) : (
              <li key={i.id}>
                <TarjetaRail
                  tono={tonoDe(i)}
                  entrevista={i}
                  nombre={nombreDe(i)}
                  puesto={puestoDe(i)}
                  atencion={atencionDe(i.candidateId)}
                  onAbrir={onAbrir}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}

/**
 * Una cita en el raíl. Es la `Fila` de la lista apretada a 296px: la hora deja
 * de ir en su columna (ahí se llevaba 56 de los 264 útiles) y sube a la línea
 * del nombre, que es lo único que no se puede truncar.
 *
 * El estado se dice con el FILO DE COLOR de la izquierda, como en la rejilla, y
 * no con una pastilla: aquí no hay ancho para la palabra y dos formas para el
 * mismo dato en la misma pantalla se leen como dos datos.
 */
function TarjetaRail({
  entrevista: i,
  nombre,
  puesto,
  atencion,
  tono,
  onAbrir,
}: {
  entrevista: Interview
  nombre: string
  puesto: string
  atencion: string | null
  tono: MemberTone | null
  onAbrir: (candidateId: string) => void
}) {
  const meta = INTERVIEW_STATUS_META[i.status]
  const Icono = i.mode === 'videollamada' ? Video : i.mode === 'telefonica' ? Phone : MapPin
  const sitio = i.mode === 'presencial' && i.locationText ? i.locationText : ''
  return (
    <button
      type="button"
      onClick={() => onAbrir(i.candidateId)}
      title={`${nombre}. ${puesto}. ${meta.label}${atencion ? `. ${atencion}` : ''}`}
      className="relative flex w-full flex-col overflow-hidden rounded-xl filo bg-white py-2.5 pl-3.5 pr-3 text-left transition-colors duration-[var(--duration-control)] hover:filo-slate-300"
    >
      {/* EL FILO DICE DE QUIÉN ES, no en qué estado está (Mario, ago 2026). Es el
          mismo color exacto que su cara: `tono.bg` es la clase que pinta el disco
          del avatar, así que la fila de caras del filtro sigue siendo la leyenda
          también aquí. Con el filo diciendo el estado, esta tarjeta y el bloque de
          al lado hablaban dos idiomas para el mismo color y en la misma pantalla.
          Medido sobre el blanco de la tarjeta: 5,03-8,36:1 según el tono.
          Sin tono (una sola agenda) el color vuelve a decir el estado, y ahí va con
          `barra` y no con `dot`: es el único que lo dice, así que tiene que llegar
          a 3:1, y `dot` se quedaba en 2,13 el ámbar y 2,22 el verde. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${tono ? tono.bg : meta.barra}`} aria-hidden />
      <span className="flex min-w-0 items-center gap-2">
        <span className="num shrink-0 text-[13px] font-semibold text-slate-900">
          {i.startsAt ? clockTimeInZone(i.startsAt, i.timezone) : '--:--'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">{nombre}</span>
        {i.reconfirmedAt && (
          <CheckCheck
            className="size-3.5 shrink-0 text-emerald-600"
            aria-label={`Confirmó que viene, el ${fullDateTimeInZone(i.reconfirmedAt, i.timezone)}`}
          />
        )}
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-tight text-slate-500">
        <Icono className="size-3 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{sitio ? `${puesto}, ${sitio}` : puesto}</span>
      </span>
      {atencion && (
        <span className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-tight text-slate-700">
          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
          <span className="min-w-0">{atencion}</span>
        </span>
      )}
    </button>
  )
}

/** Debajo de 768px la semana no cabe. Una sola pregunta, un solo sitio. */
function useCompacto(): boolean {
  const [v, setV] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setV(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}

/**
 * CALENDARIO O LISTA. Es el conmutador de la casa, el mismo que Tabla/Tablero en
 * el panel de un puesto (Mario, ago 2026): dos iconos en una caja rectangular con
 * filo y divisoria interior, el activo en tinta de acento (seleccionar es uno de
 * los cuatro usos permitidos del ultramarine) y el peso sin tocar, o cada cambio
 * ensancharía su mitad y movería a la vecina.
 *
 * Sustituye al grupo segmentado de tres (Semana · Día · Lista), que metía en un
 * solo control dos preguntas distintas: cómo se PRESENTA la agenda y qué TRAMO
 * enseña el calendario. La segunda solo significa algo dentro de la primera, así
 * que ahora es un desplegable aparte que no existe en la lista.
 *
 * `h-8` y no los 40 del panel: aquí la fila entera es de 32 (las flechas de
 * semana y el botón "Hoy"), y una fila se lee por su línea de base común.
 *
 * Es un `radiogroup` de verdad con flechas, no dos `<button aria-pressed>`: son
 * dos estados excluyentes de una misma cosa.
 */
function ConmutadorVista({ modo, onChange }: { modo: Modo; onChange: (m: Modo) => void }) {
  const opciones = [
    { value: 'calendario' as const, label: 'Calendario', Icono: CalendarDays },
    { value: 'lista' as const, label: 'Lista', Icono: List },
  ]
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const mover = (dir: 1 | -1) => {
    const i = opciones.findIndex((o) => o.value === modo)
    const j = (i + dir + opciones.length) % opciones.length
    onChange(opciones[j].value)
    requestAnimationFrame(() => refs.current[j]?.focus())
  }
  return (
    <div
      role="radiogroup"
      aria-label="Cómo se presenta la agenda"
      className={`flex shrink-0 items-center overflow-clip rounded-lg filo bg-white ${ALTO_FRANJA}`}
    >
      {opciones.map((o, i) => {
        const activa = modo === o.value
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={activa}
            aria-label={o.label}
            title={o.label}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
            }}
            className={`grid h-full w-10 place-items-center outline-none pointer-coarse:w-11 transition-colors duration-[var(--duration-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
              i > 0 ? 'border-l border-slate-200' : ''
            } ${activa ? 'bg-indigo-50/60 text-indigo-700' : 'text-slate-800 hover:bg-slate-50'}`}
          >
            <o.Icono className="size-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/**
 * QUÉ TRAMO ENSEÑA EL CALENDARIO. Un desplegable de verdad (`<select>`) y no un
 * menú dibujado: son dos opciones excluyentes de una lista cerrada, que es
 * literalmente para lo que existe el control nativo, y así se abre igual con el
 * teclado, con el dedo y con el lector sin que haya que reimplementar nada.
 *
 * El chevron es un ICONO, no una imagen de fondo: el `bg-[url(...)]` con el
 * data-URI dentro es la utilidad que Tailwind nunca llegó a generar y dejó un
 * desplegable sin flecha en el formulario público durante meses.
 */
function SelectorIntervalo({ valor, onChange }: { valor: Intervalo; onChange: (i: Intervalo) => void }) {
  return (
    <div className="relative shrink-0">
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as Intervalo)}
        aria-label="Tramo que enseña el calendario"
        className="h-10 appearance-none rounded-lg filo bg-white pl-3.5 pr-9 text-sm font-medium text-slate-800 pointer-coarse:h-11 outline-none transition-colors duration-[var(--duration-control)] hover:filo-slate-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
      >
        <option value="semana">Semana</option>
        <option value="dia">Día</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
    </div>
  )
}

/** Ver solo la agenda de una persona. Se pulsa otra vez y vuelven todas. */
function FiltroAnfitrion({
  lista,
  valor,
  onChange,
}: {
  lista: { id: string; nombre: string; email: string | null; foto: string | null }[]
  valor: string | null
  onChange: (v: string | null) => void
}) {
  const activo = lista.find((a) => a.id === valor)
  return (
    <div className="flex items-center gap-2">
      {activo && <span className="text-[13px] text-slate-500">Solo las de {activo.nombre}</span>}
      <div className="flex items-center gap-1">
        {lista.map((a) => {
          const seleccionado = a.id === valor
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={seleccionado}
              title={seleccionado ? 'Ver las de todo el equipo' : `Ver solo las de ${a.nombre}`}
              aria-label={seleccionado ? 'Ver las de todo el equipo' : `Ver solo las de ${a.nombre}`}
              onClick={() => onChange(seleccionado ? null : a.id)}
              className={`rounded-full p-0.5 transition-opacity ${
                seleccionado ? 'ring-2 ring-slate-900' : valor ? 'opacity-50 hover:opacity-100' : 'hover:opacity-80'
              }`}
            >
              <Avatar name={a.nombre} seed={a.email ?? a.id} src={a.foto} size={28} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PorDias({
  lista,
  nombreDe,
  puestoDe,
  atencionDe,
  onAbrir,
}: {
  lista: Interview[]
  nombreDe: (i: Interview) => string
  puestoDe: (i: Interview) => string
  atencionDe: (candidateId: string) => string | null
  onAbrir: (candidateId: string) => void
}) {
  const dias = useMemo(() => groupByDay(lista), [lista])
  return (
    <div className="space-y-6">
      {dias.map((dia) => (
        <section key={dia.key}>
          <h3 className="mb-2 text-[13px] font-semibold text-slate-500">
            {dia.label}
            <span className="ml-2 font-normal text-slate-400">
              {plural(dia.items.length, 'entrevista', 'entrevistas')}
            </span>
          </h3>
          <ul className="space-y-2">
            {dia.items.map((i) => (
              <li key={i.id}>
                <Fila
                  entrevista={i}
                  nombre={nombreDe(i)}
                  puesto={puestoDe(i)}
                  atencion={atencionDe(i.candidateId)}
                  onAbrir={onAbrir}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Fila({
  entrevista,
  nombre,
  puesto,
  atencion = null,
  onAbrir,
}: {
  entrevista: Interview
  nombre: string
  puesto: string
  /** Motivo por el que el agente se apartó, si la conversación te está esperando. */
  atencion?: string | null
  onAbrir: (candidateId: string) => void
}) {
  const meta = INTERVIEW_STATUS_META[entrevista.status]

  // Como en la rejilla: la ficha se abre encima, sin sacarte de la agenda.
  return (
    <button
      type="button"
      onClick={() => onAbrir(entrevista.candidateId)}
      // El marco, a DOS MANOS (`filo`): con una sola, el hairline de 1px pierde
      // hasta un 23% de tinta en el arco de la esquina y ahí es donde se nota,
      // porque ya es de 1,15:1 a propósito. Y el hover mueve las dos a la vez
      // (`hover:filo-slate-300`): la segunda mano es un outline pintado ENCIMA
      // del borde, así que un `hover:border-*` suelto no se vería.
      className="flex w-full flex-wrap items-center gap-3 rounded-xl filo bg-white p-3 text-left shadow-card transition-colors duration-[var(--duration-control)] hover:filo-slate-300"
    >
      {/* La hora es el dato que se busca al mirar la agenda: va primero y en cifras tabulares. */}
      <div className="w-14 shrink-0 text-center">
        {entrevista.startsAt ? (
          <span className="num text-[15px] font-semibold text-slate-900">
            {clockTimeInZone(entrevista.startsAt, entrevista.timezone)}
          </span>
        ) : (
          // Texto con significado, no un glifo: `slate-400` es 2,6:1 sobre blanco
          // y el suelo son 4,5. Que una cita no tenga hora es justo lo que hay
          // que leer en esa columna.
          <span className="text-[13px] text-slate-500">Sin hora</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-slate-900">{nombre}</p>
        <p className="truncate text-[13px] text-slate-500">
          {puesto}
          {entrevista.mode === 'videollamada' ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <Video className="size-3.5 text-slate-400" aria-hidden />
              Videollamada
            </span>
          ) : entrevista.mode === 'telefonica' ? (
            // Importa verlo de un vistazo: en esta no vas a esperar a nadie, la
            // llamada la tienes que hacer tú.
            <span className="ml-2 inline-flex items-center gap-1">
              <Phone className="size-3.5 text-slate-400" aria-hidden />
              Le llamas tú
            </span>
          ) : entrevista.locationText ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-slate-400" aria-hidden />
              {entrevista.locationText}
            </span>
          ) : null}
        </p>
      </div>

      {/* Que el candidato haya dicho "ahí estaré" es la diferencia entre esperar
          a alguien y esperar a ver.
          Va FUERA de la chapa de estado y no dentro: son dos cosas distintas (la
          entrevista sigue "confirmada" haya contestado o no), y no haber
          contestado todavía NO significa que no vaya a venir.
          Una palabra y no una frase: la fila es estrecha y lo que se le quite
          aquí se lo come a la dirección, que ya se corta. El detalle entero va
          en el title. */}
      {/* EN MÓVIL LAS SEÑALES NO DESAPARECEN, BAJAN A SU PROPIA LÍNEA (ago 2026).
          Estaban en `hidden ... sm:inline-flex` y no dejaban NADA en su sitio, ni
          un `sr-only`: en un teléfono, la pestaña "En marcha" pintaba filas
          idénticas y no había forma de saber cuál te estaba esperando, porque el
          motivo vivía en un `title`, que en táctil no existe.
          Meterlas en la fila tampoco valía: con la hora (56) y el chevron, al
          nombre le quedan ~245px y una chapa de "Necesita que entres" se lleva
          140. Así que la fila ENVUELVE y ellas se van a la segunda línea,
          sangradas hasta donde empieza el nombre (56 de la hora + 12 de hueco).
          Se pinta UNA sola vez y lo coloca el CSS: nada montado dos veces. */}
      <span className="flex items-center gap-3 max-sm:order-last max-sm:mt-0.5 max-sm:basis-full max-sm:pl-[68px]">
      {entrevista.reconfirmedAt && (
        <span
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-emerald-700"
          title={`Confirmó que viene, el ${fullDateTimeInZone(entrevista.reconfirmedAt, entrevista.timezone)}`}
        >
          <CheckCheck className="size-4" aria-hidden />
          Viene
        </span>
      )}

      {/* Si la conversación te está esperando, eso sustituye a la chapa de
          estado en vez de sumarse: la fila no da para dos, y entre "Invitada" y
          "necesita que entres" lo que hay que hacer lo dice la segunda. El
          motivo entero va en el title. */}
      {atencion ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-semibold text-amber-800"
          title={atencion}
        >
          <span className="size-2 rounded-full bg-amber-500" aria-hidden />
          Necesita que entres
        </span>
      ) : (
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold ${meta.chip}`}
        >
          <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
          {meta.label}
        </span>
      )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}

/** El vacío de la LISTA: no hay nada por delante. (Los de "En marcha" y
 *  "Pasadas" se fueron con sus pestañas.) */
function Vacio({ filtrado = false }: { filtrado?: boolean }) {
  const texto = filtrado
    ? {
        // Con un filtro puesto, "invita a alguien" sería un consejo falso: lo que
        // pasa es que en ESA agenda no hay nada.
        titulo: 'Nada por delante en esta agenda',
        cuerpo: 'Pulsa otra vez en la foto para ver las entrevistas de todo el equipo.',
      }
    : {
        titulo: 'No tienes entrevistas por delante',
        // El consejo tiene que llevar al botón que existe: mientras el canal no
        // esté de alta, la cabecera de la ficha dice "Agendar entrevista" y no
        // "Invitar a entrevista" (ver `lib/whatsapp.ts`).
        cuerpo: WHATSAPP_LISTO
          ? 'Abre la ficha de un candidato y pulsa "Invitar a entrevista" para cuadrar una cita.'
          : 'Abre la ficha de un candidato y pulsa "Agendar entrevista" para apuntar la cita.',
      }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center">
      <CalendarDays className="mx-auto size-6 text-slate-400" aria-hidden />
      <p className="mt-3 text-[15px] font-semibold text-slate-800">{texto.titulo}</p>
      <p className="mx-auto mt-1 max-w-[42ch] text-[13px] text-slate-500">{texto.cuerpo}</p>
    </div>
  )
}

function ListaSkeleton() {
  return (
    <ul className="space-y-2" role="status" aria-label="Cargando entrevistas">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl filo bg-white p-3">
          <div className="skeleton h-4 w-10 rounded" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-40 rounded" />
            <div className="skeleton h-3 w-28 rounded" />
          </div>
        </li>
      ))}
    </ul>
  )
}

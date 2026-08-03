import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, MapPin, Phone, Video } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useProfiles } from '../lib/profiles'
import { planHas } from '../lib/pricing'
import { BTN_SECONDARY_SM } from '../lib/buttons'
import { FeatureLocked } from '../components/FeatureLocked'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { Avatar } from '../components/ui/Avatar'
import { useToast } from '../components/ui/Toast'
import { AgendaGrid } from '../components/AgendaGrid'
import { CandidateModal } from './CandidateModal'
import { groupByDay, splitInterviews } from '../lib/interviews'
import { claveDeHoy, rotuloRango, semanaDe, sumarDias } from '../lib/agenda'
import { INTERVIEW_STATUS_META, type Interview } from '../lib/types'
import {
  candidateName, clockTimeInZone, dayKeyInZone, fullDateTimeInZone, minutesInZone, personLabel, plural,
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
type Vista = 'semana' | 'dia' | 'lista'
type Seccion = 'agenda' | 'enMarcha' | 'pasadas'

export function Entrevistas() {
  const { company } = useAuth()
  const { interviews, candidates, campaigns, members, loading, conversationFor, getCampaign, restoreCandidate } = useStore()
  const toast = useToast()
  const profiles = useProfiles()
  const [params, setParams] = useSearchParams()
  const compacto = useCompacto()

  // Todos los hooks ANTES del corte por plan: un return temprano por encima de
  // un useMemo cambia el número de hooks entre renders y React lo rompe.
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
  const [soloDe, setSoloDe] = useState<string | null>(null)
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
  // pregunta sobre el puesto, un audio, un número que no recibe WhatsApp). Si
  // eso no se ve aquí, la conversación se queda parada sin que nadie se entere:
  // no mandamos un correo por cada duda a propósito, así que la pantalla es el
  // único aviso. Y van las primeras: son las únicas que piden algo de ti.
  const atencionDe = (candidateId: string): string | null => {
    const c = conversationFor(candidateId)
    return c && c.agentState === 'necesita_intervencion'
      ? c.attentionReason ?? 'Hay algo que no podemos resolver solos.'
      : null
  }
  const enMarcha = useMemo(() => {
    const conAtencion = (i: Interview) => (atencionDe(i.candidateId) ? 0 : 1)
    return [...buckets.enMarcha].sort((a, b) => conAtencion(a) - conAtencion(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets.enMarcha, conversationFor])

  const rawT = params.get('t')
  const seccion: Seccion = rawT === 'enMarcha' || rawT === 'pasadas' ? rawT : 'agenda'
  const rawV = params.get('v')
  const vistaGuardada: Vista = rawV === 'dia' || rawV === 'lista' ? rawV : 'semana'
  // Siete columnas no caben en un móvil, así que por debajo de 768px la semana
  // no se ofrece siquiera. Y quien mira el teléfono pregunta "qué tengo ahora",
  // no "cómo tengo el jueves": ahí manda la lista, con el día a un toque.
  const vista: Vista = compacto && vistaGuardada === 'semana' ? 'lista' : vistaGuardada

  const cambiar = (next: Partial<{ t: Seccion; v: Vista }>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        const t = next.t ?? seccion
        const v = next.v ?? vistaGuardada
        if (t === 'agenda') p.delete('t')
        else p.set('t', t)
        if (v === 'semana') p.delete('v')
        else p.set('v', v)
        return p
      },
      { replace: true },
    )

  const demo = company?.id === 'demo'
  if (!demo && !planHas(company?.plan, 'entrevistas')) {
    return <FeatureLocked feature="entrevistas" />
  }

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
  const nombreDe = (i: Interview) => {
    const c = candidates.find((x) => x.id === i.candidateId)
    return c ? candidateName(c) : 'Candidato'
  }
  const puestoDe = (i: Interview) => campaigns.find((c) => c.id === i.campaignId)?.title ?? 'Puesto'
  const nombreDelFiltro = anfitriones.find((a) => a.id === soloDe)?.nombre ?? ''

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
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Entrevistas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Todas tus citas con candidatos, del puesto que sean.
          </p>
        </div>
        {anfitriones.length > 1 && (
          <FiltroAnfitrion lista={anfitriones} valor={soloDe} onChange={setSoloDe} />
        )}
      </header>

      <Tabs
        items={[
          { value: 'agenda', label: 'Agenda', count: buckets.proximas.length || undefined },
          { value: 'enMarcha', label: 'En marcha', count: buckets.enMarcha.length || undefined },
          { value: 'pasadas', label: 'Pasadas' },
        ]}
        value={seccion}
        onChange={(t) => cambiar({ t })}
        idPrefix="entrevistas"
        label="Secciones de la agenda"
        className="mb-4"
      />

      <TabPanel idPrefix="entrevistas" value={seccion}>
        {loading ? (
          <ListaSkeleton />
        ) : seccion === 'agenda' ? (
          // Sin ninguna cita NO se esconde el calendario. La semana vacía es la
          // respuesta a "cómo tengo la semana" y enseña dónde van a aparecer las
          // citas; una tarjeta de cartón en su sitio no dice ninguna de las dos.
          <>
            {/* Un solo ancho en toda la pantalla, el del calendario: al alternar
                entre Semana y Lista no se puede mover el borde de sitio. */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
                      o el grupo se vería 2px más ancho que el botón "Hoy" de al lado). */}
                  <div className="flex items-center overflow-hidden rounded-lg bg-white shadow-control ring-1 ring-inset ring-slate-300/80">
                    <button
                      type="button"
                      onClick={() => setCursor((c) => sumarDias(c, -salto))}
                      aria-label={vista === 'dia' ? 'Día anterior' : 'Semana anterior'}
                      className="grid size-8 place-items-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                    <span className="h-4 w-px bg-slate-200" aria-hidden />
                    <button
                      type="button"
                      onClick={() => setCursor((c) => sumarDias(c, salto))}
                      aria-label={vista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
                      className="grid size-8 place-items-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCursor(hoy)}
                    disabled={dias.includes(hoy)}
                    className={`${BTN_SECONDARY_SM} disabled:pointer-events-none disabled:opacity-40`}
                  >
                    Hoy
                  </button>
                  <h2 className="ml-0.5 truncate text-[15px] font-semibold text-slate-900">
                    {rotuloRango(dias, hoy)}
                  </h2>
                </div>
              )}

              <Segmentado
                valor={vista}
                onChange={(v) => cambiar({ v })}
                opciones={
                  compacto
                    ? [
                        { value: 'dia', label: 'Día' },
                        { value: 'lista', label: 'Lista' },
                      ]
                    : [
                        { value: 'semana', label: 'Semana' },
                        { value: 'dia', label: 'Día' },
                        { value: 'lista', label: 'Lista' },
                      ]
                }
              />
            </div>

            {vista === 'lista' ? (
              buckets.proximas.length === 0 ? (
                <Vacio seccion="agenda" filtrado={!!soloDe} />
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
                {visibles.length === 0 && (
                  <div className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-[13px] text-slate-500 shadow-card ring-1 ring-slate-200/70">
                    {soloDe
                      ? `${nombreDelFiltro} todavía no tiene ninguna entrevista.`
                      : 'Todavía no hay ninguna entrevista. Las cuadras desde la ficha de un candidato, con "Invitar a entrevista".'}
                  </div>
                )}
                <AgendaGrid
                  dias={dias}
                  interviews={visibles}
                  hoy={hoy}
                  ahoraMin={ahoraMin}
                  nombreDe={nombreDe}
                  puestoDe={puestoDe}
                  atencionDe={atencionDe}
                  onDia={(clave) => {
                    setCursor(clave)
                    cambiar({ v: 'dia' })
                  }}
                  onAbrir={setAbierto}
                />
              </>
            )}
          </>
        ) : (seccion === 'enMarcha' ? enMarcha : buckets.pasadas).length === 0 ? (
          <Vacio seccion={seccion} />
        ) : (
          <ul className="space-y-2">
            {(seccion === 'enMarcha' ? enMarcha : buckets.pasadas).map((i) => (
              <li key={i.id}>
                <Fila
                  entrevista={i}
                  nombre={nombreDe(i)}
                  puesto={puestoDe(i)}
                  atencion={atencionDe(i.candidateId)}
                  onAbrir={setAbierto}
                />
              </li>
            ))}
          </ul>
        )}
      </TabPanel>

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
 * Semana / Día / Lista. Es un cambio de VISTA, no de sección: por eso va en un
 * grupo segmentado y no en las pestañas de arriba, que reparten contenido
 * distinto. El activo se marca con relieve y tinta, sin gastar el acento.
 */
function Segmentado<T extends string>({
  valor,
  onChange,
  opciones,
}: {
  valor: T
  onChange: (v: T) => void
  opciones: { value: T; label: string }[]
}) {
  return (
    <div role="group" aria-label="Cómo ver la agenda" className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {opciones.map((o) => {
        const activo = o.value === valor
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-7 items-center rounded-[6px] px-2.5 text-[13px] transition-colors ${
              activo
                ? 'bg-white font-semibold text-slate-900 shadow-control'
                : 'font-medium text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.label}
          </button>
        )
      })}
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
      className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-card ring-1 ring-slate-200/70 transition-shadow hover:ring-slate-300"
    >
      {/* La hora es el dato que se busca al mirar la agenda: va primero y en cifras tabulares. */}
      <div className="w-14 shrink-0 text-center">
        {entrevista.startsAt ? (
          <span className="num text-[15px] font-semibold text-slate-900">
            {clockTimeInZone(entrevista.startsAt, entrevista.timezone)}
          </span>
        ) : (
          <span className="text-[13px] text-slate-400">Sin hora</span>
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
      {entrevista.reconfirmedAt && (
        <span
          className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-emerald-700 sm:inline-flex"
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
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 sm:inline-flex"
          title={atencion}
        >
          <span className="size-2 rounded-full bg-amber-500" aria-hidden />
          Necesita que entres
        </span>
      ) : (
        <span
          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset sm:inline-flex ${meta.chip}`}
        >
          <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
          {meta.label}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}

function Vacio({ seccion, filtrado = false }: { seccion: Seccion; filtrado?: boolean }) {
  const texto =
    seccion === 'agenda'
      ? filtrado
        ? {
            // Con un filtro puesto, "invita a alguien" sería un consejo falso:
            // lo que pasa es que en ESA agenda no hay nada.
            titulo: 'Nada por delante en esta agenda',
            cuerpo: 'Pulsa otra vez en la foto para ver las entrevistas de todo el equipo.',
          }
        : {
            titulo: 'No tienes entrevistas por delante',
            cuerpo: 'Abre la ficha de un candidato y pulsa "Invitar a entrevista" para cuadrar una cita.',
          }
      : seccion === 'enMarcha'
        ? {
            titulo: 'Nada en marcha',
            cuerpo: 'Aquí verás las invitaciones enviadas mientras el candidato elige horario.',
          }
        : { titulo: 'Todavía no hay historial', cuerpo: 'Las entrevistas pasadas se quedan aquí.' }

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
        <li key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
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

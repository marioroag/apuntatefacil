import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCheck, MapPin, Phone, Video, ChevronRight } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useAppBase } from '../lib/useAppBase'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { groupByDay, splitInterviews } from '../lib/interviews'
import { INTERVIEW_STATUS_META, type Interview } from '../lib/types'
import { candidateName, clockTimeInZone, fullDateTimeInZone, plural } from '../lib/format'

// Agenda de entrevistas de toda la empresa. Es una LISTA OPERATIVA, no un
// calendario: lo que se necesita saber es a quién ves, cuándo y dónde, y poder
// llegar a su ficha en un clic. Un calendario completo sería competir con Google
// para hacerlo peor.
type Vista = 'proximas' | 'enMarcha' | 'pasadas'

export function Entrevistas() {
  const { company } = useAuth()
  const { interviews, candidates, campaigns, loading } = useStore()
  const [params, setParams] = useSearchParams()

  // Todos los hooks ANTES del corte por plan: un return temprano por encima de
  // un useMemo cambia el número de hooks entre renders y React lo rompe.
  const buckets = useMemo(() => splitInterviews(interviews), [interviews])

  const raw = params.get('t')
  const vista: Vista = raw === 'enMarcha' || raw === 'pasadas' ? raw : 'proximas'
  const setVista = (next: Vista) =>
    setParams(() => {
      const p = new URLSearchParams()
      if (next !== 'proximas') p.set('t', next)
      return p
    })

  const demo = company?.id === 'demo'
  if (!demo && !planHas(company?.plan, 'entrevistas')) {
    return <FeatureLocked feature="entrevistas" />
  }

  const lista = buckets[vista]

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Entrevistas</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Todas tus citas con candidatos, del puesto que sean.
        </p>
      </header>

      <Tabs
        items={[
          { value: 'proximas', label: 'Próximas', count: buckets.proximas.length || undefined },
          { value: 'enMarcha', label: 'En marcha', count: buckets.enMarcha.length || undefined },
          { value: 'pasadas', label: 'Pasadas' },
        ]}
        value={vista}
        onChange={setVista}
        idPrefix="entrevistas"
        label="Secciones de la agenda"
        className="mb-5"
      />

      <TabPanel idPrefix="entrevistas" value={vista}>
        {loading ? (
          <ListaSkeleton />
        ) : lista.length === 0 ? (
          <Vacio vista={vista} />
        ) : vista === 'proximas' ? (
          <PorDias lista={lista} />
        ) : (
          <ul className="space-y-2">
            {lista.map((i) => (
              <li key={i.id}>
                <Fila
                  entrevista={i}
                  nombre={nombreDe(i, candidates)}
                  puesto={campaigns.find((c) => c.id === i.campaignId)?.title ?? 'Puesto'}
                />
              </li>
            ))}
          </ul>
        )}
      </TabPanel>
    </div>
  )
}

function nombreDe(i: Interview, candidates: ReturnType<typeof useStore>['candidates']): string {
  const c = candidates.find((x) => x.id === i.candidateId)
  return c ? candidateName(c) : 'Candidato'
}

function PorDias({ lista }: { lista: Interview[] }) {
  const { candidates, campaigns } = useStore()
  const dias = useMemo(() => groupByDay(lista), [lista])
  return (
    <div className="space-y-6">
      {dias.map((dia) => (
        <section key={dia.key}>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-500">
            {dia.label}
            <span className="ml-2 font-normal text-slate-400">
              {plural(dia.items.length, 'entrevista', 'entrevistas')}
            </span>
          </h2>
          <ul className="space-y-2">
            {dia.items.map((i) => (
              <li key={i.id}>
                <Fila
                  entrevista={i}
                  nombre={nombreDe(i, candidates)}
                  puesto={campaigns.find((c) => c.id === i.campaignId)?.title ?? 'Puesto'}
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
}: {
  entrevista: Interview
  nombre: string
  puesto: string
}) {
  const base = useAppBase()
  const meta = INTERVIEW_STATUS_META[entrevista.status]
  const href = `${base}/puestos/${entrevista.campaignId}?candidato=${entrevista.candidateId}`

  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card ring-1 ring-slate-200/70 transition-shadow hover:ring-slate-300"
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

      <span
        className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset sm:inline-flex ${meta.chip}`}
      >
        <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
        {meta.label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </Link>
  )
}

function Vacio({ vista }: { vista: Vista }) {
  const texto =
    vista === 'proximas'
      ? {
          titulo: 'No tienes entrevistas por delante',
          cuerpo: 'Abre la ficha de un candidato y pulsa "Invitar a entrevista" para cuadrar una cita.',
        }
      : vista === 'enMarcha'
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

import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CircleDot, Clock, Inbox, Phone, SearchX, User } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { StatusSelect } from '../components/ui/StatusPill'
import { ColHead, TABLE, ROW, CELL } from '../components/ui/DataTable'
import { CandidateModal } from './CandidateModal'
import { relativeDate, formatPhone, candidateName } from '../lib/format'
import { clickDeFila } from '../lib/fila'
import { MeridianAvatar } from '../components/Meridian'
import { candidateFit } from '../lib/meridian'
import { MaskedPhone } from '../components/MaskedPhone'
import { useAppBase } from '../lib/useAppBase'
import { TAGS_ENABLED } from '../lib/pricing'
import { ManageTagsModal } from '../components/Tags'
import type { Campaign, Candidate, CandidateStatus } from '../lib/types'
import { PageHeader } from '../components/ui/PageHeader'
import { useEsMovil } from '../lib/media'
import { BTN_SECONDARY } from '../lib/buttons'
import { ChipDimension, type DimensionFiltro } from '../components/FiltroChip'

/** Las columnas de la cola. El ORDEN se declara aparte: cambia con el ancho. */
type ColKeyBandeja = 'candidato' | 'puesto' | 'telefono' | 'estado' | 'recibida'

function answer(c: Candidate, id: string): string {
  const v = c.answers[id]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/**
 * La cola NO se vuelve a pintar porque abras una ficha (`memo`, ago 2026).
 *
 * Misma historia que la tabla del puesto, y por el mismo motivo: el pop-up del
 * candidato cuelga de esta pantalla, así que abrirlo, cerrarlo o pasar al
 * siguiente con las flechas volvía a renderizar las 272 filas de debajo. Ese era
 * todo el retraso que se sentía al pulsar; el pop-up nunca fue lento.
 *
 * La cola estaba escrita en línea dentro de `Bandeja`, o sea sin ningún sitio
 * donde poner el memo. Vive aquí para tenerlo. Para que siga funcionando, lo que
 * llega tiene que ser estable entre renders: `rows` sale de un `useMemo`, y
 * `getCampaign`/`setStatus` del store, que está memoizado. Una función escrita
 * en línea en el JSX lo apagaría en silencio y devolvería el retraso.
 */
const ListaNuevos = memo(function ListaNuevos({
  rows,
  getCampaign,
  setStatus,
  onOpen,
  maskPhone,
  base,
}: {
  rows: Candidate[]
  getCampaign: (id: string) => Campaign | undefined
  setStatus: (id: string, status: CandidateStatus) => void
  onOpen: (id: string) => void
  maskPhone: boolean
  base: string
}) {
  const esMovil = useEsMovil()
  // EL ORDEN DE LAS COLUMNAS ES LA PRIORIDAD, y en movil se nota, igual que en el
  // panel del puesto: con la tabla desplazandose a lo ancho, lo que va primero es
  // lo unico que se ve sin empujar, asi que ESTADO sube a la segunda posicion.
  // Aqui ademas el estado ES el trabajo de la pantalla: la Bandeja existe para
  // sacar candidatos de "nuevo".
  const orden: ColKeyBandeja[] = esMovil
    ? ['candidato', 'estado', 'puesto', 'telefono', 'recibida']
    : ['candidato', 'puesto', 'telefono', 'estado', 'recibida']
  // Suma EXACTA de lo que se pinta en movil. Candidato (196) y Estado (144) caben
  // juntos en los 341 de contenido de una pantalla de 375: quien es y en que
  // estado esta se leen sin empujar. Los 144 son la pastilla mas ancha medida
  // ("Contactado", 128) mas los 16 de relleno de celda en movil.
  const anchoMovil = 196 + 144 + 180 + 116

  return (
    <div className="overflow-clip rounded-xl filo bg-white shadow-card">
      {/* UNA SOLA VISTA A TODOS LOS ANCHOS: la rejilla, que en movil se desplaza a
          lo ancho. Aqui vivia una lista de fichas de dos lineas, que era la forma
          que tenia la lista del puesto; el panel la retiro en ago 2026 y la
          Bandeja se quedo siendo su unica consumidora, con un comentario que
          afirmaba una paridad que ya no existia. Dos listas de candidatos que se
          leen distinto es exactamente lo que este repaso viene a quitar. */}
      <div className="overflow-x-auto">
        <table className={`min-w-[680px] ${TABLE}`} style={esMovil ? { minWidth: anchoMovil } : undefined}>
          <caption className="sr-only">Candidatos nuevos de todos los puestos</caption>
          <thead>
            <tr className="bg-slate-50/60">
              {orden.map((k) => {
                switch (k) {
                  case 'candidato':
                    // El unico ancho que cambia con la ventana: en escritorio no lo
                    // declara nadie (absorbe el sobrante, que es lo que hace crecer
                    // el nombre) y en movil se fija, porque alli el sobrante no
                    // existe y hay que dejarle sitio al estado.
                    return <ColHead key={k} icon={User} className={esMovil ? 'w-[196px]' : ''}>Candidato</ColHead>
                  case 'puesto':
                    return <ColHead key={k} icon={Briefcase} className={esMovil ? 'w-[180px]' : ''}>Puesto</ColHead>
                  case 'telefono':
                    return <ColHead key={k} icon={Phone} className="hidden w-[150px] lg:table-cell">Teléfono</ColHead>
                  case 'estado':
                    return <ColHead key={k} icon={CircleDot} className={esMovil ? 'w-[144px]' : 'w-[148px]'}>Estado</ColHead>
                  case 'recibida':
                    return <ColHead key={k} icon={Clock} align="right" className="w-[116px]">Recibida</ColHead>
                }
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const camp = getCampaign(c.campaignId)
              const name = candidateName(c) || 'Sin nombre'
              const phone = answer(c, 'telefono')
              return (
                <tr
                  key={c.id}
                  onClick={(e) => clickDeFila(e) && onOpen(c.id)}
                  className={`${ROW} group cursor-pointer hover:bg-slate-50`}
                >
                  {orden.map((k) => {
                    switch (k) {
                      case 'candidato':
                        return (
                          <td key={k} className={CELL}>
                            <div className="flex items-center gap-2.5">
                              <MeridianAvatar name={name} fit={candidateFit(c.ai)} size={28} />
                              {/* UN BOTON DE VERDAD, no un `<span>` subrayado al
                                  pasar por encima. Los unicos elementos enfocables
                                  de la fila eran el enlace del puesto y el selector
                                  de estado, asi que la accion principal de esta
                                  pantalla, abrir la ficha, no se podia hacer con
                                  teclado. Y sin subrayado, como la tabla del puesto
                                  desde ago 2026: la fila ENTERA abre la ficha, asi
                                  que subrayar solo el nombre promete un objetivo mas
                                  pequeño del que hay. El foco no se queda sin señal,
                                  pasa a anillo. */}
                              <button
                                type="button"
                                onClick={() => onOpen(c.id)}
                                title={name}
                                className="block min-w-0 truncate rounded-sm text-left text-[14px] font-medium text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                              >
                                {name}
                              </button>
                            </div>
                          </td>
                        )
                      case 'puesto':
                        return (
                          <td key={k} className={CELL}>
                            {camp ? (
                              <Link
                                to={`${base}/puestos/${camp.id}`}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-2 pr-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
                              >
                                <Briefcase className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                                <span className="truncate">{camp.title}</span>
                              </Link>
                            ) : (
                              <span className="text-[12px] text-slate-500">–</span>
                            )}
                          </td>
                        )
                      case 'telefono':
                        return (
                          <td key={k} className={`${CELL} num hidden text-[13px] text-slate-600 lg:table-cell`}>
                            <span className="block truncate">
                              {maskPhone && phone ? <MaskedPhone value={formatPhone(phone)} /> : formatPhone(phone) || '–'}
                            </span>
                          </td>
                        )
                      case 'estado':
                        return (
                          <td key={k} className={`${CELL} whitespace-nowrap`}>
                            <StatusSelect status={c.status} onChange={(s) => setStatus(c.id, s)} />
                          </td>
                        )
                      case 'recibida':
                        return (
                          <td key={k} className={`${CELL} whitespace-nowrap text-right text-[13px] text-slate-500`}>
                            <time dateTime={c.submittedAt} className="num">{relativeDate(c.submittedAt)}</time>
                          </td>
                        )
                    }
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})

// Bandeja única: todos los candidatos en estado "nuevo" de TODOS los puestos
// en una sola cola para triar de una vez, sin entrar puesto por puesto.
//
// La fila es DELIBERADAMENTE escueta (Mario, jul 2026): nombre, puesto, estado y
// cuándo llegó. Sin etiquetas y sin la lectura de encaje, que aquí solo eran ruido
// para triar: ambas se ven enteras al abrir la ficha del candidato.
export function Bandeja() {
  const { candidates, getCampaign, setStatus, restoreCandidate } = useStore()
  const { role } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const demo = base === '/demo'
  const maskPhone = demo
  const canManageTags = role !== 'encargado'
  const [openId, setOpenId] = useState<string | null>(null)
  const [manageTagsOpen, setManageTagsOpen] = useState(false)

  const [puestoFilter, setPuestoFilter] = useState<Set<string>>(new Set())

  const todosNuevos = useMemo(
    () =>
      candidates
        .filter((c) => c.status === 'nuevo')
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [candidates],
  )
  const nuevos = useMemo(
    () => (puestoFilter.size === 0 ? todosNuevos : todosNuevos.filter((c) => puestoFilter.has(c.campaignId))),
    [todosNuevos, puestoFilter],
  )

  // FILTRAR POR PUESTO (Mario, ago 2026). La cola mezcla puestos a proposito, que
  // es de lo que va la Bandeja, pero cuando el dia se va en uno solo hay que poder
  // quedarse en el.
  //
  // Solo se ofrecen los puestos que TIENEN gente nueva, y con su cifra: un filtro
  // que devuelve cero no es un filtro, es una via muerta, y aqui ademas la cifra
  // decide (dice si merece la pena entrar en ese monton). Sale de `todosNuevos` y
  // no de `nuevos`, o al marcar uno desapareceria del propio menu.
  const opcionesPuesto = useMemo(() => {
    const cuenta = new Map<string, number>()
    todosNuevos.forEach((c) => cuenta.set(c.campaignId, (cuenta.get(c.campaignId) ?? 0) + 1))
    return [...cuenta.entries()]
      .map(([id, n]) => ({ valor: id, label: getCampaign(id)?.title ?? 'Puesto eliminado', n }))
      .sort((a, b) => b.n - a.n)
      .map((o) => ({
        valor: o.valor,
        label: o.label,
        leading: <span className="num shrink-0 text-[12px] text-slate-500">{o.n}</span>,
      }))
  }, [todosNuevos, getCampaign])

  const dimPuesto: DimensionFiltro = {
    id: 'puesto',
    label: 'Puesto',
    icon: Briefcase,
    n: puestoFilter.size,
    limpiar: () => setPuestoFilter(new Set()),
    seleccionadas: puestoFilter,
    onToggle: (v) =>
      setPuestoFilter((p) => {
        const n = new Set(p)
        n.has(v) ? n.delete(v) : n.add(v)
        return n
      }),
    opciones: opcionesPuesto,
  }

  const openCandidate = openId ? candidates.find((c) => c.id === openId) ?? null : null
  const openCampaign = openCandidate ? getCampaign(openCandidate.campaignId) ?? null : null

  return (
    <div className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      {/* El contador va en la línea del título: es el tamaño de la cola, y en la
          chapa del menú ya se ve el mismo número. */}
      <PageHeader
        titulo="Bandeja"
        cuenta={nuevos.length}
        cuentaLabel={nuevos.length === 1 ? 'candidatura nueva' : 'candidaturas nuevas'}
        sub="Candidatos nuevos de todos tus puestos, en una sola cola."
      />

      {/* Aqui habia una segunda linea con la MISMA cifra que ya lleva el titulo
          veinte lineas mas arriba, en gris y en prosa. El panel resolvio esto
          pasandola a `sr-only` y dejandola SIEMPRE montada: una region viva que se
          monta y se desmonta deja de anunciar, y es lo unico que le dice a quien no
          ve la lista cuantos quedan al mover el filtro. `sr-only` la saca ademas
          del flujo, asi que no ocupa nada. */}
      <p className="sr-only" role="status">
        {nuevos.length} {nuevos.length === 1 ? 'candidato nuevo' : 'candidatos nuevos'} sin revisar
      </p>

      {/* La franja de herramientas: hoy solo el filtro por puesto, y solo si hay
          mas de un puesto con gente nueva. Con uno, filtrar por el es no filtrar. */}
      {opcionesPuesto.length > 1 && (
        <div className="mb-3 flex items-start gap-2">
          <ChipDimension dim={dimPuesto} />
        </div>
      )}

      {todosNuevos.length === 0 ? (
        <EmptyInbox />
      ) : nuevos.length === 0 ? (
        <EmptySinResultado onLimpiar={() => setPuestoFilter(new Set())} />
      ) : (
        <>
          <ListaNuevos
            rows={nuevos}
            getCampaign={getCampaign}
            setStatus={setStatus}
            onOpen={setOpenId}
            maskPhone={maskPhone}
            base={base}
          />
        </>
      )}

      {openCampaign && (
        <CandidateModal
          campaign={openCampaign}
          candidate={openCandidate}
          maskPhone={maskPhone}
          onClose={() => setOpenId(null)}
          onOpenManageTags={canManageTags ? () => setManageTagsOpen(true) : undefined}
          onDeleted={(c) =>
            toast.success('Candidato eliminado', { action: { label: 'Deshacer', onClick: () => restoreCandidate(c) } })
          }
          // La bandeja mezcla puestos: al pasar al siguiente, `openCampaign` se
          // recalcula desde el propio candidato, así que la cabecera acompaña.
          siblings={nuevos}
          onNavigate={setOpenId}
        />
      )}

      {TAGS_ENABLED && canManageTags && (
        <ManageTagsModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} />
      )}

      {/* Aqui vivia la hoja de estado de movil, que abria la pastilla de la
          tarjeta. Se va con la tarjeta: en la rejilla el estado se cambia con el
          mismo `StatusSelect` a todos los anchos, que es el que ya usa el panel. */}
    </div>
  )
}

/**
 * Vacio DE FILTRO, distinto del vacio de la cola. "Todo al dia" seria mentira:
 * hay gente esperando, solo que no en el puesto que has marcado. Y lleva la
 * salida puesta, porque el usuario no tiene por que recordar que dejo un filtro.
 */
function EmptySinResultado({ onLimpiar }: { onLimpiar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl filo bg-white px-6 py-16 text-center shadow-card">
      <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Ningún candidato nuevo en ese puesto</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">Sigue habiendo gente esperando en los demás.</p>
      <button type="button" onClick={onLimpiar} className={`${BTN_SECONDARY} mt-4`}>
        Ver todos los puestos
      </button>
    </div>
  )
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl filo bg-white px-6 py-16 text-center shadow-card">
      <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Inbox className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Todo al día</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        No tienes candidatos nuevos sin revisar. Cuando entre una candidatura nueva, aparecerá aquí.
      </p>
    </div>
  )
}

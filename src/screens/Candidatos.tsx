import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CircleDot, Clock, ContactRound, Phone, SearchX, Star, Tag, User } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { StatusSelect } from '../components/ui/StatusPill'
import { ColHead, TABLE, ROW, CELL, FIJA, TRANSICION_FILA } from '../components/ui/DataTable'
import { CandidateModal } from './CandidateModal'
import { fechaCorta, fullDateTime, formatPhone, candidateName } from '../lib/format'
import { clickDeFila } from '../lib/fila'
import { MeridianAvatar } from '../components/Meridian'
import { candidateFit } from '../lib/meridian'
import { MaskedPhone } from '../components/MaskedPhone'
import { useAppBase } from '../lib/useAppBase'
import { TAGS_ENABLED } from '../lib/pricing'
import { ManageTagsModal } from '../components/Tags'
import { FAVORITO_STAR, STATUS_META } from '../lib/types'
import type { Campaign, Candidate, CandidateStatus } from '../lib/types'
import { PageHeader } from '../components/ui/PageHeader'
import { useEsMovil } from '../lib/media'
import { BTN_SECONDARY } from '../lib/buttons'
import { ChipDimension, MenuAnadirFiltro, type DimensionFiltro } from '../components/FiltroChip'
import { useColumnasAjustables } from '../lib/columnas'
import { estadosDe, incluye, traeNuevos, vistaPor, type VistaCandidatos } from '../lib/candidatos'
import { IconoVacio } from '../components/ui/IconoVacio'

/** Las columnas de la cola. El ORDEN se declara aparte: cambia con el ancho. */
type ColKeyCandidatos = 'candidato' | 'puesto' | 'telefono' | 'estado' | 'recibida'

function answer(c: Candidate, id: string): string {
  const v = c.answers[id]
  if (v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/**
 * La lista NO se vuelve a pintar porque abras una ficha (`memo`, ago 2026).
 *
 * Misma historia que la tabla del puesto, y por el mismo motivo: el pop-up del
 * candidato cuelga de esta pantalla, así que abrirlo, cerrarlo o pasar al
 * siguiente con las flechas volvía a renderizar las 272 filas de debajo. Ese era
 * todo el retraso que se sentía al pulsar; el pop-up nunca fue lento.
 *
 * La lista estaba escrita en línea dentro de la pantalla, o sea sin ningún sitio
 * donde poner el memo. Vive aquí para tenerlo. Para que siga funcionando, lo que
 * llega tiene que ser estable entre renders: `rows` sale de un `useMemo`, y
 * `getCampaign`/`setStatus` del store, que está memoizado. Una función escrita
 * en línea en el JSX lo apagaría en silencio y devolvería el retraso.
 */
const ListaCandidatos = memo(function ListaCandidatos({
  rows,
  getCampaign,
  setStatus,
  onOpen,
  maskPhone,
  base,
  caption,
}: {
  rows: Candidate[]
  getCampaign: (id: string) => Campaign | undefined
  setStatus: (id: string, status: CandidateStatus) => void
  onOpen: (id: string) => void
  maskPhone: boolean
  base: string
  /** Qué lista es esta, para quien no la ve. Cambia con la vista. */
  caption: string
}) {
  const esMovil = useEsMovil()
  // EL ORDEN DE LAS COLUMNAS ES LA PRIORIDAD, y en movil se nota, igual que en el
  // panel del puesto: con la tabla desplazandose a lo ancho, lo que va primero es
  // lo unico que se ve sin empujar, asi que ESTADO sube a la segunda posicion.
  // Aqui ademas el estado ES por donde se corta la pantalla (Activos, Contratados,
  // Todos), asi que es lo primero que se comprueba de cada fila.
  const orden: ColKeyCandidatos[] = esMovil
    ? ['candidato', 'estado', 'puesto', 'telefono', 'recibida']
    : ['candidato', 'puesto', 'telefono', 'estado', 'recibida']
  // Igual que la tabla del puesto: el ancho lo pone quien mira. Su propio id, así
  // que ajustar "Puesto" aquí no toca ninguna columna de allí aunque se llamen
  // igual. Apagado en móvil, por lo mismo.
  const { col, minTabla } = useColumnasAjustables('candidatos', orden, !esMovil)
  // La columna del candidato se queda quieta mientras el resto pasa por debajo:
  // sin ella, empujando a la izquierda para llegar al estado o a la fecha se
  // pierde de vista de QUIÉN es la fila. Aquí no hay casilla de selección, así que
  // la fija es una y va pegada al filo. En móvil no, como en el panel: allí lo que
  // se queda quieto se lo quita a lo poco que se puede explorar (ver `DataTable`).
  const fijaNombre = esMovil ? '' : `${FIJA} left-0`
  // El mínimo de cada columna sale de su contenido, igual que en el panel del
  // puesto y con los mismos números donde la columna es la misma.
  //
  // El de Puesto es propio y se ajustó MIDIENDO LO PINTADO, no calculándolo: la
  // cápsula se lleva 39px entre icono, hueco y relleno (no los 26 que salían de
  // medir solo el texto), así que 184 = 24 de celda + 39 de cápsula + 121 de
  // título. Con eso entran cinco de los seis títulos de la demo, "Oficial de 1ª
  // (albañil)" incluido, y solo se corta el más largo ("Preparador/a de
  // pedidos"). Es la misma regla que Mario puso para el nombre: que se vea LA
  // MAYORÍA, no todos a cualquier precio, porque cada píxel de más aquí sale de
  // la columna del candidato.
  const MINIMOS: Record<ColKeyCandidatos, number> = {
    candidato: 230, puesto: 184, telefono: 111, estado: 152, recibida: 136,
  }
  // El techo, con la regla del revés: hasta dónde deja de enseñar algo nuevo. Los
  // mismos números que en el panel donde la columna es la misma; Puesto lleva 360
  // porque su cápsula sí crece con el título (el más largo de la demo pide 205).
  const MAXIMOS: Record<ColKeyCandidatos, number> = {
    candidato: 360, puesto: 360, telefono: 180, estado: 240, recibida: 200,
  }
  // Suma EXACTA de lo que se pinta en movil. Candidato (196) y Estado (144) caben
  // juntos en los 341 de contenido de una pantalla de 375: quien es y en que
  // estado esta se leen sin empujar. Los 144 son la pastilla mas ancha medida
  // ("Contactado", 128) mas los 16 de relleno de celda en movil.
  const anchoMovil = 196 + 144 + 180 + 116

  return (
    <div className="overflow-clip rounded-xl filo bg-white">
      {/* UNA SOLA VISTA A TODOS LOS ANCHOS: la rejilla, que en movil se desplaza a
          lo ancho. Aqui vivia una lista de fichas de dos lineas, que era la forma
          que tenia la lista del puesto; el panel la retiro en ago 2026 y la
          esta pantalla se quedo siendo su unica consumidora, con un comentario que
          afirmaba una paridad que ya no existia. Dos listas de candidatos que se
          leen distinto es exactamente lo que este repaso viene a quitar. */}
      <div className="overflow-x-auto">
        {/* El `minWidth` en línea manda sobre la clase: congelada, el suelo de la
            tabla es la suma de sus columnas, y es lo que saca el desplazamiento
            horizontal en vez de estrangular a la última. */}
        <table className={`min-w-[680px] ${TABLE}`} style={{ minWidth: esMovil ? anchoMovil : minTabla }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-tabla-banda">
              {orden.map((k) => {
                switch (k) {
                  case 'candidato':
                    // El unico ancho que cambia con la ventana: en escritorio no lo
                    // declara nadie (absorbe el sobrante, que es lo que hace crecer
                    // el nombre) y en movil se fija, porque alli el sobrante no
                    // existe y hay que dejarle sitio al estado.
                    return <ColHead key={k} icon={User} className={esMovil ? 'w-[196px]' : ''} fija={fijaNombre || undefined} toneClass="bg-tabla-banda" {...col(k, 'Candidato', MINIMOS.candidato, MAXIMOS.candidato)}>Candidato</ColHead>
                  case 'puesto':
                    return <ColHead key={k} icon={Briefcase} className={esMovil ? 'w-[180px]' : ''} {...col(k, 'Puesto', MINIMOS.puesto, MAXIMOS.puesto)}>Puesto</ColHead>
                  case 'telefono':
                    return <ColHead key={k} icon={Phone} className="hidden w-[150px] lg:table-cell" {...col(k, 'Teléfono', MINIMOS.telefono, MAXIMOS.telefono)}>Teléfono</ColHead>
                  case 'estado':
                    return <ColHead key={k} icon={CircleDot} className={esMovil ? 'w-[144px]' : 'w-[148px]'} {...col(k, 'Estado', MINIMOS.estado, MAXIMOS.estado)}>Estado</ColHead>
                  case 'recibida':
                    // `pr-5` aquí y en la celda, como en el panel: la fecha es lo
                    // último de la fila y se apoyaba en el filo de la tarjeta.
                    return <ColHead key={k} icon={Clock} align="right" className="w-[136px] pr-5" {...col(k, 'Recibida', MINIMOS.recibida, MAXIMOS.recibida)}>Recibida</ColHead>
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
                          // El fondo es el de la fila y no puede no serlo: la
                          // celda fija tapa lo que se desliza por debajo, así que
                          // un tono distinto sería una costura vertical.
                          <td key={k} className={`${CELL} ${fijaNombre} ${fijaNombre && `${TRANSICION_FILA} bg-white group-hover:bg-slate-50`}`}>
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
                            <StatusSelect status={c.status} onChange={(s) => setStatus(c.id, s)} celda />
                          </td>
                        )
                      case 'recibida':
                        return (
                          <td key={k} className={`${CELL} whitespace-nowrap pr-5 text-right text-[13px] text-slate-500`}>
                            <time dateTime={c.submittedAt} title={fullDateTime(c.submittedAt)} className="num">{fechaCorta(c.submittedAt)}</time>
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

/**
 * CANDIDATOS: tu gente, de todos los puestos, en una sola lista.
 *
 * Era la "Bandeja" y solo listaba los `nuevo`: servía para triar de una vez sin
 * entrar puesto por puesto, y para nada más. La lista COMPLETA de la empresa no
 * tenía dónde verse. Ahora la pantalla es la lista y lo que cambia es por dónde
 * la cortas: Activos, Contratados o Todos. Los tres cortes se declaran en
 * `lib/candidatos.ts` y esta pantalla no conoce ninguno por su nombre.
 *
 * La fila sigue siendo DELIBERADAMENTE escueta (Mario, jul 2026): nombre, puesto,
 * estado y cuándo llegó. Sin etiquetas y sin la lectura de encaje, que aquí solo
 * eran ruido: ambas se ven enteras al abrir la ficha del candidato.
 */
export function Candidatos({ vista: vistaId }: { vista: VistaCandidatos }) {
  const vista = vistaPor(vistaId)
  const { candidates, getCampaign, setStatus, restoreCandidate, markCandidatosSeen, tags } = useStore()
  const { role } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const demo = base === '/demo'
  const maskPhone = demo
  const canManageTags = role !== 'encargado'
  const [openId, setOpenId] = useState<string | null>(null)
  const [manageTagsOpen, setManageTagsOpen] = useState(false)

  // MIRAR ESTA LISTA CUENTA COMO HABERLA VISTO, y eso es lo que apaga el punto de
  // su fila del menu. Antes ese punto contaba "cuantos estan en estado nuevo", que
  // no se apaga mirando sino triando: se quedaba encendido para siempre.
  //
  // Solo en las vistas que TRAEN a los nuevos: abrir Contratados no es haber visto
  // las candidaturas nuevas, porque ahi no estan. Y se vuelve a marcar cuando
  // entra gente mientras la tienes delante, igual que hace el tablon.
  //
  // Por `ref` para que el efecto no dependa de la funcion del store: si entrara en
  // las dependencias, cada marca cambiaria el contexto y volveria a disparar el
  // efecto. Es el mismo patron que ya usa `EquipoTablon`.
  const marcaRef = useRef(markCandidatosSeen)
  marcaRef.current = markCandidatosSeen
  useEffect(() => {
    if (traeNuevos(vista)) marcaRef.current()
  }, [candidates, vista])

  const [puestoFilter, setPuestoFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<CandidateStatus>>(new Set())
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set())
  const [favoritosOnly, setFavoritosOnly] = useState(false)

  // El conjunto de la VISTA, sin el filtro por puesto: es el tamaño de lo que
  // hay, y es lo que lleva el contador del título. El del panel del puesto se
  // comporta igual y por el mismo motivo: filtrar no cambia cuánta gente tienes.
  const todos = useMemo(
    () => candidates.filter(incluye(vista)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [candidates, vista],
  )
  const filas = useMemo(
    () =>
      todos.filter((c) => {
        if (puestoFilter.size && !puestoFilter.has(c.campaignId)) return false
        if (statusFilter.size && !statusFilter.has(c.status)) return false
        if (favoritosOnly && !c.favorito) return false
        if (tagFilter.size && !c.tagIds.some((id) => tagFilter.has(id))) return false
        return true
      }),
    [todos, puestoFilter, statusFilter, favoritosOnly, tagFilter],
  )

  /**
   * DOS CUENTAS, PORQUE HAY DOS CONTROLES. El puesto es hermano de "Filtros", no
   * uno de sus contenidos, así que **su chip no puede teñir al botón de al lado**:
   * con una sola cuenta, filtrar por un puesto dejaba "Filtros" en azul sin que
   * hubiera nada puesto dentro, y al abrirlo no había ni un valor marcado. Cada
   * control dice su propio estado, que es la misma regla por la que un chip existe
   * solo si filtra. (Al revés ya funcionaba: la cápsula del puesto se tiñe de su
   * propio `n`.)
   */
  const nFiltrosMenu = statusFilter.size + tagFilter.size + (favoritosOnly ? 1 : 0)
  /** Lo que limpia el pie del menú: lo suyo, no el puesto, que vive fuera. */
  const limpiarMenu = useCallback(() => {
    setStatusFilter(new Set())
    setTagFilter(new Set())
    setFavoritosOnly(false)
  }, [])
  /** TODO, para la salida del vacío: ahí da igual cuál de los dos te dejó sin lista. */
  const limpiarTodo = useCallback(() => {
    setPuestoFilter(new Set())
    limpiarMenu()
  }, [limpiarMenu])

  // FILTRAR POR PUESTO (Mario, ago 2026). La lista mezcla puestos a proposito, que
  // es de lo que va esta pantalla, pero cuando el dia se va en uno solo hay que
  // poder quedarse en el.
  //
  // Solo se ofrecen los puestos que TIENEN gente en esta vista, y con su cifra: un filtro
  // que devuelve cero no es un filtro, es una via muerta, y aqui ademas la cifra
  // decide (dice si merece la pena entrar en ese monton). Sale de `todos` y no de
  // `filas`, o al marcar uno desapareceria del propio menu.
  const opcionesPuesto = useMemo(() => {
    const cuenta = new Map<string, number>()
    todos.forEach((c) => cuenta.set(c.campaignId, (cuenta.get(c.campaignId) ?? 0) + 1))
    return [...cuenta.entries()]
      .map(([id, n]) => ({ valor: id, label: getCampaign(id)?.title ?? 'Puesto eliminado', n }))
      .sort((a, b) => b.n - a.n)
      .map((o) => ({
        valor: o.valor,
        label: o.label,
        leading: <span className="num shrink-0 text-[12px] text-slate-500">{o.n}</span>,
      }))
  }, [todos, getCampaign])

  /**
   * QUÉ SE PUEDE FILTRAR AQUÍ. Es un registro, igual que el del panel del puesto,
   * y por eso las dos pantallas comparten el menú y el chip: una lista de gente se
   * filtra igual venga de un proceso o de todos. Añadir una dimensión es una
   * entrada más, nunca UI nueva.
   *
   * DOS DIMENSIONES DEL PANEL NO ESTÁN AQUÍ, y no es un olvido:
   *  · **Las preguntas del formulario**, porque son de CADA puesto: "¿Tienes
   *    carnet C?" no existe en el proceso de al lado, y una lista que mezcla seis
   *    procesos no puede ofrecer un filtro que solo se aplica a uno. Se filtran
   *    dentro del puesto, que es donde significan algo.
   *  · **Interés**, que se deriva del estado de la conversación de WhatsApp y hoy
   *    ese canal está apagado.
   */
  const dimensiones = useMemo<DimensionFiltro[]>(() => {
    const d: DimensionFiltro[] = []

    // ESTADO, y lo que se ofrece DEPENDE DE LA VISTA, que es el mismo problema que
    // resolvió el conmutador Activos/Rechazados del panel: la vista ya es un corte
    // por estado, así que ofrecer uno que ella deja fuera es ofrecer una lista
    // vacía garantizada. En Contratados no se ofrece la dimensión entera: solo hay
    // un estado posible y filtrar por él es no filtrar. Los estados los DECLARA la
    // vista (`lib/candidatos.ts`); antes se adivinaban probando su predicado con un
    // candidato de mentira, y eso dejó de valer con un corte que no es por estado.
    const estadosVista = estadosDe(vista)
    if (estadosVista.length > 1) {
      d.push({
        id: 'estado',
        label: 'Estado',
        icon: CircleDot,
        n: statusFilter.size,
        limpiar: () => setStatusFilter(new Set()),
        seleccionadas: statusFilter as Set<string>,
        onToggle: (v) => {
          const s2 = v as CandidateStatus
          const n = new Set(statusFilter)
          n.has(s2) ? n.delete(s2) : n.add(s2)
          setStatusFilter(n)
        },
        opciones: estadosVista.map((v) => ({
          valor: v,
          label: STATUS_META[v].label,
          leading: <span className={`size-2 shrink-0 rounded-full ${STATUS_META[v].dot}`} aria-hidden />,
        })),
      })
    }

    // Dentro de Favoritos no se ofrece: ahí solo podría decir que sí, exactamente
    // igual que Estado dentro de Contratados. Fuera sí, y no es la misma puerta que
    // la vista: aquí recorta lo que YA estás mirando (tus favoritos dentro de
    // Activos, por ejemplo), y eso no es lo mismo que la lista de todos ellos.
    if (!vista.soloFavoritos) {
      d.push({
        id: 'favoritos',
        label: 'Favoritos',
        icon: Star,
        n: favoritosOnly ? 1 : 0,
        limpiar: () => setFavoritosOnly(false),
        seleccionadas: new Set(favoritosOnly ? ['si'] : []),
        onToggle: () => setFavoritosOnly((v) => !v),
        opciones: [
          {
            valor: 'si',
            label: 'Solo favoritos',
            leading: <Star className={`size-4 shrink-0 ${FAVORITO_STAR}`} aria-hidden />,
          },
        ],
      })
    }

    if (TAGS_ENABLED && tags.length > 0) {
      d.push({
        id: 'etiquetas',
        label: 'Etiquetas',
        icon: Tag,
        n: tagFilter.size,
        limpiar: () => setTagFilter(new Set()),
        seleccionadas: tagFilter,
        onToggle: (v) =>
          setTagFilter((p) => {
            const n = new Set(p)
            n.has(v) ? n.delete(v) : n.add(v)
            return n
          }),
        opciones: tags.map((t) => ({ valor: t.id, label: t.name })),
      })
    }
    return d
  }, [vista, statusFilter, favoritosOnly, tags, tagFilter])

  /**
   * EL PUESTO NO ESTÁ DENTRO DE "FILTROS": es su hermano, y va a su izquierda
   * (Mario, ago 2026).
   *
   * En el panel de un puesto, el puesto ya lo dice el título y filtrar por él no
   * existe. Aquí es la dimensión que define de qué va la pantalla: esta lista
   * MEZCLA procesos a propósito, así que "de qué proceso estoy mirando gente" es
   * la primera pregunta que se hace, no una categoría más al mismo nivel que
   * Etiquetas. Metido dentro del menú costaba dos gestos (abrir Filtros, elegir
   * Puesto) para lo que se usa a diario; fuera, la cápsula está siempre a la
   * vista y dice de un vistazo si estás mirando uno o todos.
   *
   * Solo si hay MÁS DE UN puesto con gente en esta vista: con uno, filtrar por él
   * es no filtrar, y un control que no puede cambiar nada es peor que ninguno.
   */
  const dimPuesto = useMemo<DimensionFiltro>(
    () => ({
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
    }),
    [puestoFilter, opcionesPuesto],
  )

  // UN CHIP EXISTE SI FILTRA, igual que en el panel: nada de una lista paralela de
  // "categorías añadidas", que se desincroniza en cuanto desmarcas el último valor.
  const dimensionesVisibles = useMemo(() => dimensiones.filter((d) => d.n > 0), [dimensiones])

  const openCandidate = openId ? candidates.find((c) => c.id === openId) ?? null : null
  const openCampaign = openCandidate ? getCampaign(openCandidate.campaignId) ?? null : null

  return (
    <div className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      {/* El título es el mismo en las tres vistas porque la PANTALLA es la misma:
          la que cambia es por dónde la cortas, y eso lo dice el subtítulo. Aquí el
          subtítulo se lo gana (la doctrina dice que tiene que ganárselo): es lo
          único que arriba distingue Activos de Contratados. Quién está marcado en
          el menú lo dice la otra mitad.

          El contador es el de la VISTA sin filtrar: es cuánta gente tienes, no
          cuánta se ve ahora. Mismo criterio que el total del panel de un puesto. */}
      <PageHeader
        titulo="Candidatos"
        cuenta={todos.length}
        cuentaLabel={vista.cuenta(todos.length)}
        sub={vista.sub}
        // La cabecera del panel de un puesto: `pb-3` en vez de margen, para que
        // sus 12px más los 16 de la franja den los mismos 28 que hay por debajo de
        // los chips. Ver `pegada` en la pieza.
        pegada
      />

      {/* Aqui habia una segunda linea con la MISMA cifra que ya lleva el titulo
          veinte lineas mas arriba, en gris y en prosa. El panel resolvio esto
          pasandola a `sr-only` y dejandola SIEMPRE montada: una region viva que se
          monta y se desmonta deja de anunciar, y es lo unico que le dice a quien no
          ve la lista cuantos quedan al mover el filtro. `sr-only` la saca ademas
          del flujo, asi que no ocupa nada. */}
      <p className="sr-only" role="status">
        {filas.length} {vista.cuenta(filas.length)}
      </p>

      {/* LA FRANJA DE HERRAMIENTAS. La misma que el panel del puesto, con la misma
          pieza: "Filtros" elige la categoría y dentro sus valores, y cada categoría
          que filtra deja su chip al lado. Aquí no hay vistas guardadas (se guardan
          con el id de un puesto y esta pantalla los mezcla), así que esa página del
          menú sencillamente no se pinta.

          Los chips van en UNA SOLA LÍNEA QUE SE DESPLAZA y no en una pila: al
          envolver, cada filtro nuevo empujaba la tabla hacia abajo y la pantalla se
          recolocaba sola justo al filtrar, que es cuando estás mirando el
          resultado. Y `overflow-x` recorta también en vertical, que es por lo que
          el desplegable de un chip sale en un portal (ver `ChipDimension`). */}
      {/* `py-4` y chips de 40px: EL MISMO AIRE QUE LA FRANJA DEL PANEL DE UN
          PUESTO (Mario, ago 2026), que es la fila con la que más se trabaja de la
          app. Aquí estaba en 12px sueltos, así que al ir de una pantalla a otra
          los filtros cambiaban de sitio. (Se probó además quitarle el margen a
          `PageHeader` para clavar también los 16px de encima: no se puede desde
          fuera, porque `mb-0` y el `mb-6` de la pieza son la MISMA utilidad de
          Tailwind y gana la que se emita después en el CSS, no la que se escriba
          al final del `className`. Es el mismo tropiezo que obligó a fabricar los
          botones de icono con `botonIcono()`.) */}
      <div className="mb-3 flex items-start gap-2 py-4">
        {opcionesPuesto.length > 1 && (
          <div className="shrink-0">
            <ChipDimension dim={dimPuesto} />
          </div>
        )}
        <div className="shrink-0">
          <MenuAnadirFiltro
            dimensiones={dimensiones}
            hayFiltros={nFiltrosMenu > 0}
            onLimpiarTodo={limpiarMenu}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dimensionesVisibles.map((d) => (
            <ChipDimension key={d.id} dim={d} />
          ))}
        </div>
      </div>

      {todos.length === 0 ? (
        <Vacio titulo={vista.vacio.titulo} texto={vista.vacio.texto} />
      ) : filas.length === 0 ? (
        <EmptySinResultado titulo={vista.vacioFiltrado} onLimpiar={limpiarTodo} />
      ) : (
        <>
          <ListaCandidatos
            rows={filas}
            caption={`${vista.label}: ${vista.sub}`}
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
          siblings={filas}
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
 * Vacio DE FILTRO, distinto del vacio de la vista. Decir "aun no tienes
 * candidatos" seria mentira: hay gente, solo que no en el puesto que has marcado.
 * Y lleva la salida puesta, porque el usuario no tiene por que acordarse de que
 * dejo un filtro. El titulo lo pone la vista: "ningun contratado en ese puesto"
 * dice mucho mas que un texto generico.
 */
function EmptySinResultado({ titulo, onLimpiar }: { titulo: string; onLimpiar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl filo bg-white px-6 py-16 text-center shadow-card">
      <IconoVacio Icon={SearchX} />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">Sigue habiendo gente en los demás.</p>
      <button type="button" onClick={onLimpiar} className={`${BTN_SECONDARY} mt-4`}>
        Ver todos los puestos
      </button>
    </div>
  )
}

/**
 * El vacio de VERDAD: en esta vista no hay nadie, y no es cosa de ningun filtro.
 *
 * El texto lo pone la vista y no esta pantalla, porque las tres se vacian por
 * motivos distintos: en Activos significa que aun no ha entrado nadie, y en
 * Contratados que todavia no has cerrado ninguna contratacion, que no es lo mismo
 * ni de lejos. Antes decia "Todo al dia", que era cierto de una cola de pendientes
 * y es falso de una lista de gente.
 */
function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl filo bg-white px-6 py-16 text-center shadow-card">
      <IconoVacio Icon={ContactRound} />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{texto}</p>
    </div>
  )
}

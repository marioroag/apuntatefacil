import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { Tabs, TabPanel, type TabItem } from '../components/ui/Tabs'
import {
  ChatComposer, ChatEmpty, ChatSkeleton, ChatThread,
  type ChatMessage,
} from '../components/ui/Chat'
import { useChatThread } from '../lib/useChatThread'
import { StatusSelect } from '../components/ui/StatusPill'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import type { Campaign, Candidate, CandidateEvent, CandidateStatus } from '../lib/types'
import { FAVORITO_STAR, SOURCE_META, STATUS_META } from '../lib/types'
import { CAMPOS_YA_PINTADOS, answerText, candidateName, fechaCorta, formatPhone, fullDateTime, fullDateTimeInZone, personLabel, relativeDate, shortWhenInZone } from '../lib/format'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { BTN_PRIMARY, BTN_PRIMARY_BLOCK, BTN_SECONDARY, BTN_SECONDARY_BLOCK, BTN_SECONDARY_SM, botonIcono } from '../lib/buttons'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { MaskedPhone } from '../components/MaskedPhone'
import { TagSection } from '../components/Tags'
import { InfoTooltip } from '../components/ui/Tooltip'
import { TAGS_ENABLED } from '../lib/pricing'
import { AgendarManualDialog } from '../components/InterviewAction'
import { currentInterview } from '../lib/interviews'
import { useEsMovil } from '../lib/media'
import { colocarFlotante } from '../lib/flotante'
import { InterviewConversation } from '../components/InterviewConversation'
import { MeridianAvatar, MeridianPanelBlock } from '../components/Meridian'
import { MERIDIAN_NAME, candidateFit } from '../lib/meridian'

/**
 * Detalle del candidato: pop-up con pestañas.
 *
 * Sustituye al SlideOver de 460 px (jul 2026). El panel lateral protegía una
 * cosa buena, que la lista filtrada siguiera a la vista, pero obligaba a apilar
 * en una columna estrecha todo lo que hay que saber de una persona, y no tenía
 * sitio para una conversación. El pop-up conserva la lista detrás (el telón es
 * translúcido), da dos columnas y añade lo que faltaba: pasar de un candidato al
 * siguiente sin cerrar, y un hilo donde el equipo habla del caso.
 *
 * Reparto: a la izquierda lo que DICE el candidato y se lee de arriba abajo
 * (el informe de Meridian, sus respuestas y sus documentos); a la derecha, en
 * un raíl SIN pestañas, lo que necesitas para actuar sobre él (sus datos, sus
 * etiquetas y el hilo de tu equipo). Las otras dos superficies largas, la
 * Conversación y el Historial, son pestañas de la izquierda.
 *
 * ESTO CAMBIÓ EN AGO 2026, con un diseño de Mario delante, y el motivo se veía
 * en pantalla: los HECHOS de una persona (su teléfono, su correo, cuándo entró,
 * cómo está etiquetada) estaban cada uno detrás de una pestaña distinta, y la
 * columna de la derecha, que mide 368px, se pasaba el día vacía enseñando un
 * hilo de dos mensajes. Había que ir y volver entre Resumen y Respuestas para
 * cruzar lo que alguien contestó con cómo llamarle. Ahora los hechos no se
 * piden: están puestos, y la pestaña se reserva para lo que de verdad es largo.
 *
 * Lo que el diseño proponía y NO se ha copiado, con su motivo:
 *   - Dos botones grandes en el raíl, "Contactar" y "Rechazar". El estado y las
 *     acciones viven en la cabecera desde ago 2026 y ahí se quedan: un segundo
 *     juego de acciones es una segunda puerta para lo mismo. Y "Rechazar"
 *     rompía dos reglas a la vez, porque descartar es un ESTADO (uno de los
 *     cinco, y reversible) y porque iba pintado de rojo, que en esta app avisa
 *     de un error o de algo que no se deshace.
 *   - "Puesto aplicado" como dato del raíl: ya está escrito debajo del nombre,
 *     en la cabecera, que es donde se lee a quién estás mirando.
 *   - "Notas" como nombre del hilo: son el chat del equipo desde jul 2026, con
 *     autor, fecha y menciones. Las notas internas ya no existen.
 *
 * Conversación es la superficie principal de la entrevista: se invita desde
 * ahí, se ve lo hablado y se toma el control. No hay bandeja global de
 * WhatsApp a propósito: obligaría a saltar entre dos sitios para entender a
 * una sola persona.
 */

/**
 * LAS CINCO VISTAS DE UN CANDIDATO, Y UNA SOLA PIEZA DE ESTADO PARA LAS DOS
 * SUPERFICIES.
 *
 * En escritorio, las tres primeras se apilan en la columna izquierda y las dos
 * últimas son pestañas; en móvil, las cinco comparten un grupo de pastillas.
 * Con dos estados (uno por superficie) la ficha se descuadraba al girar el
 * teléfono y "ver la entrevista" acertaba en un tamaño y fallaba en el otro, que
 * es exactamente el fallo que ya tuvo la versión de pestañas anidadas.
 */
type Vista = 'respuestas' | 'meridian' | 'documentos' | 'conversacion' | 'historial'

/** Las tres que en escritorio se leen seguidas en la columna. */
const ES_FICHA = ['respuestas', 'meridian', 'documentos'] as const
const esFicha = (v: Vista) => (ES_FICHA as readonly string[]).includes(v)

/**
 * El registro del grupo de pastillas de móvil. Respuestas la primera y por
 * defecto (es lo que se mira siempre); Documentos detrás de Meridian porque
 * muchas veces está vacío; y al final las dos superficies largas, que son a
 * donde se entra a propósito.
 */
const VISTAS: TabItem<Vista>[] = [
  { value: 'respuestas', label: 'Respuestas' },
  { value: 'meridian', label: MERIDIAN_NAME },
  { value: 'documentos', label: 'Documentos' },
  { value: 'conversacion', label: 'Conversación' },
  { value: 'historial', label: 'Historial' },
]

// 1024px: por debajo, la columna de conversación de 368px dejaría el contenido
// principal por debajo de un ancho legible.
function useDosColumnas(): boolean {
  const [dos, setDos] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setDos(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dos
}

export function CandidateModal({
  campaign,
  candidate,
  onClose,
  onDeleted,
  onOpenManageTags,
  maskPhone = false,
  siblings,
  onNavigate,
  focoInicial,
}: {
  campaign: Campaign
  candidate: Candidate | null
  onClose: () => void
  onDeleted: (c: Candidate) => void
  onOpenManageTags?: () => void
  maskPhone?: boolean
  /**
   * La lista visible (ya filtrada y ordenada), para pasar de uno a otro sin
   * cerrar. Sin ella no se pintan las flechas: es lo que pasa al abrir un
   * candidato desde el tablón de equipo, donde no hay lista detrás.
   */
  siblings?: Candidate[]
  onNavigate?: (id: string) => void
  /** A qué se viene: el `id` del control donde empieza el foco (ver `ui/Modal`).
   *  Lo usa el tablero para abrir la ficha con el cursor ya en la nota. */
  focoInicial?: string
}) {
  const { setFavorito, setStatus, deleteCandidate, loadCandidateComments, addCandidateComment, loadCandidateEvents, members, chatVersion } =
    useStore()
  const { role, user } = useAuth()
  const toast = useToast()
  // Respuestas es la de partida: es lo que se mira siempre, y el veredicto y los
  // documentos están a un toque.
  const [vista, setVista] = useState<Vista>('respuestas')
  const [agendarManual, setAgendarManual] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const barraRef = useRef<HTMLDivElement>(null)
  const dosColumnas = useDosColumnas()
  const esMovil = useEsMovil()

  const canManageTags = role !== 'encargado'
  // Con el pago por proceso todo el producto está incluido: las notas del equipo
  // y las entrevistas ya no se cortan por plan. En demo lo que cambia es que
  // llamar y escribir por WhatsApp avisan en vez de salir.

  // Al cambiar de candidato se vuelve a Información: cada persona se abre por
  // lo que ha contestado. Se ajusta DURANTE el render (patrón de React para
  // "estado derivado de una prop que cambia"), no en un efecto: un efecto
  // pintaría antes el candidato nuevo con la pestaña del viejo.
  const [visto, setVisto] = useState(candidate?.id ?? null)
  if (candidate && visto !== candidate.id) {
    setVisto(candidate.id)
    setVista('respuestas')
  }

  // Lleva DIRECTO a la conversación, a cualquier ancho: una sola pieza de estado.
  const abrirConversacion = () => setVista('conversacion')

  const open = !!candidate
  const name = candidate ? candidateName(candidate) || 'Sin nombre' : ''
  const phone = candidate ? String(candidate.answers['telefono'] ?? '') : ''
  const waPhone = phone ? '34' + phone.replace(/\D/g, '') : ''
  const fit = candidate ? candidateFit(candidate.ai) : null

  const i = siblings && candidate ? siblings.findIndex((c) => c.id === candidate.id) : -1
  const puedeNavegar = !!onNavigate && i >= 0 && !!siblings

  const irA = (n: number) => {
    if (!siblings || !onNavigate) return
    const destino = siblings[n]
    if (destino) onNavigate(destino.id)
  }

  const avisoDemo = () =>
    toast.show('En la demo solo puedes mirar. Crea tu cuenta para llamar o escribir a tus candidatos.')

  const borrar = () => {
    if (!candidate) return
    const removed = deleteCandidate(candidate.id)
    if (removed) onDeleted(removed)
    setConfirmarBorrado(false)
    onClose()
  }

  if (!candidate) return <Modal open={false} onClose={onClose} label="Candidato" children={null} />

  const cvField = campaign.fields.find((f) => f.type === 'file')
  const cvName = cvField ? String(candidate.answers[cvField.id] ?? '') : ''


  // EN ESCRITORIO, TRES PESTAÑAS; EN MÓVIL, NINGUNA (Mario, ago 2026: "podemos
  // quitar los tabs en móvil y añadirlos a ese grupo de pastillas"). Con las dos
  // barras puestas, un teléfono tenía DOS niveles de navegación para una sola
  // ficha, que es el fallo que ya se corrigió una vez este mes. Ahora en móvil
  // manda un único control, el de las pastillas, con las cinco vistas dentro.
  const tabsIzq: TabItem<'info' | 'conversacion' | 'historial'>[] = [
    { value: 'info', label: 'Información' },
    { value: 'conversacion', label: 'Conversación' },
    { value: 'historial', label: 'Historial' },
  ]


  const panelConversacion = (
    <InterviewConversation
      key={candidate.id}
      candidate={candidate}
      campaign={campaign}
      onScheduleManually={() => setAgendarManual(true)}
    />
  )

  // Los datos y las etiquetas: en el raíl si lo hay, y si no, arriba del todo de
  // Información. Es el MISMO objeto en las dos superficies, no dos copias: en
  // cuanto se separan, la primera que se toque deja mintiendo a la otra.
  // Los datos y las notas son el MISMO objeto en las dos superficies, no dos
  // copias: lo único que cambia es dónde caen. En el raíl van seguidos, porque
  // el raíl ES eso. En una sola columna se separan: los datos son cortos y van
  // arriba, donde se buscan, y las notas crecen sin techo, así que van al final
  // y no entre tú y lo que el candidato ha contestado.
  const cambiarEstado = (s: CandidateStatus) => void setStatus(candidate.id, s)

  // En el selector de móvil entra abierto y sin chevron: has tocado su
  // pastilla para leerlo (ver `plegable` en `MeridianPanelBlock`).
  const contenidoMeridian = <MeridianPanelBlock candidate={candidate} plegable={!esMovil} />
  const contenidoRespuestas = (
    <Respuestas campaign={campaign} candidate={candidate} maskPhone={maskPhone} conDocumentos={!!candidate.cvPath} />
  )
  // Alto declarado: el visor es un `flex-1` y dentro de una columna que scrollea
  // no tiene contra qué medirse, así que sin esto se quedaría en su `min-h`. El
  // techo en vh es para que en una pantalla baja no empuje el resto fuera.
  const contenidoDocumentos = candidate.cvPath ? (
    <div className="flex h-[520px] max-h-[68vh] flex-col">
      <Cv key={candidate.id} candidate={candidate} cvName={cvName} />
    </div>
  ) : (
    <p className="pb-3.5 text-[13px] leading-5 text-slate-500 sm:px-3.5">
      {cvField ? 'No ha subido ningún documento.' : 'Este formulario no pide documentos.'}
    </p>
  )
  const contenidoHistorial = (
    <Historial key={candidate.id} candidateId={candidate.id} load={loadCandidateEvents} yoEmail={user?.email} />
  )

  const acciones = (
    <AccionesCandidato
      candidate={candidate}
      onAgendar={() => setAgendarManual(true)}
      onVerEntrevista={abrirConversacion}
      onEstado={cambiarEstado}
    />
  )

  const datos = (
    <FichaDatos campaign={campaign} candidate={candidate} maskPhone={maskPhone} onEstado={cambiarEstado} />
  )
  const etiquetas = TAGS_ENABLED ? (
    <TagSection candidateId={candidate.id} tagIds={candidate.tagIds} canManage={canManageTags} onOpenManage={() => onOpenManageTags?.()} />
  ) : null
  const notas = (
    <NotasEquipo
      key={candidate.id}
      candidateId={candidate.id}
      chatVersion={chatVersion}
      currentUserId={user?.id ?? null}
      members={members}
      load={loadCandidateComments}
      onSend={addCandidateComment}
    />
  )

  return (
    <>
      <Modal open={open} onClose={onClose} labelledBy="candidato-nombre" inert={confirmarBorrado} focoInicial={focoInicial}>
        {/* En escritorio la cabecera respira más que en móvil: la identidad es lo
            primero que se lee de una persona y pegada al filo se leía como una
            barra de herramientas. */}
        {/* EN ESCRITORIO EL AIRE ES SIMÉTRICO (20 y 20). Estaba en 20 arriba y 14
            abajo, que venía de cuando debajo había una segunda fila con el estado
            y las acciones: entonces el relleno de abajo separaba de OTRA fila y
            tenía que ser menor. Retirada esa fila, lo que queda debajo es el filo
            que cierra la cabecera, y ahí el bloque de identidad se veía pegado al
            suelo (medido: 20 por arriba del avatar contra 15 por abajo).

            Aquí no hay que compensar nada a ojo, al revés que en la banda de
            acciones: arriba y abajo del avatar hay cantos duros, no texto, así
            que las cajas y lo que se ve miden lo mismo.

            En móvil la cabecera NO cierra con filo: la identidad y lo que puedes
            hacer con esa persona son un solo bloque, y la raya los partía por la
            mitad. La frontera se baja al pie de la banda de acciones, que es
            donde de verdad acaba "quién es y qué haces con él" y empieza el
            contenido; sin ella, los botones y DATOS corrían juntos (medido: la
            primera franja lleva `first:border-0`). En escritorio no hay banda,
            así que el filo se queda donde estaba. */}
        <header className="border-b border-slate-200 px-4 pb-2.5 pt-3.5 max-sm:border-b-0 sm:px-5 sm:py-5">
          {/* Los dos lados de la fila se centran ENTRE SÍ: con `items-start` las
              flechas y la equis se pegaban al techo y quedaban 4px por encima del
              centro del nombre, que es contra lo que las mira el ojo. */}
          <div className="flex items-center gap-3">
            {/* La cara y sus dos líneas son UN bloque centrado entre sí: con la fila
                entera en `items-start` el avatar se colgaba del techo de la
                cabecera, arrancaba por encima de la mayúscula del nombre y moría a
                media línea del puesto. Centrado, la cara y el nombre cuadran. */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <MeridianAvatar name={name} fit={fit ?? undefined} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h2 id="candidato-nombre" title={name} className="truncate text-xl font-semibold leading-tight text-slate-900">
                    {name}
                  </h2>
                  {/* La estrella no estira la línea del nombre (`-my-1`): su caja de
                      32px la hacía 7px más alta que el texto y descuadraba el bloque
                      contra la cara. El área de toque no cambia. */}
                  <Favorito value={candidate.favorito} onChange={(v) => void setFavorito(candidate.id, v)} />
                </div>
                {/* Sin etiqueta de ajuste: el anillo del avatar YA dice el encaje
                    (por longitud de arco) y repetirlo en palabras solo restaba
                    sitio al puesto. */}
                <p className="truncate text-[13px] text-slate-500">{campaign.title}</p>
              </div>
            </div>
            {/* Los tres botones de esta cabecera (las dos flechas y la equis) salen de
                `botonIcono('ghost')`, no de una pintura escrita aquí. La copia a mano
                llevaba dos peldaños de la rampa (reposo y hover) y se quedaba sin el
                tercero: al pulsarla no pasaba nada. El comentario vive en el div que
                los engloba a los tres, no dentro del de las flechas, porque si no,
                quien venga a tocar el cerrar no lo ve. */}
            <div className="flex shrink-0 items-center gap-0.5">
              {puedeNavegar && (
                <div className="hidden items-center gap-0.5 sm:flex">
                  <button
                    type="button"
                    aria-label="Candidato anterior"
                    disabled={i === 0}
                    onClick={() => irA(i - 1)}
                    className={botonIcono('ghost', 'md', 'disabled:pointer-events-none disabled:text-slate-300')}
                  >
                    <ArrowLeft className="size-[18px]" aria-hidden />
                  </button>
                  <span className="num px-1 text-[13px] text-slate-500">
                    {i + 1} de {siblings!.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Candidato siguiente"
                    disabled={i === siblings!.length - 1}
                    onClick={() => irA(i + 1)}
                    className={botonIcono('ghost', 'md', 'disabled:pointer-events-none disabled:text-slate-300')}
                  >
                    <ArrowRight className="size-[18px]" aria-hidden />
                  </button>
                </div>
              )}
              {/* El `···` sube aquí desde la fila de acciones que se retiró: es el
                  inventario de esta ficha (copiar el contacto, descargar el CV,
                  eliminar) y eliminar no tiene otra puerta.

                  SOLO DESDE `sm`, y no es una preferencia: en móvil ya vive en la
                  barra del pulgar, así que aquí sería el mismo menú dos veces, y
                  su caja le comía al nombre los 44px que necesita (se midió:
                  "Alberto Herrera" se quedaba en "Alberto Herr..."). En un móvil
                  el nombre es lo único que no se puede truncar sin perder de
                  quién es la ficha. */}
              <span className="hidden sm:inline-flex">
                <MenuAcciones candidate={candidate} cvName={cvName} onEliminar={() => setConfirmarBorrado(true)} variante="ghost" />
              </span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className={botonIcono('ghost', 'md')}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

        </header>

        {/* SIN RAÍL, LAS ACCIONES VIVEN ENCIMA DE LAS PESTAÑAS (Mario, ago 2026).
            Dentro de Información eran un apartado más, así que desaparecían al
            abrir la Conversación o el Historial, y lo que se puede HACER con una
            persona no depende de qué estés mirando de ella. Arriba hacen el mismo
            trabajo que el raíl en escritorio: están siempre, y la columna de
            debajo se queda entera para leer. Van en la banda de chrome, entre el
            filo de la cabecera y el de las pestañas, así que no necesitan raya
            propia.

            EL AIRE DE ABAJO ES MAYOR QUE EL DE ARRIBA A PROPÓSITO (16 contra 14),
            y es lo que hace que se vea igual: arriba lo que hay es TEXTO, cuya
            caja se estira por debajo de la línea de base, así que del último
            trazo del subtítulo al botón hay ~20px reales; abajo hay un filo, que
            es un canto duro y sin holgura. Midiendo cajas salían iguales y el ojo
            los veía descompensados, que es la diferencia entre alinear números y
            alinear lo que se ve. */}
        {!dosColumnas && (
          <div className="shrink-0 px-4 pb-4 pt-1 max-sm:border-b max-sm:border-slate-200 sm:px-5">{acciones}</div>
        )}

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            {/* La barra de pestañas NO se pinta en móvil: allí la navegación es el
                grupo de pastillas de dentro de la columna. Se monta o no se monta,
                no se esconde con CSS: una pestaña en `display:none` sigue siendo
                alcanzable con las flechas del teclado. */}
            {!esMovil && (
              <Tabs
                items={tabsIzq}
                value={esFicha(vista) ? 'info' : (vista as 'conversacion' | 'historial')}
                onChange={(v) => setVista(v === 'info' ? 'respuestas' : v)}
                idPrefix="cand"
                label="Secciones del candidato"
                className="shrink-0 px-4 sm:px-5"
              />
            )}
            {/* En móvil NO es un `tabpanel`: sin barra de pestañas arriba, su
                `aria-labelledby` apuntaría a una pestaña que no existe, y el
                lector anunciaría un panel sin dueño. Es la columna y ya está; el
                panel de verdad es el del grupo de pastillas de dentro. */}
            <Envoltorio
              esPanel={!esMovil}
              idPrefix="cand"
              value={esFicha(vista) ? 'info' : vista}
              className={`min-h-0 flex-1 ${
                esMovil || esFicha(vista)
                  ? 'overflow-y-auto overscroll-contain px-4 py-5 sm:px-5'
                  : 'flex flex-col overflow-hidden bg-slate-50/60'
              }`}
            >
              {(esMovil || esFicha(vista)) && (
                // En móvil no hay `space-y`: separan las franjas y su relleno (ver
                // `Seccion`). A partir de `sm` vuelve el aire de siempre.
                <div className="sm:space-y-6">
                  {/* EL ORDEN DE MÓVIL LO DECIDE LO QUE SE USA, NO EL DE ESCRITORIO
                      (Mario, ago 2026: "en móvil está hecho un lío... una de las
                      funciones principales es etiquetar y ver información").

                      Sin raíl, los siete apartados caían en una columna de 1318px,
                      o sea DOS PANTALLAS Y MEDIA, en el orden del escritorio: las
                      etiquetas empezaban en el píxel 993 de los 623 que se ven.
                      Justo lo que más se usa era lo más lejano. Ahora arriba van
                      los datos y las etiquetas, y todo lo demás cabe detrás de un
                      solo control.

                      En escritorio esto pinta solo las tres piezas de la columna
                      izquierda, apiladas y con su tarjeta: allí hay alto de sobra
                      y esconder dos detrás de un toque sería cobrar un clic por
                      nada. */}
                  {!dosColumnas && <Seccion>{datos}</Seccion>}

                  {esMovil ? (
                    <Seccion>
                      {/* LAS CINCO VISTAS EN UN GRUPO DE PASTILLAS (referencia de
                          JOIN, Mario ago 2026). Las tres de la ficha suman 614px de
                          los 623 que se ven en un teléfono, o sea que empujaban las
                          notas a la tercera pantalla; y la Conversación y el
                          Historial vivían en una segunda barra de navegación arriba.
                          Juntas ocupan lo que ocupe UNA, con un solo control, y el
                          rótulo de cada apartado deja de hacer falta: lo dice la
                          pastilla activa.

                          `-mx-1` porque la pastilla activa tiene relleno propio: sin
                          él, la primera etiqueta se descuelga a la derecha del
                          rótulo de la franja de arriba. */}
                      <Tabs
                        items={VISTAS}
                        value={vista}
                        onChange={setVista}
                        idPrefix="vista"
                        label="Qué quieres ver de este candidato"
                        variante="pastilla"
                        className="-mx-1"
                      />
                      <TabPanel idPrefix="vista" value={vista} className="pt-4">
                        {vista === 'respuestas' ? contenidoRespuestas
                          : vista === 'meridian' ? contenidoMeridian
                          : vista === 'documentos' ? contenidoDocumentos
                          // La conversación y el historial mandan su propio alto
                          // (son columnas flex con scroll), así que dentro de una
                          // columna que ya scrollea hay que dárselo declarado o se
                          // quedan en cero.
                          : (
                            <div className="flex h-[420px] max-h-[60vh] flex-col overflow-hidden rounded-xl filo bg-slate-50/60">
                              {vista === 'conversacion' ? panelConversacion : contenidoHistorial}
                            </div>
                          )}
                      </TabPanel>
                    </Seccion>
                  ) : (
                    <>
                      <Seccion>{contenidoMeridian}</Seccion>
                      <Seccion>
                        <Bloque titulo="Respuestas" tarjeta>{contenidoRespuestas}</Bloque>
                      </Seccion>
                      {/* EL APARTADO SE PINTA SIEMPRE, tenga o no documentos: una
                          ficha que cambia de apartados según lo que traiga cada
                          persona obliga a releerla entera cada vez. Y el vacío dice
                          CUÁL de los dos vacíos es, que no significan lo mismo. */}
                      <Seccion>
                        <Bloque titulo="Documentos" tarjeta>{contenidoDocumentos}</Bloque>
                      </Seccion>
                    </>
                  )}

                  {/* Etiquetas y notas van JUNTAS y detrás del selector (Mario, ago
                      2026): así la columna de móvil se lee en los mismos tres
                      tramos que el raíl, sus datos · lo que trae él · lo que
                      ponéis vosotros. Se paga que etiquetar vuelva a caer por
                      debajo del pliegue, y se acepta porque lo que se gana es que
                      la clasificación esté donde está su hermana, la nota, y no
                      partida por en medio de lo que dice el candidato. */}
                  {!dosColumnas && etiquetas && <Seccion>{etiquetas}</Seccion>}
                  {!dosColumnas && <Seccion>{notas}</Seccion>}
                </div>
              )}
              {!esMovil && vista === 'conversacion' && panelConversacion}
              {!esMovil && vista === 'historial' && contenidoHistorial}
            </Envoltorio>
          </section>

          {/* EL RAÍL NO TIENE PESTAÑAS, Y ES UNA SOLA COLUMNA CON UN SOLO SCROLL.
              Aquí vive lo que tu equipo necesita de una persona: sus datos, cómo
              la tenéis clasificada y lo que os habéis dicho sobre ella. Estaba
              repartido entre cuatro pestañas (dos a la izquierda y dos más
              dentro del panel de la derecha), así que leer un teléfono o ver si
              alguien había apuntado algo costaba clics; ahora está puesto, y no
              se va cuando abres la Conversación o el Historial.

              LAS NOTAS VAN INTEGRADAS EN LA COLUMNA, no en un panel aparte con
              su barra de scroll y su campo pegado abajo (Mario, ago 2026: "más
              tipo notas de equipo que un chat"). No es solo aspecto: pinchado
              abajo, el hilo o metía una SEGUNDA barra de scroll en una columna
              de 368px, o se quedaba en 40px de alto en un portátil de 720
              (medido: los datos piden 353 de los 508 que da el raíl, y del resto
              se comían 81 el campo y 33 el rótulo). Es la misma lección que la
              lista de puestos del lateral: dos barras pegadas en una columna
              estrecha son peor problema que el que resuelven.

              El raíl puede quedarse medio vacío en una pantalla alta, y está
              bien: el vacío no se reparte, se deja donde cae. */}
          {/* SE MONTA, no se esconde con `hidden lg:block`. Dentro hay campos con
              id (el de añadir etiqueta y el de escribir una nota) y un hilo que
              se carga solo: montado y oculto, por debajo de 1024px había dos de
              cada uno en la página, con los mismos ids y dos peticiones para el
              mismo hilo. Es la misma regla que ya obliga a montar `BottomSheet`
              solo en móvil. */}
          {dosColumnas && (
            <aside className="w-[368px] shrink-0 space-y-5 overflow-y-auto overscroll-contain border-l border-slate-200 bg-white px-4 py-4">
              {acciones}
              {datos}
              {/* LA RAYA PARTE EL RAÍL EN DOS (Mario, ago 2026): por encima, lo que
                  dice el CANDIDATO; por debajo, lo que pone TU EQUIPO. Vive AQUÍ y
                  no dentro de `TagSection` ni del bloque de etiquetas, porque la
                  frontera es de esta columna: el tablón usa la misma pieza y allí
                  no separa nada, y en móvil el reparto es otro (ver el orden de
                  Información) y la raya mentiría. */}
              {etiquetas && <div className="border-t border-slate-200 pt-5">{etiquetas}</div>}
              {notas}
            </aside>
          )}
        </div>

        {/* Barra de acción de móvil: el pulgar llega y no roba sitio arriba.
            Solo en Información: en la Conversación y en el Historial la columna
            es lo único que hay y ahí manda lo que se lee. */}
        {/* SE MONTA, no se esconde con `sm:hidden`. Dentro hay un `MenuAcciones`,
            y su desplegable sale por un PORTAL a `document.body`: el `hidden` de
            la barra no lo alcanza, así que al abrirlo en un móvil y ensanchar la
            ventana el menú se quedaba flotando sobre el escritorio, encima de
            una barra que ya no se veía. Es la misma regla que ya obliga a montar
            `BottomSheet` solo en móvil y el raíl solo cuando existe. */}
        {esMovil && esFicha(vista) && (
          <div ref={barraRef} className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
            {phone ? (
              <>
                <a
                  href={maskPhone ? undefined : `tel:${phone.replace(/\s/g, '')}`}
                  onClick={maskPhone ? avisoDemo : undefined}
                  className={`${BTN_PRIMARY} flex-1`}
                >
                  <Phone className="size-4 text-indigo-200" aria-hidden /> Llamar
                </a>
                {waPhone &&
                  (maskPhone ? (
                    <button type="button" onClick={avisoDemo} className={`${BTN_SECONDARY} flex-1`}>
                      <MessageCircle className="size-4 text-slate-400" aria-hidden /> WhatsApp
                    </button>
                  ) : (
                    <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className={`${BTN_SECONDARY} flex-1`}>
                      <MessageCircle className="size-4 text-slate-400" aria-hidden /> WhatsApp
                    </a>
                  ))}
              </>
            ) : (
              <span className="flex-1 text-[13px] text-slate-500">Sin teléfono en la candidatura.</span>
            )}
            <MenuAcciones candidate={candidate} cvName={cvName} onEliminar={() => setConfirmarBorrado(true)} banda={barraRef} />
          </div>
        )}
      </Modal>

      <AgendarManualDialog
        open={agendarManual}
        candidate={candidate}
        onClose={() => setAgendarManual(false)}
      />

      <ConfirmDialog
        open={confirmarBorrado}
        onClose={() => setConfirmarBorrado(false)}
        onConfirm={borrar}
        title="¿Eliminar esta candidatura?"
        confirmLabel="Eliminar"
        confirmVariant="danger"
      >
        {/* El deshacer del aviso recupera al candidato, pero NO su conversación:
            los mensajes se borran en cascada y no se pueden reinsertar con su
            autor. Se dice antes, no después. */}
        Se elimina también lo que haya escrito tu equipo sobre esta persona. Puedes recuperar la candidatura desde el aviso, pero la
        conversación no.
      </ConfirmDialog>
    </>
  )
}

/**
 * Favorito: una sola estrella pegada al nombre. Es un interruptor ("a este lo
 * quiero"), no una nota con matices, y por eso sustituyó a las 5 estrellas.
 *
 * ES DORADA (Mario, ago 2026, y antes iba en el acento): el par de tonos vive
 * en `FAVORITO_STAR`, que es lo que pintan también la tabla y el filtro.
 *
 * El `-my-1` es cosa de la cabecera, no del botón: su caja de 32px hacía la
 * línea del nombre 7px más alta que el texto.
 */
function Favorito({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      aria-label={value ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      onClick={() => onChange(!value)}
      className="group -my-1 grid size-8 pointer-coarse:size-11 shrink-0 place-items-center rounded-lg transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)]"
    >
      {/* El press es `translate-y-px` en el botón, nunca `scale` en el icono: un
          control se hunde, no se encoge. El `scale` es lenguaje de dibujo animado
          y aquí desentonaba contra los 16 botones del sistema.

          El hover NO pinta una placa gris detrás: la respuesta ocurre DENTRO del
          glifo, que se rellena de amarillo al 35%. Es el adelanto de lo que va a
          pasar al pulsar (la estrella se rellena del todo), en vez de un fondo
          que no significa nada y que además metía un rectángulo gris pegado al
          nombre. El color lo lleva SIEMPRE el icono, nunca el botón: si el botón
          pusiera el suyo, el `text-amber-500` del glifo encendido lo taparía y
          el hover de "quitar de favoritos" no se vería. */}
      <Star
        className={`size-[18px] [stroke-width:1.75] transition-[color,fill] duration-[var(--duration-control)] ease-[var(--ease-out)] ${
          value
            ? `${FAVORITO_STAR} group-hover:text-amber-600`
            : 'fill-transparent text-slate-400 group-hover:fill-amber-400/35 group-hover:text-amber-500'
        }`}
        aria-hidden
      />
    </button>
  )
}

/**
 * Un correo largo que no cabe debe partirse por la arroba, no a mitad del
 * dominio. El `<wbr>` marca ese punto preferente y no añade ningún carácter al
 * copiar; `break-words` queda de red por si ni la parte local cabe.
 */
function conCorte(valor: string) {
  const at = valor.indexOf('@')
  if (at < 0) return valor
  return (
    <>
      {valor.slice(0, at + 1)}
      <wbr />
      {valor.slice(at + 1)}
    </>
  )
}

/** Valor que se copia de un toque (teléfono, correo). */
function ValorCopiable({ valor, etiqueta, num, truncar = false }: { valor: string; etiqueta: string; num?: boolean; truncar?: boolean }) {
  const [copiado, setCopiado] = useState(false)
  const toast = useToast()
  return (
    <button
      type="button"
      aria-label={`Copiar ${etiqueta.toLowerCase()}: ${valor}`}
      onClick={async () => {
        const ok = await copyText(valor)
        if (!ok) {
          toast.show(`Copia ${etiqueta.toLowerCase()} manualmente: ${valor}`)
          return
        }
        setCopiado(true)
        window.setTimeout(() => setCopiado(false), 1600)
      }}
      className="group -ml-1 flex max-w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-100"
    >
      {/* min-w-0 hace que el flex pueda encoger por debajo del ancho del texto
          (sin él, un correo largo se salía de la tarjeta). Con el <wbr> de
          `conCorte`, `break-words` ya tiene por dónde partir y respeta la
          arroba; `break-all` cortaba el dominio por cualquier letra. */}
      <span className={`min-w-0 group-hover:underline ${truncar ? 'truncate' : 'break-words'} ${num ? 'num' : ''}`}>
        {truncar ? valor : conCorte(valor)}
      </span>
      {copiado ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-slate-600" aria-hidden />
      ) : (
        <Copy className="mt-0.5 size-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" aria-hidden />
      )}
      <span className="sr-only" role="status">
        {copiado ? 'Copiado' : ''}
      </span>
    </button>
  )
}

function Dato({
  label,
  children,
  info,
  ancho = false,
}: {
  label: string
  children: React.ReactNode
  /** La aclaración se PIDE, no se imprime debajo. Ver `FichaDatos`. */
  info?: string
  /** Ocupa las dos columnas de la rejilla. Lo pide el correo, que es el único
   *  dato de la ficha que crece sin límite. */
  ancho?: boolean
}) {
  return (
    <div className={`min-w-0 ${ancho ? 'col-span-2' : ''}`}>
      <dt className="flex items-center gap-1 text-[12px] text-slate-500">
        {label}
        {info && <InfoTooltip text={info} />}
      </dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  )
}

/**
 * UNA FRANJA DE LA COLUMNA DE MÓVIL, separada de la siguiente por un filo de
 * lado a lado (referencia: JOIN, ago 2026).
 *
 * Sin raíl, los siete apartados caen en una sola columna, y estaban separados
 * solo por 24px de aire mientras cada uno se pintaba de una manera distinta:
 * tres tarjetas con borde, tres bloques sueltos con su versalita y una fila de
 * botones. Siete cosas con tres tratamientos y ningún ritmo, que es exactamente
 * lo que se lee como "un lío": el ojo no puede decir dónde acaba una y empieza
 * otra sin leerlas.
 *
 * La respuesta no es meterlo todo en tarjetas (siete cajas con borde apiladas en
 * 375px son siete objetos flotando), es lo contrario: **todo plano, y el filo
 * hace de frontera**. Va de lado a lado (`-mx-4` contra el relleno de la
 * columna) para que se lea como el corte de una sección y no como el borde de
 * una caja; los filos de DENTRO de un apartado (las filas de Respuestas) sí van
 * metidos, y esa diferencia es la que da la jerarquía.
 *
 * A partir de `sm` no se pinta nada: ahí el pop-up es una tarjeta ancha, las
 * tarjetas de dentro caben y el aire basta para separar.
 */
/** La columna: `tabpanel` donde hay pestañas encima, y un div cuando no. */
function Envoltorio({
  esPanel,
  idPrefix,
  value,
  className,
  children,
}: {
  esPanel: boolean
  idPrefix: string
  value: string
  className: string
  children: React.ReactNode
}) {
  if (!esPanel) return <div className={className}>{children}</div>
  return (
    <TabPanel idPrefix={idPrefix} value={value} className={className}>
      {children}
    </TabPanel>
  )
}

function Seccion({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-sm:-mx-4 max-sm:border-t max-sm:border-slate-200 max-sm:px-4 max-sm:py-5 max-sm:first:border-0 max-sm:first:pt-0">
      {children}
    </div>
  )
}

/** La versalita de un apartado de la ficha. Una sola, para que no acaben
 *  conviviendo dos tamaños de rótulo en la misma columna. */
const ROTULO = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500'

/**
 * El rótulo de un apartado de la ficha, con dos formas y una regla para elegir:
 * **si el apartado tiene tarjeta, el título va DENTRO** (Mario, ago 2026).
 *
 * Flotando encima de una caja con filo, el título se lee como si rotulara la
 * zona de la pantalla y no lo que hay en la caja, y deja un renglón suelto entre
 * dos tarjetas que no pertenece a ninguna de las dos. Dentro, es la primera
 * banda de la propia tarjeta, separada por un filo, igual que la cabecera de la
 * tabla del puesto. Donde NO hay tarjeta (los apartados del raíl, que son texto
 * sobre el fondo) no hay dentro al que meterlo, y el rótulo se queda encima.
 */
function Bloque({
  titulo,
  children,
  tarjeta = false,
}: {
  titulo: string
  children: React.ReactNode
  tarjeta?: boolean
}) {
  if (!tarjeta) {
    return (
      <section>
        <h3 className={`mb-2 ${ROTULO}`}>{titulo}</h3>
        {children}
      </section>
    )
  }
  // `overflow-clip` y no `hidden`: recorta el arco de la esquina con el mismo
  // radio (el hijo es una caja cuadrada y pintaría su fondo sobre el filo) sin
  // convertir la tarjeta en contenedor de scroll.
  //
  // LA TARJETA EXISTE DESDE `sm`. En un teléfono, la columna se organiza con
  // franjas planas y filos de lado a lado (ver `Seccion`), así que una caja con
  // borde dentro de una franja son dos fronteras a 16px una de otra. Lo que
  // sobrevive en las dos es el rótulo: dentro de la tarjeta arriba, y en móvil
  // encabezando su franja.
  return (
    <section className="sm:overflow-clip sm:rounded-xl sm:filo">
      {/* SIN FILO DEBAJO (Mario, ago 2026): el rótulo se lee como el título de
          la tarjeta, igual que el de Meridian, no como la cabecera de una tabla
          que anuncia columnas. Con la raya puesta, la tarjeta parecía tener dos
          zonas y la primera fila de datos empezaba con un peldaño de más. El
          relleno lateral es el MISMO que el de las filas (`px-3.5`), o el título
          no cae en la vertical de lo que rotula. */}
      <h3 className={`pb-2 sm:px-3.5 sm:pt-3 ${ROTULO}`}>{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * LAS DOS ACCIONES DE UNA PERSONA, arriba del raíl (diseño de Mario, ago 2026).
 *
 * Sustituyen a la fila de decisión que vivía bajo el nombre (pastilla de estado,
 * agendar, llamar, WhatsApp y el `···`), que era una barra de herramientas justo
 * donde se lee quién es alguien. Ahora la cabecera es identidad y navegación, y
 * lo que se HACE está donde se decide, encima de sus datos.
 *
 * **UNA SOLA ACCIÓN PRINCIPAL POR ESTADO**, que es lo que convierte dos botones
 * en un proceso: el botón dice cuál es el siguiente paso, no todos los posibles.
 *   · nuevo / contactado -> agendar la entrevista
 *   · entrevista         -> confirmar que se contrata
 *   · contratado         -> ninguna: el proceso acabó
 *   · descartado         -> ninguna, y la secundaria pasa a devolverlo a la lista
 *
 * Tres cosas del diseño que NO se copian, y las tres son doctrina escrita de este
 * proyecto:
 *   1. **"Rechazar" en rojo.** Descartar es rutina y es reversible, así que su
 *      color es slate apagado y nunca rojo; el rojo avisa de un error o de algo
 *      que no se deshace. Va en secundario.
 *   2. **"Rechazar" como palabra.** El estado se llama "descartado" y el glosario
 *      está congelado: dos palabras para lo mismo es como empieza a haber dos
 *      conceptos. El verbo es "Descartar".
 *   3. **Iconos dentro de un botón de ancho completo.** Ahí se centra el grupo
 *      icono+texto, así que el RÓTULO queda descentrado (12px medidos en "Crear
 *      puesto"). Un botón de bloque va con la etiqueta sola.
 *
 * PENDIENTE, y por eso el botón dice hoy "Agendar entrevista" y no "Invitar":
 * la invitación con la disponibilidad del calendario de quien invita no existe
 * todavía (hace falta la integración con Google Calendar, una página pública
 * donde el candidato elija hueco y el correo que la lleva). Mientras tanto, la
 * acción que se ofrece es la que funciona ENTERA, que es apuntar la cita a mano;
 * es la misma regla que aplica `WHATSAPP_LISTO` en el resto de la ficha: nunca
 * se ofrece una acción que acabe en un mensaje que no sale.
 */
function AccionesCandidato({
  candidate,
  onAgendar,
  onVerEntrevista,
  onEstado,
}: {
  candidate: Candidate
  onAgendar: () => void
  onVerEntrevista: () => void
  onEstado: (s: CandidateStatus) => void
}) {
  const { interviewsFor } = useStore()
  const entrevista = currentInterview(interviewsFor(candidate.id), candidate.id)
  const confirmada =
    (entrevista?.status === 'confirmada' || entrevista?.status === 'reprogramando') && entrevista.startsAt
      ? entrevista
      : null
  const s = candidate.status

  const principal =
    s === 'entrevista' ? (
      <button type="button" onClick={() => onEstado('contratado')} className={BTN_PRIMARY_BLOCK}>
        Confirmar contratado
      </button>
    ) : s === 'nuevo' || s === 'contactado' ? (
      <button type="button" onClick={onAgendar} className={BTN_PRIMARY_BLOCK}>
        Agendar entrevista
      </button>
    ) : null

  return (
    <div className="space-y-2">
      {/* EN MÓVIL LOS DOS BOTONES COMPARTEN FILA (44px en vez de 132). Apilados
          son la mitad de la primera pantalla de un teléfono para dos verbos que
          caben de sobra en 165px cada uno. Es una REJILLA y no un `flex-row`:
          `BTN_*_BLOCK` ya trae `w-full`, y `w-full` con `flex-1` son el mismo eje
          y no se resuelven por el orden en que se escriben; en una celda de grid,
          el `w-full` hace justo lo que dice. */}
      <div className="grid gap-2 max-sm:grid-cols-2">
        {principal}
        {s === 'descartado' ? (
          // Descartar es reversible y se dice con un botón, no con una
          // advertencia: vuelve a "nuevo" porque es el único estado que no
          // afirma nada sobre el trato que ya ha habido, y el historial conserva
          // por dónde pasó.
          <button type="button" onClick={() => onEstado('nuevo')} className={BTN_SECONDARY_BLOCK}>
            Devolver a la lista
          </button>
        ) : (
          <button type="button" onClick={() => onEstado('descartado')} className={BTN_SECONDARY_BLOCK}>
            Descartar
          </button>
        )}
      </div>

      {/* CUÁNDO es la cita no se pierde con la fila que se retiró. Es una línea y
          no un tercer botón: no es una acción sobre la persona, es un dato que
          además lleva a donde se ve entera. */}
      {confirmada && (
        <button
          type="button"
          onClick={onVerEntrevista}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[13px] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <CalendarDays className="size-3.5 text-amber-500" aria-hidden />
          <span className="num">Entrevista · {shortWhenInZone(confirmada.startsAt!, confirmada.timezone)}</span>
        </button>
      )}
    </div>
  )
}

/**
 * El campo de correo que la ficha pinta en Contacto: el PRIMERO de tipo email.
 * Lo usan `FichaDatos` (para pintarlo) y `Respuestas` (para no repetirlo), y por
 * eso es una función y no la misma línea escrita dos veces: con un formulario
 * que pida dos correos, quien lo escribiera al revés se dejaría el segundo sin
 * enseñar en ningún sitio.
 */
const campoCorreo = (campaign: Campaign) => campaign.fields.find((f) => f.type === 'email')

/**
 * LOS HECHOS DE UNA PERSONA, EN UNA COLUMNA. Vive en el raíl de escritorio y,
 * donde no hay raíl, arriba de Información.
 *
 * En UNA columna y no en la rejilla de dos que tenía en el Resumen: el raíl mide
 * 336px de contenido, así que partirlo en dos dejaba el correo en 156px, o sea
 * "daniel.moreno1…" con el dominio cortado, que es justo el dato que se copia
 * para escribirle. Aquí el vacío se deja donde cae.
 *
 * Dos apartados y no uno: "Recibida" y "Origen" nunca fueron contacto, y los
 * arrastraba ahí el título de un bloque que se llamaba así por sus dos primeras
 * filas.
 */
function FichaDatos({
  campaign,
  candidate,
  maskPhone,
  onEstado,
}: {
  campaign: Campaign
  candidate: Candidate
  maskPhone: boolean
  onEstado: (s: CandidateStatus) => void
}) {
  const phone = String(candidate.answers['telefono'] ?? '')
  const campo = campoCorreo(campaign)
  const correo = campo ? String(candidate.answers[campo.id] ?? '') : ''

  return (
    <div className="space-y-5">
      <Bloque titulo="Datos">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Dato label="Teléfono">
            {!phone ? (
              <span className="font-normal text-slate-500">No disponible</span>
            ) : maskPhone ? (
              <MaskedPhone value={formatPhone(phone)} />
            ) : (
              <ValorCopiable valor={formatPhone(phone)} etiqueta="Teléfono" num truncar />
            )}
          </Dato>
          {/* La fecha SOLA, en su casilla, se dice corta: aquí se compara el día,
              y la hora exacta cambia de canal (al `title` y al `datetime`), que
              es lo que ya hace la columna Recibida de la tabla. Escrita entera no
              cabía en media rejilla de 336px y rompía la fila en dos líneas. */}
          <Dato label="Recibida">
            <time dateTime={candidate.submittedAt} title={fullDateTime(candidate.submittedAt)} className="num">
              {fechaCorta(candidate.submittedAt)}
            </time>
          </Dato>
          <Dato label="Origen">{SOURCE_META[candidate.source].label}</Dato>
          {/* EL ESTADO ES UN DATO MÁS, y vive aquí desde que la cabecera se quedó
              en la identidad (Mario, ago 2026). Estaba en su propia fila debajo
              del nombre; en el raíl cae al lado del origen, que es su hermano
              natural (de dónde vino y en qué punto está), y con los dos botones
              de acción justo encima, que son quienes lo mueven. Ocupa el hueco
              que tenía "Interés actual", que se retiró de la ficha: esa señal se
              sigue viendo en la fila de la lista, y con el canal de WhatsApp
              apagado casi siempre decía "sin comprobar". */}
          <Dato label="Estado">
            <StatusSelect status={candidate.status} onChange={onEstado} />
          </Dato>
          {/* EL CORREO ES UN ENLACE, no un valor que se copia (Mario, ago 2026):
              es el único dato de este bloque con el que se puede HACER algo
              desde aquí, y `mailto:` lo hace en un clic en vez de en tres
              (copiar, abrir el correo, pegar). Mismo tratamiento que la columna
              de correo de la tabla. El teléfono se queda copiable: su acción de
              verdad (llamar, WhatsApp) está en la cabecera, y lo que se hace con
              el número es pegarlo en otro sitio.

              Y va el ÚLTIMO, debajo de Origen e Interés: es el único que ocupa
              las dos columnas, así que en medio partía la rejilla en dos mitades
              de dos casillas y el ojo perdía la vertical. Al final, las cuatro
              casillas cortas forman un bloque limpio y el ancho cierra. */}
          <Dato label="Correo" ancho>
            {correo ? (
              <a
                href={`mailto:${correo}`}
                title={correo}
                className="block truncate rounded-sm text-indigo-600 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
              >
                {correo}
              </a>
            ) : (
              <span className="font-normal text-slate-500">No disponible</span>
            )}
          </Dato>
        </dl>
      </Bloque>

    </div>
  )
}

function Respuestas({
  campaign,
  candidate,
  maskPhone,
  conDocumentos,
}: {
  campaign: Campaign
  candidate: Candidate
  maskPhone: boolean
  /**
   * Hay un bloque de Documentos justo debajo. Entonces la fila del campo de
   * archivo sobra: sería el nombre del fichero escrito dos veces, una como
   * respuesta y otra encima del visor. Sin documento SÍ se pinta, porque
   * "No disponible" es información: esa persona no mandó el CV que se le pidió.
   */
  conDocumentos: boolean
}) {
  // Fuera lo que la ficha YA pinta por su cuenta: el nombre es el título, y el
  // teléfono y el correo tienen su apartado en Contacto, a dos dedos de aquí.
  // Antes vivían en pestañas distintas y la repetición no se veía; con las dos
  // cosas en pantalla a la vez, la lista de respuestas empezaba contestando
  // preguntas que ya estaban contestadas arriba.
  const correo = campoCorreo(campaign)
  const campos = campaign.fields.filter(
    (f) =>
      !CAMPOS_YA_PINTADOS.includes(f.id) &&
      f.id !== correo?.id &&
      !(conDocumentos && f.type === 'file'),
  )
  // Un formulario que solo pide nombre y teléfono se queda sin nada que enseñar
  // aquí, y una tarjeta vacía con su rótulo es peor que ninguna.
  if (!campos.length) return null
  return (
    <dl className="divide-y divide-slate-100">
      {campos.map((f) => {
        const raw = candidate.answers[f.id]
        const texto = answerText(raw)
        const esNumerico = ['phone', 'number', 'date'].includes(f.type)
        return (
          <div key={f.id} className="grid grid-cols-[38%_62%] gap-3 py-2.5 sm:px-3.5">
            <dt className="break-words text-[13px] text-slate-500">{f.label}</dt>
            <dd className={`break-words text-sm font-medium text-slate-900 ${esNumerico ? 'num' : ''}`}>
              {texto === 'No disponible' ? (
                <span className="font-normal text-slate-500">No disponible</span>
              ) : f.type === 'file' && candidate.cvPath ? (
                <span className="inline-flex items-start gap-1.5">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
                  <span className="break-all">{texto}</span>
                </span>
              ) : maskPhone && f.type === 'phone' ? (
                <MaskedPhone value={formatPhone(String(raw))} />
              ) : f.type === 'phone' ? (
                <ValorCopiable valor={formatPhone(String(raw))} etiqueta={f.label} num />
              ) : f.type === 'email' ? (
                // Teléfono y correo son lo que se pega en otro sitio (WhatsApp,
                // el correo, el parte). Se copian igual aquí que en Resumen.
                <ValorCopiable valor={String(raw)} etiqueta={f.label} />
              ) : (
                texto
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/**
 * Visor del CV. Se firma la URL del bucket privado y se pinta dentro del pop-up:
 * abrir el CV era salir de la app a una pestaña nueva y volver.
 *
 * Solo el PDF se puede ver embebido. El formulario admite .doc y .docx, y un
 * iframe con un .docx muestra un rectángulo en blanco o lo descarga a la brava;
 * para esos se dice claro y se ofrece descargarlo.
 */
function Cv({ candidate, cvName }: { candidate: Candidate; cvName: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [peso, setPeso] = useState<string | null>(null)
  const toast = useToast()
  const path = candidate.cvPath ?? ''
  const esPdf = path.toLowerCase().endsWith('.pdf')

  useEffect(() => {
    let vivo = true
    // Sin reiniciar url/error aquí: el visor se remonta por `key` al cambiar de
    // candidato, así que el estado inicial ya es el correcto.
    // La firma caduca: se pide al abrir la pestaña y se renueva al reintentar.
    void supabase.storage
      .from('cvs')
      .createSignedUrl(path, 600)
      .then(({ data, error: e }) => {
        if (!vivo) return
        if (e || !data?.signedUrl) setError(true)
        else setUrl(data.signedUrl)
      })
    // El tamaño es un extra: si Storage no lo da, simplemente no se pinta.
    const dir = path.split('/').slice(0, -1).join('/')
    const file = path.split('/').pop() ?? ''
    void supabase.storage
      .from('cvs')
      .list(dir, { search: file })
      .then(({ data }) => {
        if (!vivo) return
        const size = data?.find((f) => f.name === file)?.metadata?.size
        if (typeof size === 'number') setPeso(`${Math.max(1, Math.round(size / 1024))} KB`)
      })
    return () => {
      vivo = false
    }
  }, [path])

  const descargar = async () => {
    const { data, error: e } = await supabase.storage.from('cvs').createSignedUrl(path, 120, { download: true })
    if (e || !data?.signedUrl) {
      toast.error('No se pudo descargar el CV.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  // Dentro de la tarjeta de Documentos, así que aquí NO se pinta ni marco ni
  // radio: el visor es la banda de abajo y el nombre del fichero la de arriba,
  // separadas por un filo de interior (`slate-100`, el que guía) igual que las
  // filas de Respuestas. Con su propio `rounded-xl filo` había un borde dentro
  // de otro a 12px de distancia.
  const banda = 'grid flex-1 place-items-center bg-slate-50 px-6 text-center'
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-100 py-2.5 sm:px-3.5">
        {/* Decorativo: en móvil no hay sitio y el nombre del archivo manda. */}
        <FileText className="hidden size-4 shrink-0 text-slate-500 sm:block" aria-hidden />
        <span className="min-w-0 max-w-full truncate text-sm font-medium text-slate-900" title={cvName || 'CV'}>
          {cvName || 'CV'}
        </span>
        {peso && <span className="num shrink-0 text-[13px] text-slate-500">{peso}</span>}
        <div className="ml-auto flex shrink-0 gap-2">
          <button type="button" onClick={() => void descargar()} className={BTN_SECONDARY_SM}>
            <Download className="size-3.5 text-slate-500" aria-hidden /> Descargar
          </button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className={BTN_SECONDARY_SM}>
              <ExternalLink className="size-3.5 text-slate-500" aria-hidden /> Abrir aparte
            </a>
          )}
        </div>
      </div>

      {!esPdf ? (
        <div className={`min-h-[240px] ${banda}`}>
          <p className="max-w-[42ch] text-sm leading-6 text-slate-500">
            Este CV está en Word y no se puede ver aquí dentro. Descárgalo para abrirlo.
          </p>
        </div>
      ) : error ? (
        <div className={`min-h-[240px] ${banda}`}>
          <p className="max-w-[42ch] text-sm leading-6 text-slate-500">No se pudo abrir el CV. Prueba a descargarlo.</p>
        </div>
      ) : url ? (
        <iframe src={url} title={`CV de ${candidateName(candidate) || 'el candidato'}`} className="min-h-[360px] flex-1 bg-slate-50" />
      ) : (
        <div className={`min-h-[360px] ${banda}`}>
          <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden /> Abriendo el CV…
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * NOTAS DEL EQUIPO: integradas en la columna del raíl, no en un panel aparte.
 *
 * Es la MISMA tabla y el mismo objeto que el chat de la ficha de siempre (autor,
 * fecha y menciones `@` que avisan por correo); lo que cambia es cómo se
 * presenta, y lo pidió Mario con una referencia delante (ago 2026): "más tipo
 * notas de equipo que un chat".
 *
 * Tres diferencias con el hilo que había, y las tres salen de vivir dentro de
 * una columna que ya scrollea:
 *
 * 1. **El campo va ARRIBA, y por eso la nota más reciente va la primera.** Un
 *    composer pegado al fondo necesita que su bloque tenga alto propio, y aquí
 *    no lo tiene: el bloque mide lo que midan sus notas. Arriba además es donde
 *    se busca "añadir". La regla que gobierna las dos cosas es la misma: **lo
 *    último dicho va pegado al campo de escribir.**
 * 2. **No hay scroll propio ni salto al fondo.** Scrollea el raíl entero, así
 *    que no hay dos barras en una columna de 368px, y la nota que acabas de
 *    escribir sale justo debajo de donde la escribiste.
 * 3. **Sin botón de enviar** (Mario, ago 2026). Envía Intro. El campo vive entre
 *    "Añadir etiqueta" y la lista de notas, y con botón se leía como un control
 *    de otra categoría que el de encima; sin él, las dos cajas son hermanas.
 * 4. **Vacío no dice nada.** El bloque grande de "Nadie ha comentado todavía"
 *    era para un panel que hay que llenar; aquí el propio campo, con su
 *    marcador de posición, ya invita, y una frase debajo sería decir lo mismo
 *    dos veces.
 */
function NotasEquipo({
  candidateId,
  chatVersion,
  currentUserId,
  members,
  load,
  onSend,
}: {
  candidateId: string
  chatVersion: number
  currentUserId: string | null
  members: ReturnType<typeof useStore>['members']
  load: ReturnType<typeof useStore>['loadCandidateComments']
  onSend: ReturnType<typeof useStore>['addCandidateComment']
}) {
  // chatVersion en las dependencias: cuando un compañero escribe, el ping de
  // realtime lo sube y el hilo abierto se recarga solo, sin sondear.
  const { items, setItems, loading } = useChatThread(() => load(candidateId), [candidateId, chatVersion])

  // LA MÁS RECIENTE, LA PRIMERA. Es al revés que en el tablón y que en la
  // conversación con el candidato, y no es una excepción caprichosa: la regla es
  // que **lo último dicho va pegado al campo de escribir**. Donde el campo está
  // abajo, eso es el orden cronológico; aquí el campo está arriba, así que el
  // orden cronológico dejaría lo último que se dijo en el punto más lejano de la
  // columna, y en una ficha con quince notas habría que bajar del todo para
  // saber cómo va el caso.
  const mensajes: ChatMessage[] = items
    .map((c) => ({
      id: c.id,
      authorUserId: c.authorUserId,
      authorEmail: c.authorEmail,
      body: c.body,
      createdAt: c.createdAt,
      isNote: c.isNote,
    }))
    .reverse()

  return (
    <Bloque titulo="Notas">
      <ChatComposer
        id={`chat-${candidateId}`}
        members={members}
        placeholder="Añade una nota. @ para avisar"
        label="Añade una nota sobre este candidato"
        botonEnviar={false}
        campo
        onSend={async (body, mentions) => {
          const nuevo = await onSend(candidateId, body, mentions)
          if (nuevo) setItems((cs) => (cs.some((c) => c.id === nuevo.id) ? cs : [...cs, nuevo]))
          // No hace falta perseguir nada: con el campo arriba y la más reciente
          // la primera, lo que acabas de escribir aparece justo debajo de donde
          // lo escribiste. Aquí había un centinela y dos `requestAnimationFrame`
          // para arrastrar el raíl hasta el final, y sobran los tres.
        }}
      />
      {loading ? (
        <div className="mt-4">
          <ChatSkeleton />
        </div>
      ) : (
        mensajes.length > 0 && (
          // EL HUECO HASTA EL CAMPO ES MAYOR QUE EL HUECO ENTRE NOTAS (20 contra
          // 14), y ese orden importa: estaba al revés (16 contra 20), o sea que
          // la primera nota estaba más cerca del campo de escribir que de sus
          // hermanas, y por eso se leía pegada al campo y la lista no se leía
          // como una lista. La proximidad es lo que agrupa.
          <ChatThread
            className="mt-5"
            compacto
            messages={mensajes}
            currentUserId={currentUserId}
            members={members}
          />
        )
      )}
    </Bloque>
  )
}

/** Punto de color del historial. Solo el cambio de estado tiene color propio. */
function eventoDot(e: CandidateEvent): string {
  // Los hitos de entrevista llevan el color de su significado, igual que los de
  // estado: ámbar cuando hay cita en pie, verde cuando ya se hizo.
  if (e.kind === 'entrevista_confirmada' || e.kind === 'entrevista_reprogramada') return 'bg-amber-500'
  if (e.kind === 'entrevista_realizada') return 'bg-green-500'
  if (e.kind !== 'estado') return 'bg-slate-300'
  const a = String(e.details.a ?? '')
  return a in STATUS_META ? STATUS_META[a as keyof typeof STATUS_META].dot : 'bg-slate-300'
}

/**
 * El texto se compone aquí y no en la base de datos: así usa las etiquetas de
 * estado reales y el nombre de Meridian, y cambiarlos no obliga a migrar filas.
 */
function eventoTexto(e: CandidateEvent, yoEmail: string | null | undefined): string {
  // Lo tuyo se cuenta en segunda persona ("Cambiaste el estado"), no con un
  // "Tú" pegado a un verbo en tercera: "Tú cambió el estado" no es español.
  const yo = !!e.actorEmail && e.actorEmail === yoEmail
  const quien = !e.actorEmail || yo ? null : personLabel(e.actorEmail)

  switch (e.kind) {
    case 'recibida': {
      const origen = String(e.details.source ?? '')
      const label = origen in SOURCE_META ? SOURCE_META[origen as keyof typeof SOURCE_META].label : null
      return label ? `Candidatura recibida desde ${label}` : 'Candidatura recibida'
    }
    case 'analisis':
      return `${MERIDIAN_NAME} analizó la candidatura`
    case 'estado': {
      const a = String(e.details.a ?? '')
      const label = a in STATUS_META ? STATUS_META[a as keyof typeof STATUS_META].label : a
      if (yo) return `Cambiaste el estado a ${label}`
      return quien ? `${quien} cambió el estado a ${label}` : `Estado cambiado a ${label}`
    }
    case 'favorito': {
      const on = e.details.favorito === true
      if (yo) return on ? 'Lo guardaste en favoritos' : 'Lo quitaste de favoritos'
      if (quien) return on ? `${quien} lo guardó en favoritos` : `${quien} lo quitó de favoritos`
      return on ? 'Guardado en favoritos' : 'Quitado de favoritos'
    }
    case 'interes_enviada':
      return 'Se envió comprobación de interés'
    case 'interes_respuesta':
      return e.details.response === 'interested' ? 'Confirmó que sigue interesado' : 'Dijo que ya no le interesa'
    case 'entrevista_invitada':
      if (yo) return 'Le invitaste a una entrevista'
      return quien ? `${quien} le invitó a una entrevista` : 'Invitación a entrevista enviada'
    case 'entrevista_confirmada': {
      // La hora se pinta en la zona de la entrevista, no en la del navegador.
      const cuando = typeof e.details.starts_at === 'string'
        ? fullDateTimeInZone(e.details.starts_at, String(e.details.timezone ?? 'Europe/Madrid'))
        : null
      return cuando ? `Entrevista confirmada para el ${cuando}` : 'Entrevista confirmada'
    }
    case 'entrevista_reprogramada': {
      const cuando = typeof e.details.starts_at === 'string'
        ? fullDateTimeInZone(e.details.starts_at, String(e.details.timezone ?? 'Europe/Madrid'))
        : null
      return cuando ? `Entrevista movida al ${cuando}` : 'Entrevista reprogramada'
    }
    case 'entrevista_cancelada':
      if (e.details.motivo === 'puesto_pausada' || e.details.motivo === 'puesto_cerrada') {
        return 'Entrevista en el aire: el puesto dejó de estar activo'
      }
      if (yo) return 'Cancelaste la entrevista'
      return quien ? `${quien} canceló la entrevista` : 'Entrevista cancelada'
    case 'entrevista_realizada':
      return 'Entrevista realizada'
    case 'entrevista_sin_respuesta':
      return 'No hubo respuesta a la invitación'
    default:
      return 'Actividad'
  }
}

function Historial({ candidateId, load, yoEmail }: { candidateId: string; load: (id: string) => Promise<CandidateEvent[]>; yoEmail: string | null | undefined }) {
  const { items, loading } = useChatThread(() => load(candidateId), [candidateId])

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ChatSkeleton />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <ChatEmpty icon={<FileText className="size-6" />} title="Sin actividad todavía">
          Aquí se irá anotando lo que le pase a esta candidatura: cambios de estado, análisis y comprobaciones de interés.
        </ChatEmpty>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
      <ol>
        {items.map((h, n) => (
          <li key={h.id} className="flex gap-3 pb-4 last:pb-0">
            <span className="relative flex w-2 shrink-0 justify-center">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${eventoDot(h)}`} aria-hidden />
              {n < items.length - 1 && <span className="absolute bottom-[-16px] top-4 w-px bg-slate-200" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-slate-700">{eventoTexto(h, yoEmail)}</p>
              <time dateTime={h.createdAt} title={fullDateTime(h.createdAt)} className="num text-[12px] text-slate-500">
                {relativeDate(h.createdAt)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Menú de acciones poco frecuentes. En portal fijo: nunca lo recorta el modal.
 *  `size` tiene que igualar al de los botones de SU fila, que no es la misma en las dos:
 *  la cabecera de escritorio usa las variantes _SM (32px) y la barra inferior, las normales
 *  (36px). Con un tamaño fijo aquí, una de las dos filas queda descuadrada. */
function MenuAcciones({
  candidate,
  cvName,
  onEliminar,
  size = 'md',
  // En la cabecera va SIN caja, como las flechas y la equis con las que comparte
  // fila: un botón de línea entre tres fantasmas se lee como si fuera de otro
  // grupo. En la barra del pulgar sí lleva caja, porque allí sus vecinos son
  // botones de verdad.
  variante = 'secondary',
  banda,
}: {
  candidate: Candidate
  cvName: string
  onEliminar: () => void
  size?: 'sm' | 'md'
  variante?: 'secondary' | 'ghost'
  /**
   * La superficie que contiene al botón, si la hay (la barra del pulgar).
   *
   * EL HUECO SE MIDE CONTRA LA CAJA QUE PINTA, NO CONTRA EL BOTÓN. El `···` vive
   * DENTRO del relleno de la barra, así que separándose 6px de él el menú se
   * metía 5 dentro de la barra y se leía pisándola (medido). Lo que el botón
   * decide es de dónde sale en horizontal; hasta dónde puede llegar en vertical
   * lo decide su contenedor. Es la misma lección que el submenú del puesto, que
   * ancla en el menú y no en la fila, en el otro eje.
   */
  banda?: React.RefObject<HTMLDivElement | null>
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const toast = useToast()
  const W = 232

  /**
   * SE COLOCA CONTRA LA VENTANA, Y POR ESO SE MIDE ANTES DE VERSE.
   *
   * Estaba escrito a mano y SIEMPRE abría hacia abajo (`r.bottom + 6`). En la
   * cabecera daba igual, pero este mismo menú vive también en la barra del
   * pulgar, pegada al filo de abajo de un móvil: allí se desplegaba fuera de la
   * pantalla y no se veía nada (Mario, ago 2026). `colocarFlotante` es quien
   * sabe esto: prefiere abajo, sube solo si abajo no cabe y arriba sí, y en
   * horizontal aprieta contra el filo en vez de salirse.
   *
   * Para decidir el lado hace falta el ALTO, y el alto no se sabe hasta que el
   * menú está en el DOM: se monta invisible, se mide en un `useLayoutEffect` y
   * solo entonces se coloca. Medirlo después de verse sería un salto de un
   * fotograma. Es el mismo patrón que el globo de `ui/Tooltip`.
   */
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const b = btnRef.current?.getBoundingClientRect()
    const m = menuRef.current?.getBoundingClientRect()
    if (!b || !m) return
    // Vertical contra la banda (si la hay), horizontal contra el botón. Se
    // construye campo a campo y NO con `{ ...b }`: un `DOMRect` tiene sus
    // propiedades en el PROTOTIPO, así que el spread devuelve un objeto vacío y
    // el ancla horizontal se quedaba en `undefined` (el menú se iba al filo
    // izquierdo de la pantalla, medido: derecha 232 contra los 359 del botón).
    const caja = banda?.current?.getBoundingClientRect()
    const a = {
      left: b.left,
      right: b.right,
      top: caja?.top ?? b.top,
      bottom: caja?.bottom ?? b.bottom,
    }
    setPos(
      colocarFlotante(
        a,
        { width: W, height: m.height },
        { width: window.innerWidth, height: window.innerHeight },
        { alinear: 'derecha' },
      ),
    )
  }, [open, banda])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Este Escape cierra el menú, no el modal de detrás.
      e.stopPropagation()
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'

  const copiarContacto = async () => {
    const phone = String(candidate.answers['telefono'] ?? '')
    const correo = Object.entries(candidate.answers).find(([k]) => k === 'email')?.[1]
    const texto = [candidateName(candidate), phone && formatPhone(phone), correo && String(correo)].filter(Boolean).join('\n')
    const ok = await copyText(texto)
    if (ok) toast.success('Datos de contacto copiados')
    else toast.show('No se pudieron copiar los datos.')
    setOpen(false)
  }

  const descargarCv = async () => {
    setOpen(false)
    if (!candidate.cvPath) return
    const { data, error } = await supabase.storage.from('cvs').createSignedUrl(candidate.cvPath, 120, { download: true })
    if (error || !data?.signedUrl) {
      toast.error('No se pudo descargar el CV.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <>
      {/* La pintura del secundario estaba copiada a mano aquí y sale de `botonIcono`.
          Lo que NO se toca es el objetivo de toque: `TALLA_ICONO.sm` es `size-8` a secas,
          sin `pointer-coarse`, y la clase que había sí crecía a 44. La fila compacta que
          lo contiene es `hidden sm:flex`, y `sm` arranca en 640px, o sea que se pinta en
          cualquier tablet: ahí sí hay dedo, y la doctrina dice que la densidad de
          escritorio no se paga con un dedo que falla. */}
      <button
        ref={btnRef}
        type="button"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={botonIcono(variante, size, size === 'sm' ? 'pointer-coarse:size-11' : '')}
      >
        {/* El icono también acompaña: los vecinos _SM llevan size-3.5. */}
        <MoreHorizontal className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Acciones del candidato"
            // Invisible mientras no se sabe dónde va: ocupa sitio para poder
            // medirse, pero sin enseñarse en la esquina antes de saltar a su hueco.
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: W,
              visibility: pos ? undefined : 'hidden',
            }}
            className="z-[70] overflow-hidden rounded-xl filo bg-white py-1 shadow-pop"
          >
            {candidate.cvPath && (
              <button type="button" role="menuitem" className={item} onClick={() => void descargarCv()}>
                <Download className="size-4 text-slate-500" aria-hidden /> Descargar {cvName ? 'CV' : 'CV'}
              </button>
            )}
            <button type="button" role="menuitem" className={item} onClick={() => void copiarContacto()}>
              <Copy className="size-4 text-slate-500" aria-hidden /> Copiar datos de contacto
            </button>
            <div className="my-1 h-px bg-slate-100" role="separator" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onEliminar()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-4" aria-hidden /> Eliminar candidato
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

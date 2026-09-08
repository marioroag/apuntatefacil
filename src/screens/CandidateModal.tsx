import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CircleSlash,
  Copy,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
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
import type { AiTrayectoria, Campaign, Candidate, CandidateDocument, CandidateEvent, CandidateStatus, FormField } from '../lib/types'
import { FAVORITO_STAR, SOURCE_META, STATUS_META } from '../lib/types'
import { CAMPOS_YA_PINTADOS, answerText, candidateName, fechaCorta, formatPhone, fullDateTime, fullDateTimeInZone, personLabel, relativeDate, shortWhenInZone } from '../lib/format'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { botonIconoBloque, BTN_DANGER_SM, BTN_PRIMARY, BTN_PRIMARY_BLOCK, BTN_SECONDARY_BLOCK, BTN_SECONDARY_SM, botonIcono, BTN_PRIMARY_SM } from '../lib/buttons'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { MaskedPhone } from '../components/MaskedPhone'
import { TagSection } from '../components/Tags'
import { InfoTooltip } from '../components/ui/Tooltip'
import { TAGS_ENABLED } from '../lib/pricing'
import { AgendarManualDialog, CambiarCitaDialog } from '../components/InterviewAction'
import { currentInterview } from '../lib/interviews'
import { useEsMovil } from '../lib/media'
import { colocarFlotante } from '../lib/flotante'
import { MeridianAvatar, MeridianPanelBlock } from '../components/Meridian'
import { MERIDIAN_NAME, candidateFit, citasDelAnalisis, type CitaCv } from '../lib/meridian'
import { CvViewer, type CitaActiva } from '../components/CvViewer'
import { CvLightbox } from '../components/CvLightbox'
import { ERROR_DESCARGA, useDocumento } from '../lib/documento'

/**
 * Detalle del candidato: pop-up con pestañas.
 *
 * Sustituye al SlideOver de 460 px (jul 2026). El panel lateral protegía una
 * cosa buena, que la lista filtrada siguiera a la vista, pero obligaba a apilar
 * en una columna estrecha todo lo que hay que saber de una persona. El pop-up
 * conserva la lista detrás (el telón es translúcido), da dos columnas y añade lo
 * que faltaba: pasar de un candidato al siguiente sin cerrar, y un hilo donde el
 * equipo habla del caso.
 *
 * Reparto: a la izquierda lo que DICE el candidato y se lee de arriba abajo
 * (el informe de Meridian, sus respuestas y sus documentos); a la derecha, en
 * un raíl SIN pestañas, lo que necesitas para actuar sobre él (sus datos, sus
 * etiquetas y el hilo de tu equipo). Las otras dos superficies largas, la
 * Trayectoria y el Historial, son pestañas de la izquierda.
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
 *   - "Rechazar" como botón grande del raíl. Rompía dos reglas a la vez, porque
 *     descartar es un ESTADO (uno de los cinco, y reversible) y porque iba
 *     pintado de rojo, que en esta app avisa de un error o de algo que no se
 *     deshace. El verbo se queda, en línea y llamándose "Descartar".
 *   - Su vecino "Contactar" SÍ acabó existiendo, y conviene saber por qué cambió
 *     de opinión esta nota. Se descartó en ago 2026 con el argumento de que las
 *     acciones ya vivían en la cabecera y un segundo juego es una segunda puerta
 *     para lo mismo; después la cabecera se quedó en la identidad, las acciones
 *     bajaron aquí, y en sep 2026 se vio que contactar NO ES un paso del proceso
 *     sino lo que se hace en todos ellos. Ya no es un segundo juego: es el otro
 *     plano. Ver `AccionesCandidato`.
 *   - "Puesto aplicado" como dato del raíl: ya está escrito debajo del nombre,
 *     en la cabecera, que es donde se lee a quién estás mirando.
 *   - "Notas" como nombre del hilo: son el chat del equipo desde jul 2026, con
 *     autor, fecha y menciones. Las notas internas ya no existen.
 *
 * LA PESTAÑA "CONVERSACIÓN" SE RETIRÓ CON EL ASISTENTE DE WHATSAPP (sep 2026).
 * Era la superficie del canal: se invitaba desde ahí, se veía lo hablado y se
 * tomaba el control. Sin canal no queda hilo que enseñar, y una pestaña que solo
 * puede decir que todavía no escribimos es un destino que no lleva a ninguna
 * parte. Lo que se hace con una cita (agendarla, moverla, cancelarla) vive donde
 * se decide: en las acciones, encima de sus datos.
 */

/**
 * LAS CINCO VISTAS DE UN CANDIDATO, Y UNA SOLA PIEZA DE ESTADO PARA LAS DOS
 * SUPERFICIES.
 *
 * En escritorio, las tres primeras se apilan en la columna izquierda y las dos
 * últimas son pestañas; en móvil, las cinco comparten un grupo de pastillas.
 * Con dos estados (uno por superficie) la ficha se descuadraba al girar el
 * teléfono y "ver la trayectoria" acertaba en un tamaño y fallaba en el otro, que
 * es exactamente el fallo que ya tuvo la versión de pestañas anidadas.
 */
type Vista = 'respuestas' | 'meridian' | 'documentos' | 'trayectoria' | 'historial'

/** Las tres que en escritorio se leen seguidas en la columna. */
const ES_FICHA = ['respuestas', 'meridian', 'documentos'] as const
const esFicha = (v: Vista) => (ES_FICHA as readonly string[]).includes(v)

/** Las vistas que se LEEN (columna con scroll y relleno), frente al Historial,
 *  que manda su propio alto. La Trayectoria es lectura: una ficha del CV, no un
 *  hilo. */
const esLectura = (v: Vista) => esFicha(v) || v === 'trayectoria'

/**
 * El registro del grupo de pastillas de móvil. Respuestas la primera y por
 * defecto (es lo que se mira siempre); Documentos detrás de Meridian porque
 * muchas veces está vacío, y la Trayectoria (la línea de tiempo del CV) con él,
 * que es su hermano; y al final el Historial, que es a donde se entra a
 * propósito.
 */
const VISTAS: TabItem<Vista>[] = [
  { value: 'respuestas', label: 'Respuestas' },
  { value: 'meridian', label: MERIDIAN_NAME },
  { value: 'documentos', label: 'Documentos' },
  { value: 'trayectoria', label: 'Trayectoria' },
  { value: 'historial', label: 'Historial' },
]

// 1024px: por debajo, el raíl de 368px dejaría el contenido principal por debajo
// de un ancho legible.
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
  const { setFavorito, setStatus, deleteCandidate, loadCandidateComments, addCandidateComment, editCandidateComment, deleteCandidateComment, loadCandidateEvents, members, chatVersion, interviewsFor } =
    useStore()
  const { role, user } = useAuth()
  const toast = useToast()
  // Respuestas es la de partida: es lo que se mira siempre, y el veredicto y los
  // documentos están a un toque.
  const [vista, setVista] = useState<Vista>('respuestas')
  const [agendarManual, setAgendarManual] = useState(false)
  const [cambiarCita, setCambiarCita] = useState(false)
  // La cita que se puede tocar: la viva de esta persona, y solo si tiene hora.
  // Sale de la misma fuente que la línea que la enseña (`currentInterview`), no
  // de una segunda consulta: dos formas de decidir cuál es "su" entrevista se
  // separan a la primera reprogramación.
  const citaDeAhora = candidate ? currentInterview(interviewsFor(candidate.id), candidate.id) : null
  const citaViva =
    citaDeAhora && citaDeAhora.startsAt &&
    (citaDeAhora.status === 'confirmada' || citaDeAhora.status === 'reprogramando')
      ? citaDeAhora
      : null
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  // La cita del análisis a la que viajar en el visor del CV (subrayado + scroll
  // + destello). Lleva un contador para que pedir la misma cita dos veces
  // vuelva a hacer el viaje.
  const [citaActiva, setCitaActiva] = useState<CitaActiva | null>(null)
  // Qué citas localizó DE VERDAD el visor en el documento (null = aún no se
  // sabe, el visor no ha cargado). Con esto el informe solo enlaza citas con
  // marca: un enlace que salta a ninguna parte es una puerta pintada.
  const [citasLocalizadas, setCitasLocalizadas] = useState<Set<string> | null>(null)
  const barraRef = useRef<HTMLDivElement>(null)
  const documentosRef = useRef<HTMLDivElement>(null)
  const dosColumnas = useDosColumnas()
  const esMovil = useEsMovil()


  /**
   * La barra del pulgar: llamar, escribir y el `···`, flotando sobre la columna.
   *
   * Solo donde no hay raíl y solo en la ficha: en el Historial la columna es lo
   * único que hay y ahí manda lo que se lee. Se
   * declara aquí y no en el JSX porque lo preguntan DOS sitios, la propia barra
   * y el relleno que la columna le reserva al pie; escrito dos veces, el día
   * que cambie la condición uno de los dos se queda mintiendo.
   */
  const barraFlotante = esMovil && esFicha(vista)

  const canManageTags = role !== 'encargado'
  // Con el pago por proceso todo el producto está incluido: las notas del equipo
  // y las entrevistas ya no se cortan por plan. En demo lo que cambia es que
  // llamar y escribir avisan en vez de salir.

  // Al cambiar de candidato se vuelve a Información: cada persona se abre por
  // lo que ha contestado. Se ajusta DURANTE el render (patrón de React para
  // "estado derivado de una prop que cambia"), no en un efecto: un efecto
  // pintaría antes el candidato nuevo con la pestaña del viejo.
  const [visto, setVisto] = useState(candidate?.id ?? null)
  if (candidate && visto !== candidate.id) {
    setVisto(candidate.id)
    setVista('respuestas')
    setCitaActiva(null)
    setCitasLocalizadas(null)
  }

  const open = !!candidate
  const name = candidate ? candidateName(candidate) || 'Sin nombre' : ''
  const phone = candidate ? String(candidate.answers['telefono'] ?? '') : ''
  const waPhone = waNumero(phone)
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
  // La TRAYECTORIA es pestaña propia (Mario, ago 2026: "el timeline del
  // trabajador"): es la lectura del CV, no un apartado de Información, y junto
  // al Historial porque también es una superficie a la que se entra a propósito.
  const tabsIzq: TabItem<'info' | 'trayectoria' | 'historial'>[] = [
    { value: 'info', label: 'Información' },
    { value: 'trayectoria', label: 'Trayectoria' },
    { value: 'historial', label: 'Historial' },
  ]

  // Los datos y las etiquetas: en el raíl si lo hay, y si no, arriba del todo de
  // Información. Es el MISMO objeto en las dos superficies, no dos copias: en
  // cuanto se separan, la primera que se toque deja mintiendo a la otra.
  // Los datos y las notas son el MISMO objeto en las dos superficies, no dos
  // copias: lo único que cambia es dónde caen. En el raíl van seguidos, porque
  // el raíl ES eso. En una sola columna se separan: los datos son cortos y van
  // arriba, donde se buscan, y las notas crecen sin techo, así que van al final
  // y no entre tú y lo que el candidato ha contestado.
  const cambiarEstado = (s: CandidateStatus) => void setStatus(candidate.id, s)

  // Las citas del CV que el visor puede subrayar. El informe en prosa ya no
  // enlaza cita a cita: ofrece UNA puerta ("Ver las citas subrayadas en el
  // CV") que salta a la primera con marca. Antes de que el visor cargue
  // (citasLocalizadas null) se enlaza con optimismo, y el visor avisa si una
  // cita no está; con el conjunto en la mano, sin marcas no hay puerta.
  const citasCv: CitaCv[] = candidate.cvPath ? citasDelAnalisis(candidate.ai) : []
  const verEnCv = (id: string) => {
    setCitaActiva((prev) => ({ id, n: (prev?.n ?? 0) + 1 }))
    if (esMovil) setVista('documentos')
    else documentosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const citasConMarca = citasLocalizadas == null ? citasCv : citasCv.filter((c) => citasLocalizadas.has(c.id))
  const verCitas =
    citasConMarca.length > 0
      ? { n: citasConMarca.length, abrir: () => verEnCv(citasConMarca[0].id) }
      : undefined

  const contenidoMeridian = <MeridianPanelBlock candidate={candidate} verCitas={verCitas} />
  const contenidoRespuestas = (
    <Respuestas campaign={campaign} candidate={candidate} maskPhone={maskPhone} conDocumentos={!!candidate.cvPath} />
  )
  // La TRAYECTORIA (la línea de tiempo que Meridian extrajo del CV) tiene
  // pestaña propia desde ago 2026 (Mario): metida encima del visor era una
  // lista apretada dentro de Documentos, y lo que es (la lectura ordenada de la
  // vida laboral de esa persona) se merece su superficie.
  const trayectoria = candidate.ai && !candidate.ai.error ? candidate.ai.trayectoria : undefined
  const contenidoTrayectoria = (
    <TrayectoriaTab pideCv={!!cvField} tieneCv={!!candidate.cvPath} ai={candidate.ai} trayectoria={trayectoria} />
  )
  // El documento se enseña ENTERO, sin caja con scroll propio (Mario, ago
  // 2026): las páginas se apilan a su alto y se desplaza la columna de la
  // ficha, que es la regla de la casa ("una superficie, un scroll"). La caja
  // de 520px metía una segunda barra dentro de la columna.
  const contenidoDocumentos = (
    <div ref={documentosRef} className="scroll-mt-4">
      <Documentos
        key={candidate.id}
        campaign={campaign}
        candidate={candidate}
        cvName={cvName}
        pideDocumentos={!!cvField}
        citas={citasCv}
        citaActiva={citaActiva}
        cvLeido={candidate.ai && !candidate.ai.error ? candidate.ai.cvLeido : undefined}
        onLocalizadas={(ids) => setCitasLocalizadas(new Set(ids))}
      />
    </div>
  )
  const contenidoHistorial = (
    <Historial key={candidate.id} candidateId={candidate.id} load={loadCandidateEvents} yoEmail={user?.email} />
  )

  const acciones = (
    <AccionesCandidato
      campaign={campaign}
      candidate={candidate}
      phone={phone}
      waPhone={waPhone}
      maskPhone={maskPhone}
      cvName={cvName}
      onAvisoDemo={avisoDemo}
      esMovil={esMovil}
      onAgendar={() => setAgendarManual(true)}
      onVerEntrevista={() => setCambiarCita(true)}
      onEstado={cambiarEstado}
      onEliminar={() => setConfirmarBorrado(true)}
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
      onEdit={editCandidateComment}
      onDelete={deleteCandidateComment}
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
              {/* AQUÍ YA NO HAY `···` (Mario, sep 2026). Estuvo un mes entre las
                  flechas de navegar y la equis de cerrar, o sea entre los dos
                  controles que NO hacen nada con la persona, mientras su
                  contenido (descargar el documento, copiar el contacto, descartar,
                  eliminar) es todo sobre ella. Ha bajado a la fila de
                  herramientas, con WhatsApp y Llamar, que es donde estaba en móvil
                  desde el principio. La cabecera se queda en lo que siempre debió
                  ser: quién es y por dónde te mueves. */}
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
            abrir la Trayectoria o el Historial, y lo que se puede HACER con una
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

        <div className="relative flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            {/* La barra de pestañas NO se pinta en móvil: allí la navegación es el
                grupo de pastillas de dentro de la columna. Se monta o no se monta,
                no se esconde con CSS: una pestaña en `display:none` sigue siendo
                alcanzable con las flechas del teclado. */}
            {!esMovil && (
              <Tabs
                items={tabsIzq}
                value={esFicha(vista) ? 'info' : (vista as 'trayectoria' | 'historial')}
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
                esMovil || esLectura(vista)
                  ? `overflow-y-auto overscroll-contain px-4 pt-5 sm:px-5 ${barraFlotante ? 'pb-[68px]' : 'pb-5'}`
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
                          notas a la tercera pantalla; y la Trayectoria y el
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
                          : vista === 'trayectoria' ? contenidoTrayectoria
                          // El historial manda su propio alto (es una columna flex
                          // con scroll), así que dentro de una columna que ya
                          // scrollea hay que dárselo declarado o se queda en cero.
                          : (
                            <div className="flex h-[420px] max-h-[60vh] flex-col overflow-hidden rounded-xl filo bg-slate-50/60">
                              {contenidoHistorial}
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
              {!esMovil && vista === 'trayectoria' && contenidoTrayectoria}
              {!esMovil && vista === 'historial' && contenidoHistorial}
            </Envoltorio>
          </section>

          {/* EL RAÍL NO TIENE PESTAÑAS, Y ES UNA SOLA COLUMNA CON UN SOLO SCROLL.
              Aquí vive lo que tu equipo necesita de una persona: sus datos, cómo
              la tenéis clasificada y lo que os habéis dicho sobre ella. Estaba
              repartido entre cuatro pestañas (dos a la izquierda y dos más
              dentro del panel de la derecha), así que leer un teléfono o ver si
              alguien había apuntado algo costaba clics; ahora está puesto, y no
              se va cuando abres la Trayectoria o el Historial.

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
          {/* LA BARRA DEL PULGAR FLOTA: SIN FONDO Y SIN FILO (Mario, ago 2026).
              Era una superficie blanca de lado a lado, en el flujo, con su raya
              arriba: o sea una cuarta franja de chrome en una ficha que ya tiene
              cabecera, banda de acciones y pastillas. Lo que hay ahí son DOS
              verbos y un menú, no una zona de la pantalla. Flotando, el
              contenido pasa por debajo y se ve: son la misma pieza y el mismo
              gesto que el "Apúntate ahora" del anuncio en móvil.

              Eso obliga a dos cosas, y las dos son la parte que se olvida. UNA:
              la caja que los coloca va `pointer-events-none` y cada botón
              recupera el puntero, o una franja invisible de 68px se traga los
              clics de todo lo que pase por detrás. DOS: la columna reserva ese
              hueco al pie (`pb-[68px]`), porque si no el último apartado (las
              notas, con su campo) se queda debajo de los botones para siempre.
              Va como `pt-5` + `pb-*` y no como `py-5` con un `pb` detrás: son la
              misma utilidad y no se resuelven por el orden en que se escriben.

              Llevan `shadow-pop` porque es lo que de verdad son, una capa sobre
              contenido; el sólido y los dos de línea son opacos, así que lo que
              se desliza por debajo no se les transparenta.

              SE MONTA, no se esconde con `sm:hidden`. Dentro hay un
              `MenuAcciones`, y su desplegable sale por un PORTAL a
              `document.body`: el `hidden` de la barra no lo alcanza, así que al
              abrirlo en un móvil y ensanchar la ventana el menú se quedaba
              flotando sobre el escritorio, encima de una barra que ya no se
              veía. Es la misma regla que ya obliga a montar `BottomSheet` solo
              en móvil y el raíl solo cuando existe. */}
          {barraFlotante && (
            <div
              ref={barraRef}
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-3"
            >
              {phone && (
                <>
                  <AccionContacto
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    demo={maskPhone}
                    onDemo={avisoDemo}
                    className={`${BTN_PRIMARY} pointer-events-auto flex-1 shadow-pop`}
                  >
                    <Phone className="size-4 text-indigo-200" aria-hidden /> Llamar
                  </AccionContacto>
                  {waPhone && (
                    // SÓLIDO, IGUAL QUE LLAMAR (Mario, sep 2026). Iba en línea, y
                    // eso los convertía en una acción y su apoyo cuando son las
                    // dos formas de hacer LO MISMO: hablar con esta persona. Es la
                    // misma regla que ya empareja los dos verbos en la fila de
                    // herramientas de escritorio; lo que aquí los distingue del
                    // `···` que tienen al lado es justamente que ellos hacen algo
                    // y él solo abre una lista.
                    <AccionContacto
                      href={`https://wa.me/${waPhone}`}
                      externo
                      demo={maskPhone}
                      onDemo={avisoDemo}
                      className={`${BTN_PRIMARY} pointer-events-auto flex-1 shadow-pop`}
                    >
                      {/* El glifo se sienta un peldaño por debajo de su rótulo,
                          como el de Llamar: sobre el sólido eso es `indigo-200`. */}
                      <MessageCircle className="size-4 text-indigo-200" aria-hidden /> WhatsApp
                    </AccionContacto>
                  )}
                </>
              )}
              {/* SIN TELÉFONO NO SE ESCRIBE NADA AQUÍ, y no es una pérdida: sin
                  fondo, una línea gris caería sobre el texto que se desliza por
                  debajo y sería ilegible, que es lo mismo que ya obligó a mudar
                  al flujo la señal de "9 preguntas" del anuncio. Y lo que decía
                  ("Sin teléfono en la candidatura") está a dos dedos y mejor
                  dicho, en DATOS, que es la primera franja de la columna:
                  "Teléfono · No disponible". El menú se va solo a la derecha. */}
              <span className="pointer-events-auto ml-auto">
                {/* Con `descartar`, igual que el `···` de escritorio: en móvil esta
                    barra ES la fila de herramientas, así que su menú tiene que
                    llevar los mismos verbos o descartar se quedaría sin puerta por
                    debajo de `sm`. */}
                <MenuAcciones
                  candidate={candidate}
                  cvName={cvName}
                  onEliminar={() => setConfirmarBorrado(true)}
                  descartar={{ status: candidate.status, onEstado: cambiarEstado }}
                  banda={barraRef}
                />
              </span>
            </div>
          )}
        </div>
      </Modal>

      <AgendarManualDialog
        open={agendarManual}
        candidate={candidate}
        onClose={() => setAgendarManual(false)}
      />

      {/* Solo se monta si hay cita: el diálogo va SOBRE una entrevista, y sin
          ella no tiene ni hora que enseñar ni id al que llamar. */}
      {citaViva && (
        <CambiarCitaDialog
          open={cambiarCita}
          entrevista={citaViva}
          candidate={candidate}
          onClose={() => setCambiarCita(false)}
        />
      )}

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
        Se elimina también lo que haya escrito tu equipo sobre esta persona, y en unos minutos su CV y sus documentos. Puedes
        recuperar la candidatura desde el aviso, pero la conversación no.
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
 * LO QUE SE HACE CON UNA PERSONA, arriba del raíl (diseño de Mario, ago 2026;
 * partido en dos planos en sep 2026).
 *
 * Sustituyen a la fila de decisión que vivía bajo el nombre (pastilla de estado,
 * agendar, llamar, WhatsApp y el `···`), que era una barra de herramientas justo
 * donde se lee quién es alguien. Ahora la cabecera es identidad y navegación, y
 * lo que se HACE está donde se decide, encima de sus datos.
 *
 * **DOS PLANOS, Y SOLO UNO CAMBIA** (sep 2026):
 *   · CONTACTO, arriba: escribir o llamar. Está en los cinco estados y siempre en
 *     el mismo píxel, porque hablar con alguien no es un paso del proceso, es lo
 *     que se hace en todos ellos.
 *   · PROCESO, debajo: la acción principal del estado y la salida.
 *
 * **UNA SOLA ACCIÓN PRINCIPAL POR ESTADO**, que es lo que convierte unos botones
 * en un proceso: el acento dice cuál es el siguiente paso, no todos los posibles.
 * Lo que el plano de contacto cambia no es esa regla, es DÓNDE cae el acento:
 *   · nuevo              -> escribirle (el acento, arriba); agendar queda en línea
 *   · contactado         -> agendar la entrevista
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
 * EL BOTÓN DICE "AGENDAR ENTREVISTA", y desde que se retiró el asistente de
 * WhatsApp (sep 2026) esa es la única forma que hay: la cita se apunta a mano y
 * avisas tú por el canal que quieras, que es justo para lo que el plano de
 * contacto tiene que estar siempre puesto. Llegó a haber un "Invitar a
 * entrevista" previsto, que le escribía al candidato para que eligiera hueco; se
 * fue con el canal. La regla que queda es la de siempre: se ofrece la acción que
 * funciona ENTERA, nunca una que acabe en un mensaje que no sale.
 */
/**
 * El teléfono en el formato que pide `wa.me`. Vive aquí y no escrito dos veces
 * porque lo preguntan la cabecera de la ficha y el menú del propio número, y un
 * prefijo que se escriba en dos sitios acaba siendo dos prefijos.
 */
const waNumero = (phone: string) => (phone ? '34' + phone.replace(/\D/g, '') : '')

/**
 * UN CONTACTO QUE EN LA DEMO NO SALE DEL NAVEGADOR.
 *
 * Llamar y escribir por WhatsApp son ENLACES (`tel:` y `wa.me`), y por eso
 * sobrevivieron a la retirada del asistente: ese WhatsApp es el DEL EMPRESARIO y
 * se abre en su móvil, no sale nada nuestro. Pero en la demo los
 * teléfonos están tapados y no llevan a nadie, así que ahí el mismo control es un
 * `<button>` que lo dice, y no un enlace muerto.
 *
 * Existe como pieza porque lo piden DOS sitios con formas distintas (la barra del
 * pulgar en móvil, y las acciones del raíl desde sep 2026) y lo que comparten no
 * es la pintura sino esta bifurcación. Escrita cuatro veces, el día que la demo
 * cambie de aviso se queda a medias.
 */
function AccionContacto({
  href,
  externo = false,
  demo,
  onDemo,
  onAbrir,
  className,
  label,
  children,
}: {
  href: string
  /** `wa.me` abre otra pestaña; `tel:` no, que se lo queda el sistema. */
  externo?: boolean
  demo: boolean
  onDemo: () => void
  /**
   * Lo que hay que ANOTAR por haberlo abierto (marcar al candidato como
   * contactado, por ejemplo). Solo se llama cuando el enlace de verdad se abre,
   * o sea nunca en la demo: ahí no se ha contactado con nadie.
   */
  onAbrir?: () => void
  className: string
  /** Nombre accesible, obligatorio cuando el control es solo un icono. */
  label?: string
  children: React.ReactNode
}) {
  if (demo) {
    return (
      <button type="button" onClick={onDemo} className={className} aria-label={label} title={label}>
        {children}
      </button>
    )
  }
  return (
    <a
      href={href}
      // PRIMERO SE ABRE Y DESPUÉS SE ANOTA, y el retardo de un tic no es un
      // adorno: lo que se anota puede cambiar el estado del candidato, y con él
      // esta misma pieza (el WhatsApp de un candidato nuevo pasa de sólido a
      // línea en cuanto queda contactado, porque el acento baja a su fila). Un
      // React que
      // reemplaza el `<a>` dentro del propio manejador se lleva por delante el
      // nodo del que el navegador tiene que sacar el enlace, y el peor final
      // posible aquí es quedar marcado como contactado sin que el mensaje se
      // haya llegado a abrir. Cediendo el turno, la navegación ya ha arrancado.
      onClick={onAbrir ? () => setTimeout(onAbrir, 0) : undefined}
      className={className}
      aria-label={label}
      title={label}
      {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function AccionesCandidato({
  campaign,
  candidate,
  phone,
  waPhone,
  maskPhone,
  cvName,
  onAvisoDemo,
  esMovil,
  onAgendar,
  onVerEntrevista,
  onEstado,
  onEliminar,
}: {
  /** De aquí sale el campo de correo, que es a lo que degrada el contacto sin teléfono. */
  campaign: Campaign
  candidate: Candidate
  /** El teléfono tal cual lo escribió el candidato (para `tel:`). */
  phone: string
  /** El mismo, en el formato que pide `wa.me`. Vacío si no dejó ninguno. */
  waPhone: string
  maskPhone: boolean
  onAvisoDemo: () => void
  /**
   * En móvil, llamar y escribir por WhatsApp ya viven en la barra del pulgar y en
   * TODOS los estados, así que el plano de contacto no se pinta aquí: serían dos
   * puertas para lo mismo a un dedo de distancia. La barra del pulgar es, de
   * hecho, quien llevaba esto bien desde ago 2026; lo que se ha hecho en sep 2026
   * es traer su reparto al escritorio. Ver `contacto`, más abajo.
   */
  esMovil: boolean
  /** Lo que el `···` necesita para su fila de descargar el documento. */
  cvName: string
  onAgendar: () => void
  onVerEntrevista: () => void
  onEstado: (s: CandidateStatus) => void
  /** Eliminar vive en el `···`, y desde sep 2026 el `···` vive en esta fila. */
  onEliminar: () => void
}) {
  const { interviewsFor } = useStore()
  const entrevista = currentInterview(interviewsFor(candidate.id), candidate.id)
  const confirmada =
    (entrevista?.status === 'confirmada' || entrevista?.status === 'reprogramando') && entrevista.startsAt
      ? entrevista
      : null
  const s = candidate.status

  // EL CONTACTO NO ES UN PASO DEL PROCESO: ES LO QUE SE HACE EN TODOS ELLOS
  // (Mario, sep 2026, con Solera Canarias delante: "cuando lo han contactado
  // previamente se cambian los botones y para recontactar tienen que copiar y
  // pegar el número, y es un lío").
  //
  // Escribir y llamar vivían SOLO en "nuevo", o sea tratados como un paso más
  // del embudo, y desaparecían justo cuando más se usan: recontactar al que no
  // contestó, confirmarle la hora al que ya tiene entrevista, avisar al
  // contratado de cuándo empieza. La puerta que sí estaba siempre (el número del
  // bloque Datos, que despliega WhatsApp · Llamar · Copiar desde el 2-sep) no se
  // encuentra, y la prueba es que un cliente con ella delante prefiera copiar y
  // pegar: en una columna de hechos, un número se lee como un DATO y no como un
  // control, por mucho chevron que lleve.
  //
  // Así que la ficha pasa a tener DOS PLANOS, y el bloque tiene la MISMA forma
  // en los cinco estados:
  //   - CONTACTO, arriba: no se mueve nunca, ni de sitio ni de anatomía.
  //   - PROCESO, debajo: la acción principal del estado y la salida, que son las
  //     únicas que cambian.
  //
  // No rompe "una sola acción principal por estado", la lee bien: la principal
  // sigue siendo UNA, lo que cambia es en qué plano cae. En "nuevo" es escribirle
  // (la decisión de sep 2026 se conserva entera) y el acento se lo lleva el
  // contacto; en cuanto el proceso avanza, el acento baja a su fila y el contacto
  // se queda en línea. **El énfasis cambia; la geometría no**, que es exactamente
  // lo que faltaba: el botón está siempre en el mismo píxel.
  const esNuevo = s === 'nuevo'
  const campoEmail = campoCorreo(campaign)
  const correo = campoEmail ? String(candidate.answers[campoEmail.id] ?? '') : ''

  // EL PASO ARRIBA, LAS HERRAMIENTAS DEBAJO (Mario, sep 2026, con el esquema
  // dibujado). Dos filas y ni una más:
  //
  //   [        Agendar entrevista        ]   <- lo que hace avanzar el proceso
  //   [◉ WhatsApp] [☎ Llamar] [···]          <- con qué trabajas a esa persona
  //
  // Es la misma frontera de siempre (contactar no es un paso del proceso, es lo
  // que se hace en todos ellos), pero dicha con la MAQUETACIÓN en vez de con el
  // peso: arriba hay una sola cosa y ocupa el ancho entero, así que se lee sin
  // buscarla; debajo hay tres, del mismo tamaño y siempre las mismas.
  //
  // ES LA COMPOSICIÓN DE LA BARRA DEL PULGAR, TRAÍDA AL ESCRITORIO. En móvil esos
  // tres controles llevaban juntos desde ago 2026 y nadie se quejó nunca; el
  // agujero estaba en el escritorio, donde escribir y llamar solo existían en
  // "nuevo" y el `···` vivía arriba, en la cabecera. Cuando un ancho ya ha
  // resuelto un problema, la respuesta no es inventar un patrón: es mirar el suyo.
  const contactar = phone && waPhone

  // LA FILA DE HERRAMIENTAS NO SE PINTA EN MÓVIL: allí ES la barra del pulgar,
  // con los mismos tres controles y flotando sobre el contenido. Montarla aquí
  // además sería el mismo menú dos veces en la misma pantalla.
  const herramientas = esMovil ? null : (
    // FLEX Y NO REJILLA, y con el `···` empujado al filo: es exactamente lo que
    // hace la barra del pulgar, y hace falta para el caso en que no haya con qué
    // contactar. Sin teléfono ni correo se queda el menú solo, y solo se lee bien
    // pegado a la derecha; con dos verbos, ellos se reparten el ancho y el menú
    // cierra la fila.
    <div className="flex items-center gap-2">
      {contactar ? (
        <>
          {/* ESCRIBIRLE A UN CANDIDATO NUEVO LO PASA A "CONTACTADO", y SOLO desde
              nuevo: desde cualquier otro estado, recontactar a alguien no puede
              hacer retroceder su proceso, que es justo el caso al que esta fila
              sirve.

              Lo que se asume, y conviene tenerlo escrito: se anota haber ABIERTO
              el chat, no haber enviado el mensaje. Es lo único que se puede saber
              desde aquí, porque el enlace abre el WhatsApp DEL EMPRESARIO y lo que
              pase dentro ya no es nuestro. Se acepta porque el estado es
              reversible y se cambia en el selector que tiene a dos dedos. */}
          <AccionContacto
            href={`https://wa.me/${waPhone}`}
            externo
            demo={maskPhone}
            onDemo={onAvisoDemo}
            onAbrir={esNuevo ? () => onEstado('contactado') : undefined}
            className={`${BTN_SECONDARY_BLOCK} flex-1`}
          >
            {/* AQUÍ SÍ VAN ICONOS, y no contradice la regla de que un botón de
                ancho completo va con la etiqueta sola: aquella es para el botón
                ÚNICO de una fila, donde el grupo icono+texto se centra y deja el
                rótulo descentrado. Estos son tres controles repartiéndose una
                fila, que es la anatomía de la barra del pulgar, y ahí el glifo es
                lo que los distingue de un vistazo antes de leerlos. */}
            <MessageCircle className="size-4 text-slate-500" aria-hidden /> WhatsApp
          </AccionContacto>
          {/* LLAMAR RECUPERA SU NOMBRE. Era un cuadrado con el glifo solo, que es
              lo correcto cuando acompaña a un botón ancho; en una fila de tres
              hermanos, la palabra cuesta lo mismo y se lee sin aprender nada. */}
          <AccionContacto
            href={`tel:${phone.replace(/\s/g, '')}`}
            demo={maskPhone}
            onDemo={onAvisoDemo}
            className={`${BTN_SECONDARY_BLOCK} flex-1`}
          >
            <Phone className="size-4 text-slate-500" aria-hidden /> Llamar
          </AccionContacto>
        </>
      ) : correo ? (
        // SIN TELÉFONO LA FILA NO DESAPARECE: DEGRADA. Lo que dice no es "WhatsApp
        // y llamar", es CÓMO SE HABLA CON ESTA PERSONA, y a quien solo dejó correo
        // se le escribe un correo. Sin teléfono NI correo se queda el `···` solo,
        // porque un botón que no puede hacer nada es peor que ninguno.
        //
        // `demo={false}` no es un descuido: en la demo lo que está tapado es el
        // TELÉFONO, y el correo se pinta ya como un `mailto:` vivo en Datos (son
        // los dominios reservados de la RFC 2606, así que no lleva a nadie real).
        // Taparlo aquí y no allí serían dos respuestas para el mismo dato.
        <AccionContacto
          href={`mailto:${correo}`}
          demo={false}
          onDemo={onAvisoDemo}
          onAbrir={esNuevo ? () => onEstado('contactado') : undefined}
          className={`${BTN_SECONDARY_BLOCK} flex-1`}
        >
          <Mail className="size-4 text-slate-500" aria-hidden /> Escribir un correo
        </AccionContacto>
      ) : null}
      {/* EL `···` BAJA DE LA CABECERA A ESTA FILA (Mario, sep 2026). Allí era el
          inventario de la ficha metido entre las flechas de navegar y la equis de
          cerrar, o sea entre controles que no hacen nada CON la persona; aquí está
          con los que sí. Y no se duplica: la cabecera se queda sin él, que es la
          regla de que cada cosa exista una sola vez en cada ancho. */}
      <span className={contactar || correo ? '' : 'ml-auto'}>
        <MenuAcciones
          candidate={candidate}
          cvName={cvName}
          onEliminar={onEliminar}
          bloque
          descartar={{ status: s, onEstado }}
        />
      </span>
    </div>
  )

  // UNA SOLA ACCIÓN PRINCIPAL POR ESTADO, y ahora ocupa una fila para ella sola:
  // el botón dice cuál es el SIGUIENTE paso, no todos los posibles.
  //   · nuevo / contactado -> agendar la entrevista
  //   · entrevista         -> confirmar que se contrata
  //   · contratado         -> ninguna: el proceso acabó
  //   · descartado         -> devolverlo a la lista, que es lo único que queda
  //
  // DESCARTAR SE VA AL `···`, y es lo que hace que esta fila pueda decir UNA cosa.
  // Compartiendo fila con el paso, las dos salidas de la decisión se leían como
  // alternativas equivalentes; y descartar no es lo que se hace a diario con una
  // ficha abierta, es cómo se sale de ella. Sigue siendo un ESTADO reversible: se
  // cambia también desde su pastilla, en Datos, que es donde vive el estado.
  //
  // "Devolver a la lista" SÍ es principal, porque en "descartado" es literalmente
  // lo único que queda por hacer; si estuviera en el menú, salir de un descarte
  // costaría dos clics y uno de ellos a ciegas.
  const principal =
    s === 'entrevista' ? (
      <button type="button" onClick={() => onEstado('contratado')} className={BTN_PRIMARY_BLOCK}>
        Confirmar contratado
      </button>
    ) : s === 'descartado' ? (
      // EN ACENTO, COMO CUALQUIER OTRA PRINCIPAL (Mario, sep 2026). Iba en línea
      // por herencia: cuando compartía fila con "Descartar" era la mitad
      // secundaria de esa pareja. Sola en su fila es lo ÚNICO que queda por hacer
      // con esta persona, o sea la definición de acción principal, y en línea
      // decía lo contrario de lo que es. Que descartar sea reversible se dice
      // ofreciendo la vuelta bien visible, no pintándola de segunda.
      //
      // Vuelve a "nuevo" porque es el único estado que no afirma nada sobre el
      // trato que ya ha habido; el historial conserva por dónde pasó.
      <button type="button" onClick={() => onEstado('nuevo')} className={BTN_PRIMARY_BLOCK}>
        Devolver a la lista
      </button>
    ) : s === 'nuevo' || s === 'contactado' ? (
      <button type="button" onClick={onAgendar} className={BTN_PRIMARY_BLOCK}>
        Agendar entrevista
      </button>
    ) : null

  return (
    // DOS FILAS, SEPARADAS CON AIRE Y NO CON UNA RAYA: 12px entre ellas y 8
    // dentro. Es la regla de siempre (una raya solo vale si separa algo que el
    // hueco no separa), y aquí el hueco basta porque las dos filas ya se
    // distinguen por su forma: arriba una cosa a lo ancho, debajo tres iguales.
    <div className="space-y-3">
      {principal}
      {herramientas}
      {/* CUÁNDO ES LA CITA VA AL PIE, DEBAJO DE TODO (Mario, sep 2026). Estuvo
          entre el paso y las herramientas, con el argumento de que es el dato de
          lo que ese botón acaba de hacer; y el precio era peor que el argumento,
          porque partía en dos los CONTROLES, que son lo que se viene a usar. Los
          dos filas son una unidad (qué haces con esta persona) y una línea de
          texto en medio las separaba como si fueran cosas distintas.

          Debajo cierra el bloque sin estorbar a nada: es un DATO, no una acción,
          y su sitio natural es después de lo que se pulsa. Línea y no un tercer
          botón, por lo mismo; lleva a donde la cita se ve entera. */}
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
        {/* EL ORDEN LO DECIDE PARA QUÉ SE MIRA CADA DATO (Mario, sep 2026):
            ESTADO arriba y solo, CORREO y TELÉFONO en la misma línea, y ORIGEN y
            RECIBIDA cerrando.

            Estaba repartido por cómo cuadraban los anchos (el correo al final
            porque era el único que ocupaba dos columnas) y no por lo que se viene
            a hacer. Leído así, el bloque cuenta una frase: en qué punto está esta
            persona · por dónde la localizas · de dónde salió y cuándo. Lo de
            arriba cambia el trabajo de hoy; lo de abajo es la ficha del archivo.

            ESTADO OCUPA SU PROPIA LÍNEA porque es el único dato que además es un
            CONTROL, y el único que dice qué toca hacer. Su cápsula deja media
            fila vacía a la derecha y está bien: el vacío no se reparte, se deja
            donde cae. */}
        {/* LA COLUMNA DERECHA SE DECLARA Y LA IZQUIERDA SE QUEDA CON EL RESTO.
            A partes iguales el correo se quedaba en 160px y
            `laura.gil21@example.com`, que son 23 caracteres y de los cortos que
            hay, ya pedía 169: se recortaba **el caso normal**, no el raro.

            LOS 116 SON UNA CUENTA, NO UN NÚMERO REDONDO: a la derecha solo caen
            el teléfono y la fecha, y el ancho lo manda el primero, que es
            `formatPhone` de nueve dígitos (84 medidos) + 8 de hueco + 14 del
            icono de copiar + 8 del relleno de su botón = 114, más 2 de aire. La
            fecha corta cabe de sobra.

            Y SE DECLARA EN VEZ DE PONER `auto`, que es lo que se probó primero:
            `ValorCopiable` lleva `max-w-full`, y dentro de una pista `auto` ese
            porcentaje se resuelve contra un ancho que todavía depende del
            contenido. El navegador corta el nudo dando 110 a una celda que pedía
            114, así que el número salía recortado ("646 595 6…") con la columna a
            medio llenar; y quitándole el recorte, partía en dos líneas y
            descuadraba la fila. **Cuando una medida depende de sí misma, se
            declara.** */}
        <dl className="grid grid-cols-[minmax(0,1fr)_116px] gap-x-4 gap-y-3">
          {/* EL ESTADO ES UN DATO MÁS, y vive aquí desde que la cabecera se quedó
              en la identidad (Mario, ago 2026). Estaba en su propia fila debajo
              del nombre; en el raíl es el primero, con los botones que lo mueven
              justo encima. Ocupa el hueco que tenía "Interés actual", que se
              retiró de la ficha: esa señal se sigue viendo en la fila de la
              lista, y en una ficha cualquiera casi siempre decía "sin comprobar",
              porque la comprobación se manda desde un puesto y sobre una
              selección. */}
          <Dato label="Estado" ancho>
            <StatusSelect status={candidate.status} onChange={onEstado} />
          </Dato>
          {/* EL CORREO ES UN ENLACE, no un valor que se copia (Mario, ago 2026):
              es el único dato de este bloque con el que se puede HACER algo desde
              aquí, y `mailto:` lo hace en un clic en vez de en tres (copiar, abrir
              el correo, pegar). Mismo tratamiento que la columna de correo de la
              tabla.

              LO QUE CUESTA BAJARLO A MEDIA FILA, MEDIDO: en los 156px de media
              rejilla caben ~24 caracteres, así que un correo largo se recorta con
              puntos suspensivos. No se pierde (va entero en el `title` y el enlace
              sigue llevando a donde tiene que llevar) y se acepta porque a cambio
              queda al lado del teléfono, que es su hermano: los dos contestan la
              misma pregunta, por dónde se localiza a esta persona, y separados por
              dos filas había que buscarlos. Si algún día molesta, la salida es
              devolverle el ancho entero, NO encoger la letra. */}
          <Dato label="Correo">
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
          <Dato label="Teléfono">
            {!phone ? (
              <span className="font-normal text-slate-500">No disponible</span>
            ) : maskPhone ? (
              <MaskedPhone value={formatPhone(phone)} />
            ) : (
              // EL NÚMERO SE COPIA, Y ESO ES TODO LO QUE HACE (sep 2026).
              //
              // Llegó a desplegar un menú con WhatsApp · Llamar · Copiar, y su
              // motivo era bueno: la cabecera se había retirado en ago 2026 y en
              // escritorio este dato se había quedado sin ninguna acción cerca.
              // Ese motivo se ha vuelto a caer, esta vez por el otro lado: las dos
              // acciones tienen ahora sitio fijo en la fila de herramientas, a un
              // palmo de aquí y en los cinco estados. Repetirlas también aquí
              // serían dos puertas idénticas para lo mismo, y en una celda de
              // 156px no caben sin estrujar el número.
              //
              // Se queda lo único que esa fila NO da y sí hace falta: pegar el
              // número en otro programa. Y con la pieza que ya existía para eso,
              // la misma que usan las respuestas, en vez de un menú propio: un
              // verbo, un clic y nada que descubrir.
              // CON `truncar`, y NO porque se espere recortar: es lo que impide que
              // un valor raro parta en dos líneas y descuadre la fila. Lo que
              // garantiza que el número entre entero es el ancho declarado de su
              // columna, aquí al lado.
              <ValorCopiable valor={formatPhone(phone)} etiqueta="Teléfono" num truncar />
            )}
          </Dato>
          <Dato label="Origen">{SOURCE_META[candidate.source].label}</Dato>
          {/* La fecha SOLA, en su casilla, se dice corta: aquí se compara el día,
              y la hora exacta cambia de canal (al `title` y al `datetime`), que
              es lo que ya hace la columna Recibida de la tabla. Escrita entera no
              cabía en media rejilla de 336px y rompía la fila en dos líneas. */}
          <Dato label="Recibida">
            <time dateTime={candidate.submittedAt} title={fullDateTime(candidate.submittedAt)} className="num">
              {fechaCorta(candidate.submittedAt)}
            </time>
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
 * LA PESTAÑA TRAYECTORIA: la línea de tiempo del trabajador (Mario, ago 2026).
 * Lo que Meridian transcribió del CV, pintado como se lee una vida laboral: un
 * raíl vertical con una parada por empleo, y debajo los carnets y la formación.
 * Vivía como lista apretada encima del visor de Documentos; con pestaña propia
 * la lectura tiene aire y las fechas caen en una sola vertical.
 *
 * Transcripción, no interpretación: las fechas se pintan tal cual las escribe
 * el CV (por eso no se calculan duraciones ni se ordena nada: el orden es el
 * del documento, que casi siempre es el cronológico inverso).
 *
 * SE PINTA SIEMPRE, con su vacío, como Documentos: una ficha que cambia de
 * pestañas según lo que traiga cada persona obliga a releerla entera cada vez.
 * Y el vacío dice CUÁL de los vacíos es, que no significan lo mismo.
 */
function TrayectoriaTab({
  pideCv,
  tieneCv,
  ai,
  trayectoria,
}: {
  pideCv: boolean
  tieneCv: boolean
  ai: Candidate['ai']
  trayectoria: AiTrayectoria | undefined
}) {
  // En escritorio la pestaña ocupa la columna entera: la tarjeta acota la
  // lectura, como los bloques de Información. En móvil, franja plana.
  const caja = 'sm:max-w-[640px] sm:rounded-xl sm:filo sm:p-5'
  if (!trayectoria) {
    const vacio = !pideCv
      ? 'Este puesto no pide CV, así que no hay trayectoria que leer.'
      : !tieneCv
        ? 'No ha subido su CV: no hay trayectoria que leer.'
        : !ai || ai.error
          ? `Analiza la candidatura con ${MERIDIAN_NAME} y la trayectoria se extrae sola del CV.`
          : `Este análisis no trae la trayectoria. Vuelve a analizar la candidatura desde el informe de ${MERIDIAN_NAME}.`
    return <p className="max-w-[46ch] text-[13px] leading-5 text-slate-500">{vacio}</p>
  }
  const t = trayectoria
  const rotulo = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500'
  return (
    <div className={caja}>
      {t.empleos.length > 0 && (
        <section>
          <h3 className={rotulo}>Experiencia</h3>
          {/* El raíl: una línea continua con una parada por empleo. El punto
              lleva un aro del color de la superficie para separarse de la
              línea (un halo, la excepción declarada al ring-inset). */}
          <ol className="mt-3 space-y-5 border-l border-slate-200 pl-5 [margin-left:5px]">
            {t.empleos.map((e, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute top-[5px] size-2.5 rounded-full bg-slate-400 ring-2 ring-white [left:-26px]"
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="min-w-0 text-sm font-semibold leading-5 text-slate-900">{e.puesto || e.empresa}</p>
                  {(e.desde || e.hasta) && (
                    <p className="num shrink-0 text-[13px] leading-5 text-slate-500">
                      {[e.desde, e.hasta].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>
                {e.puesto && e.empresa && <p className="text-[13px] leading-5 text-slate-600">{e.empresa}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {t.carnets.length > 0 && (
        <section className={t.empleos.length > 0 ? 'mt-6' : ''}>
          <h3 className={rotulo}>Carnets y certificados</h3>
          <ul className="mt-2 space-y-1.5">
            {t.carnets.map((c, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[13px] leading-5">
                <BadgeCheck className="size-3.5 shrink-0 translate-y-0.5 text-slate-500" aria-hidden />
                <span className="min-w-0 text-slate-700">
                  {c.nombre}
                  {c.vigencia && <span className="text-slate-500"> · {c.vigencia}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {t.formacion.length > 0 && (
        <section className={t.empleos.length > 0 || t.carnets.length > 0 ? 'mt-6' : ''}>
          <h3 className={rotulo}>Formación</h3>
          <ul className="mt-2 space-y-1.5">
            {t.formacion.map((f, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[13px] leading-5 text-slate-700">
                <GraduationCap className="size-3.5 shrink-0 translate-y-0.5 text-slate-500" aria-hidden />
                <span className="min-w-0">{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-6 border-t border-slate-100 pt-2.5 text-[12px] leading-4 text-slate-500">
        Extraída del CV por {MERIDIAN_NAME}: transcripción literal, con las fechas tal cual las escribe el documento.
      </p>
    </div>
  )
}

/**
 * Visor del CV. Se firma la URL del bucket privado y se pinta dentro del pop-up:
 * abrir el CV era salir de la app a una pestaña nueva y volver.
 *
 * Los PDF se pintan con `CvViewer` (pdf.js), que es quien puede SUBRAYAR las
 * citas de Meridian; si pdf.js no puede con el fichero, se cae al iframe de
 * siempre, que enseña sin subrayar. El formulario admite .doc y .docx, y un
 * iframe con un .docx muestra un rectángulo en blanco o lo descarga a la brava;
 * para esos se dice claro y se ofrece descargarlo.
 *
 * Un `cvPath` que empieza por `/` es un ASSET de la demo (public/), no un
 * objeto del bucket: se usa tal cual, sin firmar y sin pedir su peso, el mismo
 * criterio que `brandAssetUrl` con las imágenes de marca de la demo.
 */
/**
 * LOS DOCUMENTOS DE UNA CANDIDATURA (Mario, ago 2026). Antes era UNO y punto:
 * el formulario subía el primer fichero y la ficha lo pintaba. Ahora un puesto
 * puede pedir varios (CV y carnet), y el equipo puede AÑADIR los que recopila
 * después (la documentación, el contrato firmado) para tener constancia de por
 * dónde va cada candidatura sin salir de aquí.
 *
 * LA LISTA SE COMPONE, NO SE GUARDA: es [el CV] + [las filas de
 * `candidate_documents`]. El CV sigue viviendo en `candidate.cvPath`, que es lo
 * que lee Meridian y lo que exporta el ZIP, así que cada documento tiene UNA
 * sola fuente y no hay dos sitios que puedan decir cosas distintas.
 *
 * EL SELECTOR ES EL GRUPO DE PASTILLAS de la ficha en móvil (variante `pastilla`
 * de `ui/Tabs`), no un control nuevo: son destinos excluyentes dentro de un
 * apartado, que es exactamente lo que aquel resuelve, con sus roles y sus
 * flechas. **Solo se pinta con dos o más**: con uno sería el título del
 * documento repetido, que es el mismo argumento que retiró el `tablist` de una
 * sola pestaña del panel de un puesto.
 *
 * Y las CITAS de Meridian solo viajan con el CV: es el único que analiza, así
 * que subrayar en otro documento sería prometer una evidencia que no existe.
 */
/**
 * CÓMO SE LLAMA UN DOCUMENTO EN SU PASTILLA (Mario, ago 2026: "lo que no sé es
 * cómo resolveremos lo de saber qué tipo de documento es para darle el nombre").
 *
 * El nombre del fichero no sirve: `6727ffc8bad0d.jpg` no dice nada y
 * `cv-andrei-vasile.pdf` dice lo que ya sabes (de quién es la ficha). Y
 * ADIVINARLO por el nombre ("si pone dni es un DNI") es exactamente lo que esta
 * casa no hace: acierta casi siempre y el casi es una etiqueta falsa.
 *
 * Así que el tipo se DECLARA, y cada documento tiene quien lo declare:
 *  · El CV es el CV: es el que lee Meridian, ése es su papel.
 *  · Los del FORMULARIO los nombró la empresa al escribir la pregunta ("Carnet
 *    de carretillero"). Por eso se guarda `campo_id`: la etiqueta sale de ahí.
 *  · Los que añade el equipo los nombra quien los sube, con el nombre del
 *    fichero pre-rellenado. Sin lista cerrada de tipos: la documentación real
 *    varía por sector (contrato, alta en la Seguridad Social, un certificado, una
 *    tarjeta profesional) y una lista siempre acaba en "Otro", que no dice nada.
 */
function etiquetaDoc(nombre: string, campoId: string | undefined, campos: FormField[]): string {
  const campo = campoId ? campos.find((f) => f.id === campoId) : undefined
  const texto = campo?.label?.trim() || nombre.replace(/\.[a-z0-9]+$/i, '')
  // Una pastilla larga empuja a las demás fuera de la tira. El nombre entero
  // sigue a la vista en la fila del documento, justo debajo.
  return texto.length > 34 ? `${texto.slice(0, 33)}…` : texto
}

function Documentos({
  campaign,
  candidate,
  cvName,
  pideDocumentos,
  citas,
  citaActiva,
  cvLeido,
  onLocalizadas,
}: {
  campaign: Campaign
  candidate: Candidate
  cvName: string
  /** El formulario pedía algún fichero. Cambia lo que dice el vacío. */
  pideDocumentos: boolean
  citas: CitaCv[]
  citaActiva: CitaActiva | null
  cvLeido: 'texto' | 'vision' | 'no' | undefined
  onLocalizadas?: (ids: string[]) => void
}) {
  const { loadCandidateDocuments, addCandidateDocument, removeCandidateDocument } = useStore()
  const { company } = useAuth()
  const esDemo = company?.id === 'demo'
  const toast = useToast()
  const [extra, setExtra] = useState<CandidateDocument[]>([])
  const [sel, setSel] = useState('cv')
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState(false)
  // EL DOCUMENTO SE NOMBRA ANTES DE SUBIRLO. Es un paso más, y se paga a
  // propósito: sin él la pastilla diría `scan_20260831_0001.pdf`, que no es un
  // tipo de documento, y no habría dónde corregirlo después. Va pre-rellenado
  // con el nombre del fichero sin extensión, así que muchas veces es un Intro.
  const [pendiente, setPendiente] = useState<{ file: File; nombre: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nombreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    void loadCandidateDocuments(candidate.id).then((ds) => {
      if (vivo) setExtra(ds)
    })
    return () => {
      vivo = false
    }
    // `loadCandidateDocuments` viene del store y se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  const lista = useMemo(
    () => [
      ...(candidate.cvPath
        ? [{ id: 'cv', path: candidate.cvPath, nombre: cvName || 'CV', etiqueta: 'CV', esCv: true }]
        : []),
      ...extra.map((d) => ({
        id: d.id,
        path: d.path,
        nombre: d.nombre,
        etiqueta: etiquetaDoc(d.nombre, d.campoId, campaign.fields),
        esCv: false,
      })),
    ],
    [candidate.cvPath, cvName, extra, campaign.fields],
  )
  const actual = lista.find((d) => d.id === sel) ?? lista[0]

  const anadir = async (file: File, nombre: string) => {
    // El mismo tope que el formulario público y que el bucket (8 MiB): si el
    // cliente no lo dice, el fallo llega al final de una subida larga.
    if (file.size > 8 * 1024 * 1024) {
      toast.error('El documento no puede pasar de 8 MB.')
      return
    }
    setSubiendo(true)
    // EN LA DEMO EL FICHERO NO SALE DEL NAVEGADOR, como el envío del formulario
    // de un puesto de demostración: se previsualiza con un object URL y no se
    // guarda en ninguna parte. Por eso los documentos de la demo tampoco se
    // persisten (ver el store): una entrada que sobreviviera a la recarga
    // apuntaría a un blob muerto, que es peor que no tenerla.
    if (esDemo) {
      const fila = await addCandidateDocument(candidate.id, {
        path: URL.createObjectURL(file),
        nombre,
        bytes: file.size,
      })
      setSubiendo(false)
      if (!fila) return
      setExtra((ds) => [...ds, fila])
      setSel(fila.id)
      toast.show('Añadido. En la demostración no se guarda: al recargar no estará.')
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    // La MISMA forma de ruta que valida la política del bucket: <slug>/<uuid>.<ext>.
    const path = `${campaign.slug}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('cvs').upload(path, file, { upsert: false })
    if (up.error) {
      setSubiendo(false)
      toast.error('No se pudo subir el documento.')
      return
    }
    const fila = await addCandidateDocument(candidate.id, { path: up.data.path, nombre, bytes: file.size })
    setSubiendo(false)
    if (!fila) {
      // EL FICHERO SE QUEDA EN EL BUCKET, y no es un descuido: aquí había un
      // `remove()` que no borraba nada. El permiso de borrado se deriva de la FILA
      // (`20260902130000_borrar_documentos.sql`) y este es justo el caso en que la
      // fila no existe, así que no hay nada de donde derivarlo. Se probó cubrirlo
      // por `owner_id`, y para eso hay que ensanchar también la LECTURA del bucket
      // (storage exige ver el objeto antes de borrarlo): no compensa abrir la
      // lectura de una carpeta de CV por un fallo raro. El huérfano lo limpia un
      // barrido de servidor, que está pendiente.
      toast.error('No se pudo guardar el documento.')
      return
    }
    setExtra((ds) => [...ds, fila])
    setSel(fila.id)
    toast.success('Documento añadido')
  }

  /**
   * QUITAR UN DOCUMENTO, y el CV no es uno de ellos.
   *
   * Solo se ofrece para los de `candidate_documents`: el CV vive en
   * `candidates.cv_path`, es lo que lee Meridian y lo que ha citado el informe
   * que está justo encima, así que quitarlo no es retirar un adjunto, es dejar
   * el análisis hablando de un documento que ya no está. Cuando haya que
   * poder, será su propio verbo y no éste.
   *
   * El resto del cuidado vive en el store (`removeCandidateDocument`): borra el
   * FICHERO primero y la fila después, porque el permiso sobre el bucket se
   * deriva de la fila.
   */
  const quitar = async (id: string) => {
    const doc = extra.find((d) => d.id === id)
    setQuitando(true)
    const ok = await removeCandidateDocument(id)
    setQuitando(false)
    if (!ok) {
      toast.error('No se pudo quitar el documento.')
      return
    }
    // En la demo el fichero nunca salió del navegador: su `path` es un object
    // URL, y sin revocarlo el blob se queda en memoria hasta recargar.
    if (doc?.path.startsWith('blob:')) URL.revokeObjectURL(doc.path)
    setExtra((ds) => ds.filter((d) => d.id !== id))
    // `sel` no se toca: `actual` cae solo al primero de la lista que queda, y
    // dos sitios decidiendo cuál está elegido es como empiezan a discrepar.
    toast.show('Documento quitado')
  }

  return (
    <div className="flex flex-col">
      {/* La fila de arriba: entre qué documentos elegir, y el "+" para sumar uno
          nuevo. El "+" está SIEMPRE, también sin ningún documento: es la puerta
          para empezar a guardar la documentación de alguien que se apuntó sin
          adjuntar nada. */}
      {/* Mientras se nombra, la fila ES el paso de nombrar: el selector y el "+"
          no hacen falta hasta que decidas, y dos cosas que hacer a la vez en la
          misma fila es lo que convierte un paso en un formulario. */}
      {pendiente ? (
        <form
          className="flex items-center gap-2 pb-3 sm:px-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            const nombre = pendiente.nombre.trim()
            if (!nombre) return
            const { file } = pendiente
            setPendiente(null)
            void anadir(file, nombre)
          }}
        >
          <label htmlFor={`doc-nombre-${candidate.id}`} className="sr-only">
            Nombre del documento
          </label>
          <input
            id={`doc-nombre-${candidate.id}`}
            ref={nombreRef}
            value={pendiente.nombre}
            onChange={(e) => setPendiente((p) => (p ? { ...p, nombre: e.target.value } : p))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setPendiente(null)
              }
            }}
            maxLength={80}
            placeholder="¿Qué documento es? (contrato, carnet…)"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 pointer-coarse:text-base"
          />
          <button type="submit" disabled={!pendiente.nombre.trim()} className={`${BTN_PRIMARY_SM} shrink-0 disabled:opacity-50`}>
            Añadir
          </button>
          <button type="button" onClick={() => setPendiente(null)} className={`${BTN_SECONDARY_SM} shrink-0`}>
            Cancelar
          </button>
        </form>
      ) : (
      <div className="flex items-center gap-2 pb-3 sm:px-3.5">
        {/* EL SELECTOR SE PINTA AUNQUE HAYA UNO SOLO (Mario, ago 2026). Con dos
            se justifica solo; con uno también, y no contradice al "un tablist de
            una pestaña es el título repetido" del panel: allí la pestaña
            repetía el nombre de la PANTALLA, y aquí la pastilla dice QUÉ
            documento es (su tipo), que no está escrito en ningún otro sitio.
            Además deja el sitio hecho: cuando entra el segundo, aparece donde ya
            estabas mirando en vez de cambiar la forma del bloque. */}
        {lista.length > 0 ? (
          <div className="min-w-0 flex-1">
            <Tabs
              variante="pastilla"
              items={lista.map((d) => ({ value: d.id, label: d.etiqueta }))}
              value={actual?.id ?? 'cv'}
              onChange={setSel}
              idPrefix={`docs-${candidate.id}`}
              label="Documentos de la candidatura"
            />
          </div>
        ) : (
          <span className="min-w-0 flex-1 text-[13px] text-slate-500">
            {pideDocumentos ? 'No ha subido ningún documento.' : 'Este puesto no pide documentos.'}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            // El valor se limpia SIEMPRE: sin esto, volver a elegir el mismo
            // fichero no dispara `change` y el botón parece muerto.
            e.target.value = ''
            if (!f) return
            if (f.size > 8 * 1024 * 1024) {
              toast.error('El documento no puede pasar de 8 MB.')
              return
            }
            setPendiente({ file: f, nombre: f.name.replace(/\.[a-z0-9]+$/i, '') })
            requestAnimationFrame(() => nombreRef.current?.select())
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
          title="Añadir un documento"
          aria-label="Añadir un documento"
          className={`${BTN_SECONDARY_SM} shrink-0 disabled:opacity-60`}
        >
          {subiendo ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          Añadir
        </button>
      </div>
      )}

      {actual && (
        <Cv
          // Al cambiar de documento se remonta: el visor descarga bytes, firma
          // una URL y guarda su estado, y reusarlo enseñaría el anterior un
          // instante antes de refrescarse.
          key={actual.id}
          candidate={candidate}
          path={actual.path}
          cvName={actual.nombre}
          citas={actual.esCv ? citas : []}
          citaActiva={actual.esCv ? citaActiva : null}
          cvLeido={actual.esCv ? cvLeido : undefined}
          onLocalizadas={actual.esCv ? onLocalizadas : undefined}
          onQuitar={actual.esCv ? undefined : () => quitar(actual.id)}
          quitando={quitando}
        />
      )}
    </div>
  )
}

function Cv({
  candidate,
  path,
  cvName,
  citas,
  citaActiva,
  cvLeido,
  onLocalizadas,
  onQuitar,
  quitando,
}: {
  candidate: Candidate
  /** El documento a enseñar. Ya no se deduce de `candidate.cvPath`: desde que
   *  una candidatura puede tener varios, quien elige cuál es la lista de
   *  arriba, y este bloque solo sabe pintar el que le den. */
  path: string
  cvName: string
  citas: CitaCv[]
  citaActiva: CitaActiva | null
  cvLeido: 'texto' | 'vision' | 'no' | undefined
  onLocalizadas?: (ids: string[]) => void
  /** Solo lo traen los documentos que se pueden retirar; el CV, nunca. */
  onQuitar?: () => void | Promise<void>
  quitando?: boolean
}) {
  // Firmar, bajar los bytes, leer el peso y reintentar viven en `useDocumento`
  // (lib/documento.ts) desde sep 2026: la columna Documentos abre el mismo visor
  // sin la ficha, y ese camino no puede estar escrito dos veces.
  const { url, bytes, peso, error, esPdf, visorFallo, fallarVisor, reintentar: recargar, descargar: bajar } = useDocumento(path)
  // El documento a pantalla completa (CvLightbox): se abre pinchando sobre
  // cualquier página del incrustado.
  const [ampliado, setAmpliado] = useState(false)
  // SE CONFIRMA EN LA PROPIA FILA, no en un diálogo encima: esto ya vive dentro
  // de un modal y dos capas apiladas se pelean por el Escape (lo mismo que
  // decidieron `SedesDialog` y el borrado de una nota). De regalo, el documento
  // sigue debajo mientras decides: se confirma lo que se está mirando.
  // No hace falta reiniciarlo al cambiar de documento porque el visor se remonta
  // por `key`, así que este estado nace limpio con cada uno.
  const [confirmando, setConfirmando] = useState(false)
  const cancelarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // El foco vive en la papelera, que acaba de desaparecer: sin recogerlo se
    // caería al body. Va a "Cancelar" y no a "Quitar" porque un Intro de más no
    // puede borrar un documento.
    if (confirmando) cancelarRef.current?.focus()
  }, [confirmando])
  const toast = useToast()
  const descargarConAviso = async () => {
    if (!(await bajar())) toast.error(ERROR_DESCARGA)
  }

  // Dentro de la tarjeta de Documentos, así que aquí NO se pinta ni marco ni
  // radio: el visor es la banda de abajo y el nombre del fichero la de arriba,
  // separadas por un filo de interior (`slate-100`, el que guía) igual que las
  // filas de Respuestas. Con su propio `rounded-xl filo` había un borde dentro
  // de otro a 12px de distancia.
  const banda = 'grid place-items-center bg-slate-50 px-6 text-center'
  // QUÉ HACE LA FILA, que es lo único que hace ahora (Mario, ago 2026: fuera
  // "Descargar" y "Abrir aparte"). Los dos verbos viven en el visor grande, que
  // es donde se trabaja con el documento; repetidos aquí eran dos controles en
  // una fila que ya tiene su acción.
  //
  // Pero un Word NO abre el visor, así que quitarlos a secas lo habría dejado
  // sin ninguna forma de bajarlo. Por eso la fila hace lo que se pueda hacer con
  // ESE documento: un PDF lo AMPLÍA y lo demás lo DESCARGA. Sigue siendo una
  // sola puerta, y nunca una que no lleve a ningún sitio.
  const ampliable = esPdf && !!bytes
  const accion: 'ampliar' | 'descargar' | null = ampliable ? 'ampliar' : path ? 'descargar' : null
  return (
    <div className="flex flex-col">
      {confirmando ? (
        <div
          className="border-b border-slate-100 py-2.5 sm:px-3.5"
          onKeyDown={(e) => {
            // En CAPTURA no, que aquí no hace falta: `ui/Modal` escucha en
            // `document` y este manejador corre antes por burbujeo desde el
            // botón enfocado. Lo que sí hace falta es cortar, o Escape cerraría
            // la ficha entera en vez de esta pregunta.
            if (e.key === 'Escape' && !quitando) {
              e.stopPropagation()
              setConfirmando(false)
            }
          }}
        >
          <p className="text-sm text-slate-800">
            ¿Quitar <span className="font-semibold">{cvName || 'este documento'}</span>?
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            Se borra el fichero y no se puede deshacer. El resto de la ficha no se toca.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={quitando}
              onClick={() => void onQuitar?.()}
              className={`${BTN_DANGER_SM} disabled:opacity-50`}
            >
              {quitando ? 'Quitando…' : 'Quitar'}
            </button>
            <button
              type="button"
              ref={cancelarRef}
              disabled={quitando}
              onClick={() => setConfirmando(false)}
              className={BTN_SECONDARY_SM}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-100 py-2.5 sm:px-3.5">
        {/* UN MÍNIMO PARA EL NOMBRE, y por eso la fila ENVUELVE (Mario, ago 2026:
            "que salga con ... al final para que no se monte"). Recortarse ya se
            recortaba (`truncate`), pero en 375px el nombre se estrujaba a 113px
            entre el icono y los dos verbos: diez caracteres y puntos suspensivos,
            que no es un nombre de fichero, es un acertijo. Con 10rem de suelo, si
            los tres no caben en una línea son los BOTONES los que bajan, que es
            el orden correcto: el nombre dice QUÉ documento es y los verbos se
            encuentran igual una línea más abajo. */}
        {/* EL DOCUMENTO ES EL BOTÓN que abre el visor grande (Mario, ago 2026).
            Pinchar una página del incrustado ya lo abría, pero eso hay que
            descubrirlo; el nombre del fichero es lo que la gente pulsa para ver
            un documento, y estaba mudo. La fila entera hasta las acciones es la
            diana, no solo las letras.

            Es un `<button>` y no un `div` con `onClick`, y los dos verbos de la
            derecha quedan FUERA de él: un botón dentro de otro es marcado
            inválido, así que son hermanos en la misma fila.

            Y solo se pinta como botón cuando de verdad puede abrir algo (hay
            bytes de un PDF). Mientras carga, o si es un Word, es el mismo texto
            sin más: un botón que no puede hacer nada es peor que ninguno. */}
        {accion ? (
          <button
            type="button"
            onClick={() => (accion === 'ampliar' ? setAmpliado(true) : void descargarConAviso())}
            title={cvName || 'CV'}
            aria-label={
              accion === 'ampliar'
                ? `Ver ${cvName || 'el CV'} a pantalla completa`
                : `Descargar ${cvName || 'el CV'}`
            }
            className={`-mx-1.5 flex min-w-[10rem] flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
              accion === 'ampliar' ? 'cursor-zoom-in' : ''
            }`}
          >
            <FileText className="hidden size-4 shrink-0 text-slate-500 sm:block" aria-hidden />
            <span className="min-w-0 truncate text-sm font-medium text-slate-900">{cvName || 'CV'}</span>
            {peso && <span className="num shrink-0 text-[13px] text-slate-500">{peso}</span>}
          </button>
        ) : (
          <>
            {/* Decorativo: en móvil no hay sitio y el nombre del archivo manda. */}
            <FileText className="hidden size-4 shrink-0 text-slate-500 sm:block" aria-hidden />
            <span className="min-w-[10rem] max-w-full flex-1 truncate text-sm font-medium text-slate-900" title={cvName || 'CV'}>
              {cvName || 'CV'}
            </span>
            {peso && <span className="num shrink-0 text-[13px] text-slate-500">{peso}</span>}
          </>
        )}
        {/* QUITAR ESTE DOCUMENTO. Actúa sobre el que estás viendo y no lleva una
            equis por pastilla: en una tira que ya se desliza, un control por
            documento son N dianas pequeñas y ninguna te enseña lo que vas a
            borrar. Aquí el documento está debajo, a la vista. Fuera del botón
            del nombre, como los demás verbos: un botón dentro de otro es
            marcado inválido. */}
        {onQuitar && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            title={`Quitar ${cvName || 'el documento'}`}
            aria-label={`Quitar ${cvName || 'el documento'}`}
            className={botonIcono('ghost', 'sm', 'hover:bg-red-50 hover:text-red-600')}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      )}

      {!esPdf ? (
        <div className={`min-h-[240px] ${banda}`}>
          <p className="max-w-[42ch] text-sm leading-6 text-slate-500">
            Este CV está en Word y no se puede ver aquí dentro. Pulsa su nombre para descargarlo.
          </p>
        </div>
      ) : error ? (
        <div className={`min-h-[240px] ${banda}`}>
          <div>
            <p className="max-w-[42ch] text-sm leading-6 text-slate-500">No se pudo abrir el CV. Prueba a descargarlo.</p>
            <button type="button" onClick={recargar} className={`mt-3 ${BTN_SECONDARY_SM}`}>
              Reintentar
            </button>
          </div>
        </div>
      ) : visorFallo && url && navigator.pdfViewerEnabled === false ? (
        // El plan B de abajo es un iframe con el visor de PDF DEL NAVEGADOR, y
        // hay navegadores sin él (lo dicen ellos mismos): ahí el iframe pinta
        // un rectángulo gris mudo, que es exactamente el "sale en gris" que no
        // se podía diagnosticar. Mejor decirlo y ofrecer la salida.
        <div className={`min-h-[240px] ${banda}`}>
          <div>
            <p className="max-w-[42ch] text-sm leading-6 text-slate-500">
              Este navegador no puede enseñar el CV aquí dentro. Descárgalo o ábrelo aparte.
            </p>
            <button type="button" onClick={recargar} className={`mt-3 ${BTN_SECONDARY_SM}`}>
              Reintentar
            </button>
          </div>
        </div>
      ) : visorFallo && url ? (
        // Plan B: el iframe de siempre. Enseña el documento sin subrayados; las
        // citas siguen enteras, en texto, en el informe de Meridian.
        <iframe src={url} title={`CV de ${candidateName(candidate) || 'el candidato'}`} className="h-[560px] w-full bg-slate-50" />
      ) : bytes ? (
        <>
          <CvViewer
            data={bytes}
            titulo={`CV de ${candidateName(candidate) || 'el candidato'}`}
            citas={citas}
            citaActiva={citaActiva}
            nota={cvLeido === 'vision' ? `CV escaneado: ${MERIDIAN_NAME} lo leyó transcribiéndolo, sin citas que subrayar.` : undefined}
            onFallo={fallarVisor}
            onLocalizadas={onLocalizadas}
            onAmpliar={() => setAmpliado(true)}
          />
        </>
      ) : (
        <div className={`min-h-[360px] ${banda}`}>
          <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden /> Abriendo el CV…
          </p>
        </div>
      )}

      {/* Vive FUERA de la rama del incrustado porque ya no lo abre solo él: lo
          abren las páginas y el nombre del fichero, que es la fila de arriba. */}
      {ampliado && bytes && (
        <CvLightbox
          nombre={cvName || 'CV'}
          data={bytes}
          citas={citas}
          onClose={() => setAmpliado(false)}
          onDescargar={() => void descargarConAviso()}
          urlAparte={url}
        />
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
  onEdit,
  onDelete,
}: {
  candidateId: string
  chatVersion: number
  currentUserId: string | null
  members: ReturnType<typeof useStore>['members']
  load: ReturnType<typeof useStore>['loadCandidateComments']
  onSend: ReturnType<typeof useStore>['addCandidateComment']
  onEdit: ReturnType<typeof useStore>['editCandidateComment']
  onDelete: ReturnType<typeof useStore>['deleteCandidateComment']
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
      // A quién avisó de verdad, para que la chapa de una mención no mienta en
      // una nota corregida (ver `ChatBody`).
      mentions: c.mentions,
      editedAt: c.editedAt,
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
            // La lista se corrige en el sitio: el servidor manda (RLS + trigger),
            // aquí solo se refleja para no volver a pedir el hilo entero.
            onEdit={async (id, body) => {
              const ok = await onEdit(id, body)
              if (ok)
                setItems((cs) =>
                  cs.map((c) => (c.id === id ? { ...c, body, editedAt: new Date().toISOString() } : c)),
                )
              return ok
            }}
            onDelete={async (id) => {
              const ok = await onDelete(candidateId, id)
              if (ok) setItems((cs) => cs.filter((c) => c.id !== id))
              return ok
            }}
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
/**
 * LA CARCASA DE UN MENÚ QUE FLOTA: disparador, panel en portal y colocación.
 *
 * No es una abstracción por gusto: dentro hay cuatro decisiones que ya costaron
 * su fallo cada una, y copiarlas a mano en el siguiente menú es garantizar que
 * una se quede vieja.
 *
 *   1. VA EN UN PORTAL con posición fija. Estos menús viven dentro de columnas
 *      que se desplazan (el raíl, la columna de móvil), y ahí un panel
 *      `absolute` lo recorta el propio scroll.
 *   2. SE MIDE ANTES DE VERSE. Para decidir si abre hacia abajo o hacia arriba
 *      hace falta su ALTO, y el alto no existe hasta estar en el DOM: se monta
 *      invisible, se mide en un `useLayoutEffect` y solo entonces se coloca. Es
 *      el mismo patrón que el globo de `ui/Tooltip`.
 *   3. EL ESCAPE SE CORTA EN CAPTURA. `ui/Modal` (la ficha) escucha el mismo
 *      evento en `document` y se registra ANTES, así que en fase de burbuja la
 *      ficha entera se cerraría antes de que el menú pudiera cortar nada.
 *   4. EL CLICK-FUERA MIRA EL DISPARADOR **Y** EL PANEL. En el DOM el panel ya
 *      no está dentro del botón, así que un clic en él se leería como un clic
 *      fuera y el menú se cerraría antes de que el ítem hiciera nada.
 */
function MenuFlotante({
  etiqueta,
  ancho = 232,
  alinear = 'derecha',
  banda,
  disparador,
  children,
}: {
  /** Nombre accesible del menú. */
  etiqueta: string
  ancho?: number
  alinear?: 'izquierda' | 'derecha' | 'centro'
  /**
   * La superficie que contiene al disparador, si la hay (la barra del pulgar).
   *
   * EL HUECO SE MIDE CONTRA LA CAJA QUE PINTA, NO CONTRA EL BOTÓN: el `···` vive
   * DENTRO del relleno de la barra, así que separándose 6px de él el menú se
   * metía 5 dentro de la barra y se leía pisándola (medido). Lo que el botón
   * decide es de dónde sale en horizontal; hasta dónde puede llegar en vertical
   * lo decide su contenedor.
   */
  banda?: React.RefObject<HTMLDivElement | null>
  /** El botón que lo abre. Recibe lo que tiene que llevar puesto. */
  disparador: (props: {
    ref: React.RefObject<HTMLButtonElement | null>
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    onClick: () => void
  }) => React.ReactNode
  /** Los ítems. Reciben la forma de cerrar, que es lo que hacen todos al pulsarse. */
  children: (cerrar: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

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
    const a = { left: b.left, right: b.right, top: caja?.top ?? b.top, bottom: caja?.bottom ?? b.bottom }
    setPos(
      colocarFlotante(a, { width: ancho, height: m.height }, { width: window.innerWidth, height: window.innerHeight }, { alinear }),
    )
  }, [open, banda, ancho, alinear])

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

  return (
    <>
      {disparador({
        ref: btnRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: () => setOpen((o) => !o),
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={etiqueta}
            // Invisible mientras no se sabe dónde va: ocupa sitio para poder
            // medirse, pero sin enseñarse en la esquina antes de saltar a su hueco.
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: ancho, visibility: pos ? undefined : 'hidden' }}
            className="z-[70] overflow-hidden rounded-xl filo bg-white py-1 shadow-pop"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  )
}

/** Un ítem de esos menús. Una sola pintura para todos. */
const ITEM_MENU = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'

function MenuAcciones({
  candidate,
  cvName,
  onEliminar,
  size = 'md',
  // En la barra del pulgar y en la fila de herramientas lleva caja, porque allí
  // sus vecinos son botones de verdad. `ghost` queda para cuando comparta fila
  // con fantasmas, que es donde un botón de línea se leería como de otro grupo.
  variante = 'secondary',
  bloque = false,
  descartar,
  banda,
}: {
  candidate: Candidate
  cvName: string
  onEliminar: () => void
  size?: 'sm' | 'md'
  variante?: 'secondary' | 'ghost'
  /**
   * TALLA DE BLOQUE (44px y radio 10), para cuando comparte fila con botones de
   * bloque: en la fila de herramientas de la ficha, un cuadrado de 36 al lado de
   * dos botones de 44 se lee hundido. Es una variante DECLARADA y no un `size-11`
   * pegado desde fuera, porque `size-9` y `size-11` son la misma utilidad y no se
   * resuelven por el orden en que se escriben.
   */
  bloque?: boolean
  /**
   * DESCARTAR VIVE AQUÍ DESDE SEP 2026, y es opcional porque no todo el que monta
   * este menú tiene con qué mover el estado. Salió de ser un botón para que la
   * fila de arriba pueda decir UNA cosa: compartiendo fila con el siguiente paso,
   * las dos salidas de la decisión se leían como alternativas equivalentes, y no
   * lo son. Sigue siendo un ESTADO reversible y sigue teniendo su otra puerta, la
   * pastilla de Datos, que es donde el estado vive.
   *
   * En "descartado" no se pinta: allí lo que hay que ofrecer es volver, y eso es
   * la acción principal de la fila de arriba.
   */
  descartar?: { status: CandidateStatus; onEstado: (s: CandidateStatus) => void }
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
  const toast = useToast()

  const copiarContacto = async (cerrar: () => void) => {
    const phone = String(candidate.answers['telefono'] ?? '')
    const correo = Object.entries(candidate.answers).find(([k]) => k === 'email')?.[1]
    const texto = [candidateName(candidate), phone && formatPhone(phone), correo && String(correo)].filter(Boolean).join('\n')
    const ok = await copyText(texto)
    if (ok) toast.success('Datos de contacto copiados')
    else toast.show('No se pudieron copiar los datos.')
    cerrar()
  }

  const descargarCv = async (cerrar: () => void) => {
    cerrar()
    if (!candidate.cvPath) return
    const { data, error } = await supabase.storage.from('cvs').createSignedUrl(candidate.cvPath, 120, { download: true })
    if (error || !data?.signedUrl) {
      toast.error('No se pudo descargar el CV.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <MenuFlotante etiqueta="Acciones del candidato" banda={banda}
      disparador={(props) => (
        // La pintura del secundario estaba copiada a mano aquí y sale de `botonIcono`.
        // Lo que NO se toca es el objetivo de toque: `TALLA_ICONO.sm` es `size-8` a
        // secas, sin `pointer-coarse`, y la clase que había sí crecía a 44. La fila
        // compacta que lo contiene es `hidden sm:flex`, y `sm` arranca en 640px, o sea
        // que se pinta en cualquier tablet: ahí sí hay dedo, y la doctrina dice que la
        // densidad de escritorio no se paga con un dedo que falla.
        <button
          {...props}
          type="button"
          aria-label="Más acciones"
          className={
            bloque
              ? botonIconoBloque('secondary')
              : botonIcono(variante, size, size === 'sm' ? 'pointer-coarse:size-11' : '')
          }
        >
          {/* El icono también acompaña: los vecinos _SM llevan size-3.5. */}
          <MoreHorizontal className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
        </button>
      )}
    >
      {(cerrar) => (
        <>
          {candidate.cvPath && (
            <button type="button" role="menuitem" className={ITEM_MENU} onClick={() => void descargarCv(cerrar)}>
              <Download className="size-4 text-slate-500" aria-hidden /> Descargar {cvName ? 'CV' : 'CV'}
            </button>
          )}
          <button type="button" role="menuitem" className={ITEM_MENU} onClick={() => void copiarContacto(cerrar)}>
            <Copy className="size-4 text-slate-500" aria-hidden /> Copiar datos de contacto
          </button>
          {/* DESCARTAR NO VA EN ROJO NI SE LLAMA "RECHAZAR": es rutina, es
              reversible y el glosario está congelado. Va con los otros verbos y
              no abajo con Eliminar, que es de lo que no se deshace. */}
          {descartar && descartar.status !== 'descartado' && (
            <button
              type="button"
              role="menuitem"
              className={ITEM_MENU}
              onClick={() => {
                cerrar()
                descartar.onEstado('descartado')
              }}
            >
              <CircleSlash className="size-4 text-slate-500" aria-hidden /> Descartar
            </button>
          )}
          <div className="my-1 h-px bg-slate-100" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              cerrar()
              onEliminar()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="size-4" aria-hidden /> Eliminar candidato
          </button>
        </>
      )}
    </MenuFlotante>
  )
}

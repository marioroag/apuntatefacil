import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Phone,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { Tabs, TabPanel, type TabItem } from '../components/ui/Tabs'
import {
  ChatComposer, ChatEmpty, ChatNuevos, ChatSkeleton, ChatThread, useSeguirAlFondo,
  type ChatMessage,
} from '../components/ui/Chat'
import { useChatThread } from '../lib/useChatThread'
import { StatusSelect } from '../components/ui/StatusPill'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import type { Campaign, Candidate, CandidateEvent } from '../lib/types'
import { SOURCE_META, STATUS_META } from '../lib/types'
import { answerText, candidateName, formatPhone, fullDateTime, fullDateTimeInZone, personLabel, relativeDate } from '../lib/format'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { BTN_PRIMARY, BTN_PRIMARY_SM, BTN_SECONDARY, BTN_SECONDARY_SM } from '../lib/buttons'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { MaskedPhone } from '../components/MaskedPhone'
import { TagSection } from '../components/Tags'
import { TAGS_ENABLED, planHas } from '../lib/pricing'
import { InterestSignal } from '../components/InterestSignal'
import { AgendarManualDialog, InterviewHeaderButton } from '../components/InterviewAction'
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
 * Reparto: a la izquierda lo que dice el candidato (Resumen, Respuestas, CV); a
 * la derecha el seguimiento (Equipo, Conversación, Historial). Por debajo de
 * 1024px no hay sitio para la columna y las tres se agrupan bajo una sola
 * pestaña, Seguimiento, con sus tres dentro.
 *
 * Conversación es la superficie principal de la entrevista: se invita desde
 * ahí, se ve lo hablado y se toma el control. No hay bandeja global de
 * WhatsApp a propósito: obligaría a saltar entre dos sitios para entender a
 * una sola persona.
 */

type Izquierda = 'resumen' | 'respuestas' | 'cv' | 'seguimiento'
type Seguimiento = 'equipo' | 'conversacion' | 'historial'

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
}) {
  const { setFavorito, setStatus, deleteCandidate, loadCandidateComments, addCandidateComment, loadCandidateEvents, members, chatVersion, commentCounts } =
    useStore()
  const { role, company, user } = useAuth()
  const base = useAppBase()
  const toast = useToast()
  const [izq, setIzq] = useState<Izquierda>('resumen')
  // UNA sola pieza de estado para cuál de las tres se ve, la use el panel
  // derecho (escritorio) o las sub-pestañas de Seguimiento (móvil). Con dos
  // estados separados, abrir la conversación desde la cabecera acertaba en un
  // tamaño y fallaba en el otro.
  const [seg, setSeg] = useState<Seguimiento>('equipo')
  const [agendarManual, setAgendarManual] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const dosColumnas = useDosColumnas()

  const canManageTags = role !== 'encargado'
  const chatEnabled = planHas(company?.plan, 'teamBoard') || company?.id === 'demo'
  // La demo va en Multi, así que ve la pestaña como cualquier cliente de pago:
  // esconderla ahí sería enseñar un bloqueo de plan a quien no lo tiene. Lo que
  // cambia en demo es que la invitación no sale (avisa y no escribe a nadie),
  // igual que llamar o escribir por WhatsApp.
  const puedeEntrevistar = planHas(company?.plan, 'entrevistas')

  // Al cambiar de candidato se vuelve a Resumen: la pestaña de CV puede no
  // existir en el siguiente. Se ajusta DURANTE el render (patrón de React para
  // "estado derivado de una prop que cambia"), no en un efecto: un efecto
  // pintaría antes el candidato nuevo con la pestaña del viejo.
  const [visto, setVisto] = useState(candidate?.id ?? null)
  if (candidate && visto !== candidate.id) {
    setVisto(candidate.id)
    setIzq('resumen')
    setSeg('equipo')
  }

  // Al ensanchar a dos columnas la conversación se va a la derecha y la pestaña
  // de Equipo deja de existir: se deriva, no se corrige después (una pestaña
  // oculta por CSS seguía siendo alcanzable con las flechas del teclado).
  const izqVisible: Izquierda = dosColumnas && izq === 'seguimiento' ? 'resumen' : izq

  // El botón de la cabecera lleva DIRECTO a la conversación, sin obligar a
  // navegar los dos niveles a mano en móvil.
  const abrirConversacion = () => {
    setSeg('conversacion')
    if (!dosColumnas) setIzq('seguimiento')
  }

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

  // El recuento en la pestaña dice si hay algo que leer sin tener que entrar.
  const nMensajes = chatEnabled ? commentCounts[candidate.id] ?? 0 : 0

  const tabsIzq: TabItem<Izquierda>[] = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'respuestas', label: 'Respuestas' },
    ...(candidate.cvPath ? [{ value: 'cv' as const, label: 'CV' }] : []),
    // En móvil las tres de la derecha se agrupan bajo una sola pestaña: seis
    // destinos en una barra que se arrastra es donde la gente deja de
    // encontrar las cosas.
    ...(dosColumnas ? [] : [{ value: 'seguimiento' as const, label: 'Seguimiento', count: nMensajes || undefined }]),
  ]

  const panelEquipo = chatEnabled ? (
    <Equipo
      key={candidate.id}
      candidateId={candidate.id}
      chatVersion={chatVersion}
      currentUserId={user?.id ?? null}
      members={members}
      load={loadCandidateComments}
      onSend={addCandidateComment}
    />
  ) : (
    <EquipoBloqueado base={base} />
  )

  const panelConversacion = puedeEntrevistar ? (
    <InterviewConversation
      key={candidate.id}
      candidate={candidate}
      campaign={campaign}
      onScheduleManually={() => setAgendarManual(true)}
    />
  ) : (
    <ConversacionBloqueada base={base} />
  )

  const tabsSeguimiento: TabItem<Seguimiento>[] = [
    { value: 'equipo', label: 'Equipo', count: nMensajes || undefined },
    { value: 'conversacion', label: 'Conversación' },
    { value: 'historial', label: 'Historial' },
  ]

  const panelSeguimiento =
    seg === 'equipo' ? panelEquipo
      : seg === 'conversacion' ? panelConversacion
      : <Historial key={candidate.id} candidateId={candidate.id} load={loadCandidateEvents} yoEmail={user?.email} />

  return (
    <>
      <Modal open={open} onClose={onClose} labelledBy="candidato-nombre" inert={confirmarBorrado}>
        <header className="border-b border-slate-200 px-4 pb-2.5 pt-3.5 sm:px-5">
          <div className="flex items-start gap-3">
            <MeridianAvatar name={name} fit={fit ?? undefined} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h2 id="candidato-nombre" title={name} className="truncate text-xl font-semibold leading-tight text-slate-900">
                  {name}
                </h2>
                <Favorito value={candidate.favorito} onChange={(v) => void setFavorito(candidate.id, v)} />
              </div>
              {/* Sin etiqueta de ajuste: el anillo del avatar YA dice el encaje
                  (por longitud de arco) y repetirlo en palabras solo restaba
                  sitio al puesto. */}
              <p className="truncate text-[13px] text-slate-500">{campaign.title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {puedeNavegar && (
                <div className="mr-1 hidden items-center gap-0.5 sm:flex">
                  <button
                    type="button"
                    aria-label="Candidato anterior"
                    disabled={i === 0}
                    onClick={() => irA(i - 1)}
                    className="grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:text-slate-300"
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
                    className="grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:text-slate-300"
                  >
                    <ArrowRight className="size-[18px]" aria-hidden />
                  </button>
                </div>
              )}
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="grid size-9 pointer-coarse:size-11 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Barra de decisión: lo que el empresario cambia sin pensar. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusSelect status={candidate.status} onChange={(s) => void setStatus(candidate.id, s)} />
            {/* Las etiquetas NO van aquí a ningún ancho: viven en Resumen, como
                ya hacían en móvil. En la cabecera crecían sin techo y empujaban
                las acciones de contacto a una segunda línea, con lo que la
                identidad de la persona quedaba enterrada bajo su clasificación. */}
            {/* La fila de acciones SÍ se ve en móvil, pero solo con la entrevista
                dentro: llamar y escribir ya están en la barra de abajo, al
                alcance del pulgar, y repetirlos aquí sería ruido. La entrevista
                no está en ningún otro sitio, así que vive aquí a todos los
                tamaños. */}
            <div className="ml-auto flex items-center gap-2">
              {/* Va antes que llamar o escribir: es LA acción que hace avanzar
                  el proceso, no un atajo de contacto. */}
              {puedeEntrevistar && (
                <InterviewHeaderButton candidate={candidate} onOpen={abrirConversacion} />
              )}
              <span className="hidden items-center gap-2 sm:flex">
              {phone && !maskPhone && (
                <>
                  <a href={`tel:${phone.replace(/\s/g, '')}`} className={BTN_PRIMARY_SM}>
                    <Phone className="size-3.5 text-indigo-200" aria-hidden /> Llamar
                  </a>
                  {waPhone && (
                    <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY_SM}>
                      <MessageCircle className="size-3.5 text-slate-400" aria-hidden /> WhatsApp
                    </a>
                  )}
                </>
              )}
              {phone && maskPhone && (
                <>
                  <button type="button" onClick={avisoDemo} className={BTN_PRIMARY_SM}>
                    <Phone className="size-3.5 text-indigo-200" aria-hidden /> Llamar
                  </button>
                  <button type="button" onClick={avisoDemo} className={BTN_SECONDARY_SM}>
                    <MessageCircle className="size-3.5 text-slate-400" aria-hidden /> WhatsApp
                  </button>
                </>
              )}
              <MenuAcciones candidate={candidate} cvName={cvName} onEliminar={() => setConfirmarBorrado(true)} size="sm" />
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <Tabs
              items={tabsIzq}
              value={izqVisible}
              onChange={setIzq}
              idPrefix="cand"
              label="Secciones del candidato"
              className="shrink-0 overflow-x-auto px-4 sm:px-5"
            />
            <TabPanel
              idPrefix="cand"
              value={izqVisible}
              className={`min-h-0 flex-1 ${
                izqVisible === 'seguimiento'
                  ? 'flex flex-col overflow-hidden bg-slate-50/60'
                  : 'overflow-y-auto overscroll-contain px-4 py-5 sm:px-5'
              }`}
            >
              {izqVisible === 'resumen' && (
                <Resumen campaign={campaign} candidate={candidate} maskPhone={maskPhone} canManageTags={canManageTags} onOpenManageTags={onOpenManageTags} />
              )}
              {izqVisible === 'respuestas' && <Respuestas campaign={campaign} candidate={candidate} maskPhone={maskPhone} />}
              {izqVisible === 'cv' && <Cv key={candidate.id} candidate={candidate} cvName={cvName} />}
              {izqVisible === 'seguimiento' && (
                <>
                  <Tabs
                    items={tabsSeguimiento}
                    value={seg}
                    onChange={setSeg}
                    idPrefix="seg"
                    label="Seguimiento del candidato"
                    className="shrink-0 bg-white px-4"
                  />
                  <TabPanel idPrefix="seg" value={seg} className="flex min-h-0 flex-1 flex-col">
                    {panelSeguimiento}
                  </TabPanel>
                </>
              )}
            </TabPanel>
          </section>

          <aside className="hidden w-[368px] shrink-0 flex-col border-l border-slate-200 bg-slate-50/60 lg:flex">
            <Tabs
              items={tabsSeguimiento}
              value={seg}
              onChange={setSeg}
              idPrefix="lado"
              label="Seguimiento del candidato"
              className="shrink-0 bg-white px-4"
            />
            <TabPanel idPrefix="lado" value={seg} className="flex min-h-0 flex-1 flex-col">
              {panelSeguimiento}
            </TabPanel>
          </aside>
        </div>

        {/* Barra de acción de móvil: el pulgar llega y no roba sitio arriba. En
            Equipo manda el campo de escribir. */}
        {izqVisible !== 'seguimiento' && (
          <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2.5 sm:hidden">
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
            <MenuAcciones candidate={candidate} cvName={cvName} onEliminar={() => setConfirmarBorrado(true)} />
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
 * NO es dorada a propósito: el ámbar ya significa "entrevista" y en esta misma
 * cabecera puede haber una pastilla ámbar al lado. Guardar en favoritos es
 * SELECCIÓN, que es uno de los cuatro usos legítimos del acento.
 */
function Favorito({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      aria-label={value ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      onClick={() => onChange(!value)}
      className={`group grid size-8 pointer-coarse:size-11 shrink-0 place-items-center rounded-lg transition-[color,background-color,transform] duration-[var(--duration-control)] ease-[var(--ease-out)] hover:bg-slate-100 active:translate-y-px ${
        value ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-indigo-600'
      }`}
    >
      {/* El press es `translate-y-px` en el botón, nunca `scale` en el icono: un
          control se hunde, no se encoge. El `scale` es lenguaje de dibujo animado
          y aquí desentonaba contra los 16 botones del sistema. */}
      <Star className={`size-[18px] [stroke-width:1.75] ${value ? 'fill-current' : ''}`} aria-hidden />
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

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  )
}

function Resumen({
  campaign,
  candidate,
  maskPhone,
  canManageTags,
  onOpenManageTags,
}: {
  campaign: Campaign
  candidate: Candidate
  maskPhone: boolean
  canManageTags: boolean
  onOpenManageTags?: () => void
}) {
  const phone = String(candidate.answers['telefono'] ?? '')
  const emailField = campaign.fields.find((f) => f.type === 'email')
  const correo = emailField ? String(candidate.answers[emailField.id] ?? '') : ''

  return (
    <div className="space-y-6">
      <MeridianPanelBlock candidate={candidate} />

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contacto</h3>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Dato label="Teléfono">
            {!phone ? (
              <span className="font-normal text-slate-500">No disponible</span>
            ) : maskPhone ? (
              <MaskedPhone value={formatPhone(phone)} />
            ) : (
              <ValorCopiable valor={formatPhone(phone)} etiqueta="Teléfono" num truncar />
            )}
          </Dato>
          <Dato label="Correo">
            {correo ? <ValorCopiable valor={correo} etiqueta="Correo" truncar /> : <span className="font-normal text-slate-500">No disponible</span>}
          </Dato>
          <Dato label="Recibida">
            <span className="num">{fullDateTime(candidate.submittedAt)}</span>
          </Dato>
          <Dato label="Origen">{SOURCE_META[candidate.source].label}</Dato>
        </dl>
      </section>

      {/* Etiquetas: aquí a todos los anchos. Es lo que tu equipo dice de esta
          persona, así que va con lo demás que se lee de ella, no en la cabecera
          entre el estado y las acciones. */}
      {TAGS_ENABLED && (
        <section>
          <TagSection candidateId={candidate.id} tagIds={candidate.tagIds} canManage={canManageTags} onOpenManage={() => onOpenManageTags?.()} />
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Interés actual</h3>
        <InterestSignal campaign={campaign} candidate={candidate} />
        <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Esta señal es informativa y no cambia el estado de la candidatura.</p>
      </section>
    </div>
  )
}

function Respuestas({ campaign, candidate, maskPhone }: { campaign: Campaign; candidate: Candidate; maskPhone: boolean }) {
  return (
    <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
      {campaign.fields.map((f) => {
        const raw = candidate.answers[f.id]
        const texto = answerText(raw)
        const esNumerico = ['phone', 'number', 'date'].includes(f.type)
        return (
          <div key={f.id} className="grid grid-cols-[38%_62%] gap-3 px-3.5 py-2.5">
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

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
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
        <div className="grid min-h-[240px] flex-1 place-items-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
          <p className="max-w-[42ch] text-sm leading-6 text-slate-500">
            Este CV está en Word y no se puede ver aquí dentro. Descárgalo para abrirlo.
          </p>
        </div>
      ) : error ? (
        <div className="grid min-h-[240px] flex-1 place-items-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-center">
          <p className="max-w-[42ch] text-sm leading-6 text-slate-500">No se pudo abrir el CV. Prueba a descargarlo.</p>
        </div>
      ) : url ? (
        <iframe src={url} title={`CV de ${candidateName(candidate) || 'el candidato'}`} className="min-h-[360px] flex-1 rounded-xl border border-slate-200 bg-slate-50" />
      ) : (
        <div className="grid min-h-[360px] flex-1 place-items-center rounded-xl border border-slate-200 bg-slate-50">
          <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden /> Abriendo el CV…
          </p>
        </div>
      )}
    </div>
  )
}

function Equipo({
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
  const { contenedor, nuevos, irAlFondo } = useSeguirAlFondo(items.length)

  const mensajes: ChatMessage[] = items.map((c) => ({
    id: c.id,
    authorUserId: c.authorUserId,
    authorEmail: c.authorEmail,
    body: c.body,
    createdAt: c.createdAt,
    isNote: c.isNote,
  }))

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={contenedor}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4"
        >
          {loading ? (
            <ChatSkeleton />
          ) : mensajes.length === 0 ? (
            <ChatEmpty icon={<MessagesSquare className="size-6" />} title="Nadie ha comentado todavía">
              Apunta aquí lo que hables por teléfono: si le encaja el turno, cuándo puede empezar, lo que sea. Queda con tu nombre y lo ve tu equipo.
            </ChatEmpty>
          ) : (
            <ChatThread messages={mensajes} currentUserId={currentUserId} />
          )}
        </div>
        <ChatNuevos nuevos={nuevos} onClick={() => irAlFondo(true)} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3">
        <ChatComposer
          id={`chat-${candidateId}`}
          members={members}
          onSend={async (body, mentions) => {
            const nuevo = await onSend(candidateId, body, mentions)
            if (nuevo) setItems((cs) => (cs.some((c) => c.id === nuevo.id) ? cs : [...cs, nuevo]))
            // Lo tuyo se va a ver siempre, estuvieras donde estuvieras leyendo:
            // acabas de escribirlo, así que quieres verlo salir.
            irAlFondo(true)
          }}
        />
      </div>
    </>
  )
}

/** Chat sin plan: mismo patrón de upsell que el bloque de Meridian. */
function EquipoBloqueado({ base }: { base: string }) {
  return (
    <div className="m-auto max-w-[40ch] px-6 py-8 text-center">
      <MessagesSquare className="mx-auto size-6 text-slate-400" aria-hidden />
      <p className="mt-2 text-sm font-medium text-slate-800">Comenta con tu equipo</p>
      <p className="mt-1 text-[13px] leading-5 text-slate-500">
        Lo que hablas de cada candidato, en su ficha y con el nombre de quien lo dijo. Con @ avisas a un compañero.
      </p>
      <Link to={`${base}/plan`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700">
        <Lock className="size-3.5" aria-hidden /> Disponible con Pro
      </Link>
    </div>
  )
}

function ConversacionBloqueada({ base }: { base: string }) {
  return (
    <div className="m-auto max-w-[40ch] px-6 py-8 text-center">
      <MessageCircle className="mx-auto size-6 text-slate-400" aria-hidden />
      <p className="mt-2 text-sm font-medium text-slate-800">Deja que cuadremos la cita</p>
      <p className="mt-1 text-[13px] leading-5 text-slate-500">
        Apúntate Fácil escribe al candidato por WhatsApp, comprueba su disponibilidad y cierra un
        horario compatible con tu agenda.
      </p>
      <Link to={`${base}/plan`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700">
        <Lock className="size-3.5" aria-hidden /> Disponible con Pro
      </Link>
    </div>
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
function MenuAcciones({ candidate, cvName, onEliminar, size = 'md' }: { candidate: Candidate; cvName: string; onEliminar: () => void; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const toast = useToast()
  const W = 232

  useEffect(() => {
    if (!open) return
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)) })
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
      <button
        ref={btnRef}
        type="button"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid ${size === 'sm' ? 'size-8' : 'size-9'} pointer-coarse:size-11 shrink-0 place-items-center rounded-lg text-slate-500 ring-1 ring-inset ring-slate-300/80 transition-colors hover:bg-slate-50 hover:text-slate-700`}
      >
        {/* El icono también acompaña: los vecinos _SM llevan size-3.5. */}
        <MoreHorizontal className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Acciones del candidato"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: W }}
            className="z-[70] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop"
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

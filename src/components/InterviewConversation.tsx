import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CalendarPlus, Check, CheckCheck, ChevronDown, Clock,
  Loader2, MessageCircle,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useToast } from './ui/Toast'
import { useChatThread } from '../lib/useChatThread'
import { ChatComposer, ChatNuevos, ChatSkeleton, useSeguirAlFondo } from './ui/Chat'
import { BTN_PRIMARY, BTN_SECONDARY_SM } from '../lib/buttons'
import { clockTime, formatPhone, fullDateTimeInZone } from '../lib/format'
import { currentInterview, isLive } from '../lib/interviews'
import { useAnfitrion } from '../lib/anfitrion'
import { ModoEntrevista } from './ModoEntrevista'
import {
  CONVERSATION_STATE_META, INTERVIEW_MODE_META,
  type Campaign, type Candidate, type ConversationMessage, type Interview, type InterviewMode,
} from '../lib/types'

/**
 * La conversación de la entrevista, dentro de la ficha del candidato.
 *
 * Es la superficie PRINCIPAL de la funcionalidad: desde aquí se invita, se ve
 * lo que se ha dicho, se sabe si hace falta entrar y se toma el control. No
 * hay bandeja global de WhatsApp a propósito: obligaría a saltar entre dos
 * sitios para entender a una sola persona.
 *
 * El hilo NO usa ChatThread. Esa primitiva es para conversaciones internas del
 * equipo (todos alineados a la izquierda, con avatar y menciones). Esto es una
 * conversación de dos bandas con alguien de fuera, y la alineación es la que
 * dice de un vistazo quién habló. Comparte escala tipográfica, colores y
 * esqueleto de carga; lo que cambia es lo que significa.
 */
export function InterviewConversation({
  candidate,
  campaign,
  onScheduleManually,
}: {
  candidate: Candidate
  campaign: Campaign
  onScheduleManually: () => void
}) {
  const { conversationFor, interviewsFor } = useStore()
  const conversacion = conversationFor(candidate.id)
  const entrevista = currentInterview(interviewsFor(candidate.id), candidate.id)

  if (!conversacion) {
    // Cita cuadrada a mano: hay entrevista viva pero nadie ha escrito a nadie.
    // Ofrecer aquí "invita a este candidato" sería contradecir a la cabecera de
    // la ficha, que en la misma pantalla dice "Ver entrevista, lun 3, 09:30".
    // Solo las de origen manual: el texto dice "la pusiste tú" y tiene que ser
    // verdad. Una de WhatsApp siempre trae su conversación.
    if (entrevista && entrevista.origin === 'manual' && isLive(entrevista.status) && entrevista.startsAt) {
      return <CitaAMano entrevista={entrevista} campaign={campaign} telefono={telefonoDe(candidate)} />
    }
    return (
      <Inicio
        candidate={candidate}
        campaign={campaign}
        onScheduleManually={onScheduleManually}
      />
    )
  }

  return (
    <Activa
      conversacion={conversacion}
      telefono={typeof candidate.answers['telefono'] === 'string' ? candidate.answers['telefono'] : ''}
      entrevistaFecha={entrevista?.startsAt ?? null}
      entrevistaZona={entrevista?.timezone ?? 'Europe/Madrid'}
    />
  )
}

const telefonoDe = (c: Candidate) =>
  typeof c.answers['telefono'] === 'string' ? c.answers['telefono'] : ''

/**
 * La cita que pusiste tú. No hay conversación que enseñar y tampoco hay nada
 * que invitar: lo único que falta por saber es qué se le ha dicho al candidato,
 * y la respuesta es "nada". Se dice, en vez de dejar la pantalla de invitar,
 * que haría dudar de si la cita existe.
 */
function CitaAMano({
  entrevista,
  campaign,
  telefono,
}: {
  entrevista: Interview
  campaign: Campaign
  telefono: string
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto max-w-[36ch]">
        <div className="grid size-10 place-items-center rounded-xl bg-slate-100">
          <CalendarDays className="size-5 text-slate-500" aria-hidden />
        </div>
        <h3 className="mt-3 text-[15px] font-semibold text-slate-900">La cita la pusiste tú</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
          No se le ha escrito nada por WhatsApp: al agendar a mano, avisar al candidato es cosa
          tuya. Puedes cambiarla o cancelarla desde el botón de la entrevista, arriba.
        </p>
      </div>

      <dl className="mx-auto mt-5 max-w-[36ch] divide-y divide-slate-200 rounded-xl bg-slate-50 px-3 text-[13px] ring-1 ring-inset ring-slate-200">
        <Linea etiqueta="Puesto" valor={campaign.title} />
        <Linea
          etiqueta="Cuándo"
          valor={fullDateTimeInZone(entrevista.startsAt!, entrevista.timezone)}
          num
        />
        <Linea etiqueta="Modalidad" valor={INTERVIEW_MODE_META[entrevista.mode].label} />
        {entrevista.mode === 'presencial' && (
          <Linea etiqueta="Lugar" valor={entrevista.locationText || 'Sin dirección'} apagado={!entrevista.locationText} />
        )}
        {entrevista.mode === 'telefonica' && (
          <Linea
            etiqueta="Le llamas al"
            valor={formatPhone(telefono) || 'No dejó teléfono'}
            apagado={!telefono}
            num={!!telefono}
          />
        )}
        {entrevista.mode === 'videollamada' && (
          <Linea etiqueta="Enlace" valor={entrevista.meetingUrl || 'Falta el enlace'} apagado={!entrevista.meetingUrl} />
        )}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estado inicial: todavía no se ha contactado
// ---------------------------------------------------------------------------

const DURACIONES = [15, 30, 45, 60]

function Inicio({
  candidate,
  campaign,
  onScheduleManually,
}: {
  candidate: Candidate
  campaign: Campaign
  onScheduleManually: () => void
}) {
  const { startInvitation } = useStore()
  const toast = useToast()
  const [ajustando, setAjustando] = useState(false)
  const [modo, setModo] = useState<InterviewMode>('presencial')
  const [duracion, setDuracion] = useState(30)
  const modoTocado = useRef(false)
  // Arranca vacío y lo rellena su configuración cuando llega. NO se usa
  // `campaign.location`: eso es la zona del anuncio, no una dirección, y
  // mandarla como sitio de la cita es citar a alguien en una ciudad entera.
  const [sitio, setSitio] = useState('')
  const [enlace, setEnlace] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const campoSitio = useRef<HTMLInputElement>(null)

  const { modo: modoPorDefecto, sitio: sitioPorDefecto, cargando: cargandoSitio } = useAnfitrion()
  // Solo mientras no lo haya tocado: si ya está escribiendo, su texto manda.
  const tocado = useRef(false)
  useEffect(() => {
    if (!tocado.current && sitioPorDefecto) setSitio(sitioPorDefecto)
  }, [sitioPorDefecto])
  useEffect(() => {
    if (!modoTocado.current) setModo(modoPorDefecto)
  }, [modoPorDefecto])

  const telefono = typeof candidate.answers['telefono'] === 'string' ? candidate.answers['telefono'] : ''

  const invitar = async () => {
    setError(null)
    if (modo === 'videollamada' && enlace && !enlace.startsWith('https://')) {
      setError('El enlace tiene que empezar por https://')
      return
    }
    // Una entrevista presencial sin dirección no es una cita: es una hora. El
    // candidato acabaría con un "Hecho, queda el martes a las 10:00" y ningún
    // sitio al que ir, que es exactamente lo que pasaba. Se para aquí y se abre
    // el campo, en vez de dejarlo salir y que lo descubra él por WhatsApp.
    if (modo === 'presencial' && !sitio.trim()) {
      setError('Dinos dónde tiene que presentarse. Es lo que le mandamos al cerrar la cita.')
      setAjustando(true)
      setTimeout(() => campoSitio.current?.focus(), 0)
      return
    }
    setEnviando(true)
    const res = await startInvitation({
      candidateId: candidate.id,
      durationMinutes: duracion,
      mode: modo,
      locationText: modo === 'presencial' ? sitio : '',
      meetingUrl: modo === 'videollamada' && enlace ? enlace : null,
    })
    setEnviando(false)

    if (res.status === 'ok' || res.status === 'ya_existe') return // la pestaña se repinta sola
    // En la demo no se escribe a nadie. Se dice, en vez de dejar un botón que
    // no hace nada: el silencio se lee como que la app está rota.
    if (res.status === 'demo') {
      toast.show('En la demo solo puedes mirar. Crea tu cuenta para invitar a tus candidatos a una entrevista.')
      return
    }
    if (res.status === 'sin_telefono') {
      setError('Este candidato no dejó teléfono, así que no podemos escribirle por WhatsApp.')
      return
    }
    // Se apuntó antes de que el formulario avisara de WhatsApp. Se dice qué pasó
    // y qué se puede hacer: el empresario no ha hecho nada mal y tiene salida.
    if (res.status === 'sin_consentimiento') {
      setError(
        'Se apuntó antes de que el formulario avisara de que podemos escribir por WhatsApp, ' +
        'así que no le hemos pedido permiso. Llámale o escríbele tú, o pídele que vuelva a ' +
        'apuntarse con el enlace.',
      )
      return
    }
    if (res.status === 'baja') {
      setError('Este candidato pidió no recibir más mensajes por WhatsApp.')
      return
    }
    if (res.status === 'puesto_inactivo') {
      setError('El puesto no está activo. Reactívalo para invitar a entrevistas.')
      return
    }
    if (res.status === 'plan') {
      setError('Las entrevistas son del plan Pro.')
      return
    }
    toast.error('No se pudo iniciar la invitación.')
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto max-w-[36ch]">
        <div className="grid size-10 place-items-center rounded-xl bg-slate-100">
          <MessageCircle className="size-5 text-slate-500" aria-hidden />
        </div>
        <h3 className="mt-3 text-[15px] font-semibold text-slate-900">
          Invita a este candidato a una entrevista
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
          Apúntate Fácil escribirá al candidato por WhatsApp, comprobará su disponibilidad y tratará
          de cerrar un horario compatible.
        </p>
      </div>

      {/* Revisión antes de enviar. Cinco líneas, no un formulario: lo normal es
          confirmar de un vistazo, así que los controles se piden aparte. */}
      <dl className="mx-auto mt-5 max-w-[36ch] divide-y divide-slate-200 rounded-xl bg-slate-50 px-3 text-[13px] ring-1 ring-inset ring-slate-200">
        <Linea etiqueta="Puesto" valor={campaign.title} />
        <Linea etiqueta="Modalidad" valor={INTERVIEW_MODE_META[modo].label} />
        <Linea etiqueta="Duración" valor={`${duracion} min`} />
        {/* Cada modalidad tiene su dato imprescindible, y cuando falta lo dice.
            "Sin concretar" se leía como un estado aceptable y no lo es: sin
            dirección el candidato recibe una hora y ningún sitio. */}
        {modo === 'presencial' && (
          <Linea
            etiqueta="Lugar"
            valor={sitio || (cargandoSitio ? 'Cargando...' : 'Falta la dirección')}
            apagado={!sitio}
          />
        )}
        {modo === 'telefonica' && (
          <Linea
            etiqueta="Le llamas al"
            valor={formatPhone(telefono) || 'No dejó teléfono'}
            apagado={!telefono}
            num={!!telefono}
          />
        )}
        {modo === 'videollamada' && (
          <Linea etiqueta="Enlace" valor={enlace || 'Falta el enlace'} apagado={!enlace} />
        )}
        {/* Antes decía "Días laborables, 9:00 a 18:00" con esas horas escritas a
            mano, así que mentía en cuanto alguien cambiaba su horario. */}
        <Linea etiqueta="Disponibilidad" valor="La de Ajustes > Calendario" />
      </dl>

      <div className="mx-auto mt-2 max-w-[36ch]">
        <button
          type="button"
          onClick={() => setAjustando((v) => !v)}
          aria-expanded={ajustando}
          className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[13px] font-semibold text-indigo-700 hover:underline"
        >
          <ChevronDown
            className={`size-3.5 transition-transform duration-[var(--duration-control)] ${ajustando ? 'rotate-180' : ''}`}
            aria-hidden
          />
          {ajustando ? 'Listo' : 'Ajustar'}
        </button>
      </div>

      {ajustando && (
        <div className="mx-auto mt-3 max-w-[36ch] space-y-3">
          <fieldset>
            <legend className="mb-1 text-[13px] font-semibold text-slate-700">Modalidad</legend>
            <ModoEntrevista
              value={modo}
              onChange={(m) => { modoTocado.current = true; setModo(m) }}
              name="modo-invitacion"
              compacto
            />
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-[13px] font-semibold text-slate-700">Duración</legend>
            <div className="flex gap-2">
              {DURACIONES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={duracion === m}
                  onClick={() => setDuracion(m)}
                  className={`num h-9 flex-1 rounded-lg text-[13px] font-semibold ring-1 ring-inset transition-colors ${
                    duracion === m
                      ? 'bg-indigo-50 text-indigo-700 ring-indigo-300'
                      : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </fieldset>

          {modo === 'presencial' && (
            <div>
              <label htmlFor="conv-sitio" className="mb-1 block text-[13px] font-semibold text-slate-700">
                Dónde
              </label>
              <input
                id="conv-sitio"
                ref={campoSitio}
                value={sitio}
                onChange={(e) => { tocado.current = true; setSitio(e.target.value) }}
                placeholder="Calle, nave, oficina..."
                maxLength={300}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[14px] text-slate-900"
              />
              <p className="mt-1 text-[12px] text-slate-500">
                Sale de Ajustes &gt; Calendario. Ahí lo cambias para siempre y añades la ubicación del mapa.
              </p>
            </div>
          )}

          {modo === 'videollamada' && (
            <div>
              <label htmlFor="conv-enlace" className="mb-1 block text-[13px] font-semibold text-slate-700">
                Enlace de la videollamada
              </label>
              <input
                id="conv-enlace"
                type="url"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
                placeholder="https://..."
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[14px] text-slate-900"
              />
            </div>
          )}

          {/* La llamada no tiene nada que configurar: el número ya lo dejó él en
              el formulario, y es el mismo por el que le vamos a escribir. */}
          {modo === 'telefonica' && (
            <p className="text-[12px] text-slate-500">
              Le llamas tú al{' '}
              {telefono ? <span className="num">{formatPhone(telefono)}</span> : 'teléfono que dejó'}{' '}
              a la hora que quede.
            </p>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto mt-4 max-w-[36ch] rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 ring-1 ring-inset ring-red-200"
        >
          {error}
        </p>
      )}

      <div className="mx-auto mt-5 max-w-[36ch]">
        <button
          type="button"
          onClick={() => void invitar()}
          disabled={enviando || !telefono}
          className={`${BTN_PRIMARY} w-full justify-center`}
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {enviando ? 'Iniciando' : 'Invitar a entrevista'}
        </button>
        {!telefono && (
          <p className="mt-2 text-[13px] text-slate-500">
            Este candidato no dejó teléfono, así que no podemos escribirle por WhatsApp.
          </p>
        )}

        <button
          type="button"
          onClick={onScheduleManually}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-slate-600 hover:text-slate-900 hover:underline"
        >
          <CalendarPlus className="size-3.5 text-slate-400" aria-hidden />
          ¿Ya has quedado con él? Apúntalo a mano
        </button>
      </div>
    </div>
  )
}

function Linea({ etiqueta, valor, apagado = false, num = false }: {
  etiqueta: string; valor: string; apagado?: boolean; num?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-slate-500">{etiqueta}</dt>
      {/* Sin truncar: esto existe para REVISAR antes de enviar, así que un valor
          cortado con puntos suspensivos rompe justo lo que la pantalla hace.
          Si no cabe, salta de línea. */}
      <dd className={`min-w-0 text-right font-medium ${num ? 'num' : ''} ${apagado ? 'text-slate-400' : 'text-slate-800'}`}>
        {valor}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conversación en marcha
// ---------------------------------------------------------------------------

/**
 * WhatsApp solo deja mandar texto libre durante las 24 h siguientes al último
 * mensaje del candidato. Fuera de esa ventana lo único que entra es una
 * plantilla aprobada por Meta, así que la caja se apaga en vez de dejar escribir
 * algo que va a rebotar.
 */
function ventanaAbierta(expira: string | null): boolean {
  if (!expira) return false
  const t = Date.parse(expira)
  return Number.isFinite(t) && t > Date.now()
}

function Activa({
  conversacion,
  telefono,
  entrevistaFecha,
  entrevistaZona,
}: {
  conversacion: NonNullable<ReturnType<ReturnType<typeof useStore>['conversationFor']>>
  telefono: string
  entrevistaFecha: string | null
  entrevistaZona: string
}) {
  const {
    loadConversationMessages, conversationVersion, setConversationHandover, sendConversationMessage,
  } = useStore()
  const { items, loading } = useChatThread(
    () => loadConversationMessages(conversacion.id),
    [conversacion.id, conversationVersion],
  )
  const [cambiando, setCambiando] = useState(false)
  // El hilo llega en tiempo real, así que sin esto los mensajes nuevos salían
  // fuera de la pantalla y la conversación parecía parada.
  const { contenedor, nuevos, irAlFondo } = useSeguirAlFondo(items.length)

  const meta = CONVERSATION_STATE_META[conversacion.agentState]
  const enManos = conversacion.handover === 'persona'
  const puedeEscribir = ventanaAbierta(conversacion.windowExpiresAt) && !conversacion.optedOut

  const cambiarControl = async () => {
    setCambiando(true)
    await setConversationHandover(conversacion.id, enManos ? 'agente' : 'persona')
    setCambiando(false)
  }

  // Enviar es tomar el control: la función pasa el volante antes de mandar nada.
  // Pedir que pulses un botón para poder teclear es un paso de más justo en el
  // momento en que alguien está esperando una respuesta.
  const enviar = async (texto: string) => {
    const ok = await sendConversationMessage(conversacion.id, texto)
    // Lanzar es lo que le dice a la caja que NO borre lo escrito. El motivo del
    // fallo ya lo ha enseñado el store en un aviso.
    if (!ok) throw new Error('no enviado')
    irAlFondo(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Estado: lo primero que se lee. Dice si hay que hacer algo o no. */}
      <div
        className={`shrink-0 border-b px-4 py-3 ${
          conversacion.agentState === 'necesita_intervencion'
            ? 'border-amber-200 bg-amber-50'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
          <p className="text-[13px] font-semibold text-slate-900">{meta.label}</p>
          {enManos && (
            <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              La llevas tú
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-slate-600">
          {conversacion.attentionReason ?? meta.hint}
        </p>

        {entrevistaFecha && (
          <p className="num mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
            <Clock className="size-3.5 text-amber-500" aria-hidden />
            {fullDateTimeInZone(entrevistaFecha, entrevistaZona)}
          </p>
        )}
      </div>

      {/* Hilo. El envoltorio existe para la chapa de "mensajes nuevos": tiene que
          quedarse quieta sobre el hilo, y dentro del que scrollea se iría con él. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={contenedor} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
          {loading ? (
            <ChatSkeleton />
          ) : items.length === 0 ? (
            <p className="mt-6 text-center text-[13px] text-slate-500">
              Todavía no se ha enviado nada.
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((m) => (
                <Burbuja key={m.id} mensaje={m} />
              ))}
            </ol>
          )}
        </div>
        <ChatNuevos nuevos={nuevos} onClick={() => irAlFondo(true)} />
      </div>

      {/* Escribir a mano. Es lo primero del pie porque es lo que se viene a
          hacer: el botón de devolver el control se usa una vez, la caja todas. */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        {puedeEscribir ? (
          <ChatComposer
            id={`wa-${conversacion.id}`}
            onSend={enviar}
            placeholder="Escribe al candidato por WhatsApp"
            label="Escribe un mensaje de WhatsApp para el candidato"
          />
        ) : (
          <Cerrado conversacion={conversacion} telefono={telefono} />
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          {/* "Si escribes, el agente se aparta" solo se sostiene si se puede
              escribir: con la ventana cerrada sería otra promesa falsa. */}
          <p className="text-[12px] text-slate-500">
            {enManos
              ? 'La llevas tú. No escribiremos nada por nuestra cuenta.'
              : puedeEscribir
                ? 'Si escribes, el agente se aparta.'
                : ''}
          </p>
          <button
            type="button"
            onClick={() => void cambiarControl()}
            disabled={cambiando}
            className={`${BTN_SECONDARY_SM} shrink-0`}
          >
            {cambiando && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {enManos ? 'Devolver a Apúntate Fácil' : 'Tomar el control'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Lo que se enseña en el sitio de la caja de texto cuando no se puede escribir.
 * Dice el motivo y, sobre todo, qué se puede hacer en su lugar: un campo
 * apagado sin explicación deja al empresario mirando la pantalla.
 */
function Cerrado({
  conversacion,
  telefono,
}: {
  conversacion: NonNullable<ReturnType<ReturnType<typeof useStore>['conversationFor']>>
  telefono: string
}) {
  const baja = conversacion.optedOut

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[13px] font-medium text-slate-800">
        {baja ? 'Pidió no recibir más mensajes' : 'No puedes escribirle ahora mismo'}
      </p>
      <p className="mt-0.5 text-[13px] leading-5 text-slate-600">
        {baja
          ? 'Se dio de baja de esta conversación, así que no le vamos a escribir más.'
          : 'WhatsApp solo permite escribir durante las 24 horas siguientes al último mensaje del candidato. Se abrirá otra vez en cuanto él escriba.'}
      </p>
      {telefono && (
        <p className="mt-1.5 text-[13px] text-slate-600">
          {baja ? 'Si hace falta, llámale al ' : 'Mientras tanto puedes llamarle al '}
          <a href={`tel:${telefono}`} className="num font-medium text-indigo-600 hover:text-indigo-700">
            {formatPhone(telefono)}
          </a>
          .
        </p>
      )}
    </div>
  )
}

// Alineación: el candidato a la izquierda, nosotros a la derecha. Es lo que
// dice quién habló sin tener que leer una etiqueta.
function Burbuja({ mensaje }: { mensaje: ConversationMessage }) {
  if (mensaje.author === 'sistema') return <Sistema mensaje={mensaje} />

  const nuestro = mensaje.direction === 'saliente'
  const dePersona = mensaje.author === 'persona'

  return (
    <li className={`flex ${nuestro ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          // `whitespace-pre-line` respeta los saltos de línea: las plantillas
          // separan en párrafos y el que escribe a mano también, y sin esto el
          // hilo lo enseña todo seguido mientras al candidato le llega partido.
          className={`whitespace-pre-line rounded-xl px-3 py-2 text-[13px] leading-relaxed ring-1 ring-inset ${
            nuestro
              ? 'bg-white text-slate-800 ring-slate-200'
              : 'bg-slate-800 text-white ring-slate-800'
          }`}
        >
          {mensaje.body}
        </div>
        <p className={`mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 ${nuestro ? 'justify-end' : ''}`}>
          {nuestro && <span>{dePersona ? 'Tu equipo' : 'Apúntate Fácil'}</span>}
          <time dateTime={mensaje.createdAt} className="num">{clockTime(mensaje.createdAt)}</time>
          {nuestro && <Entrega estado={mensaje.deliveryStatus} error={mensaje.errorText} />}
        </p>
      </div>
    </li>
  )
}

/** Estado de entrega. Solo se pinta lo que informa: un fallo, o que llegó. */
function Entrega({
  estado,
  error,
}: {
  estado: ConversationMessage['deliveryStatus']
  error: string | null
}) {
  if (estado === 'fallido') {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-600" title={error ?? 'No se pudo entregar'}>
        <AlertTriangle className="size-3" aria-hidden />
        No llegó
      </span>
    )
  }
  if (estado === 'leido') return <CheckCheck className="size-3 text-indigo-600" aria-label="Leído" />
  if (estado === 'entregado') return <CheckCheck className="size-3 text-slate-400" aria-label="Entregado" />
  if (estado === 'enviado') return <Check className="size-3 text-slate-400" aria-label="Enviado" />
  return <Clock className="size-3 text-slate-300" aria-label="Pendiente" />
}

const SISTEMA_TEXTO: Record<string, string> = {
  handover_persona: 'Alguien de tu equipo tomó el control',
  handover_agente: 'La conversación vuelve a Apúntate Fácil',
}

function Sistema({ mensaje }: { mensaje: ConversationMessage }) {
  return (
    <li className="flex justify-center py-1">
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-600">
        {SISTEMA_TEXTO[mensaje.body] ?? mensaje.body}
      </span>
    </li>
  )
}

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Loader2, MessageCircle, X } from 'lucide-react'
import { Modal } from './ui/Modal'
import { useStore } from '../lib/store'
import { useToast } from './ui/Toast'
import { BTN_PRIMARY_SM, BTN_SECONDARY, BTN_SECONDARY_SM } from '../lib/buttons'
import { currentInterview } from '../lib/interviews'
import { useAnfitrion } from '../lib/anfitrion'
import { ModoEntrevista } from './ModoEntrevista'
import { formatPhone, shortWhenInZone } from '../lib/format'
import type { Candidate, InterviewMode } from '../lib/types'

/**
 * Botón de entrevista de la cabecera del candidato. Enseña la ACCIÓN o el
 * RESULTADO, nunca las dos cosas ni un estado intermedio inventado:
 *
 *   sin entrevista  ->  "Invitar a entrevista"   (acento: es LA acción)
 *   negociándose    ->  "Agendando..."
 *   confirmada      ->  "Ver entrevista · mar 12, 10:00"
 *
 * En los tres casos abre la pestaña Conversación. El botón no decide nada por
 * su cuenta: lleva al sitio donde se decide.
 */
export function InterviewHeaderButton({
  candidate,
  onOpen,
}: {
  candidate: Candidate
  /** Abre la pestaña Conversación. El botón NUNCA abre un modal: la
   *  conversación ES la superficie, y un modal encima la taparía. */
  onOpen: () => void
}) {
  const { interviewsFor } = useStore()
  const entrevista = currentInterview(interviewsFor(candidate.id), candidate.id)
  const negociando = entrevista?.status === 'invitada' || entrevista?.status === 'proponiendo'
  const confirmada =
    (entrevista?.status === 'confirmada' || entrevista?.status === 'reprogramando') && entrevista.startsAt

  if (confirmada) {
    return (
      <button type="button" onClick={onOpen} className={BTN_SECONDARY_SM}>
        <CalendarDays className="size-3.5 text-amber-500" aria-hidden />
        <span className="num">Ver entrevista · {shortWhenInZone(entrevista.startsAt!, entrevista.timezone)}</span>
      </button>
    )
  }
  if (negociando) {
    return (
      <button type="button" onClick={onOpen} className={BTN_SECONDARY_SM}>
        <Loader2 className="size-3.5 animate-spin text-slate-400" aria-hidden />
        Agendando...
      </button>
    )
  }
  return (
    <button type="button" onClick={onOpen} className={BTN_PRIMARY_SM}>
      <MessageCircle className="size-3.5 text-indigo-200" aria-hidden />
      Invitar a entrevista
    </button>
  )
}

// Redondea al siguiente cuarto de hora del día siguiente: agendar "para dentro
// de un rato" casi nunca es lo que se quiere, y proponer una hora en punto
// mañana ahorra tocar el selector.
function sugerencia(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function AgendarManualDialog({
  open,
  candidate,
  onClose,
}: {
  open: boolean
  candidate: Candidate
  onClose: () => void
}) {
  const { createInterview, members } = useStore()
  const toast = useToast()
  const [cuando, setCuando] = useState(sugerencia)
  const [duracion, setDuracion] = useState(30)
  const [buffer, setBuffer] = useState(15)
  const [modo, setModo] = useState<InterviewMode>('presencial')
  const [sitio, setSitio] = useState('')
  const [enlace, setEnlace] = useState('')
  const [anfitrion, setAnfitrion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prerrellenado con su modalidad y su sitio de siempre, igual que al invitar
  // por WhatsApp: las reglas de cada modalidad no pueden depender de por qué
  // puerta se entre.
  const { modo: modoPorDefecto, sitio: sitioPorDefecto } = useAnfitrion()
  const tocado = useRef(false)
  const modoTocado = useRef(false)
  useEffect(() => {
    if (!tocado.current && sitioPorDefecto) setSitio(sitioPorDefecto)
  }, [sitioPorDefecto])
  useEffect(() => {
    if (!modoTocado.current) setModo(modoPorDefecto)
  }, [modoPorDefecto])

  const telefono = typeof candidate.answers['telefono'] === 'string' ? candidate.answers['telefono'] : ''

  const guardar = async () => {
    setError(null)
    if (!cuando) {
      setError('Dinos qué día y a qué hora.')
      return
    }
    if (modo === 'videollamada' && enlace && !enlace.startsWith('https://')) {
      setError('El enlace tiene que empezar por https://')
      return
    }
    if (modo === 'presencial' && !sitio.trim()) {
      setError('Dinos dónde tiene que presentarse.')
      return
    }
    // Apuntar una llamada a alguien que no dejó teléfono es apuntar algo que no
    // vas a poder hacer. Aquí no hay WhatsApp que lo frene antes, como en la
    // invitación: esto se guarda directo.
    if (modo === 'telefonica' && !telefono) {
      setError('Este candidato no dejó teléfono, así que no vas a poder llamarle.')
      return
    }
    setGuardando(true)
    const res = await createInterview({
      candidateId: candidate.id,
      startsLocal: cuando,
      hostUserId: anfitrion || null,
      durationMinutes: duracion,
      bufferMinutes: buffer,
      mode: modo,
      locationText: modo === 'presencial' ? sitio : '',
      meetingUrl: modo === 'videollamada' && enlace ? enlace : null,
    })
    setGuardando(false)

    // Cada respuesta del servidor dice algo distinto y accionable. Un "no se
    // pudo" genérico dejaría al empresario sin saber qué cambiar.
    if (res.status === 'ok') {
      toast.success('Entrevista agendada.')
      onClose()
      return
    }
    // Mismo criterio que el resto de la demo: avisar, no quedarse mudo.
    if (res.status === 'demo') {
      toast.show('En la demo solo puedes mirar. Crea tu cuenta para agendar entrevistas de verdad.')
      onClose()
      return
    }
    if (res.status === 'ocupado') {
      setError('Ya tienes algo a esa hora. Prueba con otro hueco.')
      return
    }
    if (res.status === 'ya_existe') {
      setError('Esta persona ya tiene una entrevista en marcha.')
      return
    }
    if (res.status === 'puesto_inactivo') {
      setError('El puesto no está activo. Reactívalo para agendar entrevistas.')
      return
    }
    if (res.status === 'fecha_no_valida') {
      setError('Esa fecha no vale. Revísala.')
      return
    }
    if (res.status === 'plan') {
      setError('Las entrevistas son del plan Pro.')
      return
    }
    setError('No se pudo agendar. Inténtalo de nuevo.')
  }

  return (
    <Modal open={open} onClose={onClose} label="Agendar entrevista" maxWidthClass="sm:max-w-[460px]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Agendar entrevista</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">La hora es la del puesto.</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <label htmlFor="ent-cuando" className="mb-1 block text-[13px] font-semibold text-slate-700">
            Día y hora
          </label>
          <input
            id="ent-cuando"
            type="datetime-local"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            className="num h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] text-slate-900 focus-visible:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ent-dur" className="mb-1 block text-[13px] font-semibold text-slate-700">
              Duración
            </label>
            <select
              id="ent-dur"
              value={duracion}
              onChange={(e) => setDuracion(Number(e.target.value))}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] text-slate-900"
            >
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ent-buf" className="mb-1 block text-[13px] font-semibold text-slate-700">
              Descanso después
            </label>
            <select
              id="ent-buf"
              value={buffer}
              onChange={(e) => setBuffer(Number(e.target.value))}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] text-slate-900"
            >
              {[0, 10, 15, 30].map((m) => (
                <option key={m} value={m}>{m === 0 ? 'Sin descanso' : `${m} min`}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 block text-[13px] font-semibold text-slate-700">Cómo</legend>
          <ModoEntrevista
            value={modo}
            onChange={(m) => { modoTocado.current = true; setModo(m) }}
            name="modo-manual"
          />
        </fieldset>

        {modo === 'presencial' && (
          <div>
            <label htmlFor="ent-sitio" className="mb-1 block text-[13px] font-semibold text-slate-700">
              Dónde
            </label>
            <input
              id="ent-sitio"
              value={sitio}
              onChange={(e) => { tocado.current = true; setSitio(e.target.value) }}
              placeholder="Calle, nave, oficina..."
              maxLength={300}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] text-slate-900"
            />
          </div>
        )}

        {modo === 'videollamada' && (
          <div>
            <label htmlFor="ent-enlace" className="mb-1 block text-[13px] font-semibold text-slate-700">
              Enlace de la videollamada
            </label>
            <input
              id="ent-enlace"
              type="url"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://..."
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] text-slate-900"
            />
          </div>
        )}

        {modo === 'telefonica' && (
          <p className="text-[13px] text-slate-500">
            {telefono
              ? <>Le llamas tú al <span className="num">{formatPhone(telefono)}</span>.</>
              : 'Este candidato no dejó teléfono, así que no vas a poder llamarle.'}
          </p>
        )}

        {members.length > 1 && (
          <div>
            <label htmlFor="ent-host" className="mb-1 block text-[13px] font-semibold text-slate-700">
              Quién entrevista
            </label>
            <select
              id="ent-host"
              value={anfitrion}
              onChange={(e) => setAnfitrion(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[15px] text-slate-900"
            >
              <option value="">Tú</option>
              {members.filter((m) => !m.isSelf).map((m) => (
                <option key={m.userId} value={m.userId}>{m.email}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
        <button type="button" onClick={() => void guardar()} disabled={guardando} className={BTN_PRIMARY_SM.replace('h-8', 'h-9')}>
          {guardando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {guardando ? 'Agendando' : 'Agendar'}
        </button>
      </div>
    </Modal>
  )
}

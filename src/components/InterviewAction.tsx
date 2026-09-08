import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Info, Loader2, X } from 'lucide-react'
import { Modal } from './ui/Modal'
import { useStore } from '../lib/store'
import { useToast } from './ui/Toast'
import { SelectorFechaHora } from './ui/DateTimePicker'
import { BTN_DANGER_SM, BTN_PRIMARY, BTN_SECONDARY, BTN_SECONDARY_SM, botonClase, botonIcono } from '../lib/buttons'
import { useAnfitrion } from '../lib/anfitrion'
import { useOcupado } from '../lib/ocupado'
import { ModoEntrevista } from './ModoEntrevista'
import { candidateName, clockTimeInZone, dayKeyInZone, formatPhone } from '../lib/format'
import { paredAUtc } from '../../supabase/functions/_shared/schedule/zone'

/**
 * EL CAMPO DE ESTOS DIÁLOGOS, DECLARADO UNA VEZ.
 *
 * Estaba escrito a mano en los seis (las dos duraciones, el descanso, el sitio,
 * el enlace y el anfitrión) y le faltaban DOS ESTADOS: hover y foco. Al lado del
 * selector de día y hora, que sí los trae, la diferencia se veía sin medir nada:
 * tabulabas de un campo al de abajo y el anillo cambiaba de sistema, porque el de
 * arriba pinta el de la casa y el de abajo el que ponga el navegador. **Un
 * componente interactivo tiene sus estados o no está terminado**, y dos controles
 * hermanos de la misma pantalla no pueden tener dos vocabularios de foco.
 *
 * Los valores no se inventan: son exactamente los del disparador de
 * `SelectorFechaHora`, que es el campo con el que comparten columna.
 */
const CAMPO =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900 ' +
  'transition-colors hover:border-slate-400 ' +
  'focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15'
import type { Candidate, Interview, InterviewMode } from '../lib/types'

// El botón de entrevista de la CABECERA que vivía aquí se borró (ago 2026): no
// lo montaba NADIE desde que las acciones bajaron al raíl de la ficha, y repetía
// una decisión que ya se tomaba allí. Dos formas de decidir lo mismo se separan
// a la primera, y la que no se ve es la que se queda mintiendo. Lo que se pinta
// hoy es la línea "Entrevista · <cuándo>" de `AccionesCandidato`, que abre
// `CambiarCitaDialog`.

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

  // Prerrellenado con su modalidad y su sitio de siempre: las reglas de cada
  // modalidad no pueden depender de por qué puerta se entre.
  const { modo: modoPorDefecto, sitio: sitioPorDefecto } = useAnfitrion()
  const tocado = useRef(false)
  const modoTocado = useRef(false)
  useEffect(() => {
    if (!tocado.current && sitioPorDefecto) setSitio(sitioPorDefecto)
  }, [sitioPorDefecto])
  useEffect(() => {
    if (!modoTocado.current) setModo(modoPorDefecto)
  }, [modoPorDefecto])

  // Lo que ese anfitrión ya tiene cogido: sus otras entrevistas y, si lo ha
  // conectado, su Google Calendar. Avisa antes de guardar, no bloquea.
  const { choca } = useOcupado(anfitrion || null)
  const solapa = choca(cuando, duracion)

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
    // vas a poder hacer, y aquí no hay ningún paso previo que lo frene: esto se
    // guarda directo.
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
      // El RPC sigue devolviendo 'plan' (migración 20260801120000_interviews.sql),
      // pero los tiers murieron con el pago por proceso: hoy este caso solo puede
      // significar que el proceso no está al día de pago.
      setError('Este proceso no está al día de pago. Actívalo en Facturación para agendar entrevistas.')
      return
    }
    setError('No se pudo agendar. Inténtalo de nuevo.')
  }

  return (
    <Modal open={open} onClose={onClose} label="Agendar entrevista" maxWidthClass="sm:max-w-[460px]" alto="contenido">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Agendar entrevista</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">La hora es la del puesto.</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className={botonIcono('ghost')}
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* `flex-1` para que el PIE se apoye abajo: en móvil el panel ocupa la
          pantalla entera (un diálogo flotando a media altura se pelea con el
          teclado del sistema), y sin esto el cuerpo medía lo que medían sus
          campos y los botones se quedaban a media pantalla con medio teléfono
          de blanco debajo. En escritorio no cambia nada: con el alto puesto
          por el contenido no hay hueco al que crecer. Y `min-h-0`, o el hijo
          de un flex no puede encoger por debajo de su contenido y el scroll
          se va al panel. */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <label htmlFor="ent-cuando" className="mb-1 block text-[13px] font-semibold text-slate-700">
            Día y hora
          </label>
          <SelectorFechaHora id="ent-cuando" value={cuando} onChange={setCuando} />
          {solapa && (
            // Ámbar y no rojo: esto no es un error ni impide nada. Solaparse a
            // propósito es legítimo, y lo que de verdad no se puede hacer ya lo
            // para la base al guardar.
            <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-amber-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              A esa hora ya tienes algo. Puedes seguir, pero míralo.
            </p>
          )}
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
              className={CAMPO}
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
              className={CAMPO}
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
              className={CAMPO}
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
              className={CAMPO}
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
              className={CAMPO}
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
        {/* El pie de un modal es una PAREJA, así que las dos mitades van en la
            misma talla. Estaba fabricado con un `.replace('h-8','h-9')` sobre la
            talla `sm`: alto de `md` con el relleno de `sm` y sin el mínimo táctil
            (44px), al lado de un Cancelar que sí lo tiene. Un botón se coge de
            `buttons.ts`, no se repinta aquí. */}
        <button type="button" onClick={() => void guardar()} disabled={guardando} className={BTN_PRIMARY}>
          {guardando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {guardando ? 'Agendando' : 'Agendar'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * CAMBIAR LA CITA: mover la hora o cancelarla.
 *
 * Faltaba entera. El backend sabe reprogramar y cancelar desde agosto
 * (`reschedule_interview`, `cancel_interview`) y no lo llamaba ni una pantalla:
 * la única puerta hacia una cita confirmada era el botón "Ver entrevista", que
 * llevaba a la pestaña Conversación, y esa pestaña se retiró con el asistente de
 * WhatsApp. O sea que una vez agendada, la cita no se podía tocar.
 *
 * SOLO SE OFRECE LO QUE EL SERVIDOR SABE MOVER: el día, la hora y la duración.
 * `reschedule_interview` no toca la modalidad, ni el sitio, ni el anfitrión, así
 * que pintar esos campos aquí sería enseñar controles que no guardan nada. Para
 * cambiar eso hay que cancelar y volver a citar, y así se dice.
 *
 * Y LA HORA VIAJA COMO INSTANTE, no como hora de pared. Es la diferencia con
 * `AgendarManualDialog`, que le pasa el texto del selector a un RPC que lo
 * convierte con la zona de la empresa (`p_starts_local`); este RPC recibe un
 * `timestamptz`, así que la conversión la hace el cliente con la zona de LA
 * ENTREVISTA. Mandar el texto tal cual lo interpretaría Postgres en UTC y la
 * cita se movería sola un par de horas.
 */
export function CambiarCitaDialog({
  open,
  entrevista,
  candidate,
  onClose,
}: {
  open: boolean
  entrevista: Interview
  candidate: Candidate
  onClose: () => void
}) {
  const { rescheduleInterview, cancelInterview } = useStore()
  const toast = useToast()

  // La duración sale del propio rango: el tipo del cliente no la lleva aparte,
  // y derivarla evita que dos números digan cosas distintas.
  const duracionActual = useMemo(() => {
    if (!entrevista.startsAt || !entrevista.endsAt) return 30
    const min = Math.round((Date.parse(entrevista.endsAt) - Date.parse(entrevista.startsAt)) / 60_000)
    return Number.isFinite(min) && min > 0 ? min : 30
  }, [entrevista.startsAt, entrevista.endsAt])

  const cuandoActual = useMemo(
    () =>
      entrevista.startsAt
        ? `${dayKeyInZone(entrevista.startsAt, entrevista.timezone)}T${clockTimeInZone(entrevista.startsAt, entrevista.timezone)}`
        : '',
    [entrevista.startsAt, entrevista.timezone],
  )

  const [cuando, setCuando] = useState(cuandoActual)
  const [duracion, setDuracion] = useState(duracionActual)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)

  /**
   * AL CONFIRMAR, EL FOCO VA A "VOLVER".
   *
   * El disparador se desmonta al pedir confirmación (la pregunta ocupa su sitio),
   * así que sin esto el foco se cae al `body`: quien navega con teclado pulsa
   * "Cancelar la entrevista", aparece una pregunta que no puede leer ni contestar
   * y tiene que volver a tabular el diálogo entero.
   *
   * Va a la salida SEGURA y no al botón rojo, que es la regla de cualquier
   * confirmación destructiva: si el foco cayera en "Sí, cancelar", un Intro de más
   * (el mismo que acaba de abrir la pregunta) anularía la cita.
   */
  const volverRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmandoCancelar) volverRef.current?.focus()
  }, [confirmandoCancelar])

  // Al abrir sobre otra cita, los campos son los de ESA. Sin esto, abrir la de
  // otro candidato enseñaría la hora del anterior.
  const [citaPintada, setCitaPintada] = useState(entrevista.id)
  if (citaPintada !== entrevista.id) {
    setCitaPintada(entrevista.id)
    setCuando(cuandoActual)
    setDuracion(duracionActual)
    setError(null)
    setConfirmandoCancelar(false)
  }

  const { choca } = useOcupado(entrevista.hostUserId, entrevista.id)
  const solapa = choca(cuando, duracion)
  const sinCambios = cuando === cuandoActual && duracion === duracionActual

  const guardar = async () => {
    setError(null)
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(cuando)
    if (!m) {
      setError('Dinos qué día y a qué hora.')
      return
    }
    const inicio = paredAUtc(
      { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) },
      Number(m[4]), Number(m[5]), entrevista.timezone,
    )
    // La hora que no existe en el salto de primavera. Guardarla dejaría la cita
    // en un instante que ese día no ocurre.
    if (!inicio) {
      setError('Esa hora no existe ese día por el cambio de hora. Elige otra.')
      return
    }

    setGuardando(true)
    const res = await rescheduleInterview(entrevista.id, inicio.toISOString(), duracion)
    setGuardando(false)

    if (res.status === 'ok') {
      toast.success('Cita cambiada.')
      onClose()
      return
    }
    if (res.status === 'demo') {
      toast.show('En la demo solo puedes mirar. Crea tu cuenta para gestionar entrevistas de verdad.')
      onClose()
      return
    }
    if (res.status === 'ocupado') {
      setError('Ya tienes otra entrevista a esa hora. Prueba con otro hueco.')
      return
    }
    if (res.status === 'estado_no_valido') {
      setError('Esta entrevista ya no está en pie, así que no se puede mover.')
      return
    }
    setError('No se ha podido cambiar. Inténtalo otra vez.')
  }

  const cancelar = async () => {
    setGuardando(true)
    const res = await cancelInterview(entrevista.id)
    setGuardando(false)
    if (res.status === 'ok') {
      toast.success('Entrevista cancelada.')
      onClose()
      return
    }
    if (res.status === 'demo') {
      toast.show('En la demo solo puedes mirar.')
      onClose()
      return
    }
    if (res.status === 'ya_cerrada') {
      setError('Esta entrevista ya estaba cerrada.')
      return
    }
    setError('No se ha podido cancelar. Inténtalo otra vez.')
  }

  return (
    <Modal open={open} onClose={onClose} label="Cambiar la cita" maxWidthClass="sm:max-w-[460px]" alto="contenido">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Cambiar la cita</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {candidateName(candidate)} · la hora es la del puesto.
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className={botonIcono('ghost')}
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* `flex-1` para que el PIE se apoye abajo: en móvil el panel ocupa la
          pantalla entera (un diálogo flotando a media altura se pelea con el
          teclado del sistema), y sin esto el cuerpo medía lo que medían sus
          campos y los botones se quedaban a media pantalla con medio teléfono
          de blanco debajo. En escritorio no cambia nada: con el alto puesto
          por el contenido no hay hueco al que crecer. Y `min-h-0`, o el hijo
          de un flex no puede encoger por debajo de su contenido y el scroll
          se va al panel. */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <label htmlFor="cita-cuando" className="mb-1 block text-[13px] font-semibold text-slate-700">
            Día y hora
          </label>
          <SelectorFechaHora id="cita-cuando" value={cuando} onChange={setCuando} />
          {solapa && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-amber-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              A esa hora ya tienes algo. Puedes seguir, pero míralo.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cita-duracion" className="mb-1 block text-[13px] font-semibold text-slate-700">
            Duración
          </label>
          <select
            id="cita-duracion"
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value))}
            className={CAMPO}
          >
            {[15, 20, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>

        {/* Lo que NO pasa al cambiar la hora. Desde aquí no sale ningún mensaje,
            y quien mueve una cita da por hecho que se avisa: es la regla de
            siempre, una nota se gana el sitio cuando avisa de que lo que ves no
            es lo que el control dice.

            CON GLIFO Y EN FILA, no como un párrafo suelto: flotando entre dos
            campos se leía como el pie de foto del selector de arriba, que es
            justo lo que no es. El icono la separa de los rótulos sin subirle el
            peso, y el gris de apoyo dice que acompaña. */}
        <p className="flex items-start gap-2 text-[13px] text-slate-500">
          <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
          <span>Al candidato no le avisamos nosotros: díselo tú por teléfono o por WhatsApp.</span>
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

      </div>

      {/* CANCELAR BAJA AL PIE, A LA IZQUIERDA (sep 2026). Vivía en el cuerpo, con
          una divisoria propia justo encima de la del pie: dos hairlines a 20px
          uno de otro, que es lo que hacía que el diálogo se leyera a bandas. Y
          era un enlace subrayado, un control que no está en el vocabulario de
          esta casa.

          A la izquierda del par de confirmación es donde vive una acción
          destructiva en un diálogo: lejos del botón que se pulsa por costumbre y
          en el extremo opuesto al que el ojo va a buscar. Sigue sin ser un botón
          de la FICHA, que es lo que ya se decidió: es una acción sobre LA CITA, y
          este diálogo ES la cita.

          SE CONFIRMA SUSTITUYENDO EL PIE, no abriendo otra capa: dos modales
          apilados se pelean por el Escape. Y el cuerpo se queda a la vista
          mientras decides, así que se confirma con la cita delante. */}
      <div className="border-t border-slate-200 px-5 py-3">
        {confirmandoCancelar ? (
          // LA FRASE VA ENCIMA, no al lado. En 460px, en la misma línea que los
          // dos botones le quedan ~240 y parte en dos igual, pero además
          // estrujada contra ellos. A lo ancho se lee de una pasada y el pie
          // crece lo mismo. Que crezca está bien: es un paso nuevo, y verlo
          // aparecer es parte de lo que dice que has pedido algo que no se
          // deshace.
          <div className="space-y-2.5">
            <p role="status" className="text-[13px] text-slate-700">
              Se anula y el hueco queda libre. <span className="text-slate-500">El candidato no cambia de estado.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button ref={volverRef} type="button" onClick={() => setConfirmandoCancelar(false)} className={BTN_SECONDARY_SM}>
                Volver
              </button>
              {/* ROJO AQUÍ SÍ: cancelar una cita no se deshace, que es el único uso
                  que esta casa le da. Es lo que lo separa de "descartar", que es
                  rutina y reversible y por eso va en slate. */}
              <button type="button" onClick={() => void cancelar()} disabled={guardando} className={BTN_DANGER_SM}>
                {guardando && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {guardando ? 'Cancelando' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {/* EN FANTASMA, y es lo que lo separa de "Cerrar": en línea eran dos
                botones idénticos en los dos extremos del pie, uno que descarta el
                diálogo y otro que anula una cita. Sin caja se lee como lo que es,
                la salida rara, y deja el par de la derecha como el único grupo de
                botones del pie. El rojo llega DESPUÉS, en el clic que no se
                deshace: un disparador rojo para algo que todavía pregunta grita
                dos veces. */}
            <button type="button" onClick={() => setConfirmandoCancelar(true)} className={botonClase('ghost')}>
              Cancelar la entrevista
            </button>
            <div className="flex gap-2">
              {/* "Cerrar" y no "Cancelar", que es lo que dice su gemelo de
                  agendar: aquí "Cancelar" al lado de "Cancelar la entrevista"
                  serían dos cosas distintas con la misma palabra, y el glosario
                  de esta casa no admite eso. */}
              <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cerrar</button>
              {/* Sin `disabled:opacity-50` pegado detrás: `BTN_PRIMARY` ya trae su
                  `disabled:opacity-60`, y dos utilidades del mismo eje se
                  resuelven por el orden en que se EMITEN, no por el que se
                  escriben. La salida es no poner la que sobra. */}
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={guardando || sinCambios}
                className={BTN_PRIMARY}
              >
                {guardando && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {guardando ? 'Guardando' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

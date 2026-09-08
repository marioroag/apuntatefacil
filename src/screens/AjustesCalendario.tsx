import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BTN_PRIMARY } from '../lib/buttons'
import { useToast } from '../components/ui/Toast'
import { ModoEntrevista } from '../components/ModoEntrevista'
import { CalendarioGoogle } from '../components/CalendarioGoogle'
import type { InterviewMode } from '../lib/types'

// CÓMO Y DÓNDE entrevistas, y tu calendario. Dos preguntas y ni una más.
//
// El orden de la página es el de las preguntas, y la primera es CÓMO: si la
// entrevista es por teléfono, la dirección no pinta nada, y hasta ago 2026 esta
// pantalla pedía la dirección sin haber preguntado nunca la modalidad (que
// existía en la base desde el principio y no la escribía nadie).
//
// AQUÍ HUBO UNA AGENDA SEMANAL Y CINCO NÚMEROS MÁS (Mario, sep 2026: "quita
// también esos ajustes de agenda que ya no gobiernan nada"). "Cuándo puedes
// entrevistar" (días y tramos) y "Cómo proponemos las citas" (duración,
// descanso, aviso mínimo, opciones por día, hasta cuándo) existían para UNA
// sola cosa: calcular los huecos que el asistente de WhatsApp le ofrecía al
// candidato para que eligiera. Retirado el asistente no se ofrece ninguno, así
// que lo que quedaba era una pantalla prometiendo "solo ofreceremos huecos
// dentro de estas horas" mientras nadie leía esas horas. **Un control que no
// gobierna nada es una promesa falsa**, y es la primera regla del registro de
// ajustes.
//
// LO QUE SE COMPROBÓ ANTES DE CORTAR, porque dos de ellos parecían vivos: la
// DURACIÓN y el DESCANSO de una cita los pone el propio diálogo de agendar
// (`InterviewAction`, con sus selectores), y viajan a `create_manual_interview`
// como parámetros; los de `interview_hosts` no los leía nadie. Lo que sí sigue
// vivo es el descanso de la FILA de la entrevista, que es de donde el trigger
// saca `blocked_range` y con él el aviso de solape.
//
// Las filas de `interview_availability` y esas columnas siguen en la base, sin
// consumidor: el día que exista la página pública de reserva, esto vuelve.

/**
 * Lo que se LEE de `interview_host_config`. El RPC devuelve bastante más
 * (duración, descanso, aviso mínimo, opciones por día, horizonte, granularidad
 * y las reglas de la agenda semanal): eran los números con los que el asistente
 * de WhatsApp calculaba los huecos que le ofrecía al candidato, y al retirarlo
 * (sep 2026) se quedaron sin quien los consuma. Aquí solo se declara lo que de
 * verdad se usa, para que no parezcan vivos.
 */
interface Config {
  defaultMode: InterviewMode
  defaultLocation: string
}

export function AjustesCalendario() {
  const { company, user } = useAuth()
  const toast = useToast()
  const demo = company?.id === 'demo'

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [cfg, setCfg] = useState<Config | null>(null)
  // Quien entrevista por teléfono no ve el formulario de la dirección, pero
  // tiene que poder guardarla igual: la modalidad de aquí es la de por defecto,
  // y cualquier cita suelta puede ponerse en presencial.
  const [verDireccion, setVerDireccion] = useState(false)

  const cargar = useCallback(async () => {
    if (!company?.id || !user?.id) return
    setCargando(true)
    try {
      if (!demo) {
        // Crea la ficha de anfitrión si es la primera vez, y luego la lee. Sigue
        // haciendo falta aunque la agenda semanal ya no se pinte: es la fila que
        // guarda la modalidad y la dirección, y de la que cuelga la conexión con
        // Google Calendar.
        await supabase.rpc('ensure_interview_host', { p_company: company.id, p_user: user.id })
      }
      const { data } = demo
        ? { data: null }
        : await supabase.rpc('interview_host_config', { p_company: company.id, p_user: user.id })

      const c = data as Partial<Config> | null
      setCfg({
        defaultMode: c?.defaultMode ?? 'presencial',
        defaultLocation: c?.defaultLocation ?? '',
      })
    } finally {
      setCargando(false)
    }
  }, [company?.id, user?.id, demo])

  useEffect(() => { void cargar() }, [cargar])

  const guardar = async () => {
    if (demo) {
      toast.show('En la demo no se guarda. Crea tu cuenta para configurar tus entrevistas.')
      return
    }
    if (!company?.id || !cfg) return

    setGuardando(true)
    try {
      // AQUÍ SE GUARDABA TAMBIÉN LA AGENDA SEMANAL (`set_interview_availability`)
      // y los cinco números de "Cómo proponemos las citas". Se fueron con el
      // asistente de WhatsApp (sep 2026): existían para calcular los huecos que
      // se le ofrecían al candidato, y sin asistente no se ofrece ninguno. Lo
      // que se queda es lo que de verdad gobierna una cita puesta a mano.
      const { error: e2 } = await supabase.from('interview_hosts').update({
        default_mode: cfg.defaultMode,
        // La dirección se guarda siempre, la esté enseñando la pantalla o no:
        // pasar la modalidad por defecto a teléfono no es motivo para borrarle
        // el sitio al que lleva citando gente.
        default_location: cfg.defaultLocation.trim(),
        // AQUÍ SE GUARDABA TAMBIÉN UN ENLACE DE GOOGLE MAPS con su punto
        // (`default_place_url/_lat/_lng`), y se retiró con el asistente de
        // WhatsApp (sep 2026): esas coordenadas existían para UNA sola cosa, el
        // pin del mapa dentro del chat, que es lo único que pide latitud y
        // longitud. La cita a mano y Google Calendar usan la dirección escrita.
        // Las columnas siguen en la base y nadie las lee; un campo que resuelve
        // un dato que ya no consume nadie es un control que no gobierna nada.
      }).eq('company_id', company.id).eq('user_id', user?.id ?? '')
      if (e2) throw e2
      toast.success('Ajustes guardados.')
      await cargar()
    } catch {
      toast.error('No se pudieron guardar los ajustes.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando || !cfg) {
    return (
      <div className="flex h-40 items-center justify-center text-slate-400">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    )
  }

  // La dirección se declara aparte porque sale en dos sitios distintos: a la
  // vista cuando entrevistas en persona, y detrás de una pregunta cuando no.
  // (Llegó a ser DOS campos, con un enlace de mapa al lado; el segundo se fue
  // con el pin de WhatsApp, que era su único consumidor.)
  const direccion = (
    <div>
      <label htmlFor="sitio" className="block text-[13px] font-semibold text-slate-700">
        Dirección
      </label>
      <input
        id="sitio"
        value={cfg.defaultLocation}
        onChange={(e) => setCfg({ ...cfg, defaultLocation: e.target.value })}
        placeholder="Calle Marina 32, nave 4, Las Palmas"
        maxLength={300}
        className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none"
      />
      <p className="mt-1 text-[12px] text-slate-500">
        Tal cual se lo dirías por teléfono. Portal, nave o planta incluidos.
      </p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Las dos tarjetas de esta pantalla llevan el marco a DOS MANOS (`filo`)
          y no un `ring-1` suelto: el hairline de 1px solo es nítido mientras cae
          en la rejilla de píxeles, y en el arco de la esquina pierde hasta un 23%
          de tinta. Con un borde que ya es de 1,15:1 a propósito, ese 23% es la
          diferencia entre canto mecanizado y difuminado. */}
      <section className="rounded-xl filo bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-[15px] font-semibold text-slate-900">Cómo entrevistas</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Con lo que vienen puestas tus entrevistas. En cada candidato puedes cambiarlo.
        </p>

        <div className="mt-4">
          <ModoEntrevista
            value={cfg.defaultMode}
            onChange={(m) => setCfg({ ...cfg, defaultMode: m })}
            name="modo-por-defecto"
          />
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          {cfg.defaultMode === 'presencial' ? (
            direccion
          ) : (
            <>
              <p className="text-[13px] text-slate-600">
                {/* NI UNA NI OTRA PROMETEN QUE LE AVISEMOS NOSOTROS (sep 2026).
                    La primera decía "al confirmar la cita se lo decimos" y la
                    segunda hablaba de "invitar": las dos eran del asistente de
                    WhatsApp, que era quien escribía. Hoy la cita se apunta y
                    avisas tú, así que lo que se dice es lo que de verdad pasa. */}
                {cfg.defaultMode === 'telefonica'
                  ? 'Le llamas tú al teléfono que dejó al apuntarse. Dile la hora al avisarle, para que no se le pase la llamada.'
                  : 'El enlace de la sala lo pones al agendar cada cita, porque casi nunca es el mismo.'}
              </p>
              <button
                type="button"
                onClick={() => setVerDireccion((v) => !v)}
                aria-expanded={verDireccion}
                className="mt-2 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[13px] font-semibold text-indigo-700 hover:underline"
              >
                <ChevronDown
                  className={`size-3.5 transition-transform duration-[var(--duration-control)] ${verDireccion ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                ¿Alguna la haces en persona?
              </button>
              {verDireccion && (
                <div className="mt-3">
                  <p className="text-[12px] text-slate-500">
                    Guarda aquí tu dirección y la usaremos en las que pongas presenciales.
                  </p>
                  {direccion}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* La segunda pregunta de la pantalla, y la última. Estuvo entre la agenda
          semanal y los números de "cómo proponemos las citas" porque su trabajo
          era afinar aquella respuesta; retirados los dos (sep 2026), lo que hace
          se sostiene solo: avisa cuando la hora que apuntas choca con algo que
          ya tienes, y mete la cita confirmada en tu calendario. */}
      <CalendarioGoogle />

      <div className="flex items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={BTN_PRIMARY}>
          {guardando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Guardar cambios
        </button>
        {/* Se dice aquí porque es justo lo que la gente teme al tocar esto: que
            cambiar su dirección se la cambie a quien ya tiene citado. No pasa,
            porque cada entrevista guarda la suya. Es una nota que se gana el
            sitio, que es la regla: avisa de que lo que ves NO es lo que el
            control parece decir. */}
        <p className="text-[13px] text-slate-500">
          Las entrevistas ya confirmadas no se mueven: conservan la dirección con la que se cerraron.
        </p>
      </div>
    </div>
  )
}

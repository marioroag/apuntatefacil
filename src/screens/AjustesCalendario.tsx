import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronDown, MapPin, Plus, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BTN_PRIMARY, BTN_SECONDARY_SM } from '../lib/buttons'
import { useToast } from '../components/ui/Toast'
import { ModoEntrevista } from '../components/ModoEntrevista'
import type { InterviewMode } from '../lib/types'

// Cómo, cuándo y dónde entrevistas. Es lo que el agente usa para hablar con un
// candidato, así que lo que se toque aquí sale por WhatsApp.
//
// El orden de la página es el de las preguntas, y la primera es CÓMO: si la
// entrevista es por teléfono, la dirección no pinta nada, y hasta hoy esta
// pantalla pedía la dirección sin haber preguntado nunca la modalidad (que
// existía en la base desde el principio y no la escribía nadie).
//
// Otras dos decisiones que se notan al usarlo:
//
//   * Ya viene relleno (L-V de 9:00 a 18:00). Configurar esto es AJUSTAR algo
//     que ya funciona, no rellenar un formulario vacío antes de poder empezar.
//     Nadie debería tener que pasar por aquí para invitar a su primer candidato.
//   * Dos tramos por día. La jornada partida (9 a 14 y 16 a 20) es la norma en
//     hostelería y en obra, y con un solo tramo habría que mentir poniendo
//     9 a 20 y acabar recibiendo candidatos a las tres de la tarde.

const DIAS = [
  { n: 1, largo: 'Lunes' },
  { n: 2, largo: 'Martes' },
  { n: 3, largo: 'Miércoles' },
  { n: 4, largo: 'Jueves' },
  { n: 5, largo: 'Viernes' },
  { n: 6, largo: 'Sábado' },
  { n: 0, largo: 'Domingo' },
]

type Tramo = { inicio: string; fin: string } // "09:00"
type PorDia = Record<number, Tramo[]>

const aHora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

interface Config {
  timezone: string
  durMin: number
  bufferMin: number
  minNoticeHoras: number
  horizonteDias: number
  maxPorDia: number
  granularidadMin: number
  defaultMode: InterviewMode
  defaultLocation: string
  defaultLat: number | null
  defaultLng: number | null
  defaultPlaceUrl: string
  reglas: { weekday: number; startMin: number; endMin: number }[]
}

/** Lo que puede pasarle al enlace de mapa que se pega, en cristiano. */
const FALLO_LUGAR: Record<string, string> = {
  no_es_enlace: 'Eso no parece un enlace. Pega el que te da Google Maps al compartir.',
  no_es_de_maps: 'Solo entendemos enlaces de Google Maps o de Apple Maps.',
  sin_punto: 'Ese enlace no lleva el punto dentro. Abre el sitio en Google Maps, pulsa Compartir y pega ese.',
  fuera_de_rango: 'Esas coordenadas no existen. Revísalas.',
  largo: 'Ese enlace es larguísimo. Pega el que da el botón de compartir.',
}

export function AjustesCalendario() {
  const { company, user } = useAuth()
  const toast = useToast()
  const demo = company?.id === 'demo'

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [dias, setDias] = useState<PorDia>({})
  const [cfg, setCfg] = useState<Omit<Config, 'reglas'> | null>(null)
  const [comprobando, setComprobando] = useState(false)
  const [errorMapa, setErrorMapa] = useState<string | null>(null)
  // Quien entrevista por teléfono no ve el formulario de la dirección, pero
  // tiene que poder guardarla igual: la modalidad de aquí es la de por defecto,
  // y cualquier invitación suelta puede ponerse en presencial.
  const [verDireccion, setVerDireccion] = useState(false)

  const cargar = useCallback(async () => {
    if (!company?.id || !user?.id) return
    setCargando(true)
    try {
      if (!demo) {
        // Da de alta con el horario por defecto si es la primera vez, y luego lo lee.
        await supabase.rpc('ensure_interview_host', { p_company: company.id, p_user: user.id })
      }
      const { data } = demo
        ? { data: null }
        : await supabase.rpc('interview_host_config', { p_company: company.id, p_user: user.id })

      const c = (data as Config | null) ?? {
        timezone: 'Europe/Madrid', durMin: 30, bufferMin: 15, minNoticeHoras: 4,
        horizonteDias: 10, maxPorDia: 4, granularidadMin: 30, defaultMode: 'presencial',
        defaultLocation: '', defaultLat: null, defaultLng: null, defaultPlaceUrl: '',
        reglas: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 540, endMin: 1080 })),
      }
      const porDia: PorDia = {}
      for (const r of c.reglas) {
        porDia[r.weekday] = [...(porDia[r.weekday] ?? []), { inicio: aHora(r.startMin), fin: aHora(r.endMin) }]
      }
      for (const d of Object.keys(porDia)) {
        porDia[Number(d)].sort((a, b) => a.inicio.localeCompare(b.inicio))
      }
      setDias(porDia)
      const { reglas: _r, ...resto } = c
      setCfg(resto)
    } finally {
      setCargando(false)
    }
  }, [company?.id, user?.id, demo])

  useEffect(() => { void cargar() }, [cargar])

  const activo = (n: number) => (dias[n]?.length ?? 0) > 0

  const alternarDia = (n: number) =>
    setDias((prev) => {
      const next = { ...prev }
      if (next[n]?.length) delete next[n]
      else next[n] = [{ inicio: '09:00', fin: '18:00' }]
      return next
    })

  const cambiarTramo = (n: number, i: number, campo: 'inicio' | 'fin', valor: string) =>
    setDias((prev) => ({
      ...prev,
      [n]: (prev[n] ?? []).map((t, j) => (j === i ? { ...t, [campo]: valor } : t)),
    }))

  // El tramo nuevo arranca donde acaba el anterior: naciendo solapado, el
  // candidato vería la misma hora dos veces en la lista.
  const anadirTramo = (n: number) =>
    setDias((prev) => {
      const previos = prev[n] ?? []
      const ultimo = previos[previos.length - 1]
      const desde = ultimo ? aMinutos(ultimo.fin) : 16 * 60
      const hasta = Math.min(24 * 60 - 1, desde + 2 * 60)
      if (desde >= 24 * 60 - 1) return prev
      return { ...prev, [n]: [...previos, { inicio: aHora(desde), fin: aHora(hasta) }] }
    })

  const quitarTramo = (n: number, i: number) =>
    setDias((prev) => {
      const restantes = (prev[n] ?? []).filter((_, j) => j !== i)
      const next = { ...prev }
      if (restantes.length) next[n] = restantes
      else delete next[n]
      return next
    })

  /**
   * Convierte el enlace pegado en un punto, y lo hace AL SALIR DEL CAMPO, no al
   * guardar. Quien pega un enlace que no sirve tiene que enterarse ahí mismo,
   * con el campo delante y el sitio abierto en la otra pestaña. Descubrirlo al
   * pulsar Guardar, o peor, no descubrirlo nunca y que el candidato se quede sin
   * ubicación de madrugada, es lo que hay que evitar.
   */
  const comprobarMapa = async () => {
    if (!cfg || demo) return
    const url = cfg.defaultPlaceUrl.trim()
    setErrorMapa(null)
    if (!url) {
      setCfg({ ...cfg, defaultPlaceUrl: '', defaultLat: null, defaultLng: null })
      return
    }
    setComprobando(true)
    const { data, error } = await supabase.functions.invoke('resolver-lugar', { body: { url } })
    setComprobando(false)

    const r = (data ?? {}) as { lat?: number; lng?: number; error?: string }
    if (error || !r || (r.error && r.lat === undefined)) {
      setErrorMapa(FALLO_LUGAR[r?.error ?? ''] ?? 'No hemos podido leer ese enlace. Inténtalo otra vez.')
      setCfg({ ...cfg, defaultLat: null, defaultLng: null })
      return
    }
    setCfg({ ...cfg, defaultPlaceUrl: url, defaultLat: r.lat ?? null, defaultLng: r.lng ?? null })
  }

  const guardar = async () => {
    if (demo) {
      toast.show('En la demo no se guarda. Crea tu cuenta para configurar tu horario.')
      return
    }
    if (!company?.id || !cfg) return

    // Se valida ANTES de mandar nada: la base rechazaría un tramo al revés con
    // un error de constraint, que es correcto pero ilegible para quien lo lee.
    const reglas: { weekday: number; start_min: number; end_min: number }[] = []
    for (const [n, tramos] of Object.entries(dias)) {
      for (const t of tramos) {
        const a = aMinutos(t.inicio)
        const b = aMinutos(t.fin)
        if (b <= a) {
          const dia = DIAS.find((d) => d.n === Number(n))?.largo ?? ''
          toast.error(`En ${dia.toLowerCase()}, la hora de fin tiene que ser posterior a la de inicio.`)
          return
        }
        reglas.push({ weekday: Number(n), start_min: a, end_min: b })
      }
    }
    if (!reglas.length) {
      toast.error('Deja al menos un día con horario, o no podremos proponer ninguna cita.')
      return
    }
    for (const d of DIAS) {
      const delDia = reglas.filter((r) => r.weekday === d.n).sort((a, b) => a.start_min - b.start_min)
      for (let i = 1; i < delDia.length; i++) {
        if (delDia[i].start_min < delDia[i - 1].end_min) {
          toast.error(`Los dos tramos del ${d.largo.toLowerCase()} se pisan. Ajusta las horas.`)
          return
        }
      }
    }

    setGuardando(true)
    try {
      const { error: e1 } = await supabase.rpc('set_interview_availability', {
        p_company: company.id, p_reglas: reglas,
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('interview_hosts').update({
        duration_minutes: cfg.durMin,
        buffer_minutes: cfg.bufferMin,
        min_notice_hours: cfg.minNoticeHoras,
        horizon_days: cfg.horizonteDias,
        max_per_day: cfg.maxPorDia,
        default_mode: cfg.defaultMode,
        // La dirección se guarda siempre, la esté enseñando la pantalla o no:
        // pasar la modalidad por defecto a teléfono no es motivo para borrarle
        // el sitio al que lleva citando gente.
        default_location: cfg.defaultLocation.trim(),
        default_place_url: cfg.defaultPlaceUrl.trim(),
        // Los dos o ninguno: la base lo obliga con un check, y medio punto
        // mandaría el pin al meridiano de Greenwich.
        default_place_lat: cfg.defaultLat,
        default_place_lng: cfg.defaultLng,
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

  // Los dos campos de la dirección. Se declaran aparte porque salen en dos
  // sitios distintos: a la vista cuando entrevistas en persona, y detrás de una
  // pregunta cuando no.
  const direccion = (
    <div className="space-y-4">
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

      <div>
        <label htmlFor="mapa" className="block text-[13px] font-semibold text-slate-700">
          Enlace de Google Maps
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="mapa"
            value={cfg.defaultPlaceUrl}
            onChange={(e) => { setCfg({ ...cfg, defaultPlaceUrl: e.target.value }); setErrorMapa(null) }}
            onBlur={() => void comprobarMapa()}
            placeholder="https://maps.app.goo.gl/..."
            aria-invalid={errorMapa ? true : undefined}
            aria-describedby="mapa-ayuda"
            className={`h-10 w-full rounded-xl border-0 bg-white px-3 text-[14px] text-slate-800 ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-indigo-600 ${
              errorMapa ? 'ring-red-400' : 'ring-slate-300'
            }`}
          />
          {comprobando && <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" aria-hidden />}
        </div>

        <div id="mapa-ayuda" className="mt-1 text-[12px]">
          {errorMapa ? (
            <p role="alert" className="flex items-start gap-1.5 text-red-700">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
              {errorMapa}
            </p>
          ) : cfg.defaultLat !== null && cfg.defaultLng !== null ? (
            // Se enseña el punto, no un "listo" a secas: así se ve que hemos
            // entendido el sitio correcto y no otro con el mismo nombre.
            <p className="flex items-center gap-1.5 text-slate-600">
              <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              <span>
                Le llegará la ubicación en el mapa.{' '}
                <span className="num text-slate-500">
                  {cfg.defaultLat.toFixed(5)}, {cfg.defaultLng.toFixed(5)}
                </span>
              </span>
            </p>
          ) : (
            <p className="text-slate-500">
              Opcional. Si lo pegas, le mandamos la ubicación en el mapa y la abre de un toque.
              Búscalo en Google Maps, pulsa Compartir y pega aquí el enlace.
            </p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-white p-4 shadow-card ring-1 ring-slate-200 sm:p-5">
        <h2 className="text-[15px] font-semibold text-slate-900">Cómo entrevistas</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Con lo que vienen puestas tus invitaciones. En cada candidato puedes cambiarlo.
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
                {cfg.defaultMode === 'telefonica'
                  ? 'Le llamas tú al teléfono que dejó en el formulario. Al confirmar la cita se lo decimos, para que no se le pase la llamada.'
                  : 'El enlace de la sala lo pones al invitar a cada candidato, porque casi nunca es el mismo.'}
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
                <div className="mt-3 space-y-4">
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

      <section className="rounded-xl bg-white p-4 shadow-card ring-1 ring-slate-200 sm:p-5">
        <h2 className="text-[15px] font-semibold text-slate-900">Cuándo puedes entrevistar</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Solo ofreceremos huecos dentro de estas horas.
        </p>

        <div className="mt-4 divide-y divide-slate-100">
          {DIAS.map((d) => (
            <div key={d.n} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
              <label className="flex min-w-[140px] cursor-pointer items-center gap-2.5 pt-1.5">
                <input
                  type="checkbox"
                  checked={activo(d.n)}
                  onChange={() => alternarDia(d.n)}
                  className="size-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                />
                <span className={`text-[14px] ${activo(d.n) ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                  {d.largo}
                </span>
              </label>

              {activo(d.n) ? (
                <div className="flex-1 space-y-2">
                  {(dias[d.n] ?? []).map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={t.inicio}
                        onChange={(e) => cambiarTramo(d.n, i, 'inicio', e.target.value)}
                        aria-label={`${d.largo}, hora de inicio`}
                        className="num h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none"
                      />
                      <span className="text-[13px] text-slate-400">a</span>
                      <input
                        type="time"
                        value={t.fin}
                        onChange={(e) => cambiarTramo(d.n, i, 'fin', e.target.value)}
                        aria-label={`${d.largo}, hora de fin`}
                        className="num h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none"
                      />
                      {(dias[d.n]?.length ?? 0) > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarTramo(d.n, i)}
                          aria-label={`Quitar este tramo del ${d.largo.toLowerCase()}`}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Jornada partida. Solo dos: con más, esto deja de ser un
                      ajuste y se convierte en un calendario. */}
                  {(dias[d.n]?.length ?? 0) < 2 && (
                    <button type="button" onClick={() => anadirTramo(d.n)} className={BTN_SECONDARY_SM}>
                      <Plus className="size-3.5" aria-hidden />
                      Otro tramo
                    </button>
                  )}
                </div>
              ) : (
                <p className="pt-2 text-[13px] text-slate-400">Sin entrevistas</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-card ring-1 ring-slate-200 sm:p-5">
        <h2 className="text-[15px] font-semibold text-slate-900">Cómo proponemos las citas</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Con esto calculamos los huecos que le ofrecemos a cada candidato.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            id="dur" label="Duración"
            ayuda="Lo que dura la entrevista en sí."
            value={cfg.durMin}
            onChange={(v) => setCfg({ ...cfg, durMin: v })}
            opciones={[[15, '15 minutos'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora']]}
          />
          <Campo
            id="buffer" label="Descanso entre entrevistas"
            ayuda="Para no encadenarlas sin respirar."
            value={cfg.bufferMin}
            onChange={(v) => setCfg({ ...cfg, bufferMin: v })}
            opciones={[[0, 'Ninguno'], [10, '10 minutos'], [15, '15 minutos'], [30, '30 minutos']]}
          />
          <Campo
            id="aviso" label="Aviso mínimo"
            ayuda="No ofrecemos huecos para dentro de menos tiempo."
            value={cfg.minNoticeHoras}
            onChange={(v) => setCfg({ ...cfg, minNoticeHoras: v })}
            opciones={[[1, '1 hora'], [2, '2 horas'], [4, '4 horas'], [12, '12 horas'], [24, '1 día']]}
          />
          <Campo
            id="max" label="Opciones por día"
            ayuda="Cuántos huecos de cada jornada le proponemos, repartidos de mañana y tarde."
            value={cfg.maxPorDia}
            onChange={(v) => setCfg({ ...cfg, maxPorDia: v })}
            opciones={[[1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8']]}
          />
          <Campo
            id="horizonte" label="Hasta cuándo"
            ayuda="Lo lejos que pueden quedar los huecos que ofrecemos."
            value={cfg.horizonteDias}
            onChange={(v) => setCfg({ ...cfg, horizonteDias: v })}
            opciones={[[5, '5 días'], [10, '10 días'], [15, '15 días'], [30, '30 días']]}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={BTN_PRIMARY}>
          {guardando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Guardar cambios
        </button>
        {/* Se dice aquí porque es lo que la gente teme al tocar esto. */}
        <p className="text-[13px] text-slate-500">
          Las entrevistas ya confirmadas no se mueven.
        </p>
      </div>
    </div>
  )
}

function Campo({
  id, label, ayuda, value, onChange, opciones,
}: {
  id: string
  label: string
  ayuda: string
  value: number
  onChange: (v: number) => void
  opciones: [number, string][]
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none"
      >
        {/* Si el valor guardado no está en la lista (por ejemplo tras cambiar
            estas opciones), se añade para no perderlo en silencio al guardar. */}
        {(opciones.some(([v]) => v === value) ? opciones : [...opciones, [value, String(value)] as [number, string]])
          .sort((a, b) => a[0] - b[0])
          .map(([v, texto]) => (
            <option key={v} value={v}>{texto}</option>
          ))}
      </select>
      <p className="mt-1 text-[12px] text-slate-500">{ayuda}</p>
    </div>
  )
}

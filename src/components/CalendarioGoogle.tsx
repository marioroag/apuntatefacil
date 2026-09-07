import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Calendar, Check, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BTN_PRIMARY_SM, BTN_SECONDARY, BTN_SECONDARY_SM } from '../lib/buttons'
import { useToast } from './ui/Toast'
import { relativeDate } from '../lib/format'

/**
 * Conectar tu Google Calendar. Hace dos cosas y las dos se dicen aquí, porque
 * son las dos razones por las que alguien daría permiso a su calendario:
 *
 *   * LEE lo que ya tienes ocupado, para AVISARTE al apuntar una cita encima.
 *     Avisa, no bloquea: solaparse a propósito es legítimo.
 *   * PONE: la entrevista te aparece en él, con su sitio o con su enlace.
 *
 * LA PRIMERA MITAD DECÍA ANTES OTRA COSA, y conviene saber qué cambió: mientras
 * existió el asistente de WhatsApp, esas horas ocupadas se restaban de los
 * huecos que se le OFRECÍAN al candidato. Retirado el asistente (sep 2026) no se
 * ofrece ninguno, así que lo que queda de esa lectura es el aviso de solape del
 * diálogo de agendar (`lib/ocupado.ts`), que es real y se usa. Lo que no puede
 * hacer esta pantalla es seguir prometiendo que ofrecemos huecos.
 *
 * SIN CREDENCIALES NO SE PINTA NADA. Un botón que no puede conectar es peor que
 * ninguno, y quien no tiene esto montado tampoco necesita ver el concepto. Es
 * la misma regla que esconde el selector de sede cuando no hay ninguna.
 */

interface Conexion {
  conectado: boolean
  cuenta?: string
  desde?: string
  error?: string | null
}

/** Lo que ha pasado al volver de Google, en cristiano. */
const VUELTA: Record<string, { tono: 'ok' | 'error'; texto: string }> = {
  ok: { tono: 'ok', texto: 'Calendario conectado.' },
  cancelado: { tono: 'error', texto: 'No has dado permiso, así que no hemos conectado nada.' },
  permisos: {
    tono: 'error',
    texto: 'Faltan permisos: hacen falta los dos, ver cuándo estás ocupado y crear el evento.',
  },
  caducado: { tono: 'error', texto: 'El enlace de conexión ha caducado. Inténtalo otra vez.' },
  error: { tono: 'error', texto: 'No hemos podido conectar con Google. Inténtalo otra vez.' },
}

export function CalendarioGoogle() {
  const { company } = useAuth()
  const toast = useToast()
  const demo = company?.id === 'demo'
  const [params, setParams] = useSearchParams()

  const [cargando, setCargando] = useState(true)
  const [configurado, setConfigurado] = useState(false)
  const [conexion, setConexion] = useState<Conexion>({ conectado: false })
  const [yendo, setYendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const cargar = useCallback(async () => {
    if (!company?.id || demo) { setCargando(false); return }
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { accion: 'estado', companyId: company.id },
      })
      if (error) throw error
      setConfigurado(Boolean(data?.configurado))
      setConexion((data?.conexion as Conexion | null) ?? { conectado: false })
    } catch {
      // Sin respuesta no se pinta nada, que es lo mismo que sin configurar: no
      // se puede prometer una conexión que no sabemos si existe.
      setConfigurado(false)
    } finally {
      setCargando(false)
    }
  }, [company?.id, demo])

  useEffect(() => { void cargar() }, [cargar])

  // El resultado del consentimiento llega en la URL, porque el callback de
  // Google no puede devolver JSON a una pantalla: devuelve a la persona aquí.
  // Se dice una vez y se limpia el parámetro, o al recargar volvería a saltar.
  useEffect(() => {
    const r = params.get('calendario')
    if (!r) return
    const dicho = VUELTA[r] ?? VUELTA.error
    if (dicho.tono === 'ok') toast.success(dicho.texto)
    else toast.error(dicho.texto)
    const limpio = new URLSearchParams(params)
    limpio.delete('calendario')
    setParams(limpio, { replace: true })
  }, [params, setParams, toast])

  const conectar = async () => {
    if (!company?.id) return
    setYendo(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { accion: 'conectar', companyId: company.id },
      })
      if (error || !data?.url) throw error ?? new Error('sin url')
      // Se sale de la app a la pantalla de Google. En la misma pestaña y no en
      // otra: una ventana nueva se pierde detrás y la vuelta aterrizaría en una
      // pestaña que no es en la que estabas.
      window.location.href = data.url as string
    } catch {
      toast.error('No hemos podido empezar la conexión. Inténtalo otra vez.')
      setYendo(false)
    }
  }

  const desconectar = async () => {
    if (!company?.id) return
    setYendo(true)
    try {
      const { error } = await supabase.functions.invoke('google-calendar', {
        body: { accion: 'desconectar', companyId: company.id },
      })
      if (error) throw error
      setConexion({ conectado: false })
      setConfirmando(false)
      toast.success('Calendario desconectado.')
    } catch {
      toast.error('No se ha podido desconectar.')
    } finally {
      setYendo(false)
    }
  }

  if (cargando) return null
  if (!configurado && !demo) return null

  return (
    <section className="rounded-xl filo bg-white p-4 shadow-card sm:p-5">
      <h2 className="text-[15px] font-semibold text-slate-900">Tu calendario</h2>
      <p className="mt-0.5 text-[13px] text-slate-500">
        Conéctalo y te avisaremos si citas a alguien a una hora que ya tienes ocupada.
        Las entrevistas que confirmes aparecerán en él.
      </p>

      {demo ? (
        <p className="mt-4 text-[13px] text-slate-600">
          En esta demostración no se conecta ninguna cuenta.
        </p>
      ) : conexion.conectado ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Check className="size-4 text-green-600" aria-hidden />
            <span className="text-[14px] text-slate-900">
              Conectado con <span className="font-medium">{conexion.cuenta || 'tu cuenta de Google'}</span>
            </span>
            {conexion.desde && (
              <span className="text-[13px] text-slate-500">· {relativeDate(conexion.desde)}</span>
            )}
          </div>

          {conexion.error && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-red-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {/* No se pinta el mensaje de Google: es nuestro, no suyo. Lo que
                  hace falta saber es que hay que volver a dar permiso. */}
              Google ha dejado de darnos acceso. Vuelve a conectarlo.
            </p>
          )}

          {/* Se confirma EN LA PROPIA FILA y no en un diálogo encima: esto vive
              dentro de Ajustes y dos capas apiladas se pelean por el Escape. */}
          {confirmando ? (
            <div className="mt-3 rounded-xl filo bg-slate-50 p-3">
              <p className="text-[13px] text-slate-700">
                Dejaremos de leer tus horas ocupadas y de crear los eventos. Las entrevistas
                siguen en el panel, y lo que ya está en tu calendario se queda.
              </p>
              <div className="mt-2.5 flex gap-2">
                {/* Sin rojo: desconectar es reversible y no borra nada. El rojo
                    de esta casa avisa de un error o de algo que no se deshace. */}
                <button type="button" onClick={() => void desconectar()} disabled={yendo} className={BTN_PRIMARY_SM}>
                  {yendo ? 'Desconectando...' : 'Desconectar'}
                </button>
                <button type="button" onClick={() => setConfirmando(false)} className={BTN_SECONDARY_SM}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className={`${BTN_SECONDARY_SM} mt-3`}>
              Desconectar
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => void conectar()} disabled={yendo} className={`${BTN_SECONDARY} mt-4`}>
          {yendo ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Calendar className="size-4" aria-hidden />}
          Conectar Google Calendar
        </button>
      )}
    </section>
  )
}

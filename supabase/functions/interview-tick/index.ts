// El latido de la cola de entrevistas. verify_jwt = false.
//
// Reclama trabajos vencidos, los ejecuta y los cierra. Lo llama pg_cron cada
// minuto (suelo) y también, al instante, cualquier sitio que acabe de encolar
// algo urgente: con el cron como único disparador, pulsar un botón costaría
// hasta 60 segundos mirando una pantalla quieta.
//
// Autorización por secreto compartido y FAIL-CLOSED: sin INTERVIEW_TICK_SECRET
// no atiende a nadie. Es una función sin JWT que escribe en el calendario de una
// persona; dejarla abierta "mientras tanto" es como se regalan los accesos.
//
// Todo lo que hace es idempotente o está deduplicado en la base, así que dos
// ticks solapados no duplican trabajo: `claim_interview_jobs` les reparte
// conjuntos disjuntos.
//
// AQUÍ VIVÍA TAMBIÉN EL AGENTE DE WHATSAPP, que era quien hablaba con el
// candidato para cuadrar la cita. Se retiró en sep 2026 y con él sus trabajos de
// canal; queda la sincronización con Google Calendar, que es lo que le dio a
// esta cola su segundo inquilino. NO MANDA NI UN CORREO, y eso no cambia.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, INTERVIEW_TICK_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { sincronizarCalendario } from '../_shared/google/sync.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const TICK_SECRET = Deno.env.get('INTERVIEW_TICK_SECRET') ?? ''

// Lo que devuelve `claim_interview_jobs`. Trae más columnas de las que se leen
// (`conversation_id`, `agent_epoch`) porque eran del agente retirado y la tabla
// las conserva; declarar solo lo que se usa evita que parezcan vivas.
interface Job {
  id: number
  kind: string
  company_id: string | null
  interview_id: string | null
  payload: Record<string, unknown>
  attempts: number
}

// Comparación en tiempo constante: comparar secretos con === filtra su longitud
// y su prefijo por el tiempo de respuesta.
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

// ---------------------------------------------------------------------------
// Los trabajos que solo saben decir "va" o "no va"
// ---------------------------------------------------------------------------
// El calendario del anfitrión no entra aquí: devuelve tres respuestas (hecho /
// obsoleto / fallo) y se resuelve abajo.
//
// EL RESTO DE `kind` QUE LA BASE SIGUE ADMITIENDO YA NO SE ENCOLA: eran los del
// agente de WhatsApp (retirado en sep 2026) y los avisos por correo (retirados
// antes). Los que quedaran en cola de un despliegue anterior NO son un fallo, ya
// no proceden: se cancelan con su motivo en vez de reintentarse seis veces
// contra un canal que no existe.

const RETIRADOS = 'el trabajo ya no existe (asistente de WhatsApp retirado)'

async function ejecutar(job: Job): Promise<'hecho' | 'obsoleto'> {
  switch (job.kind) {
    case 'marcar_realizada': {
      if (!job.interview_id) return 'hecho'
      const { error } = await admin.rpc('interview_mark_done', { p_interview: job.interview_id })
      if (error) throw new Error(`interview_mark_done: ${error.message}`)
      return 'hecho'
    }

    default:
      return 'obsoleto'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!TICK_SECRET) return json({ error: 'Latido sin configurar' }, 503)
  if (!igualSeguro(req.headers.get('x-interview-tick-secret') ?? '', TICK_SECRET)) {
    return json({ error: 'No autorizado' }, 401)
  }

  const { data, error } = await admin.rpc('claim_interview_jobs', { p_limit: 25 })
  if (error) return json({ error: error.message }, 500)
  const jobs = (data ?? []) as Job[]

  let ok = 0
  let fallidos = 0
  let cancelados = 0
  // En serie y no en paralelo: son pocos y tocan la misma conversación con
  // frecuencia. Paralelizar aquí solo compraría carreras que luego hay que
  // arbitrar, y el trabajo que sobra espera al tick siguiente, que es dentro
  // de un minuto.
  for (const job of jobs) {
    try {
      if (job.kind === 'sincronizar_calendario') {
        if (!job.interview_id) {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: 'sin entrevista' })
          cancelados++
          continue
        }
        const r = await sincronizarCalendario(admin, job.interview_id)
        if (r.tipo === 'hecho') {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
          ok++
        } else if (r.tipo === 'obsoleto') {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: r.motivo })
          cancelados++
        } else {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: false, p_error: r.motivo })
          fallidos++
        }
        continue
      }

      if (await ejecutar(job) === 'obsoleto') {
        await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: RETIRADOS })
        cancelados++
        continue
      }
      await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
      ok++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: false, p_error: msg })
      fallidos++
      console.error(`[interview-tick] ${job.kind}#${job.id}: ${msg}`)
    }
  }

  return json({ ok: true, reclamados: jobs.length, hechos: ok, cancelados, fallidos })
})

// El latido de la cola de entrevistas. verify_jwt = false.
//
// Reclama trabajos vencidos, los ejecuta y los cierra. Lo llama pg_cron cada
// minuto (suelo) y también, al instante, cualquier sitio que acabe de encolar
// algo urgente: con el cron como único disparador, pulsar un botón costaría
// hasta 60 segundos mirando una pantalla quieta.
//
// Autorización por secreto compartido y FAIL-CLOSED: sin INTERVIEW_TICK_SECRET
// no atiende a nadie. Es una función sin JWT que escribe a personas por
// WhatsApp; dejarla abierta "mientras tanto" es exactamente como se regalan los
// envíos.
//
// Todo lo que hace es idempotente o está deduplicado en la base, así que dos
// ticks solapados no duplican trabajo: `claim_interview_jobs` les reparte
// conjuntos disjuntos.
//
// NO MANDA NI UN CORREO, y es a propósito (Mario, agosto de 2026): durante el
// proceso de cuadrar una entrevista, todo lo que pasa se ve en la conversación
// del candidato. Los recordatorios pasaron a ser un WhatsApp al candidato (los
// lleva el agente) y los avisos de "esto lo tienes que mirar tú" se quedan en
// la propia conversación, marcada y con su motivo. Un correo por cada duda de
// cada candidato convierte el producto en una fuente de ruido.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, INTERVIEW_TICK_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { ejecutarTrabajoDeCanal, TRABAJOS_DE_CANAL, type Job as JobCanal } from '../_shared/whatsapp/agente.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const TICK_SECRET = Deno.env.get('INTERVIEW_TICK_SECRET') ?? ''

interface Job {
  id: number
  kind: string
  company_id: string | null
  interview_id: string | null
  conversation_id: string | null
  agent_epoch: number | null
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
// Los trabajos que no son de canal
// ---------------------------------------------------------------------------
// Queda uno solo. Todo lo demás o le habla al candidato (y lo lleva el agente)
// o desapareció con los correos.

async function ejecutar(job: Job): Promise<void> {
  switch (job.kind) {
    case 'marcar_realizada': {
      if (!job.interview_id) return
      const { error } = await admin.rpc('interview_mark_done', { p_interview: job.interview_id })
      if (error) throw new Error(`interview_mark_done: ${error.message}`)
      return
    }

    // Los avisos por correo se retiraron. Los que quedaran en cola de antes del
    // despliegue no son un fallo: ya no proceden, y la conversación que los
    // originó lleva su marca desde el momento en que se escaló.
    case 'avisar_intervencion': return

    default:
      throw new Error(`Trabajo no soportado: ${job.kind}`)
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
      if (TRABAJOS_DE_CANAL.has(job.kind)) {
        // El agente decide él si procede, porque solo él tiene el contexto
        // (epoch, ventana de 24 h, baja, estado del puesto).
        const r = await ejecutarTrabajoDeCanal(job as unknown as JobCanal)
        if (r.tipo === 'hecho') {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
          ok++
        } else if (r.tipo === 'obsoleto') {
          // Ni éxito ni fallo: dejó de proceder. Se cancela, y queda dicho por qué.
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: r.motivo })
          cancelados++
        } else if (r.tipo === 'intervencion') {
          if (job.conversation_id) {
            await admin.rpc('escalar_conversacion', {
              p_conversation: job.conversation_id, p_motivo: r.motivo,
            })
          }
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: r.motivo })
          cancelados++
        } else {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: false, p_error: r.motivo })
          fallidos++
        }
        continue
      }

      await ejecutar(job)
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

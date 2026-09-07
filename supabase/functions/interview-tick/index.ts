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
// canal; quedan la sincronización con Google Calendar y, desde sep 2026, el
// TRIAJE y el AVISO de una candidatura que acaba de entrar.
//
// ESTE TICK NO ESCRIBE UN CORREO, LO PIDE. Hasta sep 2026 aquí no había ni un
// aviso, y ahora `avisar_candidatura` invoca a `notify-new-candidate`: la
// diferencia importa y por eso se escribe. Quien compone el correo, quien mira
// los dos interruptores y quien reclama para no duplicarlo sigue siendo ESA
// función, la única puerta de salida de ese canal; el tick solo llama a la
// puerta y reintenta si no abre. Ningún trabajo de esta cola redacta ni envía
// nada por su cuenta, y eso sí que no cambia.
//
// Secrets: SUPABASE_SERVICE_ROLE_KEY, INTERVIEW_TICK_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { sincronizarCalendario } from '../_shared/google/sync.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const TICK_SECRET = Deno.env.get('INTERVIEW_TICK_SECRET') ?? ''

/**
 * CUÁNTOS ANÁLISIS COMO MUCHO EN UN TICK. Un triaje son cuatro llamadas
 * encadenadas a OpenAI más la visión del CV: decenas de segundos cada uno.
 * Ejecutando los veinticinco que se pueden reclamar, el tick se comería su
 * propio tiempo de vida y moriría a mitad, y entonces el segador devolvería a
 * la cola trabajos que en realidad estaban corriendo.
 *
 * Los que sobran NO se dejan colgando esperando al segador (dos minutos de
 * retraso y un intento gastado): se devuelven a la cola en el acto con
 * `release_interview_jobs`, que además les descuenta el intento que el reparto
 * ya les había sumado. Los coge el tick siguiente, que en producción es
 * enseguida (el cron va a diez segundos, medido), así que la tarde de
 * veinticinco candidaturas de un anuncio de peón se digiere sola.
 *
 * LO QUE ESTE TOPE ACOTA ES LA DURACIÓN DE UN TICK, NO CUÁNTOS ANÁLISIS HAY EN
 * MARCHA: con el cron a diez segundos, varios ticks se solapan y cada uno coge
 * su propio puñado (`for update skip locked` les reparte conjuntos disjuntos).
 * Eso es lo que se quiere: la ráfaga avanza en paralelo sin que ningún tick se
 * pase de largo. El gasto no cambia, porque esas candidaturas se iban a
 * analizar igual.
 */
const MAX_ANALISIS = 3

/**
 * Un análisis puede tardar más que el arriendo de dos minutos de fábrica, y un
 * arriendo que vence mientras el trabajo corre es el segador devolviendo a la
 * cola algo que está en marcha. Cinco minutos cubren `MAX_ANALISIS` análisis
 * lentos; lo que se paga es que un tick que muera de verdad tarda ese rato en
 * rescatarse, y ninguno de los otros trabajos de esta cola es urgente al
 * minuto.
 */
const ARRIENDO = '5 minutes'

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

/**
 * El triaje de una candidatura que acaba de entrar.
 *
 * LA ADUANA ES `analyze-candidate` Y AQUÍ NO SE DUPLICA NINGUNA DE SUS GUARDAS:
 * el plan, el interruptor de Ajustes, la idempotencia, la clave de OpenAI y el
 * reclamo atómico se comprueban allí, que es donde se comprobaban cuando
 * llamaba el navegador. Lo que esta cola añade es lo que faltaba: que alguien
 * lo reintente.
 *
 * `auto: true` porque lo dispara la LLEGADA de la candidatura y no una persona:
 * es lo único que el interruptor "Analizar cada candidatura al entrar" puede
 * apagar (analizar una ficha a mano siempre se puede, o su botón mentiría).
 */
async function analizarCandidato(job: Job): Promise<{ tipo: 'hecho' } | { tipo: 'obsoleto'; motivo: string }> {
  const id = typeof job.payload?.candidate_id === 'string' ? job.payload.candidate_id : null
  if (!id) return { tipo: 'obsoleto', motivo: 'sin candidato' }

  const { data, error } = await admin.functions.invoke('analyze-candidate', {
    body: { candidate_id: id, auto: true },
  })
  if (error) throw new Error(`analyze-candidate: ${await detalle(error)}`)

  const r = (data ?? {}) as { analyzed?: boolean; skipped?: string; error?: string }
  if (r.analyzed) return { tipo: 'hecho' }

  // UN FALLO DEL MODELO VIENE EN UN 200, y por eso hay que mirarlo a mano: la
  // función responde `{ analyzed: false, error: 'fallo del modelo' }` y deja el
  // error escrito en la ficha para que se pueda reintentar a mano. Cancelarlo
  // aquí sería no reintentarlo NUNCA, o sea que un 429 pasajero de OpenAI
  // dejaría esa candidatura sin lectura para siempre: justo el agujero que esta
  // cola vino a tapar. Se cazó probándolo en local con una clave inválida.
  if (r.error) throw new Error(r.error)

  // "EN CURSO" SE REINTENTA, NO SE CANCELA, y es la diferencia entre una
  // candidatura analizada y una que se queda a oscuras para siempre. Un reclamo
  // puede seguir puesto porque una persona lo esté analizando desde su ficha
  // (entonces el reintento verá el análisis hecho y cerrará), pero también
  // porque la función anterior murió a mitad y lo dejó huérfano. El backoff de
  // la cola (20 s, 1 min, 3 min, 9 min…) pasa de los cinco minutos del reclamo
  // en el cuarto intento, así que los dos casos convergen solos.
  if (r.skipped === 'análisis en curso') throw new Error(r.skipped)

  // Un motivo CONOCIDO no es un fallo, es que no procede: sin plan, con el
  // triaje automático apagado en Ajustes, ya analizado, sin clave de OpenAI, o
  // el candidato ya no está. Se cancela CON EL MOTIVO, que es lo que deja
  // escrito por qué esa candidatura no tiene lectura.
  if (r.skipped) return { tipo: 'obsoleto', motivo: r.skipped }

  // Y lo que no se sabe qué es, se reintenta. Cancelar por defecto es dar por
  // buena una respuesta que no entendemos, y aquí el precio de equivocarse es
  // una candidatura que nadie lee.
  throw new Error('respuesta inesperada de analyze-candidate')
}

/**
 * El aviso por correo de una candidatura que acaba de entrar.
 *
 * LA ADUANA ES `notify-new-candidate` Y AQUÍ NO SE DUPLICA NINGUNA DE SUS
 * GUARDAS: el interruptor del puesto (`notify_new`), el de la persona
 * (`email_prefs`) y el reclamo atómico que impide el correo duplicado se
 * comprueban allí, que es donde se comprobaban cuando llamaba el navegador. Lo
 * que esta cola añade es lo que faltaba: que alguien lo reintente.
 *
 * NO MANDA EL CORREO: lo manda la función. Que este tick siga sin escribirle a
 * nadie por su cuenta es lo que mantiene una sola puerta de salida por canal.
 */
async function avisarCandidatura(job: Job): Promise<{ tipo: 'hecho' } | { tipo: 'obsoleto'; motivo: string }> {
  const id = typeof job.payload?.candidate_id === 'string' ? job.payload.candidate_id : null
  if (!id) return { tipo: 'obsoleto', motivo: 'sin candidato' }

  const { data, error } = await admin.functions.invoke('notify-new-candidate', {
    body: { candidate_id: id },
  })
  if (error) throw new Error(`notify-new-candidate: ${await detalle(error)}`)

  const r = (data ?? {}) as { sent?: boolean; skipped?: string; error?: string }
  if (r.sent) return { tipo: 'hecho' }

  // Un fallo del proveedor puede venir en un 200 según por dónde salga, así que
  // se mira a mano igual que en el triaje: reintentar es lo correcto porque la
  // función SUELTA su reclamo cuando Resend rechaza, o sea que el reintento
  // vuelve a intentar el envío de verdad en vez de encontrarse "ya notificado".
  if (r.error) throw new Error(r.error)

  // Un motivo CONOCIDO no es un fallo, es que no procede: el puesto tiene los
  // avisos apagados, el dueño no quiere este correo en su bandeja, el candidato
  // ya no está, o ya se avisó. Se cancela CON EL MOTIVO, que es lo que deja
  // escrito por qué esa candidatura no generó aviso.
  if (r.skipped) return { tipo: 'obsoleto', motivo: r.skipped }

  // Y lo que no se sabe qué es, se reintenta. Cancelar por defecto es dar por
  // buena una respuesta que no entendemos, y aquí el precio de equivocarse es
  // una empresa que no se entera de que tiene gente esperando.
  throw new Error('respuesta inesperada de notify-new-candidate')
}

/** El cuerpo de un error de `functions.invoke` no viaja en `message` ("non-2xx
 *  status code"), y sin él `last_error` no dice nada de por qué falló. */
async function detalle(error: unknown): Promise<string> {
  const base = error instanceof Error ? error.message : String(error)
  const ctx = (error as { context?: unknown }).context
  if (ctx instanceof Response) {
    try {
      const t = (await ctx.text()).slice(0, 300)
      if (t) return `${base} — ${t}`
    } catch { /* el cuerpo ya se consumió o no es texto: con el mensaje basta */ }
  }
  return base
}

/** Borra del bucket, en tandas: `remove` con cientos de rutas es una sola
 *  petición grande, y una que falle se llevaría a todas por delante. */
async function borrarDelBucket(rutas: string[]): Promise<number> {
  let borradas = 0
  for (let i = 0; i < rutas.length; i += 100) {
    const tanda = rutas.slice(i, i + 100)
    const { data, error } = await admin.storage.from('cvs').remove(tanda)
    if (error) throw new Error(`storage.remove: ${error.message}`)
    borradas += data?.length ?? 0
  }
  return borradas
}

/**
 * LOS FICHEROS DE UNA CANDIDATURA ELIMINADA, pasada la ventana de deshacer.
 *
 * El trigger de la base encola este trabajo con las rutas al borrar la fila,
 * quince minutos más tarde. Antes de borrar se pregunta a la base qué rutas
 * siguen en uso: una candidatura deshecha vuelve con su mismo cv_path, y ese
 * fichero tiene que quedarse. Lo demás se va.
 */
async function purgarFicheros(job: Job): Promise<{ tipo: 'hecho' } | { tipo: 'obsoleto'; motivo: string }> {
  const rutas = Array.isArray(job.payload?.rutas)
    ? (job.payload.rutas as unknown[]).filter((r): r is string => typeof r === 'string' && r !== '')
    : []
  if (!rutas.length) return { tipo: 'obsoleto', motivo: 'sin rutas' }
  const { data: enUso, error } = await admin.rpc('rutas_en_uso', { p_rutas: rutas })
  if (error) throw new Error(`rutas_en_uso: ${error.message}`)
  const ocupadas = new Set((enUso as string[] | null) ?? [])
  const borrar = rutas.filter((r) => !ocupadas.has(r))
  if (borrar.length) await borrarDelBucket(borrar)
  return { tipo: 'hecho' }
}

/**
 * LA PURGA DIARIA: candidaturas de procesos cerrados hace más de los meses que
 * la empresa haya puesto en Ajustes, y ficheros huérfanos del bucket.
 *
 * Por lotes y con los FICHEROS ANTES QUE LAS FILAS: si el borrado del bucket
 * falla, la fila sigue existiendo y el intento siguiente vuelve a encontrarla;
 * al revés, un fichero sin fila es justo el huérfano que el barrido tiene que
 * perseguir. Si el lote sale lleno, se encola una continuación para dentro de
 * un minuto en vez de comerse el tick entero.
 */
async function purgarCandidatos(): Promise<{ tipo: 'hecho' }> {
  const LOTE = 100
  const { data, error } = await admin.rpc('purga_candidatos_pendientes', { p_limit: LOTE })
  if (error) throw new Error(`purga_candidatos_pendientes: ${error.message}`)
  const pendientes = (data as { id: string; company_id: string; rutas: string[] | null }[] | null) ?? []
  if (pendientes.length) {
    const rutas = pendientes.flatMap((p) => p.rutas ?? [])
    if (rutas.length) await borrarDelBucket(rutas)
    const { data: n, error: e2 } = await admin.rpc('purga_candidatos_borrar', { p_ids: pendientes.map((p) => p.id) })
    if (e2) throw new Error(`purga_candidatos_borrar: ${e2.message}`)
    console.log(`[interview-tick] purga: ${n ?? 0} candidaturas, ${rutas.length} ficheros`)
  }
  if (pendientes.length === LOTE) {
    await admin.rpc('enqueue_interview_job', {
      p_kind: 'purgar_candidatos',
      p_payload: {},
      p_run_at: new Date(Date.now() + 60_000).toISOString(),
      p_dedupe_key: `purga:cont:${Date.now()}`,
    })
  }
  const { data: huerfanos, error: e3 } = await admin.rpc('documentos_huerfanos', { p_limit: 500 })
  if (e3) throw new Error(`documentos_huerfanos: ${e3.message}`)
  const lista = (huerfanos as string[] | null) ?? []
  if (lista.length) {
    await borrarDelBucket(lista)
    console.log(`[interview-tick] purga: ${lista.length} ficheros huérfanos`)
  }
  return { tipo: 'hecho' }
}

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

  const { data, error } = await admin.rpc('claim_interview_jobs', { p_limit: 25, p_lease: ARRIENDO })
  if (error) return json({ error: error.message }, 500)
  const jobs = (data ?? []) as Job[]

  let ok = 0
  let fallidos = 0
  let cancelados = 0
  let analisis = 0
  const aplazados: number[] = []

  // LO RÁPIDO PRIMERO, Y ESO NO ES UNA OPTIMIZACIÓN: es lo que impide que un
  // correo espere detrás de un modelo de lenguaje. `claim_interview_jobs`
  // reparte por `run_at`, así que una candidatura que entra encola su análisis y
  // su aviso con la misma hora y el análisis sale antes (se encola primero, así
  // que tiene id menor). Ejecutándolos en ese orden, el aviso de una tanda con
  // tres análisis por delante sale del orden del MINUTO en vez de al instante
  // (un triaje son cuatro llamadas encadenadas a OpenAI), y si el tick muere por
  // el camino se queda esperando los cinco minutos del arriendo.
  //
  // Un aviso es un POST a Resend: décimas de segundo. Puestos delante, los
  // correos salen ya y los análisis no pierden nada, porque los que no quepan se
  // devuelven a la cola igual que antes.
  const LENTOS = new Set(['analizar_candidato'])
  jobs.sort((a, b) => Number(LENTOS.has(a.kind)) - Number(LENTOS.has(b.kind)))
  // En serie y no en paralelo: son pocos y tocan la misma conversación con
  // frecuencia. Paralelizar aquí solo compraría carreras que luego hay que
  // arbitrar, y el trabajo que sobra espera al tick siguiente, que es dentro
  // de un minuto.
  for (const job of jobs) {
    try {
      if (job.kind === 'analizar_candidato') {
        if (analisis >= MAX_ANALISIS) {
          aplazados.push(job.id)
          continue
        }
        analisis++
        const r = await analizarCandidato(job)
        if (r.tipo === 'hecho') {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
          ok++
        } else {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: r.motivo })
          cancelados++
        }
        continue
      }

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

      if (job.kind === 'avisar_candidatura') {
        const r = await avisarCandidatura(job)
        if (r.tipo === 'hecho') {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
          ok++
        } else {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: r.motivo })
          cancelados++
        }
        continue
      }

      if (job.kind === 'purgar_ficheros') {
        const r = await purgarFicheros(job)
        if (r.tipo === 'hecho') {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
          ok++
        } else {
          await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: null, p_error: r.motivo })
          cancelados++
        }
        continue
      }

      if (job.kind === 'purgar_candidatos') {
        await purgarCandidatos()
        await admin.rpc('finish_interview_job', { p_id: job.id, p_ok: true })
        ok++
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

  // Lo que no cupo en este tick vuelve a la cola sin gastar intento: lo coge el
  // de dentro de un minuto.
  if (aplazados.length) {
    await admin.rpc('release_interview_jobs', { p_ids: aplazados })
  }

  return json({ ok: true, reclamados: jobs.length, hechos: ok, cancelados, fallidos, aplazados: aplazados.length })
})

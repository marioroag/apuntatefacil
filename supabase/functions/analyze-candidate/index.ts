// Meridian: triaje de una candidatura con IA (OpenAI), en TRIADA (ago 2026):
//
//   1. BAREMO del puesto: se genera UNA vez (título + sector + ubicación +
//      preguntas del formulario) y se persiste en campaigns.baremo, para que
//      todos los candidatos de un proceso se midan con la misma vara. Se
//      regenera solo si el puesto cambia (hash).
//   2. EVALUADOR: juzga la candidatura criterio a criterio, con EVIDENCIA
//      citada. Sin evidencia no hay juicio: solo no_consta.
//   3. JUEZ: verifica al evaluador contra la candidatura. Solo puede REBAJAR
//      la aserción (nunca subirla ni inventar un negativo) y quitar puntos a
//      favor/confirmar sin sustento. Lo hace cumplir el código (fusionarJuicio).
//
// El modelo NUNCA pone el número: la agregación (pesos por nivel, sin ninguna
// categoría eliminatoria, y no_consta fuera del denominador) vive en
// _shared/triaje.ts y la calcula el código. Resultado en candidates.ai.
//
// Lo invoca el formulario público al entrar la candidatura (verify_jwt=false)
// y el panel a demanda. Guardas de coste/abuso (endpoint público):
//  - Solo analiza si la empresa es Pro/Multi (fail-closed, planHasMeridian).
//  - Idempotente: si ya hay un análisis correcto, no vuelve a llamar a OpenAI.
//    Un análisis con `error` sí se puede reintentar.
//  - RECLAMO ATÓMICO en candidates.ai_claimed_at antes de llamar a OpenAI, al
//    estilo de notified_at en notify-new-candidate: dos invocaciones a la vez
//    no pueden pagar dos análisis. El reclamo caduca (CLAIM_TTL_MS) para que
//    una función que se muera a mitad no deje la candidatura bloqueada.
//  - Sin OPENAI_API_KEY: no-op silencioso (listo para enchufar la clave).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_MODEL?
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1'
import { corsHeaders, json } from '../_shared/cors.ts'
import { planHasMeridian } from '../_shared/plans.ts'
import { OPENAI_API_KEY, OPENAI_BASE, OPENAI_MODEL, openaiError, tuning } from '../_shared/openai.ts'
import {
  ESQUEMA_GENERADOR, agregarJuicios, criteriosEfectivos, esquemaEvaluador, esquemaJuez,
  fusionarJuicio, hashPuesto, normalizarJuicios, promptEvaluador, promptGenerador, promptJuez,
  sanearCriterios, soloConservados,
  type Baremo, type Juicio, type Valor,
} from '../_shared/triaje.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const MAX_CV_CHARS = 15000
/** Un análisis nunca debería tardar tanto: pasado esto, el reclamo se considera muerto. */
const CLAIM_TTL_MS = 5 * 60 * 1000

type Answers = Record<string, string | string[] | boolean>
type Field = { id: string; label: string; type: string; required?: boolean; options?: string[] }

// Texto plano de una respuesta, para el prompt.
function answerLine(v: Answers[string] | undefined): string {
  if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return '(sin dato)'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// Descarga el CV del bucket privado y extrae su texto. Solo PDF; otros formatos
// (doc/docx) se analizan sin CV (honestidad: no fingimos leer lo que no leemos).
async function cvText(cvPath: string | null): Promise<string | null> {
  if (!cvPath) return null
  if (!cvPath.toLowerCase().endsWith('.pdf')) return null
  try {
    const { data, error } = await admin.storage.from('cvs').download(cvPath)
    if (error || !data) return null
    const buf = new Uint8Array(await data.arrayBuffer())
    const pdf = await getDocumentProxy(buf)
    const { text } = await extractText(pdf, { mergePages: true })
    const joined = Array.isArray(text) ? text.join('\n') : String(text ?? '')
    return joined.slice(0, MAX_CV_CHARS).trim() || null
  } catch (_e) {
    return null
  }
}

/** Tipos de campo que NUNCA salen hacia el modelo. Espejo de meridian-chat. */
const PRIVATE_FIELD_TYPES = new Set(['email', 'phone', 'tel', 'file'])

/** Una llamada con structured output. Las tres piezas de la triada pasan por aquí. */
async function chatJSON(system: string, user: string, json_schema: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      ...tuning(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema },
    }),
  })
  if (!res.ok) throw openaiError(res.status, await res.text())
  const body = await res.json()
  const content = body?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI sin contenido')
  return JSON.parse(content)
}

/**
 * Baremo vigente del puesto: el persistido si su hash coincide, o uno recién
 * generado. Al persistir, el PRIMER escritor gana (update condicional): si otro
 * análisis lo guardó mientras generábamos, se relee y se usa el suyo, para que
 * dos candidatos simultáneos no se midan con dos varas distintas.
 */
async function baremoDelPuesto(
  campaignId: string,
  camp: { title: string; sector: string; location: string },
  fields: Field[],
  actual: Baremo | null,
  hash: string,
): Promise<Baremo> {
  if (actual && actual.hash === hash && Array.isArray(actual.criterios)) return actual
  const tieneCampoCv = fields.some((f) => f.type === 'file')
  const prompt = promptGenerador({
    title: camp.title,
    sector: camp.sector,
    location: camp.location,
    // Al generador no le hacen falta los campos de contacto ni el adjunto en sí
    // (la posibilidad de CV viaja aparte), igual que al evaluador.
    fields: fields.filter((f) => !PRIVATE_FIELD_TYPES.has(f.type)),
    tieneCampoCv,
  })
  const out = await chatJSON(prompt.system, prompt.user, ESQUEMA_GENERADOR)
  const criterios = sanearCriterios(Array.isArray(out.criterios) ? out.criterios : [])
  const nuevo: Baremo = {
    version: 1, hash, criterios, model: OPENAI_MODEL, generadoAt: new Date().toISOString(),
  }
  await admin
    .from('campaigns')
    .update({ baremo: nuevo })
    .eq('id', campaignId)
    .or(`baremo.is.null,baremo->>hash.neq.${hash}`)
  const { data: relee } = await admin.from('campaigns').select('baremo').eq('id', campaignId).single()
  const stored = relee?.baremo as Baremo | null
  return stored && stored.hash === hash && Array.isArray(stored.criterios) ? stored : nuevo
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // `auto` = lo dispara la llegada de la candidatura (formulario público), no
    // una persona. Solo eso lo puede apagar la empresa en Ajustes: analizar UNA
    // ficha a mano siempre se puede, o el botón de su ficha mentiría.
    const { candidate_id, auto } = await req.json()
    if (!candidate_id) return json({ error: 'Falta candidate_id' }, 400)

    const { data: cand } = await admin
      .from('candidates')
      .select('id,campaign_id,company_id,answers,cv_path,ai')
      .eq('id', candidate_id)
      .single()
    if (!cand) return json({ ok: true, analyzed: false, skipped: 'candidato no encontrado' })

    // Gating de plan (fail-closed): la IA es diferenciador de Pro/Multi.
    const { data: comp } = await admin
      .from('companies').select('plan,meridian_auto').eq('id', cand.company_id).single()
    if (!planHasMeridian(comp?.plan)) {
      return json({ ok: true, analyzed: false, skipped: 'plan sin Meridian' })
    }
    // Triaje automático apagado en Ajustes: no se analiza al entrar.
    if (auto === true && comp?.meridian_auto === false) {
      return json({ ok: true, analyzed: false, skipped: 'triaje automático desactivado' })
    }

    // Idempotencia: un análisis correcto ya existente no se repite (no gasta OpenAI).
    // Uno con error sí se puede reintentar.
    const existing = cand.ai as { error?: string } | null
    if (existing && !existing.error) {
      return json({ ok: true, analyzed: true, skipped: 'ya analizado' })
    }

    if (!OPENAI_API_KEY) return json({ ok: true, analyzed: false, skipped: 'sin clave' })

    // Reclamo atómico. Un solo UPDATE condicional decide quién analiza: o el
    // reclamo está libre, o el anterior ya caducó. El segundo invocante no
    // encuentra fila y se va sin gastar nada.
    const now = new Date().toISOString()
    const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
    const { data: claimed, error: claimError } = await admin
      .from('candidates')
      .update({ ai_claimed_at: now })
      .eq('id', candidate_id)
      .or(`ai_claimed_at.is.null,ai_claimed_at.lt.${staleBefore}`)
      .select('id')
    if (claimError) {
      // Un 42501 aquí significa que falta el grant de service_role sobre la
      // columna (migración 20260725100000). Es preferible fallar ruidosamente
      // a analizar y luego no poder guardar nada.
      return json({ error: `No se pudo reclamar el análisis: ${claimError.message}` }, 500)
    }
    if (!claimed || claimed.length === 0) {
      return json({ ok: true, analyzed: false, skipped: 'análisis en curso' })
    }

    const { data: camp } = await admin
      .from('campaigns').select('title,sector,location,fields,baremo').eq('id', cand.campaign_id).single()
    if (!camp) {
      await admin.from('candidates').update({ ai_claimed_at: null }).eq('id', candidate_id)
      return json({ ok: true, analyzed: false, skipped: 'puesto no encontrado' })
    }
    const fields = (camp.fields ?? []) as Field[]
    const answers = (cand.answers ?? {}) as Answers

    const cv = await cvText(cand.cv_path)

    // Minimización: al modelo no le hace falta saber el correo ni el teléfono
    // para juzgar experiencia o disponibilidad, así que no salen de aquí. Es el
    // mismo criterio que aplica `meridian-chat` en tools.ts.
    // (El texto del CV sí va: sin él no se puede valorar la experiencia. Suele
    // llevar datos de contacto dentro y eso hay que declararlo en la política.)
    const respuestas = fields
      .filter((f) => !PRIVATE_FIELD_TYPES.has(f.type))
      .map((f) => `- ${f.label}: ${answerLine(answers[f.id])}`)
      .join('\n')

    // "No adjuntó CV" y "adjuntó uno que no puedo leer" no son lo mismo, y
    // confundirlos hacía que Meridian dijera "el CV adjunto no es legible" de
    // alguien que nunca adjuntó nada.
    const cvNota = cv
      ? `Texto del CV adjunto:\n${cv}\n`
      : cand.cv_path
        ? 'Adjuntó un CV pero no he podido extraer su texto. No supongas nada sobre lo que ponga.\n'
        : 'No adjuntó CV. Valora solo con las respuestas del formulario, y no menciones el CV.\n'
    const puesto =
      `${camp.title ?? ''} (${camp.sector ?? ''}${camp.location ? ', ' + camp.location : ''})`

    // Guardar SIEMPRE libera el reclamo, para que un error pueda reintentarse
    // desde el panel sin esperar a que caduque.
    const store = async (ai: Record<string, unknown>) => {
      const { error } = await admin
        .from('candidates')
        .update({ ai, ai_claimed_at: null })
        .eq('id', candidate_id)
      return error
    }

    try {
      // --- Pieza 1: el baremo del puesto (persistido; misma vara para todos). ---
      // El hash cubre TODOS los campos: cualquier cambio del formulario (también
      // añadir el adjunto de CV, que amplía qué criterios son posibles) regenera.
      const hash = await hashPuesto({
        title: String(camp.title ?? ''),
        sector: String(camp.sector ?? ''),
        location: String(camp.location ?? ''),
        fields,
      })
      const baremo = await baremoDelPuesto(
        cand.campaign_id,
        { title: String(camp.title ?? ''), sector: String(camp.sector ?? ''), location: String(camp.location ?? '') },
        fields,
        (camp.baremo as Baremo | null) ?? null,
        hash,
      )

      // Baremo EFECTIVO para esta candidatura: sin CV posible (ni texto extraído
      // ni campo de adjunto en el formulario), los criterios de CV salen enteros.
      // Al candidato no se le puede penalizar por información que nadie le pidió.
      const cvPosible = !!cv || fields.some((f) => f.type === 'file')
      const efectivos = criteriosEfectivos(baremo.criterios, cvPosible)

      // Un formulario sin nada evaluable produce un análisis honesto sin gastar
      // más llamadas: no hay criterios que juzgar ni número que calcular.
      if (efectivos.length === 0) {
        const writeError = await store({
          summary: 'El formulario de este puesto no tiene preguntas con las que valorar el encaje.',
          highlights: [], concerns: [], fit: 0, criterios: [], baremoHash: hash,
          model: OPENAI_MODEL, analyzedAt: new Date().toISOString(), cvUsed: !!cv,
        })
        if (writeError) return json({ error: `No se pudo guardar el análisis: ${writeError.message}` }, 500)
        return json({ ok: true, analyzed: true })
      }

      // --- Pieza 2: el evaluador, con evidencia obligatoria. ---
      const claves = efectivos.map((c) => c.clave)
      const pe = promptEvaluador({ puesto, criterios: efectivos, respuestas, cvNota })
      const ev = await chatJSON(pe.system, pe.user, esquemaEvaluador(claves))
      let summary = String(ev.summary ?? '').slice(0, 600)
      let highlights = (Array.isArray(ev.highlights) ? ev.highlights : []).map((s) => String(s)).slice(0, 4)
      let concerns = (Array.isArray(ev.concerns) ? ev.concerns : []).map((s) => String(s)).slice(0, 3)
      const brutos: Juicio[] = (Array.isArray(ev.criterios) ? ev.criterios : []).map((c) => {
        const j = c as { clave?: unknown; valor?: unknown; evidencia?: unknown }
        return {
          clave: String(j?.clave ?? ''),
          valor: (['cumple', 'parcial', 'no_consta', 'no_cumple'].includes(String(j?.valor)) ? String(j?.valor) : 'no_consta') as Valor,
          evidencia: String(j?.evidencia ?? ''),
        }
      })
      // Mitad mecánica del juez: un juicio sin evidencia se queda en no_consta,
      // fallen los modelos que fallen.
      let juicios = normalizarJuicios(brutos, new Set(claves))

      // --- Pieza 3: el juez. Solo si hay algo que verificar. ---
      const hayJuicios = juicios.some((j) => j.valor !== 'no_consta')
      if (hayJuicios || highlights.length > 0 || concerns.length > 0) {
        const pj = promptJuez({ puesto, criterios: efectivos, respuestas, cvNota, evaluacion: { summary, highlights, concerns, criterios: juicios } })
        const jz = await chatJSON(pj.system, pj.user, esquemaJuez(claves))
        const veredictos = new Map(
          (Array.isArray(jz.criterios) ? jz.criterios : []).map((c) => {
            const j = c as { clave?: unknown; valor?: unknown }
            return [String(j?.clave ?? ''), String(j?.valor ?? '')] as const
          }),
        )
        juicios = juicios.map((j) => {
          const veredicto = veredictos.get(j.clave)
          const valor = veredicto ? fusionarJuicio(j.valor, veredicto as Valor) : j.valor
          // Si el juez lo bajó a no_consta, la evidencia rechazada no se enseña.
          return valor === 'no_consta' ? { clave: j.clave, valor } : { ...j, valor }
        })
        highlights = soloConservados(highlights, (Array.isArray(jz.a_favor) ? jz.a_favor : []).map(String))
        concerns = soloConservados(concerns, (Array.isArray(jz.a_confirmar) ? jz.a_confirmar : []).map(String))
      }

      // --- El número lo pone el código: pesos por nivel y cobertura. ---
      const { fit } = agregarJuicios(efectivos, juicios)
      const valorDe = new Map(juicios.map((j) => [j.clave, j]))
      const criteriosOut = efectivos.map((c) => {
        const j = valorDe.get(c.clave)
        return {
          clave: c.clave,
          valor: j?.valor ?? 'no_consta',
          nombre: c.nombre,
          nivel: c.nivel,
          ...(j?.evidencia ? { evidencia: j.evidencia } : {}),
        }
      })
      const writeError = await store({
        summary, highlights, concerns, fit,
        criterios: criteriosOut,
        baremoHash: hash,
        model: OPENAI_MODEL, analyzedAt: new Date().toISOString(), cvUsed: !!cv,
      })
      // Sin este chequeo, un 42501 por falta de grant devolvía {analyzed:true}
      // sin haber guardado nada: la interfaz decía "listo" y no había análisis.
      if (writeError) return json({ error: `No se pudo guardar el análisis: ${writeError.message}` }, 500)
      return json({ ok: true, analyzed: true })
    } catch (e) {
      // Guardamos el error para que el panel ofrezca "Volver a analizar".
      await store({
        summary: '', highlights: [], concerns: [], fit: 0,
        model: OPENAI_MODEL, analyzedAt: new Date().toISOString(),
        error: String(e instanceof Error ? e.message : e).slice(0, 300),
      })
      return json({ ok: true, analyzed: false, error: 'fallo del modelo' })
    }
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})

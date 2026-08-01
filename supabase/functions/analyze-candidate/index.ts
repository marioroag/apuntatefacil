// Meridian: triaje de una candidatura con IA (OpenAI).
// Lee las respuestas del formulario + extrae el texto del CV y devuelve
// { summary, highlights[], concerns[], fit } que se guarda en candidates.ai.
// Lo invoca el formulario público al entrar la candidatura (verify_jwt=false) y el
// panel a demanda para candidaturas antiguas. Molde: notify-new-candidate.
//
// Guardas de coste/abuso (endpoint público):
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

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const MAX_CV_CHARS = 15000
/** Un análisis nunca debería tardar tanto: pasado esto, el reclamo se considera muerto. */
const CLAIM_TTL_MS = 5 * 60 * 1000

type Answers = Record<string, string | string[] | boolean>
type Field = { id: string; label: string; type: string }

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

/**
 * Criterios FIJOS del triaje.
 *
 * Antes le pedíamos al modelo una nota de 0 a 100 y la única definición que
 * tenía era "el ajuste al puesto, orientativo". Sin escala ni anclajes, el
 * baremo se lo inventaba en cada llamada: la MISMA candidatura sacaba 83 y al
 * rato 63, y como las bandas están en 70 y 45, hasta la etiqueta cambiaba.
 * Tampoco se puede amortiguar bajando `temperature`: los modelos de
 * razonamiento la rechazan.
 *
 * Así que el modelo ya no puntúa: juzga HECHOS contra criterios siempre
 * iguales, y el número lo calcula el código. Juzgar "¿tiene el carnet?" es
 * mucho más estable que puntuar de 0 a 100, y de paso el ajuste es explicable.
 */
/** Tipos de campo que NUNCA salen hacia el modelo. Espejo de meridian-chat. */
const PRIVATE_FIELD_TYPES = new Set(['email', 'phone', 'tel', 'file'])

const CRITERIOS = [
  { clave: 'experiencia', pregunta: 'Tiene experiencia en un trabajo equivalente al del puesto.' },
  { clave: 'disponibilidad', pregunta: 'Su disponibilidad encaja con lo que pide el puesto (jornada, turnos, incorporación).' },
  { clave: 'desplazamiento', pregunta: 'Puede llegar al centro de trabajo sin problema (cercanía, vehículo propio, carnet si hace falta).' },
  { clave: 'requisitos', pregunta: 'Cumple los requisitos concretos que pide el formulario (carnets, titulaciones, permisos, idiomas).' },
  { clave: 'continuidad', pregunta: 'Su recorrido laboral sugiere continuidad, no cambios muy cortos y constantes.' },
] as const

const VALORES = ['cumple', 'parcial', 'no_consta', 'no_cumple'] as const

/**
 * "no_consta" pesa poco pero NO cero: no saber algo no es lo mismo que no
 * cumplirlo, y al candidato no se le puede penalizar por lo que no se le
 * preguntó. Tampoco puede salir gratis, o quien no contesta nada sacaría un 100.
 */
const PESO: Record<string, number> = { cumple: 1, parcial: 0.6, no_consta: 0.3, no_cumple: 0 }

/** El denominador es SIEMPRE el número de criterios: si falta alguno cuenta como no_consta. */
function fitDeCriterios(criterios: { clave: string; valor: string }[]): number {
  const porClave = new Map(criterios.map((c) => [c.clave, c.valor]))
  const suma = CRITERIOS.reduce((total, c) => total + (PESO[porClave.get(c.clave) ?? 'no_consta'] ?? 0.3), 0)
  return Math.round((suma / CRITERIOS.length) * 100)
}

async function callOpenAI(prompt: { system: string; user: string }): Promise<{
  summary: string; highlights: string[]; concerns: string[]; fit: number
  criterios: { clave: string; valor: string }[]
}> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      ...tuning(),
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'triaje_candidatura',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string', description: 'Resumen de 1 o 2 frases en español.' },
              highlights: { type: 'array', items: { type: 'string' }, description: 'Puntos a favor, 2 a 4, muy cortos.' },
              concerns: { type: 'array', items: { type: 'string' }, description: 'Puntos a confirmar, 0 a 3, muy cortos.' },
              criterios: {
                type: 'array',
                description: 'Un elemento por cada criterio, los cinco, en el mismo orden.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    clave: { type: 'string', enum: CRITERIOS.map((c) => c.clave) },
                    valor: { type: 'string', enum: VALORES },
                  },
                  required: ['clave', 'valor'],
                },
              },
            },
            required: ['summary', 'highlights', 'concerns', 'criterios'],
          },
        },
      },
    }),
  })
  if (!res.ok) throw openaiError(res.status, await res.text())
  const body = await res.json()
  const content = body?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI sin contenido')
  const parsed = JSON.parse(content)
  const criterios = (parsed.criterios ?? [])
    .map((c: { clave?: unknown; valor?: unknown }) => ({ clave: String(c?.clave ?? ''), valor: String(c?.valor ?? '') }))
    .filter((c: { clave: string }) => CRITERIOS.some((def) => def.clave === c.clave))
  return {
    summary: String(parsed.summary ?? '').slice(0, 600),
    highlights: (parsed.highlights ?? []).map((s: unknown) => String(s)).slice(0, 4),
    concerns: (parsed.concerns ?? []).map((s: unknown) => String(s)).slice(0, 3),
    // El modelo NO devuelve el número: lo calculamos aquí a partir de su juicio.
    fit: fitDeCriterios(criterios),
    criterios,
  }
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
      .from('campaigns').select('title,sector,location,fields').eq('id', cand.campaign_id).single()
    const fields = (camp?.fields ?? []) as Field[]
    const answers = (cand.answers ?? {}) as Answers

    const cv = await cvText(cand.cv_path)

    // Minimización: al modelo no le hace falta saber el correo ni el teléfono
    // para juzgar experiencia o disponibilidad, así que no salen de aquí. Es el
    // mismo criterio que aplica `meridian-chat` en tools.ts; antes esta función
    // mandaba todos los campos menos los adjuntos, contacto incluido.
    // (El texto del CV sí va: sin él no se puede valorar la experiencia. Suele
    // llevar datos de contacto dentro y eso hay que declararlo en la política.)
    const respuestas = fields
      .filter((f) => !PRIVATE_FIELD_TYPES.has(f.type))
      .map((f) => `- ${f.label}: ${answerLine(answers[f.id])}`)
      .join('\n')

    const system =
      'Eres Meridian, un asistente de selección de personal. Ayudas a un responsable ' +
      'de contratación a hacer un primer triaje de candidaturas. NO decides ni descartas: ' +
      'resumes y orientas, la persona decide. Escribe en español claro y neutro, sin guion ' +
      'largo. Los "concerns" son puntos a confirmar, nunca un veredicto negativo ni un motivo ' +
      'de descarte. Sé conciso y objetivo, sin inventar datos que no estén en la candidatura.\n\n' +
      'NO puntúas: evalúas estos cinco criterios, siempre los cinco y siempre estos:\n' +
      CRITERIOS.map((c) => `- ${c.clave}: ${c.pregunta}`).join('\n') + '\n\n' +
      'Valores posibles para cada criterio:\n' +
      '- "cumple": la candidatura lo demuestra.\n' +
      '- "parcial": lo cumple a medias o con reservas.\n' +
      '- "no_consta": NO hay información para saberlo. No es un punto negativo, y es lo ' +
      'que debes usar siempre que no tengas el dato: al candidato no se le puede penalizar ' +
      'por algo que nadie le preguntó.\n' +
      '- "no_cumple": la candidatura dice claramente que no.\n\n' +
      'No confundas "no_consta" con "no_cumple". Juzga solo lo que veas escrito.'
    // "No adjuntó CV" y "adjuntó uno que no puedo leer" no son lo mismo, y
    // confundirlos hacía que Meridian dijera "el CV adjunto no es legible" de
    // alguien que nunca adjuntó nada.
    const cvNota = cv
      ? `Texto del CV adjunto:\n${cv}\n`
      : cand.cv_path
        ? 'Adjuntó un CV pero no he podido extraer su texto. No supongas nada sobre lo que ponga.\n'
        : 'No adjuntó CV. Valora solo con las respuestas del formulario, y no menciones el CV.\n'
    const user =
      `Puesto: ${camp?.title ?? ''} (${camp?.sector ?? ''}${camp?.location ? ', ' + camp.location : ''}).\n\n` +
      `Lo que pide el formulario y lo que ha respondido el candidato:\n${respuestas || '(sin respuestas)'}\n\n` +
      cvNota

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
      const out = await callOpenAI({ system, user })
      const writeError = await store({
        ...out, model: OPENAI_MODEL, analyzedAt: new Date().toISOString(), cvUsed: !!cv,
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

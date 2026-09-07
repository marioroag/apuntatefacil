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
// Tras el juez corre el REDACTOR (ago 2026): escribe `informe`, el párrafo en
// prosa que la ficha enseña en vez del desglose criterio a criterio (lo que un
// profesional de selección le diría a su jefe). Solo recibe material ya
// verificado, y si falla el análisis sale sin él.
//
// El CV se lee COMO UN EXPERTO (ago 2026): además de servir de evidencia a los
// criterios, produce TRAYECTORIA (ficha estructurada: empleos, carnets,
// formación; llamada aparte en paralelo con el evaluador, y si falla el
// análisis sale sin ella) y CONTRASTES (contradicciones respuesta-vs-CV, que
// el juez conserva o quita). Cada evidencia declara su FUENTE (respuesta o cv)
// porque el visor de la ficha localiza y subraya las citas del CV en el PDF:
// por eso el prompt exige citas literales y contiguas. Un PDF escaneado sin
// capa de texto pasa por el RESPALDO DE VISIÓN: una llamada previa que manda el
// PDF entero como fichero y devuelve su transcripción (cvLeido: 'vision'); sin
// texto localizable no hay subrayado, pero el análisis funciona. Si el modelo
// no admite ficheros, OPENAI_VISION_MODEL permite usar otro solo para eso; si
// tampoco, se cae al comportamiento de siempre ("no he podido leer el CV").
//
// Lo invoca el formulario público al entrar la candidatura (verify_jwt=false)
// y el panel a demanda. Guardas de coste/abuso (endpoint público):
//  - QUIÉN LLAMA DECIDE QUÉ PUEDE PEDIR (auditoría, sep 2026). Sin sesión solo
//    se admite el disparo automático (`auto: true`), que es el único que
//    respeta el interruptor de Ajustes y la idempotencia; `force` y el análisis
//    manual exigen una persona con sesión que VEA al candidato por RLS. Antes,
//    el navegador del candidato (que recibe su propio id al enviar) podía
//    llamar con `force: true` en bucle y pagar un análisis nuevo por vuelta.
//    El servidor (la cola, con la clave service_role) puede todo.
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
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { getDocumentProxy } from 'npm:unpdf@0.12.1'
import { corsHeaders, json } from '../_shared/cors.ts'
import { planHasMeridian } from '../_shared/plans.ts'
import { PLAZO, plazo } from '../_shared/red.ts'
import { OPENAI_API_KEY, OPENAI_BASE, OPENAI_MODEL, openaiError, tuning } from '../_shared/openai.ts'
import {
  ESQUEMA_GENERADOR, ESQUEMA_INFORME, ESQUEMA_TRAYECTORIA, agregarJuicios, criteriosEfectivos,
  esCvIlegible, esquemaEvaluador, esquemaJuez, filtrarTextoVisible, fusionarJuicio, hashPuesto,
  normalizarJuicios, promptEvaluador, promptGenerador, promptJuez, promptRedactor,
  promptTrayectoria, sanearContrastes, sanearCriterios, sanearInforme, sanearTrayectoria,
  serializarContraste, soloConservados,
  type Baremo, type FuenteJuicio, type ItemTexto, type Juicio, type Valor,
} from '../_shared/triaje.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const MAX_CV_CHARS = 15000
/** Análisis AUTOMÁTICOS que una empresa puede pagar en un día. Un puesto muy
 *  vivo trae decenas; trescientos en un día ya no es un puesto, es un script. */
const MAX_AUTO_POR_DIA = 300

type Quien =
  | { tipo: 'servidor' }
  | { tipo: 'usuario'; cliente: ReturnType<typeof createClient> }
  | { tipo: 'anonimo' }

/** Comparación por huella: el tiempo no depende de en qué byte difieren. */
async function mismoSecreto(a: string, b: string): Promise<boolean> {
  const h = async (t: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))
  const [x, y] = await Promise.all([h(a), h(b)])
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}

/**
 * Quién está llamando, en tres clases. La cola de la base viene con la clave
 * service_role (es el servidor y puede todo). Una persona del panel viene con
 * su sesión: se resuelve con getUser y se le exige, más abajo, que el candidato
 * le sea visible por RLS. Lo demás (el formulario público, la anon key, un
 * script) es anónimo y solo puede pedir el disparo automático.
 */
async function quienLlama(req: Request): Promise<Quien> {
  const cabecera = req.headers.get('Authorization') ?? ''
  const jwt = cabecera.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return { tipo: 'anonimo' }
  if (await mismoSecreto(jwt, SERVICE_ROLE_KEY)) return { tipo: 'servidor' }
  if (!ANON_KEY) return { tipo: 'anonimo' }
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: cabecera } } })
  const { data } = await cliente.auth.getUser(jwt)
  return data?.user?.id ? { tipo: 'usuario', cliente } : { tipo: 'anonimo' }
}
/** Un análisis nunca debería tardar tanto: pasado esto, el reclamo se considera muerto. */
const CLAIM_TTL_MS = 5 * 60 * 1000
/** Modelo SOLO para la transcripción de visión, por si el principal no admite
 *  ficheros como entrada. Sin definir, se usa el mismo. */
const VISION_MODEL = Deno.env.get('OPENAI_VISION_MODEL') ?? OPENAI_MODEL

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
// Devuelve también los bytes: si la capa de texto no da para nada (escaneo), la
// transcripción de visión los necesita, y descargar dos veces sería pagar dos.
//
// La extracción es a mano (getTextContent por página) y no con extractText de
// unpdf, por una razón: cada item pasa por `filtrarTextoVisible` ANTES de
// entrar al texto. Lo que la página no enseña (fuera de caja, cuerpo
// microscópico) no llega a ningún prompt: la IA no se traga texto escondido.
async function cvDescarga(cvPath: string | null): Promise<{ texto: string | null; bytes: Uint8Array | null }> {
  if (!cvPath) return { texto: null, bytes: null }
  if (!cvPath.toLowerCase().endsWith('.pdf')) return { texto: null, bytes: null }
  try {
    const { data, error } = await admin.storage.from('cvs').download(cvPath)
    if (error || !data) return { texto: null, bytes: null }
    const bytes = new Uint8Array(await data.arrayBuffer())
    const pdf = await getDocumentProxy(bytes)
    let texto = ''
    for (let n = 1; n <= pdf.numPages && texto.length < MAX_CV_CHARS; n++) {
      const page = await pdf.getPage(n)
      const contenido = await page.getTextContent()
      const items = (contenido.items as unknown[]).filter(
        (it) => typeof (it as { str?: unknown }).str === 'string',
      ) as ItemTexto[]
      const visibles = filtrarTextoVisible(items, page.view as number[])
      texto += visibles.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n'
    }
    return { texto: texto.slice(0, MAX_CV_CHARS).trim() || null, bytes }
  } catch (_e) {
    return { texto: null, bytes: null }
  }
}

// btoa no traga un Uint8Array grande de una vez (revienta la pila con spread):
// se convierte por tramos. El bucket ya limita el CV a 8 MiB.
function aBase64(bytes: Uint8Array): string {
  let bin = ''
  const TRAMO = 0x8000
  for (let i = 0; i < bytes.length; i += TRAMO) {
    bin += String.fromCharCode(...bytes.subarray(i, i + TRAMO))
  }
  return btoa(bin)
}

const ESQUEMA_TRANSCRIPCION = {
  name: 'transcripcion_cv',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      texto: { type: 'string', description: 'El texto del documento, en orden de lectura.' },
    },
    required: ['texto'],
  },
} as const

/**
 * Respaldo de visión para un PDF sin capa de texto útil (escaneo, foto): se
 * manda el PDF entero como fichero y el modelo lo transcribe. La triada no se
 * entera de nada: recibe texto, como siempre. Si el modelo no admite ficheros
 * (400) o falla, null: se cae al "adjuntó un CV que no puedo leer" de siempre.
 */
async function transcribirCvVision(bytes: Uint8Array): Promise<string | null> {
  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    signal: plazo(PLAZO.modelo),
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        ...tuning({ model: VISION_MODEL }),
        messages: [
          {
            role: 'system',
            content:
              'Transcribes documentos escaneados. Devuelve el texto del documento en orden ' +
              'de lectura, tal cual está escrito, sin inventar, sin resumir y sin corregir ' +
              'erratas. Si una parte no se lee, sáltala.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: { filename: 'cv.pdf', file_data: `data:application/pdf;base64,${aBase64(bytes)}` },
              },
              { type: 'text', text: 'Transcribe este CV.' },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: ESQUEMA_TRANSCRIPCION },
      }),
    })
    if (!res.ok) return null
    const body = await res.json()
    const content = body?.choices?.[0]?.message?.content
    if (!content) return null
    const texto = String(JSON.parse(content)?.texto ?? '').slice(0, MAX_CV_CHARS).trim()
    // Una transcripción tan corta como para seguir siendo "ilegible" no es una
    // transcripción: es el modelo rellenando. No se usa.
    return esCvIlegible(texto) ? null : texto
  } catch (_e) {
    return null
  }
}

/** Tipos de campo que NUNCA salen hacia el modelo. Espejo de meridian-chat. */
const PRIVATE_FIELD_TYPES = new Set(['email', 'phone', 'tel', 'file'])

/** Una llamada con structured output. Las tres piezas de la triada pasan por aquí. */
async function chatJSON(system: string, user: string, json_schema: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    signal: plazo(PLAZO.modelo),
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
    // `force` = "Volver a analizar" desde la ficha (Mario, ago 2026): repite un
    // análisis CORRECTO, porque los análisis envejecen cuando Meridian mejora
    // (campos nuevos como fuente, trayectoria o contrastes). Solo salta la
    // idempotencia: el plan, el reclamo atómico y el resto de guardas de coste
    // se aplican igual, y las llamadas automáticas no lo usan nunca.
    const { candidate_id, auto, force } = await req.json()
    if (!candidate_id || typeof candidate_id !== 'string') return json({ error: 'Falta candidate_id' }, 400)

    // Sin sesión, lo único que se puede pedir es el disparo automático. Se
    // decide ANTES de leer nada: un anónimo tampoco tiene que poder saber si un
    // id existe.
    const quien = await quienLlama(req)
    if (quien.tipo === 'anonimo' && (auto !== true || force === true)) {
      return json({ error: 'No autorizado' }, 401)
    }

    const { data: cand } = await admin
      .from('candidates')
      .select('id,campaign_id,company_id,answers,cv_path,ai')
      .eq('id', candidate_id)
      .single()
    if (!cand) return json({ ok: true, analyzed: false, skipped: 'candidato no encontrado' })

    // Una persona solo analiza a quien ve: la RLS de `candidates` (puesto
    // visible, no bloqueado) es la autorización, y se pregunta con SU sesión.
    if (quien.tipo === 'usuario') {
      const { data: visible } = await quien.cliente
        .from('candidates').select('id').eq('id', candidate_id).maybeSingle()
      if (!visible) return json({ error: 'No autorizado' }, 403)
    }

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
    // TOPE DIARIO DEL DISPARO AUTOMÁTICO, por empresa. Es el freno de coste
    // que faltaba detrás del formulario público: la cuota por puesto y hora de
    // submit_application acota el ritmo, y esto acota lo que se paga en un día
    // aunque haya muchos puestos. Se cuentan los reclamos de hoy (ai_claimed_at
    // se pone en cada análisis que se paga). Un análisis manual, que pide una
    // persona con sesión, no pasa por aquí. (Auditoría, sep 2026.)
    if (auto === true) {
      const inicioHoy = new Date(); inicioHoy.setUTCHours(0, 0, 0, 0)
      const { count } = await admin
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', cand.company_id)
        .gte('ai_claimed_at', inicioHoy.toISOString())
      if ((count ?? 0) >= MAX_AUTO_POR_DIA) {
        return json({ ok: true, analyzed: false, skipped: 'tope diario de análisis automáticos' })
      }
    }

    // Idempotencia: un análisis correcto ya existente no se repite (no gasta OpenAI).
    // Uno con error sí se puede reintentar, y `force` (manual y a propósito)
    // repite también los correctos.
    const existing = cand.ai as { error?: string } | null
    if (existing && !existing.error && force !== true) {
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

    // Lectura del CV en dos peldaños: la capa de texto del PDF y, si no da para
    // nada (escaneo), la transcripción de visión. `cvLeido` deja constancia de
    // cuál funcionó: el visor de la ficha solo puede subrayar con 'texto',
    // porque una transcripción no se puede localizar en el documento.
    const descarga = await cvDescarga(cand.cv_path)
    let cv = descarga.texto && !esCvIlegible(descarga.texto) ? descarga.texto : null
    let cvLeido: 'texto' | 'vision' | 'no' = cv ? 'texto' : 'no'
    if (!cv && cand.cv_path && descarga.bytes) {
      cv = await transcribirCvVision(descarga.bytes)
      if (cv) cvLeido = 'vision'
    }

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
    // alguien que nunca adjuntó nada. La transcripción de visión avisa de lo
    // que es: el juez también tiene derecho a saber que puede traer erratas.
    const cvNota = cv
      ? cvLeido === 'vision'
        ? `Texto del CV adjunto (transcripción de un documento escaneado; puede tener erratas):\n${cv}\n`
        : `Texto del CV adjunto:\n${cv}\n`
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
          model: OPENAI_MODEL, analyzedAt: new Date().toISOString(), cvUsed: !!cv, cvLeido,
        })
        if (writeError) return json({ error: `No se pudo guardar el análisis: ${writeError.message}` }, 500)
        return json({ ok: true, analyzed: true })
      }

      // --- Pieza 2: el evaluador, con evidencia obligatoria. La TRAYECTORIA
      // (transcripción estructurada del CV) va en paralelo: es mecánica, no
      // depende del baremo, y con su propio catch, porque es un extra y un
      // análisis sin ficha de trayectoria sigue siendo un análisis. ---
      const claves = efectivos.map((c) => c.clave)
      // La fecha de hoy viaja a evaluador y juez: sin ella no se puede leer
      // "desde 2008" como años de experiencia ni saber si una vigencia vive.
      const hoy = new Date().toISOString().slice(0, 10)
      const pe = promptEvaluador({ puesto, criterios: efectivos, respuestas, cvNota, hoy })
      const pt = cv ? promptTrayectoria(cv) : null
      const [ev, trayectoriaBruta] = await Promise.all([
        chatJSON(pe.system, pe.user, esquemaEvaluador(claves)),
        pt
          ? chatJSON(pt.system, pt.user, ESQUEMA_TRAYECTORIA).catch(() => null)
          : Promise.resolve(null),
      ])
      // El texto del CV entra como pajar de verificación: un empleo, carnet o
      // curso que no esté escrito en el documento no se guarda (transcribir es
      // eso). Lo enseñó el primer CV real: el modelo clonó un empleo con un
      // puesto inventado y duplicó la formación.
      const trayectoria = sanearTrayectoria(trayectoriaBruta, cv)
      let summary = String(ev.summary ?? '').slice(0, 600)
      let highlights = (Array.isArray(ev.highlights) ? ev.highlights : []).map((s) => String(s)).slice(0, 4)
      let concerns = (Array.isArray(ev.concerns) ? ev.concerns : []).map((s) => String(s)).slice(0, 3)
      // Sin texto de CV no puede haber contraste (es respuesta-VS-CV por
      // definición): se tira lo que el modelo alucine, fallen los prompts que
      // fallen. Lo cazó el banco de pruebas con el stub: un evaluador tonto
      // devolvía un contraste sin CV y el código se lo guardaba.
      let contrastes = cv ? sanearContrastes(ev.contrastes) : []
      const brutos: Juicio[] = (Array.isArray(ev.criterios) ? ev.criterios : []).map((c) => {
        const j = c as {
          clave?: unknown; valor?: unknown; evidencia?: unknown; fuente?: unknown
          respuesta_incoherente?: unknown
        }
        return {
          clave: String(j?.clave ?? ''),
          valor: (['cumple', 'parcial', 'no_consta', 'no_cumple'].includes(String(j?.valor)) ? String(j?.valor) : 'no_consta') as Valor,
          evidencia: String(j?.evidencia ?? ''),
          // normalizarJuicios valida el vocabulario y la ata a su evidencia.
          fuente: String(j?.fuente ?? '') as FuenteJuicio,
          // normalizarJuicios la acota a los no_consta del evaluador.
          incoherente: j?.respuesta_incoherente === true,
        }
      })
      // Mitad mecánica del juez: un juicio sin evidencia se queda en no_consta,
      // fallen los modelos que fallen.
      let juicios = normalizarJuicios(brutos, new Set(claves))

      // --- Pieza 3: el juez. Solo si hay algo que verificar. ---
      const hayJuicios = juicios.some((j) => j.valor !== 'no_consta')
      if (hayJuicios || highlights.length > 0 || concerns.length > 0 || contrastes.length > 0) {
        const pj = promptJuez({ puesto, criterios: efectivos, respuestas, cvNota, hoy, evaluacion: { summary, highlights, concerns, criterios: juicios, contrastes } })
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
          // La marca de incoherencia sobrevive solo si YA era del evaluador (un
          // no_consta se queda no_consta): una rebaja del juez no la inventa.
          return valor === 'no_consta'
            ? { clave: j.clave, valor, ...(j.incoherente ? { incoherente: true } : {}) }
            : { ...j, valor }
        })
        highlights = soloConservados(highlights, (Array.isArray(jz.a_favor) ? jz.a_favor : []).map(String))
        concerns = soloConservados(concerns, (Array.isArray(jz.a_confirmar) ? jz.a_confirmar : []).map(String))
        // Los contrastes se conservan o se quitan por su serialización, la
        // misma que vio el juez: uno reescrito no casa y se descarta solo.
        const conservados = new Set(
          soloConservados(
            contrastes.map(serializarContraste),
            (Array.isArray(jz.contrastes_conservados) ? jz.contrastes_conservados : []).map(String),
          ),
        )
        contrastes = contrastes.filter((c) => conservados.has(serializarContraste(c)))
      }

      // --- Pieza 4: el REDACTOR. Escribe el informe en prosa (lo que un
      // profesional le diría a su jefe) DESPUÉS del juez y solo con material
      // verificado: juicios finales, contrastes conservados y trayectoria
      // saneada. Con su propio catch: un análisis sin informe sigue valiendo
      // (la ficha lo dice y ofrece re-analizar). ---
      const pr = promptRedactor({
        puesto, criterios: efectivos, juicios, contrastes,
        trayectoria, cvUsado: !!cv,
      })
      const informe = await chatJSON(pr.system, pr.user, ESQUEMA_INFORME)
        .then((out) => sanearInforme(out.informe))
        .catch(() => null)

      // --- El número lo pone el código: pesos por nivel y cobertura. Un clave
      // sin dato arrastra, salvo los de CV cuando no hubo CV legible. ---
      const { fit } = agregarJuicios(efectivos, juicios, !!cv)
      const valorDe = new Map(juicios.map((j) => [j.clave, j]))
      const criteriosOut = efectivos.map((c) => {
        const j = valorDe.get(c.clave)
        return {
          clave: c.clave,
          valor: j?.valor ?? 'no_consta',
          nombre: c.nombre,
          nivel: c.nivel,
          ...(j?.evidencia ? { evidencia: j.evidencia } : {}),
          // La fuente viaja pegada a su evidencia: es lo que le dice al visor
          // qué citas buscar en el PDF.
          ...(j?.evidencia && j?.fuente ? { fuente: j.fuente } : {}),
          // Procedencia del castigo a medias de la agregación (descuido).
          ...(j?.incoherente ? { incoherente: true } : {}),
        }
      })
      const writeError = await store({
        summary, highlights, concerns, fit,
        ...(informe ? { informe } : {}),
        criterios: criteriosOut,
        ...(contrastes.length > 0 ? { contrastes } : {}),
        ...(trayectoria ? { trayectoria } : {}),
        baremoHash: hash,
        model: OPENAI_MODEL, analyzedAt: new Date().toISOString(), cvUsed: !!cv, cvLeido,
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

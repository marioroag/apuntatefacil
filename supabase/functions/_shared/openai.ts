// Configuración de OpenAI en un solo sitio: la usan `analyze-candidate` (triaje)
// y `meridian-chat` (el panel conversacional).
//
// Modelo por defecto: gpt-5.6-luna, el pequeño de la familia 5.6. Está pensado
// justo para esto (clasificar, resumir, enrutar en volumen) y soporta tool
// calling y structured output, que es de lo que dependen las dos funciones.
// OJO: el alias `gpt-5.6` NO es Luna, apunta a Sol. Hay que pedir el id exacto.

export const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
export const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6-luna'

// Solo se cambia en pruebas locales, para poder ejercitar el bucle de
// herramientas contra un stub sin gastar. En producción no se define.
export const OPENAI_BASE =
  (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '')

/**
 * Los modelos con razonamiento (familia gpt-5, serie o) no aceptan `temperature`:
 * se controlan con `reasoning_effort`. Enviar el parámetro equivocado es un 400,
 * así que se elige según el modelo y no a mano.
 *
 * `low` por defecto: lo que hacemos es traducir una frase a filtros y resumir,
 * no resolver problemas. Subir el esfuerzo aquí es pagar y esperar de más.
 */
export function tuning(opts: { tools?: boolean; model?: string } = {}): Record<string, unknown> {
  // Por defecto se afina para OPENAI_MODEL; una llamada que use otro modelo (la
  // transcripción de visión con OPENAI_VISION_MODEL) pasa el suyo, porque el
  // parámetro correcto depende del modelo REAL de esa llamada, no del global.
  const reasoning = /^(gpt-5|o[134])/.test(opts.model ?? OPENAI_MODEL)
  if (!reasoning) return { temperature: 0.2 }
  // Restricción de la API, no una preferencia: en /v1/chat/completions un modelo
  // de la familia 5.6 con function tools SOLO admite reasoning_effort 'none'
  // (con cualquier otro valor devuelve 400). Para razonar con herramientas
  // habría que migrar a /v1/responses.
  if (opts.tools) return { reasoning_effort: 'none' }
  return { reasoning_effort: Deno.env.get('OPENAI_REASONING_EFFORT') ?? 'low' }
}

/**
 * Mensaje de error legible. El cuerpo de OpenAI viene en JSON con sangría, así
 * que recortarlo a lo bruto se come justo lo que importa: qué parámetro falla.
 */
export function openaiError(status: number, raw: string): Error {
  try {
    const e = JSON.parse(raw)?.error
    if (e?.message) {
      const param = e.param ? ` [param: ${e.param}]` : ''
      const code = e.code ? ` (${e.code})` : ''
      return new Error(`OpenAI ${status}${code}${param}: ${e.message}`)
    }
  } catch { /* no era JSON */ }
  return new Error(`OpenAI ${status}: ${raw.slice(0, 400)}`)
}

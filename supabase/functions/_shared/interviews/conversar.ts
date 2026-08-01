// Hablar con el candidato. La única parte que toca la red.
//
// Todo lo que se puede decidir sin llamar a nadie vive en `guion.ts`, que es
// puro y se prueba entero. Aquí solo está la llamada y la degradación:
//
//   sin clave / red caída / respuesta rota  ->  null
//
// Y `null` NO significa "pasa a una persona": significa "todavía no". El
// trabajo vuelve a la cola con espera creciente y se reintenta. Solo cuando se
// agotan los intentos (más de una hora después) lo coge alguien. Un hipo de
// OpenAI no puede costar un candidato.

import { OPENAI_API_KEY, OPENAI_BASE, OPENAI_MODEL, tuning } from '../openai.ts'

import type { Hechos, Respuesta, Turno } from './guion.ts'
import {
  construirConversacion, construirSistema, ESQUEMA, normalizarRespuesta, totalAgenda,
} from './guion.ts'
export * from './guion.ts'

export async function conversar(
  hechos: Hechos, turnos: Turno[], pendientes: string[],
): Promise<Respuesta | null> {
  if (!OPENAI_API_KEY) return null

  let res: Response
  try {
    res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        ...tuning(),
        messages: [
          { role: 'system', content: construirSistema(hechos) },
          {
            role: 'user',
            content: construirConversacion(turnos, pendientes.map((p) => p.slice(0, 1000))),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'respuesta_agente', strict: true, schema: ESQUEMA },
        },
      }),
    })
  } catch {
    return null
  }
  if (!res.ok) {
    console.error(`[conversar] OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return null
  }

  try {
    const body = await res.json()
    const crudo = JSON.parse(body?.choices?.[0]?.message?.content ?? '{}')
    // Los índices del modelo son de la AGENDA, no de la tanda ofrecida: es el
    // único espacio de numeración que hay, y es lo que le permite pedir una hora
    // que no le habíamos enseñado.
    return normalizarRespuesta(crudo, totalAgenda(hechos))
  } catch {
    return null
  }
}

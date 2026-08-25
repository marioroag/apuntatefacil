// Gating de plan del lado servidor, en un solo sitio.
//
// Con el PAGO POR PROCESO (ago 2026) el producto entero está incluido: se cobra
// por procesos abiertos, no por capacidades. Estos gates ya no diferencian
// tiers; quedan como lista de PLANES CONOCIDOS y siguen fail-closed: un plan
// desconocido o ausente no ejecuta nada que cueste dinero (Meridian llama a
// OpenAI; una conversación de WhatsApp también cuesta). El control de coste de
// la prueba es su tope (25 candidaturas visibles y 15 días).

const PLANES_CONOCIDOS = new Set(['trial', 'proceso', 'esencial', 'pro', 'multi'])

export function planHasMeridian(plan: string | null | undefined): boolean {
  return typeof plan === 'string' && PLANES_CONOCIDOS.has(plan)
}

/** Espejo de public.plan_has_interviews() en SQL, que es el que manda
 *  (el único que un cliente no puede saltarse). */
export function planHasInterviews(plan: string | null | undefined): boolean {
  return typeof plan === 'string' && PLANES_CONOCIDOS.has(plan)
}

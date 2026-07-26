// Gating de plan del lado servidor, en un solo sitio.
//
// Es el ESPEJO de PLAN_FEATURES en src/lib/pricing.ts, igual que
// PLAN_PROCESS_LIMIT y compañía son el espejo de los triggers de SQL. Cuando se
// añada un plan o se mueva una feature de plan, hay que tocar los dos lados.
// El cliente decide qué enseñar; esto decide qué se ejecuta, y es fail-closed:
// un plan desconocido o ausente no tiene la feature.

/** Planes con Meridian (la capa de IA). Diferenciador de Pro/Multi. */
const MERIDIAN_PLANS = new Set(['pro', 'multi'])

export function planHasMeridian(plan: string | null | undefined): boolean {
  return typeof plan === 'string' && MERIDIAN_PLANS.has(plan)
}

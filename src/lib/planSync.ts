import type { Company } from './auth'

// Tras pagar o cambiar de plan, el plan REAL lo fija el webhook de Stripe, que no
// es instantáneo (la edge function solo dispara el cambio en Stripe). Si recargas
// antes de que llegue el webhook, la BD aún tiene el plan viejo y no verías el
// cambio. Por eso sondeamos la empresa hasta que refleje el plan nuevo y solo
// entonces recargamos: así TODO el panel (navegación, límites, etiquetas) sale al
// día sin que el usuario tenga que recargar a mano.
export async function pollPlanAndReload(
  refreshCompany: () => Promise<Company | null>,
  matches: (plan: string | undefined) => boolean,
  { tries = 15, intervalMs = 1000 }: { tries?: number; intervalMs?: number } = {},
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const c = await refreshCompany()
    if (matches(c?.plan)) {
      window.location.reload()
      // La recarga es asíncrona: dejamos la promesa colgada para que el .then del
      // llamante (el aviso de "tarda unos segundos") NO se ejecute durante el
      // teardown de la página. La recarga limpia todo.
      return new Promise<boolean>(() => {})
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

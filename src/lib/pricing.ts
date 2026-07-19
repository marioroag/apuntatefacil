// -----------------------------------------------------------------------------
// Pricing de Apúntate Fácil. Posicionamiento PREMIUM ("los mejores", no los más baratos).
// Doctrina de presentación (Mario, jul 2026, sustituye a "números redondos"):
//  - Efecto dígito izquierdo: 149 / 249 en vez de 150 / 250.
//  - Multi (499) es el ANCLA del catálogo: hace que Pro (249, "la mitad del tope")
//    parezca la jugada inteligente. Quien necesita Multi no es sensible a 50 €.
//  - Anual = ×10 (2 meses gratis exactos). En anual se enseña el equivalente
//    mensual con el mensual tachado y el ahorro EN EUROS (regla de 100), no en %.
//  - El símbolo € se pinta pequeño y arriba (menos "dolor de pago"); "Sin
//    permanencia" cerca del precio y el IVA en letra pequeña al pie de la sección.
// Cambia aquí los importes y todo se actualiza en la landing y en /app/plan.
// Los importes REALES de cobro viven en los prices de Stripe (STRIPE_PRICE_*):
// al cambiar estos números hay que recrear los prices con los importes nuevos.
// -----------------------------------------------------------------------------

export interface Tier {
  id: string
  name: string
  tagline: string
  monthly: number // EUR/mes (IVA aparte)
  annual: number // EUR/año (= monthly * 10, dos meses gratis)
  processes: string
  features: string[]
  cta: string
  /** Plan destacado. La chapa es "Recomendado", NUNCA "el más elegido"
   *  (sin usuarios reales sería prueba social inventada). */
  recommended?: boolean
  /** Contratable HOY. En el lanzamiento solo Esencial; Pro y Multi se anuncian
   *  como "Próximamente" hasta que sus features estén construidas (honestidad:
   *  no vendemos lo que aún no existe). */
  available?: boolean
}

// El tope es el nº de puestos ACTIVOS a la vez. Pausar libera cupo (los pausados
// quedan aparcados y no cuentan); reactivar exige un hueco activo libre. Al bajar
// de plan, el servidor pausa los activos que sobran (ver 20260707140000).
// IMPORTANTE: estos topes son el ESPEJO del enforcement de servidor en
// supabase/migrations/20260615000000_process_limit.sql (reescrito en 20260707140000).
// Mantener sincronizados.
export const PLAN_PROCESS_LIMIT: Record<string, number> = {
  trial: 1,
  esencial: 2,
  pro: 10,
  multi: Infinity,
}

// Tope de candidatos por plan. Solo el plan de Prueba tiene tope: al recibir el
// 15º candidato el puesto se pausa y deja de aceptar más hasta subir de plan.
// ESPEJO del enforcement de servidor en
// supabase/migrations/20260615130000_trial_candidate_limit.sql. Mantener sincronizados.
export const PLAN_CANDIDATE_LIMIT: Record<string, number> = {
  trial: 15,
  esencial: Infinity,
  pro: Infinity,
  multi: Infinity,
}

export const PLAN_LABEL: Record<string, string> = {
  trial: 'Prueba',
  esencial: 'Esencial',
  pro: 'Pro',
  multi: 'Multi',
}

// Capacidades por plan. Es el ÚNICO interruptor de las features avanzadas: una
// feature Pro/Multi solo aparece si el plan la incluye aquí. Esencial nunca
// pierde un básico; estas son capacidades NETO-NUEVAS que se desbloquean al subir.
export type PlanFeature = 'savedViews' | 'sites' | 'brands' | 'managers' | 'teamBoard'

export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  trial: [],
  esencial: [],
  pro: ['savedViews', 'brands', 'teamBoard'],
  multi: ['savedViews', 'sites', 'brands', 'managers', 'teamBoard'],
}

export function planHas(plan: string | undefined | null, feature: PlanFeature): boolean {
  return !!plan && (PLAN_FEATURES[plan]?.includes(feature) ?? false)
}

// Las Etiquetas son una primitiva de clasificación (como notas o valoración), no una
// feature de escala: disponibles en TODOS los planes, incluido Prueba. No se gatea ni
// se cobra por número de etiquetas. Único punto de configuración: si algún día se
// quisiera como upsell a Pro+, este flag es el sitio donde cambiarlo.
export const TAGS_ENABLED = true

// Copy y plan mínimo de cada feature avanzada. Lo usan el aviso de upgrade
// (modal) y la pantalla bloqueada para decir EXACTAMENTE qué falta y con qué
// plan se desbloquea. La etiqueta empieza en minúscula con artículo para que
// encaje a media frase ("Desbloquea la Bandeja con Pro"); se capitaliza al
// inicio de oración en el componente.
export const FEATURE_COPY: Record<PlanFeature, { label: string; blurb: string; minPlan: 'pro' | 'multi' }> = {
  savedViews: {
    label: 'las vistas guardadas',
    blurb: 'Guarda tus combinaciones de filtros y vuelve a aplicarlas en un clic.',
    minPlan: 'pro',
  },
  brands: {
    label: 'las Marcas',
    blurb: 'Da a cada formulario su logo, color y textos propios.',
    minPlan: 'pro',
  },
  sites: {
    label: 'las Sedes',
    blurb: 'Agrupa tus puestos por local y míralo todo de un vistazo.',
    minPlan: 'multi',
  },
  managers: {
    label: 'los encargados por sede',
    blurb: 'Cada encargado ve y exporta solo los candidatos de su sede.',
    minPlan: 'multi',
  },
  teamBoard: {
    label: 'el Equipo',
    blurb: 'Publica peticiones internas, responde con candidatos de la base e invita a tu equipo.',
    minPlan: 'pro',
  },
}

// Tope de marcas por plan (espejo del trigger enforce_brand_limit en servidor).
// Pro: 1 marca. Multi: ilimitadas. Mantener sincronizado con la migración.
export const PLAN_BRAND_LIMIT: Record<string, number> = {
  trial: 0,
  esencial: 0,
  pro: 1,
  multi: Infinity,
}

export const TIERS: Tier[] = [
  {
    id: 'esencial',
    name: 'Esencial',
    tagline: 'Para contratar puntualmente sin perder respuestas',
    monthly: 149,
    annual: 1490,
    processes: '2 procesos a la vez',
    available: true,
    features: [
      'Candidatos ilimitados',
      'Formulario de candidatura a tu medida',
      'Vista general y Bandeja de candidatos nuevos',
      'Filtros, notas y valoraciones',
      'Exporta a Excel cuando quieras',
      'Soporte humano, te responde una persona',
    ],
    cta: 'Empezar con Esencial',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para varias contrataciones activas y trabajo en equipo',
    monthly: 249,
    annual: 2490,
    processes: '10 procesos a la vez',
    recommended: true,
    available: true,
    features: [
      'Todo lo de Esencial',
      'Hasta 10 procesos a la vez',
      'Equipo: tablón de peticiones e invitaciones',
      'Guarda tus vistas de filtros y reaplícalas',
      'Una marca con logo, banner y colores en el formulario',
    ],
    cta: 'Empezar con Pro',
  },
  {
    id: 'multi',
    name: 'Multi',
    tagline: 'Para ETTs, cadenas y equipos con varias sedes',
    monthly: 499,
    annual: 4990,
    processes: 'Procesos ilimitados',
    available: true,
    features: [
      'Todo lo de Pro',
      'Procesos ilimitados',
      'Agrupa tus puestos por sede',
      'Cada encargado ve y exporta solo su sede',
      'Marcas ilimitadas con logo, banner y colores',
      'Resumen de todas tus sedes de un vistazo',
    ],
    cta: 'Empezar con Multi',
  },
]

/** Reassurance del trial en hero y CTAs. Derivada de los topes reales. */
export const TRIAL_REASSURANCE = `${PLAN_PROCESS_LIMIT.trial} puesto y hasta ${PLAN_CANDIDATE_LIMIT.trial} candidatos gratis. Sin tarjeta ni permanencia.`

// Presentación del precio anual como equivalente mensual. El importe facturado
// es SIEMPRE visible junto al equivalente (transparencia: nada que calcular ni
// letra pequeña). El equivalente se trunca (207,5 -> 207) porque el total anual
// exacto se muestra al lado; el ahorro son exactamente 2 mensualidades.
export const annualPerMonth = (t: Tier): number => Math.floor(t.annual / 12)
export const annualSavings = (t: Tier): number => t.monthly * 12 - t.annual
// Números con separador de miles español (2490 -> "2.490").
export const fmtEs = (n: number): string => n.toLocaleString('es-ES')

// Ancla del coste real, contada como DOS VERDADES antes de mostrar el precio:
// lo que cuesta hacerlo a mano (tiempo, candidatos perdidos) frente a lo que
// cuesta pagar por hacerlo "bien" (dinero). Sin jerga tipo "ATS".
export interface CostTruth {
  key: string
  label: string
  items: { lead: string; text: string }[]
}

// Sin precisión falsa: "56 candidatos" no tiene fuente interna defendible.
// Rangos de InfoJobs / selección: orientativos, consultados julio 2026
// (tarifas públicas de publicación destacada e industria de recruiting).
export const COST_TRUTHS: CostTruth[] = [
  {
    key: 'mano',
    label: 'Si lo haces a mano',
    items: [
      { lead: 'Decenas de respuestas', text: 'por puesto, en chats sueltos de Milanuncios' },
      { lead: 'Horas', text: 'revisando respuestas y copiándolas a Excel' },
      { lead: 'Buenos perfiles', text: 'que se pierden entre tanto mensaje' },
    ],
  },
  {
    key: 'pagando',
    label: 'Si pagas por hacerlo bien',
    items: [
      { lead: '295 a 369 €', text: 'por una oferta destacada en InfoJobs' },
      { lead: '15 a 20% del salario', text: 'a una empresa de selección' },
      { lead: 'Hasta 3 sueldos', text: 'cuesta una mala contratación' },
    ],
  },
]

export const COST_TRUTHS_FOOTNOTE =
  'Cifras orientativas de mercado, consultadas en julio de 2026. InfoJobs: tarifas públicas de publicación destacada. Selección y coste de mala contratación: rangos habituales del sector.'

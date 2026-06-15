// -----------------------------------------------------------------------------
// Pricing de Apúntate Fácil. Posicionamiento PREMIUM ("los mejores", no los más baratos).
// Números redondos = prestigio + honestos + citables. Anual = 2 meses gratis.
// Cambia aquí los importes y todo se actualiza en la landing.
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

// Un "proceso" = un puesto abierto (activo o pausado). Cerrarlo libera cupo.
// IMPORTANTE: estos topes son el ESPEJO del enforcement de servidor en
// supabase/migrations/20260615000000_process_limit.sql. Mantener sincronizados.
export const PLAN_PROCESS_LIMIT: Record<string, number> = {
  trial: 0,
  esencial: 2,
  pro: 10,
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
export type PlanFeature = 'bandeja' | 'savedViews' | 'sites' | 'brands' | 'managers'

export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  trial: [],
  esencial: [],
  pro: ['bandeja', 'savedViews', 'brands'],
  multi: ['bandeja', 'savedViews', 'sites', 'brands', 'managers'],
}

export function planHas(plan: string | undefined | null, feature: PlanFeature): boolean {
  return !!plan && (PLAN_FEATURES[plan]?.includes(feature) ?? false)
}

// Copy y plan mínimo de cada feature avanzada. Lo usan el aviso de upgrade
// (modal) y la pantalla bloqueada para decir EXACTAMENTE qué falta y con qué
// plan se desbloquea. La etiqueta empieza en minúscula con artículo para que
// encaje a media frase ("Desbloquea la Bandeja con Pro"); se capitaliza al
// inicio de oración en el componente.
export const FEATURE_COPY: Record<PlanFeature, { label: string; blurb: string; minPlan: 'pro' | 'multi' }> = {
  bandeja: {
    label: 'la Bandeja',
    blurb: 'Reúne los candidatos nuevos de todos tus puestos en una sola lista.',
    minPlan: 'pro',
  },
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
    tagline: 'Todo lo que necesitas para contratar bien en un sitio',
    monthly: 150,
    annual: 1500,
    processes: '2 procesos a la vez',
    available: true,
    features: [
      'Candidatos ilimitados',
      'Usuarios del equipo ilimitados',
      'Formulario de candidatura a tu medida',
      'Filtros, notas y valoraciones',
      'Exporta a Excel cuando quieras',
      'Soporte humano, te responde una persona',
    ],
    cta: 'Empezar con Esencial',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para quien tiene varias vacantes abiertas a la vez',
    monthly: 250,
    annual: 2500,
    processes: '10 procesos a la vez',
    recommended: true,
    available: true,
    features: [
      'Todo lo de Esencial',
      'Hasta 10 procesos a la vez',
      'Bandeja: los nuevos de todos tus puestos en una lista',
      'Guarda tus vistas de filtros y reaplícalas',
      'Una marca con logo, banner y colores en el formulario',
    ],
    cta: 'Empezar con Pro',
  },
  {
    id: 'multi',
    name: 'Multi',
    tagline: 'Para cadenas, franquicias y ETTs con varias sedes',
    monthly: 450,
    annual: 4500,
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

// Ancla del coste real, contada como DOS VERDADES antes de mostrar el precio:
// lo que cuesta hacerlo a mano (tiempo, candidatos perdidos) frente a lo que
// cuesta pagar por hacerlo "bien" (dinero). Sin jerga tipo "ATS".
export interface CostTruth {
  key: string
  label: string
  items: { lead: string; text: string }[]
}

export const COST_TRUTHS: CostTruth[] = [
  {
    key: 'mano',
    label: 'Si lo haces a mano',
    items: [
      { lead: '56 candidatos', text: 'por vacante, en chats sueltos de Milanuncios' },
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

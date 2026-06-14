// -----------------------------------------------------------------------------
// Pricing de Criba. Posicionamiento PREMIUM ("los mejores", no los más baratos).
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
}

export const TIERS: Tier[] = [
  {
    id: 'esencial',
    name: 'Esencial',
    tagline: 'Para quien contrata para un solo sitio',
    monthly: 150,
    annual: 1500,
    processes: '2 procesos activos a la vez',
    features: [
      'Candidatos ilimitados',
      'Usuarios del equipo ilimitados',
      'Formulario personalizable',
      'Filtros y búsqueda',
      'Exportar a Excel sin límite',
    ],
    cta: 'Empezar con Esencial',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para quien tiene varias vacantes abiertas',
    monthly: 250,
    annual: 2500,
    processes: '10 procesos activos a la vez',
    recommended: true,
    features: [
      'Todo lo de Esencial',
      'Hasta 10 procesos en paralelo',
      'Filtros avanzados e histórico completo',
      'Etiquetas y notas de equipo',
      'Plantillas de formulario reutilizables',
    ],
    cta: 'Probar Pro',
  },
  {
    id: 'multi',
    name: 'Multi',
    tagline: 'Para cadenas, franquicias y ETTs',
    monthly: 450,
    annual: 4500,
    processes: 'Procesos ilimitados',
    features: [
      'Todo lo de Pro',
      'Procesos ilimitados',
      'Multi local y multi marca',
      'Onboarding dedicado',
      'Soporte prioritario',
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

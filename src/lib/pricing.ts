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
  popular?: boolean
}

export const TIERS: Tier[] = [
  {
    id: 'esencial',
    name: 'Esencial',
    tagline: 'Para quien contrata para un solo sitio',
    monthly: 60,
    annual: 600,
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
    monthly: 150,
    annual: 1500,
    processes: '10 procesos activos a la vez',
    popular: true,
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
    monthly: 350,
    annual: 3500,
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

// Anclas reales del sector (junio 2026) que se muestran ANTES del precio.
export const SECTOR_ANCHORS: { label: string; cost: string }[] = [
  { label: 'Una oferta destacada en InfoJobs', cost: '295 a 369 €' },
  { label: 'Patrocinar en Indeed', cost: 'desde 150 €/mes' },
  { label: 'Un ATS profesional', cost: '190 a 477 €/mes' },
  { label: 'Una empresa de selección', cost: '15 a 20% del salario' },
  { label: 'Una mala contratación', cost: 'hasta 3 sueldos' },
]

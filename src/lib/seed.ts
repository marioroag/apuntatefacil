import type {
  Brand,
  Campaign,
  Candidate,
  CandidateSource,
  CandidateStatus,
  AppData,
  FormField,
  Site,
} from './types'

// PRNG determinista (mulberry32) para que los datos de ejemplo sean estables.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = rng(20260613)
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const chance = (p: number) => rnd() < p

const NOMBRES = [
  'Antonio', 'Manuel', 'José', 'Francisco', 'David', 'Juan', 'Javier', 'Daniel',
  'Carlos', 'Miguel', 'Rafael', 'Pablo', 'Sergio', 'Jorge', 'Alberto', 'Iván',
  'María', 'Carmen', 'Laura', 'Ana', 'Marta', 'Lucía', 'Sara', 'Cristina',
  'Elena', 'Patricia', 'Nuria', 'Andrea', 'Raquel', 'Beatriz', 'Mohamed', 'Youssef',
  'Adrián', 'Rubén', 'Óscar', 'Vanesa', 'Tamara', 'Sonia', 'Noelia', 'Alba',
]
const APELLIDOS = [
  'García', 'Martínez', 'López', 'Sánchez', 'González', 'Pérez', 'Rodríguez',
  'Fernández', 'Gómez', 'Ruiz', 'Díaz', 'Moreno', 'Muñoz', 'Romero', 'Navarro',
  'Torres', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Ortega', 'Ramos', 'Castro',
  'El Amrani', 'Benítez', 'Ferrer', 'Soler', 'Vidal', 'Marí', 'Aguilar',
]

function phone() {
  const a = 600 + Math.floor(rnd() * 99)
  const b = Math.floor(rnd() * 900) + 100
  const c = Math.floor(rnd() * 900) + 100
  return `${a} ${b} ${c}`
}

// Fechas repartidas entre el 18 de mayo y el 12 de junio de 2026.
function dateAgo(maxDaysAgo: number) {
  const end = new Date('2026-06-12T19:30:00').getTime()
  const ms = end - Math.floor(rnd() * maxDaysAgo) * 86400000 - Math.floor(rnd() * 86400000)
  return new Date(ms).toISOString()
}

const f = (field: Omit<FormField, 'required'> & { required?: boolean }): FormField => ({
  required: false,
  ...field,
})

const SYS_NOMBRE = f({ id: 'nombre', type: 'text', label: 'Nombre y apellidos', required: true, system: true, placeholder: 'Tu nombre completo' })
const SYS_TEL = f({ id: 'telefono', type: 'phone', label: 'Teléfono', required: true, system: true, placeholder: '600 000 000' })

// ---------------------------------------------------------------------------
// Puestos (campañas)
// ---------------------------------------------------------------------------

// Sedes de ejemplo de la demo (la ETT opera en dos localizaciones).
const sites: Site[] = [
  { id: 'site_valencia', name: 'Valencia centro', city: 'Valencia' },
  { id: 'site_ribarroja', name: 'Riba-roja del Túria', city: 'Riba-roja' },
]

// Marca de ejemplo de la demo, con logo y banner (assets en public/brand-demo).
export const SEED_BRANDS: Brand[] = [
  {
    id: 'brand_atrium',
    name: 'Empresa de construcción',
    accent: '#2f6db5',
    welcome: 'Gracias por tu interés. Cuéntanos un poco sobre ti y te llamamos pronto.',
    thanks: 'Recibido. Revisamos tu candidatura y te contactamos. Gracias por escribirnos.',
    showLogo: true,
    logoPath: '/brand-demo/logo.png',
    bannerPath: '/brand-demo/banner.jpg',
  },
  {
    id: 'brand_logistica',
    name: 'Empresa de logística',
    accent: '#0f766e',
    welcome: 'Gracias por tu interés. Cuéntanos un poco sobre ti y te llamamos pronto.',
    thanks: 'Recibido. Revisamos tu candidatura y te contactamos. Gracias por escribirnos.',
    showLogo: true,
    logoPath: '/brand-demo/logo-2.png',
    bannerPath: '/brand-demo/banner-2.jpg',
  },
]

const campaigns: Campaign[] = [
  {
    id: 'cmp_peon',
    siteId: 'site_valencia',
    brandId: 'brand_atrium',
    slug: 'peon-albanil-valencia',
    title: 'Peón de albañil',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-15T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/peon-albanil-987654.htm',
    branding: {
      headline: 'Peón de albañil, Valencia',
      welcome: 'Gracias por tu interés. Cuéntanos un poco sobre ti y te llamamos en 24-48 h.',
      thanks: 'Recibido. Revisamos tu candidatura y te contactamos por teléfono. Mucha suerte.',
      accent: '#4F46E5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'exp', type: 'number', label: 'Años de experiencia en obra', required: true, placeholder: '0' }),
      f({ id: 'carnet', type: 'boolean', label: '¿Tienes carnet de conducir B?', required: true }),
      f({ id: 'vehiculo', type: 'boolean', label: '¿Vehículo propio para desplazarte?' }),
      f({ id: 'disp', type: 'select', label: 'Disponibilidad para incorporarte', required: true, options: ['Inmediata', 'En 15 días', 'En 1 mes'] }),
      f({ id: 'zonas', type: 'multiselect', label: '¿En qué zonas puedes trabajar?', options: ['Valencia ciudad', 'Torrent', 'Paterna', 'Sagunto', 'Gandía'] }),
      f({ id: 'comentarios', type: 'textarea', label: 'Algo que quieras añadir', placeholder: 'Especialidad, herramientas propias...' }),
    ],
  },
  {
    id: 'cmp_camarero',
    siteId: 'site_valencia',
    brandId: 'brand_atrium',
    slug: 'camarero-finde-valencia',
    title: 'Camarero/a fin de semana',
    sector: 'Hostelería',
    location: 'Valencia centro',
    status: 'activa',
    createdAt: '2026-05-22T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/camarero-finde-123456.htm',
    branding: {
      headline: 'Camarero/a fin de semana',
      welcome: 'Buscamos gente con energía para sala los findes. Déjanos tus datos.',
      thanks: 'Gracias. Si encajas con lo que buscamos, te escribimos esta semana.',
      accent: '#0F766E',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'email', type: 'email', label: 'Email', placeholder: 'tucorreo@email.com' }),
      f({ id: 'exp_sala', type: 'select', label: 'Experiencia en sala', required: true, options: ['Ninguna', 'Menos de 1 año', 'Entre 1 y 3 años', 'Más de 3 años'] }),
      f({ id: 'idiomas', type: 'multiselect', label: 'Idiomas que hablas', options: ['Español', 'Valenciano', 'Inglés', 'Francés', 'Alemán'] }),
      f({ id: 'noches', type: 'boolean', label: '¿Disponible para turnos de noche?', required: true }),
      f({ id: 'edad', type: 'number', label: 'Edad' }),
    ],
  },
  {
    id: 'cmp_mozo',
    siteId: 'site_ribarroja',
    brandId: 'brand_logistica',
    slug: 'mozo-almacen-ribarroja',
    title: 'Mozo/a de almacén',
    sector: 'Logística',
    location: 'Riba-roja de Túria',
    status: 'activa',
    createdAt: '2026-06-01T09:00:00.000Z',
    branding: {
      headline: 'Mozo/a de almacén, Riba-roja',
      welcome: 'Almacén logístico, turnos rotativos. Cuéntanos tu disponibilidad.',
      thanks: 'Candidatura recibida. Te llamamos para una entrevista breve.',
      accent: '#4F46E5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'carretillero', type: 'boolean', label: '¿Tienes carnet de carretillero?', required: true }),
      f({ id: 'turnos', type: 'multiselect', label: '¿Qué turnos puedes cubrir?', required: true, options: ['Mañana', 'Tarde', 'Noche'] }),
      f({ id: 'vehiculo', type: 'boolean', label: '¿Vehículo propio?', required: true }),
      f({ id: 'exp', type: 'number', label: 'Años en almacén o logística' }),
      f({ id: 'inicio', type: 'date', label: '¿Cuándo podrías empezar?' }),
    ],
  },
  {
    id: 'cmp_limpieza',
    siteId: null,
    brandId: 'brand_atrium',
    slug: 'limpieza-oficinas-valencia',
    title: 'Limpiador/a de oficinas',
    sector: 'Limpieza',
    location: 'Valencia',
    status: 'pausada',
    createdAt: '2026-05-09T09:00:00.000Z',
    branding: {
      headline: 'Limpiador/a de oficinas',
      welcome: 'Turnos de mañana temprano en oficinas del centro.',
      thanks: 'Gracias por escribirnos. Revisamos tu perfil.',
      accent: '#4F46E5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'exp', type: 'boolean', label: '¿Experiencia previa en limpieza?', required: true }),
      f({ id: 'horario', type: 'select', label: 'Disponibilidad horaria', required: true, options: ['Solo mañanas', 'Solo tardes', 'Mañanas y tardes'] }),
      f({ id: 'zona', type: 'text', label: '¿En qué barrio o zona vives?' }),
    ],
  },
]

// ---------------------------------------------------------------------------
// Candidatos (envíos del formulario)
// ---------------------------------------------------------------------------

const STATUS_WEIGHTS: [CandidateStatus, number][] = [
  ['nuevo', 0.42],
  ['contactado', 0.24],
  ['entrevista', 0.14],
  ['contratado', 0.07],
  ['descartado', 0.13],
]
function weightedStatus(): CandidateStatus {
  const r = rnd()
  let acc = 0
  for (const [s, w] of STATUS_WEIGHTS) {
    acc += w
    if (r <= acc) return s
  }
  return 'nuevo'
}

const SOURCES: CandidateSource[] = ['milanuncios', 'milanuncios', 'milanuncios', 'enlace', 'qr']

function answerFor(field: FormField, name: string): Candidate['answers'][string] | undefined {
  switch (field.id) {
    case 'nombre':
      return name
    case 'telefono':
      return phone()
    case 'email': {
      const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
      return chance(0.8) ? `${slug}@${pick(['gmail.com', 'hotmail.com', 'outlook.es'])}` : ''
    }
  }
  switch (field.type) {
    case 'number':
      return String(field.id === 'edad' ? 18 + Math.floor(rnd() * 30) : Math.floor(rnd() * 12))
    case 'boolean':
      return chance(0.55)
    case 'select':
      return field.options ? pick(field.options) : ''
    case 'multiselect': {
      if (!field.options) return []
      return field.options.filter(() => chance(0.4))
    }
    case 'date':
      return dateAgo(0).slice(0, 10) // yyyy-mm-dd, como guarda el input date
    case 'textarea':
      return chance(0.35)
        ? pick(['Puedo empezar ya mismo.', 'Tengo herramienta propia.', 'Busco estabilidad.', 'Vivo cerca.', ''])
        : ''
    default:
      return chance(0.5) ? pick(['Valencia', 'Torrent', 'Mislata', 'Burjassot']) : ''
  }
}

const COUNTS: Record<string, number> = {
  cmp_peon: 19,
  cmp_camarero: 14,
  cmp_mozo: 11,
  cmp_limpieza: 6,
}

const candidates: Candidate[] = []
let n = 0
for (const cmp of campaigns) {
  const total = COUNTS[cmp.id] ?? 8
  for (let i = 0; i < total; i++) {
    const name = `${pick(NOMBRES)} ${pick(APELLIDOS)}`
    const answers: Candidate['answers'] = {}
    for (const field of cmp.fields) {
      const v = answerFor(field, name)
      if (v !== undefined) answers[field.id] = v
    }
    candidates.push({
      id: `cand_${++n}`,
      campaignId: cmp.id,
      answers,
      status: i < 2 ? 'nuevo' : weightedStatus(), // los 2 primeros (más recientes) siempre nuevos
      submittedAt: dateAgo(cmp.id === 'cmp_mozo' ? 11 : 25),
      source: pick(SOURCES),
      rating: chance(0.3) ? 1 + Math.floor(rnd() * 3) : 0,
      notes: '',
    })
  }
}
// Orden: más recientes primero
candidates.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

export const SEED: AppData = {
  company: { name: 'Tu empresa', plan: 'multi', accent: '#4F46E5' },
  sites,
  campaigns,
  candidates,
}

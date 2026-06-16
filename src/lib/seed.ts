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
const rnd = rng(20260616)
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const chance = (p: number) => rnd() < p
const between = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

const NOMBRES = [
  'Antonio', 'Manuel', 'José', 'Francisco', 'David', 'Juan', 'Javier', 'Daniel',
  'Carlos', 'Miguel', 'Rafael', 'Pablo', 'Sergio', 'Jorge', 'Alberto', 'Iván',
  'María', 'Carmen', 'Laura', 'Ana', 'Marta', 'Lucía', 'Sara', 'Cristina',
  'Elena', 'Patricia', 'Nuria', 'Andrea', 'Raquel', 'Beatriz', 'Mohamed', 'Youssef',
  'Adrián', 'Rubén', 'Óscar', 'Vanesa', 'Tamara', 'Sonia', 'Noelia', 'Alba',
  'Hassan', 'Karim', 'Ionut', 'Andrei', 'Cristian', 'Florin', 'Said', 'Bilal',
]
const APELLIDOS = [
  'García', 'Martínez', 'López', 'Sánchez', 'González', 'Pérez', 'Rodríguez',
  'Fernández', 'Gómez', 'Ruiz', 'Díaz', 'Moreno', 'Muñoz', 'Romero', 'Navarro',
  'Torres', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Ortega', 'Ramos', 'Castro',
  'El Amrani', 'Benítez', 'Ferrer', 'Soler', 'Vidal', 'Marí', 'Aguilar',
  'Popescu', 'Ben Ali', 'Cabrera', 'Herrera', 'Santos', 'Iglesias', 'Cano',
]

function phone() {
  const a = 600 + Math.floor(rnd() * 99)
  const b = Math.floor(rnd() * 900) + 100
  const c = Math.floor(rnd() * 900) + 100
  return `${a} ${b} ${c}`
}

// Fechas repartidas hacia atrás desde el 15 de junio de 2026.
function dateAgo(maxDaysAgo: number) {
  const end = new Date('2026-06-15T19:30:00').getTime()
  const ms = end - Math.floor(rnd() * maxDaysAgo) * 86400000 - Math.floor(rnd() * 86400000)
  return new Date(ms).toISOString()
}

// Fecha de incorporación: próximas semanas (lo que pondría un candidato real).
function dateSoon() {
  const start = new Date('2026-06-16T00:00:00').getTime()
  return new Date(start + between(0, 28) * 86400000).toISOString().slice(0, 10)
}

const f = (field: Omit<FormField, 'required'> & { required?: boolean }): FormField => ({
  required: false,
  ...field,
})

const SYS_NOMBRE = f({ id: 'nombre', type: 'text', label: 'Nombre y apellidos', required: true, system: true, placeholder: 'Tu nombre completo' })
const SYS_TEL = f({ id: 'telefono', type: 'phone', label: 'Teléfono', required: true, system: true, placeholder: '600 000 000' })

// ---------------------------------------------------------------------------
// Sedes y marcas
// ---------------------------------------------------------------------------
// La demo es una agencia de empleo con dos divisiones (Plan Multi): construcción
// en Valencia y logística en Madrid. Cada división es una sede y una marca.

const sites: Site[] = [
  { id: 'site_valencia', name: 'Valencia', city: 'Valencia' },
  { id: 'site_madrid', name: 'Madrid', city: 'Madrid' },
]

// Marcas de la demo, con logo y banner propios (assets en public/brand-demo).
export const SEED_BRANDS: Brand[] = [
  {
    id: 'brand_construccion',
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

// ---------------------------------------------------------------------------
// Puestos (campañas)
// ---------------------------------------------------------------------------

const campaigns: Campaign[] = [
  // --- Construcción · Valencia ---------------------------------------------
  {
    id: 'cmp_peon',
    siteId: 'site_valencia',
    brandId: 'brand_construccion',
    slug: 'peon-albanil-valencia',
    title: 'Peón de albañil',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-18T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/peon-albanil-987654.htm',
    branding: {
      headline: 'Peón de albañil, Valencia',
      welcome: 'Obra nueva y reforma en Valencia y alrededores. Déjanos tus datos y te llamamos en 24-48 h.',
      thanks: 'Recibido. Revisamos tu candidatura y te contactamos por teléfono. Mucha suerte.',
      accent: '#2f6db5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'exp', type: 'number', label: 'Años de experiencia en obra', required: true, placeholder: '0' }),
      f({ id: 'carnet', type: 'boolean', label: '¿Tienes carnet de conducir B?', required: true }),
      f({ id: 'vehiculo', type: 'boolean', label: '¿Vehículo propio para desplazarte?' }),
      f({ id: 'disp', type: 'select', label: 'Disponibilidad para incorporarte', required: true, options: ['Inmediata', 'En 15 días', 'En 1 mes'] }),
      f({ id: 'zonas', type: 'multiselect', label: '¿En qué zonas puedes trabajar?', options: ['Valencia ciudad', 'Torrent', 'Paterna', 'Sagunto', 'Manises', 'Aldaia'] }),
      f({ id: 'comentarios', type: 'textarea', label: 'Algo que quieras añadir', placeholder: 'Especialidad, herramienta propia...' }),
    ],
  },
  {
    id: 'cmp_oficial',
    siteId: 'site_valencia',
    brandId: 'brand_construccion',
    slug: 'oficial-primera-valencia',
    title: 'Oficial de 1ª (albañil)',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-24T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/oficial-primera-654321.htm',
    branding: {
      headline: 'Oficial de 1ª, Valencia',
      welcome: 'Buscamos oficial con experiencia para obra en marcha. Proyecto estable.',
      thanks: 'Gracias. Si encajas con el puesto, te llamamos esta misma semana.',
      accent: '#2f6db5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'exp', type: 'number', label: 'Años de experiencia como oficial', required: true, placeholder: '0' }),
      f({ id: 'especialidad', type: 'multiselect', label: 'Especialidad', required: true, options: ['Encofrado', 'Solados y alicatados', 'Enfoscados y revestimientos', 'Estructura de hormigón', 'Rehabilitación', 'Pladur'] }),
      f({ id: 'prl', type: 'select', label: 'Formación PRL en construcción', required: true, options: ['No tengo', '20 horas', '60 horas'] }),
      f({ id: 'carnet', type: 'boolean', label: '¿Carnet de conducir B?', required: true }),
      f({ id: 'disp', type: 'select', label: 'Disponibilidad para incorporarte', required: true, options: ['Inmediata', 'En 15 días', 'En 1 mes'] }),
      f({ id: 'comentarios', type: 'textarea', label: 'Obras destacadas o algo que añadir' }),
    ],
  },
  {
    id: 'cmp_electricista',
    siteId: 'site_valencia',
    brandId: 'brand_construccion',
    slug: 'electricista-valencia',
    title: 'Electricista',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-30T09:00:00.000Z',
    branding: {
      headline: 'Electricista, Valencia',
      welcome: 'Instalaciones en obra y mantenimiento. Cuéntanos tu experiencia.',
      thanks: 'Candidatura recibida. Te contactamos para concretar una entrevista.',
      accent: '#2f6db5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'email', type: 'email', label: 'Email', placeholder: 'tucorreo@email.com' }),
      f({ id: 'exp', type: 'number', label: 'Años de experiencia', required: true, placeholder: '0' }),
      f({ id: 'tipo', type: 'multiselect', label: 'Tipo de instalaciones que dominas', required: true, options: ['Vivienda', 'Industrial', 'Terciario y oficinas', 'Fotovoltaica', 'Mantenimiento'] }),
      f({ id: 'instalador', type: 'boolean', label: '¿Carnet de instalador autorizado en baja tensión?', required: true }),
      f({ id: 'carnet', type: 'boolean', label: '¿Carnet de conducir B?', required: true }),
      f({ id: 'disp', type: 'select', label: 'Disponibilidad para incorporarte', required: true, options: ['Inmediata', 'En 15 días', 'En 1 mes'] }),
    ],
  },
  // --- Logística · Madrid ---------------------------------------------------
  {
    id: 'cmp_mozo',
    siteId: 'site_madrid',
    brandId: 'brand_logistica',
    slug: 'mozo-almacen-madrid',
    title: 'Mozo/a de almacén',
    sector: 'Logística',
    location: 'Madrid',
    status: 'activa',
    createdAt: '2026-05-27T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/mozo-almacen-112233.htm',
    branding: {
      headline: 'Mozo/a de almacén, Madrid',
      welcome: 'Centro logístico en Madrid, turnos rotativos. Cuéntanos tu disponibilidad.',
      thanks: 'Candidatura recibida. Te llamamos para una entrevista breve.',
      accent: '#0f766e',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'carretillero', type: 'boolean', label: '¿Tienes carnet de carretillero?', required: true }),
      f({ id: 'turnos', type: 'multiselect', label: '¿Qué turnos puedes cubrir?', required: true, options: ['Mañana', 'Tarde', 'Noche'] }),
      f({ id: 'vehiculo', type: 'boolean', label: '¿Vehículo propio para llegar al polígono?', required: true }),
      f({ id: 'exp', type: 'number', label: 'Años en almacén o logística' }),
      f({ id: 'inicio', type: 'date', label: '¿Cuándo podrías empezar?' }),
    ],
  },
  {
    id: 'cmp_carretillero',
    siteId: 'site_madrid',
    brandId: 'brand_logistica',
    slug: 'carretillero-madrid',
    title: 'Carretillero/a',
    sector: 'Logística',
    location: 'Madrid',
    status: 'activa',
    createdAt: '2026-06-03T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/carretillero-445566.htm',
    branding: {
      headline: 'Carretillero/a, Madrid',
      welcome: 'Manejo de carretilla en centro logístico. Turnos rotativos y contrato estable.',
      thanks: 'Gracias por escribirnos. Revisamos tu perfil y te llamamos.',
      accent: '#0f766e',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'carnet_vigente', type: 'boolean', label: '¿Carnet de carretillas en vigor?', required: true }),
      f({ id: 'tipo_carretilla', type: 'multiselect', label: '¿Qué carretillas manejas?', required: true, options: ['Frontal', 'Retráctil', 'Transpaleta eléctrica', 'Recogepedidos', 'Apiladora'] }),
      f({ id: 'exp', type: 'number', label: 'Años de experiencia con carretilla', required: true, placeholder: '0' }),
      f({ id: 'turnos', type: 'multiselect', label: 'Turnos disponibles', required: true, options: ['Mañana', 'Tarde', 'Noche'] }),
      f({ id: 'inicio', type: 'date', label: 'Disponibilidad de incorporación' }),
    ],
  },
  {
    id: 'cmp_preparador',
    siteId: 'site_madrid',
    brandId: 'brand_logistica',
    slug: 'preparador-pedidos-madrid',
    title: 'Preparador/a de pedidos',
    sector: 'Logística',
    location: 'Madrid',
    status: 'pausada',
    createdAt: '2026-06-06T09:00:00.000Z',
    branding: {
      headline: 'Preparador/a de pedidos, Madrid',
      welcome: 'Picking con PDA en almacén. Turnos de mañana, tarde o noche.',
      thanks: 'Gracias. Revisamos tu candidatura y te contactamos.',
      accent: '#0f766e',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      f({ id: 'pda', type: 'boolean', label: '¿Experiencia con PDA o radiofrecuencia?', required: true }),
      f({ id: 'turnos', type: 'multiselect', label: '¿Qué turnos puedes cubrir?', required: true, options: ['Mañana', 'Tarde', 'Noche'] }),
      f({ id: 'findes', type: 'boolean', label: '¿Disponible algún fin de semana?' }),
      f({ id: 'exp', type: 'number', label: 'Años preparando pedidos' }),
    ],
  },
]

// ---------------------------------------------------------------------------
// Candidatos (envíos del formulario)
// ---------------------------------------------------------------------------

const STATUS_WEIGHTS: [CandidateStatus, number][] = [
  ['nuevo', 0.4],
  ['contactado', 0.24],
  ['entrevista', 0.15],
  ['contratado', 0.08],
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

// Rango de años de experiencia realista por puesto (el filtro numérico luce
// distinto en cada oficio: un peón con 1 año, un oficial con 15).
const EXP_RANGE: Record<string, [number, number]> = {
  cmp_peon: [0, 9],
  cmp_oficial: [4, 22],
  cmp_electricista: [2, 16],
  cmp_mozo: [0, 10],
  cmp_carretillero: [1, 14],
  cmp_preparador: [0, 8],
}

function answerFor(field: FormField, name: string, cmpId: string): Candidate['answers'][string] | undefined {
  switch (field.id) {
    case 'nombre':
      return name
    case 'telefono':
      return phone()
    case 'email': {
      const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
      return chance(0.85) ? `${slug}@${pick(['gmail.com', 'hotmail.com', 'outlook.es'])}` : ''
    }
  }
  switch (field.type) {
    case 'number': {
      if (field.id === 'edad') return String(between(18, 48))
      if (field.id === 'exp') {
        const [min, max] = EXP_RANGE[cmpId] ?? [0, 10]
        return String(between(min, max))
      }
      return String(between(0, 12))
    }
    case 'boolean':
      return chance(0.6)
    case 'select':
      return field.options ? pick(field.options) : ''
    case 'multiselect': {
      if (!field.options) return []
      let sel = field.options.filter(() => chance(0.45))
      if (field.required && sel.length === 0) sel = [pick(field.options)]
      return sel
    }
    case 'date':
      return dateSoon()
    case 'textarea':
      return chance(0.35)
        ? pick(['Puedo empezar ya mismo.', 'Tengo herramienta propia.', 'Busco estabilidad y proyecto largo.', 'Vivo cerca de la obra.', 'Carnet y PRL al día.', ''])
        : ''
    default:
      return ''
  }
}

// Valoración coherente con la fase: a quien avanza se le ha puesto más estrellas.
function ratingFor(status: CandidateStatus): number {
  switch (status) {
    case 'contratado': return between(4, 5)
    case 'entrevista': return between(3, 5)
    case 'contactado': return chance(0.5) ? between(3, 4) : 0
    case 'descartado': return chance(0.4) ? between(1, 2) : 0
    default: return chance(0.18) ? 4 : 0 // algún "nuevo" ya marcado como prometedor
  }
}

// Notas que dejaría un responsable real mientras trabaja el proceso.
const NOTES: Record<CandidateStatus, string[]> = {
  nuevo: [],
  contactado: [
    'No coge el teléfono, reintentar mañana.',
    'Le llamo a primera hora.',
    'Interesado, le paso la dirección de la obra.',
    'Pide 1.500 netos, dentro de banda.',
    'Queda en enviar el carnet por WhatsApp.',
  ],
  entrevista: [
    'Entrevista el jueves a las 10:00.',
    'Cita confirmada, trae documentación.',
    'Buen perfil, pendiente de verle en obra.',
    'Segunda entrevista con el encargado.',
  ],
  contratado: [
    'Incorporación el lunes.',
    'Contrato firmado, alta cursada.',
    'Empieza la semana que viene.',
  ],
  descartado: [
    'Sin la experiencia que pedimos.',
    'Buscaba jornada parcial.',
    'No tiene el carnet requerido.',
    'Ya ha encontrado otro trabajo.',
    'No se presentó a la entrevista.',
  ],
}
const NOTE_CHANCE: Record<CandidateStatus, number> = {
  nuevo: 0,
  contactado: 0.6,
  entrevista: 0.9,
  contratado: 1,
  descartado: 0.5,
}
function noteFor(status: CandidateStatus): string {
  if (chance(1 - NOTE_CHANCE[status])) return ''
  const pool = NOTES[status]
  return pool.length ? pick(pool) : ''
}

// Volumen por puesto: logística recibe muchas más candidaturas que un oficio
// cualificado. Enseña de un vistazo el valor de tenerlo todo ordenado.
const COUNTS: Record<string, number> = {
  cmp_peon: 22,
  cmp_oficial: 14,
  cmp_electricista: 9,
  cmp_mozo: 31,
  cmp_carretillero: 17,
  cmp_preparador: 12,
}
const DAYS_OPEN: Record<string, number> = {
  cmp_peon: 28,
  cmp_oficial: 22,
  cmp_electricista: 16,
  cmp_mozo: 19,
  cmp_carretillero: 12,
  cmp_preparador: 9,
}

const candidates: Candidate[] = []
let n = 0
for (const cmp of campaigns) {
  const total = COUNTS[cmp.id] ?? 8
  for (let i = 0; i < total; i++) {
    const name = `${pick(NOMBRES)} ${pick(APELLIDOS)}`
    const answers: Candidate['answers'] = {}
    for (const field of cmp.fields) {
      const v = answerFor(field, name, cmp.id)
      if (v !== undefined) answers[field.id] = v
    }
    const status: CandidateStatus = i < 2 ? 'nuevo' : weightedStatus() // los 2 primeros (más recientes) siempre nuevos
    candidates.push({
      id: `cand_${++n}`,
      campaignId: cmp.id,
      answers,
      status,
      submittedAt: dateAgo(DAYS_OPEN[cmp.id] ?? 20),
      source: pick(SOURCES),
      rating: ratingFor(status),
      notes: noteFor(status),
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

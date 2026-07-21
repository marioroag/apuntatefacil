import type {
  Brand,
  Campaign,
  Candidate,
  CandidateSource,
  CandidateStatus,
  AppData,
  FormField,
  Site,
  Tag,
  TeamRequest,
  TeamRequestComment,
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

// Reloj narrativo del seed estático. Al hidratar la demo se desplaza todo
// hasta Date.now() (ver freshenDemoData) para que no envejezca.
export const DEMO_SEED_NOW_MS = Date.parse('2026-07-17T12:00:00.000Z')

// Fechas repartidas hacia atrás desde el "ahora" narrativo del seed.
function dateAgo(maxDaysAgo: number) {
  const end = DEMO_SEED_NOW_MS
  const ms = end - Math.floor(rnd() * maxDaysAgo) * 86400000 - Math.floor(rnd() * 86400000)
  return new Date(ms).toISOString()
}

// Fecha de incorporación: próximas semanas desde el reloj del seed.
function dateSoon() {
  const start = DEMO_SEED_NOW_MS
  return new Date(start + between(1, 28) * 86400000).toISOString().slice(0, 10)
}

const f = (field: Omit<FormField, 'required'> & { required?: boolean }): FormField => ({
  required: false,
  ...field,
})

const SYS_NOMBRE = f({ id: 'nombre', type: 'text', label: 'Nombre y apellidos', required: true, system: true, placeholder: 'Tu nombre completo' })
const SYS_TEL = f({ id: 'telefono', type: 'phone', label: 'Teléfono', required: true, system: true, placeholder: '600 000 000' })
const SYS_EMAIL = f({ id: 'email', type: 'email', label: 'Email', required: true, placeholder: 'nombre@email.com' })

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
    slug: 'k7p2m9x4a1', // slug = id opaco (como newSlug); el título va aparte en la URL
    title: 'Peón de albañil',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-18T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/peon-albanil-987654.htm',
    branding: {
      welcome: 'Obra nueva y reforma en Valencia y alrededores. Déjanos tus datos y te llamamos en 24-48 h.',
      thanks: 'Recibido. Revisamos tu candidatura y te contactamos por teléfono. Mucha suerte.',
      accent: '#2f6db5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      SYS_EMAIL,
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
    slug: 'q3w8r5t1n6',
    title: 'Oficial de 1ª (albañil)',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-24T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/oficial-primera-654321.htm',
    branding: {
      welcome: 'Buscamos oficial con experiencia para obra en marcha. Proyecto estable.',
      thanks: 'Gracias. Si encajas con el puesto, te llamamos esta misma semana.',
      accent: '#2f6db5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      SYS_EMAIL,
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
    slug: 'z2c5v8b3l9',
    title: 'Electricista',
    sector: 'Construcción',
    location: 'Valencia',
    status: 'activa',
    createdAt: '2026-05-30T09:00:00.000Z',
    branding: {
      welcome: 'Instalaciones en obra y mantenimiento. Cuéntanos tu experiencia.',
      thanks: 'Candidatura recibida. Te contactamos para concretar una entrevista.',
      accent: '#2f6db5',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      SYS_EMAIL,
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
    slug: 'h4j7f1d6s2',
    title: 'Mozo/a de almacén',
    sector: 'Logística',
    location: 'Madrid',
    status: 'activa',
    createdAt: '2026-05-27T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/mozo-almacen-112233.htm',
    branding: {
      welcome: 'Centro logístico en Madrid, turnos rotativos. Cuéntanos tu disponibilidad.',
      thanks: 'Candidatura recibida. Te llamamos para una entrevista breve.',
      accent: '#0f766e',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      SYS_EMAIL,
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
    slug: 'r9t3y6u2i8',
    title: 'Carretillero/a',
    sector: 'Logística',
    location: 'Madrid',
    status: 'activa',
    createdAt: '2026-06-03T09:00:00.000Z',
    milanunciosUrl: 'https://www.milanuncios.com/ofertas-de-empleo/carretillero-445566.htm',
    branding: {
      welcome: 'Manejo de carretilla en centro logístico. Turnos rotativos y contrato estable.',
      thanks: 'Gracias por escribirnos. Revisamos tu perfil y te llamamos.',
      accent: '#0f766e',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      SYS_EMAIL,
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
    slug: 'm1n8b4v7c3',
    title: 'Preparador/a de pedidos',
    sector: 'Logística',
    location: 'Madrid',
    status: 'pausada',
    createdAt: '2026-06-06T09:00:00.000Z',
    branding: {
      welcome: 'Picking con PDA en almacén. Turnos de mañana, tarde o noche.',
      thanks: 'Gracias. Revisamos tu candidatura y te contactamos.',
      accent: '#0f766e',
      showLogo: true,
    },
    fields: [
      SYS_NOMBRE,
      SYS_TEL,
      SYS_EMAIL,
      f({ id: 'pda', type: 'boolean', label: '¿Experiencia con PDA o radiofrecuencia?', required: true }),
      f({ id: 'turnos', type: 'multiselect', label: '¿Qué turnos puedes cubrir?', required: true, options: ['Mañana', 'Tarde', 'Noche'] }),
      f({ id: 'findes', type: 'boolean', label: '¿Disponible algún fin de semana?' }),
      f({ id: 'exp', type: 'number', label: 'Años preparando pedidos' }),
    ],
  },
]

// ---------------------------------------------------------------------------
// Etiquetas (vocabulario de la empresa demo)
// ---------------------------------------------------------------------------
// Clasificación libre que pondría un responsable real mientras tría. Monocromo:
// la UI las pinta en gris (nunca color de estado). Sirven para enseñar el filtro.
export const SEED_TAGS: Tag[] = [
  { id: 'tag_buen_perfil', name: 'Buen perfil' },
  { id: 'tag_recontactar', name: 'Recontactar' },
  { id: 'tag_doc_ok', name: 'Documentación OK' },
  { id: 'tag_cerca_obra', name: 'Cerca de la obra' },
  { id: 'tag_turno_noche', name: 'Turno noche' },
  { id: 'tag_vehiculo', name: 'Vehículo propio' },
  { id: 'tag_no_encaja', name: 'No encaja ahora' },
]

// Etiquetas plausibles según la fase del candidato (no se ponen al azar puro: a
// quien avanza se le suele etiquetar más). Devuelve 0..3 ids sin repetir.
function tagsForStatus(status: CandidateStatus): string[] {
  const out: string[] = []
  const add = (id: string, p: number) => {
    if (chance(p) && !out.includes(id)) out.push(id)
  }
  switch (status) {
    case 'contratado':
      add('tag_buen_perfil', 0.95)
      add('tag_doc_ok', 0.9)
      add('tag_vehiculo', 0.35)
      break
    case 'entrevista':
      add('tag_buen_perfil', 0.85)
      add('tag_doc_ok', 0.65)
      add('tag_cerca_obra', 0.45)
      add('tag_vehiculo', 0.3)
      break
    case 'contactado':
      add('tag_recontactar', 0.7)
      add('tag_cerca_obra', 0.45)
      add('tag_buen_perfil', 0.4)
      add('tag_turno_noche', 0.25)
      add('tag_vehiculo', 0.2)
      break
    case 'descartado':
      add('tag_no_encaja', 0.85)
      break
    default: // nuevo
      add('tag_buen_perfil', 0.35)
      add('tag_cerca_obra', 0.3)
      add('tag_turno_noche', 0.2)
      break
  }
  return out.slice(0, 3)
}

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

function answerFor(field: FormField, name: string, cmpId: string, candidateNumber: number): Candidate['answers'][string] | undefined {
  switch (field.id) {
    case 'nombre':
      return name
    case 'telefono':
      return phone()
    case 'email': {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]+/g, '.')
        .replace(/^\.|\.$/g, '')
      const domains = ['gmail.com', 'hotmail.com', 'outlook.es']
      return `${slug}${candidateNumber}@${domains[candidateNumber % domains.length]}`
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

// Volumen por puesto: denso a propósito (80–160) para que filtros, etiquetas
// y export se sientan como una ETT real en plena oleada.
const COUNTS: Record<string, number> = {
  cmp_peon: 142,
  cmp_oficial: 96,
  cmp_electricista: 84,
  cmp_mozo: 158,
  cmp_carretillero: 118,
  cmp_preparador: 88,
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
    const candidateNumber = n + 1
    const answers: Candidate['answers'] = {}
    for (const field of cmp.fields) {
      const v = answerFor(field, name, cmp.id, candidateNumber)
      if (v !== undefined) answers[field.id] = v
    }
    const status: CandidateStatus = i < 2 ? 'nuevo' : weightedStatus() // los 2 primeros (más recientes) siempre nuevos
    candidates.push({
      id: `cand_${candidateNumber}`,
      campaignId: cmp.id,
      answers,
      status,
      submittedAt: dateAgo(DAYS_OPEN[cmp.id] ?? 20),
      source: pick(SOURCES),
      rating: ratingFor(status),
      notes: noteFor(status),
      tagIds: tagsForStatus(status),
    })
    n = candidateNumber
  }
}
// Orden: más recientes primero
candidates.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

// Fuerza un poco más de etiquetado visible: en una ETT real casi nadie se deja
// sin marcar cuando ya se ha abierto el perfil.
for (const c of candidates) {
  if (c.tagIds.length > 0) continue
  if (c.status === 'nuevo' && !chance(0.45)) continue
  c.tagIds = tagsForStatus(c.status === 'nuevo' ? 'contactado' : c.status)
}

export const SEED: AppData = {
  company: { name: 'Tu empresa', plan: 'multi', accent: '#374cce' },
  sites,
  campaigns,
  candidates,
}

// ---------------------------------------------------------------------------
// Tablón de peticiones (demo). Conversaciones realistas: proponer, contactar,
// actualizar y cerrar. Tres personas (tú, Laura, Sergio) + Ana en invitaciones.
// ---------------------------------------------------------------------------

const seedOf = (campaignId: string) => SEED.candidates.filter((c) => c.campaignId === campaignId)
const carretilleros = seedOf('cmp_carretillero')
const mozos = seedOf('cmp_mozo')
const peones = seedOf('cmp_peon')
const electricistas = seedOf('cmp_electricista')
const oficiales = seedOf('cmp_oficial')
const preparadores = seedOf('cmp_preparador')

// Marca en la base a los candidatos que salen en el tablón (parece trabajo real).
function markProposed(c: Candidate | undefined, status: CandidateStatus, tags: string[]) {
  if (!c) return
  c.status = status
  c.tagIds = [...new Set([...c.tagIds, ...tags])].slice(0, 3)
  if (!c.notes) {
    c.notes =
      status === 'entrevista'
        ? 'Propuesto en Equipo. Entrevista pendiente.'
        : status === 'contactado'
          ? 'Propuesto en Equipo. Contactado por teléfono.'
          : c.notes
  }
}

markProposed(carretilleros[0], 'entrevista', ['tag_buen_perfil', 'tag_turno_noche', 'tag_doc_ok'])
markProposed(carretilleros[1], 'contactado', ['tag_recontactar', 'tag_turno_noche'])
markProposed(carretilleros[2], 'contactado', ['tag_buen_perfil', 'tag_doc_ok'])
markProposed(electricistas[0], 'entrevista', ['tag_buen_perfil', 'tag_vehiculo', 'tag_doc_ok'])
markProposed(electricistas[1], 'contactado', ['tag_vehiculo', 'tag_recontactar'])
markProposed(peones[0], 'contactado', ['tag_buen_perfil', 'tag_cerca_obra'])
markProposed(peones[1], 'contactado', ['tag_cerca_obra', 'tag_doc_ok'])
markProposed(peones[2], 'entrevista', ['tag_buen_perfil', 'tag_cerca_obra'])
markProposed(peones[3], 'nuevo', ['tag_buen_perfil'])
markProposed(peones[4], 'contactado', ['tag_recontactar'])
markProposed(mozos[0], 'contratado', ['tag_buen_perfil', 'tag_doc_ok'])
markProposed(mozos[1], 'contratado', ['tag_buen_perfil', 'tag_cerca_obra'])
markProposed(oficiales[0], 'contratado', ['tag_buen_perfil', 'tag_doc_ok', 'tag_vehiculo'])
markProposed(preparadores[0], 'entrevista', ['tag_buen_perfil', 'tag_turno_noche'])
markProposed(preparadores[1], 'contactado', ['tag_recontactar'])

export const SEED_TEAM_REQUESTS: TeamRequest[] = [
  {
    id: 'req_carretilleros',
    title: '2 carretilleros con carnet para el turno de noche',
    body:
      'Nos entra un pico de trabajo la semana que viene en la nave de Madrid. Necesito dos personas con carnet de carretilla en vigor y experiencia con retráctil. Revisad los que ya tenemos antes de tirar de anuncio nuevo.\n\nHorario: 22:00 a 06:00, lunes a viernes. Si alguien tiene disponibilidad parcial también lo valoramos, pero preferimos jornada completa. El cliente pide gente fiable, sin bajas recientes y con ganas de quedarse.',
    status: 'abierta',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    siteId: 'site_madrid',
    createdAt: '2026-07-13T09:20:00.000Z',
    completedBy: null,
    lastActivityAt: '2026-07-17T09:15:00.000Z',
    lastActivityBy: 'demo-laura',
    commentCount: 8,
    proposals: [
      { candidateId: carretilleros[0]?.id ?? 'cand_77', commentId: 'reqc_c2', proposedBy: 'demo-sergio' },
      { candidateId: carretilleros[1]?.id ?? 'cand_81', commentId: 'reqc_c2', proposedBy: 'demo-sergio' },
      { candidateId: carretilleros[2]?.id ?? 'cand_82', commentId: 'reqc_c5', proposedBy: 'demo-user' },
    ],
  },
  {
    id: 'req_electricistas',
    title: '3 electricistas oficiales para una reforma en Paterna',
    body: 'Cliente nuevo, reforma integral de un local. Empieza el 1 de agosto y son unas 6 semanas. Prioridad a gente con vehículo propio y herramienta básica.',
    status: 'abierta',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    siteId: 'site_valencia',
    createdAt: '2026-07-12T11:05:00.000Z',
    completedBy: null,
    lastActivityAt: '2026-07-16T16:50:00.000Z',
    lastActivityBy: 'demo-sergio',
    commentCount: 7,
    proposals: [
      { candidateId: electricistas[0]?.id ?? 'cand_30', commentId: 'reqc_e3', proposedBy: 'demo-laura' },
      { candidateId: electricistas[1]?.id ?? 'cand_31', commentId: 'reqc_e5', proposedBy: 'demo-sergio' },
    ],
  },
  {
    id: 'req_peones',
    title: 'Cuadrilla de peones para obra en Alboraya',
    body: 'Arrancamos el lunes. Hacen falta 4 peones con EPIs propios y disponibilidad inmediata. Preferible gente que ya haya pasado por nosotros.',
    status: 'abierta',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    siteId: 'site_valencia',
    createdAt: '2026-07-14T08:10:00.000Z',
    completedBy: null,
    lastActivityAt: '2026-07-17T08:40:00.000Z',
    lastActivityBy: 'demo-user',
    commentCount: 6,
    proposals: [
      { candidateId: peones[0]?.id ?? 'cand_1', commentId: 'reqc_p2', proposedBy: 'demo-laura' },
      { candidateId: peones[1]?.id ?? 'cand_2', commentId: 'reqc_p2', proposedBy: 'demo-laura' },
      { candidateId: peones[2]?.id ?? 'cand_3', commentId: 'reqc_p2', proposedBy: 'demo-laura' },
      { candidateId: peones[3]?.id ?? 'cand_4', commentId: 'reqc_p2', proposedBy: 'demo-laura' },
      { candidateId: peones[4]?.id ?? 'cand_5', commentId: 'reqc_p4', proposedBy: 'demo-user' },
    ],
  },
  {
    id: 'req_inventario',
    title: 'Refuerzo para el inventario del sábado',
    body: 'Dos mozos para el recuento anual en Madrid, jornada de 8 a 15. Se paga plus de fin de semana.',
    status: 'completada',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    siteId: 'site_madrid',
    createdAt: '2026-07-08T08:30:00.000Z',
    completedBy: 'demo-user',
    lastActivityAt: '2026-07-10T13:10:00.000Z',
    lastActivityBy: 'demo-user',
    commentCount: 6,
    proposals: [
      { candidateId: mozos[0]?.id ?? 'cand_46', commentId: 'reqc_i2', proposedBy: 'demo-user' },
      { candidateId: mozos[1]?.id ?? 'cand_52', commentId: 'reqc_i2', proposedBy: 'demo-user' },
    ],
  },
  {
    id: 'req_oficiales',
    title: 'Oficial de 1ª para un cliente habitual en Valencia',
    body: 'Sustitución de 3 semanas. Si tenéis alguien en entrevista o contactado, mejor; no hace falta publicar anuncio nuevo.',
    status: 'completada',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    siteId: 'site_valencia',
    createdAt: '2026-07-05T07:50:00.000Z',
    completedBy: 'demo-laura',
    lastActivityAt: '2026-07-07T18:20:00.000Z',
    lastActivityBy: 'demo-laura',
    commentCount: 5,
    proposals: [
      { candidateId: oficiales[0]?.id ?? 'cand_20', commentId: 'reqc_o2', proposedBy: 'demo-sergio' },
    ],
  },
  {
    id: 'req_finde',
    title: '2 preparadores para el fin de semana en Madrid',
    body: 'Pico de pedidos el sábado y el domingo. Turno de mañana. Si ya tienen PDA, perfecto.',
    status: 'completada',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    siteId: 'site_madrid',
    createdAt: '2026-07-02T10:00:00.000Z',
    completedBy: 'demo-sergio',
    lastActivityAt: '2026-07-04T19:05:00.000Z',
    lastActivityBy: 'demo-sergio',
    commentCount: 5,
    proposals: [
      { candidateId: preparadores[0]?.id ?? 'cand_90', commentId: 'reqc_f2', proposedBy: 'demo-laura' },
      { candidateId: preparadores[1]?.id ?? 'cand_91', commentId: 'reqc_f3', proposedBy: 'demo-user' },
    ],
  },
]

export const SEED_TEAM_COMMENTS: TeamRequestComment[] = [
  // --- Carretilleros (abierta, mucho ida y vuelta) ---
  {
    id: 'reqc_c1',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Miro la base de Madrid y te digo en un rato. ¿Sirve gente que solo haga noches de lunes a jueves?',
    createdAt: '2026-07-13T10:05:00.000Z',
  },
  {
    id: 'reqc_c1b',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Mejor semana completa. Si alguno solo puede 4 noches, lo dejamos de reserva.',
    createdAt: '2026-07-13T10:40:00.000Z',
  },
  {
    id: 'reqc_c2',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Te propongo estos dos. Los llamé el mes pasado: carnet en vigor y el primero ya trabajó con retráctil.',
    createdAt: '2026-07-13T16:45:00.000Z',
  },
  {
    id: 'reqc_c3',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Buenos perfiles. ¿Les escribes tú o lo hago yo?',
    createdAt: '2026-07-14T09:10:00.000Z',
  },
  {
    id: 'reqc_c4',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Les acabo de llamar. El primero confirma entrevista mañana a las 11. El segundo no coge; le escribo por WhatsApp.',
    createdAt: '2026-07-14T17:25:00.000Z',
  },
  {
    id: 'reqc_c5',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Añado uno más por si el segundo no responde. Yo le contacto esta tarde.',
    createdAt: '2026-07-15T12:30:00.000Z',
  },
  {
    id: 'reqc_c6',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'El segundo ha contestado: puede empezar el lunes. El de reserva también está contactado.',
    createdAt: '2026-07-16T18:20:00.000Z',
  },
  {
    id: 'reqc_c7',
    requestId: 'req_carretilleros',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Genial. Dejo la petición abierta hasta confirmar altas. Si falla alguno, tiramos del tercero.',
    createdAt: '2026-07-17T09:15:00.000Z',
  },

  // --- Electricistas (abierta) ---
  {
    id: 'reqc_e1',
    requestId: 'req_electricistas',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: '¿El cliente acepta autónomos o solo contrato ETT?',
    createdAt: '2026-07-12T15:20:00.000Z',
  },
  {
    id: 'reqc_e1b',
    requestId: 'req_electricistas',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Solo ETT, con alta al día. Vehículo propio casi obligatorio.',
    createdAt: '2026-07-13T08:05:00.000Z',
  },
  {
    id: 'reqc_e2',
    requestId: 'req_electricistas',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'En Valencia tenemos pocos oficiales frescos. ¿Bajo el listón a gente con 2 años si traen furgoneta?',
    createdAt: '2026-07-13T11:40:00.000Z',
  },
  {
    id: 'reqc_e2b',
    requestId: 'req_electricistas',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Sí, si el perfil es limpio. Prioridad: que puedan empezar el 1.',
    createdAt: '2026-07-13T12:05:00.000Z',
  },
  {
    id: 'reqc_e3',
    requestId: 'req_electricistas',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Este está en entrevista y tiene furgoneta. ¿Le llamo yo para cerrar fecha?',
    createdAt: '2026-07-15T09:40:00.000Z',
  },
  {
    id: 'reqc_e4',
    requestId: 'req_electricistas',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Sí, llámale. Si confirma, ya nos falta encontrar dos más.',
    createdAt: '2026-07-15T10:10:00.000Z',
  },
  {
    id: 'reqc_e5',
    requestId: 'req_electricistas',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Propongo este otro: le escribí ayer y responde rápido. Todavía no tiene entrevista.',
    createdAt: '2026-07-16T16:50:00.000Z',
  },

  // --- Peones (abierta, muchas propuestas) ---
  {
    id: 'reqc_p1',
    requestId: 'req_peones',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Filtro por “Cerca de la obra” y gente que ya pasó por nosotros. Te paso un primer lote.',
    createdAt: '2026-07-14T10:20:00.000Z',
  },
  {
    id: 'reqc_p2',
    requestId: 'req_peones',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Estos cuatro. Los dos primeros ya están contactados; el tercero tiene entrevista pendiente.',
    createdAt: '2026-07-14T14:00:00.000Z',
  },
  {
    id: 'reqc_p3',
    requestId: 'req_peones',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'El cuarto no me convence del todo (poca constancia el año pasado). ¿Sacamos uno más de la base?',
    createdAt: '2026-07-15T09:00:00.000Z',
  },
  {
    id: 'reqc_p4',
    requestId: 'req_peones',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Añado este. Acabo de llamarle: puede el lunes. Marco al cuarto como reserva.',
    createdAt: '2026-07-16T11:05:00.000Z',
  },
  {
    id: 'reqc_p5',
    requestId: 'req_peones',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Perfecto. Yo confirmo altas de los tres seguros y dejo el resto en el hilo.',
    createdAt: '2026-07-16T15:30:00.000Z',
  },
  {
    id: 'reqc_p6',
    requestId: 'req_peones',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Actualizo: ya tengo WhatsApp de confirmación de dos. Seguimos abiertos por si cae alguno.',
    createdAt: '2026-07-17T08:40:00.000Z',
  },

  // --- Inventario (completada) ---
  {
    id: 'reqc_i1',
    requestId: 'req_inventario',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: '¿Solo sábado o también domingo por la mañana?',
    createdAt: '2026-07-08T09:15:00.000Z',
  },
  {
    id: 'reqc_i1b',
    requestId: 'req_inventario',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Solo sábado, 8 a 15. Plus de fin de semana incluido.',
    createdAt: '2026-07-08T09:40:00.000Z',
  },
  {
    id: 'reqc_i2',
    requestId: 'req_inventario',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Estos dos viven cerca de la nave y tienen disponibilidad inmediata.',
    createdAt: '2026-07-09T10:00:00.000Z',
  },
  {
    id: 'reqc_i3',
    requestId: 'req_inventario',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Les he escrito por WhatsApp. Confirman los dos. Los paso a contactado.',
    createdAt: '2026-07-09T17:40:00.000Z',
  },
  {
    id: 'reqc_i4',
    requestId: 'req_inventario',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Hecho. El sábado estuvieron puntuales. Gracias al equipo.',
    createdAt: '2026-07-10T12:55:00.000Z',
  },
  {
    id: 'reqc_i5',
    requestId: 'req_inventario',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Marco la petición como completada y dejo a los dos como contratados del sábado.',
    createdAt: '2026-07-10T13:10:00.000Z',
  },

  // --- Oficiales (completada) ---
  {
    id: 'reqc_o1',
    requestId: 'req_oficiales',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Miro quién está en entrevista en Valencia. Te digo en media hora.',
    createdAt: '2026-07-05T08:20:00.000Z',
  },
  {
    id: 'reqc_o2',
    requestId: 'req_oficiales',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Este encaja: vehículo, documentación OK y ya le conocemos.',
    createdAt: '2026-07-05T11:05:00.000Z',
  },
  {
    id: 'reqc_o3',
    requestId: 'req_oficiales',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Le llamo ahora. Si confirma, cerramos sin publicar anuncio.',
    createdAt: '2026-07-05T11:30:00.000Z',
  },
  {
    id: 'reqc_o4',
    requestId: 'req_oficiales',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Confirmado. Empieza el lunes. Alta hecha.',
    createdAt: '2026-07-07T17:50:00.000Z',
  },
  {
    id: 'reqc_o5',
    requestId: 'req_oficiales',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Completo la petición. Cliente contento.',
    createdAt: '2026-07-07T18:20:00.000Z',
  },

  // --- Finde preparadores (completada) ---
  {
    id: 'reqc_f1',
    requestId: 'req_finde',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: '¿Aceptáis gente sin PDA si aprende rápido?',
    createdAt: '2026-07-02T11:10:00.000Z',
  },
  {
    id: 'reqc_f1b',
    requestId: 'req_finde',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Sí, pero preferible con PDA. Propón lo que tengas.',
    createdAt: '2026-07-02T11:35:00.000Z',
  },
  {
    id: 'reqc_f2',
    requestId: 'req_finde',
    authorUserId: 'demo-laura',
    authorEmail: 'laura@tuempresa.es',
    body: 'Esta tiene PDA y turno mañana. La contacto yo.',
    createdAt: '2026-07-02T16:00:00.000Z',
  },
  {
    id: 'reqc_f3',
    requestId: 'req_finde',
    authorUserId: 'demo-user',
    authorEmail: 'demo@apuntatefacil.com',
    body: 'Y este otro. Le escribí: confirma sábado y domingo.',
    createdAt: '2026-07-03T10:20:00.000Z',
  },
  {
    id: 'reqc_f4',
    requestId: 'req_finde',
    authorUserId: 'demo-sergio',
    authorEmail: 'sergio@tuempresa.es',
    body: 'Los dos cubrieron el pico. Cierro la petición.',
    createdAt: '2026-07-04T19:05:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// Miembros e invitaciones (solo demo). Mismos emails que el tablón para que
// avatares y nombres cuadren entre pestañas.
// ---------------------------------------------------------------------------

export type DemoMember = {
  user_id: string
  email: string
  role: string
  is_self: boolean
  site_ids: string[]
}

export type DemoInvitation = {
  id: string
  email: string
  token: string
  created_at: string
  role: string
}

export const SEED_MEMBERS: DemoMember[] = [
  {
    user_id: 'demo-user',
    email: 'demo@apuntatefacil.com',
    role: 'owner',
    is_self: true,
    site_ids: [],
  },
  {
    user_id: 'demo-laura',
    email: 'laura@tuempresa.es',
    role: 'member',
    is_self: false,
    site_ids: [],
  },
  {
    user_id: 'demo-sergio',
    email: 'sergio@tuempresa.es',
    role: 'encargado',
    is_self: false,
    site_ids: ['site_madrid'],
  },
]

export const SEED_INVITES: DemoInvitation[] = [
  {
    id: 'inv_ana',
    email: 'ana@tuempresa.es',
    token: 'demo-invite-ana',
    created_at: '2026-07-15T10:00:00.000Z',
    role: 'member',
  },
]

// ---------------------------------------------------------------------------
// Freshen: la demo no envejece. El seed usa fechas fijas (reloj narrativo);
// al cargar/reiniciar desplazamos todo para que lo más reciente sea "ahora".
// ---------------------------------------------------------------------------

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseDemoTime(iso: string): number {
  const t = Date.parse(DAY_ONLY.test(iso) ? `${iso}T12:00:00.000Z` : iso)
  return Number.isNaN(t) ? NaN : t
}

function shiftDemoTime(iso: string, deltaMs: number): string {
  if (DAY_ONLY.test(iso)) {
    const d = new Date(`${iso}T12:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + Math.round(deltaMs / 86_400_000))
    return d.toISOString().slice(0, 10)
  }
  return new Date(Date.parse(iso) + deltaMs).toISOString()
}

/** Desplaza un ISO del reloj del seed hasta el instante de acceso. */
export function freshenDemoIso(iso: string, now = Date.now()): string {
  return shiftDemoTime(iso, now - DEMO_SEED_NOW_MS)
}

export type DemoFreshable = {
  campaigns: Campaign[]
  candidates: Candidate[]
  teamRequests: TeamRequest[]
  teamComments: TeamRequestComment[]
}

/** Clona el bundle de demo y ancla la fecha más reciente a `now`. */
export function freshenDemoData<T extends DemoFreshable>(data: T, now = Date.now()): T {
  const clone = structuredClone(data)
  const times: number[] = []
  const note = (iso: string | null | undefined) => {
    if (!iso) return
    const t = parseDemoTime(iso)
    if (!Number.isNaN(t)) times.push(t)
  }

  for (const c of clone.campaigns) note(c.createdAt)
  for (const c of clone.candidates) note(c.submittedAt)
  for (const r of clone.teamRequests) {
    note(r.createdAt)
    note(r.lastActivityAt)
  }
  for (const c of clone.teamComments) note(c.createdAt)

  if (times.length === 0) return clone
  const delta = now - Math.max(...times)
  // Ya está al día (p. ej. el usuario acaba de escribir en esta sesión).
  if (Math.abs(delta) < 60_000) return clone

  for (const c of clone.campaigns) c.createdAt = shiftDemoTime(c.createdAt, delta)
  for (const c of clone.candidates) {
    c.submittedAt = shiftDemoTime(c.submittedAt, delta)
    // Fechas de respuesta (p. ej. disponibilidad): se mueven con el mismo delta,
    // pero no anclan el reloj (pueden ser futuras a propósito).
    for (const [k, v] of Object.entries(c.answers)) {
      if (typeof v === 'string' && DAY_ONLY.test(v)) c.answers[k] = shiftDemoTime(v, delta)
    }
  }
  for (const r of clone.teamRequests) {
    r.createdAt = shiftDemoTime(r.createdAt, delta)
    r.lastActivityAt = shiftDemoTime(r.lastActivityAt, delta)
  }
  for (const c of clone.teamComments) c.createdAt = shiftDemoTime(c.createdAt, delta)
  return clone
}

// ---------------------------------------------------------------------------
// Modelo de dominio de Apúntate Fácil
// ---------------------------------------------------------------------------
// Una empresa (cliente) crea "puestos" (campañas). Cada puesto tiene un
// formulario personalizable. El enlace del puesto se comparte con quien responde
// a un anuncio; cada envío del formulario crea un "candidato" en la base de
// datos del puesto. El cliente filtra y exporta a Excel.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'phone'
  | 'email'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'number'
  | 'date'
  | 'file'

export interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  options?: string[] // para select / multiselect
  /** Campos del sistema (nombre, teléfono) no se pueden borrar, solo reordenar. */
  system?: boolean
}

export interface Branding {
  welcome: string
  thanks: string
  accent: string // hex; por defecto hereda el de la empresa
  showLogo: boolean
}

export type CampaignStatus = 'activa' | 'pausada' | 'cerrada'

export interface Campaign {
  id: string
  slug: string // id del puesto en el enlace público /<marca>/<slug>/<nombre>
  title: string
  sector: string
  location: string
  status: CampaignStatus
  createdAt: string // ISO
  milanunciosUrl?: string
  fields: FormField[]
  branding: Branding
  siteId: string | null // sede a la que pertenece (Multi); null = sin sede
  brandId: string | null // marca a la que pertenece (Multi); null = sin marca
  notifyNew?: boolean // avisar por email al entrar un candidato (por defecto sí)
}

// Sede (Multi): agrupa puestos de un mismo local. Entidad propia, separada de marca.
export interface Site {
  id: string
  name: string
  city: string
}

// Marca (Multi): identidad reutilizable. Su apariencia se copia al puesto.
// Entidad propia, separada de sede. El nombre lo ve el candidato (vía RPC).
export interface Brand {
  id: string
  name: string
  accent: string
  welcome: string
  thanks: string
  showLogo: boolean
  logoPath: string | null // foto de perfil de la marca (bucket brand-assets o data: en demo)
  bannerPath: string | null // banner de cabecera
}

export type CandidateStatus =
  | 'nuevo'
  | 'contactado'
  | 'entrevista'
  | 'descartado'
  | 'contratado'

export type CandidateSource = 'milanuncios' | 'enlace' | 'qr' | 'prueba'

export interface Candidate {
  id: string
  campaignId: string
  /** Respuestas por id de campo. Valor string, string[] (multiselect) o boolean. */
  answers: Record<string, string | string[] | boolean>
  status: CandidateStatus
  submittedAt: string // ISO
  source: CandidateSource
  rating: number // 0..5 estrellas, 0 = sin valorar
  notes: string
  cvPath?: string // ruta del CV en Supabase Storage (bucket cvs), si lo adjuntó
  tagIds: string[] // ids de las etiquetas que el empresario le ha puesto (ver Tag)
}

// Etiqueta: clasificación libre que pone el empresario sobre los candidatos. Es
// vocabulario a nivel EMPRESA (se reutiliza entre puestos). El candidato nunca la
// ve. Siempre se pinta en gris neutro: nunca color de estado ni el índigo de marca.
export interface Tag {
  id: string
  name: string
}

export interface Company {
  name: string
  plan: 'trial' | 'esencial' | 'pro' | 'multi'
  accent: string // hex de marca de la empresa
}

// --- Vistas guardadas (Pro/Multi) -----------------------------------------
// Clave de orden de la tabla de candidatos (compartida por el panel y las vistas).
export type SortKey = 'nombre' | 'fecha' | 'estado'

export interface ValueFilter {
  fieldId: string
  label: string
  value: string
}

// Filtro de rango para preguntas numéricas (min y/o max, ambos opcionales).
export interface NumberFilter {
  fieldId: string
  label: string
  min: number | null
  max: number | null
}

// Lo que guarda una vista. Búsqueda, estados y orden son universales (valen en
// cualquier puesto); los filtros de valor dependen de los campos del formulario,
// por eso solo viajan en vistas con scope 'campaign'.
export interface SavedViewPayload {
  search: string
  statuses: CandidateStatus[]
  valueFilters: ValueFilter[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  ratingFilter?: number
  numberFilters?: NumberFilter[]
  // Ids de etiquetas seleccionadas. Universal (las etiquetas valen en cualquier
  // puesto), como estados u orden: viaja también en vistas globales.
  tagFilter?: string[]
}

export interface SavedView {
  id: string
  campaignId: string | null // null = global (todos los puestos)
  name: string
  payload: SavedViewPayload
}

export interface AppData {
  company: Company
  sites: Site[]
  campaigns: Campaign[]
  candidates: Candidate[]
}

// --- Tablón de peticiones de equipo ----------------------------------------
// Una petición es un encargo interno ("Necesito 3 electricistas en Tenerife
// Norte"): cualquier miembro la publica, los compañeros responden en hilo y
// proponen candidatos existentes; la completa el autor o el propietario.

export type TeamRequestStatus = 'abierta' | 'completada'

// Candidato propuesto en una petición. Solo ids: el nombre se resuelve contra
// el store (ya acotado por RLS) y si no es visible se pinta un chip degradado.
export interface TeamRequestProposal {
  candidateId: string
  commentId: string | null // en qué respuesta se propuso (null = desconocido)
  proposedBy: string | null
}

export interface TeamRequest {
  id: string
  title: string
  body: string
  status: TeamRequestStatus
  authorUserId: string | null
  authorEmail: string
  siteId: string | null
  createdAt: string // ISO
  completedBy: string | null
  lastActivityAt: string // ISO; responder/proponer/completar la "sube"
  lastActivityBy: string | null // para no contarte tu propia actividad
  commentCount: number
  proposals: TeamRequestProposal[]
}

export interface TeamRequestComment {
  id: string
  requestId: string
  authorUserId: string | null
  authorEmail: string
  body: string // '' permitido: respuesta solo con candidatos adjuntos
  createdAt: string // ISO
}

// --- Metadatos de presentación (no datos del modelo) ----------------------

export const STATUS_ORDER: CandidateStatus[] = [
  'nuevo',
  'contactado',
  'entrevista',
  'contratado',
  'descartado',
]

// Mapa de color FIJO. El indigo de marca NO aparece aquí: queda reservado a
// acción/nav/foco/selección. "nuevo" es slate neutro (no indigo) para no diluir
// el acento. "descartado" es slate apagado, NUNCA rojo (descartar es rutina).
export const STATUS_META: Record<
  CandidateStatus,
  { label: string; dot: string; chip: string }
> = {
  nuevo: { label: 'Nuevo', dot: 'bg-slate-500', chip: 'bg-slate-100 text-slate-700 ring-slate-200' },
  contactado: { label: 'Contactado', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  entrevista: { label: 'Entrevista', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  contratado: { label: 'Contratado', dot: 'bg-green-500', chip: 'bg-green-50 text-green-700 ring-green-200' },
  descartado: { label: 'Descartado', dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-500 ring-slate-200' },
}

// Estados de petición del tablón. Paleta de ESTADO propia (nunca el índigo de
// marca): abierta = azul (en curso, como 'contactado'), completada = verde
// (resuelto, como 'contratado'). Siempre punto de color + texto.
export const TEAM_REQUEST_STATUS_META: Record<
  TeamRequestStatus,
  { label: string; dot: string; chip: string }
> = {
  abierta: { label: 'Abierta', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  completada: { label: 'Completada', dot: 'bg-green-500', chip: 'bg-green-50 text-green-700 ring-green-200' },
}

export const SOURCE_META: Record<CandidateSource, { label: string }> = {
  milanuncios: { label: 'Milanuncios' },
  enlace: { label: 'Enlace' },
  qr: { label: 'QR' },
  // La candidatura que el dueño se envía a sí mismo al probar su enlace durante
  // el onboarding. Chip neutro en la lista; puede borrarse para liberar cupo.
  prueba: { label: 'Prueba' },
}

export const FIELD_TYPE_META: Record<
  FieldType,
  { label: string; icon: string; hint: string }
> = {
  text: { label: 'Texto corto', icon: 'Type', hint: 'Una línea: nombre, ciudad...' },
  textarea: { label: 'Texto largo', icon: 'AlignLeft', hint: 'Varias líneas: experiencia, motivación...' },
  phone: { label: 'Teléfono', icon: 'Phone', hint: 'Número de contacto' },
  email: { label: 'Email', icon: 'Mail', hint: 'Correo electrónico' },
  select: { label: 'Desplegable', icon: 'ChevronsUpDown', hint: 'Elegir una opción' },
  multiselect: { label: 'Selección múltiple', icon: 'ListChecks', hint: 'Elegir varias opciones' },
  boolean: { label: 'Sí / No', icon: 'ToggleLeft', hint: '¿Tiene carnet? ¿Vehículo?' },
  number: { label: 'Número', icon: 'Hash', hint: 'Años de experiencia, edad...' },
  date: { label: 'Fecha', icon: 'Calendar', hint: 'Disponibilidad, nacimiento...' },
  file: { label: 'Archivo', icon: 'Paperclip', hint: 'CV, foto, documento' },
}

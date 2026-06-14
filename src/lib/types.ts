// ---------------------------------------------------------------------------
// Modelo de dominio de Criba
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
  /** Texto que ve el candidato como cabecera del formulario. */
  headline: string
  welcome: string
  thanks: string
  accent: string // hex; por defecto hereda el de la empresa
  showLogo: boolean
}

export type CampaignStatus = 'activa' | 'pausada' | 'cerrada'

export interface Campaign {
  id: string
  slug: string // parte del enlace público /a/:slug
  title: string
  sector: string
  location: string
  status: CampaignStatus
  createdAt: string // ISO
  milanunciosUrl?: string
  fields: FormField[]
  branding: Branding
}

export type CandidateStatus =
  | 'nuevo'
  | 'contactado'
  | 'entrevista'
  | 'descartado'
  | 'contratado'

export type CandidateSource = 'milanuncios' | 'enlace' | 'qr'

export interface Candidate {
  id: string
  campaignId: string
  /** Respuestas por id de campo. Valor string, string[] (multiselect) o boolean. */
  answers: Record<string, string | string[] | boolean>
  status: CandidateStatus
  submittedAt: string // ISO
  source: CandidateSource
  rating: number // 0..3 estrellas, 0 = sin valorar
  notes: string
  cvPath?: string // ruta del CV en Supabase Storage (bucket cvs), si lo adjuntó
}

export interface Company {
  name: string
  plan: 'free' | 'pro'
  accent: string // hex de marca de la empresa
}

export interface CribaData {
  company: Company
  campaigns: Campaign[]
  candidates: Candidate[]
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

export const SOURCE_META: Record<CandidateSource, { label: string }> = {
  milanuncios: { label: 'Milanuncios' },
  enlace: { label: 'Enlace' },
  qr: { label: 'QR' },
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

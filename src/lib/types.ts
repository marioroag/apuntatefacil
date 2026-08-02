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
  /** Respuesta personalizada y reutilizable al compartir el enlace del puesto. */
  shareReply?: string | null
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

export type CandidateInterestResponse = 'interested' | 'not_interested'

export type CandidateInterestState =
  | 'never'
  | 'sent'
  | 'no_response'
  | 'interested'
  | 'not_interested'
  | 'unavailable'

/** Triaje de IA (Meridian) de una candidatura. Lo produce la edge function
 *  `analyze-candidate` y se guarda en `candidates.ai`. Es una lectura asistida,
 *  NUNCA un veredicto: el merchant decide. `fit` (0..100) es "ajuste al puesto",
 *  orientativo. `error` presente = el último intento falló (permite reintentar). */
/**
 * Juicio del triaje sobre un criterio fijo. `no_consta` es "no hay dato", NO un
 * punto negativo. Las claves y los pesos viven en `analyze-candidate`: el número
 * lo calcula el servidor, aquí solo se guarda para poder explicarlo.
 */
export interface AiCriterion {
  clave: string
  valor: 'cumple' | 'parcial' | 'no_consta' | 'no_cumple'
}

export interface CandidateAI {
  summary: string
  highlights: string[]
  concerns: string[]
  fit: number // 0..100, ajuste al puesto (orientativo, nunca gate)
  /** De dónde sale `fit`. Ausente en análisis anteriores a jul 2026. */
  criterios?: AiCriterion[]
  model: string // procedencia: qué modelo lo generó
  analyzedAt: string // ISO
  cvUsed?: boolean // false = analizado solo con las respuestas (CV ausente o no PDF)
  error?: string
}

/** Última comprobación de interés visible para una candidatura. */
export interface CandidateInterestSummary {
  checkId: string
  /** Lote de envío al que pertenece. Meridian agrupa la actividad por lote. */
  batchId: string
  response: CandidateInterestResponse | null
  sentAt: string
  respondedAt: string | null
  reminderSentAt: string | null
  expiresAt: string
}

/**
 * Un mensaje del hilo de equipo de un candidato. Sustituye a las notas internas:
 * lo mismo, pero se sabe quién lo dijo y cuándo. Inmutable por diseño (no hay
 * editar ni borrar): es lo que hace fiable un hilo compartido.
 */
export interface CandidateComment {
  id: string
  candidateId: string
  /** Ausente = lo escribió alguien que ya no está, o es una nota migrada. */
  authorUserId: string | null
  /** Denormalizado: el hilo sobrevive a las bajas del equipo. */
  authorEmail: string
  body: string
  /** A quién se avisó. El servidor descarta a quien no sea del equipo. */
  mentions: string[]
  /** Nota interna de la época anterior, migrada al hilo. Se pinta sin autor. */
  isNote: boolean
  createdAt: string // ISO
}

/**
 * Qué le ha pasado a esta candidatura. El texto se compone en el cliente a
 * partir de `kind` + `details`, para poder usar las etiquetas de estado reales
 * y el nombre de Meridian sin congelarlos en la base de datos.
 *
 * Los comentarios NO son eventos: el chat está en la pestaña de al lado y
 * duplicarlo solo llenaría el historial de ruido.
 */
export type CandidateEventKind =
  | 'recibida'
  | 'analisis'
  | 'estado'
  | 'favorito'
  | 'interes_enviada'
  | 'interes_respuesta'
  | 'entrevista_invitada'
  | 'entrevista_confirmada'
  | 'entrevista_reprogramada'
  | 'entrevista_cancelada'
  | 'entrevista_realizada'
  | 'entrevista_sin_respuesta'

export interface CandidateEvent {
  id: string
  candidateId: string
  /** '' = lo hizo el sistema (el formulario público, Meridian), no una persona. */
  actorEmail: string
  kind: CandidateEventKind
  details: Record<string, unknown>
  createdAt: string // ISO
}

/**
 * Una entrevista. UNA entidad, venga de donde venga: creada a mano, conseguida
 * por el agente de WhatsApp o, más adelante, por la publicación multicanal.
 * `origin` es procedencia, no tipo: no cambia ninguna regla ni ningún permiso.
 *
 * La hora se guarda en UTC (ISO) y `timezone` dice en qué zona hay que pintarla:
 * una entrevista en Las Palmas se lee igual desde Madrid que desde allí.
 */
export type InterviewStatus =
  | 'invitada'       // invitación mandada, sin respuesta todavía
  | 'proponiendo'    // aceptó, horarios ofrecidos, esperando que elija
  | 'confirmada'     // hueco reservado
  | 'reprogramando'  // se pidió mover; conserva el hueco viejo hasta cerrar el nuevo
  | 'realizada'
  | 'cancelada'
  | 'rechazada'      // el candidato dijo que no
  | 'sin_respuesta'
  | 'fallida'        // no se pudo entregar (sin WhatsApp, número no válido)

/**
 * 'telefonica' es al revés que las otras dos: presencial y videollamada son
 * sitios a los que el candidato va, y en la llamada se le llama a él. La hace
 * la empresa, con su agenda y su teléfono, igual que las otras dos; el día que
 * la conduzcamos nosotros lo dirá `interviews.interviewer`, no la modalidad.
 */
export type InterviewMode = 'presencial' | 'videollamada' | 'telefonica'

export interface Interview {
  id: string
  campaignId: string
  candidateId: string
  hostUserId: string
  status: InterviewStatus
  origin: 'manual' | 'whatsapp'
  /** ISO en UTC. Null mientras no haya hueco elegido. */
  startsAt: string | null
  endsAt: string | null
  timezone: string
  mode: InterviewMode
  locationText: string
  meetingUrl: string | null
  /** Cuándo dijo el candidato que sigue en pie, desde el aviso de la víspera.
   *  Null = todavía no ha contestado, que no es lo mismo que "no viene". */
  reconfirmedAt: string | null
  createdAt: string
}

/** Estados vivos: los que ocupan al candidato y bloquean agenda. */
export const INTERVIEW_LIVE: InterviewStatus[] = ['invitada', 'proponiendo', 'confirmada', 'reprogramando']

/**
 * Paleta propia y fija, como la de los candidatos. El acento de marca NO
 * aparece aquí: queda reservado a acción, nav, foco y selección.
 * `confirmada` va en ámbar porque es exactamente lo que el estado 'entrevista'
 * del candidato ya significa, y las dos cosas se ven juntas en la misma ficha.
 * Nada va en rojo: cancelar una entrevista es rutina, no un error.
 */
export const INTERVIEW_STATUS_META: Record<InterviewStatus, { label: string; dot: string; chip: string }> = {
  invitada:      { label: 'Invitada',      dot: 'bg-blue-500',  chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  proponiendo:   { label: 'Eligiendo',     dot: 'bg-blue-500',  chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  confirmada:    { label: 'Confirmada',    dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  reprogramando: { label: 'Reprogramando', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  realizada:     { label: 'Realizada',     dot: 'bg-green-500', chip: 'bg-green-50 text-green-700 ring-green-200' },
  cancelada:     { label: 'Cancelada',     dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-500 ring-slate-200' },
  rechazada:     { label: 'No le interesa', dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-500 ring-slate-200' },
  sin_respuesta: { label: 'Sin respuesta', dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-500 ring-slate-200' },
  fallida:       { label: 'No se pudo',    dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-500 ring-slate-200' },
}

/**
 * Las tres modalidades, con la frase que resuelve la duda de verdad: quién se
 * mueve. Presencial y teléfono van primero porque son las dos que se usan en
 * obra, en almacén y en cocina; la videollamada existe y vale lo mismo, pero
 * ahí casi nadie la pide.
 */
export const INTERVIEW_MODE_META: Record<InterviewMode, { label: string; pista: string }> = {
  presencial: { label: 'Presencial', pista: 'Viene a tu dirección' },
  telefonica: { label: 'Por teléfono', pista: 'Le llamas tú a la hora acordada' },
  videollamada: { label: 'Videollamada', pista: 'Le pasas un enlace' },
}

/** El orden en que se ofrecen. Mandarlo desde aquí evita que dos pantallas lo pinten distinto. */
export const INTERVIEW_MODES: InterviewMode[] = ['presencial', 'telefonica', 'videollamada']

/**
 * La conversación de la entrevista. Pertenece al CANDIDATO y vive en su ficha,
 * al lado del chat de equipo y del historial. No hay bandeja global: obligaría
 * a saltar entre dos sitios para entender a una sola persona.
 */
export type ConversationAgentState =
  | 'preparando'
  | 'contactando'
  | 'esperando_respuesta'
  | 'proponiendo_horarios'
  | 'entrevista_confirmada'
  | 'necesita_intervencion'
  | 'cerrada'

export interface CandidateConversation {
  id: string
  candidateId: string
  interviewId: string | null
  agentState: ConversationAgentState
  /** 'agente' = automática. 'persona' = alguien del equipo la ha tomado. */
  handover: 'agente' | 'persona'
  attentionReason: string | null
  /** Fuera de la ventana de 24 h de WhatsApp solo se pueden mandar plantillas. */
  windowExpiresAt: string | null
  optedOut: boolean
  createdAt: string
}

export type MessageAuthor = 'agente' | 'persona' | 'candidato' | 'sistema'

export interface ConversationMessage {
  id: string
  conversationId: string
  direction: 'entrante' | 'saliente'
  author: MessageAuthor
  authorUserId: string | null
  body: string
  payload: Record<string, unknown>
  deliveryStatus: 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallido' | 'recibido'
  errorText: string | null
  createdAt: string
}

/**
 * Qué se le dice al empresario en cada estado. El texto es de resultado, no de
 * mecánica: le importa si tiene que hacer algo, no en qué paso interno estamos.
 * Ámbar solo cuando de verdad hace falta una persona; el resto es slate o azul,
 * porque "el agente está trabajando" no es una alerta.
 */
export const CONVERSATION_STATE_META: Record<
  ConversationAgentState,
  { label: string; hint: string; dot: string }
> = {
  preparando:            { label: 'Preparando',        hint: 'Estamos a punto de escribirle.', dot: 'bg-slate-400' },
  contactando:           { label: 'Contactando',       hint: 'Mensaje en camino.', dot: 'bg-blue-500' },
  esperando_respuesta:   { label: 'Esperando respuesta', hint: 'Le hemos escrito y aún no ha contestado.', dot: 'bg-blue-500' },
  proponiendo_horarios:  { label: 'Eligiendo horario', hint: 'Le hemos pasado horarios y está eligiendo.', dot: 'bg-blue-500' },
  entrevista_confirmada: { label: 'Entrevista confirmada', hint: 'Cita cerrada y recordatorios programados.', dot: 'bg-green-500' },
  necesita_intervencion: { label: 'Necesita que entres', hint: 'Hay algo que no podemos resolver solos.', dot: 'bg-amber-500' },
  cerrada:               { label: 'Cerrada',            hint: 'Esta conversación ya no está activa.', dot: 'bg-slate-300' },
}

/** Miembro del equipo, tal y como lo devuelve el RPC `list_company_members`. */
export interface CompanyMember {
  userId: string
  email: string
  role: 'owner' | 'member' | 'encargado'
  isSelf: boolean
}

export interface Candidate {
  id: string
  campaignId: string
  /** Respuestas por id de campo. Valor string, string[] (multiselect) o boolean. */
  answers: Record<string, string | string[] | boolean>
  status: CandidateStatus
  submittedAt: string // ISO
  source: CandidateSource
  /**
   * Guardado en favoritos. Sustituye a la valoración de 1-5 estrellas (jul 2026):
   * marcar a alguien es una SELECCIÓN ("a este lo quiero"), no una nota con
   * matices, y nadie usaba la diferencia entre 2 y 3 estrellas.
   */
  favorito: boolean
  /**
   * @deprecated Notas internas de la época anterior al chat de equipo. Ya no se
   * escribe: su contenido se migró al hilo como primer mensaje ("Nota anterior").
   * Se conserva para poder revertir; se retira en una limpieza posterior.
   */
  notes: string
  cvPath?: string // ruta del CV en Supabase Storage (bucket cvs), si lo adjuntó
  tagIds: string[] // ids de las etiquetas que el empresario le ha puesto (ver Tag)
  /** Señal independiente del estado de selección. Ausente = nunca comprobado. */
  interest?: CandidateInterestSummary
  /** Triaje de IA (Meridian). Ausente = nunca analizado. */
  ai?: CandidateAI
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
// El orden por ajuste se retiró en jul 2026 y volvió en ago 2026 con la columna
// Encaje, ya con su nombre visible ('encaje'). Una vista guardada antigua puede
// traer todavía el 'ajuste' de entonces: no rompe, cae al orden por fecha.
export type SortKey = 'nombre' | 'fecha' | 'estado' | 'encaje'

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
  /** Una vista guardada antigua puede traer todavía `ratingFilter`: se ignora. */
  favoritosOnly?: boolean
  numberFilters?: NumberFilter[]
  // Ids de etiquetas seleccionadas. Universal (las etiquetas valen en cualquier
  // puesto), como estados u orden: viaja también en vistas globales.
  tagFilter?: string[]
  interestStates?: CandidateInterestState[]
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

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

import type { Anuncio } from './anuncio'

export type CampaignStatus = 'activa' | 'pausada' | 'cerrada'

export interface Campaign {
  id: string
  slug: string // id del puesto en el enlace público /<marca>/<slug>/<nombre>
  title: string
  sector: string
  location: string
  /** Una de PROVINCIAS (lib/anuncio.ts) o '' si no se ha dicho. Hermana de
   *  `location`: columna propia, no parte del jsonb del anuncio. */
  provincia: string
  status: CampaignStatus
  createdAt: string // ISO
  /** Cuándo se cerró (lo estampa el servidor). Null en un puesto cerrado que
   *  nunca llegó a abrirse: creado a la espera del pago (ver pendienteDePago). */
  closedAt?: string | null
  milanunciosUrl?: string
  fields: FormField[]
  branding: Branding
  siteId: string | null // sede a la que pertenece (Multi); null = sin sede
  brandId: string | null // marca a la que pertenece (Multi); null = sin marca
  notifyNew?: boolean // avisar por email al entrar un candidato (por defecto sí)
  /** Respuesta personalizada y reutilizable al compartir el enlace del puesto. */
  shareReply?: string | null
  /**
   * Lo que se lee ANTES del formulario: salario, modalidad, requisitos y a qué
   * suena el trabajo. Su forma y su vocabulario viven en `lib/anuncio.ts`.
   * `undefined` = puesto anterior al anuncio; la pantalla lo normaliza con
   * `leerAnuncio`, así que nunca hay que preguntarse si existe.
   */
  anuncio?: Anuncio
  /** Pago por proceso: hasta cuándo está pagado el ciclo de un puesto CERRADO.
   *  En el futuro = reabrirlo es gratis hasta esa fecha. Lo escribe el servidor. */
  paidUntil?: string
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
 * Juicio del triaje sobre un criterio. `no_consta` es "no hay dato", NO un
 * punto negativo. Los criterios salen del BAREMO del puesto (triada, ago 2026:
 * `_shared/triaje.ts`, persistido en campaigns.baremo); el número lo calcula el
 * servidor, aquí solo se guarda para poder explicarlo. `nombre`, `nivel` y
 * `evidencia` van embebidos para que la ficha se pinte sola aunque el baremo
 * del puesto haya cambiado después: faltan en análisis anteriores a ago 2026,
 * cuyos criterios eran 5 claves genéricas fijas.
 */
export interface AiCriterion {
  clave: string
  valor: 'cumple' | 'parcial' | 'no_consta' | 'no_cumple'
  /** Nombre visible del criterio ("Carnet de carretillas"). */
  nombre?: string
  /** Cuánto PESA el criterio en el número, nunca una categoría eliminatoria
   *  (Mario, ago 2026: "imprescindible" es subjetivo y no se califica así). */
  nivel?: 'clave' | 'importante' | 'deseable'
  /** Cita corta de la candidatura que sostiene el juicio. Nunca con no_consta. */
  evidencia?: string
  /** De dónde salió la evidencia. Con 'cv', el visor del CV puede localizarla
   *  y subrayarla. Ausente en análisis anteriores a ago 2026. */
  fuente?: 'respuesta' | 'cv'
  /** La pregunta se contestó con algo que no la responde (un teléfono donde se
   *  piden años): sin dato, pero el descuido pesa a medias en el número. */
  incoherente?: boolean
}

/** Contradicción entre una respuesta del formulario y el CV ("dice 5 años, las
 *  etapas del CV suman 2"). `cv` es cita literal del CV: subrayable. */
export interface AiContraste {
  respuesta: string
  cv: string
}

/** Ficha estructurada extraída del CV. Transcripción, no interpretación: las
 *  fechas van como texto libre tal cual las escribe el CV. */
export interface AiTrayectoria {
  empleos: { empresa: string; puesto: string; desde: string; hasta: string }[]
  carnets: { nombre: string; vigencia: string }[]
  formacion: string[]
}

export interface CandidateAI {
  summary: string
  /** El INFORME en prosa (ago 2026): lo que un profesional de selección le
   *  diría a su jefe al preguntarle por este candidato. Un solo párrafo que se
   *  sostiene solo; sustituye en la ficha al desglose criterio a criterio, que
   *  repetía las respuestas en peor. Ausente en análisis anteriores. */
  informe?: string
  highlights: string[]
  concerns: string[]
  fit: number // 0..100, ajuste al puesto (orientativo, nunca gate)
  /** De dónde sale `fit`. Ausente en análisis anteriores a jul 2026. */
  criterios?: AiCriterion[]
  /** Contradicciones respuesta-vs-CV que el juez conservó. Ausente sin CV. */
  contrastes?: AiContraste[]
  /** Ficha del CV (empleos, carnets, formación). Ausente sin CV leído. */
  trayectoria?: AiTrayectoria
  /** Con qué versión del baremo del puesto se midió (procedencia). */
  baremoHash?: string
  model: string // procedencia: qué modelo lo generó
  analyzedAt: string // ISO
  cvUsed?: boolean // false = analizado solo con las respuestas (CV ausente o no PDF)
  /** Cómo se leyó el CV: capa de texto ('texto', subrayable), transcripción de
   *  visión ('vision', sin subrayado) o nada ('no'). Ausente en análisis viejos. */
  cvLeido?: 'texto' | 'vision' | 'no'
  error?: string
}

/** Última comprobación de interés visible para una candidatura. */
/**
 * UN DOCUMENTO DE LA CANDIDATURA (ago 2026). Vive en su propia tabla y no en un
 * `jsonb` del candidato: son varios, los añaden personas distintas y lo que se
 * quiere es un REGISTRO (quién y cuándo), no un campo. El motivo largo está en
 * la migración `20260831120000_documentos_candidato.sql`.
 *
 * OJO: el CV (`candidate.cvPath`) NO es una fila de éstas. Sigue donde estaba,
 * que es lo que lee Meridian y lo que exporta el ZIP; la ficha compone la lista
 * como [el CV] + [estos]. Así cada documento tiene UNA sola fuente.
 */
export interface CandidateDocument {
  id: string
  candidateId: string
  /** Ruta en el bucket privado `cvs`. */
  path: string
  /** Cómo se llama para quien lo mira: el del bucket es un uuid. */
  nombre: string
  bytes?: number
  /** Quién lo puso: el candidato al apuntarse, o alguien del equipo después. */
  origen: 'candidato' | 'equipo'
  /** La pregunta del formulario que lo pidió, si vino de ahí. */
  campoId?: string
  subidoPor?: string
  createdAt: string
}

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
  /**
   * Cuándo se corrigió, si se corrigió. La pone el servidor (trigger) y el hilo
   * escribe "editado" al lado de la hora: un hilo que el equipo usa para tener
   * constancia no puede cambiar sin decirlo.
   */
  editedAt: string | null
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
 * Una entrevista. UNA entidad, venga de donde venga: creada a mano o, más
 * adelante, por la publicación multicanal. `origin` es procedencia, no tipo: no
 * cambia ninguna regla ni ningún permiso.
 *
 * La hora se guarda en UTC (ISO) y `timezone` dice en qué zona hay que pintarla:
 * una entrevista en Las Palmas se lee igual desde Madrid que desde allí.
 *
 * CINCO DE ESTOS ESTADOS YA NO SE PRODUCEN (los marcados abajo). Eran los de una
 * cita que el asistente de WhatsApp estaba negociando con el candidato, y el
 * asistente se retiró en sep 2026: hoy una cita nace confirmada, con su hora
 * puesta. Se quedan en el vocabulario porque la base los sigue admitiendo y
 * porque `INTERVIEW_STATUS_META` tiene que saber pintar CUALQUIER fila que
 * llegue; un estado sin entrada dejaría la agenda en blanco, que es peor que
 * enseñar una palabra que ya nadie escribe.
 */
export type InterviewStatus =
  | 'invitada'       // (retirado) invitación mandada, sin respuesta todavía
  | 'proponiendo'    // (retirado) aceptó, horarios ofrecidos, esperando que elija
  | 'confirmada'     // hueco reservado
  | 'reprogramando'  // (retirado) se pidió mover; conservaba el hueco viejo
  | 'realizada'
  | 'cancelada'
  | 'rechazada'      // (retirado) el candidato dijo que no
  | 'sin_respuesta'  // (retirado)
  | 'fallida'        // (retirado) no se pudo entregar el mensaje

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
  /** De dónde salió. Hoy solo 'manual': 'whatsapp' lo escribía el asistente
   *  retirado en sep 2026 y se conserva porque la base lo sigue admitiendo. */
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
/*
 * SIN ANILLO Y AL PASO 100, como las pastillas de estado del candidato desde ago
 * 2026. Los dos cambios van juntos y no son independientes: quitado el borde, un
 * relleno del paso 50 sobre blanco se queda en ~1,05:1 y la cápsula deja de leerse
 * como FORMA, así que el relleno sube al 100 (y el texto al 800 para conservar el
 * contraste encima). Es la misma medida que ya obligó a subir la cápsula de estado
 * del puesto y la del candidato.
 *
 * `borde` sale del `chip` y se declara aparte porque tiene UN solo consumidor y no
 * es una pastilla: el bloque del calendario (`AgendaGrid`), que sí necesita canto
 * propio para separarse de sus vecinos y de la rejilla. Mezclado dentro de `chip`,
 * la pastilla se lo llevaba puesto sin quererlo.
 *
 * `barra` es el MISMO tono dos peldaños más oscuro, y existe desde que el bloque
 * del calendario se tiñe del color de su anfitrión (ago 2026). Ahí el filo de 3px
 * pasó a ser el ÚNICO portador del estado, y `dot` no da la talla: medido sobre
 * un relleno de persona da **1,86:1**, por debajo del 3:1 que esta casa exige a un
 * gráfico con significado. Antes no se notaba porque el relleno decía el estado
 * también, así que el filo solo lo repetía; al mudarse el relleno, un adorno pasó
 * a ser una señal sin que nadie volviera a medirlo.
 *
 * **Y separa por LUMINOSIDAD, no por tono**, que es lo que lo hace fiable: el hue
 * de la persona es arbitrario, así que un filo ámbar sobre un relleno naranja o
 * uno azul sobre uno celeste se pierden por parecido. Con el peso 700 el filo se
 * lee sobre CUALQUIERA de los diez tonos de la paleta (medido: 3,7-4,0:1). Es la
 * misma salida que ya resolvió la estrella dorada contra el ámbar de "entrevista":
 * cuando dos colores compiten, desempata otra propiedad.
 */
export const INTERVIEW_STATUS_META: Record<
  InterviewStatus,
  { label: string; dot: string; barra: string; chip: string; borde: string }
> = {
  invitada:      { label: 'Invitada',      dot: 'bg-blue-500',  barra: 'bg-blue-700',  chip: 'bg-blue-100 text-blue-800',   borde: 'ring-blue-200' },
  proponiendo:   { label: 'Eligiendo',     dot: 'bg-blue-500',  barra: 'bg-blue-700',  chip: 'bg-blue-100 text-blue-800',   borde: 'ring-blue-200' },
  confirmada:    { label: 'Confirmada',    dot: 'bg-amber-500', barra: 'bg-amber-700', chip: 'bg-amber-100 text-amber-800', borde: 'ring-amber-200' },
  reprogramando: { label: 'Reprogramando', dot: 'bg-amber-500', barra: 'bg-amber-700', chip: 'bg-amber-100 text-amber-800', borde: 'ring-amber-200' },
  realizada:     { label: 'Realizada',     dot: 'bg-green-500', barra: 'bg-green-700', chip: 'bg-green-100 text-green-800', borde: 'ring-green-200' },
  cancelada:     { label: 'Cancelada',     dot: 'bg-slate-300', barra: 'bg-slate-400', chip: 'bg-slate-100 text-slate-500', borde: 'ring-slate-200' },
  rechazada:     { label: 'No le interesa', dot: 'bg-slate-300', barra: 'bg-slate-400', chip: 'bg-slate-100 text-slate-500', borde: 'ring-slate-200' },
  sin_respuesta: { label: 'Sin respuesta', dot: 'bg-slate-300', barra: 'bg-slate-400', chip: 'bg-slate-100 text-slate-500', borde: 'ring-slate-200' },
  fallida:       { label: 'No se pudo',    dot: 'bg-slate-300', barra: 'bg-slate-400', chip: 'bg-slate-100 text-slate-500', borde: 'ring-slate-200' },
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
  /**
   * Cuándo aceptó la política de privacidad, al enviar la candidatura. Null = no
   * consta: las candidaturas anteriores a que existiera la casilla se quedan así
   * a propósito, porque nunca se les dijo nada y rellenarlo sería fabricar la
   * prueba de algo que no ocurrió. El texto exacto que aceptó cada una se
   * recupera por su `consent_version` (ver `lib/consent.ts`).
   */
  consentAt?: string | null
  /**
   * Cuándo entró en su estado ACTUAL. Lo escribe un trigger al cambiar `status`
   * (nunca el cliente) y nace con la llegada: es lo que deja decir "3 días en
   * esta etapa" sin cargar el historial de toda la lista.
   */
  statusChangedAt: string // ISO
  /** Señal independiente del estado de selección. Ausente = nunca comprobado. */
  interest?: CandidateInterestSummary
  /** Triaje de IA (Meridian). Ausente = nunca analizado. */
  ai?: CandidateAI
  /**
   * Cuándo se puso a analizarla el servidor (`candidates.ai_claimed_at`), o
   * null si no hay ninguno en marcha. Es el RECLAMO que impide que dos
   * invocaciones paguen el mismo análisis; el cliente lo lee para una sola
   * cosa, distinguir "todavía no la ha mirado nadie" de "la está mirando ahora
   * mismo", que hasta sep 2026 se pintaban igual (una raya). Caduca:
   * `estaAnalizando` en lib/meridian.ts es quien decide, nunca la presencia.
   */
  analizandoDesde?: string | null
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
  // 'proceso' = pago por proceso abierto (el modelo vigente); los tiers
  // esencial/pro/multi ya no se venden (suscripciones antiguas).
  plan: 'trial' | 'proceso' | 'esencial' | 'pro' | 'multi'
  accent: string // hex de marca de la empresa
}

// --- Vistas guardadas (Pro/Multi) -----------------------------------------
// Clave de orden de la tabla de candidatos (compartida por el panel y las vistas).
// El orden por ajuste se retiró en jul 2026 y volvió en ago 2026 con la columna
// Encaje, ya con su nombre visible ('encaje'). Una vista guardada antigua puede
// traer todavía el 'ajuste' de entonces: no rompe, cae al orden por fecha.
/**
 * Por qué se ordena la lista. Las cuatro de siempre más las RESPUESTAS que se
 * pueden comparar: solo Sí/No y número (`campo:<id>`). Un texto libre o una
 * selección no tienen un orden que signifique nada, y ordenar por ellos sería
 * ofrecer un botón que devuelve un resultado arbitrario.
 */
export type SortKey = 'nombre' | 'fecha' | 'etapa' | 'estado' | 'encaje' | `campo:${string}`

/** Los tipos de pregunta que se pueden ordenar. Ver `SortKey`. */
export const TIPOS_ORDENABLES: FieldType[] = ['boolean', 'number']

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
  /** A quién avisa este mensaje. El cliente propone; el trigger filtra al equipo. */
  mentions: string[]
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
  // SIN anillo (Mario, ago 2026): la pastilla es un relleno teñido y ya está. Con el
  // borde puesto, una columna de 142 filas era una columna de 142 cápsulas
  // perfiladas y el perfil pesaba más que la palabra.
  //
  // EL RELLENO ES EL PUNTO MEDIO ENTRE EL 50 Y EL 100 (Mario, sep 2026: "el tinte
  // de los estados que sea más sutil", y con el 50 delante, "un punto medio").
  // Los tokens viven en `index.css` (`--color-estado-*`) porque un valor compuesto
  // necesita nombre; aquí está el porqué.
  //
  // Subió de 50 a 100 al quitar el anillo, con el argumento de que a 1,05:1 la
  // cápsula deja de leerse como forma. **Medido con los cinco delante, ese
  // argumento no se sostiene para un relleno de COLOR**: en el paso 100 el ámbar
  // daba 1,11, el verde 1,10 y el gris 1,09, o sea que ninguno se leía tampoco por
  // luminancia. Lo que hace visible una pastilla teñida es el TONO, no cuánto más
  // oscura es que el papel; la regla del 1,05 se midió sobre grises y se aplicó a
  // colores sin volver a mirarla. Y en el otro extremo, el 50 dejaba la cápsula en
  // 1,04-1,09, o sea casi solo palabra de color. El medio (1,07-1,15) es donde el
  // tinte se ve sin ser lo más ruidoso de una fila que ya no tiene ningún otro
  // color: el dato va en tinta plana y las etiquetas volvieron al gris en esta
  // misma pasada.
  //
  // LOS CINCO SE MUEVEN A LA VEZ, como cuando subieron: con unos en un peldaño y
  // otros en otro, dos parecerían de otra familia.
  nuevo: { label: 'Nuevo', dot: 'bg-slate-500', chip: 'bg-estado-gris text-slate-700' },
  contactado: { label: 'Contactado', dot: 'bg-blue-500', chip: 'bg-estado-azul text-blue-800' },
  entrevista: { label: 'Entrevista', dot: 'bg-amber-500', chip: 'bg-estado-ambar text-amber-800' },
  contratado: { label: 'Contratado', dot: 'bg-green-500', chip: 'bg-estado-verde text-green-800' },
  // "Descartado" sigue siendo el apagado: mismo relleno neutro que "nuevo" pero
  // con la tinta y el punto más flojos. Es rutina y es reversible, nunca rojo.
  //
  // Su tinta sube de `slate-500` a `slate-600` y eso ARREGLA algo que venía roto:
  // sobre el relleno de antes daba 4,40:1, por debajo del suelo de la casa para
  // texto con significado, y sobre este se quedaba en 4,49. Con el 600 son 7,08 y
  // sigue estando un peldaño por debajo de "nuevo" (9,70), que es lo que hace que
  // se lea apagado; lo apagado no puede costar la legibilidad.
  descartado: { label: 'Descartado', dot: 'bg-slate-300', chip: 'bg-estado-gris text-slate-600' },
}

// La estrella de FAVORITO, en un solo sitio: ficha, tabla, tarjeta de móvil y
// filtro pintan exactamente esto. Es dorada (Mario, ago 2026; antes iba en el
// acento): una estrella rellena de oro no hay que aprenderla, y así el
// ultramarine vuelve a significar solo acción. No se confunde con el ámbar de
// 'entrevista' porque ese estado se dice siempre con punto redondo + palabra,
// nunca con este glifo.
//
// Dos tonos a propósito: relleno `amber-400` (#fbbf24, amarillo de verdad) y
// contorno `amber-500` (#f59e0b), medio paso más oscuro. Sin ese contorno el
// amarillo pierde la silueta sobre blanco y a 14px se deshace. Se probó cerrar
// el borde con `amber-600` (#d97706) para llegar a los 3:1 de un gráfico con
// significado y Mario lo tumbó: se veía naranja, no amarillo. Es aceptable
// porque la estrella NUNCA es el único portador (en la tabla lleva su
// `sr-only` "En favoritos." y en la ficha su `aria-pressed`): el color aquí
// reconoce, no informa.
export const FAVORITO_STAR = 'fill-amber-400 text-amber-500'

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

/**
 * De dónde llega una candidatura, y CON QUÉ COLOR se dibuja en la gráfica de
 * Vista general.
 *
 * El tono se declara aquí y no se calcula (como sí hace `tagTone` con las
 * etiquetas) porque los orígenes son un vocabulario CERRADO de cuatro: no hay
 * choques que repartir, y un color estable a lo largo de los meses es lo que
 * deja comparar una gráfica de hoy con la que viste en junio.
 *
 * La paleta sale de la misma regla que la de etiquetas: fuera el rojo y el rosa
 * (reservados a errores y a lo destructivo) y fuera el ultramarine de marca, que
 * es acción. Aquí el color no informa solo: cada serie lleva SIEMPRE su punto
 * pegado a su nombre escrito, y el desglose exacto está en la tabla de datos.
 */
export const SOURCE_META: Record<
  CandidateSource,
  { label: string; punto: string; trazo: string; area: string; relleno: string }
> = {
  // `relleno` es el tono SÓLIDO, para los puntos que marca el lector de datos de
  // la gráfica sobre cada serie. No se puede sacar de `trazo` (`stroke-*` no pinta
  // el `fill`) ni de `area`, que va al 12% a propósito. Se declara aquí, con los
  // otros tres, para que un origen nuevo no pueda estrenarse a medias.
  milanuncios: { label: 'Milanuncios', punto: 'bg-violet-500', trazo: 'stroke-violet-500', area: 'fill-violet-500/12', relleno: 'fill-violet-500' },
  enlace: { label: 'Enlace', punto: 'bg-sky-500', trazo: 'stroke-sky-500', area: 'fill-sky-500/12', relleno: 'fill-sky-500' },
  qr: { label: 'QR', punto: 'bg-teal-500', trazo: 'stroke-teal-500', area: 'fill-teal-500/12', relleno: 'fill-teal-500' },
  // La candidatura que el dueño se envía a sí mismo al probar su enlace durante
  // el onboarding. Chip neutro en la lista; puede borrarse para liberar cupo. En
  // la gráfica va en gris a propósito: no es un canal, es una prueba.
  prueba: { label: 'Prueba', punto: 'bg-slate-400', trazo: 'stroke-slate-400', area: 'fill-slate-400/12', relleno: 'fill-slate-400' },
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

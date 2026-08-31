// ============================================================================
// Triada de triaje de Meridian: BAREMO (por puesto) + EVALUADOR (por
// candidatura) + JUEZ (verificador). Este módulo es la fuente de verdad de las
// tres piezas: tipos, prompts, esquemas de salida y, sobre todo, la AGREGACIÓN,
// que es la única que pone números. El modelo nunca puntúa: esa separación
// (el modelo juzga hechos, el código calcula) se ganó contra la varianza de la
// v1 (la misma candidatura sacaba 83 y luego 63) y aquí se conserva.
//
// El módulo es PURO a propósito: sin Deno, sin red, sin imports. Así lo puede
// cargar vitest desde src/lib/triaje.test.ts (su guardián) igual que hace
// guion.test.ts con _shared/interviews/guion.
//
// Las tres piezas, y qué decide cada una:
//  * BAREMO: se genera UNA VEZ por puesto a partir del título + sector +
//    ubicación + las preguntas del formulario (el formulario ES el perfil del
//    puesto: cada pregunta existe porque al empleador le importa) y se persiste
//    en campaigns.baremo. Todos los candidatos de un proceso se miden con la
//    misma vara: si cada análisis regenerase el suyo, ordenar por Encaje sería
//    mentira. Se regenera solo si el puesto cambia (hash).
//  * EVALUADOR: juzga la candidatura criterio a criterio, con EVIDENCIA citada.
//    Sin evidencia no hay juicio: solo "no_consta".
//  * JUEZ: no re-evalúa (dos opiniones = varianza otra vez). Comprueba que cada
//    evidencia existe y sostiene el valor, y solo puede REBAJAR la aserción
//    (hacia no_consta), nunca subirla ni inventar un negativo. El código
//    (fusionarJuicio) hace cumplir ese contrato aunque el modelo se salte
//    la instrucción.
// ============================================================================

export type Familia = 'experiencia' | 'disponibilidad' | 'desplazamiento' | 'requisitos' | 'continuidad'
/** Peso relativo del criterio, NUNCA una categoría eliminatoria. Mario (ago
 *  2026): "imprescindible" es subjetivo, la IA puede dar más importancia a un
 *  apartado pero no calificarlo de imprescindible. Un "clave" que no se cumple
 *  tira fuerte del número por su peso; jamás descalifica ni capa por sí solo. */
export type Nivel = 'clave' | 'importante' | 'deseable'
export type Valor = 'cumple' | 'parcial' | 'no_consta' | 'no_cumple'

export const FAMILIAS: Familia[] = ['experiencia', 'disponibilidad', 'desplazamiento', 'requisitos', 'continuidad']
export const NIVELES: Nivel[] = ['clave', 'importante', 'deseable']
export const VALORES: Valor[] = ['cumple', 'parcial', 'no_consta', 'no_cumple']

/** Criterio instanciado para UN puesto, con anclajes concretos (técnica BARS):
 *  qué significa cumplirlo AQUÍ, no la frase genérica de la familia. */
export interface BaremoCriterio {
  clave: string
  familia: Familia
  /** Nombre corto y visible: la ficha lo pinta tal cual ("Carnet de carretillas"). */
  nombre: string
  nivel: Nivel
  /** De dónde puede salir la evidencia. Un criterio 'cv' se EXCLUYE del baremo
   *  efectivo cuando el puesto ni recoge CV: al candidato no se le puede
   *  penalizar por información que nadie le pidió. */
  fuente: 'formulario' | 'cv'
  anclas: { cumple: string; parcial: string; no_cumple: string }
}

export interface Baremo {
  version: 1
  /** Hash del puesto (título + sector + ubicación + preguntas). Si no coincide,
   *  el puesto cambió y el baremo se regenera. */
  hash: string
  criterios: BaremoCriterio[]
  model: string
  generadoAt: string
}

/** De dónde salió la evidencia de UN juicio concreto (no confundir con la
 *  `fuente` del criterio, que dice de dónde PODRÁ salir): el visor del CV solo
 *  busca y subraya las citas que vienen del CV. */
export type FuenteJuicio = 'respuesta' | 'cv'

/** Juicio del evaluador sobre un criterio. La evidencia es una cita corta de la
 *  candidatura; sin ella, el valor se normaliza a no_consta (normalizarJuicios). */
export interface Juicio {
  clave: string
  valor: Valor
  evidencia?: string
  /** Solo viaja con evidencia: un no_consta no tiene cita que localizar. */
  fuente?: FuenteJuicio
}

/** Contradicción entre lo que respondió el formulario y lo que dice el CV
 *  ("dice 5 años, las etapas del CV suman 2"). `cv` es cita literal del CV,
 *  así que el visor puede subrayarla igual que una evidencia. */
export interface Contraste {
  respuesta: string
  cv: string
}

/** Ficha estructurada extraída del CV: transcripción, no interpretación. Las
 *  fechas van como texto libre tal cual las escribe el CV ("mar 2021"): parsear
 *  fechas de CVs reales es inventar precisión que el documento no tiene. */
export interface TrayectoriaCv {
  empleos: { empresa: string; puesto: string; desde: string; hasta: string }[]
  carnets: { nombre: string; vigencia: string }[]
  formacion: string[]
}

// ----------------------------------------------------------------------------
// Bandas y pesos. Las bandas 70/45 son las mismas que pinta la interfaz
// (fitTier en src/lib/meridian.ts): si se mueven, se mueven en los dos sitios.
// Lo que cambió en ago 2026 no son los cortes sino el SIGNIFICADO del número:
// "no_consta" ya no diluye (sale del denominador) y los criterios pesan según
// su nivel, así que un "clave" incumplido hunde el número por peso, no por
// ninguna regla eliminatoria.
// ----------------------------------------------------------------------------

export const FIT_BIEN = 70
export const FIT_PUEDE = 45

const PESO_VALOR: Record<string, number> = { cumple: 1, parcial: 0.6, no_cumple: 0 }
/** La importancia se dice con PESO, nunca con una categoría eliminatoria: un
 *  "clave" a 0 arrastra tres veces más que un deseable, y eso es todo. */
const PESO_NIVEL: Record<Nivel, number> = { clave: 3, importante: 2, deseable: 1 }

export interface Agregado {
  fit: number
  /** Cobertura informativa: cuántos criterios del baremo efectivo tienen dato. */
  evaluados: number
  total: number
}

/** Baremo efectivo para UNA candidatura: los criterios de CV solo cuentan si el
 *  CV era posible (hay texto extraído o el formulario tiene campo de adjunto). */
export function criteriosEfectivos(criterios: BaremoCriterio[], cvPosible: boolean): BaremoCriterio[] {
  return criterios.filter((c) => c.fuente !== 'cv' || cvPosible)
}

/**
 * La única función que pone el número. Media ponderada por nivel SOLO sobre lo
 * evidenciado: "¿encaja?" y "¿cuánto sabemos?" son preguntas distintas y
 * mezclarlas era lo que producía el suelo de 30 y el techo de 86 de la v1.
 * Sin ningún criterio evidenciado, el fit es 0 (candidatura vacía = "A valorar"
 * por falta de información, y la ficha lo dice con palabras, no con un 30).
 */
export function agregarJuicios(efectivos: BaremoCriterio[], juicios: Juicio[]): Agregado {
  const valorDe = new Map(juicios.map((j) => [j.clave, j.valor]))
  let suma = 0
  let pesoTotal = 0
  let evaluados = 0
  for (const c of efectivos) {
    const valor = valorDe.get(c.clave) ?? 'no_consta'
    if (valor === 'no_consta') continue
    evaluados += 1
    const w = PESO_NIVEL[c.nivel]
    suma += (PESO_VALOR[valor] ?? 0) * w
    pesoTotal += w
  }
  const fit = pesoTotal > 0 ? Math.round((suma / pesoTotal) * 100) : 0
  return { fit, evaluados, total: efectivos.length }
}

// ----------------------------------------------------------------------------
// Contratos del juez, en código. El prompt se lo pide; esto lo garantiza.
// ----------------------------------------------------------------------------

/**
 * El juez solo puede REBAJAR la aserción del evaluador: cualquier valor hacia
 * no_consta, y un juicio fuerte (cumple/no_cumple) hacia parcial. Nunca puede
 * subirla (no_consta -> cumple sería re-evaluar) ni cambiarle el signo
 * (cumple -> no_cumple sería inventar un negativo que el evaluador no vio).
 */
export function fusionarJuicio(evaluador: Valor, juez: Valor): Valor {
  if (juez === evaluador) return evaluador
  if (juez === 'no_consta') return 'no_consta'
  if (juez === 'parcial' && (evaluador === 'cumple' || evaluador === 'no_cumple')) return 'parcial'
  return evaluador
}

/**
 * Sin evidencia no hay juicio. Es la mitad MECÁNICA del juez: aunque los dos
 * modelos fallen a la vez, un "no_cumple" sin cita no llega nunca al usuario.
 */
export function normalizarJuicios(juicios: Juicio[], claves: Set<string>): Juicio[] {
  return juicios
    .filter((j) => claves.has(j.clave))
    .map((j) => {
      const evidencia = (j.evidencia ?? '').trim().slice(0, 200)
      if (j.valor !== 'no_consta' && !evidencia) return { clave: j.clave, valor: 'no_consta' as Valor }
      if (!evidencia) return { clave: j.clave, valor: j.valor }
      // La fuente solo viaja pegada a su evidencia: dice de dónde salió ESA
      // cita, y sin cita no señala nada. Un valor fuera del vocabulario se tira
      // (el structured output lo garantiza, esto cubre análisis re-procesados).
      const fuente: FuenteJuicio | undefined =
        j.fuente === 'cv' || j.fuente === 'respuesta' ? j.fuente : undefined
      return fuente
        ? { clave: j.clave, valor: j.valor, evidencia, fuente }
        : { clave: j.clave, valor: j.valor, evidencia }
    })
}

// ----------------------------------------------------------------------------
// Contrastes: el hallazgo experto (la respuesta dice una cosa y el CV otra).
// El evaluador los propone, el juez los conserva o los quita (nunca los
// reescribe: mismo contrato que "a favor" / "a confirmar"), y el saneo les
// pone techo duro para que candidates.ai no crezca sin control.
// ----------------------------------------------------------------------------

export const MAX_CONTRASTES = 2

export function sanearContrastes(brutos: unknown): Contraste[] {
  if (!Array.isArray(brutos)) return []
  const out: Contraste[] = []
  for (const b of brutos) {
    const c = b as Partial<Contraste>
    const respuesta = String(c?.respuesta ?? '').trim().slice(0, 160)
    const cv = String(c?.cv ?? '').trim().slice(0, 160)
    if (!respuesta || !cv) continue
    out.push({ respuesta, cv })
    if (out.length >= MAX_CONTRASTES) break
  }
  return out
}

/** La forma en que un contraste se le enseña al juez y en la que el juez lo
 *  devuelve si lo conserva. UNA sola serialización compartida: si el juez y el
 *  código cruzaran formas distintas, soloConservados descartaría todo. */
export function serializarContraste(c: Contraste): string {
  return `dice "${c.respuesta}" pero el CV dice "${c.cv}"`
}

// ----------------------------------------------------------------------------
// Trayectoria: la ficha estructurada del CV. Extracción mecánica en llamada
// aparte (meterla en el evaluador re-invitaría a la varianza que la triada
// mató). El saneo pone techos duros: con ellos, el peor caso del objeto cabe
// de sobra en los 20000 chars de candidates_ai_size.
//
// Y VERIFICA CONTRA EL TEXTO DEL CV, porque el primer CV real de producción
// (ago 2026) enseñó al modelo inventando: un empleo clonado (misma empresa y
// fechas que otro, con un puesto que el CV no dice en ninguna parte) y la
// formación duplicada. "Transcribe, no interpretes" es el contrato del prompt;
// esto es el contrato en CÓDIGO: lo que no está en el documento, no se pinta.
// ----------------------------------------------------------------------------

/** Normaliza para COMPROBAR PRESENCIA: minúsculas, sin acentos y solo
 *  alfanumérico, así "WIERTZ - SHIMANO" y "Wiertz (Shimano)" comparan igual.
 *  Es la hermana servidor de normalizarCita (src/lib/citas.ts): aquella además
 *  mapea posiciones para subrayar; esta solo pregunta "¿está?". */
export function normalizarComparacion(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function sanearTrayectoria(bruto: unknown, cvTexto?: string | null): TrayectoriaCv | null {
  const t = bruto as Partial<TrayectoriaCv> | null
  const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
  // "¿Este dato está escrito en el CV?" Sin texto de CV no se puede comprobar
  // y se deja pasar (el caso legítimo: transcripción de visión ya validada).
  const pajar = cvTexto ? normalizarComparacion(cvTexto) : null
  const enElCv = (s: string) => {
    if (!pajar) return true
    const aguja = normalizarComparacion(s)
    return aguja.length === 0 || pajar.includes(aguja)
  }
  // Para carnets y formación, la comprobación va POR FRAGMENTOS, y esto salió
  // de un CV real (ago 2026): el modelo compone la línea como se le pide
  // ("Título, Escuela, Año") y cada pieza está escrita en el CV, pero la
  // maquetación (columnas, saltos) las deja NO CONTIGUAS en la capa de texto,
  // así que exigir la línea entera seguida tiraba estudios verdaderos (quedó
  // un solo curso de una formación completa). Cada fragmento sí tiene que
  // aparecer tal cual: una escuela o un título inventados siguen tirando la
  // línea entera, que es para lo que existe el verificador.
  const enElCvPorPartes = (s: string) => {
    if (!pajar) return true
    const partes = s
      .split(/[,;·()|]/)
      .map((p) => normalizarComparacion(p))
      .filter((p) => p.length >= 3)
    if (partes.length === 0) return enElCv(s)
    return partes.every((p) => pajar.includes(p))
  }
  const vistos = new Set<string>()
  const empleos = (Array.isArray(t?.empleos) ? t.empleos : [])
    .map((e) => {
      const raw = e as Partial<TrayectoriaCv['empleos'][number]>
      return {
        empresa: txt(raw?.empresa, 80),
        puesto: txt(raw?.puesto, 80),
        desde: txt(raw?.desde, 30),
        hasta: txt(raw?.hasta, 30),
      }
    })
    .filter((e) => e.empresa || e.puesto)
    // Un empleo cuya empresa Y cuyo puesto no aparecen en el CV es un invento.
    // Basta con que aparezca UNO de los dos: el modelo a veces normaliza el
    // otro ("BP" contra "BP España"), y tirar un empleo real es peor que
    // dejar pasar un matiz.
    .filter((e) => enElCv(e.empresa) || enElCv(e.puesto))
    // La misma empresa con las mismas fechas es UNA etapa: el clon del CV real
    // era exactamente esto (dos "empleos" en BP, junio-septiembre 2024, uno de
    // ellos con un puesto que el CV no menciona). Se queda el primero, que es
    // el orden en que el documento lo cuenta. Un ascenso de verdad en la misma
    // empresa trae fechas distintas y no cae aquí.
    .filter((e) => {
      const clave = `${normalizarComparacion(e.empresa)}|${normalizarComparacion(e.desde)}|${normalizarComparacion(e.hasta)}`
      if (vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })
    .slice(0, 10)
  const carnetsVistos = new Set<string>()
  const carnets = (Array.isArray(t?.carnets) ? t.carnets : [])
    .map((c) => {
      const raw = c as Partial<TrayectoriaCv['carnets'][number]>
      return { nombre: txt(raw?.nombre, 80), vigencia: txt(raw?.vigencia, 40) }
    })
    .filter((c) => c.nombre && enElCvPorPartes(c.nombre))
    .filter((c) => {
      const clave = normalizarComparacion(c.nombre)
      if (carnetsVistos.has(clave)) return false
      carnetsVistos.add(clave)
      return true
    })
    .slice(0, 8)
  const formacionVista = new Set<string>()
  const formacion = (Array.isArray(t?.formacion) ? t.formacion : [])
    .map((f) => txt(f, 80))
    .filter((f) => f && enElCvPorPartes(f))
    // El CV real llegó con "Certificado Inglés B1" dos veces: repetir no es
    // transcribir.
    .filter((f) => {
      const clave = normalizarComparacion(f)
      if (formacionVista.has(clave)) return false
      formacionVista.add(clave)
      return true
    })
    .slice(0, 6)
  if (!empleos.length && !carnets.length && !formacion.length) return null
  return { empleos, carnets, formacion }
}

/** ¿El texto extraído del PDF da para analizar? Por debajo de 200 caracteres
 *  útiles es casi seguro un escaneo (la capa de texto no existe o es basura):
 *  es el disparador del respaldo de visión. */
export function esCvIlegible(texto: string | null): boolean {
  return !texto || texto.replace(/\s/g, '').length < 200
}

// ----------------------------------------------------------------------------
// LA IA NO SE TRAGA TEXTO ESCONDIDO (Mario, ago 2026). La capa de texto de un
// PDF puede llevar contenido que ningún renderizador pinta a la vista, y es un
// truco conocido contra los filtros automáticos (palabras clave en cuerpo
// microscópico, bloques arrastrados fuera de la página). Lo que la capa de
// texto permite detectar se filtra AQUÍ, antes de que llegue a ningún prompt:
//
//  - texto FUERA de la caja de página (ni un píxel dentro): no existe visualmente;
//  - texto por debajo de MIN_LETRA_PT: a menos de 4pt no lo lee ni una lupa,
//    solo existe para las máquinas.
//
// LÍMITES DECLARADOS, porque un filtro que promete más de lo que ve es peor
// que ninguno: el texto blanco-sobre-blanco y el tapado por una imagen NO se
// pueden detectar desde la capa de texto (el color y el orden de pintado no
// viajan en ella). Contra eso, la única verdad visual es el respaldo de VISIÓN
// (el modelo mira la página renderizada); si algún día compensa pagarlo para
// todos los CVs, el interruptor es de coste, no de código nuevo.
// ----------------------------------------------------------------------------

/** Lo mínimo que este filtro necesita de un item de texto de pdf.js. */
export interface ItemTexto {
  str: string
  transform: number[]
  width?: number
  hasEOL?: boolean
}

export const MIN_LETRA_PT = 4

export function filtrarTextoVisible(items: ItemTexto[], view: number[]): ItemTexto[] {
  const [x0, y0, x1, y1] = view
  return items.filter((it) => {
    const t = it.transform
    if (!Array.isArray(t) || t.length < 6) return false
    const x = t[4]
    const y = t[5]
    const alto = Math.hypot(t[2], t[3]) || Math.abs(t[3])
    if (alto > 0 && alto < MIN_LETRA_PT) return false
    const ancho = it.width ?? 0
    // Se descarta solo lo que queda ENTERO fuera de la página: un item que
    // asoma aunque sea en parte se ve, y tirar texto visible es peor que
    // dejar pasar un margen raro.
    if (x + ancho < x0 || x > x1 || y + alto < y0 || y > y1) return false
    return true
  })
}

/** El juez conserva o quita elementos de una lista, nunca añade ni reescribe:
 *  lo que devuelva que no estuviera en la del evaluador, se descarta. */
export function soloConservados(originales: string[], juez: string[]): string[] {
  const set = new Set(juez.map((s) => s.trim()))
  return originales.filter((s) => set.has(s.trim()))
}

// ----------------------------------------------------------------------------
// Hash del puesto. 16 hex bastan: no es criptografía, es "¿cambió el puesto?".
// ----------------------------------------------------------------------------

export interface CampoDePuesto {
  id: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

export async function hashPuesto(puesto: {
  title: string
  sector: string
  location: string
  fields: CampoDePuesto[]
}): Promise<string> {
  const relevante = JSON.stringify({
    t: puesto.title,
    s: puesto.sector,
    l: puesto.location,
    f: puesto.fields.map((f) => ({ id: f.id, l: f.label, t: f.type, r: !!f.required, o: f.options ?? [] })),
  })
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(relevante))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ----------------------------------------------------------------------------
// Saneo de la salida del generador. El structured output garantiza los enums;
// esto garantiza lo que un esquema no puede decir: claves únicas y con forma,
// tamaño acotado y nombres no vacíos.
// ----------------------------------------------------------------------------

export const MAX_CRITERIOS = 8

export function sanearCriterios(brutos: unknown[]): BaremoCriterio[] {
  const vistos = new Set<string>()
  const out: BaremoCriterio[] = []
  for (const b of brutos) {
    const c = b as Partial<BaremoCriterio> & { anclas?: Partial<BaremoCriterio['anclas']> }
    const clave = String(c?.clave ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
    const nombre = String(c?.nombre ?? '').trim().slice(0, 60)
    if (!clave || !nombre || vistos.has(clave)) continue
    if (!FAMILIAS.includes(c?.familia as Familia)) continue
    if (!NIVELES.includes(c?.nivel as Nivel)) continue
    if (c?.fuente !== 'formulario' && c?.fuente !== 'cv') continue
    vistos.add(clave)
    out.push({
      clave,
      familia: c.familia as Familia,
      nombre,
      nivel: c.nivel as Nivel,
      fuente: c.fuente,
      anclas: {
        cumple: String(c?.anclas?.cumple ?? '').slice(0, 200),
        parcial: String(c?.anclas?.parcial ?? '').slice(0, 200),
        no_cumple: String(c?.anclas?.no_cumple ?? '').slice(0, 200),
      },
    })
    if (out.length >= MAX_CRITERIOS) break
  }
  return out
}

// ----------------------------------------------------------------------------
// Prompts. Los tres comparten registro: español claro, sin guion largo, y la
// regla de oro de "no_consta" (no saber no es no cumplir).
// ----------------------------------------------------------------------------

const FAMILIA_DESC: Record<Familia, string> = {
  experiencia: 'experiencia en un trabajo equivalente al del puesto',
  disponibilidad: 'que su disponibilidad encaje con lo que pide el puesto (jornada, turnos, incorporación)',
  desplazamiento: 'que pueda llegar al centro de trabajo (cercanía, vehículo, carnet de conducir)',
  requisitos: 'requisitos concretos exigibles (carnets, titulaciones, permisos, idiomas)',
  continuidad: 'que su recorrido laboral sugiera continuidad, no cambios muy cortos y constantes',
}

export function promptGenerador(puesto: {
  title: string
  sector: string
  location: string
  fields: CampoDePuesto[]
  tieneCampoCv: boolean
}): { system: string; user: string } {
  const system =
    'Eres un consultor de selección de personal. Conviertes un puesto y su formulario de ' +
    'candidatura en un BAREMO: la lista de criterios con la que un analista juzgará cada ' +
    'candidatura. Escribe en español claro, sin guion largo.\n\n' +
    'Reglas del baremo:\n' +
    '- Entre 3 y ' + MAX_CRITERIOS + ' criterios. Cada uno pertenece a una familia: ' +
    FAMILIAS.map((f) => `${f} (${FAMILIA_DESC[f]})`).join('; ') + '.\n' +
    '- SOLO criterios cuya respuesta pueda salir del formulario o del CV. Si nada puede ' +
    'evidenciar un criterio, no existe. La "fuente" dice de dónde saldrá la evidencia: ' +
    '"formulario" si lo responde una pregunta, "cv" solo para lo que el formulario no ' +
    'pregunta (continuidad laboral, detalle de la trayectoria).\n' +
    '- NO conviertas en criterio una preferencia sin dirección conocida. "¿Qué turno ' +
    'prefieres?" sin saber el turno del puesto no se puede puntuar: puntuar lo imposible ' +
    'mete ruido. Solo puntúa lo que tenga una respuesta claramente favorable para el puesto.\n' +
    '- El nivel dice cuánto PESA el criterio, nunca una categoría eliminatoria: "clave" ' +
    'para lo que más importa al puesto (lo que el formulario o el título piden de forma ' +
    'explícita: carnets, titulaciones); "importante" para el resto de lo que pide el ' +
    'formulario; "deseable" para lo que suma sin ser pedido. Ningún nivel descarta a ' +
    'nadie: solo pondera.\n' +
    '- Los "anclas" dicen qué significa cumple, parcial y no_cumple PARA ESTE PUESTO, con ' +
    'datos concretos, no frases genéricas.\n' +
    '- "nombre" es corto (2 a 5 palabras) y lo leerá alguien sin formación en selección.\n' +
    '- "clave" en snake_case, única.\n' +
    '- PROHIBIDO cualquier criterio sobre edad, sexo, nacionalidad, origen, estado civil, ' +
    'foto o cualquier otro dato personal protegido. El permiso de trabajo solo puede ser ' +
    'criterio si el formulario lo pregunta.' +
    (puesto.tieneCampoCv
      ? '\n- Este puesto RECOGE CV: léelo como un experto en selección. Del CV sale lo que ' +
        'el formulario no pregunta, así que genera 2 o 3 criterios con fuente "cv" de este ' +
        'tipo: duración REAL de la experiencia relevante (lo que suman las etapas del CV, ' +
        'no los años que uno se atribuye), estabilidad (muchas etapas de pocos meses ' +
        'encadenadas cuentan otra historia que dos etapas largas), vigencia de carnets o ' +
        'certificados con fecha, y huecos largos sin actividad. Con anclas concretas para ' +
        'este puesto, como los demás.'
      : '')
  const preguntas = puesto.fields
    .map((f) => {
      const partes = [`"${f.label}"`, `tipo ${f.type}`]
      if (f.required) partes.push('obligatoria')
      if (f.options?.length) partes.push(`opciones: ${f.options.join(' / ')}`)
      return `- ${partes.join(', ')}`
    })
    .join('\n')
  const user =
    `Puesto: ${puesto.title} (${puesto.sector}${puesto.location ? ', ' + puesto.location : ''}).\n\n` +
    `Preguntas del formulario:\n${preguntas || '(sin preguntas de fondo)'}\n\n` +
    (puesto.tieneCampoCv
      ? 'El formulario permite adjuntar CV.'
      : 'El formulario NO pide CV: no siempre habrá uno.')
  return { system, user }
}

export const ESQUEMA_GENERADOR = {
  name: 'baremo_puesto',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      criterios: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            clave: { type: 'string' },
            familia: { type: 'string', enum: FAMILIAS },
            nombre: { type: 'string' },
            nivel: { type: 'string', enum: NIVELES },
            fuente: { type: 'string', enum: ['formulario', 'cv'] },
            anclas: {
              type: 'object',
              additionalProperties: false,
              properties: {
                cumple: { type: 'string' },
                parcial: { type: 'string' },
                no_cumple: { type: 'string' },
              },
              required: ['cumple', 'parcial', 'no_cumple'],
            },
          },
          required: ['clave', 'familia', 'nombre', 'nivel', 'fuente', 'anclas'],
        },
      },
    },
    required: ['criterios'],
  },
} as const

function listaCriterios(criterios: BaremoCriterio[]): string {
  return criterios
    .map((c) =>
      `- ${c.clave} (${c.nombre}, ${c.nivel}): cumple = ${c.anclas.cumple} | ` +
      `parcial = ${c.anclas.parcial} | no_cumple = ${c.anclas.no_cumple}`)
    .join('\n')
}

export function promptEvaluador(args: {
  puesto: string
  criterios: BaremoCriterio[]
  respuestas: string
  cvNota: string
}): { system: string; user: string } {
  const system =
    'Eres Meridian, un asistente de selección de personal. Ayudas a un responsable de ' +
    'contratación a hacer un primer triaje de candidaturas. NO decides ni descartas: ' +
    'resumes y orientas, la persona decide. Escribe en español claro y neutro, sin guion ' +
    'largo. Sé conciso y objetivo, sin inventar datos que no estén en la candidatura.\n\n' +
    'NO puntúas: evalúas EXACTAMENTE estos criterios del baremo del puesto, cada uno con ' +
    'sus anclajes:\n' + listaCriterios(args.criterios) + '\n\n' +
    'Valores posibles para cada criterio:\n' +
    '- "cumple": la candidatura lo demuestra.\n' +
    '- "parcial": lo cumple a medias o con reservas.\n' +
    '- "no_consta": NO hay información para saberlo. No es un punto negativo, y es lo ' +
    'que debes usar siempre que no tengas el dato: al candidato no se le puede penalizar ' +
    'por algo que nadie le preguntó.\n' +
    '- "no_cumple": la candidatura dice claramente que no.\n\n' +
    'EVIDENCIA: todo valor distinto de "no_consta" lleva su evidencia, una cita corta, ' +
    'LITERAL y CONTIGUA de la respuesta o del CV en la que te apoyas: copiada tal cual, ' +
    'sin resumir, sin corregir erratas y sin juntar trozos de sitios distintos (la cita ' +
    'se busca después en el documento, y una cita retocada no se encuentra). En "fuente" ' +
    'di de dónde sale: "respuesta" si viene del formulario, "cv" si viene del CV. Sin ' +
    'evidencia, el valor es "no_consta". No confundas "no_consta" con "no_cumple". ' +
    'Juzga solo lo que veas escrito.\n\n' +
    'CONTRASTE: si el CV contradice una respuesta del formulario (por ejemplo, responde ' +
    '5 años de experiencia y las etapas del CV suman 2), el criterio afectado es ' +
    '"parcial" como máximo y lo apuntas en "contrastes": en "respuesta" resumes lo que ' +
    'respondió y en "cv" citas literal y contiguo el trozo del CV que lo contradice. ' +
    'Como mucho ' + MAX_CONTRASTES + ', y solo contradicciones claras; sin CV o sin ' +
    'contradicción, la lista va vacía.\n\n' +
    'Textos:\n' +
    '- "summary": 1 o 2 frases con la CONCLUSIÓN, no un resumen del CV. Si no se ' +
    'cumple algo de lo que más pesa para el puesto, eso se dice primero.\n' +
    '- "highlights" (2 a 4, muy cortos): salen de los criterios que cumple.\n' +
    '- "concerns" (0 a 3, muy cortos): puntos a confirmar, salidos de lo parcial o sin ' +
    'dato. Nunca un veredicto negativo ni un motivo de descarte, y nunca repiten la ' +
    'conclusión: siempre un hecho concreto.'
  const user =
    `Puesto: ${args.puesto}.\n\n` +
    `Lo que pide el formulario y lo que ha respondido el candidato:\n${args.respuestas || '(sin respuestas)'}\n\n` +
    args.cvNota
  return { system, user }
}

export function esquemaEvaluador(claves: string[]) {
  return {
    name: 'triaje_candidatura',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string', description: 'Conclusión de 1 o 2 frases en español.' },
        highlights: { type: 'array', items: { type: 'string' }, description: 'Puntos a favor, 2 a 4, muy cortos.' },
        concerns: { type: 'array', items: { type: 'string' }, description: 'Puntos a confirmar, 0 a 3, muy cortos.' },
        criterios: {
          type: 'array',
          description: 'Un elemento por cada criterio del baremo, todos y en el mismo orden.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              clave: { type: 'string', enum: claves },
              valor: { type: 'string', enum: VALORES },
              evidencia: {
                type: 'string',
                description: 'Cita corta, literal y contigua, copiada tal cual. Vacía solo con no_consta.',
              },
              fuente: {
                type: 'string',
                enum: ['respuesta', 'cv'],
                description: 'De dónde sale la evidencia. Con no_consta, pon "respuesta".',
              },
            },
            required: ['clave', 'valor', 'evidencia', 'fuente'],
          },
        },
        contrastes: {
          type: 'array',
          description:
            'Contradicciones claras entre una respuesta del formulario y el CV. 0 a ' +
            MAX_CONTRASTES + '. Vacía sin CV o sin contradicción.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              respuesta: { type: 'string', description: 'Lo que respondió, resumido.' },
              cv: { type: 'string', description: 'Cita literal y contigua del CV que lo contradice.' },
            },
            required: ['respuesta', 'cv'],
          },
        },
      },
      required: ['summary', 'highlights', 'concerns', 'criterios', 'contrastes'],
    },
  } as const
}

export function promptJuez(args: {
  puesto: string
  criterios: BaremoCriterio[]
  respuestas: string
  cvNota: string
  evaluacion: {
    summary: string
    highlights: string[]
    concerns: string[]
    criterios: Juicio[]
    contrastes: Contraste[]
  }
}): { system: string; user: string } {
  const system =
    'Eres el verificador de un triaje de candidaturas. NO re-evalúas: compruebas el ' +
    'trabajo de otro analista contra la candidatura, criterio a criterio.\n\n' +
    'Compruebas cuatro cosas:\n' +
    '1. Que la evidencia citada existe en la candidatura y sostiene el valor según el ' +
    'anclaje del criterio. Si no existe o no lo sostiene, REBAJA el valor: hacia ' +
    '"parcial" si la evidencia es más débil de lo afirmado, hacia "no_consta" si no hay ' +
    'dato. Nunca subas un valor ni lo cambies a "no_cumple": rebajar es lo único que ' +
    'puedes hacer. "no_cumple" solo se mantiene si la candidatura dice claramente que no.\n' +
    '2. Que ningún juicio se apoya en el nombre, la edad, el sexo, la nacionalidad o el ' +
    'origen del candidato. Si uno lo hace, rebájalo a "no_consta".\n' +
    '3. Que las listas de puntos a favor y a confirmar salen de los criterios y no ' +
    'contradicen sus valores ni repiten la conclusión. Devuelve SOLO los elementos que ' +
    'se conservan, tal cual estaban escritos: no añadas ni reescribas ninguno.\n' +
    '4. Que cada contraste señala una contradicción REAL entre la respuesta y el CV, con ' +
    'su cita presente en el CV. En "contrastes_conservados" devuelve SOLO los que se ' +
    'conservan, copiados tal cual: no añadas ni reescribas ninguno.\n\n' +
    'Baremo del puesto:\n' + listaCriterios(args.criterios)
  const criteriosTxt = args.evaluacion.criterios
    .map((j) => `- ${j.clave}: ${j.valor}${j.evidencia ? ` (evidencia: "${j.evidencia}")` : ''}`)
    .join('\n')
  const user =
    `Puesto: ${args.puesto}.\n\n` +
    `Candidatura:\n${args.respuestas || '(sin respuestas)'}\n\n` +
    args.cvNota + '\n\n' +
    'Evaluación a verificar:\n' +
    `Conclusión: ${args.evaluacion.summary}\n` +
    `Criterios:\n${criteriosTxt}\n` +
    `A favor: ${args.evaluacion.highlights.join(' | ') || '(nada)'}\n` +
    `A confirmar: ${args.evaluacion.concerns.join(' | ') || '(nada)'}\n` +
    `Contrastes: ${args.evaluacion.contrastes.map(serializarContraste).join(' | ') || '(nada)'}`
  return { system, user }
}

export function esquemaJuez(claves: string[]) {
  return {
    name: 'veredicto_triaje',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        criterios: {
          type: 'array',
          description: 'Un elemento por criterio verificado, mismas claves.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              clave: { type: 'string', enum: claves },
              valor: { type: 'string', enum: VALORES },
            },
            required: ['clave', 'valor'],
          },
        },
        a_favor: { type: 'array', items: { type: 'string' }, description: 'Puntos a favor que se conservan, tal cual.' },
        a_confirmar: { type: 'array', items: { type: 'string' }, description: 'Puntos a confirmar que se conservan, tal cual.' },
        contrastes_conservados: {
          type: 'array',
          items: { type: 'string' },
          description: 'Contrastes que se conservan, copiados tal cual estaban escritos.',
        },
      },
      required: ['criterios', 'a_favor', 'a_confirmar', 'contrastes_conservados'],
    },
  } as const
}

// ----------------------------------------------------------------------------
// Trayectoria: el prompt de la extracción. Llamada aparte del evaluador (corre
// en paralelo) y con un solo trabajo: transcribir, no interpretar.
// ----------------------------------------------------------------------------

export function promptTrayectoria(cv: string): { system: string; user: string } {
  const system =
    'Transcribes los datos de un CV a una ficha estructurada. TRANSCRIBE, no ' +
    'interpretes: las fechas tal cual las escribe el CV ("mar 2021", "2019 - 2022", ' +
    '"actualidad"), los nombres de empresa y de puesto tal cual, y lo que el CV no ' +
    'diga, cadena vacía. No calcules duraciones, no rellenes huecos, no corrijas ' +
    'erratas. Cada etapa UNA sola vez y solo si el CV la lista como experiencia ' +
    'laboral con su empresa: no conviertas en empleo una sección del CV (habilidades, ' +
    'áreas de interés, objetivos) ni repitas ningún elemento. Los empleos en el orden ' +
    'en que aparecen en el CV. En "carnets" van carnets, licencias y certificados ' +
    'profesionales (carnet de conducir, carretillero, PRL, manipulador de alimentos), ' +
    'con su vigencia o fecha si el CV la dice. En "formacion" van estudios y cursos, ' +
    'una línea por cada uno. Español, sin guion largo.'
  const user = `CV:\n${cv}`
  return { system, user }
}

export const ESQUEMA_TRAYECTORIA = {
  name: 'trayectoria_cv',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      empleos: {
        type: 'array',
        description: 'Etapas laborales del CV, en su orden. Vacía si el CV no lista empleos.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            empresa: { type: 'string' },
            puesto: { type: 'string' },
            desde: { type: 'string', description: 'Tal cual lo escribe el CV. Vacía si no consta.' },
            hasta: { type: 'string', description: 'Tal cual lo escribe el CV. Vacía si no consta.' },
          },
          required: ['empresa', 'puesto', 'desde', 'hasta'],
        },
      },
      carnets: {
        type: 'array',
        description: 'Carnets, licencias y certificados profesionales.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            nombre: { type: 'string' },
            vigencia: { type: 'string', description: 'Fecha o vigencia si el CV la dice. Vacía si no.' },
          },
          required: ['nombre', 'vigencia'],
        },
      },
      formacion: {
        type: 'array',
        items: { type: 'string' },
        description: 'Estudios y cursos, una línea por cada uno.',
      },
    },
    required: ['empleos', 'carnets', 'formacion'],
  },
} as const

// ---------------------------------------------------------------------------
// EL REDACTOR: el informe en prosa (Mario, ago 2026). Sustituye en la ficha al
// desglose criterio a criterio, que era "la información de las respuestas en
// peor" (feedback real de un cliente): repetía lo que el usuario ya tiene
// delante, en formato lista. El informe es lo que un profesional de selección
// le diría a su jefe al preguntarle por este candidato: un párrafo que se
// sostiene solo.
//
// Corre DESPUÉS del juez y solo recibe material VERIFICADO (juicios finales
// con su evidencia, contrastes conservados, trayectoria saneada): no puede
// apoyarse en nada que el juez haya tirado. Es la misma arquitectura de
// siempre: el modelo redacta, el código decide qué material le llega.
// ---------------------------------------------------------------------------

export const MAX_INFORME = 900

/**
 * Sanea el informe: UN párrafo (los saltos de línea colapsan), sin guion largo
 * (regla de copy de toda la app) y con techo duro. Si al recortar hay un final
 * de frase razonable, se corta ahí: un informe a media palabra es peor que uno
 * una frase más corto. Vacío o inservible -> null (el análisis sale sin él).
 */
export function sanearInforme(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null
  let s = bruto
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length < 20) return null
  if (s.length > MAX_INFORME) {
    const recorte = s.slice(0, MAX_INFORME)
    const fin = recorte.lastIndexOf('. ')
    s = fin > MAX_INFORME * 0.5 ? recorte.slice(0, fin + 1) : recorte.trimEnd()
  }
  return s
}

export function promptRedactor(args: {
  puesto: string
  criterios: BaremoCriterio[]
  juicios: Juicio[]
  contrastes: Contraste[]
  trayectoria: TrayectoriaCv | null
  cvUsado: boolean
}): { system: string; user: string } {
  const system =
    'Eres Meridian, el asistente de selección. El triaje de una candidatura ya está ' +
    'hecho y verificado; tu trabajo es REDACTAR EL INFORME: lo que un profesional de ' +
    'selección con años de oficio le diría a su jefe cuando le pregunta por este ' +
    'candidato. Un solo párrafo hablado, de 3 a 5 frases, en primera persona.\n\n' +
    'Reglas:\n' +
    '- Solo puedes afirmar lo que está en el material de abajo. Nada supuesto, nada de ' +
    'fuera. Lo que no consta se dice como pendiente: "le preguntaría por...".\n' +
    '- No enumeres los criterios uno a uno ni repitas las respuestas del formulario: ' +
    'eso el jefe ya lo tiene delante. Cuenta lo que se aprende al cruzarlas: qué ' +
    'convence, qué chirría y qué falta por saber.\n' +
    '- Empieza por lo que más pesa para decidir, sea bueno o malo. Sin cortesías ni ' +
    'fórmulas vacías ("perfil interesante", "buen encaje general").\n' +
    '- Si hay una contradicción entre una respuesta y el CV, dila claramente y con sus ' +
    'dos mitades: es de lo más valioso del informe.\n' +
    '- Antes de escribir "le preguntaría por X", CRUZA X con la trayectoria: si sus ' +
    'empleos ya acreditan una parte (quien ha trabajado de cara al público YA ha ' +
    'tratado con clientes; quien ha llevado una caja YA ha cobrado), reconoce esa ' +
    'parte y pregunta solo por la que de verdad falta ("viene de atención al público, ' +
    'aunque no en sala: le preguntaría por mesas y comandas en concreto"). Pedir en ' +
    'bloque lo que su trayectoria ya enseña delata que el informe no la ha leído.\n' +
    '- Si no hay CV, menciónalo solo si condiciona la lectura.\n' +
    '- NO recomiendas contratar ni descartar: orientas, la persona decide. Nada de ' +
    'notas ni puntuaciones.\n' +
    '- Prohibido: listas, encabezados, guion largo, negritas. Español claro y directo. ' +
    'El informe tiene que sostenerse solo: quien lo lea sin ver nada más se queda con ' +
    'una foto útil de esta persona para este puesto.'
  const valorDe = new Map(args.juicios.map((j) => [j.clave, j]))
  const material = args.criterios
    .map((c) => {
      const j = valorDe.get(c.clave)
      const valor = j?.valor ?? 'no_consta'
      const ev = j?.evidencia ? ` (evidencia: "${j.evidencia}")` : ''
      return `- ${c.nombre} [${c.nivel}]: ${valor}${ev}`
    })
    .join('\n')
  const trayectoriaTxt = args.trayectoria
    ? 'Trayectoria del CV:\n' +
      args.trayectoria.empleos
        .map((e) => `- ${[e.puesto, e.empresa].filter(Boolean).join(' en ')}${e.desde || e.hasta ? ` (${[e.desde, e.hasta].filter(Boolean).join(' - ')})` : ''}`)
        .join('\n') +
      (args.trayectoria.carnets.length
        ? '\nCarnets: ' + args.trayectoria.carnets.map((c) => c.nombre + (c.vigencia ? ` (${c.vigencia})` : '')).join(', ')
        : '') +
      (args.trayectoria.formacion.length ? '\nFormación: ' + args.trayectoria.formacion.join(', ') : '')
    : args.cvUsado
      ? ''
      : 'No adjuntó CV: el triaje es solo con sus respuestas.'
  const user =
    `Puesto: ${args.puesto}.\n\n` +
    `Juicios verificados del baremo:\n${material || '(ninguno)'}\n\n` +
    (args.contrastes.length
      ? `Contradicciones respuesta-vs-CV confirmadas:\n${args.contrastes.map((c) => `- ${serializarContraste(c)}`).join('\n')}\n\n`
      : '') +
    trayectoriaTxt
  return { system, user }
}

export const ESQUEMA_INFORME = {
  name: 'informe_triaje',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      informe: {
        type: 'string',
        description: 'El informe: un solo párrafo de 3 a 5 frases, en español.',
      },
    },
    required: ['informe'],
  },
} as const

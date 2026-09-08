/**
 * LA TORRE DE PRIMEROS PASOS: qué pasos hay, en qué orden y cómo se decide en
 * cuál estás. Es lógica pura (sin React ni Supabase) para que el guardián
 * (`primerosPasos.test.ts`) la pruebe sin montar nada y para que la pinten
 * dos sitios (la torre de Vista general y el anillo del menú de cuenta) sin
 * que cada uno lleve su propia cuenta.
 *
 * LA COLUMNA ES LA VERDAD Y LOS DATOS SON EL DETECTOR. Cuatro pasos se pueden
 * deducir mirando la empresa (¿hay puesto?, ¿hay candidatura?, ¿hay logo?...),
 * y esa deducción se ESCRIBE como marca en `companies.onboarding_pasos` en
 * cuanto se cumple. Eso es lo que da el latch: borrar la candidatura de prueba
 * no reabre "Pruébalo tú mismo", ni borrar el puesto reabre "Crea tu puesto".
 * Los dos pasos que no salen de datos (haber entrado a las preguntas, haber
 * copiado el enlace) solo existen como marca. Y los opcionales admiten
 * 'omitido', que cuenta como resuelto para cerrar la guía pero se pinta
 * distinto, porque no es lo mismo haberlo hecho que haber pasado de largo.
 *
 * EL ORDEN DE `PASOS` ES EL ALGORITMO: el paso actual es el primero sin
 * resolver, en este orden. Añadir o quitar un paso es una entrada aquí y nada
 * más; el total del anillo y el "N de M" salen de la longitud de la lista.
 */

export type PasoId = 'puesto' | 'preguntas' | 'probar' | 'enlace' | 'equipo' | 'logo'
export type Marca = 'hecho' | 'omitido'
export type Marcas = Partial<Record<PasoId, Marca>>

export interface Paso {
  id: PasoId
  titulo: string
  texto: string
  /** Etiqueta del botón principal. */
  accion: string
  /** Admite "Omitir": no todo el mundo tiene equipo ni logo. */
  opcional: boolean
}

export const PASOS: readonly Paso[] = [
  {
    id: 'puesto',
    titulo: 'Crea tu primer puesto',
    texto: 'Elige una plantilla de tu sector y escribe tu anuncio. Lo tienes listo en un minuto.',
    accion: 'Crear un puesto',
    opcional: false,
  },
  {
    id: 'preguntas',
    titulo: 'Revisa las preguntas de tu puesto',
    texto: 'Son las que responde quien abre tu enlace. Cambia, quita o añade las que quieras: se guardan solas.',
    accion: 'Ver las preguntas',
    opcional: false,
  },
  {
    id: 'probar',
    titulo: 'Pruébalo tú mismo',
    texto: 'Abre tu enlace, responde como si fueras un candidato y mira cómo llega a tu lista.',
    accion: 'Ir a mi puesto',
    opcional: false,
  },
  {
    id: 'enlace',
    titulo: 'Comparte tu enlace',
    texto: 'Pégalo en tu anuncio o mándaselo a quien te escriba. Cada candidatura entra sola en tu lista.',
    accion: 'Copiar enlace',
    opcional: false,
  },
  {
    id: 'equipo',
    titulo: 'Invita a tu equipo',
    texto: 'Quien invites verá los candidatos contigo y podrá moverlos de estado. Sin coste por persona.',
    accion: 'Invitar a alguien',
    opcional: true,
  },
  {
    id: 'logo',
    titulo: 'Pon tu logo',
    texto: 'Sale en tu anuncio y encima de las preguntas: quien se apunta sabe que es tu empresa.',
    accion: 'Subir mi logo',
    opcional: true,
  },
]

const IDS = new Set<string>(PASOS.map((p) => p.id))
const esPaso = (id: string): id is PasoId => IDS.has(id)
const esMarca = (v: unknown): v is Marca => v === 'hecho' || v === 'omitido'

/** Lo que los DATOS dicen de la empresa. Es el detector; la marca es la verdad. */
export interface Deducido {
  hayPuesto: boolean
  /** Cualquier candidatura, la de prueba incluida. */
  hayCandidatura: boolean
  /** Una candidatura que no es la de prueba: el enlace ya circula. */
  hayCandidaturaReal: boolean
  /** Alguien más aparte de ti. */
  hayEquipo: boolean
  hayLogo: boolean
}

/** Los pasos que los datos dan por hechos. `preguntas` nunca está: no hay dato que lo diga. */
export function pasosDeducidos(d: Deducido): PasoId[] {
  const out: PasoId[] = []
  if (d.hayPuesto) out.push('puesto')
  if (d.hayCandidatura) out.push('probar')
  if (d.hayCandidaturaReal) out.push('enlace')
  if (d.hayEquipo) out.push('equipo')
  if (d.hayLogo) out.push('logo')
  return out
}

/**
 * La aduana del jsonb: la base no valida claves ni valores (repetir la lista
 * en SQL sería una segunda lista que se queda vieja), así que se filtra al leer,
 * como `leerAnuncio` con el anuncio. Un valor raro se tira, no se rompe nada.
 */
export function leerMarcas(raw: unknown): Marcas {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Marcas = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (esPaso(k) && esMarca(v)) out[k] = v
  }
  return out
}

/**
 * Fusiona marcas nuevas sobre las que hay. Tres reglas:
 *  - un 'hecho' NUNCA baja: ni a 'omitido' ni a nada (es el latch);
 *  - 'omitido' solo vale en los pasos opcionales;
 *  - una clave que no es un paso se ignora.
 */
export function aplicarMarcas(actual: Marcas, patch: Marcas): Marcas {
  const out: Marcas = { ...actual }
  for (const [k, v] of Object.entries(patch)) {
    if (!esPaso(k) || !esMarca(v)) continue
    if (out[k] === 'hecho') continue
    if (v === 'omitido' && !PASOS.find((p) => p.id === k)?.opcional) continue
    out[k] = v
  }
  return out
}

/** ¿Hay algo que escribir? Evita un `update` que no cambia nada. */
export function marcasIguales(a: Marcas, b: Marcas): boolean {
  return PASOS.every((p) => a[p.id] === b[p.id])
}

export type EstadoPaso = 'hecho' | 'omitido' | 'actual' | 'pendiente'

export interface EstadoTorre {
  pasos: { id: PasoId; estado: EstadoPaso }[]
  /** El primero sin resolver; null cuando la torre está completa. */
  actual: PasoId | null
  /** Hechos y omitidos: lo que pinta el anillo. */
  hechos: number
  total: number
  completa: boolean
}

export function estadoDeLaTorre(marcas: Marcas, d: Deducido): EstadoTorre {
  const deducidos = new Set(pasosDeducidos(d))
  let actual: PasoId | null = null
  const pasos = PASOS.map((p) => {
    let estado: EstadoPaso
    if (marcas[p.id] === 'hecho' || deducidos.has(p.id)) estado = 'hecho'
    else if (marcas[p.id] === 'omitido') estado = 'omitido'
    else if (actual === null) {
      actual = p.id
      estado = 'actual'
    } else estado = 'pendiente'
    return { id: p.id, estado }
  })
  const hechos = pasos.filter((p) => p.estado === 'hecho' || p.estado === 'omitido').length
  return { pasos, actual, hechos, total: PASOS.length, completa: actual === null }
}

export function estadoDe(t: EstadoTorre, id: PasoId): EstadoPaso {
  return t.pasos.find((p) => p.id === id)?.estado ?? 'pendiente'
}

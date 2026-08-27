/**
 * EL ANUNCIO DEL PUESTO (Mario, ago 2026, con su diseño de Figma delante).
 *
 * Hasta hoy el enlace de un puesto abría directamente el FORMULARIO: quien
 * llegaba tenía que decidir si se apuntaba sin saber dónde es, cuánto paga ni
 * qué se pide. Esto es lo que se lee ANTES, y el formulario pasa a abrirse al
 * pulsar "Apúntate ahora".
 *
 * POR QUÉ SE LLAMA `anuncio` Y NO `oferta`. El glosario está congelado y
 * "oferta" está ahí como PROHIBIDA, junto a "vacante" y "campaña", porque las
 * tres se usaban como sinónimos de PUESTO. Esto no es el puesto: es lo que el
 * puesto cuenta de sí mismo, o sea un anuncio, que además es la misma palabra
 * que usa la promesa del producto ("la empresa pone su anuncio como siempre") y
 * la que usará el multiposting el día que exista.
 *
 * POR QUÉ UN SOLO MÓDULO. Estos vocabularios los van a leer TRES superficies que
 * no se hablan: el paso del asistente de creación, el bloque del constructor
 * (para corregirlo después) y la página pública. Escritos en las tres, la
 * primera que cambie deja mintiendo a las otras dos; es exactamente lo que ya
 * pasó con la cuenta del `sr-only` de la Bandeja y con las dos listas de campos
 * ya pintados. AÑADIR UN VALOR es una entrada aquí, nunca UI nueva.
 *
 * LA UBICACIÓN NO ESTÁ AQUÍ, y no es un olvido: `campaigns.location` existe
 * desde el primer día, se pinta en la cabecera del puesto y la lee el baremo de
 * Meridian. Meterla también en este objeto serían dos sitios para el mismo
 * hecho, que es como empiezan a existir dos ubicaciones distintas. Lo que sí
 * hace este anuncio es darle por fin un EDITOR: hasta ahora solo se rellenaba
 * en la demo, porque ninguna pantalla la dejaba escribir.
 */

/** Dónde se trabaja. El valor es la clave; la etiqueta la pone `MODALIDADES`. */
export type Modalidad = 'presencial' | 'hibrido' | 'teletrabajo'

/**
 * Se llama MODALIDAD y no "asistencia", que es como salió en la conversación al
 * traducir el icono de oficina del diseño. En un anuncio español la palabra es
 * modalidad (o "modalidad de trabajo"); "asistencia" es lo que se pasa lista en
 * un colegio, y el glosario manda que se escriba como lo escribiría quien lo va
 * a leer.
 */
export const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'teletrabajo', label: 'Teletrabajo' },
]

/** Sobre qué unidad está dicho el salario. Siempre BRUTO: en España es lo que se anuncia. */
export type PeriodoSalario = 'año' | 'mes' | 'hora'

export const PERIODOS: { value: PeriodoSalario; label: string }[] = [
  { value: 'año', label: 'Bruto/año' },
  { value: 'mes', label: 'Bruto/mes' },
  { value: 'hora', label: 'Bruto/hora' },
]

/**
 * Los cinco tramos de experiencia. Son TRAMOS y no un número de años a mano por
 * lo mismo que el encaje se dice en palabras y no con la nota cruda: nadie pide
 * "3,5 años", se pide un perfil, y un número exacto invita a descartar por un
 * mes de diferencia.
 */
export const EXPERIENCIAS = [
  'Sin experiencia',
  'Menos de 1 año',
  'De 1 a 2 años',
  'De 2 a 5 años',
  'Más de 5 años',
] as const

/** El sistema educativo español, de menos a más. El orden ES la escala. */
export const ESTUDIOS = [
  'Sin estudios',
  'Educación Secundaria Obligatoria',
  'Bachillerato',
  'Ciclo Formativo de Grado Medio',
  'Ciclo Formativo de Grado Superior',
  'Grado universitario',
  'Máster',
  'Doctorado',
] as const

/**
 * EL CONTRATO. Los tipos que existen de verdad en España después de la reforma
 * laboral: "por obra o servicio" ya no es uno de ellos, y en construcción lo que
 * hay es un INDEFINIDO adscrito a obra, así que ofrecerlo aparte sería enseñar
 * en un anuncio una figura que no se puede firmar.
 *
 * No está "autónomo" a propósito: no es un contrato, es una relación mercantil,
 * y este producto sirve para contratar plantilla. Ponerlo en la lista de tipos
 * de contrato es exactamente el sitio donde nace un falso autónomo.
 */
export const CONTRATOS = [
  'Indefinido',
  'Temporal',
  'Fijo discontinuo',
  'Formativo',
] as const

/**
 * LA JORNADA SON DOS, y la lista corta es la decisión. Lo que un candidato
 * necesita saber antes de apuntarse es si el puesto le ocupa la semana entera o
 * no; el TURNO (de noche, partido, fines de semana) no es la jornada y se cuenta
 * en la descripción, que es donde cabe decir "de 22 a 6 con plus de nocturnidad"
 * en vez de meterlo a la fuerza en un desplegable.
 */
export const JORNADAS = ['Completa', 'Parcial'] as const

/** Los cuatro niveles con los que se piden idiomas en una oferta española. */
export const NIVELES_IDIOMA = [
  'Básico',
  'Intermedio',
  'Avanzado',
  'Nativo o bilingüe',
] as const

/**
 * El idioma se escribe A MANO y el nivel se elige de una lista. No es una
 * asimetría por descuido: la lista de idiomas del mundo no cabe en un
 * desplegable útil (y en cuanto se recorta deja fuera al rumano o al ucraniano,
 * que es justo quien trabaja en estos sectores), mientras que los niveles son
 * cuatro y tienen que ser comparables entre puestos.
 */
export interface IdiomaRequerido {
  idioma: string
  nivel: string
}

export interface Anuncio {
  /** Texto libre: el día a día del puesto. Es lo único que no se puede plantillar. */
  descripcion: string
  modalidad: Modalidad | ''
  /** Salario en euros. `min` es obligatorio; `max` convierte la cifra en horquilla. */
  salarioMin: number | null
  salarioMax: number | null
  salarioPeriodo: PeriodoSalario
  contrato: string
  jornada: string
  experiencia: string
  estudios: string
  idiomas: IdiomaRequerido[]
  /** Las pastillas de "Conocimientos necesarios". Vocabulario libre del puesto. */
  conocimientos: string[]
}

/**
 * Un anuncio sin poner. Se usa como valor de partida del editor y como red de
 * seguridad al leer de la base: la columna es `jsonb` y nace en null, así que
 * todo puesto anterior a esta función pasa por aquí.
 */
export const anuncioVacio = (): Anuncio => ({
  descripcion: '',
  modalidad: '',
  salarioMin: null,
  salarioMax: null,
  salarioPeriodo: 'año',
  contrato: '',
  jornada: '',
  experiencia: '',
  estudios: '',
  idiomas: [],
  conocimientos: [],
})

/**
 * Normaliza lo que venga de la base. `jsonb` no valida nada, y un anuncio
 * guardado por una versión anterior (o a medias) no puede dejar la pantalla en
 * blanco: lo que falte cae en su valor vacío, campo a campo.
 */
export function leerAnuncio(raw: unknown): Anuncio {
  const base = anuncioVacio()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  // Lo que sale de una lista cerrada se comprueba contra la lista. Un valor de
  // fuera dejaría el selector en blanco sin que nadie pueda saber qué había, y
  // la página pública pintaría una palabra que este producto no reconoce.
  const unoDe = (lista: readonly string[], v: unknown) =>
    typeof v === 'string' && lista.includes(v) ? v : ''
  return {
    descripcion: str(r.descripcion),
    modalidad: MODALIDADES.some((m) => m.value === r.modalidad) ? (r.modalidad as Modalidad) : '',
    salarioMin: num(r.salarioMin),
    salarioMax: num(r.salarioMax),
    salarioPeriodo: PERIODOS.some((p) => p.value === r.salarioPeriodo)
      ? (r.salarioPeriodo as PeriodoSalario)
      : 'año',
    contrato: unoDe(CONTRATOS, r.contrato),
    jornada: unoDe(JORNADAS, r.jornada),
    experiencia: unoDe(EXPERIENCIAS, r.experiencia),
    estudios: unoDe(ESTUDIOS, r.estudios),
    idiomas: Array.isArray(r.idiomas)
      ? r.idiomas
          .map((i) => ({ idioma: str((i as Record<string, unknown>)?.idioma), nivel: str((i as Record<string, unknown>)?.nivel) }))
          .filter((i) => i.idioma.trim())
      : [],
    conocimientos: Array.isArray(r.conocimientos)
      ? r.conocimientos.filter((c): c is string => typeof c === 'string' && !!c.trim())
      : [],
  }
}

/**
 * ¿Está este anuncio SIN EMPEZAR? No es lo mismo que incompleto: distingue el
 * puesto que nunca ha visto esta pantalla (todos los anteriores a agosto de
 * 2026) del que tiene la mitad puesta. Lo usa el constructor para abrir el
 * bloque solo cuando de verdad hay algo que hacer, igual que hace Identidad.
 */
export function anuncioSinEmpezar(a: Anuncio, location: string): boolean {
  return (
    !location.trim() && !a.modalidad && a.salarioMin == null && a.salarioMax == null &&
    !a.contrato && !a.jornada && !a.experiencia && !a.estudios && !a.descripcion.trim() &&
    a.idiomas.length === 0 && a.conocimientos.length === 0
  )
}

/** Cómo se resume un anuncio en una línea: dónde, cómo y desde cuánto. */
export function resumenAnuncio(a: Anuncio, location: string): string {
  return [
    location.trim(),
    MODALIDADES.find((m) => m.value === a.modalidad)?.label,
    a.salarioMin != null ? `Desde ${a.salarioMin.toLocaleString('es-ES')} €` : '',
  ].filter(Boolean).join(' · ')
}

// --------------------------------------------------------------------------
// CÓMO SE ESCRIBE UN ANUNCIO. Estas cuatro funciones son lo que lee el
// candidato, y viven aquí y no en la pantalla por lo de siempre: el día que
// haya una segunda superficie que lo pinte (una vista previa en el
// constructor, un feed, el multiposting) tiene que decirlo con las mismas
// palabras. Devuelven cadena VACÍA cuando no hay dato, nunca "No disponible":
// quien las llama decide si esa fila se pinta o desaparece.
// --------------------------------------------------------------------------

const miles = (n: number) => n.toLocaleString('es-ES')

/** "22.000 - 26.000 € bruto/año" · "Desde 22.000 € bruto/año" */
export function salarioTexto(a: Anuncio): string {
  if (a.salarioMin == null && a.salarioMax == null) return ''
  const periodo = PERIODOS.find((p) => p.value === a.salarioPeriodo)?.label.toLowerCase() ?? ''
  // El símbolo va UNA vez, al final de la cifra: "45.000 € - 60.000 €" repite un
  // euro que ya se sabe, y en español el espacio antes del símbolo no es opcional.
  const cifra =
    a.salarioMin != null && a.salarioMax != null
      ? `${miles(a.salarioMin)} - ${miles(a.salarioMax)} €`
      : a.salarioMin != null
        ? `Desde ${miles(a.salarioMin)} €`
        : `Hasta ${miles(a.salarioMax as number)} €`
  return `${cifra} ${periodo}`.trim()
}

/** "Experiencia mínima: más de 5 años" */
export function experienciaTexto(a: Anuncio): string {
  if (!a.experiencia) return ''
  // El tramo se escribe en minúscula dentro de la frase: "Experiencia mínima:
  // Más de 5 años" mete una mayúscula en mitad de una oración.
  return `Experiencia mínima: ${a.experiencia.charAt(0).toLowerCase()}${a.experiencia.slice(1)}`
}

/** "Contrato indefinido, jornada completa". A medias dice solo la mitad que hay. */
export function contratoTexto(a: Anuncio): string {
  const partes = [
    a.contrato ? `Contrato ${a.contrato.toLowerCase()}` : '',
    a.jornada ? `jornada ${a.jornada.toLowerCase()}` : '',
  ].filter(Boolean)
  if (!partes.length) return ''
  // Con las dos, la frase empieza en mayúscula por "Contrato"; con solo la
  // jornada, hay que levantarla.
  const t = partes.join(', ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Los estudios, dichos como una CONDICIÓN y no como una etiqueta. Un birrete
 * seguido de "Ciclo Formativo de Grado Medio" se entiende solo; seguido de "Sin
 * estudios" parece que le falta algo, porque el dato es que NO se piden.
 */
export function estudiosTexto(a: Anuncio): string {
  if (!a.estudios) return ''
  return a.estudios === 'Sin estudios' ? 'Sin estudios mínimos' : a.estudios
}

export const modalidadLabel = (a: Anuncio) =>
  MODALIDADES.find((m) => m.value === a.modalidad)?.label ?? ''

/**
 * ¿HAY ANUNCIO QUE ENSEÑAR? Es la pregunta que decide si el enlace público abre
 * la página del anuncio o va derecho al formulario, como hasta ago 2026.
 *
 * Se mira lo que el candidato viene a LEER: un puesto creado antes de que esto
 * existiera no tiene nada que contar, y una página con el título y cuatro
 * huecos es peor que el formulario de siempre.
 *
 * LA UBICACIÓN NO CUENTA, y eso se aprendió en pantalla. Es una columna que
 * existe desde el primer día, así que hay puestos con ciudad y sin una sola
 * línea de anuncio; contándola, esos abrían una página con el título, una
 * ciudad y nada más, que es exactamente lo que esta función viene a impedir.
 * Sí se PINTA en cuanto hay página, porque entonces es un hecho más del
 * lateral; lo que no puede es decidir que haya página.
 */
export function hayAnuncio(a: Anuncio | undefined): boolean {
  if (!a) return false
  return !!(
    a.descripcion.trim() || a.modalidad || a.salarioMin != null || a.salarioMax != null ||
    a.contrato || a.jornada || a.experiencia || a.estudios ||
    a.conocimientos.length || a.idiomas.length
  )
}

/** Los campos del anuncio que se piden para poder crear el puesto. */
export type CampoAnuncio =
  | 'location' | 'modalidad' | 'salario' | 'contrato' | 'jornada'
  | 'experiencia' | 'estudios' | 'descripcion'

/**
 * QUÉ FALTA POR RELLENAR, en un solo sitio.
 *
 * Lo obligatorio es lo que un candidato mira ANTES de decidir si se apunta:
 * dónde es, cómo se trabaja, cuánto paga, con qué contrato y qué jornada, qué
 * pide y qué se hace. El contrato entra con los demás y no como un extra: en
 * España, indefinido o temporal es de lo primero que se mira, y a medias la
 * línea del anuncio no se puede escribir ("contrato indefinido," sin jornada no
 * es una frase). Idiomas y
 * conocimientos se quedan fuera porque hay puestos que legítimamente no piden
 * ninguno, y un obligatorio que se rellena con cualquier cosa para poder seguir
 * es peor que no pedirlo.
 *
 * El salario se pide a propósito, y no es solo una preferencia de producto: la
 * directiva europea de transparencia retributiva obliga desde 2026 a decir la
 * retribución inicial o su horquilla antes de la entrevista. Aquí es una sola
 * cifra ("Desde"), y la segunda la pone quien quiera dar horquilla.
 */
export function faltaEnAnuncio(a: Anuncio, location: string): CampoAnuncio[] {
  const falta: CampoAnuncio[] = []
  if (!location.trim()) falta.push('location')
  if (!a.modalidad) falta.push('modalidad')
  if (a.salarioMin == null) falta.push('salario')
  if (!a.contrato) falta.push('contrato')
  if (!a.jornada) falta.push('jornada')
  if (!a.experiencia) falta.push('experiencia')
  if (!a.estudios) falta.push('estudios')
  if (!a.descripcion.trim()) falta.push('descripcion')
  return falta
}

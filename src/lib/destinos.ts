import {
  CalendarDays,
  ContactRound,
  CreditCard,
  FileText,
  Gauge,
  LayoutGrid,
  MessagesSquare,
  Palette,
  SlidersHorizontal,
  Star,
  UserCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FUERTE, scoreEntrada } from './search'
import { vistaPor } from './candidatos'
import { gruposVisibles, seccionesVisibles, type AjustesCtx } from './settings'

/**
 * EL MAPA DE LA APP. Única fuente de verdad de a qué sitios se puede ir y qué se
 * puede hacer desde el buscador de la barra. Mismo patrón que el registro de
 * ajustes (`settings.tsx`) y que los avisos (`avisos.ts`): se declara, no se
 * programa.
 *
 * El problema que resuelve: el producto gana apartados más rápido de lo que el
 * menú lateral puede crecer, y hay cosas que a propósito NO tienen puerta propia
 * (la sede es un atributo del puesto, la marca vive en el constructor). Si lo
 * único que encuentra el buscador son personas, todo eso solo lo alcanza quien
 * ya sabe dónde está.
 *
 * AÑADIR ALGO ENCONTRABLE:
 *
 *   1. Una pantalla nueva: un `Destino` más aquí abajo, con su `to` y sus
 *      `claves`. Aparece en el buscador, en su grupo, ordenado por relevancia.
 *   2. Un ajuste nuevo: NADA. Los ajustes se DERIVAN del registro de
 *      `settings.tsx`, uno por interruptor, con enlace directo a su fila.
 *   3. Una acción nueva: `useAccion(...)` desde quien la sepa ejecutar
 *      (`lib/acciones.tsx`). Global si la registra el shell, contextual si la
 *      registra la pantalla abierta.
 *
 * Y una prueba lo vigila (`destinos.test.ts`): si añades una ruta de producto o
 * una entrada al menú lateral y no se puede encontrar, falla.
 *
 * Dos reglas de calidad de la lista:
 *
 *   * **Solo coincidencia fuerte.** Un apartado entra si escribiste su nombre o
 *     uno de sus sinónimos (>= FUERTE). La tolerancia a erratas se queda para
 *     las personas, que es para lo que se hizo: sacar "Ajustes" cada vez que
 *     tecleas algo parecido convertiría la lista en ruido.
 *   * **Lo que no existe no se pinta.** `disponible` (rol, staff, demo,
 *     banderas) es binario y silencioso. Los candados por plan murieron con el
 *     pago por proceso (todo el producto incluido, ago 2026): si algún día
 *     vuelve algo de pago, su sitio es un campo declarado aquí, no un if en el
 *     buscador.
 */

// --- Contexto -----------------------------------------------------------------

export interface DestinosCtx {
  /** '/app' o '/demo'. */
  base: string
  demo: boolean
  plan: string | undefined
  role: string | null
  isStaff: boolean
  /** Puesto abierto ahora, o el primero de la lista. Null si no hay ninguno. */
  campaignId: string | null
  /** El mismo contexto que arma la pantalla de Ajustes: de ahí salen los derivados. */
  ajustes: AjustesCtx
}

export interface Destino {
  id: string
  label: string
  /** Una línea: qué es o dónde vive de verdad. Lo que convierte un resultado en una respuesta. */
  hint?: string
  icon: LucideIcon
  /** Sinónimos y palabras que la gente escribe de verdad: "excel", "logo", "factura". */
  claves?: string[]
  /** Si devuelve false, NO existe: ni en el buscador ni escribiendo la URL. */
  disponible?: (c: DestinosCtx) => boolean
  to: (c: DestinosCtx) => string
}

/** Algo que se ejecuta, no un sitio. Lo registra quien lo sabe hacer (`lib/acciones.tsx`). */
export interface Accion {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  claves?: string[]
  hacer: () => void
}

// --- Los destinos --------------------------------------------------------------

export const DESTINOS: Destino[] = [
  {
    id: 'resumen',
    label: 'Vista general',
    hint: 'El saludo del día, lo que pide atención y por dónde entra la gente.',
    icon: LayoutGrid,
    claves: ['inicio', 'resumen', 'panel', 'cifras', 'estadisticas'],
    to: (c) => `${c.base}/resumen`,
  },
  // Cada vista de la lista de gente es un destino, no una con opciones: a
  // "contratados" se va escribiendo esa palabra, que es de lo que va el buscador.
  // Sus rutas y sus nombres salen del mismo sitio que el menú (`lib/candidatos.ts`),
  // así que no pueden decir cosas distintas.
  {
    id: 'candidatos',
    label: 'Candidatos',
    hint: 'Tu gente, de todos los puestos. Sin los descartados.',
    icon: ContactRound,
    claves: ['activos', 'nuevos', 'sin leer', 'entradas', 'candidaturas', 'base de datos', 'bandeja'],
    to: (c) => `${c.base}${vistaPor('activos').to}`,
  },
  {
    id: 'candidatos-favoritos',
    label: 'Favoritos',
    hint: 'A quien has marcado con la estrella, de todos tus procesos.',
    icon: Star,
    claves: ['favorito', 'estrella', 'marcados', 'guardados', 'destacados'],
    to: (c) => `${c.base}${vistaPor('favoritos').to}`,
  },
  {
    id: 'candidatos-todos',
    label: 'Todos los candidatos',
    hint: 'La lista entera, incluidos los descartados.',
    icon: ContactRound,
    claves: ['todos', 'descartados', 'rechazados', 'historial'],
    to: (c) => `${c.base}${vistaPor('todos').to}`,
  },
  {
    // FUERA DEL BLOQUE DE ARRIBA (sep 2026): Contratados dejó de colgar de
    // Candidatos, así que aquí tampoco va con ellos, y su icono es el de su fila
    // del menú y no el de la lista de la que ya no forma parte. Un resultado del
    // buscador tiene que verse igual que la fila a la que lleva.
    id: 'contratados',
    label: 'Contratados',
    hint: 'Quién ya tiene el puesto, de todos tus procesos.',
    icon: UserCheck,
    claves: ['contratado', 'fichados', 'altas', 'candidatos contratados'],
    to: (c) => `${c.base}${vistaPor('contratados').to}`,
  },
  {
    id: 'equipo',
    label: 'Equipo',
    hint: 'El tablón de peticiones y quién tiene acceso.',
    icon: Users,
    claves: ['tablon', 'peticiones', 'miembros', 'invitar', 'companeros', 'usuarios'],
    to: (c) => `${c.base}/equipo`,
  },
  {
    id: 'entrevistas',
    label: 'Entrevistas',
    hint: 'Tus citas y las que faltan por confirmar.',
    icon: CalendarDays,
    claves: ['agenda', 'citas', 'calendario'],
    to: (c) => `${c.base}/entrevistas`,
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    hint: 'Tus avisos por correo y lo que hace tu empresa.',
    icon: SlidersHorizontal,
    claves: ['configuracion', 'preferencias', 'opciones'],
    to: (c) => `${c.base}/ajustes`,
  },
  {
    id: 'plan',
    label: 'Facturación',
    hint: 'Tus procesos abiertos, lo que pagas y tus facturas.',
    icon: CreditCard,
    claves: ['plan', 'precio', 'pagar', 'factura', 'suscripcion', 'tarjeta', 'cobro', 'procesos'],
    // En la demo no hay nada que cobrar: la ruta ni siquiera existe.
    disponible: (c) => !c.demo,
    to: (c) => `${c.base}/plan`,
  },
  // Lo que NO tiene puerta propia a propósito, y justo por eso hace falta poder
  // encontrarlo: el `hint` dice dónde vive de verdad (ago 2026).
  {
    id: 'formulario',
    label: 'Preguntas del puesto',
    hint: 'Las preguntas del candidato y su enlace.',
    icon: FileText,
    claves: ['campos', 'constructor', 'enlace', 'cv', 'formulario', 'formularios'],
    disponible: (c) => !!c.campaignId,
    to: (c) => `${c.base}/puestos/${c.campaignId}/formulario`,
  },
  {
    id: 'identidad',
    label: 'Identidad del puesto',
    hint: 'Nombre, foto y banner. Se editan en el constructor.',
    icon: Palette,
    claves: ['marca', 'logo', 'banner', 'color', 'colores', 'apariencia', 'imagen'],
    disponible: (c) => !!c.campaignId,
    to: (c) => `${c.base}/puestos/${c.campaignId}/formulario`,
  },
  // Las SEDES ya no están aquí (ago 2026). Eran un destino que llevaba a Vista
  // general porque ahí vivía el bloque "Por sede"; con el rediseño de esa
  // pantalla ese bloque se fue, y la administración de sedes pasó a un diálogo
  // (`SedesDialog`). Un destino es una URL, así que lo que se busca escribiendo
  // "sede" es ahora una ACCIÓN, "Gestionar sedes", registrada por el shell. La
  // sede sigue sin ser un sitio al que ir, que es la doctrina de siempre.
  // Zona de admin: SOLO el equipo de Apúntate Fácil, nunca en la demo.
  {
    id: 'admin',
    label: 'Panel de administración',
    hint: 'Las cifras de todas las empresas.',
    icon: Gauge,
    claves: ['admin', 'staff', 'interno'],
    disponible: (c) => c.isStaff && !c.demo,
    to: (c) => `${c.base}/admin`,
  },
  {
    id: 'soporte',
    label: 'Soporte',
    hint: 'Los mensajes que nos escriben los clientes.',
    icon: MessagesSquare,
    claves: ['tickets', 'ayuda', 'mensajes'],
    disponible: (c) => c.isStaff && !c.demo,
    to: (c) => `${c.base}/soporte`,
  },
]

// --- Resultados ----------------------------------------------------------------

/** Una fila de la lista, sea lo que sea. Un tipo para todos: así el buscador pinta
 *  una sola fila y añadir una clase de resultado no toca el render. */
export interface Fila {
  key: string
  score: number
  label: string
  hint?: string
  icon?: LucideIcon
  /** Persona: iniciales en vez de icono. */
  iniciales?: string
  /** Puesto: candidaturas nuevas. */
  badge?: number
  to?: string
  hacer?: () => void
}

export interface GrupoResultados {
  id: string
  titulo: string
  /** Desempate cuando dos grupos puntúan igual. Menor va antes. */
  orden: number
  filas: Fila[]
}

export const TOPES = { candidatos: 5, puestos: 4, destinos: 4, ajustes: 4, acciones: 3, total: 12 }

export function destinosVisibles(c: DestinosCtx): Destino[] {
  return DESTINOS.filter((d) => (d.disponible ? d.disponible(c) : true))
}

/**
 * Los ajustes del registro, uno por interruptor, con enlace directo a su fila.
 * No se declaran aquí: declarar un ajuste en `settings.tsx` ya lo hace buscable.
 *
 * Solo los disponibles (`seccionesVisibles`): un interruptor que no puedes
 * tocar no informa de nada.
 */
export function ajustesComoDestinos(c: DestinosCtx): Fila[] {
  const out: Fila[] = []
  for (const seccion of seccionesVisibles(c.ajustes)) {
    for (const grupo of gruposVisibles(seccion, c.ajustes)) {
      for (const ajuste of grupo.ajustes) {
        out.push({
          key: `ajuste-${ajuste.id}`,
          score: 0,
          label: ajuste.label,
          hint: `${seccion.titulo} · ${grupo.titulo}`,
          icon: seccion.icon,
          to: `${c.base}/ajustes/${seccion.id}?ajuste=${ajuste.id}`,
        })
      }
    }
  }
  return out
}

/** Las claves con las que se puntúa un ajuste derivado: su sección y su grupo, para
 *  que "correos" saque los correos y "equipo" los del tablón. */
function clavesDeAjuste(fila: Fila): string[] {
  return (fila.hint ?? '').split(' · ')
}

function recorta(filas: Fila[], tope: number): Fila[] {
  return filas.sort((a, b) => b.score - a.score).slice(0, tope)
}

/**
 * Apartados, ajustes y acciones que coinciden con lo escrito. Los candidatos y los
 * puestos los añade el buscador, que es quien tiene el store.
 */
export function buscarDestinos(c: DestinosCtx, acciones: Accion[], query: string): GrupoResultados[] {
  const q = query.trim()
  if (!q) return []

  const pantallas: Fila[] = []
  for (const d of destinosVisibles(c)) {
    const score = scoreEntrada(d.label, d.claves, q)
    if (score < FUERTE) continue
    pantallas.push({
      key: `destino-${d.id}`,
      score,
      label: d.label,
      hint: d.hint,
      icon: d.icon,
      to: d.to(c),
    })
  }

  const ajustes: Fila[] = []
  for (const fila of ajustesComoDestinos(c)) {
    const score = scoreEntrada(fila.label, clavesDeAjuste(fila), q)
    if (score < FUERTE) continue
    ajustes.push({ ...fila, score })
  }

  const hechos: Fila[] = []
  for (const a of acciones) {
    const score = scoreEntrada(a.label, a.claves, q)
    if (score < FUERTE) continue
    hechos.push({ key: `accion-${a.id}`, score, label: a.label, hint: a.hint, icon: a.icon, hacer: a.hacer })
  }

  return [
    { id: 'destinos', titulo: 'Ir a', orden: 2, filas: recorta(pantallas, TOPES.destinos) },
    { id: 'ajustes', titulo: 'Ajustes', orden: 3, filas: recorta(ajustes, TOPES.ajustes) },
    { id: 'acciones', titulo: 'Acciones', orden: 4, filas: recorta(hechos, TOPES.acciones) },
  ].filter((g) => g.filas.length > 0)
}

/**
 * Con el campo vacío: unos cuantos atajos, en el orden en que están declarados.
 * Es la única forma de que alguien descubra que aquí dentro también están los
 * ajustes y las acciones.
 */
export function atajos(c: DestinosCtx, acciones: Accion[], tope = 5): Fila[] {
  const pantallas = destinosVisibles(c)
    .map<Fila>((d) => ({
      key: `destino-${d.id}`,
      score: 0,
      label: d.label,
      hint: d.hint,
      icon: d.icon,
      to: d.to(c),
    }))
  const hechos = acciones.map<Fila>((a) => ({
    key: `accion-${a.id}`,
    score: 0,
    label: a.label,
    hint: a.hint,
    icon: a.icon,
    hacer: a.hacer,
  }))
  // Las acciones primero: son lo que menos se espera encontrar aquí.
  return [...hechos, ...pantallas].slice(0, tope)
}

/**
 * Ordena los grupos por su MEJOR resultado, no por un orden fijo. Escribir el
 * nombre de una persona (1.6-2 puntos) pone Candidatos arriba; escribir el de un
 * apartado lo pone a él, sin obligarte a bajar por seis nombres parecidos.
 * Empate: el orden declarado.
 */
export function ordenarGrupos(grupos: GrupoResultados[]): GrupoResultados[] {
  const techo = (g: GrupoResultados) => Math.max(...g.filas.map((f) => f.score))
  return [...grupos]
    .filter((g) => g.filas.length > 0)
    .sort((a, b) => techo(b) - techo(a) || a.orden - b.orden)
}

/** Recorta al tope global SIN romper los grupos: la lista se corta por abajo, que es
 *  donde están los peores resultados, y no deja un título de grupo sin filas. */
export function limitar(grupos: GrupoResultados[], tope = TOPES.total): GrupoResultados[] {
  const out: GrupoResultados[] = []
  let quedan = tope
  for (const g of grupos) {
    if (quedan <= 0) break
    const filas = g.filas.slice(0, quedan)
    quedan -= filas.length
    out.push({ ...g, filas })
  }
  return out
}

/** Aplana los grupos ya recortados. Es lo que recorren las flechas. */
export function aplanar(grupos: GrupoResultados[]): Fila[] {
  return grupos.flatMap((g) => g.filas)
}

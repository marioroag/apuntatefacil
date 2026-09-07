import { describe, expect, it } from 'vitest'
import { DESTINOS, ajustesComoDestinos, destinosVisibles, type DestinosCtx } from './destinos'
import { SECCIONES, gruposVisibles, seccionesVisibles } from './settings'
import { FUERTE, normalizeSearch, scoreEntrada } from './search'
import { navGroups } from './nav'
import type { Company } from './auth'

/**
 * EL GUARDIÁN DEL BUSCADOR.
 *
 * El problema que resuelve: dentro de tres meses alguien (yo incluido) añade una
 * pantalla, la cuelga del menú lateral y se olvida del buscador. La pantalla
 * existe, pero solo la encuentra quien ya sabe dónde está, que es justo lo que
 * este buscador venía a arreglar. Y no se nota: nadie echa de menos un resultado
 * que nunca ha visto. Una nota en la documentación no lo impide; una prueba que
 * falla, sí.
 *
 * Así que esto no comprueba comportamiento: comprueba que **lo que se puede
 * visitar se puede encontrar**. Es un detector, y cuando salta te dice qué hacer.
 *
 * Cuando falle, hay exactamente dos salidas honestas:
 *   1. Declararlo en `destinos.ts` (una entrada, ver ese fichero).
 *   2. Apuntarlo en la lista de excepciones de abajo CON SU MOTIVO escrito. Una
 *      excepción sin motivo es un olvido con permiso.
 */

// Los ficheros se leen con los globs de Vite y no con `node:fs`, igual que en el
// guardián de los ajustes: `?raw` los trae como texto y no entran en el bundle.
const FUENTES = import.meta.glob('../main.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const fuente = (nombre: string) =>
  Object.entries(FUENTES).find(([ruta]) => ruta.endsWith(nombre))?.[1] ?? ''

// --- Excepciones, con su motivo ----------------------------------------------

/** Rutas de producto a las que NO lleva ningún destino, y por qué. */
const RUTAS_SIN_DESTINO: Record<string, string> = {
  'puestos/:campaignId': 'Cada puesto es su propio resultado en el buscador: salen del store, no del registro.',
  'ajustes/:seccion': 'Es la misma pantalla que "ajustes", y cada interruptor entra por su fila con enlace directo.',
  sedes:
    'Ruta retirada (ago 2026): redirige. Una sede no es un sitio al que ir. Se encuentra escribiendo "sede", pero como ACCIÓN ("Gestionar sedes", registrada por el shell), porque lo que abre es un diálogo y no una URL.',
  marcas: 'Ruta retirada (ago 2026): redirige. La identidad se encuentra y lleva al constructor, que es donde se edita.',
  'candidatos/contratados':
    'Ruta vieja (sep 2026, Mario): Contratados dejó de colgar de Candidatos y ahora vive en "/contratados", que es la que SÍ tiene destino. Esta redirige para que un enlace guardado siga llegando.',
  bandeja:
    'Ruta retirada (ago 2026, Mario): redirige a Candidatos, que es lo que la sustituye. "Bandeja" SÍ se encuentra escribiéndola (es una clave del destino "Candidatos"), así que quien la busque por su nombre viejo llega igual.',
  meridian:
    'Hilo retirado (ago 2026, Mario): no vuelve, y la ruta solo redirige. El TRIAJE de Meridian sigue vivo, pero no es un sitio al que ir: se lee en la columna Encaje y en el informe de la ficha.',
}

/** Secciones de ajustes que se traen su propia pantalla y por eso no se pueden buscar por dentro. */
const SECCIONES_A_MANO: Record<string, string> = {
  entrevistas:
    'La agenda son días y tramos, no interruptores: hasta declararla en el registro, sus ajustes no son buscables uno a uno (ver el comentario de `componente` en settings.tsx).',
}

// --- Un contexto con todo abierto ---------------------------------------------
// Plan máximo, dueño y staff: así se ve TODO lo que puede existir, que es lo que
// hay que vigilar. Lo que cada cliente ve de verdad lo deciden `disponible` y su plan.

const empresa = { id: 'e1', name: 'Empresa', plan: 'multi' } as unknown as Company

const CTX: DestinosCtx = {
  base: '/app',
  demo: false,
  plan: 'multi',
  role: 'owner',
  isStaff: true,
  campaignId: 'c1',
  ajustes: {
    company: empresa,
    role: 'owner',
    readOnly: false,
    wantsEmail: () => true,
    setEmailPref: async () => ({}),
    updateCompanySettings: async () => ({}),
  },
}

// --- Utilidades ---------------------------------------------------------------

/** Las rutas de PRODUCTO de main.tsx: las relativas, que son las que cuelgan de
 *  /app y /demo. Las públicas (landing, login, formulario) son absolutas y no
 *  entran en el buscador, que solo vive dentro de la app. */
function rutasDeProducto(): string[] {
  const paths = [...fuente('main.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
  return [...new Set(paths.filter((p) => !p.startsWith('/') && p !== '*'))]
}

/** ¿Alguno de los destinos lleva a esta ruta? Los `:params` valen por cualquier tramo. */
function alcanzada(ruta: string, destinos: string[]): boolean {
  const patron = new RegExp(`^/app/${ruta.replace(/:[^/]+/g, '[^/?#]+')}(\\?.*)?$`)
  return destinos.some((to) => patron.test(to))
}

// El menú lateral es un REGISTRO desde ago 2026 (`nav.ts`), así que sus entradas
// se leen llamándolo y no rascando el JSX de AppLayout: las etiquetas son valores
// de verdad y ya no hay ninguna que el detector no pueda leer (por eso desapareció
// la lista de etiquetas dinámicas). Se pide el contexto más generoso (plan Multi y
// staff) para ver TODAS las entradas, también las que un plan pequeño no pinta.
function entradasDelMenu(): string[] {
  const grupos = navGroups({
    plan: 'multi',
    empresa: 'Construcciones Teide',
    isStaff: true,
    demo: false,
    counts: { nuevos: 0, equipo: 0 },
  })
  // Solo las filas que LLEVAN a un sitio. Las que abren una capa (Buscar,
  // Notificaciones) no son destinos: buscar "Buscar" desde el buscador es una
  // pescadilla, y los avisos no tienen pantalla propia a la que ir.
  // Los CORTES de una fila (las vistas de Candidatos) son sitios como cualquier
  // otro, así que entran en el detector: si mañana alguien añade una vista y se
  // olvida del buscador, el menú la tendría y el buscador no. Es exactamente el
  // olvido que este guardián existe para cazar, una capa más abajo.
  const conCortes = grupos.flatMap((g) => g.items.flatMap((i) => i.hijos ?? []))
  return [
    ...new Set([
      ...grupos.flatMap((g) => g.items.filter((i) => i.to).map((i) => i.label)),
      ...conCortes.map((h) => h.label),
    ]),
  ]
}

/** Lo que de verdad hace el buscador: ¿escribiendo esto sale algo? */
function seEncuentra(texto: string): boolean {
  return destinosVisibles(CTX).some((d) => scoreEntrada(d.label, d.claves, texto) >= FUERTE)
}

const todosLosAjustes = seccionesVisibles(CTX.ajustes).flatMap((s) =>
  gruposVisibles(s, CTX.ajustes).flatMap((g) => g.ajustes.map((a) => ({ seccion: s, ajuste: a }))),
)

// --- Los detectores -------------------------------------------------------------

describe('lo que se puede visitar, se puede encontrar', () => {
  it('toda ruta de producto tiene un destino que lleva a ella', () => {
    // Todos los declarados, no solo los visibles: aquí se comprueba que el registro
    // CONOCE la ruta. A quién se le enseña es cosa de `disponible` y de su plan, y
    // hay destinos apagados por un flag (el hilo de Meridian) cuya ruta sigue ahí.
    const destinos = DESTINOS.map((d) => d.to(CTX))
    const huerfanas = rutasDeProducto()
      .filter((r) => !(r in RUTAS_SIN_DESTINO))
      .filter((r) => !alcanzada(r, destinos))

    expect(
      huerfanas,
      `Estas rutas existen y el buscador no lleva a ninguna:\n` +
        huerfanas.map((r) => `  · ${r}`).join('\n') +
        `\n\nDales su entrada en DESTINOS (src/lib/destinos.ts), con su hint y sus claves. ` +
        `Si de verdad no es un sitio al que ir, apúntala en RUTAS_SIN_DESTINO con el motivo.`,
    ).toEqual([])
  })

  it('toda entrada del menú lateral se encuentra escribiendo su nombre', () => {
    const entradas = entradasDelMenu()
    expect(entradas.length, 'No se ha leído ninguna entrada del menú: ¿ha cambiado navGroups?').toBeGreaterThan(3)

    const invisibles = entradas.filter((label) => !seEncuentra(label))
    expect(
      invisibles,
      `Están en el menú lateral y escribir su nombre en el buscador no las saca: ${invisibles.join(', ')}. ` +
        `Añade su destino en src/lib/destinos.ts (o una clave, si el destino se llama de otra forma).`,
    ).toEqual([])
  })

  // El detector de "toda feature de pago se puede encontrar" murió con los
  // tiers (ago 2026): en el pago por proceso no hay features de pago que
  // vender con candado. Si algún día vuelve algo cobrable por capacidad, su
  // detector vuelve con él.

  it('todo ajuste del registro se encuentra y lleva a su fila', () => {
    const derivados = ajustesComoDestinos(CTX)
    const sinFila = todosLosAjustes
      .filter(({ ajuste }) => !derivados.some((f) => f.to?.includes(`ajuste=${ajuste.id}`)))
      .map(({ ajuste }) => ajuste.id)
    expect(
      sinFila,
      `Ajustes declarados que el buscador no deriva: ${sinFila.join(', ')}. ` +
        `Se derivan solos de SECCIONES: si uno se queda fuera, es que su sección o su grupo no pasan por seccionesVisibles/gruposVisibles.`,
    ).toEqual([])

    const malEnlazados = todosLosAjustes
      .filter(({ seccion, ajuste }) => {
        const fila = derivados.find((f) => f.to?.includes(`ajuste=${ajuste.id}`))
        return !fila?.to?.startsWith(`/app/ajustes/${seccion.id}?`)
      })
      .map(({ ajuste }) => ajuste.id)
    expect(
      malEnlazados,
      `Estos ajustes enlazan a una sección que no es la suya: ${malEnlazados.join(', ')}. Aterrizarías en otra pantalla.`,
    ).toEqual([])

    // Una sección que se trae su propia pantalla no se puede buscar por dentro:
    // sus ajustes no están declarados, así que nadie los deriva.
    const opacas = SECCIONES.filter((s) => s.componente && !(s.id in SECCIONES_A_MANO)).map((s) => s.id)
    expect(
      opacas,
      `Estas secciones de ajustes se traen una pantalla a mano, así que lo que hay dentro no se puede buscar: ${opacas.join(', ')}. ` +
        `Declara sus ajustes en el registro, o apúntalas en SECCIONES_A_MANO con el motivo.`,
    ).toEqual([])
  })
})

describe('el registro de destinos se mantiene coherente', () => {
  it('no hay ids repetidos', () => {
    const ids = DESTINOS.map((d) => d.id)
    expect(new Set(ids).size, `Ids repetidos: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('cada destino dice qué es o dónde vive', () => {
    const mudos = DESTINOS.filter((d) => !d.hint?.trim()).map((d) => d.id)
    expect(
      mudos,
      `Destinos sin hint: ${mudos.join(', ')}. La mitad de estos resultados existen para explicar dónde está algo; ` +
        `sin esa línea son solo un enlace más.`,
    ).toEqual([])
  })

  it('las claves están escritas como se buscan', () => {
    // Se comparan normalizadas (minúsculas, sin acentos): una clave escrita de
    // otra forma no rompe nada, pero engaña a quien la lee creyendo que busca así.
    const torcidas = DESTINOS.flatMap((d) => (d.claves ?? []).filter((c) => normalizeSearch(c) !== c))
    expect(torcidas, `Claves con mayúsculas o acentos: ${torcidas.join(', ')}. Escríbelas como se comparan.`).toEqual([])

    const vistas = new Map<string, string>()
    const chocan: string[] = []
    for (const d of DESTINOS) {
      for (const c of d.claves ?? []) {
        const antes = vistas.get(c)
        if (antes) chocan.push(`${c} (${antes} y ${d.id})`)
        else vistas.set(c, d.id)
      }
    }
    expect(chocan, `La misma clave lleva a dos sitios: ${chocan.join(', ')}. Quien la escriba no sabrá cuál es el suyo.`).toEqual([])
  })

  it('ningún destino visible enlaza a la nada', () => {
    // La trampa clásica: un destino que depende del puesto abierto y se pinta sin
    // ninguno, con un /puestos/null/ en el enlace.
    const sinPuestos: DestinosCtx = { ...CTX, campaignId: null }
    const rotos = destinosVisibles(sinPuestos)
      .map((d) => ({ id: d.id, to: d.to(sinPuestos) }))
      .filter(({ to }) => /\/(null|undefined)(\/|$)/.test(to))
      .map(({ id, to }) => `${id} -> ${to}`)
    expect(
      rotos,
      `Estos destinos se pintan sin tener adónde llevar: ${rotos.join(', ')}. Ponles un \`disponible\`.`,
    ).toEqual([])
  })

  it('el copy de los destinos respeta las reglas de la casa', () => {
    const textos = DESTINOS.flatMap((d) => [d.label, d.hint ?? '', ...(d.claves ?? [])])
    const conGuion = textos.filter((t) => t.includes('—'))
    expect(conGuion, `Guion largo en: ${conGuion.join(' | ')}`).toEqual([])
  })
})

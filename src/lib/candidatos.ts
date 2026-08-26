import type { Candidate } from './types'

/**
 * LAS TRES VISTAS DE CANDIDATOS (Mario, ago 2026).
 *
 * Sustituyen a la "Bandeja", que era una cola de un solo estado: solo los
 * `nuevo`, de todos los puestos. Servía para triar y para nada más, así que la
 * base de datos completa de la empresa no tenía dónde mirarse entera: había que
 * entrar puesto por puesto. Ahora la pantalla es la lista de gente y lo que
 * cambia es POR DÓNDE la cortas.
 *
 *   · Activos      todo menos los descartados. Es la principal.
 *   · Contratados  quien ya tiene el puesto.
 *   · Todos        también los descartados.
 *
 * POR QUÉ UN REGISTRO Y NO TRES `if`. Las vistas tienen tres consumidores que no
 * se hablan entre sí: el menú lateral (que las pinta como hijas de "Candidatos"),
 * la pantalla (que filtra y escribe su cabecera) y el buscador (que lleva a cada
 * una). Escritas a mano en los tres, la primera que cambie deja a las otras dos
 * mintiendo. Es exactamente lo que acababa de pasar con la cuenta del `sr-only`
 * de la Bandeja, escrita a mano en tres sitios: al reescribir dos, la tercera se
 * quedó atrás y nadie lo vio hasta mirarlo en producción.
 *
 * AÑADIR UNA VISTA es una entrada aquí más su ruta en `main.tsx`, nunca UI nueva.
 *
 * EL CORTE ES POR ESTADO Y NO POR "LO QUE FALTA POR HACER", y eso es una
 * decisión. "Descartado" es el único estado del que se sale por una DECISIÓN y no
 * por avanzar, así que parte la lista en dos montones que casi nunca se miran
 * juntos; es el mismo argumento que ya sostiene el conmutador Activos/Rechazados
 * del panel de un puesto. Los otros cuatro estados se siguen recortando con el
 * filtro de estado, DENTRO del montón en el que estés.
 */

export type VistaCandidatos = 'activos' | 'contratados' | 'todos'

export type Vista = {
  id: VistaCandidatos
  /** Su nombre en el menú, en el buscador y en el sitio al que llevas. Uno solo. */
  label: string
  /**
   * Ruta relativa a la base (`/app` o `/demo`). La principal NO lleva sufijo: es
   * la pantalla, y las otras dos son cortes suyos. Así "Candidatos" a secas
   * lleva a Activos, que es lo que se mira todos los días.
   */
  to: string
  /** Quién entra en esta vista. */
  incluye: (c: Candidate) => boolean
  /**
   * El subtítulo de la pantalla. Aquí SÍ se lo gana (la doctrina dice que un
   * subtítulo tiene que ganárselo): las tres vistas comparten título, así que
   * esta línea es lo único que dice arriba en cuál estás.
   */
  sub: string
  /** Qué se está contando, para quien no ve la cifra del título. */
  cuenta: (n: number) => string
  /** El vacío de verdad: no hay nadie en esta vista, sin filtros de por medio. */
  vacio: { titulo: string; texto: string }
  /** El vacío de FILTRO: hay gente, pero no en el puesto que has marcado. */
  vacioFiltrado: string
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

export const VISTAS: Vista[] = [
  {
    id: 'activos',
    label: 'Activos',
    to: '/candidatos',
    incluye: (c) => c.status !== 'descartado',
    sub: 'Toda tu gente menos la que has descartado.',
    cuenta: (n) => plural(n, 'candidato activo', 'candidatos activos'),
    vacio: {
      titulo: 'Aún no tienes candidatos',
      texto: 'Cuando alguien rellene el formulario de uno de tus puestos, aparecerá aquí.',
    },
    vacioFiltrado: 'Ningún candidato activo en ese puesto',
  },
  {
    id: 'contratados',
    label: 'Contratados',
    to: '/candidatos/contratados',
    incluye: (c) => c.status === 'contratado',
    sub: 'Quien ya tiene el puesto, de todos tus procesos.',
    cuenta: (n) => plural(n, 'contratado', 'contratados'),
    vacio: {
      titulo: 'Todavía no has contratado a nadie',
      texto: 'Cuando pases a alguien al estado contratado, lo verás aquí.',
    },
    vacioFiltrado: 'Ningún contratado en ese puesto',
  },
  {
    id: 'todos',
    label: 'Todos',
    // Sin `incluye` de verdad: es la lista entera. Se declara igual que las otras
    // dos para que la pantalla no tenga que preguntar cuál es la especial.
    to: '/candidatos/todos',
    incluye: () => true,
    sub: 'Toda tu gente, incluidos los descartados.',
    cuenta: (n) => plural(n, 'candidato', 'candidatos'),
    vacio: {
      titulo: 'Aún no tienes candidatos',
      texto: 'Cuando alguien rellene el formulario de uno de tus puestos, aparecerá aquí.',
    },
    vacioFiltrado: 'Ningún candidato en ese puesto',
  },
]

/**
 * ¿Esta vista contiene a los que acaban de llegar?
 *
 * Lo usa la pantalla para decidir si mirar cuenta como HABER MIRADO: abrir
 * Contratados no es haber visto las candidaturas nuevas, porque ahí no están.
 *
 * Se DERIVA de `incluye` en vez de declararse como un campo más, y eso es a
 * propósito: un campo sería una segunda lista que hay que acordarse de mantener
 * a la vez que el filtro, y la vista que se añada mañana llegaría con los dos
 * puestos de acuerdo o no según la suerte. Aquí solo puede haber una respuesta.
 * El objeto de mentira es el precio: `incluye` solo mira el estado.
 */
export const traeNuevos = (v: Vista) => v.incluye({ status: 'nuevo' } as Candidate)

/** La vista principal: la que abre "Candidatos" a secas. */
export const VISTA_PRINCIPAL: VistaCandidatos = 'activos'

export const vistaPor = (id: VistaCandidatos): Vista =>
  VISTAS.find((v) => v.id === id) ?? VISTAS[0]

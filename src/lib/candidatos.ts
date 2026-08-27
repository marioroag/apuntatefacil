import { STATUS_ORDER, type Candidate, type CandidateStatus } from './types'

/**
 * LAS CUATRO VISTAS DE CANDIDATOS (Mario, ago 2026).
 *
 * Sustituyen a la "Bandeja", que era una cola de un solo estado: solo los
 * `nuevo`, de todos los puestos. Servía para triar y para nada más, así que la
 * base de datos completa de la empresa no tenía dónde mirarse entera: había que
 * entrar puesto por puesto. Ahora la pantalla es la lista de gente y lo que
 * cambia es POR DÓNDE la cortas.
 *
 *   · Activos      todo menos los descartados. Es la principal.
 *   · Contratados  quien ya tiene el puesto.
 *   · Favoritos    a quien has marcado con la estrella.
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
 *
 * FAVORITOS ES LA EXCEPCIÓN, Y POR ESO LA VISTA DECLARA SU CORTE EN VEZ DE
 * ADIVINARLO (Mario, ago 2026). Las tres primeras cortan por estado, así que
 * bastaba un predicado `incluye` y todo lo demás se sacaba probándolo con un
 * candidato de mentira. Con un corte que NO es por estado, ese truco miente en
 * los dos sentidos: probando `{ status: 'nuevo' }` (sin `favorito`), Favoritos
 * decía no contener NINGÚN estado y la pantalla se quedaba sin filtro de estado;
 * y probando con un favorito de mentira diría que trae todas las candidaturas
 * nuevas, que es falso (solo trae las que además hayas marcado). Ahora la vista
 * declara sus dos ejes, `estados` y `soloFavoritos`, y de ahí se DERIVAN las tres
 * preguntas que le hacen sus consumidores: quién entra, qué estados se pueden
 * ofrecer, y si mirar aquí cuenta como haber visto lo nuevo. Sigue habiendo UNA
 * sola fuente; lo que cambia es que ahora dice la verdad sobre sí misma.
 *
 * ¿Y NO ES FAVORITOS LA MISMA PUERTA QUE EL FILTRO "Solo favoritos"? No, y la
 * frontera es la misma que separa el conmutador del panel de su filtro de estado:
 * una VISTA es un destino al que se llega de un clic desde el menú y que se puede
 * guardar; el FILTRO recorta lo que ya estás mirando (favoritos DENTRO de
 * Activos, que no es lo mismo que todos tus favoritos). Lo que sí se hace es no
 * ofrecer el filtro dentro de su propia vista, donde solo podría decir que sí:
 * exactamente lo que ya hace Estado dentro de Contratados.
 */

export type VistaCandidatos = 'activos' | 'contratados' | 'favoritos' | 'todos'

export type Vista = {
  id: VistaCandidatos
  /** Su nombre en el menú, en el buscador y en el sitio al que llevas. Uno solo. */
  label: string
  /**
   * Ruta relativa a la base (`/app` o `/demo`). La principal NO lleva sufijo: es
   * la pantalla, y las demás son cortes suyos. Así "Candidatos" a secas
   * lleva a Activos, que es lo que se mira todos los días.
   */
  to: string
  /**
   * Los estados que pueden aparecer aquí. Sin declararlo, los cinco. Es también
   * lo que la pantalla puede ofrecer en su filtro de estado: si solo cabe uno,
   * filtrar por él es no filtrar y la dimensión no se pinta.
   */
  estados?: CandidateStatus[]
  /** Recorte que no es por estado. Hoy solo Favoritos. */
  soloFavoritos?: true
  /**
   * El subtítulo de la pantalla. Aquí SÍ se lo gana (la doctrina dice que un
   * subtítulo tiene que ganárselo): las cuatro vistas comparten título, así que
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
    estados: STATUS_ORDER.filter((v) => v !== 'descartado'),
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
    estados: ['contratado'],
    sub: 'Quien ya tiene el puesto, de todos tus procesos.',
    cuenta: (n) => plural(n, 'contratado', 'contratados'),
    vacio: {
      titulo: 'Todavía no has contratado a nadie',
      texto: 'Cuando pases a alguien al estado contratado, lo verás aquí.',
    },
    vacioFiltrado: 'Ningún contratado en ese puesto',
  },
  {
    // Va DEBAJO de Contratados y encima de Todos: las dos primeras son por dónde
    // va el proceso, esta es tu atajo, y "Todos" cierra la lista porque es la que
    // contiene a las demás.
    id: 'favoritos',
    label: 'Favoritos',
    to: '/candidatos/favoritos',
    // Sin `estados`: se puede marcar a cualquiera, también a un descartado, y una
    // lista llamada "Favoritos" que se dejara alguno fuera no diría la verdad.
    soloFavoritos: true,
    sub: 'A quien has marcado con la estrella, de todos tus procesos.',
    cuenta: (n) => plural(n, 'favorito', 'favoritos'),
    vacio: {
      titulo: 'Todavía no has marcado a nadie',
      texto: 'Pulsa la estrella de un candidato para tenerlo a mano aquí.',
    },
    vacioFiltrado: 'Ningún favorito en ese puesto',
  },
  {
    id: 'todos',
    label: 'Todos',
    // Sin recortes: es la lista entera. Se declara igual que las otras para que la
    // pantalla no tenga que preguntar cuál es la especial.
    to: '/candidatos/todos',
    sub: 'Toda tu gente, incluidos los descartados.',
    cuenta: (n) => plural(n, 'candidato', 'candidatos'),
    vacio: {
      titulo: 'Aún no tienes candidatos',
      texto: 'Cuando alguien rellene el formulario de uno de tus puestos, aparecerá aquí.',
    },
    vacioFiltrado: 'Ningún candidato en ese puesto',
  },
]

/** Quién entra en esta vista. Se DERIVA de lo que la vista declara. */
export const incluye = (v: Vista) => (c: Candidate) =>
  (!v.estados || v.estados.includes(c.status)) && (!v.soloFavoritos || c.favorito)

/** Los estados que pueden aparecer aquí. Sin declarar, los cinco. */
export const estadosDe = (v: Vista) => v.estados ?? STATUS_ORDER

/**
 * ¿Están AQUÍ todas las candidaturas nuevas?
 *
 * Lo usa la pantalla para decidir si mirar cuenta como HABER MIRADO: abrir
 * Contratados no es haber visto las candidaturas nuevas, porque ahí no están.
 *
 * Ojo a la palabra TODAS, que es la que hace la pregunta contestable. Favoritos
 * sí puede contener alguna candidatura nueva (la que además hayas marcado), y
 * aun así responde que NO: mirar tu atajo no es haber revisado lo que ha
 * entrado, y darlo por visto apagaría una señal que nadie ha atendido.
 */
export const traeNuevos = (v: Vista) => estadosDe(v).includes('nuevo') && !v.soloFavoritos

/** La vista principal: la que abre "Candidatos" a secas. */
export const VISTA_PRINCIPAL: VistaCandidatos = 'activos'

export const vistaPor = (id: VistaCandidatos): Vista =>
  VISTAS.find((v) => v.id === id) ?? VISTAS[0]

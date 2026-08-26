import { Bell, Briefcase, CalendarDays, CreditCard, Gauge, Inbox, LayoutGrid, MessagesSquare, Search, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Registro de navegación del menú lateral (ago 2026, reescrito con la identidad
 * nueva).
 *
 * Mismo principio que el registro de ajustes (`settings.tsx`): **añadir un
 * destino es una entrada en este array, nunca UI nueva**. El lateral no conoce
 * ningún destino concreto, pinta lo que declare esto. Antes cada destino era un
 * `div` suelto con su propio `pt-`, y así fue como "Ajustes" acabó colgando del
 * `showEntrevistas` de su vecino y desapareciendo en Esencial: el bug no era una
 * distracción, era la forma del código.
 *
 * Desde el reskin, el lateral es la ÚNICA capa de navegación: la barra superior
 * se retiró y aquí abajo aterrizaron sus tres inquilinos (Buscar, Notificaciones
 * y Ajustes) y tu cuenta. Los dos primeros no llevan a ninguna ruta: abren una
 * capa, y por eso existe `capa` en vez de `to`. Un ítem tiene uno de los dos,
 * nunca los dos ni ninguno.
 *
 * Tres reglas que impiden que esto se pudra:
 *
 * 1. **Lo que no está disponible no se pinta.** Nada de tabs bloqueadas en el
 *    menú: el límite se descubre en su contexto, no con un candado en la
 *    navegación. (Con el pago por proceso ya no hay features por plan, pero la
 *    regla sigue viva para banderas como WHATSAPP_LISTO o el admin.)
 * 2. **Un grupo sin ítems visibles no existe.** Ni cabecera huérfana ni hueco.
 *    Por eso `navGroups()` filtra al final y no hay que acordarse en cada sitio.
 * 3. **Un contador se DICE, no se enseña, y aquí se cumple literalmente.** El
 *    menú no pinta cifras: pinta un PUNTO cuando hay algo nuevo. El número
 *    entero viaja en `novedadesLabel`, que es lo que oye quien usa lector de
 *    pantalla. Llegó a haber nueve cifras a la vez (142, 96, 84, 158, 118, 88,
 *    274, 8, 4) y ninguna cambiaba una decisión: abres el puesto igual con 142
 *    que con 158, y para saber cuál tiene más está Vista general, que los ordena.
 *    La única cifra que sobrevive es la de Notificaciones, y la pinta ella (ver
 *    `Avisos.tsx`): ahí el número SÍ es la información, porque son pocas y cada
 *    una va dirigida a ti.
 *
 * Los PUESTOS no viven aquí: son datos, no destinos declarados. Pero SÍ vive
 * aquí en qué grupo entran y en qué orden (`conPuestos`), que es lo único de
 * ellos que es una decisión de navegación.
 */

export type NavItem = {
  id: string
  /** Ruta relativa a la base (`/app` o `/demo`), empezando por `/`. */
  to?: string
  /**
   * La capa que abre, para los ítems que no llevan a ninguna ruta. La monta el
   * shell: el registro dice QUÉ hay en el menú, no cómo se pinta un buscador.
   */
  capa?: 'buscar' | 'avisos'
  label: string
  Icon: LucideIcon
  /**
   * Cuántas cosas NUEVAS hay aquí. Se pinta como un PUNTO, no como una cifra:
   * el número entero solo lo oye quien usa lector de pantalla (`novedadesLabel`).
   * 0 o ausente = sin punto.
   *
   * Se llama así y no `count` a propósito, para que la próxima entrada tenga que
   * preguntarse si lo suyo son NOVEDADES. El "8" de Entrevistas no lo era (son
   * citas por venir, no cosas sin ver) y por eso ya no se declara: la misma
   * chapa gris significaba dos cosas distintas.
   */
  novedades?: number
  /** Qué son esas novedades, para el lector de pantalla. */
  novedadesLabel?: (n: number) => string
}

export type NavGroup = {
  id: string
  /** Sin `label` el grupo va sin cabecera: es el primer bloque, el de la casa. */
  label?: string
  /**
   * El grupo abre con la lista de puestos, plegable. Va aquí y no en el JSX del
   * lateral porque en qué bloque entran los puestos y con qué vecinos es una
   * decisión de navegación; el CONTENIDO de la lista son datos y sigue fuera.
   */
  conPuestos?: boolean
  items: NavItem[]
}

export type NavContext = {
  plan: string | null | undefined
  /** Nombre de la empresa: es la cabecera de su bloque, no una cadena fija. */
  empresa: string
  /** Equipo de Apúntate Fácil (allowlist del backend), nunca en la demo. */
  isStaff: boolean
  demo: boolean
  counts: {
    /** Candidaturas nuevas sin ver, de todos los puestos. */
    bandeja: number
    /** Movimiento del tablón del equipo. */
    equipo: number
  }
}

/**
 * La cuenta ENTERA, que es el único sitio donde vive el número.
 *
 * Aquí ponía lo contrario ("el número ya lo lee la chapa: aquí va SOLO el nombre
 * de lo que cuenta, o el lector diría 'Bandeja 272 272 candidaturas nuevas'") y
 * era cierto mientras la fila pintaba un contador. Con el reskin (ago 2026) la
 * chapa pasó a ser un PUNTO, o sea que el número salió de la pantalla, y nadie
 * lo movió aquí: en producción, Bandeja se leía "candidaturas nuevas", sin
 * cuántas, mientras la fila de un puesto justo encima decía "142 candidaturas
 * nuevas". La misma señal contada de dos maneras en el mismo menú.
 *
 * La doctrina no dice que el número se borre, dice que CAMBIA DE CANAL, y este
 * es el canal. Corolario, que es lo que se aprendió: cuando quites un dato de la
 * pantalla, comprueba a dónde VA, no si desaparece.
 */
const contar = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * "142 candidaturas nuevas", y se exporta a propósito.
 *
 * La frase estaba escrita a mano en tres sitios (aquí, la fila de un puesto y el
 * padre plegado que hereda la señal), y por eso una de las tres pudo quedarse sin
 * número sin que se notara. Una sola función: si vuelve a cambiar, cambia en las
 * tres a la vez.
 */
export const contarNuevas = (n: number) => contar(n, 'candidatura nueva', 'candidaturas nuevas')

/** "6 puestos". Misma pieza, otro sustantivo. */
export const contarPuestos = (n: number) => contar(n, 'puesto', 'puestos')

/**
 * Los grupos del menú, en orden. Dos bloques y la zona de admin: arriba la capa
 * de servicio (dónde vuelves y cómo llegas a cualquier sitio), debajo TU
 * empresa, con su nombre de cabecera y todo lo que se hace dentro de ella.
 */
export function navGroups(ctx: NavContext): NavGroup[] {
  const { empresa, isStaff, demo, counts } = ctx

  const grupos: NavGroup[] = [
    {
      // La capa de servicio, sin cabecera a propósito: el primer bloque no
      // necesita presentarse. Vista general es la casa, el sitio al que vuelves
      // entre tarea y tarea; Buscar y Notificaciones son las dos formas de
      // llegar a algo sin saber dónde está.
      id: 'servicio',
      items: [
        { id: 'resumen', to: '/resumen', label: 'Vista general', Icon: LayoutGrid },
        { id: 'buscar', capa: 'buscar', label: 'Buscar', Icon: Search },
        { id: 'avisos', capa: 'avisos', label: 'Notificaciones', Icon: Bell },
      ],
    },
    {
      // Tu empresa por dentro, con su nombre de cabecera. Los puestos abren el
      // bloque porque son de lo que va todo lo demás.
      id: 'empresa',
      label: empresa,
      conPuestos: true,
      items: [
        {
          id: 'bandeja',
          to: '/bandeja',
          label: 'Bandeja',
          Icon: Inbox,
          novedades: counts.bandeja,
          novedadesLabel: contarNuevas,
        },
        {
          // SIN señal: las citas por venir no son "algo nuevo que no has visto",
          // son tu agenda, y la agenda se mira en su pantalla. Llevaba una chapa
          // idéntica a las de novedades y hacía que la misma forma significara
          // dos cosas. Si el número vuelve, que sea con una forma propia.
          id: 'entrevistas',
          to: '/entrevistas',
          label: 'Entrevistas',
          Icon: CalendarDays,
        },
        // Equipo (tablón + miembros) lo ven todos los roles. Dentro, la pestaña
        // Miembros solo se pinta al owner (y sus RPCs son owner-only), así que
        // el encargado entra sin ver de más.
        {
          id: 'equipo',
          to: '/equipo',
          label: 'Equipo',
          Icon: Users,
          novedades: counts.equipo,
          novedadesLabel: (n) => contar(n, 'novedad en el tablón', 'novedades en el tablón'),
        },
        {
          // Ajustes VUELVE al lateral (ago 2026) y es una decisión, no un
          // descuido: al retirarse la barra superior se quedó sin engranaje
          // donde vivir. Ahora está aquí y en ningún otro sitio.
          id: 'ajustes',
          to: '/ajustes',
          label: 'Ajustes',
          Icon: Settings,
        },
      ],
    },
    {
      // SOLO para el equipo de Apúntate Fácil. El resto de usuarios no ve nada.
      id: 'admin',
      label: 'Admin',
      items:
        isStaff && !demo
          ? [
              { id: 'admin-panel', to: '/admin', label: 'Panel', Icon: Gauge },
              { id: 'admin-soporte', to: '/soporte', label: 'Soporte', Icon: MessagesSquare },
            ]
          : [],
    },
  ]

  // Regla 2: un grupo sin ítems visibles no deja cabecera huérfana. Un grupo con
  // puestos existe aunque no declare ítems: la lista es su contenido.
  return grupos.filter((g) => g.items.length > 0 || g.conPuestos)
}

/** Icono de un puesto. Vive aquí para que el menú tenga un solo vocabulario. */
export const PUESTO_ICON = Briefcase

/** Icono de facturación, para el menú de cuenta del pie. Mismo motivo. */
export const FACTURACION_ICON = CreditCard

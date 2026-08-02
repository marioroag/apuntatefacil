import { Briefcase, CalendarDays, Gauge, Inbox, LayoutGrid, MessagesSquare, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { planHas } from './pricing'
import { MERIDIAN_CHAT_ENABLED, MERIDIAN_NAME, hasMeridian } from './meridian'

/**
 * Registro de navegación del menú lateral (ago 2026).
 *
 * Mismo principio que el registro de ajustes (`settings.tsx`): **añadir un
 * destino es una entrada en este array, nunca UI nueva**. El lateral no conoce
 * ningún destino concreto, pinta lo que declare esto. Antes cada destino era un
 * `div` suelto con su propio `pt-`, y así fue como "Ajustes" acabó colgando del
 * `showEntrevistas` de su vecino y desapareciendo en Esencial: el bug no era una
 * distracción, era la forma del código.
 *
 * Tres reglas que impiden que esto se pudra:
 *
 * 1. **Lo que no incluye tu plan no se pinta.** Nada de tabs bloqueadas en el
 *    menú: el límite se descubre en su contexto (crear puesto, abrir Equipo),
 *    no con un candado en la navegación.
 * 2. **Un grupo sin ítems visibles no existe.** Ni cabecera huérfana ni hueco.
 *    Por eso `grupos()` filtra al final y no hay que acordarse en cada sitio.
 * 3. **Un contador se dice, no se enseña.** `contarLabel` es el texto que oye
 *    quien no ve el número; sin él, "272" a secas no informa de nada.
 *
 * Los PUESTOS no viven aquí: son datos, no destinos declarados, y ocupan su
 * propia zona elástica al final del menú (la única lista que crece sin techo).
 */

export type NavItem = {
  id: string
  /** Ruta relativa a la base (`/app` o `/demo`), empezando por `/`. */
  to: string
  label: string
  Icon: LucideIcon
  /** Número de la chapa. 0 o ausente = sin chapa. */
  count?: number
  /** Qué significa ese número, para el lector de pantalla. */
  contarLabel?: (n: number) => string
}

export type NavGroup = {
  id: string
  /** Sin `label` el grupo va sin cabecera: es el primer bloque, el de la casa. */
  label?: string
  items: NavItem[]
}

export type NavContext = {
  plan: string | null | undefined
  /** Equipo de Apúntate Fácil (allowlist del backend), nunca en la demo. */
  isStaff: boolean
  demo: boolean
  counts: {
    /** Candidaturas nuevas sin ver, de todos los puestos. */
    bandeja: number
    /** Citas confirmadas por venir (no "novedades"): el número útil aquí. */
    entrevistas: number
    /** Movimiento del tablón del equipo. */
    equipo: number
    /** Candidaturas nuevas que Meridian destaca y no has revisado. */
    meridian: number
  }
}

// El número ya lo lee la chapa: aquí va SOLO el nombre de lo que cuenta, o el
// lector de pantalla diría "Bandeja 272 272 candidaturas nuevas".
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/**
 * Los grupos del menú, en orden. Ordenados por TIPO, no por importancia
 * percibida: primero dónde vuelves, luego la gente que se mueve, luego tu
 * empresa, y la zona de admin al final. La lista de puestos va después de todo
 * esto, en el hueco elástico, porque es lo único que crece sin límite.
 */
export function navGroups(ctx: NavContext): NavGroup[] {
  const { plan, isStaff, demo, counts } = ctx

  const grupos: NavGroup[] = [
    {
      // Sin cabecera a propósito: el primer bloque no necesita presentarse, y
      // Vista general es la casa, el sitio al que vuelves entre tarea y tarea.
      id: 'casa',
      items: [{ id: 'resumen', to: '/resumen', label: 'Vista general', Icon: LayoutGrid }],
    },
    {
      // Todo lo que se mueve solo y por eso lleva contador. Aquí aterrizan los
      // destinos futuros que hablen de candidatos (plantillas de mensajes, el
      // asistente de WhatsApp cuando salga de su rama).
      id: 'candidatos',
      label: 'Candidatos',
      items: [
        {
          id: 'bandeja',
          to: '/bandeja',
          label: 'Bandeja',
          Icon: Inbox,
          count: counts.bandeja,
          contarLabel: (n) => plural(n, 'candidatura nueva', 'candidaturas nuevas'),
        },
        ...(MERIDIAN_CHAT_ENABLED && hasMeridian(plan)
          ? [
              {
                id: 'meridian',
                to: '/meridian',
                label: MERIDIAN_NAME,
                Icon: Sparkles,
                count: counts.meridian,
                contarLabel: (n: number) => plural(n, 'candidatura destacada', 'candidaturas destacadas'),
              },
            ]
          : []),
        ...(planHas(plan, 'entrevistas')
          ? [
              {
                id: 'entrevistas',
                to: '/entrevistas',
                label: 'Entrevistas',
                Icon: CalendarDays,
                count: counts.entrevistas,
                contarLabel: (n: number) => plural(n, 'entrevista por venir', 'entrevistas por venir'),
              },
            ]
          : []),
      ],
    },
    {
      // Tu casa por dentro. Hoy solo Equipo; el grupo existe igualmente porque
      // es el sitio declarado de lo que venga (informes, plantillas), y una
      // cabecera de un ítem cuesta menos que reordenar el menú más adelante.
      id: 'empresa',
      label: 'Empresa',
      items: [
        // Equipo (tablón + miembros) es Pro+: lo ven todos los roles del plan.
        // Dentro, la pestaña Miembros solo se pinta al owner (y sus RPCs son
        // owner-only), así que el encargado entra sin ver de más.
        ...(planHas(plan, 'teamBoard')
          ? [
              {
                id: 'equipo',
                to: '/equipo',
                label: 'Equipo',
                Icon: Users,
                count: counts.equipo,
                contarLabel: (n: number) => plural(n, 'novedad en el tablón', 'novedades en el tablón'),
              },
            ]
          : []),
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

  // Regla 2: un grupo sin ítems visibles no deja cabecera huérfana.
  return grupos.filter((g) => g.items.length > 0)
}

/** Icono de un puesto. Vive aquí para que el menú tenga un solo vocabulario. */
export const PUESTO_ICON = Briefcase

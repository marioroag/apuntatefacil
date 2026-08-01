import { AtSign, Inbox, Mail, MessageCircle, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { planHas } from './pricing'
import { MERIDIAN_NAME, hasMeridian } from './meridian'
import type { Company, CompanySettings } from './auth'

/**
 * EL REGISTRO DE AJUSTES. Esta es la única fuente de verdad de /app/ajustes:
 * qué secciones hay, qué contienen, quién puede verlas y cómo se guarda cada
 * cosa. `src/screens/Ajustes.tsx` no sabe nada de correos ni de Meridian: pinta
 * lo que aquí se declare.
 *
 * AÑADIR UN AJUSTE = una entrada en este fichero. Nada de UI nueva.
 *
 *   1. Un interruptor más en un grupo que ya existe: añade un `Ajuste` con su
 *      `get` y su `set`. Ya está.
 *   2. Una sección nueva: añade una `SeccionAjustes` a SECCIONES. Aparece en el
 *      menú lateral, con su ruta, su cabecera y su hueco vacío resuelto.
 *   3. Un ajuste que guarda en otro sitio: `get`/`set` reciben el contexto
 *      entero, así que puede tirar de donde haga falta sin tocar la pantalla.
 *
 * Tres reglas que hacen que esto no se pudra:
 *
 *   * **Nada que no gobierne algo de verdad.** Un interruptor que no cambia el
 *     comportamiento del producto es una promesa falsa; antes de declararlo,
 *     que exista quien lo lea.
 *   * **Lo que no está disponible no se pinta.** `disponible` decide, y una
 *     sección o un grupo que no aplica desaparece (no se enseña bloqueado).
 *     Vale tanto para planes como para features que aún no existen.
 *   * **Lo que NO se puede cambiar se dice.** Para eso está `nota`: es más
 *     honesto explicar por qué no hay interruptor que esconder el tema.
 */

// --- Contexto: todo lo que un ajuste puede necesitar para leerse y guardarse --

export interface AjustesCtx {
  company: Company | null
  role: string | null
  /** Demo pública: se ve todo, no se guarda nada. */
  readOnly: boolean
  wantsEmail: (key: string) => boolean
  setEmailPref: (key: string, enabled: boolean) => Promise<{ error?: string }>
  updateCompanySettings: (patch: Partial<CompanySettings>) => Promise<{ error?: string }>
}

export interface Ajuste {
  id: string
  label: string
  /** Una línea: qué pasa si lo apagas. Sin esto, un interruptor es un acertijo. */
  hint?: string
  get: (c: AjustesCtx) => boolean
  set: (c: AjustesCtx, next: boolean) => Promise<{ error?: string }>
  /** Devuelve el MOTIVO por el que no se puede tocar, o null si sí se puede. */
  bloqueado?: (c: AjustesCtx) => string | null
}

export interface GrupoAjustes {
  id: string
  titulo: string
  descripcion?: string
  disponible?: (c: AjustesCtx) => boolean
  ajustes: Ajuste[]
  nota?: string
}

export interface SeccionAjustes {
  /** Trozo de URL: /app/ajustes/<id>. */
  id: string
  /** Menú lateral. */
  label: string
  icon: LucideIcon
  titulo: string
  descripcion: string
  /** Si es false, la sección no existe: ni en el menú, ni por URL escrita a mano. */
  disponible: (c: AjustesCtx) => boolean
  grupos: GrupoAjustes[]
  nota?: string
}

// --- Claves de los avisos por correo -----------------------------------------
// El MISMO string que leen las edge functions al preguntar por los destinatarios
// (`email_recipients(ids, clave)`). Si cambias uno aquí, cámbialo allí: sin la
// clave común, el ajuste deja de gobernar el envío en silencio.
export const EMAIL_KEYS = {
  mencion: 'mencion',
  tablon: 'tablon',
  candidatoNuevo: 'candidato_nuevo',
} as const

// El asistente de WhatsApp (invitar a entrevista y cuadrar la cita hablando con
// el candidato) vive en la rama `claude/interview-invitation-planning-ea35a6` y
// todavía no está aquí. Su sección está declarada abajo para que el día que se
// fusione sea encender esto y colgarle sus grupos, no rehacer nada.
export const WHATSAPP_ASSISTANT_ENABLED = false

// --- Atajos ------------------------------------------------------------------

const email = (key: string, label: string, hint: string): Ajuste => ({
  id: key,
  label,
  hint,
  get: (c) => c.wantsEmail(key),
  set: (c, next) => c.setEmailPref(key, next),
})

/** La estructura de la empresa no la tocan los encargados (doctrina de roles). */
const soloGestores = (c: AjustesCtx): string | null =>
  c.role === 'encargado' ? 'Solo el dueño o un miembro del equipo cambian los ajustes de la empresa.' : null

// --- Las secciones ------------------------------------------------------------

export const SECCIONES: SeccionAjustes[] = [
  {
    id: 'correos',
    label: 'Correos',
    icon: Mail,
    titulo: 'Correos',
    descripcion: 'Qué te avisamos a tu bandeja. Es tuyo, no de la empresa: te acompaña a todos tus equipos.',
    disponible: () => true,
    grupos: [
      {
        id: 'equipo',
        titulo: 'Tu equipo',
        descripcion: 'Cuando alguien cuenta contigo.',
        // Sin chat de equipo ni tablón no hay nada que avisar.
        disponible: (c) => planHas(c.company?.plan, 'teamBoard'),
        ajustes: [
          email(
            EMAIL_KEYS.mencion,
            'Te mencionan en una ficha',
            'Cuando alguien te escribe con @ en el chat de un candidato.',
          ),
          email(
            EMAIL_KEYS.tablon,
            'Movimiento en el tablón',
            'Peticiones nuevas del equipo y respuestas en las tuyas.',
          ),
        ],
      },
      {
        id: 'candidaturas',
        titulo: 'Candidaturas',
        descripcion: 'Lo que entra por tus formularios.',
        ajustes: [
          email(
            EMAIL_KEYS.candidatoNuevo,
            'Entra una candidatura',
            'Un aviso por cada persona que se apunta. Va al dueño de la empresa.',
          ),
        ],
        nota: 'Además, cada puesto puede dejar de avisar por su cuenta desde "Ajustes del puesto".',
      },
    ],
    nota: 'Los correos de acceso (confirmar tu cuenta y restablecer la contraseña) no se pueden desactivar: son los que protegen tu cuenta. Los que mandas tú a un candidato tampoco están aquí, porque los envías a mano.',
  },
  {
    id: 'meridian',
    label: MERIDIAN_NAME,
    icon: Sparkles,
    titulo: MERIDIAN_NAME,
    descripcion: `Qué hace ${MERIDIAN_NAME} por su cuenta con las candidaturas que entran.`,
    disponible: (c) => hasMeridian(c.company?.plan),
    grupos: [
      {
        id: 'triaje',
        titulo: 'Triaje automático',
        ajustes: [
          {
            id: 'meridian_auto',
            label: 'Analizar cada candidatura al entrar',
            hint: `${MERIDIAN_NAME} lee la candidatura y anota su resumen y su ajuste al puesto. Si lo apagas, puedes analizarlas de una en una desde su ficha.`,
            get: (c) => c.company?.meridian_auto !== false,
            set: (c, next) => c.updateCompanySettings({ meridian_auto: next }),
            bloqueado: soloGestores,
          },
        ],
      },
    ],
    nota: 'Es una lectura asistida, no un veredicto: nadie se descarta solo.',
  },
  {
    id: 'whatsapp',
    label: 'Asistente de WhatsApp',
    icon: MessageCircle,
    titulo: 'Asistente de WhatsApp',
    descripcion: 'Invitar a entrevista y cuadrar la cita hablando con el candidato.',
    // Todavía no está en esta rama (ver WHATSAPP_ASSISTANT_ENABLED). La sección
    // existe para que fusionar la rama de entrevistas sea encender el flag y
    // añadir sus grupos aquí.
    disponible: () => WHATSAPP_ASSISTANT_ENABLED,
    grupos: [],
  },
]

/** Iconos de apoyo del registro, para que quien añada una sección tenga a mano
 *  los que ya se usan y no aparezca un quinto estilo de icono. */
export const ICONOS_AJUSTES = { AtSign, Inbox, Mail, MessageCircle, Sparkles, Users }

export function seccionesVisibles(c: AjustesCtx): SeccionAjustes[] {
  return SECCIONES.filter((s) => s.disponible(c))
}

export function gruposVisibles(seccion: SeccionAjustes, c: AjustesCtx): GrupoAjustes[] {
  return seccion.grupos.filter((g) => (g.disponible ? g.disponible(c) : true))
}

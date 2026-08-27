import { AtSign, Building2, Inbox, Mail, MessageCircle, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { AjustesCalendario } from '../screens/AjustesCalendario'
import { MERIDIAN_NAME, hasMeridian } from './meridian'
import { useAuth, type Company, type CompanySettings } from './auth'
import { useProfiles } from './profiles'

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

interface AjusteBase {
  id: string
  label: string
  /** Una línea: qué pasa si lo apagas. Sin esto, un interruptor es un acertijo. */
  hint?: string
  /** Devuelve el MOTIVO por el que no se puede tocar, o null si sí se puede. */
  bloqueado?: (c: AjustesCtx) => string | null
}

export interface AjusteInterruptor extends AjusteBase {
  /** Por defecto. Se deja opcional para no tener que anotar las veinte filas
   *  que ya existen: aquí lo raro es el texto, no el interruptor. */
  tipo?: 'interruptor'
  get: (c: AjustesCtx) => boolean
  set: (c: AjustesCtx, next: boolean) => Promise<{ error?: string }>
}

/**
 * UN AJUSTE QUE SE ESCRIBE, no que se enciende.
 *
 * Entró con "Sobre la empresa" (ago 2026), el párrafo que sale en la página del
 * anuncio. Hasta entonces todo lo de aquí era un `Switch`, y la tentación era
 * darle su propia pantalla; es la misma regla de siempre: **añadir un ajuste es
 * una entrada en este registro, nunca UI nueva**, y eso vale también cuando lo
 * que cambia es la FORMA del control. Así sigue siendo buscable y enlazable
 * desde el buscador global sin tocar nada más.
 *
 * SE GUARDA AL SALIR DEL CAMPO, no en cada tecla: un párrafo son cientos de
 * pulsaciones y cada una sería una escritura sobre `companies`. Es lo mismo que
 * hace el nombre de la marca en el constructor.
 */
export interface AjusteTexto extends AjusteBase {
  tipo: 'texto'
  get: (c: AjustesCtx) => string
  set: (c: AjustesCtx, next: string) => Promise<{ error?: string }>
  placeholder?: string
  maxLength?: number
  filas?: number
}

export type Ajuste = AjusteInterruptor | AjusteTexto

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
  /**
   * TEMPORAL (ago 2026): pantalla propia en vez de grupos de interruptores.
   * La agenda del asistente de WhatsApp son días, tramos, duración, descanso y
   * dirección; nada de eso es un booleano. Cuando se rehaga, esto se va y sus
   * ajustes vuelven a declararse como los demás. No usarlo para nada más: es la
   * puerta por la que se cuela volver a tener pantallas a mano.
   */
  componente?: ReactNode
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

// El asistente de WhatsApp ya está aquí (fusionado ago 2026), así que su sección
// se enciende. Lo que NO se ha hecho todavía es declarar su agenda como ajustes
// del registro: de momento la sección se trae su pantalla entera (`componente`).
// Rehacerlo es lo que queda pendiente.
export const WHATSAPP_ASSISTANT_ENABLED = true

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
        ajustes: [
          email(
            EMAIL_KEYS.mencion,
            'Te mencionan',
            'Cuando alguien te escribe con @, en la ficha de un candidato o en el tablón.',
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
    // La empresa va PRIMERA: es lo que ve un candidato, y lo demás de aquí son
    // preferencias de quien trabaja dentro.
    id: 'empresa',
    label: 'Tu empresa',
    icon: Building2,
    titulo: 'Tu empresa',
    descripcion: 'Lo que cuentas de ti en tus anuncios, antes de que nadie se apunte.',
    disponible: () => true,
    grupos: [
      {
        id: 'presentacion',
        titulo: 'Sobre la empresa',
        ajustes: [
          {
            id: 'descripcion',
            tipo: 'texto',
            label: 'Qué contáis de vosotros',
            hint: 'Sale en todos tus anuncios, debajo de la descripción del puesto, con tu nombre y tu logo. Quien lo lee está decidiendo si quiere trabajar contigo.',
            placeholder: 'A qué os dedicáis, desde cuándo y cómo se trabaja con vosotros.',
            maxLength: 1000,
            filas: 5,
            get: (c) => c.company?.descripcion ?? '',
            set: (c, next) => c.updateCompanySettings({ descripcion: next }),
            bloqueado: soloGestores,
          },
        ],
      },
    ],
    // Sin descripción, el anuncio no pinta el bloque: es mejor no decir nada que
    // decir un hueco. Se dice aquí porque es lo que pasa si lo dejas vacío.
    nota: 'Si lo dejas en blanco, tus anuncios no enseñan este bloque.',
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
    disponible: () => WHATSAPP_ASSISTANT_ENABLED,
    grupos: [],
    // Ver el comentario de `componente`: temporal hasta declarar la agenda como
    // ajustes de verdad.
    componente: <AjustesCalendario />,
  },
]

/** Iconos de apoyo del registro, para que quien añada una sección tenga a mano
 *  los que ya se usan y no aparezca un quinto estilo de icono. */
export const ICONOS_AJUSTES = { AtSign, Inbox, Mail, MessageCircle, Sparkles, Users }

/** El contexto del registro, armado de una sola manera. Lo usan la pantalla de
 *  Ajustes y el buscador de la barra (que deriva de aquí sus resultados de ajuste):
 *  dos lecturas distintas del mismo registro no pueden discrepar en quién ve qué. */
export function useAjustesCtx(): AjustesCtx {
  const { company, role, updateCompanySettings } = useAuth()
  const profiles = useProfiles()
  return useMemo<AjustesCtx>(
    () => ({
      company,
      role,
      readOnly: profiles.readOnly,
      wantsEmail: profiles.wantsEmail,
      setEmailPref: profiles.setEmailPref,
      updateCompanySettings,
    }),
    [company, role, profiles.readOnly, profiles.wantsEmail, profiles.setEmailPref, updateCompanySettings],
  )
}

export function seccionesVisibles(c: AjustesCtx): SeccionAjustes[] {
  return SECCIONES.filter((s) => s.disponible(c))
}

export function gruposVisibles(seccion: SeccionAjustes, c: AjustesCtx): GrupoAjustes[] {
  return seccion.grupos.filter((g) => (g.disponible ? g.disponible(c) : true))
}

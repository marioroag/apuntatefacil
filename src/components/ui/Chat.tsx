import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, FileText, Loader2 } from 'lucide-react'
import { fullDateTime, memberAvatarTone, plural, relativeDate } from '../../lib/format'
import { botonIcono } from '../../lib/buttons'
import type { CompanyMember } from '../../lib/types'
import { ES_MENCION, mentionHandle, resolveMentions } from '../../lib/mentions'
import { useProfiles } from '../../lib/profiles'
import { Avatar } from './Avatar'

/**
 * Chat del equipo. Una sola gramática de conversación en toda la app: el hilo de
 * un candidato y el de una petición del tablón se leen igual, porque son lo
 * mismo (gente del equipo hablando de un caso).
 *
 * Ritmo de chat, no de feed de actividad: sin líneas entre mensajes, avatar de
 * 28px con color estable por persona, y el nombre y la hora en la misma línea
 * base. Las divisorias que tenía el tablón hacían que tres frases seguidas
 * parecieran tres sucesos de auditoría.
 *
 * Quién es quién: el nombre y la foto del perfil de la persona (`useProfiles`),
 * con el email como respaldo mientras no se haya puesto nombre. Tus propios
 * mensajes dicen "Tú".
 */
export type ChatMessage = {
  id: string
  authorUserId: string | null
  authorEmail: string
  body: string
  createdAt: string
  /** Nota interna de la época anterior al chat: sin autor, con icono de documento. */
  isNote?: boolean
  /** Contenido extra bajo el cuerpo (los candidatos propuestos, en el tablón). */
  slot?: ReactNode
  /** Destaca al autor (p. ej. quien abrió la petición del tablón). */
  authority?: boolean
}

/** Cuerpo del mensaje con las menciones destacadas. */
function ChatBody({ body }: { body: string }) {
  const partes = useMemo(() => body.split(/(@[\w.+-]+)/g), [body])
  return (
    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">
      {partes.map((p, i) =>
        ES_MENCION.test(p) ? (
          <span key={i} className="rounded bg-indigo-50 px-1 font-semibold text-indigo-700">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </p>
  )
}

export function ChatSkeleton() {
  return (
    <div className="space-y-5 py-1" role="status" aria-label="Cargando la conversación">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3">
          <span className="size-7 shrink-0 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2.5 pt-0.5" aria-hidden>
            <div className="h-3 w-28 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChatEmpty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="m-auto max-w-[38ch] py-6 text-center">
      <div className="mx-auto grid size-6 place-items-center text-slate-400" aria-hidden>
        {icon}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-1 text-[13px] leading-5 text-slate-500">{children}</p>
    </div>
  )
}

/** Cuánto puede haber subido y seguir contando como "está mirando el final". */
const MARGEN_FONDO = 64

/**
 * Que el hilo siga al mensaje nuevo, SIN arrastrarte si estabas leyendo arriba.
 *
 * Las dos mitades importan lo mismo. Sin la primera, los mensajes llegan en
 * tiempo real y no los ves: aparecen fuera de la pantalla y la conversación
 * parece muerta. Con la primera sola pero sin la segunda, te tira al fondo
 * mientras relees lo que dijo el candidato hace diez mensajes, que es peor,
 * porque te quita el control de algo que estabas haciendo tú.
 *
 * Así que se sigue el final solo si ya estabas en el final, y si no, se te
 * avisa de que hay algo nuevo y decides tú. Es lo que hace cualquier chat, y
 * la razón por la que lo hacen todos es esta.
 *
 * El salto automático es instantáneo a propósito: ya estás abajo, así que lo
 * único que se mueve es lo que ocupa la burbuja nueva y animarlo sería
 * marearlo. El de la chapa sí es suave, porque ahí sí recorres el hilo y
 * conviene ver por dónde vas (y se apaga con `prefers-reduced-motion`).
 */
export function useSeguirAlFondo(cuantos: number) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [nuevos, setNuevos] = useState(0)
  const pegado = useRef(true)
  const sinEstrenar = useRef(true)
  const anteriores = useRef(cuantos)

  const irAlFondo = useCallback((suave = false) => {
    const el = contenedor.current
    if (!el) return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: el.scrollHeight, behavior: suave && !quieto ? 'smooth' : 'auto' })
    pegado.current = true
    setNuevos(0)
  }, [])

  // Dónde está mirando. Se apunta al hacer scroll y no al llegar el mensaje:
  // para entonces el contenido ya ha crecido y la cuenta saldría mal.
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const mirar = () => {
      pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight <= MARGEN_FONDO
      if (pegado.current) setNuevos(0)
    }
    el.addEventListener('scroll', mirar, { passive: true })
    return () => el.removeEventListener('scroll', mirar)
  }, [])

  useLayoutEffect(() => {
    const antes = anteriores.current
    anteriores.current = cuantos

    // Hilo vacío: o está cargando, o se ha cambiado de conversación. En los dos
    // casos el siguiente pintado es una apertura, no un mensaje nuevo.
    if (cuantos === 0) {
      sinEstrenar.current = true
      setNuevos(0)
      return
    }
    // Al abrir se aterriza abajo de golpe, sin ver pasar el hilo entero.
    if (sinEstrenar.current) {
      sinEstrenar.current = false
      irAlFondo()
      return
    }
    if (cuantos <= antes) return
    if (pegado.current) irAlFondo()
    else setNuevos((n) => n + (cuantos - antes))
  }, [cuantos, irAlFondo])

  return { contenedor, nuevos, irAlFondo }
}

/**
 * "2 mensajes nuevos", encima del hilo, cuando han llegado mientras leías
 * arriba. Va en el acento porque es una acción (te lleva al final), no un
 * estado.
 */
export function ChatNuevos({ nuevos, onClick }: { nuevos: number; onClick: () => void }) {
  if (nuevos <= 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-indigo-600 py-1.5 pl-3 pr-3.5 text-[13px] font-semibold text-white shadow-pop transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <ArrowDown className="size-3.5" aria-hidden />
        {plural(nuevos, 'mensaje nuevo', 'mensajes nuevos')}
      </button>
    </div>
  )
}

/**
 * La conversación. `mt-auto`: con pocos mensajes el hilo se apoya en el campo de
 * escribir en vez de dejar un hueco muerto debajo.
 *
 * NO lleva el scroll: eso es de quien tenga el contenedor que scrollea, con
 * `useSeguirAlFondo`. Antes lo hacía aquí dentro con un `scrollIntoView` a cada
 * mensaje, y por eso te arrastraba al fondo estuvieras donde estuvieras.
 */
export function ChatThread({
  messages,
  currentUserId,
  className = '',
}: {
  messages: ChatMessage[]
  currentUserId: string | null | undefined
  className?: string
}) {
  const profiles = useProfiles()
  // Aquí NO se hace scroll. Lo lleva `useSeguirAlFondo` en quien monta el hilo,
  // porque el scrollIntoView que había aquí bajaba siempre, también mientras
  // releías diez mensajes más arriba, y eso es peor que no seguir al mensaje.
  return (
    <ol className={`mt-auto space-y-4 ${className}`}>
      {messages.map((m) => {
        const yo = !!m.authorUserId && m.authorUserId === currentUserId
        // Cómo se llama quien escribe: su nombre de perfil si lo ha puesto y, si
        // no, el derivado del email. Lo decide `nameFor`, aquí y en todas partes.
        const real = profiles.nameFor(m.authorUserId, m.authorEmail)
        const nombre = m.isNote ? 'Nota anterior' : yo ? 'Tú' : real
        const tone = memberAvatarTone(m.authorEmail)
        return (
          <li key={m.id} className="flex gap-2.5">
            {m.isNote ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white ring-1 ring-slate-200" aria-hidden>
                <FileText className="size-3.5 text-slate-500" />
              </span>
            ) : (
              <Avatar name={real} seed={m.authorEmail} src={profiles.avatarFor(m.authorUserId)} size={28} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={`text-[13px] font-semibold ${m.authority ? tone.name : 'text-slate-800'}`}>{nombre}</span>
                <time dateTime={m.createdAt} title={fullDateTime(m.createdAt)} className="num text-[12px] text-slate-500">
                  {relativeDate(m.createdAt)}
                </time>
              </div>
              {m.body && <ChatBody body={m.body} />}
              {m.slot}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// -----------------------------------------------------------------------------
// LA CAJA DE ESCRIBIR. Una sola, para todas las conversaciones de la app.
//
// Forma: UNA LÍNEA, con el texto y el botón de enviar en la misma fila y dentro
// del mismo borde. En reposo la caja mide lo que mide una frase, y solo crece si
// escribes más: una caja de tres o cuatro líneas vacías promete una redacción
// larga que aquí no se hace (esto son dos frases sobre una persona), y encima le
// quita al hilo el sitio que necesita, que es justo lo que estás leyendo para
// poder contestar. El techo son cinco líneas.
//
// La excepción es el hilo del tablón, y es una excepción por su contenido, no
// por su estilo: ahí además de enviar se proponen candidatos, y dos acciones no
// caben en la línea sin dejar el mensaje en un hueco. Esa caja pone el texto en
// una fila y los controles en otra (`CHAT_TEXTAREA_BLOQUE` + `CHAT_ACTIONS`),
// con el mismo canto y el mismo botón que las demás.
//
// Por eso el botón va DENTRO y no pegado al lado: el canto de la caja es el
// único canto, y así se lee como un sitio donde se escribe y no como un input
// con un botón detrás.
//
// Las cadenas se declaran aquí y las usan los tres sitios que tienen una caja de
// estas (el chat del candidato, el hilo del tablón y la respuesta de soporte).
// Copiarlas en cada pantalla es exactamente como empezó el problema de los
// botones: nueve clones y cinco sombras distintas para lo mismo.
// -----------------------------------------------------------------------------

export const CHAT_SURFACE =
  'rounded-xl border border-slate-300 bg-white transition-shadow duration-[var(--duration-control)] ease-[var(--ease-out)] focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15'

/**
 * La fila: texto y controles. `items-end` para que el botón se quede abajo
 * cuando el texto crece, que es donde sigue estando el cursor.
 */
export const CHAT_ROW = 'flex items-end gap-2 p-2'

/**
 * El texto. 16px en punteros táctiles (`pointer-coarse`) por lo mismo que el
 * formulario público: por debajo de eso iOS hace zoom al enfocar.
 */
const CHAT_TEXTO =
  'block min-w-0 resize-none border-0 bg-transparent text-sm pointer-coarse:text-base leading-5 text-slate-900 outline-none placeholder:text-slate-500 focus:ring-0 disabled:opacity-60'

/**
 * El texto DENTRO de la fila, compartiéndola con el botón. El relleno vertical
 * lo iguala al alto del botón (32px), que es lo que hace que en reposo se lea
 * como una sola línea centrada; en táctil los dos suben a 44px.
 */
export const CHAT_TEXTAREA = `${CHAT_TEXTO} flex-1 px-1.5 py-1.5 pointer-coarse:py-3`

/**
 * El texto CON SU PROPIA FILA, cuando debajo hay una barra de controles. Lo usa
 * el hilo del tablón, que además de enviar propone candidatos: dos acciones no
 * caben en la línea sin comerse el mensaje, así que ahí la caja es de dos filas
 * a propósito. Mismo canto, mismo botón, distinta planta.
 */
export const CHAT_TEXTAREA_BLOQUE = `${CHAT_TEXTO} w-full px-3 pt-3 pb-1.5`

/**
 * La barra de controles de esa segunda fila. Mismo hueco lateral que el texto
 * (12px) para que todo cuelgue de la misma vertical; un control fantasma que
 * quiera alinear su icono ahí se come su propio relleno con `-ml-2`.
 */
export const CHAT_ACTIONS = 'flex items-center justify-between gap-2 px-3 pb-2'

/** Techo de alto del texto, en px: cinco líneas. Pasado eso, scroll dentro. */
export const CHAT_ALTO_MAX = 112

/**
 * Enviar. Solo el icono: una flecha hacia arriba es lo que significa "esto sale
 * de aquí" en cualquier caja de chat, y en una caja de una línea la palabra
 * "Enviar" se comía el sitio del mensaje. El nombre no se pierde, se muda al
 * `aria-label` y al `title`, que es además donde cabe decir el atajo sin gastar
 * pantalla.
 */
export function ChatSend({
  onClick,
  disabled = false,
  sending = false,
  hint = 'Enviar (Intro)',
}: {
  onClick: () => void
  disabled?: boolean
  sending?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || sending}
      title={hint}
      aria-label={sending ? 'Enviando mensaje' : 'Enviar mensaje'}
      aria-busy={sending}
      className={botonIcono('primary', 'sm', 'pointer-coarse:size-11 disabled:pointer-events-none disabled:opacity-40')}
    >
      {sending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ArrowUp className="size-4" aria-hidden />
      )}
    </button>
  )
}

/**
 * Campo de escribir. Crece con el texto hasta un techo (nunca salta el layout),
 * envía con Intro y ofrece a quién avisar al teclear `@`.
 *
 * Intro envía y Mayús+Intro hace el salto de línea, que es lo que hace todo
 * chat y lo que ya hacía el hilo del tablón. Estuvo al revés (Cmd/Ctrl+Intro)
 * por miedo a mandar medio mensaje, y el resultado fue peor: la mano escribe
 * dos frases, pulsa Intro y no pasa nada, o peor, se queda el mensaje a medias
 * en la caja creyendo que salió. La misma tecla en las dos cajas se aprende una
 * vez; dos teclas para lo mismo no se aprenden nunca.
 *
 * Con la lista de menciones abierta manda ella: ahí Intro elige a la persona.
 * Cmd/Ctrl+Intro sigue enviando, que no estorba a nadie.
 */
export function ChatComposer({
  members = [],
  onSend,
  // Corto porque la caja es de una línea y el panel del equipo mide 380px: el
  // texto anterior ("Con @ avisas a alguien") se partía en dos y la segunda
  // línea quedaba cortada por abajo. Dice lo mismo con la mitad de palabras.
  placeholder = 'Escribe a tu equipo. @ para avisar',
  label = 'Escribe un mensaje para tu equipo',
  id,
  disabled = false,
  children,
}: {
  /**
   * Sin miembros no hay menciones y la caja es un composer normal. Es lo que
   * necesita la conversación con el candidato: un '@' ahí no avisa a nadie, se
   * le enviaría tal cual por WhatsApp.
   */
  members?: CompanyMember[]
  onSend: (body: string, mentions: string[]) => Promise<void>
  placeholder?: string
  label?: string
  id: string
  disabled?: boolean
  /** Controles extra a la izquierda del botón de enviar (adjuntar candidatos). */
  children?: ReactNode
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sugerencias, setSugerencias] = useState<CompanyMember[]>([])
  const [activo, setActivo] = useState(0)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const profiles = useProfiles()

  // Una línea en reposo y crece con el texto hasta el techo. El `auto` previo no
  // es opcional: sin él `scrollHeight` nunca baja y la caja solo sabría crecer.
  const autoAlto = () => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, CHAT_ALTO_MAX)}px`
  }

  // La palabra que se está escribiendo tras un '@', si el cursor sigue dentro.
  const tokenEnCurso = (el: HTMLTextAreaElement): { desde: number; texto: string } | null => {
    const hasta = el.selectionStart ?? 0
    const antes = el.value.slice(0, hasta)
    const m = /@([\w.+-]*)$/.exec(antes)
    if (!m) return null
    return { desde: hasta - m[0].length, texto: m[1].toLowerCase() }
  }

  const refrescarSugerencias = () => {
    const el = areaRef.current
    const t = el ? tokenEnCurso(el) : null
    if (!t) {
      setSugerencias([])
      return
    }
    const libres = members.filter((m) => !m.isSelf && mentionHandle(m.email).startsWith(t.texto))
    setSugerencias(libres.slice(0, 5))
    setActivo(0)
  }

  const elegir = (m: CompanyMember) => {
    const el = areaRef.current
    if (!el) return
    const t = tokenEnCurso(el)
    if (!t) return
    const hasta = el.selectionStart ?? 0
    const nuevo = `${el.value.slice(0, t.desde)}@${mentionHandle(m.email)} ${el.value.slice(hasta)}`
    setTexto(nuevo)
    setSugerencias([])
    window.requestAnimationFrame(() => {
      const caret = t.desde + mentionHandle(m.email).length + 2
      el.focus()
      el.setSelectionRange(caret, caret)
      autoAlto()
    })
  }

  const enviar = async () => {
    const limpio = texto.trim()
    if (!limpio || enviando || disabled) return
    setEnviando(true)
    try {
      // Solo se vacía la caja si el mensaje salió. Un envío que falla y además
      // se lleva por delante lo que habías escrito obliga a teclearlo otra vez,
      // y es justo cuando menos ganas hay.
      await onSend(limpio, resolveMentions(limpio, members))
      setTexto('')
      setSugerencias([])
      window.requestAnimationFrame(() => {
        if (areaRef.current) areaRef.current.style.height = 'auto'
        areaRef.current?.focus()
      })
    } catch { /* el motivo lo enseña quien envía; aquí solo se conserva el texto */ }
    setEnviando(false)
  }

  const listaId = `${id}-menciones`

  return (
    <div className="relative">
      {sugerencias.length > 0 && (
        // Sobre el campo, no debajo: el composer está pegado al borde inferior
        // del panel y una lista hacia abajo se saldría de la pantalla.
        <ul
          id={listaId}
          role="listbox"
          aria-label="Avisar a alguien del equipo"
          className="absolute bottom-full left-0 z-10 mb-1 w-64 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop"
        >
          {sugerencias.map((m, i) => (
            <li key={m.userId}>
              <button
                type="button"
                role="option"
                aria-selected={i === activo}
                onMouseDown={(e) => {
                  e.preventDefault() // no robar el foco al textarea
                  elegir(m)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  i === activo ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Avatar name={profiles.nameFor(m.userId, m.email)} seed={m.email} src={profiles.avatarFor(m.userId)} size={20} />
                <span className="min-w-0 truncate font-medium">{profiles.nameFor(m.userId, m.email)}</span>
                <span className="num shrink-0 truncate text-[12px] text-slate-500">@{mentionHandle(m.email)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={CHAT_SURFACE}>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <div className={CHAT_ROW}>
          <textarea
            id={id}
            ref={areaRef}
            rows={1}
            value={texto}
            disabled={disabled}
            aria-controls={sugerencias.length ? listaId : undefined}
            aria-expanded={sugerencias.length > 0}
            onChange={(e) => {
              setTexto(e.target.value)
              autoAlto()
              refrescarSugerencias()
            }}
            onClick={refrescarSugerencias}
            onBlur={() => setSugerencias([])}
            onKeyDown={(e) => {
              if (sugerencias.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActivo((i) => (i + 1) % sugerencias.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length)
                  return
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  elegir(sugerencias[activo])
                  return
                }
                if (e.key === 'Escape') {
                  // Cierra la lista, no el panel de detrás.
                  e.stopPropagation()
                  setSugerencias([])
                  return
                }
              }
              if (e.key !== 'Enter') return
              // Mayús+Intro es el salto de línea. Y `isComposing` es el acento a
              // medio escribir: en un teclado español, sin esta guarda, cerrar
              // la tilde con Intro enviaría el mensaje a la mitad.
              if (e.shiftKey || e.nativeEvent.isComposing) return
              e.preventDefault()
              void enviar()
            }}
            placeholder={placeholder}
            className={CHAT_TEXTAREA}
          />
          {children}
          <ChatSend
            onClick={() => void enviar()}
            disabled={!texto.trim() || disabled}
            sending={enviando}
          />
        </div>
      </div>
    </div>
  )
}

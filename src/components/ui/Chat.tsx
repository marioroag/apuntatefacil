import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FileText, Loader2, Send } from 'lucide-react'
import { fullDateTime, initials, memberAvatarTone, personLabel, relativeDate } from '../../lib/format'
import { BTN_PRIMARY_SM } from '../../lib/buttons'
import type { CompanyMember } from '../../lib/types'
import { ES_MENCION, mentionHandle, resolveMentions } from '../../lib/mentions'

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
 * Quién es quién: no hay tabla de perfiles, así que la identidad se deriva del
 * email (ver `personLabel`). Tus propios mensajes dicen "Tú".
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

/**
 * La conversación. `mt-auto`: con pocos mensajes el hilo se apoya en el campo de
 * escribir en vez de dejar un hueco muerto debajo.
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
  const finRef = useRef<HTMLDivElement>(null)
  // El hilo arranca abajo (lo último dicho) y sigue al mensaje nuevo.
  useLayoutEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    <ol className={`mt-auto space-y-4 ${className}`}>
      {messages.map((m) => {
        const yo = !!m.authorUserId && m.authorUserId === currentUserId
        const nombre = m.isNote ? 'Nota anterior' : yo ? 'Tú' : personLabel(m.authorEmail)
        const tone = memberAvatarTone(m.authorEmail)
        return (
          <li key={m.id} className="flex gap-2.5">
            {m.isNote ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white ring-1 ring-slate-200" aria-hidden>
                <FileText className="size-3.5 text-slate-500" />
              </span>
            ) : (
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${tone.bg} ${tone.text}`}
                aria-hidden
              >
                {initials(nombre === 'Tú' ? personLabel(m.authorEmail) : nombre)}
              </span>
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
      <div ref={finRef} aria-hidden />
    </ol>
  )
}

/**
 * Campo de escribir. Crece con el texto hasta un techo (nunca salta el layout),
 * envía con Cmd/Ctrl+Enter y ofrece a quién avisar al teclear `@`.
 *
 * Por qué Cmd/Ctrl+Enter y no Enter a secas: es un campo multilínea, y aquí se
 * escriben cosas de dos frases. Enter suelto enviaba medio mensaje.
 */
export function ChatComposer({
  members,
  onSend,
  placeholder = 'Escribe a tu equipo. Con @ avisas a alguien.',
  label = 'Escribe un mensaje para tu equipo',
  id,
  disabled = false,
  children,
}: {
  members: CompanyMember[]
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

  const autoAlto = () => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
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
    await onSend(limpio, resolveMentions(limpio, members))
    setTexto('')
    setSugerencias([])
    setEnviando(false)
    window.requestAnimationFrame(() => {
      if (areaRef.current) areaRef.current.style.height = 'auto'
      areaRef.current?.focus()
    })
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
                <span className="font-medium">{personLabel(m.email)}</span>
                <span className="num truncate text-[12px] text-slate-500">@{mentionHandle(m.email)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-slate-300 bg-white transition-shadow focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          id={id}
          ref={areaRef}
          rows={2}
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
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void enviar()
            }
          }}
          placeholder={placeholder}
          className="block w-full resize-none bg-transparent px-3 pt-2.5 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-500 disabled:opacity-60"
        />
        <div className="flex items-center justify-end gap-2 px-2 pb-2">
          {children}
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!texto.trim() || enviando || disabled}
            className={`${BTN_PRIMARY_SM} disabled:pointer-events-none disabled:opacity-40`}
          >
            {enviando ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-indigo-200" aria-hidden /> Enviando
              </>
            ) : (
              <>
                <Send className="size-3.5 text-indigo-200" aria-hidden /> Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Copy, Globe, Loader2, LifeBuoy, Mail, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { SlideOver } from '../components/ui/SlideOver'
import { Button } from '../components/legacy-ui/Button'
import { relativeDate, fullDateTime } from '../lib/format'
import { copyText } from '../lib/clipboard'

// Datos que devuelven los RPC de operador (support_list_tickets / support_get_thread).
interface TicketRow {
  id: string
  company_id: string | null
  company_name: string | null
  email: string
  name: string | null
  source: 'app' | 'landing' | 'email'
  plan: string | null
  status: 'abierto' | 'cerrado'
  awaiting: 'equipo' | 'cliente'
  last_message_at: string
  created_at: string
  preview: string
}
interface ThreadMessage {
  id: string
  direction: 'in' | 'out'
  body: string
  from_email: string | null
  created_at: string
}
interface Thread {
  ticket: TicketRow & { message: string }
  messages: ThreadMessage[]
}

const ORIGEN: Record<TicketRow['source'], { label: string; Icon: typeof Mail }> = {
  app: { label: 'Cliente', Icon: Building2 },
  landing: { label: 'Lead (web)', Icon: Globe },
  email: { label: 'Email', Icon: Mail },
}

// Quién aparece como origen: la empresa si la consulta vino del panel, si no la
// etiqueta del canal (lead de la web o email directo).
function originLabel(t: Pick<TicketRow, 'source' | 'company_name'>): string {
  if (t.company_name) return t.company_name
  return ORIGEN[t.source].label
}

function StatePill({ t }: { t: Pick<TicketRow, 'status' | 'awaiting'> }) {
  // Paleta propia, nunca el acento de marca. Pendiente = ámbar (te toca a ti),
  // esperando al cliente = slate, cerrado = slate apagado.
  if (t.status === 'cerrado') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
        <span className="size-2 rounded-full bg-slate-400" aria-hidden /> Cerrado
      </span>
    )
  }
  if (t.awaiting === 'equipo') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        <span className="size-2 rounded-full bg-amber-500" aria-hidden /> Pendiente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      <span className="size-2 rounded-full bg-slate-400" aria-hidden /> Esperando al cliente
    </span>
  )
}

type Filter = 'abierto' | 'cerrado'

export function Soporte() {
  const toast = useToast()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState<Filter>('abierto')
  const [openId, setOpenId] = useState<string | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  const loadList = useCallback(async () => {
    const { data, error } = await supabase.rpc('support_list_tickets')
    if (error) {
      if (error.message?.toLowerCase().includes('autorizado')) setDenied(true)
      else toast.error('No se pudo cargar la bandeja de soporte.')
      setLoading(false)
      return
    }
    setTickets((data as TicketRow[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadList()
  }, [loadList])

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true)
    const { data, error } = await supabase.rpc('support_get_thread', { p_ticket: id })
    setThreadLoading(false)
    if (error) {
      toast.error('No se pudo abrir la conversación.')
      return
    }
    setThread(data as Thread)
  }, [toast])

  const open = (id: string) => {
    setOpenId(id)
    setReply('')
    setThread(null)
    loadThread(id)
  }
  const close = () => {
    setOpenId(null)
    setThread(null)
  }

  const copyEmail = async (email: string) => {
    const ok = await copyText(email)
    if (ok) toast.success('Correo copiado')
    else toast.show('Copia el correo manualmente: ' + email)
  }

  const sendReply = async () => {
    const text = reply.trim()
    if (!text || !openId || sending) return
    setSending(true)
    const { data, error } = await supabase.functions.invoke('support-reply', {
      body: { ticket_id: openId, body: text },
    })
    setSending(false)
    if (error || (data && data.ok === false)) {
      toast.error('No se pudo enviar la respuesta. Inténtalo de nuevo.')
      return
    }
    setReply('')
    if (data && data.sent === false) {
      // Guardada pero sin enviar (falta la clave de Resend en este entorno).
      toast.success('Respuesta guardada. El email se enviará al configurar Resend.')
    }
    await Promise.all([loadThread(openId), loadList()])
  }

  const setStatus = async (status: 'abierto' | 'cerrado') => {
    if (!openId || statusBusy) return
    setStatusBusy(true)
    const { error } = await supabase.rpc('support_set_status', { p_ticket: openId, p_status: status })
    setStatusBusy(false)
    if (error) {
      toast.error('No se pudo cambiar el estado.')
      return
    }
    setThread((t) => (t ? { ...t, ticket: { ...t.ticket, status } } : t))
    setTickets((list) => list.map((t) => (t.id === openId ? { ...t, status } : t)))
  }

  const visible = useMemo(() => tickets.filter((t) => t.status === filter), [tickets, filter])
  const pendientes = useMemo(
    () => tickets.filter((t) => t.status === 'abierto' && t.awaiting === 'equipo').length,
    [tickets],
  )

  if (denied) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <LifeBuoy className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Sin acceso</h1>
          <p className="mt-1.5 text-sm text-slate-500">Esta bandeja es solo para el equipo de soporte de Apúntate Fácil.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Soporte</h1>
        <p className="mt-0.5 text-sm text-slate-500">Consultas de clientes y de la web, con la conversación entera aquí.</p>
      </header>

      <div className="mb-3 flex items-center gap-2">
        {(['abierto', 'cerrado'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
              filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f === 'abierto' ? 'Abiertos' : 'Cerrados'}
            {f === 'abierto' && pendientes > 0 && (
              <span className="num ml-1.5 rounded-full bg-amber-400/90 px-1.5 text-[11px] font-bold text-amber-950">{pendientes}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20" role="status" aria-label="Cargando">
          <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card">
          <p className="text-sm text-slate-500">{filter === 'abierto' ? 'No hay consultas abiertas. Todo al día.' : 'No hay consultas cerradas.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <ul className="divide-y divide-slate-100" aria-label="Consultas de soporte">
            {visible.map((t) => {
              const { Icon } = ORIGEN[t.source]
              return (
                <li key={t.id}>
                  <button
                    onClick={() => open(t.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    {t.status === 'abierto' && t.awaiting === 'equipo' ? (
                      <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-label="Pendiente" />
                    ) : (
                      <span className="size-2 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                        <span className="truncate text-sm font-semibold text-slate-900">{originLabel(t)}</span>
                        <span className="truncate text-[13px] text-slate-500">{t.email}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-slate-500">{t.preview}</p>
                    </div>
                    <span className="num shrink-0 text-[12px] text-slate-400">{relativeDate(t.last_message_at)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <SlideOver
        open={!!openId}
        onClose={close}
        title={
          thread ? (
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => copyEmail(thread.ticket.email)}
                className="group -ml-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-slate-100"
                title="Copiar correo"
              >
                <span className="truncate text-[15px] font-semibold text-slate-900 group-hover:underline group-focus-visible:underline">
                  {thread.ticket.email}
                </span>
                <Copy className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" aria-hidden />
              </button>
              <p className="mt-0.5 truncate text-[13px] text-slate-500">
                {originLabel(thread.ticket)}
                {thread.ticket.plan ? ` · Plan ${thread.ticket.plan}` : ''} · {fullDateTime(thread.ticket.created_at)}
              </p>
            </div>
          ) : (
            <p className="text-[15px] font-semibold text-slate-900">Conversación</p>
          )
        }
        footer={
          thread ? (
            <ReplyBox
              value={reply}
              onChange={setReply}
              onSend={sendReply}
              sending={sending}
              status={thread.ticket.status}
              statusBusy={statusBusy}
              onToggleStatus={() => setStatus(thread.ticket.status === 'abierto' ? 'cerrado' : 'abierto')}
            />
          ) : undefined
        }
      >
        {threadLoading || !thread ? (
          <div className="grid place-items-center py-16" role="status" aria-label="Cargando conversación">
            <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
          </div>
        ) : (
          <ThreadView thread={thread} />
        )}
      </SlideOver>
    </div>
  )
}

function ThreadView({ thread }: { thread: Thread }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [thread])

  // La consulta inicial (cabecera del ticket) es el primer mensaje del cliente.
  const head: ThreadMessage = {
    id: 'head',
    direction: 'in',
    body: thread.ticket.message,
    from_email: thread.ticket.email,
    created_at: thread.ticket.created_at,
  }
  const all = [head, ...thread.messages]

  return (
    <div className="space-y-3">
      <div className="mb-1 flex justify-center">
        <StatePill t={thread.ticket} />
      </div>
      {all.map((m) => (
        <Bubble key={m.id} m={m} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function Bubble({ m }: { m: ThreadMessage }) {
  const out = m.direction === 'out'
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
            out ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
          }`}
        >
          {m.body}
        </div>
        <p className={`num mt-1 text-[11px] text-slate-400 ${out ? 'text-right' : 'text-left'}`}>
          {out ? 'Equipo' : m.from_email ?? 'Cliente'} · {relativeDate(m.created_at)}
        </p>
      </div>
    </div>
  )
}

function ReplyBox({
  value,
  onChange,
  onSend,
  sending,
  status,
  statusBusy,
  onToggleStatus,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  sending: boolean
  status: 'abierto' | 'cerrado'
  statusBusy: boolean
  onToggleStatus: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enviar con Cmd/Ctrl + Enter (Enter solo hace salto de línea).
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSend()
            }
          }}
          rows={2}
          placeholder="Escribe tu respuesta..."
          className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
        <Button onClick={onSend} loading={sending} loadingLabel="Enviando" disabled={!value.trim()} size="lg" icon={<Send className="size-4" aria-hidden />}>
          Enviar
        </Button>
      </div>
      <button
        onClick={onToggleStatus}
        disabled={statusBusy}
        className="text-[13px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
      >
        {status === 'abierto' ? 'Marcar como cerrada' : 'Reabrir consulta'}
      </button>
    </div>
  )
}

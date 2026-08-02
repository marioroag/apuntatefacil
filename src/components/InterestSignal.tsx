import { Clock3, HelpCircle, Mail, MessageCircle, ThumbsDown, ThumbsUp, UserX } from 'lucide-react'
import { candidateInterestState, INTEREST_STATE_LABEL } from '../lib/interest'
import type { Campaign, Candidate, InterestChannel } from '../lib/types'
import { relativeDate } from '../lib/format'

/**
 * Por dónde se preguntó, cuando hay algo que decir.
 *
 * Los iconos de esta chapa eran todos SOBRES (`MailQuestion`, `MailMinus`) de
 * cuando el único canal era el correo. Con los dos conviviendo, un sobre sobre
 * una pregunta que salió por WhatsApp dice algo que no es, y la diferencia
 * importa: no se persigue igual un correo sin abrir que un WhatsApp sin
 * contestar.
 *
 * El nombre va ya en la forma en que se lee dentro de la frase, no se pasa a
 * minúsculas al vuelo: "WhatsApp" es una marca y se escribe como se escribe.
 */
const CANAL: Record<InterestChannel, { nombre: string; icono: typeof Mail }> = {
  email: { nombre: 'por correo', icono: Mail },
  whatsapp: { nombre: 'por WhatsApp', icono: MessageCircle },
}

/** Señal excepcional para listas: solo aparece cuando el candidato ya respondió. */
export function InterestOutcomeIcon({ campaign, candidate }: { campaign: Campaign; candidate: Candidate }) {
  const state = candidateInterestState(campaign, candidate)
  if (state !== 'interested' && state !== 'not_interested') return null

  const Icon = state === 'interested' ? ThumbsUp : ThumbsDown
  const respondedAt = candidate.interest?.respondedAt
  const canal = CANAL[candidate.interest?.channel ?? 'email']
  const label = [
    INTEREST_STATE_LABEL[state],
    respondedAt && `respondió ${relativeDate(respondedAt)}`,
    canal.nombre,
  ].filter(Boolean).join(' · ')

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center ${state === 'interested' ? 'text-emerald-600' : 'text-slate-500'}`}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

export function InterestSignal({ campaign, candidate, compact = false }: {
  campaign: Campaign
  candidate: Candidate
  compact?: boolean
}) {
  const state = candidateInterestState(campaign, candidate)
  const canal = candidate.interest ? CANAL[candidate.interest.channel] : null
  const meta = {
    interested: { icon: ThumbsUp, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    not_interested: { icon: ThumbsDown, className: 'bg-slate-100 text-slate-700 ring-slate-200' },
    // Esperando: el reloj dice lo que pasa mejor que el canal.
    sent: { icon: Clock3, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    // Aquí sí manda el canal: "no contesta al correo" y "no contesta al
    // WhatsApp" llevan a hacer cosas distintas.
    no_response: { icon: canal?.icono ?? HelpCircle, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    unavailable: { icon: UserX, className: 'bg-slate-50 text-slate-500 ring-slate-200' },
    never: { icon: HelpCircle, className: 'bg-slate-50 text-slate-500 ring-slate-200' },
  }[state]
  const Icon = meta.icon
  const eventAt = state === 'sent' || state === 'no_response'
    ? candidate.interest?.reminderSentAt ?? candidate.interest?.sentAt
    : candidate.interest?.respondedAt
  const conFecha = eventAt && ['sent', 'no_response', 'interested', 'not_interested'].includes(state)
  const texto = conFecha
    ? `${INTEREST_STATE_LABEL[state]} · ${relativeDate(eventAt!)}`
    : INTEREST_STATE_LABEL[state]
  // El canal se escribe entero donde hay sitio (la ficha). En la lista lo dice
  // el icono, y el texto completo sigue estando al pasar por encima.
  const label = canal ? `${texto} · ${canal.nombre}` : texto

  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${meta.className} ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{compact ? texto : label}</span>
    </span>
  )
}

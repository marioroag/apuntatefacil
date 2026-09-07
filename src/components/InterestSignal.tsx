import { Clock3, HelpCircle, Mail, ThumbsDown, ThumbsUp, UserX } from 'lucide-react'
import { candidateInterestState, INTEREST_STATE_LABEL } from '../lib/interest'
import type { Campaign, Candidate } from '../lib/types'
import { relativeDate } from '../lib/format'

/**
 * AQUÍ SE DECÍA POR DÓNDE SE PREGUNTÓ, cuando había dos canales. Retirado el de
 * WhatsApp (sep 2026), la pregunta sale por correo y solo por correo, así que
 * escribirlo en cada chapa es repetir en todas las filas lo mismo. Un dato que
 * vale igual para todos no distingue nada.
 *
 * El sobre se queda donde de verdad dice algo: "no contesta" (`no_response`),
 * que es lo que lleva a hacer algo.
 */

/** Señal excepcional para listas: solo aparece cuando el candidato ya respondió. */
export function InterestOutcomeIcon({ campaign, candidate }: { campaign: Campaign; candidate: Candidate }) {
  const state = candidateInterestState(campaign, candidate)
  if (state !== 'interested' && state !== 'not_interested') return null

  const Icon = state === 'interested' ? ThumbsUp : ThumbsDown
  const respondedAt = candidate.interest?.respondedAt
  const label = [
    INTEREST_STATE_LABEL[state],
    respondedAt && `respondió ${relativeDate(respondedAt)}`,
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
  const meta = {
    interested: { icon: ThumbsUp, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    not_interested: { icon: ThumbsDown, className: 'bg-slate-100 text-slate-700 ring-slate-200' },
    // Esperando: el reloj dice lo que pasa mejor que un sobre.
    sent: { icon: Clock3, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    // Aquí sí manda el sobre: lo que hay que hacer es perseguir un correo.
    no_response: { icon: Mail, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
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

  return (
    <span
      title={texto}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${meta.className} ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{texto}</span>
    </span>
  )
}

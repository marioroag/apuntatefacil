import { Clock3, MailMinus, MailQuestion, ThumbsDown, ThumbsUp } from 'lucide-react'
import { candidateInterestState, INTEREST_STATE_LABEL } from '../lib/interest'
import type { Campaign, Candidate } from '../lib/types'
import { relativeDate } from '../lib/format'

export function InterestSignal({ campaign, candidate, compact = false }: {
  campaign: Campaign
  candidate: Candidate
  compact?: boolean
}) {
  const state = candidateInterestState(campaign, candidate)
  const meta = {
    interested: { icon: ThumbsUp, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    not_interested: { icon: ThumbsDown, className: 'bg-slate-100 text-slate-700 ring-slate-200' },
    sent: { icon: Clock3, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    no_response: { icon: MailQuestion, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    unavailable: { icon: MailMinus, className: 'bg-slate-50 text-slate-500 ring-slate-200' },
    never: { icon: MailQuestion, className: 'bg-slate-50 text-slate-500 ring-slate-200' },
  }[state]
  const Icon = meta.icon
  const eventAt = state === 'sent' || state === 'no_response'
    ? candidate.interest?.reminderSentAt ?? candidate.interest?.sentAt
    : candidate.interest?.respondedAt
  const label = eventAt && ['sent', 'no_response', 'interested', 'not_interested'].includes(state)
    ? `${INTEREST_STATE_LABEL[state]} · ${relativeDate(eventAt)}`
    : INTEREST_STATE_LABEL[state]

  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${meta.className} ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}

import { useEffect, useState } from 'react'
import { Copy, FileText, Loader2, MessageCircle, Phone, Star, Trash2 } from 'lucide-react'
import { SlideOver } from '../components/ui/SlideOver'
import { StatusSelect } from '../components/ui/StatusPill'
import type { Campaign, Candidate } from '../lib/types'
import { SOURCE_META } from '../lib/types'
import { fullDateTime, initials, formatPhone, candidateName } from '../lib/format'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { MaskedPhone } from '../components/MaskedPhone'
import { TagSection } from '../components/Tags'
import { TAGS_ENABLED } from '../lib/pricing'

function answerText(v: Candidate['answers'][string] | undefined): string {
  if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return 'Sin dato'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

export function CandidatePanel({
  campaign,
  candidate,
  onClose,
  onDeleted,
  onOpenManageTags,
  maskPhone = false,
}: {
  campaign: Campaign
  candidate: Candidate | null
  onClose: () => void
  onDeleted: (c: Candidate) => void
  onOpenManageTags?: () => void
  maskPhone?: boolean
}) {
  const { setStatus, setRating, setNotes, deleteCandidate } = useStore()
  const { role } = useAuth()
  const toast = useToast()
  const [notes, setLocalNotes] = useState('')
  const [cvLoading, setCvLoading] = useState(false)
  // El encargado aplica/quita etiquetas existentes, pero no crea ni gestiona
  // vocabulario (igual que en la RLS): owner/member sí.
  const canManageTags = role !== 'encargado'

  const viewCv = async () => {
    if (!candidate?.cvPath || cvLoading) return
    // Firmar la URL es una ida al servidor: damos estado de carga para que el clic
    // no parezca muerto en una red lenta.
    setCvLoading(true)
    const { data, error } = await supabase.storage.from('cvs').createSignedUrl(candidate.cvPath, 120)
    setCvLoading(false)
    if (error || !data?.signedUrl) {
      toast.error('No se pudo abrir el CV.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  // Teléfono y correo son los datos que se copian para pegar en otro sitio
  // (WhatsApp, Gmail, el CRM): al pulsar el valor se copian, con el mismo
  // patrón de toast que "Copiar enlace" y el correo del ticket de soporte.
  const copyValue = async (kind: 'Teléfono' | 'Correo', value: string) => {
    const ok = await copyText(value)
    if (ok) toast.success(`${kind} copiado`)
    else toast.show(`Copia ${kind.toLowerCase()} manualmente: ${value}`)
  }

  // Solo al cambiar de candidato, no en cada mutación del store (si no, borra
  // las notas que el usuario está escribiendo al tocar estado o valoración).
  useEffect(() => {
    setLocalNotes(candidate?.notes ?? '')
  }, [candidate?.id])

  const open = !!candidate
  const name = candidate ? candidateName(candidate) || 'Sin nombre' : ''
  const phone = candidate ? (candidate.answers['telefono'] as string) : ''
  const waPhone = phone ? '34' + phone.replace(/\D/g, '') : ''

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={
        candidate && (
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
              {initials(name)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold leading-tight text-slate-900">{name}</h2>
              <p className="text-[13px] text-slate-500">{campaign.title}</p>
            </div>
          </div>
        )
      }
      footer={
        candidate && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const removed = deleteCandidate(candidate.id)
                if (removed) onDeleted(removed)
                onClose()
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </button>
            <span className="text-[12px] text-slate-500">
              {SOURCE_META[candidate.source].label} · <span className="num">{fullDateTime(candidate.submittedAt)}</span>
            </span>
          </div>
        )
      }
    >
      {candidate && (
        <div className="space-y-6">
          {/* Estado + acciones de contacto */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect status={candidate.status} onChange={(s) => setStatus(candidate.id, s)} />
            <div className="ml-auto flex gap-2">
              {phone && (
                maskPhone ? (
                  <button
                    type="button"
                    onClick={() => toast.show('En la demo solo puedes mirar. Crea tu cuenta para llamar o escribir a tus candidatos.')}
                    className={BTN_PRIMARY}
                  >
                    <Phone className="size-3.5 text-indigo-200" aria-hidden /> Llamar
                  </button>
                ) : (
                  <a href={`tel:${phone.replace(/\s/g, '')}`} className={BTN_PRIMARY}>
                    <Phone className="size-3.5 text-indigo-200" aria-hidden /> Llamar
                  </a>
                )
              )}
              {phone && (
                maskPhone ? (
                  <button
                    type="button"
                    onClick={() => toast.show('En la demo solo puedes mirar. Crea tu cuenta para llamar o escribir a tus candidatos.')}
                    className={BTN_SECONDARY}
                  >
                    <MessageCircle className="size-3.5 text-slate-400" aria-hidden /> WhatsApp
                  </button>
                ) : (
                  waPhone && (
                    <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                      <MessageCircle className="size-3.5 text-slate-400" aria-hidden /> WhatsApp
                    </a>
                  )
                )
              )}
            </div>
          </div>

          {/* Valoración */}
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-800">Valoración</p>
            <div className="flex gap-0.5" role="group" aria-label="Valoración del candidato">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(candidate.id, candidate.rating === n ? 0 : n)}
                  aria-label={`${n} de 5 estrellas`}
                  aria-pressed={candidate.rating >= n}
                  className="rounded-lg p-0.5 text-slate-300 transition-colors hover:text-amber-400"
                >
                  <Star
                    className={`size-5 ${candidate.rating >= n ? 'fill-amber-400 text-amber-400' : ''}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Etiquetas. Agrupadas arriba con lo que decide el empresario (estado,
              valoración); debajo va lo que dijo el candidato (las respuestas). */}
          {TAGS_ENABLED && (
            <TagSection
              candidateId={candidate.id}
              tagIds={candidate.tagIds}
              canManage={canManageTags}
              onOpenManage={() => onOpenManageTags?.()}
            />
          )}

          {/* Respuestas */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Respuestas del formulario
            </p>
            <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {campaign.fields.map((f) => (
                <div key={f.id} className="grid grid-cols-[42%_58%] gap-3 px-3.5 py-2.5">
                  <dt className="break-words text-[13px] text-slate-500">{f.label}</dt>
                  <dd className={`break-words text-sm font-medium text-slate-900 ${['phone', 'number', 'date'].includes(f.type) ? 'num' : ''}`}>
                    {f.type === 'file' && candidate.cvPath ? (
                      <button
                        type="button"
                        onClick={viewCv}
                        disabled={cvLoading}
                        aria-busy={cvLoading || undefined}
                        className="inline-flex items-start gap-1.5 text-left font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 hover:decoration-indigo-500 disabled:opacity-70"
                      >
                        {cvLoading ? (
                          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="break-words">{answerText(candidate.answers[f.id])}</span>
                      </button>
                    ) : maskPhone && f.id === 'telefono' && candidate.answers[f.id] ? (
                      <MaskedPhone value={formatPhone(String(candidate.answers[f.id]))} />
                    ) : (f.type === 'phone' || f.type === 'email') && candidate.answers[f.id] ? (
                      <button
                        type="button"
                        onClick={() =>
                          copyValue(
                            f.type === 'phone' ? 'Teléfono' : 'Correo',
                            f.type === 'phone' ? formatPhone(String(candidate.answers[f.id])) : String(candidate.answers[f.id]),
                          )
                        }
                        className="group -ml-1 -my-0.5 inline-flex max-w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-100"
                        title={`Copiar ${f.type === 'phone' ? 'teléfono' : 'correo'}`}
                      >
                        <span className="break-words group-hover:underline group-focus-visible:underline">
                          {f.type === 'phone' ? formatPhone(String(candidate.answers[f.id])) : String(candidate.answers[f.id])}
                        </span>
                        <Copy className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" aria-hidden />
                      </button>
                    ) : (
                      answerText(candidate.answers[f.id])
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="notas" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Notas internas
            </label>
            <textarea
              id="notas"
              value={notes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={() => setNotes(candidate.id, notes)}
              rows={3}
              placeholder="Lo que hablasteis por teléfono, disponibilidad real, etc."
              className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
            />
            <p className="mt-1 text-[12px] text-slate-500">Solo las ve tu equipo. No se envían al candidato.</p>
          </div>
        </div>
      )}
    </SlideOver>
  )
}

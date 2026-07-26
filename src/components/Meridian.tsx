import { useState } from 'react'
import { Briefcase, Check, ChevronRight, Loader2, Lock, Sparkles } from 'lucide-react'
import type { Candidate } from '../lib/types'
import { initials, fullDate, candidateName } from '../lib/format'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { BTN_SECONDARY } from '../lib/buttons'
import { MERIDIAN_NAME, hasMeridian, fitTier, candidateFit } from '../lib/meridian'

// Avatar de iniciales del candidato ("PFP") con el ajuste de Meridian pintado como
// un anillo de progreso alrededor. DOCTRINA: el anillo es grafito neutro y comunica
// el valor por LONGITUD DE ARCO, nunca por color (el acento se reserva a acción; un
// score no lleva paleta de estados). Sin ajuste (candidato no analizado): sin anillo.
export function MeridianAvatar({ name, fit, size = 40 }: { name: string; fit?: number | null; size?: number }) {
  const has = typeof fit === 'number'
  const stroke = size >= 40 ? 2.5 : 2
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, fit ?? 0))
  const dash = (pct / 100) * circ
  const inner = has ? size - 8 : size
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      title={has ? `Ajuste ${Math.round(pct)} sobre 100` : undefined}
    >
      {has && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            className="stroke-slate-700"
          />
        </svg>
      )}
      <span
        className="grid place-items-center rounded-full bg-slate-100 font-bold text-slate-600"
        style={{ width: inner, height: inner, fontSize: Math.round(inner * 0.32) }}
      >
        {initials(name)}
      </span>
      {has && <span className="sr-only">Ajuste de {MERIDIAN_NAME}: {Math.round(pct)} sobre 100</span>}
    </span>
  )
}

// Etiqueta CUALITATIVA del ajuste (Encaja bien / Puede encajar / A valorar).
// Texto grafito, NUNCA una pastilla con punto de color (para no confundirse con los
// chips de estado). El énfasis por peso/oscuridad, jamás por tono de color.
export function FitLabel({ fit, className = '' }: { fit: number; className?: string }) {
  const t = fitTier(fit)
  const tone =
    t.key === 'bien' ? 'font-semibold text-slate-800'
    : t.key === 'puede' ? 'font-medium text-slate-600'
    : 'text-slate-500'
  return <span className={`${tone} ${className}`}>{t.label}</span>
}

// Etiqueta de sección del bloque (marca del asistente). El icono es decorativo:
// grafito neutro, nunca el acento.
function MeridianLabel() {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
      <Sparkles className="size-4 text-slate-500" aria-hidden />
      {MERIDIAN_NAME}
    </p>
  )
}

function ItemList({ label, items, marker }: { label: string; items: string[]; marker: 'check' | 'dot' }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[13px] leading-5 text-slate-700">
            {marker === 'check' ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
            ) : (
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
            )}
            <span className="break-words">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Fila de candidato con la lectura de Meridian, reutilizable en el Parte diario.
// Presentational: el que la usa decide qué pasa al abrir (normalmente abrir el panel).
export function MeridianCandidateRow({
  candidate,
  campaignTitle,
  onOpen,
}: {
  candidate: Candidate
  campaignTitle?: string
  onOpen: () => void
}) {
  const name = candidateName(candidate) || 'Sin nombre'
  const fit = candidateFit(candidate.ai)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
    >
      <MeridianAvatar name={name} fit={fit} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium text-slate-900">{name}</span>
          {fit != null && <FitLabel fit={fit} className="shrink-0 text-[12px]" />}
        </div>
        {candidate.ai?.summary && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{candidate.ai.summary}</p>
        )}
        {campaignTitle && (
          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1.5 pr-2 text-[12px] font-medium text-slate-600">
            <Briefcase className="size-3 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate">{campaignTitle}</span>
          </span>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
    </button>
  )
}

// Bloque de triaje de Meridian dentro del detalle del candidato (SlideOver).
export function MeridianPanelBlock({ candidate }: { candidate: Candidate }) {
  const { analyzeCandidate } = useStore()
  const { company } = useAuth()
  const [busy, setBusy] = useState(false)
  const enabled = hasMeridian(company?.plan)
  const ai = candidate.ai
  const failed = !!ai?.error

  const run = async () => {
    if (busy) return
    setBusy(true)
    await analyzeCandidate(candidate.id)
    setBusy(false)
  }

  // Bloqueado por plan (diferenciador de Pro/Multi): teaser sobrio con upsell.
  if (!enabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
        <MeridianLabel />
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
          Reviso cada candidatura y calculo su ajuste al puesto para que veas primero a quien encaja.
        </p>
        <a
          href="/app/plan"
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
        >
          <Lock className="size-3.5" aria-hidden /> Disponible con Pro
        </a>
      </div>
    )
  }

  // Analizado con éxito. El veredicto (etiqueta y anillo) vive en la CABECERA del
  // panel, así que aquí queda solo la lectura: sin repetir la etiqueta ni la barra.
  //
  // Y sin "Volver a analizar" a propósito: re-tirar un análisis correcto daba un
  // número distinto cada vez y eso destruía la confianza. Reintentar solo tiene
  // sentido cuando falló, que es la rama de abajo.
  if (ai && !failed) {
    return (
      <div className="rounded-xl border border-slate-200 p-3.5">
        <MeridianLabel />
        {ai.summary && <p className="mb-3 mt-1.5 text-sm leading-6 text-slate-800">{ai.summary}</p>}
        <div className="space-y-3">
          <ItemList label="A favor" items={ai.highlights} marker="check" />
          <ItemList label="A confirmar" items={ai.concerns} marker="dot" />
        </div>
        <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-4 text-slate-400">
          {ai.cvUsed === false ? 'Sin CV, lo he mirado por sus respuestas. ' : ''}
          {ai.model} · <span className="num">{fullDate(ai.analyzedAt)}</span>
        </p>
      </div>
    )
  }

  // Sin analizar o con error: acción para (re)analizar.
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <MeridianLabel />
      <p className="mb-2.5 mt-1.5 text-[13px] leading-5 text-slate-500">
        {failed
          ? 'No he podido analizar esta candidatura. Inténtalo de nuevo.'
          : 'Aún no la he analizado. La reviso y te digo su ajuste al puesto.'}
      </p>
      <button type="button" onClick={run} disabled={busy} className={BTN_SECONDARY}>
        {busy ? (
          <>
            <Loader2 className="size-3.5 animate-spin text-slate-400" aria-hidden /> Analizando…
          </>
        ) : (
          <>
            <Sparkles className="size-3.5 text-slate-500" aria-hidden /> {failed ? 'Volver a analizar' : `Analizar con ${MERIDIAN_NAME}`}
          </>
        )}
      </button>
    </div>
  )
}

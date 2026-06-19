import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, ChevronRight, Clock, PauseCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import type { Candidate } from '../lib/types'

const STALE_DAYS = 7

// Vista general (Multi): panel "home" con el pulso global de todos los puestos.
// Solo lectura. El detalle por sede y su gestión viven en la pestaña Sedes.
export function Resumen() {
  const { campaigns, candidates, newCountFor } = useStore()
  const { company } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'

  if (!demo && !planHas(company?.plan, 'sites'))
    return (
      <FeatureLocked
        feature="sites"
        featureLabel="la Vista general"
        blurb="Un vistazo a cómo van todos tus puestos: candidatos, nuevos sin revisar y contratados."
      />
    )

  const staleCut = Date.now() - STALE_DAYS * 86400000
  const nuevosTotal = campaigns.reduce((s, c) => s + newCountFor(c.id), 0)
  const contratados = candidates.filter((c) => c.status === 'contratado').length
  const abiertos = campaigns.filter((c) => c.status === 'activa' || c.status === 'pausada').length

  // "Piden atención": nuevos sin contactar +7 días (por puesto) y puestos pausados.
  const atencion: { key: string; to: string; title: string; reason: string; kind: 'stale' | 'pause' }[] = []
  for (const c of campaigns) {
    const staleN = candidates.filter(
      (x) => x.campaignId === c.id && x.status === 'nuevo' && new Date(x.submittedAt).getTime() < staleCut,
    ).length
    if (staleN > 0)
      atencion.push({
        key: `stale-${c.id}`,
        to: `${base}/puestos/${c.id}?estado=nuevo`,
        title: c.title,
        reason: `${staleN} sin contactar +${STALE_DAYS} días`,
        kind: 'stale',
      })
  }
  for (const c of campaigns) {
    if (c.status === 'pausada')
      atencion.push({ key: `pause-${c.id}`, to: `${base}/puestos/${c.id}`, title: c.title, reason: 'Puesto pausado', kind: 'pause' })
  }

  // "Nuevos sin revisar": top puestos por candidatos nuevos.
  const topNuevos = campaigns
    .map((c) => ({ c, n: newCountFor(c.id) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Vista general</h1>
        <p className="mt-0.5 text-sm text-slate-500">Cómo van todos tus puestos de un vistazo.</p>
      </header>

      {campaigns.length === 0 ? (
        <Empty text="Aún no tienes puestos. Crea el primero para ver aquí cómo van tus puestos." />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Candidatos" n={candidates.length} />
            <Kpi label="Nuevos sin revisar" n={nuevosTotal} />
            <Kpi label="Contratados" n={contratados} />
            <Kpi label="Puestos abiertos" n={abiertos} />
          </div>

          {/* Gráfica de altas por semana (única serie temporal real: fecha de alta) */}
          <IntakeChart candidates={candidates} />

          {/* Piden atención + Nuevos sin revisar */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Piden atención">
              {atencion.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-slate-500">Todo al día, nada pendiente.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {atencion.slice(0, 6).map((a) => (
                    <li key={a.key}>
                      <Link to={a.to} className="flex items-center gap-2.5 py-2.5 transition-colors hover:bg-slate-50">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                          {a.kind === 'stale' ? <Clock className="size-4" aria-hidden /> : <PauseCircle className="size-4" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{a.title}</span>
                          <span className="block text-[12px] text-slate-500">{a.reason}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Nuevos sin revisar" right={nuevosTotal > 0 ? String(nuevosTotal) : undefined}>
              {topNuevos.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-slate-500">Sin candidatos nuevos pendientes.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {topNuevos.map(({ c, n }) => (
                    <li key={c.id}>
                      <Link
                        to={`${base}/puestos/${c.id}?estado=nuevo`}
                        className="flex items-center gap-2.5 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <Briefcase className="size-4 shrink-0 text-slate-400" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{c.title}</span>
                        <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 text-[11px] font-bold tabular-nums text-indigo-700">{n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

// --- Gráfica de área: candidatos recibidos por semana ----------------------
// La ÚNICA dimensión temporal real del modelo es la fecha de alta del candidato
// (submittedAt). No graficamos contrataciones ni embudo en el tiempo porque no
// se guarda timestamp de cambio de estado: sería inventar una serie.
function IntakeChart({ candidates }: { candidates: Candidate[] }) {
  const weeks = useMemo(() => weeklyIntake(candidates), [candidates])
  if (weeks.length < 2) return null

  const W = 600
  const H = 150
  const padX = 14
  const padTop = 12
  const padBottom = 4
  const innerH = H - padTop - padBottom
  const max = Math.max(...weeks.map((w) => w.count), 1)
  const x = (i: number) => padX + (i / (weeks.length - 1)) * (W - padX * 2)
  const y = (v: number) => padTop + innerH - (v / max) * innerH
  const pts = weeks.map((w, i) => ({ x: x(i), y: y(w.count) }))
  const line = smoothPath(pts)
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(padTop + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padTop + innerH).toFixed(1)} Z`
  const total = weeks.reduce((s, w) => s + w.count, 0)
  const labelIdx = [0, Math.floor((weeks.length - 1) / 2), weeks.length - 1].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-semibold text-slate-800">Candidatos recibidos por semana</p>
        <p className="text-[12px] text-slate-500 tabular-nums">{total} en total</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-40 w-full sm:h-44" preserveAspectRatio="none" role="img" aria-label={`Candidatos recibidos por semana, ${total} en total`}>
        <path d={area} className="fill-indigo-600/10" />
        <path d={line} fill="none" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="stroke-indigo-600" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" strokeWidth="2" className="fill-indigo-600 stroke-white" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        {labelIdx.map((i) => (
          <span key={i}>{weeks[i].label}</span>
        ))}
      </div>
    </div>
  )
}

type Week = { count: number; label: string }

function weeklyIntake(candidates: Candidate[]): Week[] {
  if (candidates.length === 0) return []
  const WEEK = 7 * 86400000
  const times = candidates.map((c) => new Date(c.submittedAt).getTime()).filter((t) => !Number.isNaN(t))
  if (times.length === 0) return []
  const min = Math.min(...times)
  const max = Math.max(...times)
  const n = Math.floor((max - min) / WEEK) + 1
  const buckets: Week[] = Array.from({ length: n }, (_, i) => ({
    count: 0,
    label: new Date(min + i * WEEK).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
  }))
  for (const t of times) {
    const idx = Math.min(n - 1, Math.floor((t - min) / WEEK))
    buckets[idx].count++
  }
  return buckets
}

// Suaviza una polilínea con beziers (Catmull-Rom -> cúbicas) para una curva limpia.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

// --- Tarjetas ---------------------------------------------------------------

function Kpi({ label, n }: { label: string; n: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{n}</p>
    </div>
  )
}

function Panel({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {right && <span className="text-[13px] tabular-nums text-slate-500">{right}</span>}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Building2 className="size-6" aria-hidden />
      </div>
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  )
}

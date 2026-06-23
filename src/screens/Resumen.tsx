import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, ChevronRight, Clock, PauseCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { miles } from '../lib/format'
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

            <Panel title="Nuevos sin revisar" right={nuevosTotal > 0 ? miles(nuevosTotal) : undefined}>
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
                        <Briefcase className="size-4 shrink-0 text-slate-500" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{c.title}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-700">{n}</span>
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

// --- Gráfica de candidatos recibidos por semana ----------------------------
// La ÚNICA dimensión temporal real del modelo es la fecha de alta (submittedAt):
// no inventamos embudos en el tiempo. Semanas de CALENDARIO (lunes), trazo recto
// (sin suavizar, que falsearía valores entre semanas), valores legibles en la
// propia gráfica, semana en curso marcada, y tabla de datos para lectores de
// pantalla y para quien quiera la cifra exacta de cada semana.
function IntakeChart({ candidates }: { candidates: Candidate[] }) {
  const weeks = useMemo(() => weeklyIntake(candidates), [candidates])
  if (weeks.length < 2) return <ChartPlaceholder />
  return <IntakeChartBody weeks={weeks} />
}

function ChartPlaceholder() {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <p className="text-[13px] font-semibold text-slate-800">Candidatos recibidos por semana</p>
      <div className="mt-2 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200">
        <p className="max-w-xs px-6 text-center text-[13px] text-slate-500">La tendencia aparece en cuanto tengas 2 o más semanas de datos.</p>
      </div>
    </div>
  )
}

function IntakeChartBody({ weeks }: { weeks: Week[] }) {
  // El ancho real (medido) da coordenadas 1:1 sin distorsión: círculos redondos
  // y texto legible dentro del SVG (preserveAspectRatio="none" los deformaba).
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(560)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(Math.max(240, el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = weeks.length
  const partialLast = weeks[n - 1].start === weekStartMonday(Date.now())
  const complete = partialLast ? weeks.slice(0, -1) : weeks
  const avg = complete.length
    ? Math.round(complete.reduce((s, x) => s + x.count, 0) / complete.length)
    : weeks[n - 1].count
  const max = Math.max(...weeks.map((x) => x.count), 1)

  const H = 180
  const padL = 10
  const padR = 10
  const padTop = 24
  const padBottom = 22
  const innerH = H - padTop - padBottom
  const x = (i: number) => padL + (i / (n - 1)) * (w - padL - padR)
  const y = (v: number) => padTop + innerH - (v / max) * innerH
  const baseY = padTop + innerH
  const pts = weeks.map((wk, i) => ({ x: x(i), y: y(wk.count), v: wk.count }))
  const seg = (p: { x: number; y: number }, i: number) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  const solidPts = partialLast ? pts.slice(0, -1) : pts
  const solidLine = solidPts.map(seg).join(' ')
  const area = `${pts.map(seg).join(' ')} L${pts[n - 1].x.toFixed(1)} ${baseY} L${pts[0].x.toFixed(1)} ${baseY} Z`
  const maxY = y(max)

  // Etiquetas de eje X equiespaciadas (siempre primera y última).
  const k = Math.min(n, w < 380 ? 3 : 6)
  const labelIdx = [...new Set(Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / (k - 1))))]
  const labelEach = n <= 8

  return (
    <figure className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-800">Candidatos recibidos por semana</span>
        <span className="text-[12px] tabular-nums text-slate-500">media de {miles(avg)}/semana</span>
      </figcaption>
      <div ref={ref} className="mt-2">
        <svg
          viewBox={`0 0 ${w} ${H}`}
          height={H}
          className="w-full"
          role="img"
          aria-label={`Candidatos recibidos por semana. Media de ${avg} por semana, máximo ${max} en una semana.${partialLast ? ' La última semana está en curso.' : ''} Cifra de cada semana en la tabla "Ver datos por semana".`}
        >
          {/* Línea de máximo: da escala para leer las alturas. */}
          <line x1={padL} y1={maxY} x2={w - padR} y2={maxY} className="stroke-slate-200" strokeDasharray="2 4" />
          <text x={w - padR} y={maxY - 5} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{max}</text>
          {/* Área + línea RECTA (honesta con datos discretos). */}
          <path d={area} className="fill-slate-700/10" />
          <path d={solidLine} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-slate-700" />
          {partialLast && n >= 2 && (
            <path
              d={`M${pts[n - 2].x.toFixed(1)} ${pts[n - 2].y.toFixed(1)} L${pts[n - 1].x.toFixed(1)} ${pts[n - 1].y.toFixed(1)}`}
              fill="none" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" className="stroke-slate-400"
            />
          )}
          {/* Puntos + valor encima (el del máximo ya lo da la línea de escala). */}
          {pts.map((p, i) => {
            const partial = partialLast && i === n - 1
            return (
              <g key={weeks[i].start}>
                <circle cx={p.x} cy={p.y} r="2.5" strokeWidth="2" className={partial ? 'fill-white stroke-slate-400' : 'fill-slate-700 stroke-white'} />
                {(labelEach || i === n - 1) && p.v !== max && (
                  <text x={p.x} y={p.y - 8} textAnchor="middle" className={`text-[10px] tabular-nums ${partial ? 'fill-slate-400' : 'fill-slate-600'}`}>{p.v}</text>
                )}
              </g>
            )
          })}
          {/* Eje X. */}
          {labelIdx.map((i, j) => (
            <text key={weeks[i].start} x={x(i)} y={H - 6} textAnchor={j === 0 ? 'start' : j === labelIdx.length - 1 ? 'end' : 'middle'} className="fill-slate-500 text-[11px]">{weeks[i].label}</text>
          ))}
        </svg>
      </div>
      {partialLast && <p className="mt-1 text-[11px] text-slate-500">La última semana (línea discontinua) está en curso.</p>}
      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-medium text-indigo-700 marker:content-none hover:text-indigo-800">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden /> Ver datos por semana
        </summary>
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Semana</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Candidatos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weeks.map((wk, i) => (
                <tr key={wk.start}>
                  <td className="px-3 py-1.5 text-slate-700">{wk.label}{partialLast && i === n - 1 ? ' (en curso)' : ''}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{wk.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

type Week = { start: number; count: number; label: string }

// Inicio de la semana de calendario (lunes 00:00 local), robusto a cambios de hora.
function weekStartMonday(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

function weeklyIntake(candidates: Candidate[]): Week[] {
  const times = candidates.map((c) => new Date(c.submittedAt).getTime()).filter((t) => !Number.isNaN(t))
  if (times.length === 0) return []
  const first = weekStartMonday(Math.min(...times))
  const last = weekStartMonday(Math.max(...times))
  const buckets: Week[] = []
  // Avanzar por días de calendario (DST-safe), una semana cada vez.
  for (let d = new Date(first); d.getTime() <= last; d.setDate(d.getDate() + 7)) {
    buckets.push({ start: d.getTime(), count: 0, label: new Date(d.getTime()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) })
  }
  const idxByStart = new Map(buckets.map((b, i) => [b.start, i]))
  for (const t of times) {
    const i = idxByStart.get(weekStartMonday(t))
    if (i !== undefined) buckets[i].count++
  }
  return buckets
}

// --- Tarjetas ---------------------------------------------------------------

function Kpi({ label, n }: { label: string; n: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{miles(n)}</p>
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
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Building2 className="size-6" aria-hidden />
      </div>
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  )
}

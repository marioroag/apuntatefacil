import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, Building2, ChevronRight, Clock, PauseCircle, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { SedesManager } from '../components/SedesManager'
import { BTN_SECONDARY } from '../lib/buttons'
import type { Campaign, Candidate } from '../lib/types'

const STALE_DAYS = 7

// Vista general (Multi): cómo van todos tus puestos de un vistazo, al estilo de un
// panel "home". Fusiona el antiguo overview por sede con la GESTIÓN de sedes (que
// vive ahora como sección al pie, no como pestaña aparte). Solo lectura arriba;
// las mutaciones de sedes están separadas abajo y solo las ve owner/member.
export function Resumen() {
  const { campaigns, candidates, sites, newCountFor } = useStore()
  const { company, role } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'
  const isEncargado = role === 'encargado'
  const [focusSedes, setFocusSedes] = useState(0)
  const [params, setParams] = useSearchParams()

  // Deep-link ?sedes=1 (desde el redirect de /sedes y los enlaces "Gestionar sedes"
  // del panel del puesto): lleva a la sección de gestión. Nunca para el encargado.
  useEffect(() => {
    if (params.get('sedes') && !isEncargado) {
      setFocusSedes((n) => n + 1)
      const next = new URLSearchParams(params)
      next.delete('sedes')
      setParams(next, { replace: true })
    }
  }, [params, isEncargado, setParams])

  if (!demo && !planHas(company?.plan, 'sites'))
    return (
      <FeatureLocked
        feature="sites"
        featureLabel="la Vista general"
        blurb="Compara de un vistazo cómo va cada sede y gestiónalas desde un sitio: nuevos, sin contactar y contratados."
      />
    )

  const staleCut = Date.now() - STALE_DAYS * 86400000

  const groupFor = (id: string | null, name: string, city: string) => {
    const camps = campaigns.filter((c) =>
      id === null ? !c.siteId || !sites.some((s) => s.id === c.siteId) : c.siteId === id,
    )
    const campIds = new Set(camps.map((c) => c.id))
    const cands = candidates.filter((c) => campIds.has(c.campaignId))
    const nuevos = cands.filter((c) => c.status === 'nuevo')
    return {
      id,
      name,
      city,
      camps,
      nuevos: nuevos.length,
      stale: nuevos.filter((c) => new Date(c.submittedAt).getTime() < staleCut).length,
      contratados: cands.filter((c) => c.status === 'contratado').length,
      abiertos: camps.filter((c) => c.status === 'activa' || c.status === 'pausada').length,
    }
  }

  const groups = sites.map((s) => groupFor(s.id, s.name, s.city))
  const sinSede = groupFor(null, 'Sin sede', '')
  const allGroups = sinSede.camps.length ? [...groups, sinSede] : groups

  // KPIs globales (todos reales, derivados del store).
  const nuevosTotal = campaigns.reduce((s, c) => s + newCountFor(c.id), 0)
  const contratados = candidates.filter((c) => c.status === 'contratado').length
  const abiertos = campaigns.filter((c) => c.status === 'activa' || c.status === 'pausada').length

  // "Piden atención": candidatos nuevos sin contactar +7 días (por puesto) y puestos
  // pausados. Datos reales y accionables, sin urgencia inventada.
  const atencion: { key: string; to: string; title: string; reason: string; kind: 'stale' | 'pause' }[] = []
  for (const c of campaigns) {
    const cands = candidates.filter((x) => x.campaignId === c.id)
    const staleN = cands.filter((x) => x.status === 'nuevo' && new Date(x.submittedAt).getTime() < staleCut).length
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

  const openSedes = () => setFocusSedes((n) => n + 1)

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vista general</h1>
          <p className="mt-0.5 text-sm text-slate-500">Cómo van todos tus puestos de un vistazo.</p>
        </div>
        {!isEncargado && (
          <button onClick={openSedes} className={`${BTN_SECONDARY} shrink-0 whitespace-nowrap`}>
            <Plus className="size-4 text-slate-400" aria-hidden /> Nueva sede
          </button>
        )}
      </header>

      {campaigns.length === 0 ? (
        <Empty text="Aún no tienes puestos. Crea el primero para ver aquí cómo van tus sedes." />
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

          {sites.length === 0 ? (
            <div className="mt-5">
              <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600">
                {isEncargado ? (
                  'Tus puestos aún no están agrupados por sede.'
                ) : (
                  <>
                    Crea tus sedes para ver cada local por separado.{' '}
                    <button onClick={openSedes} className="font-medium text-indigo-700 hover:text-indigo-800">
                      Crear una sede
                    </button>
                    . Mientras, este es el total.
                  </>
                )}
              </div>
              <SedeCard group={{ ...sinSede, name: 'Todos tus puestos' }} base={base} newCountFor={newCountFor} />
            </div>
          ) : (
            <section className="mt-6">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Por sede</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {allGroups.map((g) => (
                  <SedeCard key={g.id ?? '__none__'} group={g} base={base} newCountFor={newCountFor} />
                ))}
              </div>
            </section>
          )}

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
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                            a.kind === 'stale' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
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

      {!isEncargado && <SedesManager focusSignal={focusSedes} />}
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
        <p className="text-[12px] text-slate-400 tabular-nums">{total} en total</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-40 w-full sm:h-44" preserveAspectRatio="none" role="img" aria-label={`Candidatos recibidos por semana, ${total} en total`}>
        <path d={area} fill="#4F46E5" fillOpacity="0.1" />
        <path d={line} fill="none" stroke="#4F46E5" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill="#4F46E5" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
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
        {right && <span className="text-[13px] tabular-nums text-slate-400">{right}</span>}
      </div>
      {children}
    </div>
  )
}

type Group = {
  id: string | null
  name: string
  city: string
  camps: Campaign[]
  nuevos: number
  stale: number
  contratados: number
  abiertos: number
}

function SedeCard({ group, base, newCountFor }: { group: Group; base: string; newCountFor: (id: string) => number }) {
  const sub = [group.city, `${group.abiertos} ${group.abiertos === 1 ? 'puesto abierto' : 'puestos abiertos'}`]
    .filter(Boolean)
    .join(', ')
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{group.name}</h3>
          <p className="text-[13px] text-slate-500">{sub}</p>
        </div>
      </div>

      {/* Móvil: lista vertical, las etiquetas tienen ancho y no se parten en 3 líneas */}
      <div className="mt-4 space-y-1.5 sm:hidden">
        <StatRow n={group.nuevos} label="Nuevos sin revisar" />
        <StatRow n={group.stale} label={`Sin contactar +${STALE_DAYS} días`} />
        <StatRow n={group.contratados} label="Contratados" />
      </div>
      {/* sm+: tres columnas (caben de sobra) */}
      <div className="mt-4 hidden grid-cols-3 gap-2.5 sm:grid">
        <Stat n={group.nuevos} label="Nuevos sin revisar" />
        <Stat n={group.stale} label={`Sin contactar +${STALE_DAYS}d`} />
        <Stat n={group.contratados} label="Contratados" />
      </div>

      {group.camps.length > 0 && (
        <>
          {/* Móvil: filas a ancho completo, aprovechan el espacio y se leen mejor */}
          <div className="mt-4 space-y-1 sm:hidden">
            {group.camps.map((c) => {
              const n = newCountFor(c.id)
              return (
                <Link
                  key={c.id}
                  to={`${base}/puestos/${c.id}${n > 0 ? '?estado=nuevo' : ''}`}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 transition-colors active:bg-slate-100"
                >
                  <Briefcase className="size-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{c.title}</span>
                  {n > 0 && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 text-[11px] font-bold tabular-nums text-indigo-700">{n}</span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
                </Link>
              )
            })}
          </div>
          {/* sm+: pills */}
          <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex">
            {group.camps.map((c) => {
              const n = newCountFor(c.id)
              return (
                <Link
                  key={c.id}
                  to={`${base}/puestos/${c.id}${n > 0 ? '?estado=nuevo' : ''}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-2 pr-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <Briefcase className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                  <span className="max-w-[160px] truncate">{c.title}</span>
                  {n > 0 && (
                    <span className="rounded-full bg-indigo-100 px-1.5 text-[11px] font-bold tabular-nums text-indigo-700">{n}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{n}</p>
      <p className="mt-0.5 text-[12px] leading-tight text-slate-500">{label}</p>
    </div>
  )
}

// Versión móvil: número y etiqueta en una fila, así la etiqueta dispone de todo
// el ancho y no se rompe en varias líneas como en la rejilla de tres columnas.
function StatRow({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3.5 py-2">
      <span className="w-9 shrink-0 text-2xl font-semibold tabular-nums text-slate-900">{n}</span>
      <span className="text-[13px] text-slate-600">{label}</span>
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

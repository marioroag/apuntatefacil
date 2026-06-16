import { Link } from 'react-router-dom'
import { Briefcase, Building2, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import type { Campaign } from '../lib/types'

const STALE_DAYS = 7

// Vista general (Multi): cómo va cada sede de un vistazo. Solo métricas REALES
// y accionables (nada de rankings ni notas del encargado). Clic en un puesto
// para entrar a su panel.
export function Resumen() {
  const { campaigns, candidates, sites, newCountFor } = useStore()
  const { company } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'

  if (!demo && !planHas(company?.plan, 'sites'))
    return (
      <FeatureLocked
        feature="sites"
        featureLabel="la Vista general"
        blurb="Compara de un vistazo cómo va cada sede: nuevos, antiguos sin revisar y contratados."
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

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Todas las sedes</h1>
        <p className="mt-0.5 text-sm text-slate-500">Cómo va cada local de un vistazo. Toca un puesto para entrar.</p>
      </header>

      {campaigns.length === 0 ? (
        <Empty text="Aún no tienes puestos. Crea el primero para ver aquí cómo van tus sedes." />
      ) : sites.length === 0 ? (
        <>
          <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600">
            Crea tus sedes en{' '}
            <Link to={`${base}/sedes`} className="font-medium text-indigo-700 hover:text-indigo-800">Sedes</Link>{' '}
            para ver cada local por separado. Mientras, este es el total.
          </div>
          <SedeCard group={{ ...sinSede, name: 'Todos tus puestos' }} base={base} newCountFor={newCountFor} />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {allGroups.map((g) => (
            <SedeCard key={g.id ?? '__none__'} group={g} base={base} newCountFor={newCountFor} />
          ))}
        </div>
      )}
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
          <h2 className="truncate font-semibold text-slate-900">{group.name}</h2>
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

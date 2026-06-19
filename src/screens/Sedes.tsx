import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, Check, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAppBase } from '../lib/useAppBase'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import type { Campaign, Site } from '../lib/types'

const STALE_DAYS = 7

// Sedes (Multi): crear, ver y gestionar cada local. Arriba el creador; debajo una
// tarjeta expandida por sede con su info (nuevos, sin contactar +7 días, contratados
// y sus puestos) y, para owner/member, editar y eliminar. El encargado la ve en
// solo lectura (sus sedes, acotadas por RLS): ni creador ni editar/borrar.
export function Sedes() {
  const { sites, campaigns, candidates, newCountFor, createSite, renameSite, deleteSite } = useStore()
  const { company, role } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'
  const isEncargado = role === 'encargado'
  const canManage = !isEncargado
  const toast = useToast()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Site | null>(null)

  if (!demo && !planHas(company?.plan, 'sites'))
    return (
      <FeatureLocked
        feature="sites"
        featureLabel="las Sedes"
        blurb="Agrupa tus puestos por local y míralo todo de un vistazo: nuevos, sin contactar y contratados por sede."
      />
    )

  const staleCut = Date.now() - STALE_DAYS * 86400000
  const count = (id: string) => campaigns.filter((c) => c.siteId === id).length

  const groupFor = (id: string | null, gName: string, gCity: string): Group => {
    const camps = campaigns.filter((c) =>
      id === null ? !c.siteId || !sites.some((s) => s.id === c.siteId) : c.siteId === id,
    )
    const campIds = new Set(camps.map((c) => c.id))
    const cands = candidates.filter((c) => campIds.has(c.campaignId))
    const nuevos = cands.filter((c) => c.status === 'nuevo')
    return {
      id,
      name: gName,
      city: gCity,
      camps,
      nuevos: nuevos.length,
      stale: nuevos.filter((c) => new Date(c.submittedAt).getTime() < staleCut).length,
      contratados: cands.filter((c) => c.status === 'contratado').length,
      abiertos: camps.filter((c) => c.status === 'activa' || c.status === 'pausada').length,
    }
  }

  const groups = sites.map((s) => groupFor(s.id, s.name, s.city))
  const sinSede = groupFor(null, 'Sin sede', '')

  const add = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await createSite({ name: name.trim(), city: city.trim() })
    setBusy(false)
    if (ok) {
      setName('')
      setCity('')
      toast.success('Sede creada')
    }
  }

  const hasContent = groups.length > 0 || sinSede.camps.length > 0

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Sedes</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Agrupa tus puestos por local. Cada puesto puede pertenecer a una sede y el menú lateral se ordena por sede.
        </p>
      </header>

      {/* Creador */}
      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-slate-800">Nueva sede</p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              aria-label="Nombre de la sede"
              placeholder="Nombre, ej: Valencia centro"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              aria-label="Ciudad de la sede (opcional)"
              placeholder="Ciudad (opcional)"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
            />
            <button onClick={add} disabled={busy || !name.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>
              <Plus className="size-4" aria-hidden /> Añadir
            </button>
          </div>
        </div>
      )}

      {/* Tarjetas expandidas por sede */}
      {!hasContent ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <Building2 className="size-6" aria-hidden />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {canManage ? 'Aún no tienes sedes. Crea la primera arriba.' : 'Aún no hay sedes.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <SedeCard
              key={g.id ?? '__none__'}
              group={g}
              base={base}
              newCountFor={newCountFor}
              canManage={canManage}
              editing={editing === g.id}
              onEdit={() => setEditing(g.id)}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                if (g.id) await renameSite(g.id, patch)
                setEditing(null)
                toast.success('Sede guardada')
              }}
              onDelete={() => g.id && setToDelete({ id: g.id, name: g.name, city: g.city })}
            />
          ))}
          {sinSede.camps.length > 0 && (
            <SedeCard group={sinSede} base={base} newCountFor={newCountFor} canManage={false} editing={false} onEdit={() => {}} onCancel={() => {}} onSave={() => {}} onDelete={() => {}} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          await deleteSite(toDelete.id)
          toast.success('Sede eliminada')
          setToDelete(null)
        }}
        title="Eliminar sede"
        confirmLabel="Eliminar sede"
        confirmVariant="danger"
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Vas a eliminar <strong className="font-semibold text-slate-900">{toDelete?.name}</strong>.{' '}
          {(() => {
            const n = toDelete ? count(toDelete.id) : 0
            if (n === 0) return 'No tiene puestos asignados, así que no afecta a ninguno.'
            if (n === 1) return 'Su puesto no se borra: queda sin sede y puedes reasignarlo cuando quieras.'
            return `Sus ${n} puestos no se borran: quedan sin sede y puedes reasignarlos cuando quieras.`
          })()}
        </p>
      </ConfirmDialog>
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

function SedeCard({
  group,
  base,
  newCountFor,
  canManage,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  group: Group
  base: string
  newCountFor: (id: string) => number
  canManage: boolean
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (patch: { name: string; city: string }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(group.name)
  const [city, setCity] = useState(group.city)
  useEffect(() => {
    if (editing) {
      setName(group.name)
      setCity(group.city)
    }
  }, [editing, group])

  const sub = [group.city, `${group.abiertos} ${group.abiertos === 1 ? 'puesto abierto' : 'puestos abiertos'}`]
    .filter(Boolean)
    .join(', ')
  const manageable = canManage && group.id !== null

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      {editing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-label="Nombre de la sede"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="Ciudad de la sede (opcional)"
            placeholder="Ciudad (opcional)"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => name.trim() && onSave({ name: name.trim(), city: city.trim() })}
              disabled={!name.trim()}
              className={`${BTN_PRIMARY} disabled:opacity-50`}
            >
              <Check className="size-4" aria-hidden /> Guardar
            </button>
            <button onClick={onCancel} aria-label="Cancelar" className={BTN_SECONDARY}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-slate-900">{group.name}</h2>
            <p className="text-[13px] text-slate-500">{sub}</p>
          </div>
          {manageable && (
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onEdit} aria-label={`Editar ${group.name}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 pointer-coarse:size-11">
                <Pencil className="size-4" aria-hidden />
              </button>
              <button onClick={onDelete} aria-label={`Eliminar ${group.name}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 pointer-coarse:size-11">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Móvil: lista vertical, las etiquetas tienen ancho y no se parten en 3 líneas */}
      <div className="mt-4 space-y-1.5 sm:hidden">
        <StatRow n={group.nuevos} label="Nuevos sin revisar" />
        <StatRow n={group.stale} label={`Sin contactar +${STALE_DAYS} días`} />
        <StatRow n={group.contratados} label="Contratados" />
      </div>
      {/* sm+: tres columnas */}
      <div className="mt-4 hidden grid-cols-3 gap-2.5 sm:grid">
        <Stat n={group.nuevos} label="Nuevos sin revisar" />
        <Stat n={group.stale} label={`Sin contactar +${STALE_DAYS}d`} />
        <Stat n={group.contratados} label="Contratados" />
      </div>

      {group.camps.length > 0 && (
        <>
          {/* Móvil: filas a ancho completo */}
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

function StatRow({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3.5 py-2">
      <span className="w-9 shrink-0 text-2xl font-semibold tabular-nums text-slate-900">{n}</span>
      <span className="text-[13px] text-slate-600">{label}</span>
    </div>
  )
}

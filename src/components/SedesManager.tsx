import { useEffect, useRef, useState } from 'react'
import { Building2, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import type { Site } from '../lib/types'

// Gestión de sedes incrustada al pie de la Vista general (antes pantalla /sedes).
// Crear, renombrar y eliminar. Eliminar una sede deja sus puestos "sin sede",
// no los borra. El gating por plan y por rol (solo owner/member, nunca encargado)
// lo decide quien la renderiza (Resumen): aquí se asume permitido.
// focusSignal: al incrementarse (botón "Nueva sede" o deep-link ?sedes=1) la
// sección se desplaza a la vista y enfoca el campo de nombre.
export function SedesManager({ focusSignal = 0 }: { focusSignal?: number }) {
  const { sites, campaigns, createSite, renameSite, deleteSite } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Site | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusSignal > 0) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nameRef.current?.focus({ preventScroll: true })
    }
  }, [focusSignal])

  const count = (id: string) => campaigns.filter((c) => c.siteId === id).length

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

  return (
    <section ref={sectionRef} id="gestionar-sedes" className="mt-8 scroll-mt-6">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Gestionar sedes</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Agrupa tus puestos por local. Cada puesto puede pertenecer a una sede y el menú lateral se ordena por sede.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="text-sm font-semibold text-slate-800">Nueva sede</p>
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Nombre, ej: Valencia centro"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ciudad (opcional)"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
          />
          <button
            onClick={add}
            disabled={busy || !name.trim()}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            <Plus className="size-4" aria-hidden /> Añadir
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {sites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Building2 className="size-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm text-slate-500">Aún no tienes sedes. Crea la primera arriba.</p>
          </div>
        ) : (
          sites.map((s) => (
            <SiteRowItem
              key={s.id}
              site={s}
              count={count(s.id)}
              editing={editing === s.id}
              onEdit={() => setEditing(s.id)}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                await renameSite(s.id, patch)
                setEditing(null)
                toast.success('Sede guardada')
              }}
              onDelete={() => setToDelete(s)}
            />
          ))
        )}
      </div>

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
    </section>
  )
}

function SiteRowItem({
  site,
  count,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  site: Site
  count: number
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (patch: { name: string; city: string }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(site.name)
  const [city, setCity] = useState(site.city)
  useEffect(() => {
    if (editing) {
      setName(site.name)
      setCity(site.city)
    }
  }, [editing, site])

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-white p-3 shadow-card sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-auto sm:flex-1"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
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
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Building2 className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{site.name}</p>
        <p className="text-[13px] text-slate-500">
          {[site.city, `${count} ${count === 1 ? 'puesto' : 'puestos'}`].filter(Boolean).join(', ')}
        </p>
      </div>
      <button onClick={onEdit} aria-label={`Editar ${site.name}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <Pencil className="size-4" aria-hidden />
      </button>
      <button onClick={onDelete} aria-label={`Eliminar ${site.name}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  )
}

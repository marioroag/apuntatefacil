import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ImagePlus, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { FeatureLocked } from '../components/FeatureLocked'
import { useAppBase } from '../lib/useAppBase'
import { supabase } from '../lib/supabase'
import { planHas, PLAN_BRAND_LIMIT } from '../lib/pricing'
import { SWATCHES, accentPassesWhite, isValidHex, normalizeHex, readableOn } from '../lib/colors'
import { brandAssetUrl } from '../lib/brandAsset'
import { defaultBranding } from '../lib/defaults'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import type { Brand } from '../lib/types'

type BrandValues = Omit<Brand, 'id'>
const MAX_IMG = 2 * 1024 * 1024 // 2 MB

function emptyBrand(accent = '#4f46e5'): BrandValues {
  const d = defaultBranding(accent)
  return { name: '', accent, welcome: d.welcome, thanks: d.thanks, showLogo: true, logoPath: null, bannerPath: null }
}

// Gestión de marcas (Multi): identidad reutilizable que se aplica a los puestos.
// Eliminar una marca no cambia la apariencia de sus puestos (ya la tienen copiada).
export function Marcas() {
  const { brands, campaigns, createBrand, updateBrand, deleteBrand } = useStore()
  const { company } = useAuth()
  const toast = useToast()
  const base = useAppBase()
  const navigate = useNavigate()
  const demo = base === '/demo'
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Brand | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (!demo && !planHas(company?.plan, 'brands')) return <FeatureLocked feature="brands" />

  // Tope de marcas del plan (Pro: 1, Multi: ilimitadas). En la demo no hay tope.
  const limit = demo ? Infinity : PLAN_BRAND_LIMIT[company?.plan ?? 'trial'] ?? 0
  const atLimit = brands.length >= limit

  const count = (id: string) => campaigns.filter((c) => c.brandId === id).length

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Marcas</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Una identidad reutilizable: nombre, color y textos. Al asignar una marca a un puesto, su apariencia se aplica al formulario. Cada puesto puede ajustarla luego.
        </p>
      </header>

      {creating ? (
        <BrandEditor
          initial={emptyBrand(company?.accent)}
          submitLabel="Crear marca"
          onCancel={() => setCreating(false)}
          onSave={async (vals) => {
            const ok = await createBrand(vals)
            if (ok) {
              setCreating(false)
              toast.success('Marca creada')
            }
          }}
        />
      ) : (
        <button
          onClick={() => (atLimit ? setShowUpgrade(true) : setCreating(true))}
          className={BTN_PRIMARY}
        >
          <Plus className="size-4" aria-hidden /> Nueva marca
        </button>
      )}

      <div className="mt-4 space-y-2">
        {brands.length === 0 && !creating ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Tag className="size-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm text-slate-500">Aún no tienes marcas. Crea la primera arriba.</p>
          </div>
        ) : (
          brands.map((b) =>
            editing === b.id ? (
              <BrandEditor
                key={b.id}
                initial={b}
                submitLabel="Guardar"
                onCancel={() => setEditing(null)}
                onSave={async (vals) => {
                  await updateBrand(b.id, vals)
                  setEditing(null)
                  toast.success('Marca guardada')
                }}
              />
            ) : (
              <BrandCard key={b.id} brand={b} count={count(b.id)} onEdit={() => setEditing(b.id)} onDelete={() => setToDelete(b)} />
            ),
          )
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          await deleteBrand(toDelete.id)
          toast.success('Marca eliminada')
          setToDelete(null)
        }}
        title="Eliminar marca"
        confirmLabel="Eliminar marca"
        confirmVariant="danger"
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Vas a eliminar <strong className="font-semibold text-slate-900">{toDelete?.name}</strong>. Los puestos que la
          usaban conservan su apariencia: solo dejan de estar vinculados a la marca.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onConfirm={() => {
          setShowUpgrade(false)
          navigate(`${base}/plan`)
        }}
        title="Has llegado al límite de marcas"
        confirmLabel="Ver planes"
        cancelLabel="Ahora no"
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Tu plan <strong className="font-semibold text-slate-900">Pro</strong> incluye una marca. Sube a{' '}
          <strong className="font-semibold text-slate-900">Multi</strong> para crear marcas ilimitadas y aplicar una
          identidad distinta a cada formulario.
        </p>
      </ConfirmDialog>
    </div>
  )
}

function BrandCard({ brand, count, onEdit, onDelete }: { brand: Brand; count: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
      {brandAssetUrl(brand.logoPath) ? (
        <img src={brandAssetUrl(brand.logoPath)!} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg text-[13px] font-bold" style={{ backgroundColor: brand.accent, color: readableOn(brand.accent) }}>
          {brand.name.slice(0, 2).toUpperCase() || 'M'}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{brand.name}</p>
        <p className="text-[13px] text-slate-500">{count} {count === 1 ? 'puesto' : 'puestos'}</p>
      </div>
      <button onClick={onEdit} aria-label={`Editar ${brand.name}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <Pencil className="size-4" aria-hidden />
      </button>
      <button onClick={onDelete} aria-label={`Eliminar ${brand.name}`} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function BrandEditor({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: BrandValues
  submitLabel: string
  onSave: (vals: BrandValues) => void
  onCancel: () => void
}) {
  const { company } = useAuth()
  const base = useAppBase()
  const demo = base === '/demo'
  const toast = useToast()
  const [name, setName] = useState(initial.name)
  const [accent, setAccent] = useState(initial.accent)
  const [welcome, setWelcome] = useState(initial.welcome)
  const [thanks, setThanks] = useState(initial.thanks)
  const [showLogo, setShowLogo] = useState(initial.showLogo)
  const [logoPath, setLogoPath] = useState(initial.logoPath)
  const [bannerPath, setBannerPath] = useState(initial.bannerPath)
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null)

  const passes = accentPassesWhite(accent)
  const canSave = name.trim().length > 0 && isValidHex(accent) && !uploading
  const submit = () =>
    canSave && onSave({ name: name.trim(), accent: normalizeHex(accent), welcome, thanks, showLogo, logoPath, bannerPath })

  const upload = async (file: File, kind: 'logo' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Sube un archivo de imagen.')
      return
    }
    if (file.size > MAX_IMG) {
      toast.error('La imagen es muy grande (máximo 2 MB).')
      return
    }
    const set = kind === 'logo' ? setLogoPath : setBannerPath
    setUploading(kind)
    // En la demo (sin backend) la imagen se guarda como data URL en local.
    if (demo || !company?.id || company.id === 'demo') {
      const reader = new FileReader()
      reader.onload = () => { set(reader.result as string); setUploading(null) }
      reader.onerror = () => { setUploading(null); toast.error('No se pudo leer la imagen.') }
      reader.readAsDataURL(file)
      return
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${company.id}/${kind}-${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: false, contentType: file.type })
    setUploading(null)
    if (error) {
      toast.error('No se pudo subir la imagen.')
      return
    }
    set(path)
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-card">
      <label htmlFor="brandname" className="block text-sm font-semibold text-slate-800">Nombre de la marca</label>
      <input
        id="brandname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        placeholder="ej: La Tagliatella"
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
      />
      <p className="mt-1 text-[12px] text-slate-400">Es lo que ve el candidato en el formulario.</p>

      <p className="mt-4 text-sm font-semibold text-slate-800">Color de la marca</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setAccent(c)}
            aria-label={`Color ${c}`}
            aria-pressed={normalizeHex(accent) === c}
            className={`size-7 rounded-lg ring-2 ring-offset-2 transition-transform hover:scale-110 ${normalizeHex(accent) === c ? 'ring-slate-400' : 'ring-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Picker de color libre (selector nativo del sistema), igual que en el formulario */}
        <label
          className="relative ml-1 inline-flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-300 transition-transform hover:scale-110"
          title="Elegir otro color"
        >
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }}
          />
          <Plus className="relative size-3.5 text-white drop-shadow" aria-hidden />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#4f46e5'}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Elegir un color personalizado"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="inline-flex h-9 items-center rounded-xl px-4 text-sm font-semibold" style={{ backgroundColor: isValidHex(accent) ? accent : '#4f46e5', color: readableOn(isValidHex(accent) ? accent : '#4f46e5') }}>
          Botón de ejemplo
        </span>
        {!passes && <span className="text-[12px] text-slate-500">Ajustamos el texto a tinta para que se lea bien.</span>}
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-800">Imágenes de marca</p>
      <p className="text-[12px] text-slate-400">Se ven en el formulario que rellena el candidato. Máximo 2 MB.</p>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <AssetField label="Foto de perfil" shape="logo" url={brandAssetUrl(logoPath)} busy={uploading === 'logo'} onPick={(f) => upload(f, 'logo')} onRemove={() => setLogoPath(null)} />
        <AssetField label="Banner" shape="banner" url={brandAssetUrl(bannerPath)} busy={uploading === 'banner'} onPick={(f) => upload(f, 'banner')} onRemove={() => setBannerPath(null)} />
      </div>

      <label htmlFor="brandwelcome" className="mt-4 block text-sm font-semibold text-slate-800">Texto de bienvenida</label>
      <textarea
        id="brandwelcome"
        value={welcome}
        onChange={(e) => setWelcome(e.target.value)}
        rows={2}
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
      />

      <label htmlFor="brandthanks" className="mt-4 block text-sm font-semibold text-slate-800">Texto de agradecimiento</label>
      <textarea
        id="brandthanks"
        value={thanks}
        onChange={(e) => setThanks(e.target.value)}
        rows={2}
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
      />

      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        <span className="text-sm text-slate-700">Mostrar el logo en el formulario</span>
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className={BTN_SECONDARY}>
          Cancelar
        </button>
        <button onClick={submit} disabled={!canSave} className={`${BTN_PRIMARY} disabled:opacity-50`}>
          <Check className="size-4" aria-hidden /> {submitLabel}
        </button>
      </div>
    </div>
  )
}

function AssetField({
  label,
  shape,
  url,
  busy,
  onPick,
  onRemove,
}: {
  label: string
  shape: 'logo' | 'banner'
  url: string | null
  busy: boolean
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const box = shape === 'logo' ? 'size-20' : 'h-20 w-44'
  return (
    <div>
      <p className="mb-1 text-[12px] font-medium text-slate-500">{label}</p>
      <div className={`relative ${box} overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50`}>
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={url ? `Cambiar ${label}` : `Subir ${label}`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 transition-colors hover:bg-white/40 hover:text-slate-600"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            !url && (
              <>
                <ImagePlus className="size-5" aria-hidden />
                <span className="text-[11px]">Subir</span>
              </>
            )
          )}
        </button>
        {url && !busy && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${label}`}
            className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-slate-900/60 text-white transition-colors hover:bg-slate-900/80"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

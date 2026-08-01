import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { useAppBase } from '../lib/useAppBase'
import { supabase } from '../lib/supabase'
import { brandAssetUrl } from '../lib/brandAsset'

const MAX_IMG = 2 * 1024 * 1024 // 2 MB

// Foto de perfil y banner de la marca: las dos imágenes que ve el candidato en el
// formulario. Viven en la marca (no en el puesto), así que subirlas una vez las
// pone en todos sus formularios. Único sitio de subida de la app.
export function BrandAssets({
  logoPath,
  bannerPath,
  onChange,
}: {
  logoPath: string | null
  bannerPath: string | null
  onChange: (patch: { logoPath?: string | null; bannerPath?: string | null }) => void
}) {
  const { company } = useAuth()
  const toast = useToast()
  const demo = useAppBase() === '/demo'
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null)

  const upload = async (file: File, kind: 'logo' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Sube un archivo de imagen.')
      return
    }
    if (file.size > MAX_IMG) {
      toast.error('La imagen es muy grande (máximo 2 MB).')
      return
    }
    const key = kind === 'logo' ? 'logoPath' : 'bannerPath'
    setUploading(kind)
    // En la demo (sin backend) la imagen se guarda como data URL en local.
    if (demo || !company?.id || company.id === 'demo') {
      const reader = new FileReader()
      reader.onload = () => {
        onChange({ [key]: reader.result as string })
        setUploading(null)
      }
      reader.onerror = () => {
        setUploading(null)
        toast.error('No se pudo leer la imagen.')
      }
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
    onChange({ [key]: path })
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <AssetField
        label="Foto de perfil"
        shape="logo"
        url={brandAssetUrl(logoPath)}
        busy={uploading === 'logo'}
        onPick={(f) => upload(f, 'logo')}
        onRemove={() => onChange({ logoPath: null })}
      />
      <AssetField
        label="Banner"
        shape="banner"
        url={brandAssetUrl(bannerPath)}
        busy={uploading === 'banner'}
        onPick={(f) => upload(f, 'banner')}
        onRemove={() => onChange({ bannerPath: null })}
      />
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
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500 transition-colors hover:bg-white/40 hover:text-slate-600"
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

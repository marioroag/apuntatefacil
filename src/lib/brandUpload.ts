import { useState } from 'react'
import { useAuth } from './auth'
import { useToast } from '../components/ui/Toast'
import { useAppBase } from './useAppBase'
import { supabase } from './supabase'

const MAX_IMG = 2 * 1024 * 1024 // 2 MB

export type BrandAssetPatch = { logoPath?: string | null; bannerPath?: string | null }

// Sube las dos imágenes que ve el candidato en la cabecera del formulario. Viven
// en la MARCA (no en el puesto), así que subirlas una vez las pone en todos sus
// formularios. Único sitio de subida de imágenes de marca de la app.
//
// La lógica va en un hook y la caja en `AssetBox`, aparte, porque la COMPOSICIÓN
// (banner arriba, foto y nombre debajo) es la del formulario público y la decide
// quien la pinta, no este fichero: así el editor es un espejo de la cabecera real
// en vez de dos cajas de subida sueltas.
export function useBrandAssetUpload(onChange: (patch: BrandAssetPatch) => void) {
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

  return { upload, uploading }
}


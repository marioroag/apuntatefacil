import { supabase } from './supabase'

// Resuelve la URL mostrable de un logo/banner de marca.
// - null/'' -> null (no hay imagen)
// - data:/http(s) -> tal cual (la demo guarda data URLs; el RPC puede dar URL)
// - en otro caso es un path del bucket público 'brand-assets' -> URL pública
export function brandAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('data:') || path.startsWith('http')) return path
  return supabase.storage.from('brand-assets').getPublicUrl(path).data.publicUrl
}

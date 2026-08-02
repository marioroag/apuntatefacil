import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, supabaseConfigured } from './supabase'
import { useAuth } from './auth'
import { personLabel } from './format'

/**
 * Perfil de la PERSONA: nombre y cara. Antes de esto la app no sabía cómo se
 * llama nadie y pintaba el email crudo en el chat de equipo, en las menciones y
 * en la lista de miembros; `personLabel` lo maquillaba a partir del correo
 * ('laura.gil@…' -> 'Laura Gil'), que acierta a veces y falla el resto.
 *
 * Aquí el nombre es el que la persona ha escrito, y `personLabel` pasa a ser el
 * respaldo de quien todavía no lo ha puesto. Un solo sitio decide cómo se llama
 * alguien: `nameFor(userId, email)`.
 *
 * El perfil es de la persona, no de la empresa: en dos equipos eres el mismo.
 */
export interface Profile {
  userId: string
  fullName: string
  avatarPath: string | null
  /** Avisos por correo APAGADOS. Solo se guarda lo que se apaga: una clave que
   *  no está significa que sí se recibe, así una cuenta nueva no necesita fila.
   *  Las claves vivas están en `src/lib/settings.tsx`. */
  emailPrefs: Record<string, boolean>
}

interface ProfilesApi {
  /** Tu perfil. null mientras carga o si aún no tienes fila. */
  me: Profile | null
  loading: boolean
  /** Solo lectura: en la demo pública no se guarda nada. */
  readOnly: boolean
  /** Nombre a mostrar de cualquiera del equipo, con respaldo al email. */
  nameFor: (userId: string | null | undefined, email?: string | null) => string
  /** URL de la foto de alguien del equipo, o null si no tiene. */
  avatarFor: (userId: string | null | undefined) => string | null
  /** ¿Quieres este aviso por correo? Sin guardar nada, se recibe. */
  wantsEmail: (key: string) => boolean
  /** Enciende o apaga un aviso por correo. Optimista, con vuelta atrás. */
  setEmailPref: (key: string, enabled: boolean) => Promise<{ error?: string }>
  saveName: (fullName: string) => Promise<{ error?: string }>
  uploadAvatar: (file: File) => Promise<{ error?: string }>
  removeAvatar: () => Promise<{ error?: string }>
}

const Ctx = createContext<ProfilesApi | null>(null)

/** Path del bucket público 'avatars' -> URL. data:/http(s) pasan tal cual (demo). */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('/')) return path
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/** Límites de la foto. El original se reescala antes de subir, así que el tope
 *  solo frena archivos absurdos antes de decodificarlos en memoria. */
export const AVATAR_MAX_BYTES = 8 * 1024 * 1024
const AVATAR_SIDE = 256
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

/**
 * Recorta al cuadrado por el centro y reescala a 256px. Una foto de móvil son
 * 4 MB y 4000px para pintarse a 28px: subirla entera castiga la subida del
 * usuario y luego cada carga de la barra. Devuelve siempre WebP.
 */
async function squareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIDE
  canvas.height = AVATAR_SIDE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('sin canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('sin blob')
  return blob
}

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const { user, company } = useAuth()
  const demo = company?.id === 'demo'
  const uid = user?.id ?? null
  const [rows, setRows] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  // La empresa activa manda: al cambiar de equipo cambian los compañeros visibles.
  const companyId = company?.id ?? null
  const reqRef = useRef(0)

  const load = useCallback(async () => {
    if (demo) {
      // La demo es la superficie de venta: la barra tiene que leerse como la de
      // un cliente real, no decir "Demo". Los compañeros (Laura, Sergio) ya los
      // resuelve personLabel desde su email de ejemplo.
      setRows(new Map([['demo-user', { userId: 'demo-user', fullName: 'Marta Ruiz', avatarPath: null, emailPrefs: {} }]]))
      setLoading(false)
      return
    }
    if (!supabaseConfigured || !uid) {
      setRows(new Map())
      setLoading(false)
      return
    }
    const req = ++reqRef.current
    const { data } = await supabase.from('profiles').select('user_id, full_name, avatar_path, email_prefs')
    // Descartamos la respuesta de un equipo que ya no es el activo.
    if (req !== reqRef.current) return
    const next = new Map<string, Profile>()
    type Row = { user_id: string; full_name: string; avatar_path: string | null; email_prefs: Record<string, boolean> | null }
    for (const r of (data ?? []) as Row[]) {
      next.set(r.user_id, {
        userId: r.user_id,
        fullName: r.full_name ?? '',
        avatarPath: r.avatar_path,
        emailPrefs: r.email_prefs ?? {},
      })
    }
    setRows(next)
    setLoading(false)
  }, [demo, uid])

  useEffect(() => {
    void load()
  }, [load, companyId])

  const patchMe = useCallback(
    (patch: Partial<Profile>) => {
      if (!uid) return
      setRows((prev) => {
        const next = new Map(prev)
        const current = next.get(uid) ?? { userId: uid, fullName: '', avatarPath: null, emailPrefs: {} }
        next.set(uid, { ...current, ...patch })
        return next
      })
    },
    [uid],
  )

  const upsert = useCallback(
    async (patch: {
      full_name?: string
      avatar_path?: string | null
      email_prefs?: Record<string, boolean>
    }): Promise<{ error?: string }> => {
      if (!uid) return { error: 'Sin sesión.' }
      const current = rows.get(uid)
      const { error } = await supabase.from('profiles').upsert(
        {
          user_id: uid,
          full_name: patch.full_name ?? current?.fullName ?? '',
          avatar_path: patch.avatar_path !== undefined ? patch.avatar_path : (current?.avatarPath ?? null),
          email_prefs: patch.email_prefs ?? current?.emailPrefs ?? {},
        },
        { onConflict: 'user_id' },
      )
      if (error) return { error: 'No hemos podido guardar tu perfil. Inténtalo de nuevo.' }
      return {}
    },
    [uid, rows],
  )

  const api = useMemo<ProfilesApi>(() => {
    const me = uid ? (rows.get(uid) ?? null) : null
    return {
      me,
      loading,
      readOnly: !!demo,
      nameFor: (userId, email) => {
        const real = userId ? rows.get(userId)?.fullName.trim() : ''
        return real || personLabel(email)
      },
      avatarFor: (userId) => (userId ? avatarUrl(rows.get(userId)?.avatarPath) : null),
      wantsEmail: (key) => me?.emailPrefs?.[key] !== false,
      setEmailPref: async (key, enabled) => {
        const previous = me?.emailPrefs ?? {}
        // Solo se persiste lo apagado: encender = quitar la clave, no guardar
        // `true`. Así el valor por defecto puede cambiar algún día sin arrastrar
        // un `true` fosilizado en cada fila.
        const next = { ...previous }
        if (enabled) delete next[key]
        else next[key] = false
        patchMe({ emailPrefs: next })
        // En la demo el interruptor se mueve pero no se guarda: la demo es el
        // producto y un control muerto no enseña nada, pero tampoco hay dónde
        // escribir. Se pierde al recargar, como el resto de la visita.
        if (demo) return {}
        const res = await upsert({ email_prefs: next })
        if (res.error) patchMe({ emailPrefs: previous })
        return res
      },
      saveName: async (fullName) => {
        const clean = fullName.trim().replace(/\s+/g, ' ').slice(0, 80)
        if (demo) return {}
        // Optimista: el nombre aparece en la barra al instante; si falla, se revierte.
        const previous = me?.fullName ?? ''
        patchMe({ fullName: clean })
        const res = await upsert({ full_name: clean })
        if (res.error) patchMe({ fullName: previous })
        return res
      },
      uploadAvatar: async (file) => {
        if (demo) return {}
        if (!uid) return { error: 'Sin sesión.' }
        if (!file.type.startsWith('image/') || (file.type && !ACCEPTED.includes(file.type)))
          return { error: 'Esa foto tiene que ser una imagen JPG, PNG o WebP.' }
        if (file.size > AVATAR_MAX_BYTES) return { error: 'Esa foto pesa demasiado. El máximo son 8 MB.' }
        let blob: Blob
        try {
          blob = await squareWebp(file)
        } catch {
          return { error: 'No hemos podido leer esa imagen. Prueba con otra.' }
        }
        const path = `${uid}/${crypto.randomUUID()}.webp`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, blob, { contentType: 'image/webp', upsert: false })
        if (upErr) return { error: 'No hemos podido subir la foto. Inténtalo de nuevo.' }
        const previous = me?.avatarPath ?? null
        patchMe({ avatarPath: path })
        const res = await upsert({ avatar_path: path })
        if (res.error) {
          patchMe({ avatarPath: previous })
          void supabase.storage.from('avatars').remove([path])
          return res
        }
        // La anterior ya no la referencia nadie: fuera, para no dejar basura.
        if (previous) void supabase.storage.from('avatars').remove([previous])
        return {}
      },
      removeAvatar: async () => {
        if (demo) return {}
        const previous = me?.avatarPath ?? null
        patchMe({ avatarPath: null })
        const res = await upsert({ avatar_path: null })
        if (res.error) {
          patchMe({ avatarPath: previous })
          return res
        }
        if (previous) void supabase.storage.from('avatars').remove([previous])
        return {}
      },
    }
  }, [rows, uid, loading, demo, patchMe, upsert])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/**
 * Fuera del shell de la app (landing, formulario público) no hay perfiles: el
 * hook devuelve un api inerte en vez de reventar, para que un componente
 * compartido (el chat, por ejemplo) se pueda usar en los dos sitios.
 */
const INERT: ProfilesApi = {
  me: null,
  loading: false,
  readOnly: true,
  nameFor: (_userId, email) => personLabel(email),
  avatarFor: () => null,
  wantsEmail: () => true,
  setEmailPref: async () => ({}),
  saveName: async () => ({}),
  uploadAvatar: async () => ({}),
  removeAvatar: async () => ({}),
}

export function useProfiles(): ProfilesApi {
  return useContext(Ctx) ?? INERT
}

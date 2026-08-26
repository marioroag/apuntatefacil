import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Camera, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProfiles } from '../lib/profiles'
import { useToast } from './ui/Toast'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { BTN_SECONDARY_SM, botonClase } from '../lib/buttons'

/**
 * Tu perfil: nombre y foto. Nada más, a propósito.
 *
 * El horario de trabajo y las preferencias de aviso se quedan fuera hasta que
 * existan las notificaciones: sin ellas serían interruptores que no mueven nada,
 * y un ajuste decorativo contradice de plano la honestidad del producto.
 *
 * Por qué el nombre importa: hasta ahora la app enseñaba tu email crudo en el
 * chat de equipo, en las menciones y en la lista de miembros.
 */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const profiles = useProfiles()
  const toast = useToast()
  const reducedMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const email = user?.email ?? ''
  const uid = user?.id ?? null
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El campo se rellena al abrir, no en cada render: si el perfil llega tarde de
  // la red no queremos pisar lo que el usuario ya esté escribiendo.
  useEffect(() => {
    if (!open) return
    setNombre(profiles.me?.fullName ?? '')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const els = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([type="file"])') ?? [],
        )
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        const active = document.activeElement
        if (!panelRef.current?.contains(active)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('input')?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      opener?.focus?.()
    }
  }, [open, onClose])

  const foto = profiles.avatarFor(uid)
  // Mientras escribes, la vista previa usa lo tecleado: las iniciales cambian a
  // la vez que el nombre, que es la única forma de saber cómo vas a aparecer.
  const preview = nombre.trim() || profiles.nameFor(uid, email)

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setSubiendo(true)
    const res = await profiles.uploadAvatar(file)
    setSubiendo(false)
    if (res.error) setError(res.error)
    else toast.success('Foto actualizada')
    if (fileRef.current) fileRef.current.value = ''
  }

  const quitarFoto = async () => {
    setError(null)
    const res = await profiles.removeAvatar()
    if (res.error) setError(res.error)
  }

  const guardar = async () => {
    setError(null)
    setGuardando(true)
    const res = await profiles.saveName(nombre)
    setGuardando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    toast.success('Perfil guardado')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perfil-title"
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            aria-hidden
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className="relative w-full max-w-[440px] rounded-xl bg-white p-6 shadow-pop outline-none"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0, 0, 0.2, 1] }}
          >
            <h2 id="perfil-title" className="text-lg font-semibold text-slate-900">
              Tu perfil
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Así te ve tu equipo en los comentarios y en las menciones.
            </p>

            <div className="mt-5 flex items-center gap-4">
              <div className="relative">
                <Avatar name={preview} seed={email || uid} src={foto} size={64} />
                {subiendo && (
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-slate-900/55" role="status" aria-label="Subiendo la foto">
                    <Loader2 className="size-5 animate-spin text-white" aria-hidden />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendo}
                  className={`${BTN_SECONDARY_SM} disabled:opacity-60`}
                >
                  <Camera className="size-3.5 text-slate-400" aria-hidden />
                  {foto ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {foto && (
                  /* El botón fantasma ya existe en `buttons.ts` (variante `ghost`)
                     y este era uno de sus clones a mano: se había quedado en dos
                     peldaños de la rampa, así que al pulsarlo no pasaba nada. */
                  <button
                    type="button"
                    onClick={quitarFoto}
                    disabled={subiendo}
                    className={botonClase('ghost', 'sm', 'disabled:opacity-60')}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Quitar
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => void pickFile(e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="perfil-nombre" className="block text-[13px] font-medium text-slate-700">
                Tu nombre
              </label>
              <input
                id="perfil-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void guardar() }
                }}
                maxLength={80}
                autoComplete="name"
                placeholder="Nombre y apellidos"
                aria-describedby="perfil-nombre-ayuda"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
              />
              {/* La consecuencia de dejarlo en blanco solo se cuenta mientras está
                  en blanco: con el nombre escrito ya no es cierta. */}
              <p id="perfil-nombre-ayuda" className="mt-1.5 text-[12px] text-slate-500">
                {nombre.trim() ? (
                  'Tu email no cambia y solo lo ve tu equipo.'
                ) : (
                  <>
                    Sin nombre, tu equipo te ve como <span className="font-medium text-slate-600">{email}</span>.
                  </>
                )}
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl filo-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={guardando}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={guardar} loading={guardando}>
                Guardar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

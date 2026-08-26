import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { AccesoLayout, AccesoTitulo, ETIQUETA_ACCESO, campoAcceso } from '../components/AccesoLayout'
import { InfoTooltip } from '../components/ui/Tooltip'
import { MedidorContrasena } from '../components/MedidorContrasena'
import { PWD_AYUDA, passwordValid } from '../lib/password'
import { BTN_ACCESO } from '../lib/buttons'

type Status = 'checking' | 'ready' | 'invalid'

// Página a la que llega el enlace de "restablecer contraseña". Supabase, con
// detectSessionInUrl, convierte el token de recuperación en una sesión y emite
// el evento PASSWORD_RECOVERY. Como ese parseo puede ocurrir antes de montar,
// comprobamos también getSession(). Sin sesión de recuperación, el enlace no vale.
export function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let settled = false
    const ready = () => { settled = true; setStatus('ready') }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) ready()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) ready()
    })
    const timer = setTimeout(() => { if (!settled) setStatus('invalid') }, 2500)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordValid(password)) {
      setError('La contraseña aún no cumple los requisitos de abajo.')
      return
    }
    if (password !== confirm) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setError(null)
    setBusy(true)
    const res = await updatePassword(password)
    setBusy(false)
    if (res.error) setError(res.error)
    else navigate('/app')
  }

  return (
    <AccesoLayout>
      {status === 'checking' ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Comprobando el enlace...
        </div>
      ) : status === 'invalid' ? (
        <>
          <AccesoTitulo titulo="Este enlace ya no vale" sub="Ha caducado o ya se ha usado. Pide uno nuevo desde la pantalla de acceso." />
          <p className="mt-8 text-center text-sm font-medium text-slate-500">
            <Link to="/login" className="font-semibold text-slate-900 underline-offset-2 hover:underline">
              Volver a entrar
            </Link>
          </p>
        </>
      ) : (
        <>
          <AccesoTitulo titulo="Crea una contraseña nueva" sub="Elige una contraseña y entra a tu cuenta." />

          <form onSubmit={onSubmit} className="mt-10">
            <div className={`${ETIQUETA_ACCESO} flex items-center gap-1.5`}>
              <label htmlFor="new-password">Contraseña nueva</label>
              <InfoTooltip text={PWD_AYUDA} />
            </div>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                placeholder="Crea una contraseña"
                aria-invalid={!!error}
                aria-describedby="new-password-medidor"
                className={`${campoAcceso(!!error)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
              </button>
            </div>

            <MedidorContrasena valor={password} id="new-password-medidor" />

            <label htmlFor="confirm-password" className={`${ETIQUETA_ACCESO} mt-5`}>Repite la contraseña</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null) }}
              placeholder="Repite la contraseña"
              aria-invalid={!!error}
              className={campoAcceso(!!error)}
            />

            {error && <p className="mt-4 text-[13px] font-medium text-red-600">{error}</p>}

            <button type="submit" disabled={busy || !passwordValid(password)} className={`mt-5 ${BTN_ACCESO}`}>
              {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Guardando...</> : 'Guardar y entrar'}
            </button>
          </form>
        </>
      )}
    </AccesoLayout>
  )
}

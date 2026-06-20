import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'
import { PWD_RULES, passwordValid } from '../lib/password'

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

  const inputClass = (invalid: boolean) =>
    `h-11 w-full rounded-xl border bg-white px-3.5 text-base outline-none placeholder:text-slate-500 focus:ring-4 focus:ring-indigo-500/15 ${invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'}`

  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> Volver
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
          <div className="flex items-center gap-2.5">
            <Logo className="size-9" />
            <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND}</span>
          </div>

          {status === 'checking' ? (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Comprobando el enlace...
            </div>
          ) : status === 'invalid' ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-semibold text-slate-900">Este enlace no es válido o ha caducado</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Pide uno nuevo desde la pantalla de acceso.
              </p>
              <Link to="/login" className="mt-3 inline-block text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">
                Volver a entrar
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-5 text-xl font-semibold text-slate-900">Crea una contraseña nueva</h1>
              <p className="mt-1 text-sm text-slate-500">Elige una contraseña y entra a tu cuenta.</p>

              <form onSubmit={onSubmit} className="mt-5">
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-slate-800">Contraseña nueva</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                    placeholder="Crea una contraseña"
                    aria-invalid={!!error}
                    className={`${inputClass(!!error)} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
                  </button>
                </div>

                <ul className="mt-2.5 space-y-1">
                  {PWD_RULES.map((r) => {
                    const ok = r.test(password)
                    return (
                      <li key={r.label} className={`flex items-center gap-2 text-[12px] ${ok ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {ok ? (
                          <Check className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <span className="size-3.5 shrink-0 rounded-full border border-slate-300" aria-hidden />
                        )}
                        {r.label}
                      </li>
                    )
                  })}
                </ul>

                <label htmlFor="confirm-password" className="mb-1.5 mt-4 block text-sm font-semibold text-slate-800">Repite la contraseña</label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                  placeholder="Repite la contraseña"
                  aria-invalid={!!error}
                  className={inputClass(!!error)}
                />

                {error && <p className="mt-3 text-[13px] font-medium text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={busy || !passwordValid(password)}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Guardando...</> : 'Guardar y entrar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

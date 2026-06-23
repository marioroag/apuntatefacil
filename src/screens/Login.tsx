import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { setRememberMe } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { Checkbox } from '../components/ui/Checkbox'
import { PWD_RULES, passwordValid } from '../lib/password'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Solo permite rutas INTERNAS como destino tras login (evita open redirect).
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/app'
  try {
    const u = new URL(next, window.location.origin)
    if (u.origin !== window.location.origin) return '/app'
    return u.pathname + u.search
  } catch {
    return '/app'
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

type Mode = 'signin' | 'signup'
type View = 'form' | 'confirm-sent' | 'reset-request' | 'reset-sent'

const inputClass = (invalid: boolean) =>
  `h-11 w-full rounded-xl border bg-white px-3.5 text-base outline-none placeholder:text-slate-500 focus:ring-4 focus:ring-indigo-500/15 ${invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'}`

export function Login() {
  const { signInWithGoogle, signUpWithPassword, signInWithPassword, sendPasswordReset, resendConfirmation, session, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Destino tras entrar: por defecto /app; respeta ?next= solo si es una ruta
  // INTERNA (evita open redirect: rechaza //, /\ y orígenes externos).
  const dest = safeNext(params.get('next'))

  const [mode, setMode] = useState<Mode>('signin')
  const [view, setView] = useState<View>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [accepted, setAccepted] = useState(false) // términos + privacidad (obligatorio solo en el alta)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setUnconfirmed(false)
  }
  const backToForm = () => {
    setView('form')
    setError(null)
    setNote(null)
    setUnconfirmed(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Escribe un email válido, por ejemplo nombre@dominio.com')
      return
    }
    if (mode === 'signup' && !passwordValid(password)) {
      setError('La contraseña aún no cumple los requisitos de abajo.')
      return
    }
    if (mode === 'signin' && password.length === 0) {
      setError('Escribe tu contraseña.')
      return
    }
    if (mode === 'signup' && !accepted) {
      setError('Marca la casilla para aceptar los términos y la política de privacidad.')
      return
    }
    setError(null)
    setUnconfirmed(false)
    setRememberMe(remember)
    setBusy(true)
    if (mode === 'signup') {
      const res = await signUpWithPassword(email, password)
      setBusy(false)
      if (res.error) setError(res.error)
      else if (res.needsConfirmation) setView('confirm-sent')
      else navigate(dest)
    } else {
      const res = await signInWithPassword(email, password)
      setBusy(false)
      if (res.error) {
        setError(res.error)
        if (res.error.includes('confirmar tu email')) setUnconfirmed(true)
      } else {
        navigate(dest)
      }
    }
  }

  const onResend = async () => {
    setBusy(true)
    const res = await resendConfirmation(email)
    setBusy(false)
    setNote(res.error ? res.error : 'Te hemos reenviado el email.')
  }

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Escribe un email válido, por ejemplo nombre@dominio.com')
      return
    }
    setError(null)
    setBusy(true)
    const res = await sendPasswordReset(email)
    setBusy(false)
    if (res.error) setError(res.error)
    else setView('reset-sent')
  }

  // Si ya hay sesión, no enseñamos el login: directo al panel (o al ?next= seguro).
  if (!loading && session) return <Navigate to={dest} replace />

  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> Volver
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
          <div className="flex items-center gap-2.5">
            <Logo className="size-9" />
            <span className="text-xl brand-wordmark text-slate-900" aria-hidden>apuntatefacil</span>
          </div>

          {view === 'confirm-sent' ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <Mail className="mx-auto size-6 text-slate-500" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-slate-900">Te hemos enviado un email para confirmar tu cuenta</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Lo enviamos a <strong>{email}</strong>. Ábrelo y pulsa el enlace para activar tu cuenta y entrar.
              </p>
              {note && <p className="mt-2 text-[12px] font-medium text-slate-600">{note}</p>}
              <div className="mt-3 flex flex-col gap-1.5">
                <button onClick={onResend} disabled={busy} className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-60">
                  Reenviar email
                </button>
                <button onClick={backToForm} className="text-[13px] font-medium text-slate-500 hover:text-slate-800">
                  Usar otro email
                </button>
              </div>
            </div>
          ) : view === 'reset-sent' ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <Mail className="mx-auto size-6 text-slate-500" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-slate-900">Revisa tu email</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Si existe una cuenta con <strong>{email}</strong>, te hemos enviado un enlace para crear una contraseña nueva.
              </p>
              <button onClick={backToForm} className="mt-3 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">
                Volver a entrar
              </button>
            </div>
          ) : view === 'reset-request' ? (
            <>
              <h1 className="mt-5 text-xl font-semibold text-slate-900">Restablecer contraseña</h1>
              <p className="mt-1 text-sm text-slate-500">Te enviamos un enlace para crear una contraseña nueva.</p>
              <form onSubmit={onReset} className="mt-5">
                <label htmlFor="reset-email" className="mb-1.5 block text-sm font-semibold text-slate-800">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  placeholder="nombre@tuempresa.com"
                  aria-invalid={!!error}
                  className={inputClass(!!error)}
                />
                {error && <p className="mt-1.5 text-[13px] font-medium text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white ring-1 ring-inset ring-indigo-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(18,22,34,0.24)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-indigo-700 active:translate-y-px disabled:opacity-70">
                  {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Enviando...</> : 'Enviar enlace'}
                </button>
              </form>
              <button onClick={backToForm} className="mt-4 block w-full text-center text-[13px] font-medium text-slate-500 hover:text-slate-800">
                Volver
              </button>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-xl font-semibold text-slate-900">
                {mode === 'signin' ? 'Entra en tu cuenta' : 'Crea tu cuenta'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">Gestiona tus puestos y candidatos.</p>

              <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  aria-pressed={mode === 'signin'}
                  className={`rounded-lg py-2 text-sm font-semibold transition-colors ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  aria-pressed={mode === 'signup'}
                  className={`rounded-lg py-2 text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Crear cuenta
                </button>
              </div>

              <button
                onClick={() => { setRememberMe(remember); signInWithGoogle() }}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(18,22,34,0.06)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-slate-50 active:translate-y-px"
              >
                <GoogleIcon /> Continuar con Google
              </button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[12px] font-medium text-slate-500">o con tu email</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={onSubmit}>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-800">Email</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  placeholder="nombre@tuempresa.com"
                  aria-invalid={!!error}
                  className={inputClass(!!error)}
                />

                <label htmlFor="password" className="mb-1.5 mt-4 block text-sm font-semibold text-slate-800">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                    placeholder={mode === 'signup' ? 'Crea una contraseña' : 'Tu contraseña'}
                    aria-invalid={!!error}
                    className={`${inputClass(!!error)} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
                  </button>
                </div>

                {mode === 'signup' && (
                  <ul className="mt-2.5 space-y-1">
                    {PWD_RULES.map((r) => {
                      const ok = r.test(password)
                      return (
                        <li key={r.label} className={`flex items-center gap-2 text-[12px] ${ok ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
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
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600">
                    <Checkbox
                      checked={remember}
                      onChange={(e) => { setRemember(e.target.checked); setRememberMe(e.target.checked) }}
                    />
                    Recordarme
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setView('reset-request'); setError(null) }}
                      className="text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>

                {mode === 'signup' && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
                    <Checkbox checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setError(null) }} className="mt-px" />
                    <span>
                      Acepto los{' '}
                      <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700">términos</Link>
                      {' '}y la{' '}
                      <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700">política de privacidad</Link>.
                    </span>
                  </label>
                )}

                {error && <p className="mt-3 text-[13px] font-medium text-red-600">{error}</p>}
                {unconfirmed && (
                  <button type="button" onClick={onResend} disabled={busy} className="mt-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-60">
                    Reenviar email de confirmación
                  </button>
                )}
                {note && <p className="mt-1.5 text-[12px] font-medium text-indigo-700">{note}</p>}

                <button
                  type="submit"
                  disabled={busy || (mode === 'signup' && !passwordValid(password))}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white ring-1 ring-inset ring-indigo-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(18,22,34,0.24)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-indigo-700 active:translate-y-px disabled:opacity-60"
                >
                  {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> {mode === 'signin' ? 'Entrando...' : 'Creando cuenta...'}</> : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
                </button>
              </form>

              <p className="mt-4 text-center text-[12px] leading-relaxed text-slate-500">
                Tu contraseña se guarda cifrada, nunca la vemos en claro.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'

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

export function Login() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Escribe un email válido, por ejemplo nombre@dominio.com')
      return
    }
    setError(null)
    setSending(true)
    const res = await signInWithEmail(email)
    setSending(false)
    if (res.error) setError('No pudimos enviar el enlace. Inténtalo de nuevo.')
    else setSent(true)
  }

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
          <h1 className="mt-5 text-xl font-semibold text-slate-900">Entra o crea tu cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">Gestiona tus puestos y candidatos.</p>

          {sent ? (
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center">
              <Mail className="mx-auto size-6 text-indigo-600" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-slate-900">Revisa tu email</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Te hemos enviado un enlace de acceso a <strong>{email}</strong>. Ábrelo para entrar.
              </p>
              <button onClick={() => setSent(false)} className="mt-3 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">
                Usar otro email
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => signInWithGoogle()}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:scale-[0.99]"
              >
                <GoogleIcon /> Continuar con Google
              </button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[12px] font-medium text-slate-400">o con tu email</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={onEmail}>
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
                  className={`h-11 w-full rounded-xl border bg-white px-3.5 text-base outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-500/15 ${error ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'}`}
                />
                {error && <p className="mt-1.5 text-[13px] font-medium text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-70"
                >
                  {sending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Enviando...</> : 'Enviar enlace de acceso'}
                </button>
              </form>
              <p className="mt-4 text-center text-[12px] leading-relaxed text-slate-400">
                Sin contraseñas: te enviamos un enlace para entrar. Al continuar aceptas nuestras condiciones.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

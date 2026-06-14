import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'

export function Onboarding() {
  const { createCompany, signOut, user } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Escribe el nombre de tu empresa')
      return
    }
    setError(null)
    setBusy(true)
    const res = await createCompany(name.trim())
    setBusy(false)
    if (res.error) setError('No pudimos crear la empresa. Inténtalo de nuevo.')
    // si va bien, AuthGate detecta la empresa y entra al panel
  }

  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
          <div className="flex items-center gap-2.5">
            <Logo className="size-9" />
            <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND}</span>
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900">¿Cómo se llama tu empresa?</h1>
          <p className="mt-1 text-sm text-slate-500">
            Es lo que verán tus candidatos en el formulario. Podrás cambiarlo luego.
          </p>

          <form onSubmit={submit} className="mt-6">
            <label htmlFor="company" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Nombre de la empresa
            </label>
            <input
              id="company"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder="Bar Pepe, Construcciones García..."
              autoFocus
              aria-invalid={!!error}
              className={`h-11 w-full rounded-xl border bg-white px-3.5 text-base outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-500/15 ${error ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'}`}
            />
            {error && <p className="mt-1.5 text-[13px] font-medium text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-70"
            >
              {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Creando...</> : <>Crear y empezar <ArrowRight className="size-4" aria-hidden /></>}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-slate-400">
          {user?.email} ·{' '}
          <button onClick={() => signOut()} className="font-medium text-slate-500 underline hover:text-slate-700">
            Cerrar sesión
          </button>
        </p>
      </div>
    </div>
  )
}

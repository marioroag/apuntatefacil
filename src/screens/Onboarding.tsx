import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'
import { BTN_PRIMARY } from '../lib/buttons'

type Invite = { id: string; token: string; company_name: string; role: string }

export function Onboarding() {
  const { createCompany, signOut, user, refreshCompany } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null) // null = comprobando
  const [showCreate, setShowCreate] = useState(false)

  // ¿Me han invitado a un equipo? Si sí, ofrecemos unirse en vez de crear empresa.
  useEffect(() => {
    supabase.rpc('my_pending_invitations').then(({ data, error }) => {
      setInvites(error ? [] : ((data as Invite[]) ?? []))
    })
  }, [])

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

  const accept = async (token: string) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('accept_invitation', { p_token: token })
    if (error) {
      setBusy(false)
      setError(error.message || 'No se pudo unir al equipo.')
      return
    }
    await refreshCompany() // AuthGate detecta la empresa y entra al panel (sin muro de pago)
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
          <div className="flex items-center gap-2.5">
            <Logo className="size-9" />
            <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND}</span>
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-[13px] text-slate-400">
          {user?.email},{' '}
          <button onClick={() => signOut()} className="font-medium text-slate-500 underline hover:text-slate-700">
            Cerrar sesión
          </button>
        </p>
      </div>
    </div>
  )

  // Comprobando invitaciones
  if (invites === null) {
    return (
      <Shell>
        <div className="grid place-items-center py-8" role="status" aria-label="Cargando">
          <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
        </div>
      </Shell>
    )
  }

  // Hay invitación pendiente: ofrecer unirse (no crear empresa, no pagar)
  if (invites.length > 0 && !showCreate) {
    return (
      <Shell>
        <div className="mt-5 flex items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Te han invitado a un equipo</h1>
            <p className="text-sm text-slate-500">Únete y empieza a gestionar candidatos.</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{inv.company_name}</p>
                <p className="text-[12px] text-slate-500">{inv.role === 'encargado' ? 'Encargado' : 'Miembro'}</p>
              </div>
              <button
                onClick={() => accept(inv.token)}
                disabled={busy}
                className={`${BTN_PRIMARY} shrink-0 disabled:opacity-70`}
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Unirme
              </button>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-[13px] font-medium text-red-600">{error}</p>}

        <button onClick={() => setShowCreate(true)} className="mt-4 text-[13px] font-medium text-slate-500 underline hover:text-slate-700">
          O crea tu propia empresa
        </button>
      </Shell>
    )
  }

  // Crear empresa (sin invitaciones, o el usuario eligió crear la suya)
  return (
    <Shell>
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
          className={`${BTN_PRIMARY} mt-4 w-full disabled:opacity-70`}
        >
          {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Creando...</> : <>Crear y empezar <ArrowRight className="size-4" aria-hidden /></>}
        </button>
      </form>

      {invites.length > 0 && (
        <button onClick={() => setShowCreate(false)} className="mt-4 text-[13px] font-medium text-slate-500 underline hover:text-slate-700">
          Volver a tu invitación
        </button>
      )}
    </Shell>
  )
}

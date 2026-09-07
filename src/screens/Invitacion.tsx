import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'
import { BRAND } from '../lib/brand'
import { BTN_PRIMARY_BLOCK } from '../lib/buttons'

type Inv = { company_name: string; email: string; status: string }

// Página pública para aceptar una invitación de equipo (/invitacion?token=...).
// Si no hay sesión, manda a /login y vuelve aquí. Exige que el email coincida.
/**
 * EL TOKEN NO SE QUEDA EN LA URL. Llega en `?token=` porque es lo que cabe en
 * un correo, pero en cuanto la página lo lee se guarda en sessionStorage (de
 * esta pestaña, que es la que sigue el flujo de login) y se limpia la URL con
 * `replace`: así no queda en el historial, ni en los logs, ni viaja en el
 * `next=` del login. Si al volver del login no hay token guardado, se pide a
 * `my_pending_invitations`, que resuelve la invitación por el email de la
 * sesión. (Auditoría de seguridad, sep 2026.)
 */
const TOKEN_KEY = 'af.invitacion'

function leerToken(params: URLSearchParams): string {
  const enUrl = params.get('token') ?? ''
  try {
    if (enUrl) window.sessionStorage.setItem(TOKEN_KEY, enUrl)
    return enUrl || (window.sessionStorage.getItem(TOKEN_KEY) ?? '')
  } catch {
    return enUrl
  }
}

export function Invitacion() {
  const [params, setParams] = useSearchParams()
  const [token, setToken] = useState(() => leerToken(params))
  const { loading, session, user, refreshCompany, signOut } = useAuth()
  const navigate = useNavigate()

  // Fuera de la barra de direcciones en cuanto se ha leído.
  useEffect(() => {
    if (params.has('token')) setParams(new URLSearchParams(), { replace: true })
  }, [params, setParams])
  const [inv, setInv] = useState<Inv | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session) {
      setState('ready') // mostramos el CTA de iniciar sesión
      return
    }
    let alive = true
    const leer = async (t: string) => {
      const { data, error } = await supabase.rpc('get_invitation', { p_token: t })
      if (!alive) return
      const d = data as Inv | null
      if (error || !d || !d.company_name || d.status !== 'pending') {
        setState('invalid')
        return
      }
      setInv(d)
      setState('ready')
    }
    if (token) {
      void leer(token)
    } else {
      // Sin token (otra pestaña, o el navegador lo perdió): la invitación
      // pendiente de ESTE correo, si la hay.
      supabase.rpc('my_pending_invitations').then(({ data }) => {
        if (!alive) return
        const lista = (data as { token?: string }[] | null) ?? []
        const t = lista[0]?.token ?? ''
        if (!t) { setState('invalid'); return }
        setToken(t)
        void leer(t)
      })
    }
    return () => {
      alive = false
    }
  }, [loading, session, token])

  const accept = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
    setBusy(false)
    if (error) {
      setError(error.message || 'No se pudo aceptar la invitación.')
      return
    }
    try { window.sessionStorage.removeItem(TOKEN_KEY) } catch { /* sin almacenamiento */ }
    // Entra directo al equipo recién aceptado (lo pone como empresa activa).
    await refreshCompany((data as { company_id?: string } | null)?.company_id)
    navigate('/app')
  }

  // Sin el token: al volver, la página lo recupera de sessionStorage o por el
  // correo de la sesión.
  const loginHref = `/login?next=${encodeURIComponent('/invitacion')}`
  const emailMismatch = !!(inv && user?.email && user.email.toLowerCase() !== inv.email.toLowerCase())

  return (
    <div className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="mb-6 flex items-center gap-2" aria-label={`${BRAND}, ir al inicio`}>
          <Logo className="size-8" />
          <span className="text-[17px] brand-wordmark text-slate-900" aria-hidden>apuntatefacil</span>
        </Link>

        <div className="rounded-2xl filo bg-white p-7 shadow-card">
          {loading || state === 'loading' ? (
            <div className="grid place-items-center py-6" role="status" aria-label="Cargando">
              <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden />
            </div>
          ) : !session ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Te han invitado a un equipo</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Inicia sesión o crea tu cuenta para ver la invitación y unirte.
              </p>
              <Link
                to={loginHref}
                className={`mt-5 ${BTN_PRIMARY_BLOCK}`}
              >
                Iniciar sesión para continuar
              </Link>
            </>
          ) : state === 'invalid' ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Invitación no válida</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Este enlace no es válido o la invitación ya se usó o se canceló. Pídele a quien te invitó que te mande uno nuevo.
              </p>
              <Link to="/app" className="mt-5 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                Ir a mi panel
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Únete a {inv?.company_name}</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Te han invitado a gestionar candidatos con este equipo en {BRAND}.
              </p>

              {emailMismatch ? (
                <div className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800">
                  Esta invitación es para <strong>{inv?.email}</strong>, pero has entrado como <strong>{user?.email}</strong>.
                  Cierra sesión y entra con el correo correcto.
                  <button onClick={() => signOut()} className="mt-2 block font-semibold underline underline-offset-2">
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <button
                  onClick={accept}
                  disabled={busy}
                  className={`mt-5 ${BTN_PRIMARY_BLOCK}`}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                  Unirme al equipo
                </button>
              )}

              {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

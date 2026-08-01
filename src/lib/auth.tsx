import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Company {
  id: string
  name: string
  accent: string
  plan: 'trial' | 'esencial' | 'pro' | 'multi'
  subscription_status: string | null
  billing_interval: string | null // 'month' | 'year' | null (sin suscripción)
  cancel_at_period_end: boolean // suscripción marcada para cancelarse al final del periodo
  onboarding_done_at: string | null // null = guía de primer uso activa (el progreso se deriva de los datos)
  downgrade_reconcile_at: string | null // no null = bajaste de plan y debes elegir qué puestos mantener activos
  meridian_auto: boolean // analizar cada candidatura nueva al entrar (ajustes)
}

/**
 * Ajustes de la EMPRESA que se tocan desde /app/ajustes. El tipo es cerrado a
 * propósito: `companies` tiene el UPDATE acotado por columnas desde el
 * endurecimiento de facturación, así que añadir una clave aquí obliga a añadir
 * su `grant update (columna)` en una migración. Si no, el guardado fallaría en
 * silencio.
 */
export type CompanySettings = Pick<Company, 'meridian_auto'>

// Empresa + el rol del usuario en ella (lo devuelve el RPC my_companies).
type CompanyWithRole = Company & { role: string }

// Empresa activa elegida (multi-equipo), por dispositivo. Si no es válida, se cae a la primera.
const ACTIVE_COMPANY_KEY = 'apuntatefacil.activeCompany'

type AuthResult = { error?: string; needsConfirmation?: boolean }

interface AuthApi {
  loading: boolean // carga inicial de sesión
  session: Session | null
  user: User | null
  company: Company | null // empresa ACTIVA
  companies: Company[] // todas las empresas del usuario (para el cambiador de equipos)
  companyLoading: boolean
  role: string | null // rol del usuario en la empresa ACTIVA: owner | member | encargado
  setActiveCompany: (id: string) => void // cambia de equipo
  signInWithGoogle: () => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  sendPasswordReset: (email: string) => Promise<{ error?: string }>
  updatePassword: (newPassword: string) => Promise<{ error?: string }>
  resendConfirmation: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  createCompany: (name: string, accent?: string) => Promise<{ error?: string }>
  refreshCompany: (preferId?: string) => Promise<Company | null>
  // Cierra (done=true) o reabre (done=false) la guía de primer uso de la empresa activa.
  setOnboardingDone: (done: boolean) => Promise<void>
  /** Guarda ajustes de la empresa activa. Optimista, como el resto. */
  updateCompanySettings: (patch: Partial<CompanySettings>) => Promise<{ error?: string }>
}

const Ctx = createContext<AuthApi | null>(null)

const redirectTo = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/app` : undefined

const resetRedirect = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/restablecer` : undefined

// Traduce los mensajes de GoTrue (en inglés) a un español claro para el usuario.
export function mapAuthError(message: string): string {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tienes que confirmar tu email antes de entrar. Revisa tu bandeja.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.'
  if (m.includes('pwned') || m.includes('leaked') || m.includes('known to be weak') || m.includes('compromised')) return 'Esa contraseña aparece en filtraciones conocidas. Elige otra distinta.'
  if (m.includes('at least') || m.includes('should contain') || m.includes('password should') || m.includes('weak')) return 'La contraseña no cumple los requisitos: mínimo 10 caracteres con mayúsculas, minúsculas y números.'
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('over_email_send')) return 'Has pedido demasiados emails. Espera unos minutos e inténtalo de nuevo.'
  if (m.includes('should be different') || m.includes('same as the old')) return 'La nueva contraseña tiene que ser distinta a la anterior.'
  if (m.includes('unable to validate email') || m.includes('invalid format') || m.includes('invalid email')) return 'Escribe un email válido, por ejemplo nombre@dominio.com.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'El registro está deshabilitado temporalmente.'
  return 'No hemos podido completar la operación. Inténtalo de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  // Carga TODAS las empresas del usuario (con su rol) y fija la ACTIVA: la guardada en
  // localStorage si sigue siendo válida (o preferId, p. ej. tras aceptar una invitación);
  // si no, la primera. Reemplaza al antiguo "coge la empresa más antigua".
  const loadCompanies = useCallback(async (uid: string | undefined, preferId?: string): Promise<Company | null> => {
    if (!uid) {
      setCompanies([])
      setCompany(null)
      setRole(null)
      return null
    }
    setCompanyLoading(true)
    const { data } = await supabase.rpc('my_companies')
    const list = (data as CompanyWithRole[] | null) ?? []
    setCompanies(list)
    const stored = preferId ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_COMPANY_KEY) : null)
    const active = list.find((c) => c.id === stored) ?? list[0] ?? null
    if (active && typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_COMPANY_KEY, active.id)
    setCompany(active)
    setRole(active?.role ?? null)
    setCompanyLoading(false)
    return active
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      loadCompanies(data.session?.user?.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      loadCompanies(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadCompanies])

  const api: AuthApi = {
    loading,
    session,
    user: session?.user ?? null,
    company,
    companies,
    companyLoading,
    role,
    setActiveCompany: (id: string) => {
      const c = companies.find((x) => x.id === id)
      if (!c) return
      if (typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_COMPANY_KEY, id)
      setCompany(c)
      setRole(c.role)
    },
    signInWithGoogle: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo() },
      })
    },
    signUpWithPassword: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo() },
      })
      if (error) return { error: mapAuthError(error.message) }
      // Con confirmación de email no hay sesión hasta confirmar. Y si el email
      // ya existía, GoTrue no da error: devuelve un usuario con identities vacío.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { error: 'Ese email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.' }
      }
      return { needsConfirmation: !data.session }
    },
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return error ? { error: mapAuthError(error.message) } : {}
    },
    sendPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetRedirect(),
      })
      return error ? { error: mapAuthError(error.message) } : {}
    },
    updatePassword: async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      return error ? { error: mapAuthError(error.message) } : {}
    },
    resendConfirmation: async (email) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: redirectTo() },
      })
      return error ? { error: mapAuthError(error.message) } : {}
    },
    signOut: async () => {
      await supabase.auth.signOut()
      setCompany(null)
      setCompanies([])
      if (typeof localStorage !== 'undefined') localStorage.removeItem(ACTIVE_COMPANY_KEY)
    },
    createCompany: async (name, accent) => {
      const { error } = await supabase.rpc('create_company', {
        p_name: name,
        p_accent: accent ?? '#374cce',
      })
      if (error) return { error: error.message }
      await loadCompanies(session?.user?.id)
      return {}
    },
    refreshCompany: async (preferId?: string) => loadCompanies(session?.user?.id, preferId),
    setOnboardingDone: async (done) => {
      if (!company) return
      const value = done ? new Date().toISOString() : null
      // Optimista: la guía responde al instante; si el guardado falla, el estado
      // real vuelve en la próxima carga (my_companies) sin romper nada.
      setCompany({ ...company, onboarding_done_at: value })
      setCompanies((cs) => cs.map((c) => (c.id === company.id ? { ...c, onboarding_done_at: value } : c)))
      await supabase.from('companies').update({ onboarding_done_at: value }).eq('id', company.id)
    },
    updateCompanySettings: async (patch) => {
      if (!company) return { error: 'Sin empresa.' }
      const previous = company
      setCompany({ ...company, ...patch })
      setCompanies((cs) => cs.map((c) => (c.id === company.id ? { ...c, ...patch } : c)))
      const { error } = await supabase.from('companies').update(patch).eq('id', company.id)
      if (error) {
        setCompany(previous)
        setCompanies((cs) => cs.map((c) => (c.id === previous.id ? { ...c, ...previous, role: c.role } : c)))
        return { error: 'No hemos podido guardar el ajuste. Inténtalo de nuevo.' }
      }
      return {}
    },
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAuth(): AuthApi {
  const a = useContext(Ctx)
  if (!a) throw new Error('useAuth fuera de AuthProvider')
  return a
}

// Empresa de la DEMO pública (sin login). El id 'demo' hace que el store cargue
// datos de ejemplo en memoria en vez de Supabase.
// La demo es una ETT (persona Multi): plan 'multi' para mostrar el producto
// completo (bandeja, vistas, sedes, marcas...). El pricing aclara qué da cada plan.
export const DEMO_COMPANY: Company = {
  id: 'demo',
  name: 'Tu empresa',
  accent: '#374cce',
  plan: 'multi',
  subscription_status: null,
  billing_interval: null,
  cancel_at_period_end: false,
  // La demo nunca enseña la guía de primer uso (ya ES la visita guiada).
  onboarding_done_at: '2026-01-01T00:00:00Z',
  downgrade_reconcile_at: null,
  meridian_auto: true,
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  // La empresa de la demo es estado, no una constante: así los ajustes de
  // empresa se mueven durante la visita (no se guardan, se pierden al recargar).
  const [demoCompany, setDemoCompany] = useState<Company>(DEMO_COMPANY)
  const api: AuthApi = {
    loading: false,
    session: { user: { id: 'demo-user', email: 'demo@apuntatefacil.com' } } as unknown as Session,
    user: { id: 'demo-user', email: 'demo@apuntatefacil.com' } as unknown as User,
    company: demoCompany,
    companies: [demoCompany],
    companyLoading: false,
    role: 'owner',
    setActiveCompany: () => {},
    signInWithGoogle: async () => {},
    signUpWithPassword: async () => ({}),
    signInWithPassword: async () => ({}),
    sendPasswordReset: async () => ({}),
    updatePassword: async () => ({}),
    resendConfirmation: async () => ({}),
    signOut: async () => { navigate('/') },
    createCompany: async () => ({}),
    refreshCompany: async (): Promise<Company | null> => demoCompany,
    setOnboardingDone: async () => {},
    updateCompanySettings: async (patch) => {
      setDemoCompany((c) => ({ ...c, ...patch }))
      return {}
    },
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

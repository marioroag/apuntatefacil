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
}

type AuthResult = { error?: string; needsConfirmation?: boolean }

interface AuthApi {
  loading: boolean // carga inicial de sesión
  session: Session | null
  user: User | null
  company: Company | null
  companyLoading: boolean
  role: string | null // rol del usuario en su empresa: owner | member | encargado
  signInWithGoogle: () => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  sendPasswordReset: (email: string) => Promise<{ error?: string }>
  updatePassword: (newPassword: string) => Promise<{ error?: string }>
  resendConfirmation: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  createCompany: (name: string, accent?: string) => Promise<{ error?: string }>
  refreshCompany: () => Promise<Company | null>
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
  const [companyLoading, setCompanyLoading] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  const loadCompany = useCallback(async (uid: string | undefined): Promise<Company | null> => {
    if (!uid) {
      setCompany(null)
      setRole(null)
      return null
    }
    setCompanyLoading(true)
    // RLS solo devuelve las empresas del usuario, así que con seleccionar basta.
    const { data } = await supabase
      .from('companies')
      .select('id,name,accent,plan,subscription_status,billing_interval,cancel_at_period_end')
      .order('created_at', { ascending: true })
      .limit(1)
    const c = data && data[0] ? (data[0] as Company) : null
    setCompany(c)
    if (c) {
      const { data: m } = await supabase
        .from('memberships')
        .select('role')
        .eq('company_id', c.id)
        .eq('user_id', uid)
        .maybeSingle()
      setRole((m as { role?: string } | null)?.role ?? null)
    } else {
      setRole(null)
    }
    setCompanyLoading(false)
    return c
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      loadCompany(data.session?.user?.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      loadCompany(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadCompany])

  const api: AuthApi = {
    loading,
    session,
    user: session?.user ?? null,
    company,
    companyLoading,
    role,
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
    },
    createCompany: async (name, accent) => {
      const { error } = await supabase.rpc('create_company', {
        p_name: name,
        p_accent: accent ?? '#4F46E5',
      })
      if (error) return { error: error.message }
      await loadCompany(session?.user?.id)
      return {}
    },
    refreshCompany: async () => loadCompany(session?.user?.id),
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
  accent: '#4F46E5',
  plan: 'multi',
  subscription_status: null,
  billing_interval: null,
  cancel_at_period_end: false,
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const api: AuthApi = {
    loading: false,
    session: { user: { id: 'demo-user', email: 'demo@apuntatefacil.com' } } as unknown as Session,
    user: { id: 'demo-user', email: 'demo@apuntatefacil.com' } as unknown as User,
    company: DEMO_COMPANY,
    companyLoading: false,
    role: 'owner',
    signInWithGoogle: async () => {},
    signUpWithPassword: async () => ({}),
    signInWithPassword: async () => ({}),
    sendPasswordReset: async () => ({}),
    updatePassword: async () => ({}),
    resendConfirmation: async () => ({}),
    signOut: async () => { navigate('/') },
    createCompany: async () => ({}),
    refreshCompany: async (): Promise<Company | null> => DEMO_COMPANY,
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

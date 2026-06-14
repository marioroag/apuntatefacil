import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Company {
  id: string
  name: string
  accent: string
  plan: 'trial' | 'esencial' | 'pro' | 'multi'
  subscription_status: string | null
}

interface AuthApi {
  loading: boolean // carga inicial de sesión
  session: Session | null
  user: User | null
  company: Company | null
  companyLoading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  createCompany: (name: string, accent?: string) => Promise<{ error?: string }>
  refreshCompany: () => Promise<void>
}

const Ctx = createContext<AuthApi | null>(null)

const redirectTo = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/app` : undefined

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [companyLoading, setCompanyLoading] = useState(false)

  const loadCompany = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setCompany(null)
      return
    }
    setCompanyLoading(true)
    // RLS solo devuelve las empresas del usuario, así que con seleccionar basta.
    const { data } = await supabase
      .from('companies')
      .select('id,name,accent,plan,subscription_status')
      .order('created_at', { ascending: true })
      .limit(1)
    setCompany((data && data[0]) ? (data[0] as Company) : null)
    setCompanyLoading(false)
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
    signInWithGoogle: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo() },
      })
    },
    signInWithEmail: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo() },
      })
      return error ? { error: error.message } : {}
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

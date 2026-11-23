import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { User } from '../types/medication'

interface AuthValue {
  user: User | null
  loading: boolean
  isDemo: boolean
  recovering: boolean
  startDemo: () => void
  logout: () => Promise<void>
  finishRecovery: () => void
}
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [isDemo, setDemo] = useState(() => sessionStorage.getItem('medcontrol_demo') === 'true')
  const [recovering, setRecovering] = useState(window.location.hash.includes('type=recovery'))
  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (!error) setSession(data.session)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      if (next) { setDemo(false); sessionStorage.removeItem('medcontrol_demo') }
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  const user: User | null = isDemo
    ? { id: 'demo', name: 'Maria', email: 'Visitante da demonstração', joinDate: new Date().toISOString() }
    : session ? {
      id: session.user.id,
      name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Você',
      email: session.user.email,
      joinDate: session.user.created_at,
    } : null
  const logout = async () => {
    if (isDemo) { sessionStorage.removeItem('medcontrol_demo'); setDemo(false); return }
    if (supabase && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager?.getSubscription()
      if (subscription) {
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        if (error) throw error
        await subscription.unsubscribe()
      }
    }
    const result = await supabase?.auth.signOut({ scope: 'local' })
    if (result?.error) throw result.error
    setSession(null)
  }
  return <AuthContext.Provider value={{ user, loading, isDemo, recovering,
    startDemo: () => { sessionStorage.setItem('medcontrol_demo', 'true'); setDemo(true) },
    logout, finishRecovery: () => { setRecovering(false) },
  }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider ausente')
  return context
}

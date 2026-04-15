import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const MOCK_USER: User = {
  id: 'demo-user-id',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: undefined,
  phone: undefined,
  confirmed_at: new Date().toISOString(),
  email_confirmed_at: undefined,
  phone_confirmed_at: undefined,
  last_sign_in_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
  identities: [],
  factors: [],
  is_anonymous: true,
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(MOCK_USER)
      setLoading(false)
      return
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          setLoading(false)
          return
        }

        const { data, error: signInError } = await supabase.auth.signInAnonymously()
        if (signInError) throw signInError
        setUser(data.user)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, error }
}

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({ user: null, profile: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadSession() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    if (session?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, role, hotel_id, full_name')
        .eq('user_id', session.user.id)
        .single()
      if (!data) {
        // obtain default hotel id (Sheraton Salta)
        const { data: h } = await supabase
          .from('hotels')
          .select('id')
          .eq('name','Sheraton Salta')
          .limit(1)
          .maybeSingle()
        await supabase
          .from('profiles')
          .upsert({
            user_id: session.user.id,
            full_name: session.user.user_metadata?.full_name ?? null,
            role: 'client',
            hotel_id: h?.id ?? null
          })
        const { data: data2 } = await supabase
          .from('profiles')
          .select('user_id, role, hotel_id, full_name')
          .eq('user_id', session.user.id)
          .single()
        // ensure hotel_id is set
        if (data2 && !data2.hotel_id) {
          if (h?.id) {
            await supabase.from('profiles').update({ hotel_id: h.id }).eq('user_id', session.user.id)
            data2.hotel_id = h.id
          }
        }
        setProfile(data2 ?? null)
      } else {
        // ensure hotel_id for any role
        if (!data.hotel_id) {
          const { data: h } = await supabase
            .from('hotels')
            .select('id')
            .eq('name','Sheraton Salta')
            .limit(1)
            .maybeSingle()
          if (h?.id) {
            await supabase.from('profiles').update({ hotel_id: h.id }).eq('user_id', session.user.id)
            setProfile({ ...data, hotel_id: h.id })
          } else {
            setProfile(data)
          }
        } else {
          setProfile(data ?? null)
        }
      }
    } else {
      setProfile(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSession()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadSession()
    })
    return () => sub.subscription?.unsubscribe()
  }, [])

  const value = { user, profile, loading }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

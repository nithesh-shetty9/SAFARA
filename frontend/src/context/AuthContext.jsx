import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { API } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(API.getUser())
  const [loading, setLoading] = useState(Boolean(API.getToken()))

  useEffect(() => {
    let alive = true
    if (!API.getToken()) { setLoading(false); return }
    API.me().then(({ user: fresh }) => { if (alive) { localStorage.setItem('safara_user', JSON.stringify(fresh)); setUser(fresh) } })
      .catch(() => { API.logout(false); if (alive) setUser(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('safara:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('safara:unauthorized', handleUnauthorized)
  }, [])

  const value = useMemo(() => ({
    user, loading,
    login: async (email, password) => { const u = await API.login(email, password); setUser(u); return u },
    register: async payload => { const u = await API.register(payload); setUser(u); return u },
    logout: () => { setUser(null); API.logout() },
    refreshUser: async () => { const { user: u } = await API.me(); localStorage.setItem('safara_user', JSON.stringify(u)); setUser(u); return u }
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)

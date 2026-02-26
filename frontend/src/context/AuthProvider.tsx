import { useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AuthContext, User, AuthContextData } from './AuthContext'

// AuthContext, User and AuthContextData are defined in companion file

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const navigate = useNavigate()

  // read from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('auth')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setUser(data.user)
        setToken(data.token)
      } catch {
        localStorage.removeItem('auth')
      }
    }
  }, [])

  const saveSession = (userData: User, jwt: string) => {
    setUser(userData)
    setToken(jwt)
    localStorage.setItem('auth', JSON.stringify({ user: userData, token: jwt }))
  }

  const login = async (email: string, password: string) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error || 'Falha no login')
    }
    const data = await res.json()
    saveSession(data.user, data.token)
    navigate('/')
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth')
    navigate('/signin')
  }

  const authFetch = (input: RequestInfo, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

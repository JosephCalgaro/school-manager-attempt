import { useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { AuthContext, User } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [token, setToken]     = useState<string | null>(null)
  const [ready, setReady]     = useState(false)   // ← novo: indica se o localStorage já foi lido
  const tokenRef              = useRef<string | null>(null)
  const navigate              = useNavigate()

  // read from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('auth')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        tokenRef.current = data.token
        setUser(data.user)
        setToken(data.token)
      } catch {
        localStorage.removeItem('auth')
      }
    }
    setReady(true)  // ← marca como pronto após ler o localStorage
  }, [])

  const saveSession = (userData: User, jwt: string) => {
    tokenRef.current = jwt
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
    tokenRef.current = null
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth')
    navigate('/signin')
  }

  const authFetch = useCallback((input: RequestInfo, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`)
    return fetch(input, { ...init, headers })
  }, []) // ref sempre atualizado — não precisa de token como dep

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {/* Aguarda a leitura do localStorage antes de renderizar as rotas */}
      {ready ? children : null}
    </AuthContext.Provider>
  )
}
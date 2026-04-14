import { useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { AuthContext, User } from './AuthContext'

// Decodes JWT payload to check expiry without external dependencies
function decodeJwtPayload(token: string): { exp: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '=='.slice((payload.length + 3) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

// Checks if a JWT token is expired
function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true
  return Date.now() >= payload.exp * 1000
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [token, setToken]     = useState<string | null>(null)
  const [ready, setReady]     = useState(false)
  const tokenRef              = useRef<string | null>(null)
  const isLoggingOutRef        = useRef(false)
  const navigate              = useNavigate()

  // read from localStorage on mount — reject expired tokens proactively
  useEffect(() => {
    const saved = localStorage.getItem('auth')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (isTokenExpired(data.token)) {
          localStorage.removeItem('auth')
        } else {
          tokenRef.current = data.token
          setUser(data.user)
          setToken(data.token)
        }
      } catch {
        localStorage.removeItem('auth')
      }
    }
    setReady(true)
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

  const logout = useCallback(() => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    tokenRef.current = null
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth')
    navigate('/signin')
  }, [navigate])

  // Intercepts responses — on 401 (token expired/invalid), logs out and redirects to signin
  const authFetch = useCallback((input: RequestInfo, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`)
    return fetch(input, { ...init, headers }).then(async (res) => {
      if (res.status === 401) {
        logout()
        return res
      }
      return res
    })
  }, [logout])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {/* Aguarda a leitura do localStorage antes de renderizar as rotas */}
      {ready ? children : null}
    </AuthContext.Provider>
  )
}
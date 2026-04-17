import { useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { AuthContext, User } from './AuthContext'
import { API_BASE } from '../config/api'

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf-token`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      return data.csrfToken
    }
  } catch (e) {
    console.warn('CSRF token fetch failed:', e)
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [ready, setReady]     = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const isLoggingOutRef        = useRef(false)
  const navigate              = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/auth/profile`, { credentials: 'include' })
      .then(res => {
        if (res.status === 401) return null
        return res.json().catch(() => null)
      })
      .then(async (data) => {
        if (data && data.id) {
          setUser(data)
          const token = await fetchCsrfToken()
          setCsrfToken(token)
        }
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error || 'Falha no login')
    }
    const data = await res.json()
    setUser(data.user)
    const token = await fetchCsrfToken()
    setCsrfToken(token)
    navigate('/')
  }

  const logout = useCallback(() => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    setUser(null)
    setCsrfToken(null)
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    navigate('/signin')
  }, [navigate])

  const authFetch = useCallback((input: RequestInfo, init: RequestInit = {}) => {
    const url = typeof input === 'string' && !input.startsWith('http') ? `${API_BASE}${input}` : input
    const method = typeof input === 'string' ? input : input.method
    const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes((init.method || method || 'GET').toUpperCase())

    const headers: Record<string, string> = {}
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, init.headers)
      }
    }
    if (isMutating && csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }

    return fetch(url, { ...init, credentials: 'include', headers }).then(async (res) => {
      if (res.status === 401) {
        logout()
        return res
      }
      return res
    })
  }, [csrfToken, logout])

  return (
    <AuthContext.Provider value={{ user, login, logout, authFetch }}>
      {ready ? children : null}
    </AuthContext.Provider>
  )
}
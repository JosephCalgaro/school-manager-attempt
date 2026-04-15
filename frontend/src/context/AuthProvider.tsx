import { useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { AuthContext, User } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [ready, setReady]     = useState(false)
  const isLoggingOutRef        = useRef(false)
  const navigate              = useNavigate()

  useEffect(() => {
    fetch('/auth/profile', { credentials: 'include' })
      .then(res => {
        if (res.status === 401) return null
        return res.json().catch(() => null)
      })
      .then(data => {
        if (data && data.id) setUser(data)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch('/auth/login', {
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
    navigate('/')
  }

  const logout = useCallback(() => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    setUser(null)
    fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    navigate('/signin')
  }, [navigate])

  const authFetch = useCallback((input: RequestInfo, init: RequestInit = {}) => {
    return fetch(input, { ...init, credentials: 'include' }).then(async (res) => {
      if (res.status === 401) {
        logout()
        return res
      }
      return res
    })
  }, [logout])

  return (
    <AuthContext.Provider value={{ user, login, logout, authFetch }}>
      {ready ? children : null}
    </AuthContext.Provider>
  )
}
import { createContext } from 'react'

export interface User {
  id: number
  fullName: string
  email: string
  role: string
}

export interface AuthContextData {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

export const AuthContext = createContext<AuthContextData | undefined>(undefined)

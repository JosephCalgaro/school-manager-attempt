import { createContext } from 'react'

export interface User {
  id: number
  fullName?: string
  full_name?: string
  email: string
  role: 'ADMIN' | 'TEACHER' | 'SECRETARY' | 'STUDENT' | 'RESPONSIBLE' | 'SAAS_OWNER' | string
  school_id?: number
  school_name?: string
  is_temp?: boolean
  temp_expires_at?: string  // ISO string
}

export interface AuthContextData {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

export const AuthContext = createContext<AuthContextData | undefined>(undefined)

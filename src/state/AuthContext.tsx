import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Institution } from '../types'
import { API_BASE, apiFetch, clearTokens, getAccessToken, readError, storeTokens } from './apiClient'

const DEMO_USERNAME = 'demo'
const DEMO_PASSWORD = 'demo1234'
const DEMO_EMAIL = 'demo@example.com'

type AuthResult = { ok: true } | { ok: false; error: string }

interface AuthState {
  currentUser: Institution | null
  isLoading: boolean
  signUp: (data: { name: string; adminName: string; username: string; email: string; password: string }) => Promise<AuthResult>
  logIn: (username: string, password: string) => Promise<AuthResult>
  logOut: () => Promise<void>
  logInAsDemo: () => Promise<AuthResult>
  forgotPassword: (username: string) => Promise<AuthResult>
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthState | null>(null)

interface InstitutionPayload {
  id: number
  name: string
  adminName: string
  username: string
  email: string | null
}

function toInstitution(raw: InstitutionPayload): Institution {
  return { id: String(raw.id), name: raw.name, adminName: raw.adminName, username: raw.username, email: raw.email ?? '' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Institution | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      if (!getAccessToken()) {
        setIsLoading(false)
        return
      }
      try {
        const res = await apiFetch('/api/auth/me')
        if (res.ok) {
          setCurrentUser(toInstitution(await res.json()))
        } else {
          clearTokens()
        }
      } catch {
        // backend unreachable — fall through to logged-out state, don't crash the app
      } finally {
        setIsLoading(false)
      }
    }
    restoreSession()
  }, [])

  async function signUp(data: {
    name: string
    adminName: string
    username: string
    email: string
    password: string
  }): Promise<AuthResult> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return { ok: false, error: await readError(res, 'Registration failed.') }
      const body = await res.json()
      storeTokens(body.accessToken, body.refreshToken)
      setCurrentUser(toInstitution(body.institution))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not reach the server — is the backend running on localhost:8080?' }
    }
  }

  async function logIn(username: string, password: string): Promise<AuthResult> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) return { ok: false, error: await readError(res, 'Incorrect username or password.') }
      const body = await res.json()
      storeTokens(body.accessToken, body.refreshToken)
      setCurrentUser(toInstitution(body.institution))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not reach the server — is the backend running on localhost:8080?' }
    }
  }

  async function logOut() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // best effort — clear the local session regardless
    }
    clearTokens()
    setCurrentUser(null)
  }

  /** The demo account isn't pre-seeded on the backend — log in, and if it doesn't exist yet
   * on this database, register it on the fly so the one-click demo still works. */
  async function logInAsDemo(): Promise<AuthResult> {
    const loginResult = await logIn(DEMO_USERNAME, DEMO_PASSWORD)
    if (loginResult.ok) return loginResult
    return signUp({
      name: 'Harbour View Tutoring College',
      adminName: 'Demo Admin',
      username: DEMO_USERNAME,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })
  }

  async function forgotPassword(username: string): Promise<AuthResult> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) return { ok: false, error: await readError(res, 'Something went wrong.') }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not reach the server — is the backend running on localhost:8080?' }
    }
  }

  async function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      if (!res.ok) return { ok: false, error: await readError(res, 'Could not reset your password.') }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not reach the server — is the backend running on localhost:8080?' }
    }
  }

  return (
    <AuthContext.Provider
      value={{ currentUser, isLoading, signUp, logIn, logOut, logInAsDemo, forgotPassword, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

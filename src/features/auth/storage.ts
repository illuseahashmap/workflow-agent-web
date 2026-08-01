import type { AuthSession } from './types'

const AUTH_STORAGE_KEY = 'workflow-agent.auth-session'

export function readAuthSession(): AuthSession | null {
  const serialized = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!serialized) return null

  try {
    const session = JSON.parse(serialized) as AuthSession
    if (!session.accessToken || Date.parse(session.expiresAt) <= Date.now()) {
      clearAuthSession()
      return null
    }
    return session
  } catch {
    clearAuthSession()
    return null
  }
}

export function writeAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function getAccessToken() {
  return readAuthSession()?.accessToken ?? null
}

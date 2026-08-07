'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { User, UserRole } from '@/shared/types'
import { DEMO_ACCOUNTS, MOCK_USERS } from '@/mocks/users'

const STORAGE_KEY = 'ksf_user'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// getSnapshot이 매번 새 객체를 반환하면 useSyncExternalStore가 무한 리렌더 경고를 낸다.
// 원본 문자열이 바뀌지 않았으면 이전 파싱 결과를 그대로 재사용해 참조를 안정화한다.
let cachedRaw: string | null = null
let cachedUser: User | null = null

function parseUser(raw: string | null): User | null {
  if (raw === cachedRaw) return cachedUser
  cachedRaw = raw
  cachedUser = raw ? (JSON.parse(raw) as User) : null
  return cachedUser
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('ksf-auth-change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('ksf-auth-change', callback)
  }
}

function getSnapshot() {
  return parseUser(localStorage.getItem(STORAGE_KEY))
}

function getServerSnapshot() {
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  async function login(email: string, password: string): Promise<boolean> {
    const account = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password)
    if (!account) return false

    const foundUser = MOCK_USERS.find((u) => u.email === email)
    if (!foundUser) return false

    localStorage.setItem(STORAGE_KEY, JSON.stringify(foundUser))
    window.dispatchEvent(new Event('ksf-auth-change'))
    return true
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event('ksf-auth-change'))
  }

  function hasRole(...roles: UserRole[]) {
    return !!user && roles.includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

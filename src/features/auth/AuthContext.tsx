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

function getSnapshot(): User | null {
  return parseUser(localStorage.getItem(STORAGE_KEY))
}

// 서버/최초 하이드레이션 시점에는 localStorage를 읽을 수 없어 "세션 없음"과 "아직 확인 전"을
// 구분할 수 없었다. getServerSnapshot이 null을 반환하면 두 상태가 같은 값이 되어, 실제로는
// 로그인돼 있는데도 하이드레이션 첫 렌더에서 user===null로 보이는 순간이 생긴다. 그 찰나에
// MainLayout의 리다이렉트 effect가 먼저 실행되면 router.push('/login')가 이미 발동해버려서,
// 그 직후 진짜 값(user 있음)으로 다시 렌더링돼도 이미 로그인 화면으로 튕긴 뒤다
// (새로고침 시 로그인 화면으로 튕기는 버그의 원인). undefined를 별도 상태로 둬서
// "아직 확인 전"과 "확인 결과 세션 없음"을 구분한다.
function getServerSnapshot(): User | null | undefined {
  return undefined
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const loading = snapshot === undefined
  const user = snapshot ?? null

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
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

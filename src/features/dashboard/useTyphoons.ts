'use client'

// DASHBOARD.md 11.2장 — /api/typhoons를 15분마다 재조회한다. 실제 태풍이 기본 뷰포트 밖
// (동태평양 등)에 있으면 화면이 비므로, 성공하든 실패하든 MOCK_TYPHOONS를 항상 함께
// 보여준다(KNOWN_PITFALLS.md 6.2). 실패 시에는 mock만 사용한다.

import { useEffect, useState } from 'react'
import { MOCK_TYPHOONS, type TyphoonWarning } from '@/mocks/map-overlays'

const REFETCH_INTERVAL_MS = 15 * 60 * 1000
const CLIENT_TIMEOUT_MS = 12000

export function useTyphoons(): TyphoonWarning[] {
  const [typhoons, setTyphoons] = useState<TyphoonWarning[]>(MOCK_TYPHOONS)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/typhoons', { signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) })
        if (!res.ok) throw new Error('bad_response')
        const live = (await res.json()) as TyphoonWarning[]
        if (cancelled) return
        setTyphoons([...live, ...MOCK_TYPHOONS])
      } catch {
        if (!cancelled) setTyphoons(MOCK_TYPHOONS)
      }
    }

    load()
    const interval = setInterval(load, REFETCH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return typhoons
}

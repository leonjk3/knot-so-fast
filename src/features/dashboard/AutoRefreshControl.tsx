'use client'

// DASHBOARD.md 4.1장 — 페이지 헤더 우측의 자동 새로고침 컨트롤. 클릭하면 아이콘이 왼쪽으로
// 밀리며 주기 select가 펼쳐지고, 주기를 고르면 다시 접힌다. 주기가 설정된 동안에는 아이콘이
// 빨간색으로 바뀌고 3초 주기로 회전한다.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

const REFRESH_OPTIONS = [
  { value: 0, label: '새로고침 안함' },
  { value: 10, label: '10분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
]

export function AutoRefreshControl() {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(0)

  useEffect(() => {
    if (intervalMinutes === 0) return
    const id = setInterval(() => router.refresh(), intervalMinutes * 60 * 1000)
    return () => clearInterval(id)
  }, [intervalMinutes, router])

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setIntervalMinutes(Number(e.target.value))
    setExpanded(false)
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        title="자동 새로고침"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-300',
          expanded && '-translate-x-1',
          intervalMinutes > 0 ? 'text-red-500' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
        )}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', intervalMinutes > 0 && 'animate-[spin_3s_linear_infinite]')} />
      </button>
      <select
        value={intervalMinutes}
        onChange={handleSelect}
        onBlur={() => setExpanded(false)}
        aria-label="자동 새로고침 주기"
        className={cn(
          'overflow-hidden rounded-md border bg-white text-xs text-slate-600 transition-all duration-300 dark:bg-slate-800 dark:text-slate-300',
          expanded ? 'ml-1 w-24 border-slate-200 px-1 py-1 opacity-100 dark:border-slate-700' : 'w-0 border-transparent px-0 py-0 opacity-0',
        )}
      >
        {REFRESH_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

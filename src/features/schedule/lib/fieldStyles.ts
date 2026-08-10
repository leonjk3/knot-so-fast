import { cn } from '@/shared/utils/cn'

// 모든 input/select가 공유하는 공통 스타일 — SCHEDULE.md 5.2장
export function inputClassName(disabled: boolean, hasError: boolean): string {
  return cn(
    'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]',
    disabled
      ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-60 dark:bg-slate-700'
      : 'bg-white dark:bg-slate-800',
    hasError ? 'border-red-400' : 'border-slate-300 dark:border-slate-600',
  )
}

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

interface HorizontalGaugeProps {
  icon: LucideIcon
  label: string
  value: string
  percent: number
  colorClassName: string
}

// DASHBOARD.md 6.3장 — 함대 게이지 카드에서 재사용하는 공용 가로 게이지.
export function HorizontalGauge({ icon: Icon, label, value, percent, colorClassName }: HorizontalGaugeProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className="flex items-center gap-1">
      <Icon className="h-3 w-3 shrink-0 text-slate-400" />
      <span className="w-11 shrink-0 truncate text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', colorClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-12 shrink-0 truncate text-right text-[10px] font-semibold whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  )
}

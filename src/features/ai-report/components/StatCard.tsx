import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export type StatCardAccent = 'default' | 'success' | 'warning' | 'danger' | 'brand'

const TEXT_COLOR: Record<StatCardAccent, string> = {
  default: 'text-slate-700 dark:text-slate-300',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger: 'text-red-600 dark:text-red-400',
  brand: 'text-[#6366f1]',
}

const ICON_COLOR: Record<StatCardAccent, string> = {
  default: 'text-slate-400 dark:text-slate-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  danger: 'text-red-500',
  brand: 'text-[#6366f1]',
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
  accent: StatCardAccent
}

export function StatCard({ icon: Icon, label, value, sublabel, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4 shrink-0', ICON_COLOR[accent])} />
        <span className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className={cn('mt-1 text-xl font-bold', TEXT_COLOR[accent])}>{value}</p>
      {sublabel && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{sublabel}</p>}
    </div>
  )
}

import type { LucideIcon } from 'lucide-react'

interface CarbonStatCardProps {
  icon: LucideIcon
  iconColorClass: string
  value: string
  description: string
}

export function CarbonStatCard({ icon: Icon, iconColorClass, value, description }: CarbonStatCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
        <Icon className={`h-3.5 w-3.5 ${iconColorClass}`} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold">{value}</p>
        <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  )
}

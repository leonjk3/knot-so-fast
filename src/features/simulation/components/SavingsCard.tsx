'use client'

import { Fuel, DollarSign, TrendingDown } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'

interface SavingsCardProps {
  savings: { fuel: number; cost: number; co2: number }
}

// §4.11 — 절감(양수)이면 -, 증가(음수)면 +. "연료를 덜 쓴다"를 -로 표현한다(직관과 반대, 의도된 동작).
function formatSigned(value: number, decimals: number): string {
  const abs = Math.abs(value).toFixed(decimals)
  return value >= 0 ? `-${abs}` : `+${abs}`
}

export function SavingsCard({ savings }: SavingsCardProps) {
  const { t } = useLanguage()
  const isCostSaving = savings.cost >= 0

  const items = [
    { icon: Fuel, label: t.simulation.fuel, value: `${formatSigned(savings.fuel, 1)} ton`, positive: savings.fuel >= 0 },
    { icon: DollarSign, label: t.simulation.cost, value: `${formatSigned(savings.cost / 1000, 0)}k`, positive: savings.cost >= 0, prefix: '$' },
    { icon: TrendingDown, label: 'CO₂', value: `${formatSigned(savings.co2, 1)} ton`, positive: savings.co2 >= 0 },
  ]

  return (
    <div
      className={cn(
        'rounded-xl border bg-transparent p-4',
        isCostSaving ? 'border-green-200 dark:border-green-900/50' : 'border-red-200 dark:border-red-900/50',
      )}
    >
      <p className="text-sm font-semibold">{t.simulation.savingTitle}</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {items.map(({ icon: Icon, label, value, positive, prefix }) => (
          <div key={label} className="text-center">
            <Icon className={cn('mx-auto h-4 w-4', positive ? 'text-green-500' : 'text-red-500')} />
            <p className={cn('mt-1 text-lg font-bold', positive ? 'text-green-700 dark:text-green-400' : 'text-red-600')}>
              {prefix ?? ''}
              {value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

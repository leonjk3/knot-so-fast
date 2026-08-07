'use client'

import { Medal } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { formatKrwCompact, co2SavedValueKrw, type FleetRankingEntry } from '@/features/carbon/calc'

const MEDALS = ['🥇', '🥈', '🥉']

interface EcoRankingCardProps {
  ranking: FleetRankingEntry[]
  rank: number
}

export function EcoRankingCard({ ranking, rank }: EcoRankingCardProps) {
  const { t } = useLanguage()

  return (
    <div className="lg:border-l lg:pl-5">
      <div className="flex items-center gap-2">
        <Medal className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold">{t.carbon.rankTitle}</p>
      </div>

      <div className="mt-3 flex items-center gap-2 px-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        <span className="w-5 shrink-0" />
        <span className="flex-1">{t.carbon.rankColVessel}</span>
        <span className="w-32 shrink-0 text-right">{t.carbon.rankColSaved}</span>
        <span className="w-24 shrink-0 text-right">{t.carbon.rankColValue}</span>
      </div>

      <div className="mt-1.5 space-y-1.5">
        {ranking.map((entry, i) => (
          <div
            key={entry.vesselId}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2',
              entry.isCurrent && 'bg-[#6366f1]/10 ring-1 ring-[#6366f1]/30',
            )}
          >
            <span className="w-5 shrink-0 text-center text-sm">{i < 3 ? MEDALS[i] : i + 1}</span>
            <span className={cn('flex-1 truncate text-sm', entry.isCurrent ? 'font-medium text-[#6366f1]' : 'text-slate-500 dark:text-slate-400')}>
              {entry.vesselName}
              {entry.isCurrent && ` (${t.carbon.rankCurrentTag})`}
            </span>
            <span className="w-32 shrink-0 text-right font-mono text-sm font-semibold">-{entry.co2SavedPct.toFixed(1)}%</span>
            <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold" style={{ color: '#10B981' }}>
              {formatKrwCompact(co2SavedValueKrw(entry.co2SavedTon))}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.rankSummary(String(rank), String(ranking.length))}</p>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{t.carbon.rankValueDisclaimer}</p>
    </div>
  )
}

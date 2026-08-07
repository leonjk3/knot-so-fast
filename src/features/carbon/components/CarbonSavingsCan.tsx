'use client'

import { Sparkles, Trophy, CheckCircle2, Lock } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { CAN_BADGES } from '@/features/carbon/constants'
import type { BadgeProgress } from '@/features/carbon/calc'

const BADGE_LABEL_KEYS = ['badge1', 'badge2', 'badge3', 'badge4'] as const

interface CarbonSavingsCanProps {
  scope3SavedTon: number
  scope3SavedPct: number
  progress: BadgeProgress
}

export function CarbonSavingsCan({ scope3SavedTon, scope3SavedPct, progress }: CarbonSavingsCanProps) {
  const { t } = useLanguage()
  const { unlocked, nextBadgeIdx, canFillHeightPct } = progress

  const milestone = t.carbon.canMilestone(scope3SavedPct)
  const badgeFooter =
    nextBadgeIdx === -1
      ? t.carbon.badgeAllDone
      : t.carbon.badgeNext(
          (CAN_BADGES[nextBadgeIdx].threshold - scope3SavedPct).toFixed(1),
          t.carbon[BADGE_LABEL_KEYS[nextBadgeIdx]],
        )

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-500/5 to-[#6366f1]/5 p-5 dark:border-slate-800 dark:from-emerald-500/10 dark:to-[#6366f1]/10">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-500" />
        <p className="text-sm font-semibold">{t.carbon.canTitle}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.carbon.canSubtitle}</p>

      <div className="mt-6 flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-10">
        {/* 캔 */}
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative h-56 w-28 overflow-hidden rounded-[2rem] border-4 border-slate-300 bg-slate-50 shadow-inner dark:border-slate-600 dark:bg-slate-800">
            <div className="absolute top-0 right-0 left-0 h-3 bg-slate-200 dark:bg-slate-700" />
            <div
              className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-emerald-500 to-emerald-300 transition-all duration-1000 ease-out"
              style={{ height: `${canFillHeightPct}%` }}
            >
              <div className="absolute -top-1.5 right-0 left-0 h-3 rounded-[50%] bg-emerald-300/90" />
              <span className="absolute top-1 left-2 h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" style={{ animationDelay: '0ms' }} />
              <span className="absolute top-3 left-5 h-1 w-1 animate-bounce rounded-full bg-white/70" style={{ animationDelay: '300ms' }} />
              <span className="absolute top-2 left-8 h-1 w-1 animate-bounce rounded-full bg-white/70" style={{ animationDelay: '600ms' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-extrabold text-white drop-shadow-sm">{scope3SavedPct.toFixed(0)}%</span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-semibold">{t.carbon.canFillLabel(scope3SavedTon.toFixed(1))}</p>
          <p className="mt-1 text-center text-[11px] text-emerald-600">{milestone}</p>
        </div>

        {/* 배지 */}
        <div className="min-w-0 flex-1 md:border-l md:border-slate-200 md:pl-8 dark:md:border-slate-700">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-semibold">{t.carbon.badgesTitle}</p>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CAN_BADGES.map((badge, i) => {
              const isUnlocked = unlocked[i]
              return (
                <div
                  key={badge.threshold}
                  className={cn(
                    'relative rounded-lg border p-3 text-center',
                    isUnlocked
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                      : 'grayscale bg-slate-50 opacity-50 dark:bg-slate-800',
                  )}
                >
                  <span className="absolute top-1.5 right-1.5">
                    {isUnlocked ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </span>
                  <p className="text-2xl">{badge.emoji}</p>
                  <p className={cn('mt-1 text-[11px] font-semibold', isUnlocked ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500')}>
                    {t.carbon[BADGE_LABEL_KEYS[i]]}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{badge.threshold}%+</p>
                </div>
              )
            })}
          </div>

          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">{badgeFooter}</p>
        </div>
      </div>
    </div>
  )
}

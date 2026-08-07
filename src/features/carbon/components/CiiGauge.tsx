'use client'

import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { CII_GRADES, CII_COLORS, type CiiGrade } from '@/features/carbon/constants'

interface CiiGaugeProps {
  grade: CiiGrade
  score: number
  nextBetterGrade: CiiGrade | null
}

export function CiiGauge({ grade, score, nextBetterGrade }: CiiGaugeProps) {
  const { t } = useLanguage()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold">{t.carbon.gaugeTitle}</h3>

      <div className="flex items-baseline justify-center gap-2">
        <span className="text-4xl font-extrabold" style={{ color: CII_COLORS[grade] }}>
          {grade}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">· CII {score.toFixed(2)}</span>
      </div>

      <div className="mt-3 grid grid-cols-5">
        {CII_GRADES.map((g) => (
          <div key={g} className="flex justify-center text-xs" style={{ color: g === grade ? CII_COLORS[g] : 'transparent' }}>
            ▼
          </div>
        ))}
      </div>

      <div className="grid h-11 grid-cols-5 overflow-hidden rounded-lg shadow-inner">
        {CII_GRADES.map((g) => (
          <div
            key={g}
            className={cn(
              'flex items-center justify-center text-sm font-bold text-white transition-all',
              g === grade ? 'z-10 scale-y-110 opacity-100 ring-2 ring-inset ring-white/70' : 'opacity-35',
            )}
            style={{ backgroundColor: CII_COLORS[g] }}
          >
            {g}
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
        {nextBetterGrade ? t.carbon.gaugeNextGrade(nextBetterGrade) : t.carbon.gaugeBestGrade}
      </p>
    </div>
  )
}

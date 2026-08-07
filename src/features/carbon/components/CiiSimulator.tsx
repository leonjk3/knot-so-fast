'use client'

import { Trophy, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { formatNumber } from '@/shared/utils/format'
import { CII_COLORS } from '@/features/carbon/constants'
import type { CiiSimulator as CiiSimulatorData } from '@/features/carbon/calc'

interface CiiSimulatorProps {
  sim: CiiSimulatorData
}

export function CiiSimulator({ sim }: CiiSimulatorProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t.carbon.ciiSimTitle}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.ciiSimDesc}</p>
        </div>
      </div>

      <div className="my-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.ciiSimCurrentLabel}</p>
          <p className="text-2xl font-bold" style={{ color: CII_COLORS[sim.current.grade] }}>
            {sim.current.grade}
          </p>
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{t.carbon.ciiSimBaseline}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatNumber(sim.current.speedKts)} kts</p>
        </div>
        <div className="rounded-lg border p-2.5 text-center" style={{ borderColor: '#10B98166', backgroundColor: '#10B9810D' }}>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.ciiSimOptimizedLabel}</p>
          <p className="text-2xl font-bold" style={{ color: CII_COLORS[sim.optimized.grade] }}>
            {sim.optimized.grade}
          </p>
          <p className="text-[10px] font-semibold" style={{ color: '#10B981' }}>
            {t.carbon.ciiSimRiskGood}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatNumber(sim.optimized.speedKts)} kts</p>
        </div>
      </div>

      <div className="mt-auto flex items-start gap-2 rounded-lg p-2.5" style={{ backgroundColor: '#10B9811A' }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#10B981' }} />
        <p className="text-[11px]">{t.carbon.ciiSimCompliance(sim.avoidedGrade, sim.complianceAmountLabel)}</p>
      </div>
    </div>
  )
}

'use client'

import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { CII_COLORS, CARBON_COMPARISON_LABELS } from '@/features/carbon/constants'
import type { ThreeWayComparison, ComparisonRow } from '@/features/carbon/calc'

interface ComparisonTableProps {
  comparison: ThreeWayComparison
  vesselName: string
}

export function ComparisonTable({ comparison, vesselName }: ComparisonTableProps) {
  const { t } = useLanguage()

  const rows: { label: string; row: ComparisonRow; highlight: boolean }[] = [
    { label: `${t.carbon.curVoyage} (${vesselName})`, row: comparison.current, highlight: true },
    { label: CARBON_COMPARISON_LABELS.historicalAvg, row: comparison.historical, highlight: false },
    { label: CARBON_COMPARISON_LABELS.benchmarkAvg, row: comparison.benchmark, highlight: false },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/60">
        <p className="text-sm font-semibold">{t.carbon.comparison}</p>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.carbon.colCategory}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{t.carbon.colCiiScore}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{t.carbon.colGrade}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{t.carbon.colFuel}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{t.carbon.colCo2}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ label, row, highlight }) => (
            <tr key={label} className={cn(!highlight && 'hover:bg-slate-50 dark:hover:bg-slate-800/40', highlight && 'bg-[#6366f1]/5')}>
              <td className="px-4 py-3 text-sm">{label}</td>
              <td className="px-4 py-3 text-right font-mono text-sm">{row.avgCiiScore.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">
                <span
                  className="inline-flex rounded px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: CII_COLORS[row.ciiGrade] }}
                >
                  {row.ciiGrade}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm">{row.totalFuelTon.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="px-4 py-3 text-right text-sm">{row.totalCo2Ton.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

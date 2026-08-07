'use client'

import dynamic from 'next/dynamic'
import { Anchor } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { useTheme } from '@/features/theme/ThemeContext'
import { cn } from '@/shared/utils/cn'
import type { AnchorScenario } from '@/features/carbon/calc'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface AnchorCarbonChartProps {
  scenario: AnchorScenario
}

export function AnchorCarbonChart({ scenario }: AnchorCarbonChartProps) {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#334155' : '#e2e8f0'
  const labelColor = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg = isDark ? '#1e293b' : '#ffffff'
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0'
  const tooltipText = isDark ? '#e2e8f0' : '#334155'

  const baselineTotal = scenario.baseline.sailingCo2Ton + scenario.baseline.anchorCo2Ton
  const optimizedTotal = scenario.optimized.sailingCo2Ton + scenario.optimized.anchorCo2Ton

  const categories = [t.carbon.anchorBaselineLabel, t.carbon.anchorOptimizedLabel]
  const sailingData = [scenario.baseline.sailingCo2Ton, scenario.optimized.sailingCo2Ton]
  const anchorData = [scenario.baseline.anchorCo2Ton, scenario.optimized.anchorCo2Ton]
  const totals = [baselineTotal, optimizedTotal]

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut',
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 11, color: labelColor },
      data: [t.carbon.sailingLegend, t.carbon.anchorLegend],
    },
    grid: { top: 40, right: 12, bottom: 24, left: 16, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText },
      formatter: (params: { dataIndex: number; marker: string; seriesName: string; value: number }[]) => {
        const idx = params[0].dataIndex
        const lines = params.map((p) => `${p.marker} ${p.seriesName}: <b>${p.value}</b> ton`)
        return [categories[idx], ...lines, `${t.carbon.colTotalCo2}: <b>${totals[idx]}</b> ton`].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { fontSize: 11, color: labelColor },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => `${v}t`, fontSize: 11, color: labelColor },
      splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
    },
    series: [
      {
        name: t.carbon.sailingLegend,
        type: 'bar',
        stack: 'co2',
        barMaxWidth: 72,
        data: sailingData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#67e8f9' },
              { offset: 1, color: '#6366f1' },
            ],
          },
        },
      },
      {
        name: t.carbon.anchorLegend,
        type: 'bar',
        stack: 'co2',
        barMaxWidth: 72,
        data: anchorData,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: labelColor,
          formatter: (p: { value: number }) => (p.value > 0 ? `${p.value}t` : ''),
        },
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#fca5a5' },
              { offset: 1, color: '#dc2626' },
            ],
          },
        },
      },
    ],
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/5">
          <Anchor className="h-4 w-4 text-red-500" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t.carbon.anchorTitle}</p>
          <p className="max-w-2xl text-xs text-slate-500 dark:text-slate-400">{t.carbon.anchorDesc}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div style={{ height: 256 }}>
          <ReactECharts option={option} notMerge style={{ height: '100%' }} />
        </div>

        <div className="self-start overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t.carbon.colScenario}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t.carbon.colSailingCo2}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t.carbon.colAnchorCo2}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t.carbon.colTotalCo2}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="px-3 py-2 text-xs">{t.carbon.anchorBaselineLabel}</td>
                <td className="px-3 py-2 text-right text-xs">{scenario.baseline.sailingCo2Ton.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-xs">{scenario.baseline.anchorCo2Ton.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{baselineTotal.toFixed(2)}</td>
              </tr>
              <tr className="bg-[#10B981]/5">
                <td className="px-3 py-2 text-xs">{t.carbon.anchorOptimizedLabel}</td>
                <td className="px-3 py-2 text-right text-xs">{scenario.optimized.sailingCo2Ton.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-xs">{scenario.optimized.anchorCo2Ton.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{optimizedTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className={cn('flex items-center justify-between px-4 py-2.5 text-xs')} style={{ backgroundColor: '#10B9811A' }}>
            <span className="text-slate-500 dark:text-slate-400">
              {t.carbon.anchorBaselineLabel} → {t.carbon.anchorOptimizedLabel}
            </span>
            <span className="text-sm font-bold" style={{ color: '#10B981' }}>
              {t.carbon.savedLabel(scenario.anchorSavedTon.toFixed(2))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

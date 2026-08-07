'use client'

import dynamic from 'next/dynamic'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { useTheme } from '@/features/theme/ThemeContext'
import type { SimulationResult } from '@/features/simulation/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface ComparisonChartProps {
  planned: SimulationResult
  simulated: SimulationResult
  historical: SimulationResult | null
}

export function ComparisonChart({ planned, simulated, historical }: ComparisonChartProps) {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#334155' : '#e2e8f0'
  const labelColor = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg = isDark ? '#1e293b' : '#ffffff'
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0'
  const tooltipText = isDark ? '#e2e8f0' : '#334155'

  const categories = [t.simulation.curPlan, t.simulation.simResult, ...(historical ? [t.simulation.historicalLabel] : [])]
  const fuelData = [Math.round(planned.fuel), Math.round(simulated.fuel), ...(historical ? [Math.round(historical.fuel)] : [])]
  const costData = [
    Math.round(planned.cost / 1000),
    Math.round(simulated.cost / 1000),
    ...(historical ? [Math.round(historical.cost / 1000)] : []),
  ]
  const co2Data = [Math.round(planned.co2), Math.round(simulated.co2), ...(historical ? [Math.round(historical.co2)] : [])]

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 900,
    animationEasing: 'elasticOut',
    grid: { top: 28, right: 8, bottom: 24, left: 8, containLabel: true },
    legend: { top: 4, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11, color: labelColor } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontSize: 12, fontWeight: 'bold', color: labelColor },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: axisColor } },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
      axisLabel: { fontSize: 11, color: labelColor },
    },
    series: [
      {
        name: t.simulation.fuelLegend,
        type: 'bar',
        barMaxWidth: 44,
        barGap: '10%',
        data: fuelData,
        label: { show: true, position: 'top', fontSize: 10, color: labelColor, formatter: '{c}' },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
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
        name: t.simulation.costLegend,
        type: 'bar',
        barMaxWidth: 44,
        data: costData,
        label: { show: true, position: 'top', fontSize: 10, color: labelColor, formatter: '${c}k' },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#c084fc' },
              { offset: 1, color: '#7c3aed' },
            ],
          },
        },
      },
      {
        name: 'CO₂ (ton)',
        type: 'bar',
        barMaxWidth: 44,
        data: co2Data,
        label: { show: true, position: 'top', fontSize: 10, color: labelColor, formatter: '{c}' },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#4ade80' },
              { offset: 1, color: '#16a34a' },
            ],
          },
        },
      },
    ],
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold">{t.simulation.compareTitle}</p>
      <ReactECharts option={option} notMerge style={{ height: 208 }} />
    </div>
  )
}

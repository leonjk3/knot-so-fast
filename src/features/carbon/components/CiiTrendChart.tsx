'use client'

import dynamic from 'next/dynamic'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { useTheme } from '@/features/theme/ThemeContext'
import { CII_TREND_MONTHS } from '@/features/carbon/constants'

// §6 — ECharts는 SSR을 끄고 동적 import 한다.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface CiiTrendChartProps {
  scores: number[]
}

export function CiiTrendChart({ scores }: CiiTrendChartProps) {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#334155' : '#e2e8f0'
  const labelColor = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg = isDark ? '#1e293b' : '#ffffff'
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0'
  const tooltipText = isDark ? '#e2e8f0' : '#334155'

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut',
    grid: { top: 16, right: 12, bottom: 24, left: 36 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText },
      formatter: (params: { name: string; value: number }[]) =>
        `${params[0].name}<br/>CII: <b>${params[0].value.toFixed(2)}</b>`,
    },
    xAxis: {
      type: 'category',
      data: CII_TREND_MONTHS.map((m) => m.slice(5)),
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: labelColor },
    },
    yAxis: {
      type: 'value',
      scale: true, // ★ 0부터 시작하지 않아야 18% 개선폭이 보인다
      splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
      axisLabel: { fontSize: 11, color: labelColor, formatter: (v: number) => v.toFixed(1) },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: scores,
        lineStyle: { color: '#6366f1', width: 3 },
        itemStyle: { color: '#6366f1', borderColor: isDark ? '#1e293b' : '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `rgba(99,102,241,${isDark ? 0.35 : 0.18})` },
              { offset: 1, color: 'rgba(99,102,241,0)' },
            ],
          },
        },
      },
    ],
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold">{t.carbon.trendTitle}</h3>
      <ReactECharts option={option} notMerge style={{ height: 160 }} />
    </div>
  )
}

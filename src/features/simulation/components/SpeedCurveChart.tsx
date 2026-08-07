'use client'

import dynamic from 'next/dynamic'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { useTheme } from '@/features/theme/ThemeContext'
import { calcFuel } from '@/features/simulation/calc'
import { SPEED_RANGE } from '@/features/simulation/constants'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface SpeedCurveChartProps {
  routeDistanceNm: number
  draftFactor: number
  plannedSpeedKnots: number
  simSpeedKnots: number
}

export function SpeedCurveChart({ routeDistanceNm, draftFactor, plannedSpeedKnots, simSpeedKnots }: SpeedCurveChartProps) {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#334155' : '#e2e8f0'
  const labelColor = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg = isDark ? '#1e293b' : '#ffffff'
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0'
  const tooltipText = isDark ? '#e2e8f0' : '#334155'

  const curveData = SPEED_RANGE.map((s) => [s, Math.round(calcFuel(routeDistanceNm, s, 140, draftFactor))])
  const fuelAt = (speed: number) => Math.round(calcFuel(routeDistanceNm, speed, 140, draftFactor))

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    grid: { top: 16, right: 16, bottom: 36, left: 16, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText },
      formatter: (params: { data: [number, number] }[]) => {
        const [speed, fuel] = params[0].data
        return `${speed} kts<br/>${t.simulation.fuel}: <b>${fuel.toLocaleString()} ton</b>`
      },
    },
    xAxis: {
      type: 'value',
      name: 'Speed (kts)',
      nameLocation: 'middle',
      nameGap: 26,
      min: 10,
      max: 20,
      interval: 2,
      splitLine: { show: false },
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { fontSize: 11, color: labelColor },
      nameTextStyle: { fontSize: 11, color: labelColor },
    },
    yAxis: {
      type: 'value',
      name: 'Fuel (ton)',
      nameLocation: 'middle',
      nameGap: 44,
      splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
      axisLabel: { fontSize: 11, color: labelColor },
      nameTextStyle: { fontSize: 11, color: labelColor },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: curveData,
        lineStyle: { color: '#6366f1', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `rgba(99,102,241,${isDark ? 0.3 : 0.12})` },
              { offset: 1, color: 'rgba(99,102,241,0)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { fontSize: 10, position: 'insideEndTop' },
          lineStyle: { type: 'dashed', width: 2 },
          data: [
            {
              xAxis: plannedSpeedKnots,
              lineStyle: { color: '#f59e0b' },
              label: { formatter: `${t.simulation.planSpeed}\n{c}kts`, color: '#f59e0b' },
            },
            {
              xAxis: simSpeedKnots,
              lineStyle: { color: '#10b981' },
              label: { formatter: `Sim\n{c}kts`, color: '#10b981' },
            },
          ],
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 10,
          data: [
            { coord: [plannedSpeedKnots, fuelAt(plannedSpeedKnots)], itemStyle: { color: '#f59e0b' } },
            { coord: [simSpeedKnots, fuelAt(simSpeedKnots)], itemStyle: { color: '#10b981' } },
          ],
          label: { show: false },
        },
      },
    ],
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t.simulation.speedCurve}</p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3" style={{ backgroundColor: '#f59e0b' }} />
            {t.simulation.planSpeed}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3" style={{ backgroundColor: '#10b981' }} />
            {t.simulation.simResult}
          </span>
        </div>
      </div>
      <ReactECharts option={option} notMerge style={{ height: 192 }} />
    </div>
  )
}

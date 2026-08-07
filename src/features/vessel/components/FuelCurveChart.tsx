'use client'

import dynamic from 'next/dynamic'
import type { EChartsOption } from 'echarts'
import type { FuelPoint } from '@/shared/types'
import { useTheme } from '@/features/theme/ThemeContext'

// App Router에서는 반드시 SSR을 끄고 동적 import — 서버 렌더링 단계의 window 참조를 피한다 (VESSEL.md 5장, 11장)
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface FuelCurveChartProps {
  fuelCurve: FuelPoint[]
  foulingFactor: number
}

export function FuelCurveChart({ fuelCurve, foulingFactor }: FuelCurveChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const axisColor = isDark ? '#334155' : '#e2e8f0'
  const labelColor = isDark ? '#94a3b8' : '#64748b'

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    grid: { top: 12, right: 12, bottom: 28, left: 12, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#e2e8f0' : '#334155' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params
        return `${p.name} kts<br/><b>${p.value} ton/day</b>`
      },
    },
    xAxis: {
      type: 'category',
      data: fuelCurve.map((p) => p.speedKnots),
      axisLabel: { fontSize: 10, color: labelColor, formatter: (v: string) => `${v}kts` },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: axisColor } },
      name: '속도',
      nameLocation: 'middle',
      nameGap: 22,
      nameTextStyle: { fontSize: 10, color: labelColor },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: axisColor } },
      axisLabel: { fontSize: 10, color: labelColor, formatter: (v: number) => `${v}t` },
      axisLine: { lineStyle: { color: axisColor } },
    },
    series: [
      {
        type: 'line',
        data: fuelCurve.map((p) => p.fuelTonPerDay),
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#6366f1', width: 2.5 },
        itemStyle: { color: '#6366f1', borderColor: isDark ? '#1e293b' : '#fff', borderWidth: 2 },
        label: { show: true, position: 'top', fontSize: 10 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `rgba(99,102,241,${isDark ? 0.35 : 0.15})` },
              { offset: 1, color: 'rgba(99,102,241,0)' },
            ],
          },
        },
        // 평균선 자체는 ECharts가 자동 계산하지만, 라벨에는 평균값 대신 선체 노후 계수를 표시한다 (VESSEL.md 5장)
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: '#f59e0b', type: 'dashed', width: 1.5 },
          data: [
            {
              type: 'average',
              label: {
                formatter: `×${foulingFactor.toFixed(2)}`,
                color: '#f59e0b',
                fontSize: 10,
                position: 'insideEndTop',
              },
            },
          ],
        },
      },
    ],
  }

  return (
    <div className="mb-3 h-44">
      {/* 선박을 바꿀 때 이전 옵션(특히 markLine 라벨)이 남지 않도록 notMerge를 켠다 (VESSEL.md 11장) */}
      <ReactECharts option={option} notMerge style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

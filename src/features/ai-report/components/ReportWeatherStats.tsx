'use client'

import { Loader2, Waves } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { StatCard, type StatCardAccent } from '@/features/ai-report/components/StatCard'
import { useTwoPointWeather, seaState, type WeatherPointState, type SeaState } from '@/features/ai-report/lib/weather'

const SEA_STATE_ACCENT: Record<SeaState, StatCardAccent> = {
  calm: 'success',
  moderate: 'default',
  rough: 'warning',
  high: 'danger',
}

interface Point {
  lat: number
  lng: number
}

interface ReportWeatherStatsProps {
  currentLabel: string
  currentPos: Point
  arrivalLabel: string
  arrivalPos: Point
  refreshToken: number
}

export function ReportWeatherStats({
  currentLabel,
  currentPos,
  arrivalLabel,
  arrivalPos,
  refreshToken,
}: ReportWeatherStatsProps) {
  const [currentState, arrivalState] = useTwoPointWeather(currentPos, arrivalPos, refreshToken)

  return (
    <>
      <WeatherPointCard label={currentLabel} state={currentState} />
      <WeatherPointCard label={arrivalLabel} state={arrivalState} />
    </>
  )
}

function WeatherPointCard({ label, state }: { label: string; state: WeatherPointState }) {
  const { t } = useLanguage()

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.aiReport.weatherFetching(label)}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800">
        {t.aiReport.weatherUnavailable(label)}
      </div>
    )
  }

  const sea = seaState(state.waveHeight)
  const seaLabel =
    sea === 'calm'
      ? t.aiReport.seaStateCalm
      : sea === 'moderate'
        ? t.aiReport.seaStateModerate
        : sea === 'rough'
          ? t.aiReport.seaStateRough
          : t.aiReport.seaStateHigh

  return (
    <StatCard
      icon={Waves}
      label={label}
      value={`${state.windSpeed.toFixed(1)} m/s · ${state.waveHeight.toFixed(1)}m`}
      sublabel={seaLabel}
      accent={SEA_STATE_ACCENT[sea]}
    />
  )
}

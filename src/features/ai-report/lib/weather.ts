// AI_REPORT.md §6.7 — 실시간 기상(Open-Meteo) 조회 훅. 실제 fetch 로직은
// lib/weather-fetch.ts에 있다(서버 라우트도 그 파일을 직접 import해 재사용 — 이
// 파일은 react 훅을 쓰므로 서버 컴포넌트/라우트에서 import하면 안 된다).

import { useEffect, useState } from 'react'
import { fetchWeatherPoint, type WeatherPointResult } from '@/features/ai-report/lib/weather-fetch'

export type WeatherPointState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; windSpeed: number; windDir: number; waveHeight: number }

function toState(r: WeatherPointResult): WeatherPointState {
  return r.ok
    ? { status: 'ready', windSpeed: r.windSpeed, windDir: r.windDir, waveHeight: r.waveHeight }
    : { status: 'error' }
}

interface KeyedState {
  key: string
  state: WeatherPointState
}

// key가 최신 (lat,lng,refreshToken) 조합과 다르면 아직 그 조합의 fetch가 끝나지 않은
// 것이므로 렌더 중 loading으로 취급한다 — effect 안에서 동기적으로 setState({loading})를
// 호출해 리셋하지 않기 위한 파생 상태 패턴.
function useSinglePointWeather(lat: number, lng: number, refreshToken: number): WeatherPointState {
  const key = `${lat},${lng},${refreshToken}`
  const [keyed, setKeyed] = useState<KeyedState>({ key, state: { status: 'loading' } })

  useEffect(() => {
    let cancelled = false
    fetchWeatherPoint(lat, lng).then((r) => {
      if (!cancelled) setKeyed({ key, state: toState(r) })
    })
    return () => {
      cancelled = true
    }
  }, [lat, lng, refreshToken, key])

  return keyed.key === key ? keyed.state : { status: 'loading' }
}

// 재분석 시 좌표가 그대로여도 refreshToken을 올려 강제 재조회한다(§6.7).
export function useTwoPointWeather(
  current: { lat: number; lng: number },
  arrival: { lat: number; lng: number },
  refreshToken: number,
): [WeatherPointState, WeatherPointState] {
  const currentState = useSinglePointWeather(current.lat, current.lng, refreshToken)
  const arrivalState = useSinglePointWeather(arrival.lat, arrival.lng, refreshToken)
  return [currentState, arrivalState]
}

export type SeaState = 'calm' | 'moderate' | 'rough' | 'high'

export function seaState(waveHeightM: number): SeaState {
  if (waveHeightM < 1) return 'calm'
  if (waveHeightM < 2) return 'moderate'
  if (waveHeightM < 4) return 'rough'
  return 'high'
}

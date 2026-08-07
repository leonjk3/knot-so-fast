// AI_REPORT.md §6.7 — 실시간 기상(Open-Meteo) 조회. 현재 위치·도착항 두 지점에 대해
// 풍속/파고를 각각 8초 타임아웃으로 병렬 조회하고, 두 호출(풍속/파고) 중 하나만
// 실패해도 성공한 값만 표시한다(모두 실패했을 때만 에러로 취급).

import { useEffect, useState } from 'react'

const TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

interface WeatherPointResult {
  ok: boolean
  windSpeed: number
  windDir: number
  waveHeight: number
}

async function fetchWeatherPoint(lat: number, lng: number): Promise<WeatherPointResult> {
  const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`
  const waveUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height`

  const [windResult, waveResult] = await Promise.allSettled([fetchWithTimeout(windUrl), fetchWithTimeout(waveUrl)])

  let windSpeed = 0
  let windDir = 0
  let waveHeight = 0
  let windOk = false
  let waveOk = false

  if (windResult.status === 'fulfilled' && windResult.value.ok) {
    const data = await windResult.value.json()
    windSpeed = data?.current?.wind_speed_10m ?? 0
    windDir = data?.current?.wind_direction_10m ?? 0
    windOk = true
  }
  if (waveResult.status === 'fulfilled' && waveResult.value.ok) {
    const data = await waveResult.value.json()
    waveHeight = data?.current?.wave_height ?? 0
    waveOk = true
  }

  return { ok: windOk || waveOk, windSpeed, windDir, waveHeight }
}

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

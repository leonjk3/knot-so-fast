'use client'

// DASHBOARD.md 11.1장 — Open-Meteo는 CORS를 열어두므로 브라우저에서 직접 8지점을 조회한다.
// 지점별 실패는 허용하고 성공한 지점만 표시하되, 8곳이 전부 실패하면 화면이 비지 않도록
// MOCK_WEATHER_POINTS를 그대로 유지한다(DASHBOARD_PROMPTS.md 4-1 완료 확인).

import { useEffect, useState } from 'react'
import { fetchWeatherPoint } from '@/features/ai-report/lib/weather-fetch'
import { MOCK_WEATHER_POINTS, type WeatherPoint } from '@/mocks/map-overlays'

export function useMarineWeather(): WeatherPoint[] {
  const [points, setPoints] = useState<WeatherPoint[]>(MOCK_WEATHER_POINTS)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled(MOCK_WEATHER_POINTS.map((p) => fetchWeatherPoint(p.lat, p.lng))).then((results) => {
      if (cancelled) return

      const live: WeatherPoint[] = []
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          const point = MOCK_WEATHER_POINTS[i]
          live.push({
            name: point.name,
            lat: point.lat,
            lng: point.lng,
            windSpeed: result.value.windSpeed,
            windDir: result.value.windDir,
            waveHeight: result.value.waveHeight,
          })
        }
      })

      if (live.length > 0) setPoints(live)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return points
}

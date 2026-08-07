// Open-Meteo 조회의 순수 async 로직만 분리 — react를 import하지 않는다. 서버 라우트
// (app/api/ai-report/reanalyze/route.ts)가 이 파일을 직접 import하기 때문에, react
// 훅을 쓰는 lib/weather.ts를 그대로 가져오면 Next.js가 "client hook을 server component
// 에서 import" 오류를 낸다 — 그래서 훅 없는 부분만 이 파일로 뽑아둔다.

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

export interface WeatherPointResult {
  ok: boolean
  windSpeed: number
  windDir: number
  waveHeight: number
}

// 두 호출(풍속/파고) 중 하나만 실패해도 성공한 값만 표시하고, 모두 실패했을 때만
// ok:false로 취급한다(§6.7).
export async function fetchWeatherPoint(lat: number, lng: number): Promise<WeatherPointResult> {
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

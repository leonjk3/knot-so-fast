// AI_REPORT.md §7.3~7.4 — Gemini 재분석 서버 라우트.
// 검증 → Open-Meteo 재조회 → requiredSpeedKnots 계산(§6.3와 동일 함수) → Gemini 구조화
// 출력 → 서버측 속도 보정(불변식: 권장 속도는 항상 마감을 지키거나, 불가능하면 최고속력).

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { computeRequiredSpeedKnots } from '@/features/ai-report/lib/calc'
import { fetchWeatherPoint } from '@/features/ai-report/lib/weather-fetch'
import type { AiReanalyzeRequest, AiReanalyzeResponse } from '@/features/ai-report/types'
import type { RiskItem } from '@/shared/types'

const VALID_LEVELS = new Set(['high', 'medium', 'low'])
const VALID_CATEGORIES = new Set(['weather', 'port', 'geopolitical', 'mechanical'])

function isValidRequest(body: unknown): body is AiReanalyzeRequest {
  if (!body || typeof body !== 'object') return false
  const b = body as Partial<AiReanalyzeRequest>
  return Boolean(
    (b.lang === 'ko' || b.lang === 'en') &&
      b.vessel &&
      b.route &&
      typeof b.deadlineAt === 'string' &&
      typeof b.nowIso === 'string' &&
      typeof b.baselineEtaAt === 'string' &&
      b.speedRangeKnots &&
      Array.isArray(b.fuelCurve) &&
      b.congestion &&
      Array.isArray(b.nearbyIssues),
  )
}

function buildResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      recommendedSpeedKnots: { type: Type.NUMBER },
      reasoning: { type: Type.STRING },
      risks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
            category: { type: Type.STRING, enum: ['weather', 'port', 'geopolitical', 'mechanical'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ['level', 'category', 'title', 'description'],
        },
      },
    },
    required: ['recommendedSpeedKnots', 'reasoning', 'risks'],
  }
}

function buildPrompt(
  body: AiReanalyzeRequest,
  requiredSpeedKnots: number,
  weather: {
    current: { windSpeed: number | null; waveHeight: number | null }
    arrival: { windSpeed: number | null; waveHeight: number | null }
  },
): string {
  const hoursUntilDeadline = Math.max(
    0.01,
    (new Date(body.deadlineAt).getTime() - new Date(body.nowIso).getTime()) / 3600000,
  )
  const fuelCurveText = body.fuelCurve.map((f) => `${f.speedKnots}kts -> ${f.fuelTonPerDay} ton/day`).join(', ')
  const issuesText = body.nearbyIssues.length
    ? body.nearbyIssues.map((i) => `- [${i.severity}] ${i.title}: ${i.description}`).join('\n')
    : '(none reported)'
  const requiredSpeedNote =
    requiredSpeedKnots > body.speedRangeKnots.max
      ? `Required average speed to meet the deadline is ${requiredSpeedKnots}kts, which EXCEEDS this vessel's max feasible speed (${body.speedRangeKnots.max}kts) -- the deadline cannot be met even at full speed. In this case you MUST recommend exactly ${body.speedRangeKnots.max}kts (the max feasible speed) as the best effort, and explain in the reasoning that even max speed cannot meet the deadline.`
      : `Required average speed to meet the deadline is ${requiredSpeedKnots}kts (feasible). Your recommendedSpeedKnots MUST be >= ${requiredSpeedKnots}kts so the deadline is met with zero or positive margin -- never recommend a speed below this, even to save fuel.`

  return `You are a maritime voyage-optimization analyst for a shipping line. Given the following REAL-TIME voyage
data, recommend an optimal speed and produce a concise, grounded operational analysis. Only reference facts
given below -- do not invent vessel incidents, ports, or figures not present here. Treat the numbers below
(especially the required-speed constraint) as ground truth -- do not recompute them differently yourself.

Vessel: ${body.vessel.name} (${body.vessel.type}, IMO ${body.vessel.imo})
Feasible speed range: ${body.speedRangeKnots.min}-${body.speedRangeKnots.max}kts
Fuel consumption curve (speed -> daily fuel use, lower speed = more efficient): ${fuelCurveText}
Route: ${body.route.departurePort} -> ${body.route.arrivalPort}
Cargo: ${body.route.cargoDescription}
Original planned speed: ${body.planSpeedKnots}kts
Rule-based baseline recommended speed (for reference only, you may deviate from it as long as you respect
the required-speed constraint below): ${body.baselineRecommendedSpeedKnots}kts
Deadline (${body.deadlineTerm}): ${body.deadlineAt} (${hoursUntilDeadline.toFixed(1)}h from now)
Progress: ${body.progress.traveledNm}nm traveled / ${body.progress.remainingNm}nm remaining of ${body.progress.totalNm}nm total (${body.progress.progressPercent.toFixed(1)}%)
Current speed: ${body.currentSpeedKnots}kts -- ${body.deadlineTerm} compliance probability at current speed:
${body.currentSpeedProbabilityPercent}% (margin ${body.marginHoursAtCurrentSpeed.toFixed(1)}h)
${requiredSpeedNote}
Current position weather: wind ${weather.current.windSpeed ?? 'unknown'} m/s, wave height ${weather.current.waveHeight ?? 'unknown'} m
Arrival port weather: wind ${weather.arrival.windSpeed ?? 'unknown'} m/s, wave height ${weather.arrival.waveHeight ?? 'unknown'} m
Arrival port congestion: ${body.congestion.level} (score ${body.congestion.score}/100), avg wait ${body.congestion.avgWaitHours}h, berths available
${body.congestion.berthsAvailable}/${body.congestion.berthsTotal}, trend ${body.congestion.trend}
Regional issues near the remaining route:
${issuesText}

Recommend a speed (knots, within the feasible range above) that balances:
- Meeting the ${body.deadlineTerm} deadline per the required-speed constraint above (this is a hard floor, not a
  suggestion).
- Above that floor, minimizing fuel burn per the fuel curve -- do not recommend faster than necessary if
  there is schedule slack above the floor, especially if the arrival port is congested (arriving early into
  a congested port wastes fuel for no benefit).
- Weather/sea-state safety -- if wave height is high, mention the tradeoff, but you may still need to stay
  at or above the required-speed floor to meet the deadline.

Write the response in ${body.lang === 'ko' ? 'Korean' : 'English'}.
Produce:
1. "recommendedSpeedKnots": the single recommended speed in knots (a number, within the feasible range,
   respecting the required-speed constraint above).
2. "reasoning": a 2-4 sentence operational analysis explaining WHY that speed was chosen (schedule margin,
   congestion, weather, fuel efficiency), explicitly referencing the real figures above -- the speed you
   state here MUST match recommendedSpeedKnots exactly. Put each distinct point on its own line (use \\n
   between sentences).
3. "risks": 1-4 risk items synthesized strictly from the weather/congestion/regional-issue data above (skip
   categories with nothing to report; never invent unrelated risks). Each item needs a level
   (high/medium/low), a category (weather/port/geopolitical/mechanical), a short title, and a one-sentence
   description.`
}

// 모델이 범위를 벗어나거나 마감을 못 지키는 속도를 제안해도, 서버가 항상 보정한다.
function clampSpeed(rawSpeed: number, min: number, max: number, requiredSpeedKnots: number): number {
  if (requiredSpeedKnots > max) return Math.round(max * 10) / 10
  const clamped = Math.min(max, Math.max(min, rawSpeed))
  return Math.min(max, Math.max(requiredSpeedKnots, Math.round(clamped * 10) / 10))
}

function ensureLineBreaks(text: string): string {
  return text.includes('\n') ? text : text.replace(/([.!?])\s+/g, '$1\n')
}

interface RawRisk {
  level?: unknown
  category?: unknown
  title?: unknown
  description?: unknown
}

function sanitizeRisks(raw: unknown): RiskItem[] {
  if (!Array.isArray(raw)) return []
  const result: RiskItem[] = []
  for (const item of raw as RawRisk[]) {
    const { level, category, title, description } = item ?? {}
    if (
      typeof level === 'string' &&
      VALID_LEVELS.has(level) &&
      typeof category === 'string' &&
      VALID_CATEGORIES.has(category) &&
      typeof title === 'string' &&
      typeof description === 'string'
    ) {
      result.push({ level: level as RiskItem['level'], category: category as RiskItem['category'], title, description })
    }
    if (result.length >= 6) break
  }
  return result
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'bad_request' }, { status: 400 })
  }

  if (!isValidRequest(body)) {
    return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'bad_request' }, { status: 400 })
  }

  const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true'
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (useVertex ? !process.env.GOOGLE_CLOUD_PROJECT : !apiKey) {
    return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'no_api_key' })
  }

  const [currentWeather, arrivalWeather] = await Promise.all([
    fetchWeatherPoint(body.currentPos.lat, body.currentPos.lng),
    fetchWeatherPoint(body.arrivalPos.lat, body.arrivalPos.lng),
  ])
  const weather = {
    current: {
      windSpeed: currentWeather.ok ? currentWeather.windSpeed : null,
      waveHeight: currentWeather.ok ? currentWeather.waveHeight : null,
    },
    arrival: {
      windSpeed: arrivalWeather.ok ? arrivalWeather.windSpeed : null,
      waveHeight: arrivalWeather.ok ? arrivalWeather.waveHeight : null,
    },
  }

  const requiredSpeedKnots = computeRequiredSpeedKnots(
    body.baselineRecommendedSpeedKnots,
    body.baselineEtaAt,
    body.nowIso,
    body.deadlineAt,
  )

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

  try {
    const ai = useVertex
      ? new GoogleGenAI({
          vertexai: true,
          project: process.env.GOOGLE_CLOUD_PROJECT,
          location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
        })
      : new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(body, requiredSpeedKnots, weather),
      config: {
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(),
      },
    })

    const rawText = response.text
    if (!rawText) return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'upstream_error' })

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'upstream_error' })
    }

    const p = parsed as { recommendedSpeedKnots?: unknown; reasoning?: unknown; risks?: unknown }
    if (typeof p.recommendedSpeedKnots !== 'number' || !Number.isFinite(p.recommendedSpeedKnots) || typeof p.reasoning !== 'string') {
      return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'upstream_error' })
    }

    const risks = sanitizeRisks(p.risks)
    if (risks.length === 0) {
      return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'upstream_error' })
    }

    const finalSpeed = clampSpeed(p.recommendedSpeedKnots, body.speedRangeKnots.min, body.speedRangeKnots.max, requiredSpeedKnots)
    let reasoning = ensureLineBreaks(p.reasoning)
    if (Math.abs(finalSpeed - p.recommendedSpeedKnots) >= 0.05) {
      reasoning +=
        body.lang === 'ko'
          ? `\n(참고: ${body.deadlineTerm} 준수를 위해 필요한 속도 기준으로 ${finalSpeed}kts로 자동 보정되었습니다.)`
          : `\n(Note: automatically adjusted to ${finalSpeed}kts to meet the ${body.deadlineTerm} deadline.)`
    }

    return NextResponse.json<AiReanalyzeResponse>({ ok: true, reasoning, risks, recommendedSpeedKnots: finalSpeed, model })
  } catch {
    return NextResponse.json<AiReanalyzeResponse>({ ok: false, reason: 'upstream_error' })
  }
}

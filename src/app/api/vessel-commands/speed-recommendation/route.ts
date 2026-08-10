// DASHBOARD.md 6.4장 — 실제 외부 시스템으로 전송하지 않는 데모용 시뮬레이션 라우트.
// 900~1400ms 인위적 지연 후 항상 성공 응답을 준다. targetUrl은 placeholder 문자열이다.

import { NextResponse } from 'next/server'
import type { SpeedRecommendationRequest, SpeedRecommendationResult } from '@/features/dashboard/speedRecommendation'

function isValidRequest(body: unknown): body is SpeedRecommendationRequest {
  if (!body || typeof body !== 'object') return false
  const b = body as Partial<SpeedRecommendationRequest>
  return (
    typeof b.vesselId === 'string' &&
    typeof b.vesselName === 'string' &&
    typeof b.imo === 'string' &&
    typeof b.voyageId === 'string' &&
    typeof b.departurePort === 'string' &&
    typeof b.arrivalPort === 'string' &&
    typeof b.currentSpeedKnots === 'number' &&
    typeof b.recommendedSpeedKnots === 'number' &&
    typeof b.plannedSpeedKnots === 'number' &&
    typeof b.eta === 'string'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<SpeedRecommendationResult>({ success: false }, { status: 400 })
  }

  if (!isValidRequest(body)) {
    return NextResponse.json<SpeedRecommendationResult>({ success: false }, { status: 400 })
  }

  await sleep(900 + Math.random() * 500)

  return NextResponse.json<SpeedRecommendationResult>({
    success: true,
    targetUrl: `https://fleet-ops.ksf-line.internal/commands/${body.voyageId}`,
    sentAt: new Date().toISOString(),
  })
}

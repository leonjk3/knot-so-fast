// AI_REPORT.md §7.2 — 클라이언트→서버 재분석 요청/응답 계약. route.ts와 ReportCard.tsx
// 양쪽에서 이 타입만 사용해 어긋나지 않게 한다.

import type { RiskItem } from '@/shared/types'

export interface AiReanalyzeRequest {
  lang: 'ko' | 'en'
  vessel: { name: string; type: string; imo: string }
  route: { departurePort: string; arrivalPort: string; cargoDescription: string }
  deadlineTerm: 'RTA' | 'STA'
  deadlineAt: string
  nowIso: string
  baselineEtaAt: string
  progress: { totalNm: number; traveledNm: number; remainingNm: number; progressPercent: number }
  currentPos: { lat: number; lng: number }
  arrivalPos: { lat: number; lng: number }
  currentSpeedKnots: number
  currentSpeedProbabilityPercent: number
  marginHoursAtCurrentSpeed: number
  planSpeedKnots: number
  baselineRecommendedSpeedKnots: number
  speedRangeKnots: { min: number; max: number }
  fuelCurve: { speedKnots: number; fuelTonPerDay: number }[]
  congestion: {
    level: 'low' | 'medium' | 'high'
    score: number
    avgWaitHours: number
    berthsAvailable: number
    berthsTotal: number
    trend: 'rising' | 'stable' | 'falling'
  }
  nearbyIssues: { title: string; description: string; severity: 'high' | 'medium' | 'low' }[]
}

export type AiReanalyzeResponse =
  | { ok: true; reasoning: string; risks: RiskItem[]; recommendedSpeedKnots: number; model: string }
  | { ok: false; reason: 'bad_request' | 'no_api_key' | 'upstream_error' }

// 클라이언트 상태로만 유지되는 override — mock 데이터 자체는 바꾸지 않는다(§7.5).
export interface AiOverride {
  reasoning: string
  risks: RiskItem[]
  recommendedSpeedKnots: number
  lang: 'ko' | 'en'
}

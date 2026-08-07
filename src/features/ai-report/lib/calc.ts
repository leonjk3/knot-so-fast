// AI_REPORT.md §6 — 순수 계산 함수. 화면 렌더링과 재분석 요청 컨텍스트(§7) 양쪽에서
// 반드시 이 모듈만 재사용한다 (KNOWN_PITFALLS §5.2: 화면마다 다른 공식을 쓰면 같은
// 항차가 다른 확률로 보이는 사고가 있었다).

import { interpolateFuelTonPerDay, fuelEmissionFactor } from '@/shared/utils/format'
import type { Vessel, Voyage, EcoSpeedReport, Waypoint, RegionalIssue } from '@/shared/types'

const EARTH_RADIUS_NM = 3440.065

interface LatLng {
  lat: number
  lng: number
}

// 대권 거리(해리)
export function haversineNm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function findClosestIndex(routePoints: Waypoint[], pos: LatLng): number {
  let bestIdx = 0
  let bestDist = Infinity
  routePoints.forEach((p, i) => {
    const d = haversineNm(p, pos)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  })
  return bestIdx
}

export interface VoyageProgress {
  traveled: number
  remaining: number
  percent: number
}

export function computeVoyageProgress(
  routePoints: Waypoint[],
  totalDistanceNm: number,
  position?: LatLng,
): VoyageProgress {
  if (!position || routePoints.length < 2) {
    return { traveled: 0, remaining: totalDistanceNm, percent: 0 }
  }
  const idx = findClosestIndex(routePoints, position)
  let traveled = 0
  for (let i = 0; i < idx; i++) {
    traveled += haversineNm(routePoints[i], routePoints[i + 1])
  }
  traveled += haversineNm(routePoints[idx], position)
  traveled = Math.min(traveled, totalDistanceNm)
  const remaining = Math.max(totalDistanceNm - traveled, 0)
  const percent = totalDistanceNm > 0 ? (traveled / totalDistanceNm) * 100 : 0
  return { traveled, remaining, percent }
}

// 현재 위치부터 도착지까지 남은 항로만 추출 (인근 이슈 탐색용, §6.6)
export function remainingRoute(routePoints: Waypoint[], position?: LatLng): Waypoint[] {
  if (!position || routePoints.length < 2) return routePoints
  const idx = findClosestIndex(routePoints, position)
  return routePoints.slice(idx)
}

export interface ProbabilityResult {
  percent: number
  confidence: 'high' | 'medium' | 'low'
  marginHours: number
}

export function marginToProbability(marginHours: number): ProbabilityResult {
  if (marginHours >= 0) return { percent: 100, confidence: 'high', marginHours }
  const percent = Math.min(49, Math.max(3, Math.round(50 + marginHours * 4)))
  const confidence = percent >= 40 ? 'medium' : 'low'
  return { percent, confidence, marginHours }
}

// 마감시각에 정확히 맞추려면 지금부터 평균 몇 노트로 가야 하는지 (앵커 비율 방식)
export function computeRequiredSpeedKnots(
  anchorSpeedKnots: number,
  anchorEtaIso: string,
  nowIso: string,
  deadlineIso: string,
): number {
  const nowMs = new Date(nowIso).getTime()
  const anchorHours = Math.max(0.01, (new Date(anchorEtaIso).getTime() - nowMs) / 3600000)
  const hoursUntilDeadline = Math.max(0.01, (new Date(deadlineIso).getTime() - nowMs) / 3600000)
  const raw = (anchorSpeedKnots * anchorHours) / hoursUntilDeadline
  return Math.ceil(raw * 10) / 10
}

function etaMsAtSpeed(anchorSpeedKnots: number, anchorHours: number, nowMs: number, speedKnots: number): number {
  const hours = anchorHours * (anchorSpeedKnots / speedKnots)
  return nowMs + hours * 3600000
}

export interface SpeedPlan {
  recommendedSpeedKnots: number
  requiredSpeedKnots: number
  hoursUntilDeadline: number
  currentSpeedProbability: ProbabilityResult
  recommendedSpeedProbability: ProbabilityResult
  etaAtCurrent: string
  etaAtRecommended: string
  fuelSavingPercent: number
  co2SavedTon: number
  fuelSavingPercentFromCurrent: number
  co2SavedTonFromCurrent: number
}

// 리포트 하나를 펼쳤을 때 필요한 파생 수치를 한 번에 계산 (§6.4)
export function computeSpeedPlan(input: {
  vessel: Vessel
  voyage: Voyage
  report: EcoSpeedReport
  remainingNm: number
  currentSpeedKnots: number
  nowIso: string
  deadlineIso: string
  aiRecommendedSpeedKnots?: number
}): SpeedPlan {
  const { vessel, voyage, report, remainingNm, currentSpeedKnots, nowIso, deadlineIso, aiRecommendedSpeedKnots } =
    input
  const nowMs = new Date(nowIso).getTime()
  const deadlineMs = new Date(deadlineIso).getTime()
  const recommendedSpeedKnots = aiRecommendedSpeedKnots ?? report.recommendedSpeed

  // ① 세 시나리오의 ETA를 앵커 비율로 환산 — remainingNm / speed로 직접 나누지 않는다
  // (mock 데이터가 물리적으로 완전히 들어맞지 않아 시나리오마다 어긋난다)
  const anchorHours = Math.max(0.01, (new Date(report.etaIfRecommended).getTime() - nowMs) / 3600000)
  const etaAtRecommendedMs = etaMsAtSpeed(report.recommendedSpeed, anchorHours, nowMs, recommendedSpeedKnots)
  const etaAtCurrentMs = etaMsAtSpeed(report.recommendedSpeed, anchorHours, nowMs, currentSpeedKnots)

  const recommendedSpeedProbability = marginToProbability((deadlineMs - etaAtRecommendedMs) / 3600000)
  const currentSpeedProbability = marginToProbability((deadlineMs - etaAtCurrentMs) / 3600000)

  // ② 필요 속도
  const requiredSpeedKnots = computeRequiredSpeedKnots(
    report.recommendedSpeed,
    report.etaIfRecommended,
    nowIso,
    deadlineIso,
  )

  // ③ 연료/CO₂ 절감 (최초 계획 속도 대비) — 일정 마진과 무관, 실제 연료 차이만 본다
  const planDailyRate = interpolateFuelTonPerDay(vessel.fuelCurve, report.currentPlanSpeed)
  const recDailyRate = interpolateFuelTonPerDay(vessel.fuelCurve, recommendedSpeedKnots)
  const planFuelTon = planDailyRate * (remainingNm / report.currentPlanSpeed / 24)
  const recFuelTon = recDailyRate * (remainingNm / recommendedSpeedKnots / 24)
  const fuelSavedTon = planFuelTon - recFuelTon
  const fuelSavingPercent = planFuelTon > 0 ? (fuelSavedTon / planFuelTon) * 100 : 0
  const co2SavedTon = fuelSavedTon * fuelEmissionFactor(voyage.fuelType)

  // ④ 연료/CO₂ 절감 (현재 실시간 속도 대비)
  const currentDailyRate = interpolateFuelTonPerDay(vessel.fuelCurve, currentSpeedKnots)
  const currentLiveFuelTon = currentDailyRate * (remainingNm / currentSpeedKnots / 24)
  const fuelSavedTonFromCurrent = currentLiveFuelTon - recFuelTon
  const fuelSavingPercentFromCurrent =
    currentLiveFuelTon > 0 ? (fuelSavedTonFromCurrent / currentLiveFuelTon) * 100 : 0
  const co2SavedTonFromCurrent = fuelSavedTonFromCurrent * fuelEmissionFactor(voyage.fuelType)

  return {
    recommendedSpeedKnots,
    requiredSpeedKnots,
    hoursUntilDeadline: Math.max(0.01, (deadlineMs - nowMs) / 3600000),
    currentSpeedProbability,
    recommendedSpeedProbability,
    etaAtCurrent: new Date(etaAtCurrentMs).toISOString(),
    etaAtRecommended: new Date(etaAtRecommendedMs).toISOString(),
    fuelSavingPercent,
    co2SavedTon,
    fuelSavingPercentFromCurrent,
    co2SavedTonFromCurrent,
  }
}

// 남은 항로(§6.1 remainingRoute) 600nm 이내의 지역 이슈만
export function nearbyIssues(
  remainingRoutePoints: Waypoint[],
  issues: RegionalIssue[],
  thresholdNm = 600,
): RegionalIssue[] {
  return issues.filter((issue) => remainingRoutePoints.some((p) => haversineNm(p, issue) <= thresholdNm))
}

// "부산 (Busan)" -> "부산"
export function portShortName(label: string): string {
  return label.split(' ')[0]
}

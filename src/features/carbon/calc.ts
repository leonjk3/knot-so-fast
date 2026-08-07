// CARBON.md §5 — 순수 계산 함수. 선택된 항차 1건에서 모든 값이 파생된다. 이 순서대로
// 계산하면 의존 관계가 자연히 맞는다: 배출량 실계산 → 3원 비교 → Scope3 절감량 →
// (추이 / 시뮬레이터 / 대기탄소 / 랭킹 / 재미요소 / 배지)는 전부 그 이후 파생.

import { interpolateFuelTonPerDay, fuelEmissionFactor } from '@/shared/utils/format'
import type { Vessel, Voyage } from '@/shared/types'
import {
  MOCK_CII_SCORE_BY_VOYAGE,
  DEFAULT_CII_SCORE,
  CARBON_HIST_MULTIPLIER,
  CARBON_BENCHMARK_MULTIPLIER,
  CII_SCORE_HIST_MULTIPLIER,
  CII_SCORE_BENCHMARK_MULTIPLIER,
  CII_GRADES,
  ANCHOR_REFERENCE_CO2_TON,
  COMPLIANCE_BASE_KRW,
  MOCK_FLEET_ECO_RANKING,
  CARBON_PRICE_KRW_PER_TON,
  CAN_BADGES,
  CO2_TREE_ABSORB_TON_PER_YEAR,
  CO2_CAR_TON_PER_KM,
  EARTH_CIRCUMFERENCE_KM,
  CO2_CHICKEN_TON,
  type CiiGrade,
} from '@/features/carbon/constants'

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

// §3.3 — 점수가 낮을수록 좋은 등급이다.
export function ciiGradeFromScore(score: number): CiiGrade {
  if (score < 3.5) return 'A'
  if (score < 4.0) return 'B'
  if (score < 4.95) return 'C'
  if (score < 5.6) return 'D'
  return 'E'
}

export interface Emissions {
  baseCiiScore: number
  totalFuelTon: number
  totalCo2Ton: number
}

// §5.2 — 기준 속도는 recommendedSpeedKnots다(계획 속도가 아니다).
export function computeEmissions(vessel: Vessel, voyage: Voyage): Emissions {
  const baseCiiScore = MOCK_CII_SCORE_BY_VOYAGE[voyage.id] ?? DEFAULT_CII_SCORE
  const dailyFuelRate = interpolateFuelTonPerDay(vessel.fuelCurve, voyage.recommendedSpeedKnots)
  const totalFuelTon = dailyFuelRate * (voyage.distanceNm / voyage.recommendedSpeedKnots / 24)
  const totalCo2Ton = totalFuelTon * fuelEmissionFactor(voyage.fuelType)
  return { baseCiiScore, totalFuelTon, totalCo2Ton }
}

export interface ComparisonRow {
  avgCiiScore: number
  totalFuelTon: number
  totalCo2Ton: number
  ciiGrade: CiiGrade
}

export interface ThreeWayComparison {
  current: ComparisonRow
  historical: ComparisonRow
  benchmark: ComparisonRow
}

// §5.3 — CII 점수와 연료·CO₂는 배수가 다르다. 헷갈리지 말 것.
export function computeThreeWayComparison(emissions: Emissions): ThreeWayComparison {
  const { baseCiiScore, totalFuelTon, totalCo2Ton } = emissions
  const current: ComparisonRow = {
    avgCiiScore: baseCiiScore,
    totalFuelTon,
    totalCo2Ton,
    ciiGrade: ciiGradeFromScore(baseCiiScore),
  }
  const historicalScore = baseCiiScore * CII_SCORE_HIST_MULTIPLIER
  const historical: ComparisonRow = {
    avgCiiScore: historicalScore,
    totalFuelTon: totalFuelTon * CARBON_HIST_MULTIPLIER,
    totalCo2Ton: totalCo2Ton * CARBON_HIST_MULTIPLIER,
    ciiGrade: ciiGradeFromScore(historicalScore),
  }
  const benchmarkScore = baseCiiScore * CII_SCORE_BENCHMARK_MULTIPLIER
  const benchmark: ComparisonRow = {
    avgCiiScore: benchmarkScore,
    totalFuelTon: totalFuelTon * CARBON_BENCHMARK_MULTIPLIER,
    totalCo2Ton: totalCo2Ton * CARBON_BENCHMARK_MULTIPLIER,
    ciiGrade: ciiGradeFromScore(benchmarkScore),
  }
  return { current, historical, benchmark }
}

export interface Scope3 {
  scope3SavedTon: number
  scope3SavedPct: number
}

// §5.4 — 모든 게이미피케이션 요소가 이 값 하나에서 파생된다. 배수가 고정이므로
// scope3SavedPct는 항차가 달라져도 항상 약 17.66%로 일정하다 — 버그 아님.
export function computeScope3(comparison: ThreeWayComparison): Scope3 {
  const { current, benchmark } = comparison
  const scope3SavedTon = benchmark.totalCo2Ton - current.totalCo2Ton
  const scope3SavedPct = (1 - current.totalCo2Ton / benchmark.totalCo2Ton) * 100
  return { scope3SavedTon, scope3SavedPct }
}

// §5.5 — 7개월치를 현재 점수로 끝나도록 역산해 생성한다(18% 개선 우하향 곡선).
export function computeCiiTrend(baseCiiScore: number): number[] {
  return Array.from({ length: 7 }, (_, i) => round2(baseCiiScore * (1.18 - 0.18 * (i / 6))))
}

export interface CiiSimulator {
  nextBetterGrade: CiiGrade | null
  current: { speedKts: number; grade: CiiGrade }
  optimized: { speedKts: number; grade: CiiGrade }
  avoidedGrade: CiiGrade
  complianceRiskKrw: number
  complianceAmountLabel: string
}

// §5.6
export function computeCiiSimulator(voyage: Voyage, currentGrade: CiiGrade, baseCiiScore: number, totalCo2Ton: number): CiiSimulator {
  const gradeIdx = CII_GRADES.indexOf(currentGrade)
  const nextBetterGrade = gradeIdx > 0 ? CII_GRADES[gradeIdx - 1] : null
  const optimizedScore = round2(baseCiiScore * 0.85)
  const avoidedGrade = gradeIdx < 4 ? CII_GRADES[gradeIdx + 1] : currentGrade
  const complianceRiskKrw = COMPLIANCE_BASE_KRW * (totalCo2Ton / ANCHOR_REFERENCE_CO2_TON)
  return {
    nextBetterGrade,
    current: { speedKts: voyage.plannedSpeedKnots, grade: currentGrade },
    optimized: { speedKts: voyage.recommendedSpeedKnots, grade: ciiGradeFromScore(optimizedScore) },
    avoidedGrade,
    complianceRiskKrw,
    complianceAmountLabel: `${(complianceRiskKrw / 1e8).toFixed(0)}억원`,
  }
}

export interface AnchorScenario {
  baseline: { sailingCo2Ton: number; anchorCo2Ton: number; anchorDays: number }
  optimized: { sailingCo2Ton: number; anchorCo2Ton: number; anchorDays: number }
  anchorSavedTon: number
}

// §5.7 — voy001의 원본 예시(3,976.4t) 대비 비율로 선택 항차의 실제 총량에 맞춰 환산.
export function computeAnchorScenario(totalCo2Ton: number): AnchorScenario {
  const anchorScale = totalCo2Ton / ANCHOR_REFERENCE_CO2_TON
  const baseline = {
    sailingCo2Ton: round1(100 * anchorScale),
    anchorCo2Ton: round1(30 * anchorScale),
    anchorDays: 3,
  }
  const optimized = {
    sailingCo2Ton: round1(85 * anchorScale),
    anchorCo2Ton: 0,
    anchorDays: 0,
  }
  const baselineTotal = baseline.sailingCo2Ton + baseline.anchorCo2Ton
  const optimizedTotal = optimized.sailingCo2Ton + optimized.anchorCo2Ton
  return { baseline, optimized, anchorSavedTon: baselineTotal - optimizedTotal }
}

export interface FleetRankingEntry {
  vesselId: string
  vesselName: string
  co2SavedPct: number
  co2SavedTon: number
  isCurrent: boolean
}

// §5.8 — 선택 선박은 목업 목록에서 먼저 제거한 뒤 실계산값을 끼워 넣는다(중복 방지).
export function computeFleetRanking(
  selectedVessel: Vessel,
  scope3: Scope3,
  vessels: Vessel[],
): { ranking: FleetRankingEntry[]; rank: number } {
  const findVesselName = (id: string) => vessels.find((v) => v.id === id)?.name ?? id
  const ranking: FleetRankingEntry[] = [
    {
      vesselId: selectedVessel.id,
      vesselName: selectedVessel.name,
      co2SavedPct: scope3.scope3SavedPct,
      co2SavedTon: scope3.scope3SavedTon,
      isCurrent: true,
    },
    ...MOCK_FLEET_ECO_RANKING.filter((r) => r.vesselId !== selectedVessel.id).map((r) => ({
      vesselId: r.vesselId,
      vesselName: findVesselName(r.vesselId),
      co2SavedPct: r.co2SavedPct,
      co2SavedTon: r.co2SavedTon,
      isCurrent: false,
    })),
  ].sort((a, b) => b.co2SavedPct - a.co2SavedPct)

  const rank = ranking.findIndex((r) => r.isCurrent) + 1
  return { ranking, rank }
}

// §5.8 — v >= 1e8: "N.N억원" / v >= 1e4: "N만원" / else: "N원"
export function formatKrwCompact(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억원`
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만원`
  return `${Math.round(v).toLocaleString()}원`
}

export function co2SavedValueKrw(co2SavedTon: number): number {
  return co2SavedTon * CARBON_PRICE_KRW_PER_TON
}

export interface FunFacts {
  trees: number
  earthLaps: number
  chickens: number
}

// §5.9
export function computeFunFacts(scope3SavedTon: number): FunFacts {
  return {
    trees: Math.round(scope3SavedTon / CO2_TREE_ABSORB_TON_PER_YEAR),
    earthLaps: scope3SavedTon / CO2_CAR_TON_PER_KM / EARTH_CIRCUMFERENCE_KM,
    chickens: Math.round(scope3SavedTon / CO2_CHICKEN_TON),
  }
}

export interface BadgeProgress {
  unlocked: boolean[]
  nextBadgeIdx: number
  canFillHeightPct: number
}

// §5.10 — 캔 채움 높이는 0%일 때도 액체가 보이도록 최소 4%로 clamp.
export function computeBadgeProgress(scope3SavedPct: number): BadgeProgress {
  const unlocked = CAN_BADGES.map((b) => scope3SavedPct >= b.threshold)
  const nextBadgeIdx = CAN_BADGES.findIndex((b) => scope3SavedPct < b.threshold)
  const canFillHeightPct = Math.min(100, Math.max(4, scope3SavedPct))
  return { unlocked, nextBadgeIdx, canFillHeightPct }
}

import type { AisPosition, EcoSpeedReport, Vessel, Voyage } from '@/shared/types'
import { computeVoyageProgress, computeSpeedPlan, type ProbabilityResult } from '@/features/ai-report/lib/calc'

export interface RtaProbabilityResult extends ProbabilityResult {
  term: 'RTA' | 'STA'
}

// AI 운항 리포팅과 완전히 동일한 함수(computeSpeedPlan)를 재사용한다 — 화면마다 따로
// 계산하면 같은 항차가 다른 확률로 보이는 사고가 난다 (KNOWN_PITFALLS.md 5.2장).
export function getRtaProbability(
  voyage: Voyage,
  reports: EcoSpeedReport[],
  vessels: Vessel[],
  positions: AisPosition[],
): RtaProbabilityResult | null {
  const report = reports.find((r) => r.voyageId === voyage.id)
  const vessel = vessels.find((v) => v.id === voyage.vesselId)
  if (!report || !vessel) return null // 신규 등록 항차는 리포트가 없어 항상 null

  const position = positions.find((p) => p.vesselId === voyage.vesselId)
  const progress = computeVoyageProgress(voyage.plannedRoute, voyage.distanceNm, position)
  const currentSpeed = position?.speedKnots ?? report.currentPlanSpeed
  const term: 'RTA' | 'STA' = voyage.rtaConfirmed ? 'RTA' : 'STA'
  const deadlineIso = voyage.rtaConfirmed ? voyage.rta : voyage.sta // 유일한 분기 지점

  const plan = computeSpeedPlan({
    vessel,
    voyage,
    report,
    remainingNm: progress.remaining,
    currentSpeedKnots: currentSpeed,
    nowIso: report.generatedAt,
    deadlineIso,
  })

  return { ...plan.currentSpeedProbability, term }
}

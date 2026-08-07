import type { PortCongestionLevel } from '@/features/simulation/constants'

export type SimRoute = 'suez' | 'cape'

// §3.1 — 초안·적용 두 벌로 관리하는 시뮬레이션 입력 8종.
export interface SimInputs {
  voyageId: string
  departureOffset: number // 시간, -24 ~ +72
  speedKnots: number // 10 ~ 20
  cargoPercent: number // 30 ~ 100
  route: SimRoute
  portCongestion: PortCongestionLevel
  berthProgress: number // 0 ~ 100 (%)
  compareVoyageId: string // 빈 문자열이면 비교 안 함
}

export interface SimulationResult {
  fuel: number
  days: number
  cost: number
  co2: number
}

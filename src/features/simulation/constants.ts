// SIMULATION.md §3.2 — 재현용 상수. 이 화면은 선박별 fuelCurve를 쓰지 않고 모든 선박
// 공통의 단순 3제곱 법칙 모델을 쓴다(§1.3) — 다른 화면과 연료·CO₂ 값이 일치하지 않는
// 것이 정상이다.

export type PortCongestionLevel = 'low' | 'medium' | 'high' | 'severe'

export const FUEL_PRICE_USD_TON = 580
export const CANAL_TOLL_USD = 420_000
export const CAPE_DISTANCE_FACTOR = 1.28
export const BASE_FUEL_PER_DAY = 140
export const REFERENCE_SPEED_KNOTS = 14
export const CO2_FACTOR = 3.114

export const AVG_BERTH_UNLOAD_HOURS = 30
export const WAIT_COST_USD_PER_HOUR = 3_000

export const CONGESTION_WAIT_HOURS: Record<PortCongestionLevel, number> = {
  low: 0,
  medium: 8,
  high: 20,
  severe: 40,
}

export const CONGESTION_LEVELS: PortCongestionLevel[] = ['low', 'medium', 'high', 'severe']

// 0.5 간격 21개 (10~20kts) — 속도 커브 차트용
export const SPEED_RANGE: number[] = Array.from({ length: 21 }, (_, i) => 10 + i * 0.5)

// CARBON.md §3.2 — 재현용 상수. 전부 정적 상수로 두고 DB로 이관하지 않는다.

export type CiiGrade = 'A' | 'B' | 'C' | 'D' | 'E'

// 항차별 CII 점수 목업 기준값. 없는 항차의 기본값은 4.5.
export const MOCK_CII_SCORE_BY_VOYAGE: Record<string, number> = {
  voy001: 4.5, // KSF PIONEER   · 부산→로테르담      · C
  voy002: 3.3, // KSF NAVIGATOR · 상하이→LA          · A
  voy003: 4.7, // KSF VENTURE   · 포트헤들랜드→광양   · C
  voy004: 5.35, // KSF HORIZON   · 라스타누라→울산     · D
  voy005: 3.95, // KSF PIONEER   · 함부르크→부산       · B
  voy006: 5.75, // KSF NAVIGATOR · 오클랜드→부산       · E
}
export const DEFAULT_CII_SCORE = 4.5

// 3원 비교 배수 — CII 점수와 연료·CO₂는 서로 다른 배수를 쓴다(혼동 금지).
export const CARBON_HIST_MULTIPLIER = 1.1048
export const CARBON_BENCHMARK_MULTIPLIER = 1.2145
export const CII_SCORE_HIST_MULTIPLIER = 1.0711
export const CII_SCORE_BENCHMARK_MULTIPLIER = 1.1378

// 비교 라벨 — 다국어 사전을 거치지 않는 고정 한국어(스펙 §9 명시).
export const CARBON_COMPARISON_LABELS = {
  historicalAvg: '동일 선박 최근 5항차 평균',
  benchmarkAvg: '유사 선박 동일 항로 평균',
}

// 함대 에코 랭킹 목업
export interface FleetEcoRankingEntry {
  vesselId: string
  co2SavedPct: number
  co2SavedTon: number
}
export const MOCK_FLEET_ECO_RANKING: FleetEcoRankingEntry[] = [
  { vesselId: 'v001', co2SavedPct: 17.7, co2SavedTon: 852.8 },
  { vesselId: 'v005', co2SavedPct: 24.3, co2SavedTon: 1104.2 },
  { vesselId: 'v004', co2SavedPct: 21.1, co2SavedTon: 612.5 },
  { vesselId: 'v002', co2SavedPct: 14.2, co2SavedTon: 588.3 },
  { vesselId: 'v003', co2SavedPct: 9.8, co2SavedTon: 401.7 },
]

// 탄소 가격 — EU ETS 참고 시세 €80/ton, 환율 ₩1,440/€ 가정
export const CARBON_PRICE_KRW_PER_TON = 115_000

// CII 추이 월
export const CII_TREND_MONTHS = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']

// 배지 임계값
export interface CanBadge {
  threshold: number
  emoji: string
}
export const CAN_BADGES: CanBadge[] = [
  { threshold: 0, emoji: '🌱' },
  { threshold: 10, emoji: '🌿' },
  { threshold: 20, emoji: '🌳' },
  { threshold: 30, emoji: '🌍' },
]

// 재미 요소 환산 계수 (참고용 근사값)
export const CO2_TREE_ABSORB_TON_PER_YEAR = 0.022
export const CO2_CAR_TON_PER_KM = 0.00012
export const EARTH_CIRCUMFERENCE_KM = 40075
export const CO2_CHICKEN_TON = 0.0025

// 대기 탄소·컴플라이언스 환산 기준
export const ANCHOR_REFERENCE_CO2_TON = 3976.4 // voy001의 원본 예시 CO₂ 총량
export const COMPLIANCE_BASE_KRW = 1_500_000_000 // 월 손실 기준액

// CII 등급 산출 — 점수가 낮을수록 좋다. 배열 순서 = 좋은 등급 → 나쁜 등급.
export const CII_GRADES: CiiGrade[] = ['A', 'B', 'C', 'D', 'E']

export const CII_COLORS: Record<CiiGrade, string> = {
  A: '#16a34a',
  B: '#84cc16',
  C: '#d97706',
  D: '#ea580c',
  E: '#dc2626',
}

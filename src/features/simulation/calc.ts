// SIMULATION.md §5 — 순수 계산 함수. 모든 결과·차트·PDF는 applied(적용) 상태만
// 참조해야 한다 — 초안 값을 섞어 쓰면 "실행 버튼을 눌러야 반영된다"는 이 화면의
// 핵심 규칙이 깨진다(§5.2, §10).

import type { Voyage } from '@/shared/types'
import { CONGESTION_WAIT_HOURS, CANAL_TOLL_USD, CAPE_DISTANCE_FACTOR, FUEL_PRICE_USD_TON, CO2_FACTOR } from '@/features/simulation/constants'
import type { SimInputs, SimulationResult } from '@/features/simulation/types'

// 해군 배수량 법칙(속도³ 비례) 기반의 단순 모델 — 선박별 연료 커브를 쓰지 않는다.
export function calcFuel(distanceNm: number, speedKnots: number, baseFuelPerDay: number, draftFactor: number): number {
  const days = distanceNm / (speedKnots * 24)
  return baseFuelPerDay * (speedKnots / 14) ** 3 * days * draftFactor
}

// 적재율 80%에서 1.0, 100%에서 1.06, 30%에서 0.85.
export function computeDraftFactor(cargoPercent: number): number {
  return 1 + (cargoPercent - 80) * 0.003
}

export function computeRouteDistanceNm(voyage: Voyage, route: SimInputs['route']): number {
  return route === 'suez' ? voyage.distanceNm : voyage.distanceNm * CAPE_DISTANCE_FACTOR
}

export function computeCanalCost(route: SimInputs['route']): number {
  return route === 'suez' ? CANAL_TOLL_USD : 0
}

export function computeCongestionWaitHours(portCongestion: SimInputs['portCongestion']): number {
  return CONGESTION_WAIT_HOURS[portCongestion]
}

// 진행률 0% → 30h, 100% → 0h.
export function computeBerthWaitHours(berthProgress: number): number {
  return Math.max(0, ((100 - berthProgress) / 100) * 30)
}

export interface SimulatedResult extends SimulationResult {
  etd: string
  eta: string
}

export interface SimulationOutput {
  planned: SimulationResult
  simulated: SimulatedResult
  historical: SimulationResult | null
  portWaitHours: number
  portWaitCost: number
  savings: { fuel: number; cost: number; co2: number }
}

// §5.6 — 세 가지 결과. 주의: planned도 draftFactor(적재율)·canalCost(항로)를 시뮬레이션
// 입력과 공유하므로 완전히 고정된 기준선이 아니다(§10 불변식, 원본 그대로).
export function computeSimulation(voyage: Voyage, applied: SimInputs, compareVoyage: Voyage | null): SimulationOutput {
  const draftFactor = computeDraftFactor(applied.cargoPercent)
  const canalCost = computeCanalCost(applied.route)

  // ① 현재 계획
  const plannedFuel = calcFuel(voyage.distanceNm, voyage.plannedSpeedKnots, 140, draftFactor)
  const planned: SimulationResult = {
    fuel: plannedFuel,
    days: voyage.distanceNm / (voyage.plannedSpeedKnots * 24),
    cost: plannedFuel * FUEL_PRICE_USD_TON + canalCost,
    co2: plannedFuel * CO2_FACTOR,
  }

  // ② 시뮬레이션
  const congestionWaitHours = computeCongestionWaitHours(applied.portCongestion)
  const berthWaitHours = computeBerthWaitHours(applied.berthProgress)
  const portWaitHours = congestionWaitHours + berthWaitHours
  const portWaitCost = portWaitHours * 3_000

  const routeDistance = computeRouteDistanceNm(voyage, applied.route)
  const simFuel = calcFuel(routeDistance, applied.speedKnots, 140, draftFactor)
  const simDays = routeDistance / (applied.speedKnots * 24)

  // etd/eta 계산 — voyage.etd 원본은 변형하지 않는다.
  const etdMs = new Date(voyage.etd).getTime() + applied.departureOffset * 3600_000
  const etaMs = etdMs + (simDays * 24 + portWaitHours) * 3600_000

  const simulated: SimulatedResult = {
    fuel: simFuel,
    days: simDays,
    cost: simFuel * FUEL_PRICE_USD_TON + (applied.route === 'cape' ? 0 : canalCost) + portWaitCost,
    co2: simFuel * CO2_FACTOR,
    etd: new Date(etdMs).toISOString(),
    eta: new Date(etaMs).toISOString(),
  }

  // ③ 과거 실적 — draftFactor는 항상 1, 통과료·대기비용 없음.
  const historical: SimulationResult | null = compareVoyage
    ? (() => {
        const fuel = calcFuel(compareVoyage.distanceNm, compareVoyage.plannedSpeedKnots, 140, 1)
        return {
          fuel,
          days: compareVoyage.distanceNm / (compareVoyage.plannedSpeedKnots * 24),
          cost: fuel * FUEL_PRICE_USD_TON,
          co2: fuel * CO2_FACTOR,
        }
      })()
    : null

  // §5.7 — 양수 = 절감(-로 표시), 음수 = 증가(+로 표시). 부호는 화면에서 반전한다.
  const savings = {
    fuel: planned.fuel - simulated.fuel,
    cost: planned.cost - simulated.cost,
    co2: planned.co2 - simulated.co2,
  }

  return { planned, simulated, historical, portWaitHours, portWaitCost, savings }
}

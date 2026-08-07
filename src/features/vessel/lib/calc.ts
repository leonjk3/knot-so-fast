import type { FuelPoint, Voyage } from '@/shared/types'

// 해군 배수량 법칙(속도³ 비례) — VESSEL.md 8.1장
const CURVE_OFFSETS = [-4, -2, 0, 2, 4, 6]

export function buildFuelCurve(designSpeed: number, designFuel: number): FuelPoint[] {
  return CURVE_OFFSETS.map((offset) => designSpeed + offset)
    .filter((speed) => speed > 0)
    .map((speed) => ({
      speedKnots: speed,
      fuelTonPerDay: Math.round(designFuel * (speed / designSpeed) ** 3),
    }))
}

// 활성 항차 판정 — underway/delayed만 포함 (VESSEL.md 8.2장, 11장)
export function findActiveVoyage(vesselId: string, voyages: Voyage[]): Voyage | undefined {
  return voyages.find((v) => v.vesselId === vesselId && (v.status === 'underway' || v.status === 'delayed'))
}

// 항구명 축약 — 공백 기준 첫 토큰 (VESSEL.md 8.3장)
export function portToken(portLabel: string): string {
  return portLabel.split(' ')[0]
}

// 노후 계수 경고 임계값 — 초과(>) 비교, 이상(>=) 아님 (VESSEL.md 11장)
export const FOULING_WARNING_THRESHOLD = 1.07

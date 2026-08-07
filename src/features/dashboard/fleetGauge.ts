import type { Vessel, Voyage, AisPosition } from '@/shared/types'
import { interpolateFuelTonPerDay, fuelEmissionFactor } from '@/shared/utils/format'

export interface FleetGaugeRow {
  voyage: Voyage
  vessel: Vessel
  position: AisPosition
  fuelTonPerDay: number
  fuelCapacityPercent: number
  co2TonPerDay: number
  fuelSavingPercent: number
  co2FleetPercent: number
}

// 자사 항차 중 underway 또는 delayed (DASHBOARD.md 1.2장)
export function getActiveVoyages(voyages: Voyage[]): Voyage[] {
  return voyages.filter((v) => v.status === 'underway' || v.status === 'delayed')
}

// DASHBOARD.md 6.1장 — 선박 또는 AIS 위치가 없는 항차는 생략, 2차 패스로 co2FleetPercent 계산
export function computeFleetGauges(voyages: Voyage[], vessels: Vessel[], positions: AisPosition[]): FleetGaugeRow[] {
  const activeVoyages = getActiveVoyages(voyages)

  const rows: Omit<FleetGaugeRow, 'co2FleetPercent'>[] = []
  for (const voyage of activeVoyages) {
    const vessel = vessels.find((v) => v.id === voyage.vesselId)
    const position = positions.find((p) => p.vesselId === voyage.vesselId)
    if (!vessel || !position) continue

    const maxFuel = Math.max(...vessel.fuelCurve.map((p) => p.fuelTonPerDay))
    const currentFuel = interpolateFuelTonPerDay(vessel.fuelCurve, position.speedKnots)
    const plannedFuel = interpolateFuelTonPerDay(vessel.fuelCurve, voyage.plannedSpeedKnots)
    const emissionFac = fuelEmissionFactor(voyage.fuelType)

    rows.push({
      voyage,
      vessel,
      position,
      fuelTonPerDay: currentFuel,
      fuelCapacityPercent: maxFuel > 0 ? Math.min(100, (currentFuel / maxFuel) * 100) : 0,
      co2TonPerDay: currentFuel * emissionFac,
      fuelSavingPercent: plannedFuel > 0 ? Math.min(100, Math.max(0, ((plannedFuel - currentFuel) / plannedFuel) * 100)) : 0,
    })
  }

  const maxCo2 = Math.max(1, ...rows.map((r) => r.co2TonPerDay))

  return rows.map((r) => ({
    ...r,
    co2FleetPercent: Math.min(100, (r.co2TonPerDay / maxCo2) * 100),
  }))
}

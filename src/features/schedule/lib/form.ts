import type { FuelType, Voyage } from '@/shared/types'
import { getPortCode } from './portCode'
import { isoToLocal } from './datetime'

export interface VoyageFormState {
  vesselId: string
  departurePortCode: string
  arrivalPortCode: string
  etd: string
  rta: string
  sta: string
  rtaConfirmed: boolean
  cargoDescription: string
  cargoTon: string
  fuelType: FuelType
  plannedSpeedKnots: string
}

// 폼 기본값(create 모드) — SCHEDULE.md 5.9장(계획 속도 기본값 14)
export function createDefaultFormState(): VoyageFormState {
  return {
    vesselId: '',
    departurePortCode: '',
    arrivalPortCode: '',
    etd: '',
    rta: '',
    sta: '',
    rtaConfirmed: false,
    cargoDescription: '',
    cargoTon: '',
    fuelType: 'HFO',
    plannedSpeedKnots: '14',
  }
}

// view 모드 진입 시 기존 항차 값으로 폼을 채운다.
export function voyageToFormState(voyage: Voyage): VoyageFormState {
  return {
    vesselId: voyage.vesselId,
    departurePortCode: getPortCode(voyage.departurePort) ?? '',
    arrivalPortCode: getPortCode(voyage.arrivalPort) ?? '',
    etd: isoToLocal(voyage.etd),
    rta: isoToLocal(voyage.rta),
    sta: isoToLocal(voyage.sta),
    rtaConfirmed: voyage.rtaConfirmed,
    cargoDescription: voyage.cargoDescription,
    cargoTon: String(voyage.cargoTon),
    fuelType: voyage.fuelType,
    plannedSpeedKnots: String(voyage.plannedSpeedKnots),
  }
}

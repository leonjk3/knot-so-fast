import type { Vessel, VesselStatus, VesselType } from '@/shared/types'

// 등록·수정 모달 폼 상태 — 숫자 입력도 문자열로 보관해 빈 값·중간 입력 상태를 표현한다.
export interface VesselFormState {
  name: string
  imo: string
  type: VesselType
  flag: string
  buildYear: string
  grossTonnage: string
  lengthOverall: string
  beam: string
  maxDraft: string
  currentDraft: string
  enginePower: string
  foulingFactor: string
  status: VesselStatus
  designSpeedKnots: string
  designSpeedFuelTon: string
}

// 폼 기본값(create 모드) — VESSEL.md 6.4장
export function createDefaultFormState(): VesselFormState {
  return {
    name: '',
    imo: '',
    type: 'container',
    flag: 'KR',
    buildYear: String(new Date().getFullYear()),
    grossTonnage: '',
    lengthOverall: '',
    beam: '',
    maxDraft: '',
    currentDraft: '',
    enginePower: '',
    foulingFactor: '1.00',
    status: 'active',
    designSpeedKnots: '14',
    designSpeedFuelTon: '100',
  }
}

// view 모드 진입 시 기존 선박 값으로 폼을 채운다.
export function vesselToFormState(vessel: Vessel): VesselFormState {
  return {
    name: vessel.name,
    imo: vessel.imo,
    type: vessel.type,
    flag: vessel.flag,
    buildYear: String(vessel.buildYear),
    grossTonnage: String(vessel.grossTonnage),
    lengthOverall: String(vessel.lengthOverall),
    beam: String(vessel.beam),
    maxDraft: String(vessel.maxDraft),
    currentDraft: String(vessel.currentDraft),
    enginePower: String(vessel.enginePower),
    foulingFactor: vessel.foulingFactor.toFixed(2),
    status: vessel.status,
    designSpeedKnots: String(vessel.designSpeedKnots),
    designSpeedFuelTon: String(vessel.designSpeedFuelTon),
  }
}

export type VesselModalMode = 'create' | 'view'

// 등록 후 영구 수정 불가 필드 — VESSEL.md 7.1장
export const ALWAYS_LOCKED_FIELDS = [
  'imo',
  'buildYear',
  'type',
  'grossTonnage',
  'lengthOverall',
  'beam',
  'maxDraft',
  'enginePower',
  'designSpeedKnots',
  'designSpeedFuelTon',
] as const

export type LockableField = (typeof ALWAYS_LOCKED_FIELDS)[number] | 'status'

// 필드 잠금 판정 — VESSEL.md 7.4장
export function isFieldEditable(key: LockableField, mode: VesselModalMode, hasActiveVoyage: boolean): boolean {
  if (mode === 'create') return true
  if ((ALWAYS_LOCKED_FIELDS as readonly string[]).includes(key)) return false
  if (key === 'status' && hasActiveVoyage) return false
  return true
}

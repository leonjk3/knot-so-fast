import type { VoyageStatus } from '@/shared/types'

export type VoyageModalMode = 'create' | 'view'

// 이미 출발한 항차는 이 2개 필드만 수정 가능 (SCHEDULE.md 7장, FR-208)
const RESTRICTED_EDITABLE_FIELDS = ['sta', 'plannedSpeedKnots'] as const

export type EditableFieldSet = 'all' | 'none' | readonly string[]

export function editableFieldsForStatus(status: VoyageStatus): EditableFieldSet {
  if (status === 'preparing') return 'all'
  if (status === 'underway' || status === 'delayed') return RESTRICTED_EDITABLE_FIELDS
  return 'none' // completed | cancelled
}

// create 모드면 항상 true. view 모드면 상태별 허용 목록에 포함될 때만 true.
export function isFieldEditable(key: string, mode: VoyageModalMode, status: VoyageStatus): boolean {
  if (mode === 'create') return true
  const allowed = editableFieldsForStatus(status)
  if (allowed === 'all') return true
  if (allowed === 'none') return false
  return allowed.includes(key)
}

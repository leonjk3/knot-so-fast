import type { Vessel, Voyage, VoyageStatus } from '@/shared/types'

export type StatusFilter = 'all' | 'underway' | 'delayed' | 'preparing' | 'completed'

// underway/delayed가 같은 우선순위인 것은 의도된 설계다 — 운항 중인 항차는 지연 여부와
// 무관하게 함께 최상단에 모아 보여준다 (SCHEDULE.md 6.5장).
const STATUS_PRIORITY: Record<VoyageStatus, number> = {
  underway: 0,
  delayed: 0,
  preparing: 1,
  completed: 2,
  cancelled: 3,
}

export function filterVoyages(voyages: Voyage[], vessels: Vessel[], statusFilter: StatusFilter, search: string): Voyage[] {
  return voyages.filter((voyage) => {
    const matchStatus = statusFilter === 'all' || voyage.status === statusFilter
    if (!matchStatus) return false
    if (!search) return true

    const vessel = vessels.find((v) => v.id === voyage.vesselId)
    return (
      voyage.departurePort.includes(search) ||
      voyage.arrivalPort.includes(search) ||
      (vessel?.name.includes(search) ?? false)
    )
  })
}

// 3단계 정렬: 상태 우선순위 → ETA → RTA (모두 오름차순)
export function sortVoyages(voyages: Voyage[]): Voyage[] {
  return [...voyages].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status]
    const pb = STATUS_PRIORITY[b.status]
    if (pa !== pb) return pa - pb
    if (a.eta !== b.eta) return a.eta < b.eta ? -1 : 1
    if (a.rta !== b.rta) return a.rta < b.rta ? -1 : 1
    return 0
  })
}

export interface StatusCounts {
  all: number
  underway: number
  delayed: number
  preparing: number
  completed: number
}

// 탭 옆 건수는 검색어와 무관하게 항상 전체 데이터 기준으로 센다
export function countByStatus(voyages: Voyage[]): StatusCounts {
  return {
    all: voyages.length,
    underway: voyages.filter((v) => v.status === 'underway').length,
    delayed: voyages.filter((v) => v.status === 'delayed').length,
    preparing: voyages.filter((v) => v.status === 'preparing').length,
    completed: voyages.filter((v) => v.status === 'completed').length,
  }
}

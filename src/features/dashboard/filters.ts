import type { Voyage } from '@/shared/types'
import { getPortCode, findPort } from '@/mocks/ports'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_OTHER_VOYAGES } from '@/mocks/otherFleet'
import { getActiveVoyages } from './fleetGauge'

export type QuickFilterKey = 'my' | 'weather' | 'vessels' | 'issues' | 'ports'

export interface QuickFilterDef {
  key: QuickFilterKey
  label: string
  title: string
}

export const QUICK_FILTER_DEFS: QuickFilterDef[] = [
  { key: 'my', label: 'My', title: '자사 선박만 지도에 표시' },
  { key: 'weather', label: '기상', title: '해상 기상 + 강수 레이더 지도에 표시' },
  { key: 'vessels', label: '선박', title: '선박 마커 지도에 표시' },
  { key: 'issues', label: '이슈', title: '지역 이슈 지도에 표시 (항구와 동시 선택 불가)' },
  { key: 'ports', label: '항구', title: '항구 지도에 표시 (이슈와 동시 선택 불가)' },
]

export interface LayerVisibility {
  weather: boolean
  radar: boolean
  typhoon: boolean
  issues: boolean
  dangerZones: boolean
  ports: boolean
}

// DASHBOARD.md 7.3장 — 개별 레이어 on/off 스위치는 없다. 태풍·위험구역은 "이슈"에,
// 강수 레이더는 "기상"에 편입된다.
export function layersForFilters(filters: Set<QuickFilterKey>): LayerVisibility {
  const none = filters.size === 0
  const showW = none || filters.has('weather')
  const showI = none || filters.has('issues')
  const showP = none || filters.has('ports')
  return { weather: showW, radar: showW, typhoon: showI, issues: showI, dangerZones: showI, ports: showP }
}

export function computeShowVessels(filters: Set<QuickFilterKey>): boolean {
  return filters.size === 0 || filters.has('vessels') || filters.has('my')
}

export interface Destination {
  code: string
  name: string
  count: number
}

// DASHBOARD.md 7.4장 — My가 켜져 있으면 자사 활성 항차만, 아니면 자사 활성 + 타사 전체.
export function computeDestinations(filters: Set<QuickFilterKey>): Destination[] {
  const myOn = filters.has('my')
  const candidates: Voyage[] = myOn ? getActiveVoyages(MOCK_VOYAGES) : [...getActiveVoyages(MOCK_VOYAGES), ...MOCK_OTHER_VOYAGES]

  const counts = new Map<string, number>()
  for (const voyage of candidates) {
    const code = getPortCode(voyage.arrivalPort)
    if (!code) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, name: findPort(code)?.name ?? code, count }))
    .sort((a, b) => b.count - a.count)
}

interface VisibleVoyageIdsInput {
  filters: Set<QuickFilterKey>
  destinationFilter: string | null
  destinations: Destination[]
  selectedVoyageIds: Set<string>
}

// DASHBOARD.md 7.6장 — 지도에 표시할 항차 확정. selectedVoyageIds(체크된 자사 항차) 상태
// 자체는 건드리지 않고, 필터·도착지에 따라 매번 새로 파생시킨다.
export function computeVisibleVoyageIds({ filters, destinationFilter, destinations, selectedVoyageIds }: VisibleVoyageIdsInput): Set<string> {
  if (!computeShowVessels(filters)) return new Set()

  // 선택된 도착지가 현재 목록에서 사라졌으면 "유효하지 않은 선택"으로 취급해 전체 보기로 대체한다.
  const effectiveDestinationFilter = destinationFilter && destinations.some((d) => d.code === destinationFilter) ? destinationFilter : null

  const ownVisibleIds = effectiveDestinationFilter
    ? [...selectedVoyageIds].filter((id) => {
        const voyage = MOCK_VOYAGES.find((v) => v.id === id)
        return voyage ? getPortCode(voyage.arrivalPort) === effectiveDestinationFilter : false
      })
    : [...selectedVoyageIds]

  const myOn = filters.has('my')
  const otherVisibleIds = myOn
    ? []
    : MOCK_OTHER_VOYAGES.filter((v) => !effectiveDestinationFilter || getPortCode(v.arrivalPort) === effectiveDestinationFilter).map((v) => v.id)

  return new Set([...ownVisibleIds, ...otherVisibleIds])
}

import type { Waypoint } from '@/shared/types'

export interface PortPairRoute {
  points: Waypoint[]
  distanceNm: number
  waypoints: number
}

// 항구 30곳 전 조합(435개) 사전(Track A) — 사전은 알파벳 오름차순 코드로만 저장되어 있어
// 역방향 조회 시 좌표를 뒤집어야 한다 (SCHEDULE.md 6.3장). 다른 페이지 번들이 커지지
// 않도록 제출·계산 시점에만 동적 import 한다.
export async function resolvePortPairRoute(fromCode: string, toCode: string): Promise<PortPairRoute | null> {
  const mod = await import('@/mocks/port-pairs.json')
  const routes = mod.default as unknown as Record<string, PortPairRoute>

  const forward = routes[`${fromCode}-${toCode}`]
  if (forward) return forward

  const reverse = routes[`${toCode}-${fromCode}`]
  if (reverse) return { ...reverse, points: [...reverse.points].reverse() }

  return null
}

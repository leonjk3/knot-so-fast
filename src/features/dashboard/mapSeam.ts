// DASHBOARD.md 9.2장 — 지도 이음매(seam)와 좌표 랩핑
// 지도를 표준 ±180°가 아니라 경도 -30°(북대서양 한가운데)에서 끊는다.
export const SEAM_LNG = -30
// Web Mercator는 위도 ±90°에서 발산하므로 안전 한계 ±85.0511287798°를 쓴다.
export const MAX_LAT = 85.0511287798
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-MAX_LAT, SEAM_LNG],
  [MAX_LAT, SEAM_LNG + 360],
]

// 단일 마커 좌표용 — 이음매 서쪽(SEAM_LNG 미만)이면 한 바퀴(360°) 밀어 표시 구간 안으로 넣는다.
export function wrapLng(lng: number): number {
  return lng < SEAM_LNG ? lng + 360 : lng
}

interface RoutePoint {
  lat: number
  lng: number
}

// 항로 폴리라인용 — 점마다 독립적으로 wrapLng를 적용하면 이음매를 가로지르는 항로가
// 지도 폭 전체를 가로지르는 직선으로 끊겨 보인다. 대신 연속(unwrap)시킨 뒤 표시 구간
// 경계를 넘는 지점마다 위도를 보간해 선을 여러 선분으로 나눈다.
export function wrapRouteSegments(waypoints: RoutePoint[]): [number, number][][] {
  if (waypoints.length < 2) return []

  // ① 인접 점 간 점프가 180°를 넘지 않도록 연속화(unwrap)
  const contLngs: number[] = [waypoints[0].lng]
  for (let i = 1; i < waypoints.length; i++) {
    let lng = waypoints[i].lng
    while (lng - contLngs[i - 1] > 180) lng -= 360
    while (lng - contLngs[i - 1] < -180) lng += 360
    contLngs.push(lng)
  }

  const copyIndex = (lng: number) => Math.floor((lng - SEAM_LNG) / 360)

  const segments: [number, number][][] = []
  let k = copyIndex(contLngs[0])
  let current: [number, number][] = [[waypoints[0].lat, contLngs[0] - k * 360]]

  // ② 표시 구간 경계를 넘는 지점에서 위도를 보간해 선을 끊는다
  for (let i = 1; i < waypoints.length; i++) {
    const prevLat = waypoints[i - 1].lat
    const prevLng = contLngs[i - 1]
    const lat = waypoints[i].lat
    const lng = contLngs[i]
    const targetK = copyIndex(lng)
    const increasing = lng > prevLng

    while (k !== targetK) {
      const boundary = SEAM_LNG + (increasing ? k + 1 : k) * 360
      const t = (boundary - prevLng) / (lng - prevLng)
      const crossLat = prevLat + (lat - prevLat) * t
      current.push([crossLat, boundary - k * 360])
      if (current.length >= 2) segments.push(current)

      const nextK = increasing ? k + 1 : k - 1
      current = [[crossLat, boundary - nextK * 360]]
      k = nextK
    }

    current.push([lat, lng - k * 360])
  }

  if (current.length >= 2) segments.push(current)
  return segments
}

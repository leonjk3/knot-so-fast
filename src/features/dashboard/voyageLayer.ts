import type { Voyage, AisPosition, VoyageStatus } from '@/shared/types'
import ROUTES_JSON from '@/mocks/routes.json'

type LatLng = { lat: number; lng: number }
type RouteEntry = { points: LatLng[] } | null
const ROUTES = ROUTES_JSON as Record<string, RouteEntry>

// DASHBOARD.md 5.5장/13장과 동일한 상태 라벨. 지도 팝업 전용 다국어 사전(MAP_LABELS,
// 12장)은 L3(9.10 언어 선택기)에서 만들 것이므로 지금은 한국어로 고정한다.
const STATUS_LABELS: Record<VoyageStatus, string> = {
  preparing: '준비 중',
  underway: '운항 중',
  delayed: '지연',
  completed: '완료',
  cancelled: '취소',
}

export function statusLabel(status: VoyageStatus): string {
  return STATUS_LABELS[status]
}

// 사전 계산 항로(routes.json, 실해상 경로)가 있으면 그것, 없으면 voyage.plannedRoute
export function getDisplayRoute(voyage: Voyage): LatLng[] {
  const precomputed = ROUTES[voyage.id]?.points
  return precomputed && precomputed.length > 0 ? precomputed : voyage.plannedRoute
}

// 계획 항로를 현재 AIS 위치에서 가장 가까운 점까지 슬라이싱한다. 두 지점을 직선 보간하면
// 항로가 대륙을 통과하므로(KNOWN_PITFALLS.md 2.9) 절대 그렇게 하지 않는다.
export function computeActualRoute(voyage: Voyage, displayRoute: LatLng[], position: AisPosition | undefined): LatLng[] {
  if (!position) return voyage.actualRoute

  let closestIdx = 0
  let closestDist = Infinity
  displayRoute.forEach((point, idx) => {
    const dist = Math.hypot(point.lat - position.lat, point.lng - position.lng)
    if (dist < closestDist) {
      closestDist = dist
      closestIdx = idx
    }
  })

  return displayRoute.slice(0, closestIdx + 1)
}

export interface MarkerIconOptions {
  isOwn: boolean
  cogDegrees: number
  statusColor: string
}

// 선체 실루엣 SVG divIcon. 자사/타사는 점선이 아니라 "채움 진하기"로 구분한다
// (점선은 태풍·위험구역의 반경 표현에 이미 쓰이고 있어 의미가 충돌한다).
export function buildVesselMarkerIcon({ isOwn, cogDegrees, statusColor }: MarkerIconOptions): { html: string; size: number } {
  const size = isOwn ? 34 : 28
  const fillOpacity = isOwn ? 1 : 0.4
  const stroke = isOwn ? '#ffffff' : statusColor
  const strokeWidth = isOwn ? 2 : 1.5
  const circleOpacity = isOwn ? 0.9 : 0.7

  const html = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${cogDegrees}deg); filter: drop-shadow(0 2px 3px rgba(15,23,42,0.4));"><path d="M12 1.5 L17 9 L15 21.5 L9 21.5 L7 9 Z" fill="${statusColor}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" /><circle cx="12" cy="9.5" r="1.6" fill="#ffffff" opacity="${circleOpacity}" /></svg>`

  return { html, size }
}

export interface PopupHtmlOptions {
  vesselName: string
  companyName: string
  isOwn: boolean
  departurePort: string
  arrivalPort: string
  speedKnots: number
  etaLabel: string
  status: VoyageStatus
  statusColor: string
  vesselId: string
  voyageId: string
}

function popupRow(label: string, valueHtml: string): string {
  return `<tr><td style="padding:2px 8px 2px 0;font-size:10px;color:#64748b;white-space:nowrap;">${label}</td><td style="padding:2px 0;font-size:11px;color:#0f172a;">${valueHtml}</td></tr>`
}

// 선박 마커 팝업. 자사 선박이면 맨 아래에 "제안속도 전송" 버튼 HTML을 넣어둔다 — 실제 전송
// 동작(6.4장)과 팝업 이벤트 위임(9.11장)은 L4에서 붙이므로 여기서는 data 속성만 심어둔다.
export function buildVesselPopupHtml(opts: PopupHtmlOptions): string {
  const companyLine = opts.isOwn
    ? `<div style="margin-top:2px;font-size:11px;font-weight:600;color:#6366f1;">자사 선박</div>`
    : `<div style="margin-top:2px;font-size:11px;color:#64748b;">${opts.companyName}</div>`

  const statusBadge = `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:10px;font-weight:600;color:#ffffff;background:${opts.statusColor};">${statusLabel(opts.status)}</span>`

  const sendButton = opts.isOwn
    ? `<button type="button" data-send-speed-vessel-id="${opts.vesselId}" data-send-speed-voyage-id="${opts.voyageId}" style="width:100%;margin-top:8px;padding:6px 0;background:#6366f1;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">제안속도 전송</button>`
    : ''

  return [
    '<div style="min-width:200px;">',
    `<div style="font-size:14px;font-weight:600;color:#0f172a;">${opts.vesselName}</div>`,
    companyLine,
    '<table style="margin-top:6px;border-collapse:collapse;">',
    popupRow('항차', `${opts.departurePort} → ${opts.arrivalPort}`),
    popupRow('현재 속도', `${opts.speedKnots} kts`),
    popupRow('ETA', opts.etaLabel),
    popupRow('상태', statusBadge),
    '</table>',
    sendButton,
    '</div>',
  ].join('')
}

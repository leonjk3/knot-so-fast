import type { TyphoonWarning, RegionalIssue } from '@/mocks/map-overlays'

const TYPHOON_INTENSITY_COLORS: Record<TyphoonWarning['intensity'], string> = {
  TD: '#94a3b8',
  TS: '#f59e0b',
  TY: '#ef4444',
  STY: '#7c3aed',
}

export function typhoonColor(intensity: TyphoonWarning['intensity']): string {
  return TYPHOON_INTENSITY_COLORS[intensity]
}

const WIND_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 16h15a3 3 0 1 1-3 3"/></svg>'

// 36×36px 3중 동심원(바깥 0.25 → inset 5px 0.45 → inset 10px 불투명+흰 테두리) + 아이콘.
// 깜빡임 클래스(map-marker-pulse)는 반드시 이 html의 최상위(자식) div에 붙인다 —
// divIcon의 className 옵션에 붙이면 Leaflet 위치 이동 transform과 충돌해 마커가 엉뚱한
// 위치로 튄다(KNOWN_PITFALLS.md 2.6).
export function buildTyphoonMarkerHtml(intensity: TyphoonWarning['intensity']): string {
  const color = typhoonColor(intensity)
  return `<div class="map-marker-pulse" style="position:relative;width:36px;height:36px;"><div style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.25;"></div><div style="position:absolute;inset:5px;border-radius:9999px;background:${color};opacity:0.45;"></div><div style="position:absolute;inset:10px;border-radius:9999px;background:${color};border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;">${WIND_ICON_SVG}</div></div>`
}

function popupRow(label: string, value: string): string {
  return `<tr><td style="padding:2px 8px 2px 0;font-size:10px;color:#64748b;white-space:nowrap;">${label}</td><td style="padding:2px 0;font-size:11px;color:#0f172a;">${value}</td></tr>`
}

export function buildTyphoonPopupHtml(t: TyphoonWarning): string {
  const color = typhoonColor(t.intensity)
  return [
    '<div style="min-width:180px;">',
    `<div style="font-size:13px;font-weight:700;color:${color};">🌀 ${t.name}</div>`,
    '<table style="margin-top:6px;border-collapse:collapse;">',
    popupRow('강도', t.intensity),
    popupRow('최대 풍속', `${t.windSpeedKnots} kts`),
    popupRow('반경', `${t.radiusKm} km`),
    popupRow('이동 방향·속도', `${t.movingDir} · ${t.movingSpeedKnots} kts`),
    '</table>',
    '</div>',
  ].join('')
}

const ISSUE_TYPE_COLORS: Record<RegionalIssue['type'], string> = {
  piracy: '#ef4444',
  port_congestion: '#f59e0b',
  geopolitical: '#8b5cf6',
  canal_control: '#6366f1',
}

// DASHBOARD.md 8.1장 — 유형 라벨(리스트 패널에서 사용)
const ISSUE_TYPE_LABELS: Record<RegionalIssue['type'], string> = {
  piracy: '해적',
  port_congestion: '항만 혼잡',
  geopolitical: '지정학적 리스크',
  canal_control: '운하 통제',
}

export function issueTypeLabel(type: RegionalIssue['type']): string {
  return ISSUE_TYPE_LABELS[type]
}

// 유형별 흰색 SVG 아이콘 — 정확한 형태는 명세에 없어 의미가 통하는 최소 아이콘으로 채움
const ISSUE_TYPE_ICONS: Record<RegionalIssue['type'], string> = {
  piracy:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a1 1 0 0 0 1 1h1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2h1a1 1 0 0 0 1-1v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7Zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>',
  port_congestion:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="8" height="6"/><rect x="13" y="7" width="8" height="6"/><rect x="3" y="15" width="8" height="4"/><rect x="13" y="15" width="8" height="4"/></svg>',
  geopolitical:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"/><path d="M5 4h13l-3 4 3 4H5"/></svg>',
  canal_control:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c1.5 2 3.5 2 5 0s3.5-2 5 0 3.5 2 5 0 3.5-2 5 0"/><path d="M2 15c1.5 2 3.5 2 5 0s3.5-2 5 0 3.5 2 5 0 3.5-2 5 0"/></svg>',
}

export function issueTypeColor(type: RegionalIssue['type']): string {
  return ISSUE_TYPE_COLORS[type]
}

// 36×36px 원형 배지. 태풍과 동일하게 깜빡임 클래스는 자식 div에 붙인다.
export function buildIssueMarkerHtml(type: RegionalIssue['type']): string {
  const color = ISSUE_TYPE_COLORS[type]
  return `<div class="map-marker-pulse" style="width:36px;height:36px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;">${ISSUE_TYPE_ICONS[type]}</div>`
}

const SEVERITY_EMOJI: Record<RegionalIssue['severity'], string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

export function buildIssuePopupHtml(issue: RegionalIssue): string {
  return [
    '<div style="min-width:200px;">',
    `<div style="font-size:13px;font-weight:700;color:#0f172a;">${SEVERITY_EMOJI[issue.severity]} ${issue.title}</div>`,
    `<div style="margin-top:4px;font-size:11px;color:#334155;">${issue.description}</div>`,
    `<div style="margin-top:4px;font-size:10px;color:#64748b;">출처: ${issue.source}</div>`,
    '</div>',
  ].join('')
}

// 풍속별 색: ≥15 → red / ≥10 → amber / 그 외 → indigo
export function windSpeedColor(windSpeed: number): string {
  if (windSpeed >= 15) return '#ef4444'
  if (windSpeed >= 10) return '#f59e0b'
  return '#6366f1'
}

const WIND_ARROW_PATH = '<path d="M12 2 L12 22 M12 2 L6 9 M12 2 L18 9" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />'

// weatherPane 카드형 마커. iconSize:[0,0] + iconAnchor:[0,0] + 내부 div에
// transform:translate(-50%,-50%) 조합이 없으면 Leaflet이 0×0 컨테이너를 만들어 하단
// 텍스트를 잘라낸다(KNOWN_PITFALLS.md 2.1).
export function buildWeatherCardHtml(windSpeed: number, windDir: number, waveHeight: number, name: string): string {
  const color = windSpeedColor(windSpeed)
  return `<div style="transform:translate(-50%,-50%);background:rgba(248,250,252,0.48);backdrop-filter:blur(6px);border:1px solid rgba(203,213,225,0.35);border-radius:8px;padding:5px 9px;min-width:72px;"><div style="display:flex;align-items:center;gap:3px;"><svg width="10" height="10" viewBox="0 0 24 24" style="transform:rotate(${windDir}deg);stroke:${color};">${WIND_ARROW_PATH}</svg><span style="font-size:12px;font-weight:700;color:${color};">${windSpeed}</span></div><div style="font-size:10px;color:#334155;">${waveHeight}m</div><div style="font-size:8px;color:#94a3b8;">${name}</div></div>`
}

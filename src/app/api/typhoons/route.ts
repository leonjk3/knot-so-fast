// DASHBOARD.md 11.2장 — GDACS는 CORS를 막아두어 브라우저에서 직접 호출할 수 없으므로
// 이 Route Handler가 대신 조회한다. 실패해도 500을 내지 않고 빈 배열을 200으로 반환한다 —
// 클라이언트가 그 응답을 보고 MOCK_TYPHOONS로 폴백한다.

import { NextResponse } from 'next/server'
import type { TyphoonWarning } from '@/mocks/map-overlays'

const GDACS_RSS_URL = 'https://www.gdacs.org/xml/rss.xml'
const FETCH_TIMEOUT_MS = 10000

const INTENSITY_BY_KNOTS: { min: number; intensity: TyphoonWarning['intensity']; radiusKm: number }[] = [
  { min: 100, intensity: 'STY', radiusKm: 400 },
  { min: 64, intensity: 'TY', radiusKm: 300 },
  { min: 34, intensity: 'TS', radiusKm: 200 },
  { min: 0, intensity: 'TD', radiusKm: 120 },
]

function classify(windSpeedKnots: number): { intensity: TyphoonWarning['intensity']; radiusKm: number } {
  const match = INTENSITY_BY_KNOTS.find((row) => windSpeedKnots >= row.min)!
  return { intensity: match.intensity, radiusKm: match.radiusKm }
}

// 태그 안 속성은 순서가 보장되지 않으므로 태그 전체를 먼저 잘라낸 뒤 속성별로 다시 찾는다.
function extractAttr(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`\\b${attr}="([^"]*)"`))
  return match ? match[1] : null
}

function extractTagText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return match ? match[1].trim() : null
}

// GDACS 태풍(TC) 이벤트 하나를 파싱한다. 형식이 안 맞으면 null을 반환해 건너뛴다.
function parseItem(itemXml: string, index: number): TyphoonWarning | null {
  const eventType = extractTagText(itemXml, 'gdacs:eventtype')
  if (eventType !== 'TC') return null

  const pointText = extractTagText(itemXml, 'georss:point')
  let lat: number | null = null
  let lng: number | null = null
  if (pointText) {
    const [latStr, lngStr] = pointText.split(/\s+/)
    lat = Number(latStr)
    lng = Number(lngStr)
  }
  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
    const latStr = extractTagText(itemXml, 'geo:lat')
    const lngStr = extractTagText(itemXml, 'geo:long')
    lat = latStr ? Number(latStr) : NaN
    lng = lngStr ? Number(lngStr) : NaN
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  const name = extractTagText(itemXml, 'gdacs:eventname') || 'UNKNOWN'
  const id = extractTagText(itemXml, 'gdacs:eventid') || `gdacs-${Date.now()}-${index}`

  // ★ 속성명은 units(복수)가 아니라 unit(단수)이고, 값은 텍스트 노드가 아니라 value 속성에
  // 있다 — 이 한 글자 때문에 태풍이 전혀 표시되지 않은 적이 있다(KNOWN_PITFALLS.md 6.1).
  const severityTagMatch = itemXml.match(/<gdacs:severity\b[^>]*>/)
  let windSpeedKnots = 0
  if (severityTagMatch) {
    const tag = severityTagMatch[0]
    const unit = extractAttr(tag, 'unit') ?? ''
    const rawValue = Number(extractAttr(tag, 'value'))
    if (Number.isFinite(rawValue)) {
      windSpeedKnots = /kph|km/i.test(unit) ? rawValue * 0.539957 : rawValue
    }
  }

  const { intensity, radiusKm } = classify(windSpeedKnots)

  return {
    id,
    name,
    lat,
    lng,
    intensity,
    windSpeedKnots: Math.round(windSpeedKnots),
    radiusKm,
    movingDir: '—',
    movingSpeedKnots: 0,
  }
}

function parseGdacsRss(xml: string): TyphoonWarning[] {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const typhoons: TyphoonWarning[] = []
  itemMatches.forEach((itemXml, index) => {
    const parsed = parseItem(itemXml, index)
    if (parsed) typhoons.push(parsed)
  })
  return typhoons
}

export async function GET() {
  try {
    const res = await fetch(GDACS_RSS_URL, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'knot-so-fast-dashboard/1.0 (+https://knotsofas.kr)' },
    })
    if (!res.ok) return NextResponse.json<TyphoonWarning[]>([])

    const xml = await res.text()
    return NextResponse.json<TyphoonWarning[]>(parseGdacsRss(xml))
  } catch {
    return NextResponse.json<TyphoonWarning[]>([])
  }
}

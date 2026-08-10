// DASHBOARD.md 6.4장 — Knot 버튼(게이지 카드)과 지도 팝업의 전송 버튼(9.11장)이 같은
// API를 호출한다. 타입·요청 헬퍼·알림 문구를 한 곳에 둬서 두 호출부가 어긋나지 않게 한다.

export interface SpeedRecommendationRequest {
  vesselId: string
  vesselName: string
  imo: string
  voyageId: string
  departurePort: string
  arrivalPort: string
  currentSpeedKnots: number
  recommendedSpeedKnots: number
  plannedSpeedKnots: number
  eta: string
}

export interface SpeedRecommendationResult {
  success: boolean
  targetUrl?: string
  sentAt?: string
}

export async function sendSpeedRecommendation(body: SpeedRecommendationRequest): Promise<SpeedRecommendationResult> {
  try {
    const res = await fetch('/api/vessel-commands/speed-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { success: false }
    return (await res.json()) as SpeedRecommendationResult
  } catch {
    return { success: false }
  }
}

// 성공 시 알림 문구는 6.4장 예시 형식 그대로다. window.alert는 로케일을 따로 갖지 않으므로
// 지도 언어 선택기(9.10장)와 무관하게 항상 한국어로 고정한다.
export function buildSpeedRecommendationAlert(result: SpeedRecommendationResult, req: SpeedRecommendationRequest): string {
  if (!result.success) return '❌ 제안속도 전송 실패'

  const etaLabel = new Date(req.eta).toLocaleString('ko-KR')
  const sentAtLabel = result.sentAt ? new Date(result.sentAt).toLocaleString('ko-KR') : '-'

  return [
    '✅ 제안속도 전송 완료',
    '',
    `선박: ${req.vesselName} (IMO ${req.imo})`,
    `항로: ${req.departurePort} → ${req.arrivalPort}`,
    `현재 속도: ${req.currentSpeedKnots} kts`,
    `제안 속도: ${req.recommendedSpeedKnots} kts`,
    `ETA: ${etaLabel}`,
    `전송 시각: ${sentAtLabel}`,
    `전송처: ${result.targetUrl ?? '-'}`,
  ].join('\n')
}

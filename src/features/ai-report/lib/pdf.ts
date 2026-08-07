// AI_REPORT.md §9 — 클라이언트에서 즉시 PDF 생성(서버 왕복 없음). reasoning/risks/
// regionalIssues는 호출부(ReportCard)가 이미 언어에 맞게 해석해서 넘겨준다(§9.3의
// 영문 사전 적용 여부는 이 파일의 관심사가 아니다).

import type { RiskItem, Vessel, Voyage, EcoSpeedReport, RegionalIssue } from '@/shared/types'
import type { PortCongestion } from '@/mocks/port-congestion'
import { congestionLevel } from '@/mocks/port-congestion'
import type { SpeedPlan, VoyageProgress } from '@/features/ai-report/lib/calc'
import type { Translations } from '@/features/i18n/translations'
import { formatDateTime, formatNumber } from '@/shared/utils/format'
import { categoryLabel, confidenceLabel, congestionLevelLabel, trendLabel } from '@/features/ai-report/lib/labels'

const MARGIN_LEFT = 15
const MARGIN_RIGHT = 15
const PAGE_WIDTH = 210
const BODY_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const VALUE_X = 105
const PAGE_BOTTOM = 280
const TOP_Y = 20

let koreanFontPromise: Promise<string | null> | null = null

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// 최초 1회만 fetch하고 이후 호출에서는 캐시(Promise)를 재사용한다.
function loadKoreanFontBase64(): Promise<string | null> {
  if (!koreanFontPromise) {
    koreanFontPromise = fetch('/fonts/NotoSansKR-Regular.ttf')
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('font fetch failed'))))
      .then(arrayBufferToBase64)
      .catch(() => null)
  }
  return koreanFontPromise
}

// WinAnsi(Latin-1)로 표현 불가능한 문자는 ?로 치환하되, 자주 쓰는 특수문자 일부는 허용한다.
const LATIN1_SAFE_EXTRA = new Set(['—', '–', '‘', '’', '“', '”', '…', '•', '€'])

function toLatin1Safe(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code <= 0xff || LATIN1_SAFE_EXTRA.has(ch) ? ch : '?'
    })
    .join('')
}

export interface ExportReportPdfInput {
  lang: 'ko' | 'en'
  t: Translations
  report: EcoSpeedReport
  voyage: Voyage
  vessel: Vessel
  progress: VoyageProgress
  speedPlan: SpeedPlan
  currentSpeedKnots: number
  deadlineTerm: 'RTA' | 'STA'
  congestion: PortCongestion
  reasoning: string
  risks: RiskItem[]
  regionalIssues: RegionalIssue[]
}

export async function exportReportPdf(input: ExportReportPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { t } = input

  let fontName = 'helvetica'
  if (input.lang === 'ko') {
    const base64 = await loadKoreanFontBase64()
    if (base64) {
      doc.addFileToVFS('NotoSansKR-Regular.ttf', base64)
      doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal')
      doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'bold')
      fontName = 'NotoSansKR'
    }
  }

  const text = (s: string) => (fontName === 'helvetica' ? toLatin1Safe(s) : s)
  let y = TOP_Y

  const setBold = () => doc.setFont(fontName, 'bold')
  const setNormal = () => doc.setFont(fontName, 'normal')

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      y = TOP_Y
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(10)
    doc.setFontSize(12)
    setBold()
    doc.setTextColor(20)
    doc.text(text(title), MARGIN_LEFT, y)
    y += 2
    doc.setDrawColor(200)
    doc.line(MARGIN_LEFT, y, MARGIN_LEFT + BODY_WIDTH, y)
    y += 6
    setNormal()
  }

  function labelValueRow(label: string, value: string) {
    ensureSpace(6)
    doc.setFontSize(10)
    setNormal()
    doc.setTextColor(90)
    doc.text(text(label), MARGIN_LEFT, y)
    doc.setTextColor(20)
    doc.text(text(value), VALUE_X, y)
    y += 6
  }

  function paragraph(body: string, fontSize = 10, color = 40) {
    doc.setFontSize(fontSize)
    setNormal()
    doc.setTextColor(color)
    const lines: string[] = doc.splitTextToSize(text(body), BODY_WIDTH)
    for (const line of lines) {
      ensureSpace(5)
      doc.text(line, MARGIN_LEFT, y)
      y += 5
    }
  }

  // 제목
  doc.setFontSize(16)
  setBold()
  doc.setTextColor(20)
  doc.text(text(input.lang === 'ko' ? 'KSF Line — AI 운항 리포트' : 'KSF Line — AI Operations Report'), MARGIN_LEFT, y)
  doc.setFontSize(9)
  setNormal()
  doc.setTextColor(120)
  doc.text(text(`${t.aiReport.generated} ${formatDateTime(input.report.generatedAt)}`), MARGIN_LEFT, y + 6)
  y += 14

  // 선박명(IMO) + 항로
  doc.setFontSize(11)
  setBold()
  doc.setTextColor(20)
  doc.text(
    text(
      `${input.vessel.name} (IMO ${input.vessel.imo}) — ${input.voyage.departurePort} -> ${input.voyage.arrivalPort}`,
    ),
    MARGIN_LEFT,
    y,
  )
  y += 9

  // 항해 진행 상황
  sectionTitle(t.aiReport.progressLineTitle)
  labelValueRow(t.aiReport.totalDistance, `${formatNumber(input.voyage.distanceNm, 0)} nm`)
  labelValueRow(t.aiReport.traveledDistance, `${formatNumber(input.progress.traveled, 0)} nm`)
  labelValueRow(t.aiReport.remainingDistance, `${formatNumber(input.progress.remaining, 0)} nm`)
  labelValueRow(t.aiReport.currentPosition, `${formatNumber(input.progress.percent)}%`)
  y += 2

  // 속도 & RTA/STA 준수
  sectionTitle(`${t.aiReport.speedComparison} & ${t.aiReport.rtaProbability(input.deadlineTerm)}`)
  labelValueRow(t.aiReport.liveSpeed, `${formatNumber(input.currentSpeedKnots)} kts`)
  labelValueRow(t.aiReport.recSpeed, `${formatNumber(input.speedPlan.recommendedSpeedKnots)} kts`)
  labelValueRow(t.aiReport.sta, formatDateTime(input.voyage.sta))
  labelValueRow(
    t.aiReport.rta,
    input.voyage.rtaConfirmed ? formatDateTime(input.voyage.rta) : t.aiReport.rtaUnconfirmedValue,
  )
  labelValueRow(t.aiReport.etaAtCurrentSpeed, formatDateTime(input.speedPlan.etaAtCurrent))
  labelValueRow(t.aiReport.etaAtRecommendedSpeed, formatDateTime(input.speedPlan.etaAtRecommended))

  const cur = input.speedPlan.currentSpeedProbability
  labelValueRow(t.aiReport.rtaProbability(input.deadlineTerm), `${cur.percent}% (${confidenceLabel(t, cur.confidence)})`)
  paragraph(
    cur.marginHours >= 0
      ? t.aiReport.marginBuffer(input.deadlineTerm, formatNumber(cur.marginHours))
      : t.aiReport.marginDeficit(input.deadlineTerm, formatNumber(Math.abs(cur.marginHours))),
    9,
    70,
  )
  paragraph(
    input.speedPlan.recommendedSpeedProbability.percent === 100
      ? t.aiReport.recommendedGuarantee(input.deadlineTerm)
      : t.aiReport.recommendedInfeasible(
          input.deadlineTerm,
          String(input.speedPlan.recommendedSpeedProbability.percent),
        ),
    9,
    70,
  )
  y += 1
  paragraph(
    t.aiReport.requiredSpeedFormula(
      formatNumber(input.progress.remaining, 0),
      formatNumber(input.speedPlan.hoursUntilDeadline),
      formatNumber(input.speedPlan.requiredSpeedKnots),
    ),
    8,
    140,
  )
  y += 2

  // 연료 절감 & CO2 절감
  sectionTitle(`${t.aiReport.fuelSaving} & ${t.aiReport.co2Saving}`)
  labelValueRow(t.aiReport.fuelSavingCumulative, `${input.speedPlan.fuelSavingPercent.toFixed(1)}%`)
  labelValueRow(t.aiReport.fuelSavingAdjustment, `${input.speedPlan.fuelSavingPercentFromCurrent.toFixed(1)}%`)
  labelValueRow(t.aiReport.co2SavingCumulative, `${input.speedPlan.co2SavedTon.toFixed(1)} ton`)
  labelValueRow(t.aiReport.co2SavingAdjustment, `${input.speedPlan.co2SavedTonFromCurrent.toFixed(1)} ton`)
  y += 2

  // 도착항 예상 혼잡도
  sectionTitle(t.aiReport.portCongestionTitle)
  const level = congestionLevel(input.congestion.congestionScore)
  labelValueRow(t.aiReport.portCongestionTitle, `${congestionLevelLabel(t, level)} (${input.congestion.congestionScore}/100)`)
  labelValueRow(
    t.aiReport.avgWaitHours,
    `${formatNumber(input.congestion.avgWaitHours)}h (${trendLabel(t, input.congestion.trend)})`,
  )
  labelValueRow(
    t.aiReport.berthAvailability,
    t.aiReport.berthCount(String(input.congestion.berthsAvailable), String(input.congestion.berthsTotal)),
  )
  y += 2

  // AI 분석 근거
  sectionTitle(t.aiReport.reasoning)
  paragraph(input.reasoning, 10)
  y += 2

  // 운항 고려사항
  sectionTitle(t.aiReport.risks)
  for (const risk of input.risks) {
    ensureSpace(10)
    doc.setFontSize(10)
    setBold()
    doc.setTextColor(20)
    doc.text(text(`[${t.status[risk.level]}] ${risk.title}`), MARGIN_LEFT, y)
    doc.setFontSize(9)
    setNormal()
    doc.setTextColor(120)
    const catText = text(categoryLabel(t, risk.category))
    doc.text(catText, MARGIN_LEFT + BODY_WIDTH - doc.getTextWidth(catText), y)
    y += 5
    paragraph(risk.description, 9, 60)
    y += 2
  }

  // 남은 항로 인근 지역 이슈
  sectionTitle(t.aiReport.regionalIssuesTitle)
  if (input.regionalIssues.length === 0) {
    paragraph(t.aiReport.noNearbyIssues, 10)
  } else {
    for (const issue of input.regionalIssues) {
      ensureSpace(10)
      doc.setFontSize(10)
      setBold()
      doc.setTextColor(20)
      doc.text(text(`[${t.status[issue.severity]}] ${issue.title}`), MARGIN_LEFT, y)
      y += 5
      paragraph(issue.description, 9, 60)
      doc.setFontSize(8)
      setNormal()
      doc.setTextColor(140)
      ensureSpace(4)
      doc.text(text(`${t.aiReport.source}: ${issue.source}`), MARGIN_LEFT, y)
      y += 6
    }
  }

  // 하단
  y += 3
  paragraph(
    input.lang === 'ko'
      ? 'KSF Line — AI 운항 리포팅 생성 (데모 데이터, 참고용).'
      : 'KSF Line — AI Operations Report (demo data, for reference only).',
    8,
    140,
  )

  doc.save(`KSF-AIReport-${input.voyage.id}-${Date.now()}.pdf`)
}

// SIMULATION.md §7 — jsPDF로 클라이언트에서 즉시 생성(서버 왕복 없음). 언어 설정과
// 무관하게 항상 영문으로 생성한다 — Helvetica 기본 폰트에 한글 글리프가 없기 때문
// (KNOWN_PITFALLS.md 7.4). AI_REPORT.md처럼 한글 폰트를 임베딩하는 대신, 이 화면은
// 더 단순한 영문 고정 방식을 택한다.

import type { Voyage, Vessel } from '@/shared/types'
import type { SimInputs } from '@/features/simulation/types'
import type { SimulationOutput } from '@/features/simulation/calc'

const MARGIN_LEFT = 15
const VALUE_X = 115
const LINE_HEIGHT = 6
const PAGE_BOTTOM = 287

// "부산 (Busan)" -> "Busan". 괄호 안이 없으면 원문 그대로.
export function extractEnglishPort(label: string): string {
  const match = label.match(/\(([^)]+)\)/)
  return match ? match[1] : label
}

const WINANSI_SAFE_EXTRA = new Set(['—', '–', '‘', '’', '“', '”', '…', '•', '€'])

// 모든 텍스트 출력을 이 함수에 통과시킨다 — Latin-1 범위를 벗어난 문자는 '?'로 치환.
export function safeText(str: string): string {
  let flagged = false
  const out = Array.from(str)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0
      if (code <= 0xff || WINANSI_SAFE_EXTRA.has(ch)) return ch
      flagged = true
      return '?'
    })
    .join('')
  if (flagged && process.env.NODE_ENV === 'development') {
    console.warn(`[simulation/pdf] non-Latin1 characters replaced with "?" in: ${str}`)
  }
  return out
}

const CONGESTION_EN_LABEL: Record<SimInputs['portCongestion'], string> = {
  low: 'Clear',
  medium: 'Moderate',
  high: 'Congested',
  severe: 'Severe',
}

const CONGESTION_EN_WAIT_HOURS: Record<SimInputs['portCongestion'], number> = {
  low: 0,
  medium: 8,
  high: 20,
  severe: 40,
}

function formatSignedEn(value: number, decimals: number): string {
  const abs = Math.abs(value).toFixed(decimals)
  return value >= 0 ? `-${abs}` : `+${abs}`
}

export interface ExportSimulationPdfInput {
  voyage: Voyage
  vessel: Vessel
  applied: SimInputs
  output: SimulationOutput
  routeDistanceNm: number
  berthWaitHours: number
  compareVoyage: Voyage | null
}

export async function exportSimulationPdf(input: ExportSimulationPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { voyage, vessel, applied, output } = input

  let y = 20

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(10)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20)
    doc.text(safeText(title), MARGIN_LEFT, y)
    y += 2
    doc.setDrawColor(210)
    doc.line(MARGIN_LEFT, y, 195, y)
    y += 6
  }

  function row(label: string, value: string) {
    ensureSpace(LINE_HEIGHT)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90)
    doc.text(safeText(label), MARGIN_LEFT, y)
    doc.setTextColor(20)
    doc.text(safeText(value), VALUE_X, y)
    y += LINE_HEIGHT
  }

  // 제목
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text('KSF Line -- Voyage Simulation Report', MARGIN_LEFT, y)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, MARGIN_LEFT, y + 6)
  y += 14

  const enDeparture = extractEnglishPort(voyage.departurePort)
  const enArrival = extractEnglishPort(voyage.arrivalPort)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text(safeText(`Vessel: ${vessel.name}  (IMO ${vessel.imo})`), MARGIN_LEFT, y)
  y += 6
  doc.text(safeText(`Route: ${enDeparture} -> ${enArrival}`), MARGIN_LEFT, y)
  y += 9
  doc.setFont('helvetica', 'normal')

  // 섹션 1 — Simulation Conditions
  sectionTitle('Simulation Conditions')
  const departureLabel =
    applied.departureOffset === 0
      ? 'No change'
      : applied.departureOffset > 0
        ? `+${applied.departureOffset}h delay`
        : `${Math.abs(applied.departureOffset)}h earlier`
  row('Departure Adjustment', departureLabel)
  row('Speed', `${applied.speedKnots} kts`)
  row('Cargo Load', `${applied.cargoPercent}%`)
  row('Route', applied.route === 'suez' ? 'Suez Canal' : 'Cape of Good Hope')
  row(
    'Destination Port Congestion',
    `${CONGESTION_EN_LABEL[applied.portCongestion]} (~${CONGESTION_EN_WAIT_HOURS[applied.portCongestion]}h wait)`,
  )
  row('Berth Unloading Progress (vessel ahead)', `${applied.berthProgress}% (~${input.berthWaitHours.toFixed(1)}h wait)`)
  y += 2

  // 섹션 2 — Results Summary
  sectionTitle('Results Summary')
  const colX = [15, 80, 122, 164]
  ensureSpace(LINE_HEIGHT)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(90)
  ;['Metric', 'Planned', 'Simulated', 'Historical'].forEach((h, i) => doc.text(h, colX[i], y))
  y += 2
  doc.setDrawColor(230)
  doc.line(MARGIN_LEFT, y, 195, y)
  y += 5

  const hist = output.historical
  const tableRows: [string, string, string, string][] = [
    ['Fuel (ton)', Math.round(output.planned.fuel).toLocaleString(), Math.round(output.simulated.fuel).toLocaleString(), hist ? Math.round(hist.fuel).toLocaleString() : '-'],
    ['Cost (USD)', `$${Math.round(output.planned.cost).toLocaleString()}`, `$${Math.round(output.simulated.cost).toLocaleString()}`, hist ? `$${Math.round(hist.cost).toLocaleString()}` : '-'],
    ['CO2 (ton)', Math.round(output.planned.co2).toLocaleString(), Math.round(output.simulated.co2).toLocaleString(), hist ? Math.round(hist.co2).toLocaleString() : '-'],
    ['Days', output.planned.days.toFixed(1), output.simulated.days.toFixed(1), hist ? hist.days.toFixed(1) : '-'],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(20)
  for (const cells of tableRows) {
    ensureSpace(LINE_HEIGHT)
    cells.forEach((c, i) => doc.text(safeText(c), colX[i], y))
    y += LINE_HEIGHT
  }

  if (hist && input.compareVoyage) {
    ensureSpace(LINE_HEIGHT)
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(
      safeText(
        `Historical reference: ${extractEnglishPort(input.compareVoyage.departurePort)} -> ${extractEnglishPort(input.compareVoyage.arrivalPort)} (${input.compareVoyage.id})`,
      ),
      MARGIN_LEFT,
      y,
    )
    y += LINE_HEIGHT
  }
  y += 1

  // 섹션 3 — Savings vs Current Plan
  sectionTitle('Savings vs Current Plan')
  row('Fuel', `${formatSignedEn(output.savings.fuel, 1)} ton`)
  row('Cost', `$${formatSignedEn(output.savings.cost, 0)}`)
  row('CO2', `${formatSignedEn(output.savings.co2, 1)} ton`)
  y += 2

  // 섹션 4 — Arrival & Port Wait
  sectionTitle('Arrival & Port Wait')
  row('Planned ETA', new Date(voyage.eta).toLocaleString('en-US'))
  row('Simulated ETA', new Date(output.simulated.eta).toLocaleString('en-US'))
  row('Expected Port Wait', `${output.portWaitHours.toFixed(1)}h`)
  row('Estimated Waiting Cost', `$${Math.round(output.portWaitCost).toLocaleString()}`)

  // 푸터
  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text('Generated by KSF Line -- Logistics Simulation (demo data, for planning reference only).', MARGIN_LEFT, PAGE_BOTTOM)

  doc.save(`KSF-Simulation-${voyage.id}-${Date.now()}.pdf`)
}

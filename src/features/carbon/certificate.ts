// CARBON.md §7.2~7.4 — Scope 3 증명서 본문 생성 + 클라이언트 즉시 다운로드(서버 왕복 없음).

export interface CertificateInput {
  vesselName: string
  departurePort: string
  arrivalPort: string
  distanceNm: number
  cargoDescription: string
  savedTon: number
  savedPct: number
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildKoCertificate(input: CertificateInput): string {
  return `ESG SCOPE 3 탄소 절감 실적 증명서

선박명: ${input.vesselName}
항로: ${input.departurePort} → ${input.arrivalPort} (${input.distanceNm.toLocaleString()} nm)
화물: ${input.cargoDescription}

본 증명서는 상기 항차에서 AI 에코스피드 최적 운항을 적용한 결과, 유사 선박·동일 항로 평균 대비 CO₂ 배출량 ${input.savedTon.toFixed(1)} ton(${input.savedPct.toFixed(1)}%)을 절감하였음을 증명합니다.

본 절감 실적은 귀사의 Scope 3(공급망) 탄소 배출량 산정에 활용하실 수 있습니다.

발급일: ${todayIso()}
발급: KNOT SO FAST 운항 최적화 플랫폼`
}

// 영문 버전은 화살표를 ->로, CO₂를 CO2로 쓴다(ASCII 안전).
function buildEnCertificate(input: CertificateInput): string {
  return `ESG SCOPE 3 CARBON REDUCTION CERTIFICATE

Vessel: ${input.vesselName}
Route: ${input.departurePort} -> ${input.arrivalPort} (${input.distanceNm.toLocaleString()} nm)
Cargo: ${input.cargoDescription}

This certifies that AI-optimized eco-speed operation on the above voyage reduced CO2 emissions by ${input.savedTon.toFixed(1)} ton (${input.savedPct.toFixed(1)}%) versus the benchmark average of similar vessels on the same route.

This reduction record may be used toward your organization's Scope 3 (supply chain) carbon accounting.

Issued: ${todayIso()}
Issued by: KNOT SO FAST Voyage Optimization Platform`
}

export function buildCertificateText(lang: 'ko' | 'en', input: CertificateInput): string {
  return lang === 'ko' ? buildKoCertificate(input) : buildEnCertificate(input)
}

// charset=utf-8을 반드시 지정한다 — 없으면 한국어 증명서가 일부 환경에서 깨진다.
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url) // 메모리 누수 방지
}

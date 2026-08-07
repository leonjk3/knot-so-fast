// 화면(ReportCard)과 PDF(lib/pdf.ts) 양쪽에서 같은 문구를 쓰기 위한 i18n 라벨 매핑.
// lib/calc.ts는 순수 숫자 계산만 담당하므로 라벨 문자열 매핑은 이 파일로 분리한다.

import type { Translations } from '@/features/i18n/translations'
import type { RiskItem } from '@/shared/types'
import type { CongestionLevel, CongestionTrend } from '@/mocks/port-congestion'
import type { ProbabilityResult } from '@/features/ai-report/lib/calc'

export function categoryLabel(t: Translations, category: RiskItem['category']): string {
  switch (category) {
    case 'weather':
      return t.aiReport.catWeather
    case 'port':
      return t.aiReport.catPort
    case 'geopolitical':
      return t.aiReport.catGeopolitical
    case 'mechanical':
      return t.aiReport.catMechanical
  }
}

export function congestionLevelLabel(t: Translations, level: CongestionLevel): string {
  switch (level) {
    case 'high':
      return t.aiReport.congestionHigh
    case 'medium':
      return t.aiReport.congestionMedium
    case 'low':
      return t.aiReport.congestionLow
  }
}

export function trendLabel(t: Translations, trend: CongestionTrend): string {
  switch (trend) {
    case 'rising':
      return t.aiReport.trendRising
    case 'falling':
      return t.aiReport.trendFalling
    case 'stable':
      return t.aiReport.trendStable
  }
}

export function confidenceLabel(t: Translations, confidence: ProbabilityResult['confidence']): string {
  switch (confidence) {
    case 'high':
      return t.aiReport.confidenceHigh
    case 'medium':
      return t.aiReport.confidenceMedium
    case 'low':
      return t.aiReport.confidenceLow
  }
}

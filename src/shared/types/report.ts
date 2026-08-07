export interface RiskItem {
  level: 'high' | 'medium' | 'low'
  category: 'weather' | 'geopolitical' | 'port' | 'mechanical'
  title: string
  description: string
}

export interface EcoSpeedReport {
  id: string
  voyageId: string
  generatedAt: string
  recommendedSpeed: number
  currentPlanSpeed: number
  // fuelSavingPercent/co2SavedTon/canMeetRta: AI_REPORT.md 3.1의 타입에는 없지만
  // mocks/reports.ts가 리포트 생성 시점 값으로 이미 계산해 저장해 둔다(6.4장 계산과 별개).
  fuelSavingPercent: number
  co2SavedTon: number
  canMeetRta: boolean
  etaIfRecommended: string
  reasoning: string
  risks: RiskItem[]
}

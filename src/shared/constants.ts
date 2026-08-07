// 선사 자사명 — 등록 시 Vessel.company에 자동 고정되는 값 (VESSEL.md 3.1장)
export const OWN_COMPANY_NAME = 'KSF Line'

// 화면 간 딥링크 전달용 sessionStorage 1회성 키 3종 (DASHBOARD.md 10장)
export const AI_REPORT_VESSEL_ID_KEY = 'ksf:ai-report-vessel-id'      // 게이지 카드 AI 버튼 → /ai-report
export const SCHEDULE_CALENDAR_DATE_KEY = 'ksf:schedule-calendar-date' // 주간 캘린더 날짜 → /schedule
export const CARBON_VESSEL_ID_KEY = 'ksf:carbon-vessel-id'             // 에코 랭킹 항목 → /carbon

// SWR 영속 캐시 localStorage 키 (BOOTSTRAP.md 9.2장, 방식 B로 전환할 때만 사용)
export const SWR_CACHE_KEY = 'ksf:swr-cache'

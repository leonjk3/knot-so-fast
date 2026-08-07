import { PORTS } from '@/mocks/ports'

// "로스앤젤레스 (Los Angeles)" -> "LAX" — 괄호 안 영문명으로 역조회한다 (SCHEDULE.md 6.4장).
// 사전에 없는 항구명이면 undefined — 캘린더 마커는 괄호를 생략하고, 모달은 선택값이 빈다.
export function getPortCode(label: string): string | undefined {
  const match = label.match(/\(([^)]+)\)/)
  const en = (match ? match[1] : label).trim().toLowerCase()
  return PORTS.find((p) => p.nameEn.toLowerCase() === en)?.code
}

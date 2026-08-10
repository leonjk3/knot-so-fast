export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// DASHBOARD.md 5.5장 — "M.DD - M.DD" (월은 미패딩, 일은 2자리)
export function formatWeekPeriodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(start)} - ${fmt(end)}`
}

// DASHBOARD.md 10.2장 딥링크 값("YYYY-MM-DD") — toISOString()은 UTC로 변환돼 자정 근처
// 날짜가 하루 밀릴 수 있으므로, 로컬 날짜 구성요소로 직접 조립한다.
export function toDateKey(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

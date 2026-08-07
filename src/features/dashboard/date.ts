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

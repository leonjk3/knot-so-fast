function pad2(n: number | string): string {
  return String(n).padStart(2, '0')
}

function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export interface LocalDateTimeParts {
  date: string
  hour12: string
  minute: string
  ampm: 'AM' | 'PM'
}

// "2026-08-10T14:30" -> {date, hour12, minute, ampm} (SCHEDULE.md 5.6장)
export function splitLocalDateTime(local: string): LocalDateTimeParts {
  if (!local) return { date: '', hour12: '9', minute: '00', ampm: 'AM' }
  const [date, time] = local.split('T')
  const [hStr, mStr] = (time ?? '00:00').split(':')
  const h24 = Number(hStr)
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { date, hour12: String(hour12), minute: mStr ?? '00', ampm }
}

// 날짜를 아직 고르지 않았어도 오늘 날짜를 채워 값이 조용히 버려지지 않게 한다 (5.6장 주의)
export function joinLocalDateTime(date: string, hour12: string, minute: string, ampm: 'AM' | 'PM'): string {
  const d = date || todayDateStr()
  const h24 = (Number(hour12) % 12) + (ampm === 'PM' ? 12 : 0)
  return `${d}T${pad2(h24)}:${pad2(minute)}`
}

export function toIso(local: string): string {
  return local ? new Date(local).toISOString() : ''
}

// iso.slice(0,16)을 쓰면 UTC 문자열이 그대로 잘려 로컬 타임존과 어긋난다 (5.6장 주의) — 반드시 로컬 getter로 재구성한다
export function isoToLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

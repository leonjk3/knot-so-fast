import type { Vessel, Voyage, VoyageStatus } from '@/shared/types'
import { getPortCode } from './portCode'

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// 항상 42칸(6주 × 7일) 고정 — 달마다 행 수가 바뀌면 뷰 전환 시 레이아웃이 튄다 (11장)
export function buildMonthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export type CalendarEventType = 'departure' | 'arrival'

export interface CalendarEvent {
  type: CalendarEventType
  voyage: Voyage
  vesselName: string
  portCodes?: string
  statusColor: string
}

export function buildEventsByDate(
  voyages: Voyage[],
  vessels: Vessel[],
  statusColors: Record<VoyageStatus, string>,
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()

  function push(dateKey: string, event: CalendarEvent) {
    const list = map.get(dateKey)
    if (list) list.push(event)
    else map.set(dateKey, [event])
  }

  function dateKey(iso: string): string {
    const d = new Date(iso)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }

  for (const voyage of voyages) {
    const vesselName = vessels.find((v) => v.id === voyage.vesselId)?.name ?? '-'
    const depCode = getPortCode(voyage.departurePort)
    const arrCode = getPortCode(voyage.arrivalPort)
    const portCodes = depCode && arrCode ? `${depCode}-${arrCode}` : undefined
    const statusColor = statusColors[voyage.status]

    if (voyage.etd) push(dateKey(voyage.etd), { type: 'departure', voyage, vesselName, portCodes, statusColor })
    if (voyage.rta) push(dateKey(voyage.rta), { type: 'arrival', voyage, vesselName, portCodes, statusColor })
  }

  return map
}

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

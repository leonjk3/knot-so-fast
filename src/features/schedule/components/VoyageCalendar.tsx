'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Vessel, Voyage } from '@/shared/types'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { VOYAGE_STATUS_COLORS } from '@/shared/constants'
import { cn } from '@/shared/utils/cn'
import { buildEventsByDate, buildMonthCells, dateKeyOf, isSameDay, type CalendarEvent } from '../lib/calendar'

const MAX_MARKERS_PER_DAY = 3

function monthLabel(cursor: Date): string {
  return `${cursor.getFullYear()}.${String(cursor.getMonth() + 1).padStart(2, '0')}`
}

interface DayMarkerProps {
  event: CalendarEvent
  onClick: () => void
}

function DayMarker({ event, onClick }: DayMarkerProps) {
  const { t } = useLanguage()
  const isDeparture = event.type === 'departure'
  const Icon = isDeparture ? ArrowUpRight : ArrowDownLeft
  const tag = isDeparture ? t.schedule.departureTag : t.schedule.arrivalTag

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${tag} · ${event.vesselName}${event.portCodes ? `(${event.portCodes})` : ''}`}
      style={{ color: event.statusColor, backgroundColor: `${event.statusColor}20` }}
      className="flex w-full items-center gap-0.5 truncate rounded px-1 py-0.5 text-left text-[10px] hover:opacity-75"
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">
        {event.vesselName}
        {event.portCodes && <span className="opacity-70">({event.portCodes})</span>}
      </span>
    </button>
  )
}

interface VoyageCalendarProps {
  voyages: Voyage[]
  vessels: Vessel[]
  focusDate: Date | null
  onMarkerClick: (voyage: Voyage) => void
}

export function VoyageCalendar({ voyages, vessels, focusDate, onMarkerClick }: VoyageCalendarProps) {
  const { t } = useLanguage()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  useEffect(() => {
    if (!focusDate) return
    // cursor는 월 이동 버튼으로도 바뀌는 독립 상태라 렌더 중 파생시킬 수 없다 —
    // focusDate가 바뀔 때만 그 달로 리셋한다 (SCHEDULE.md 8장).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCursor(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1))
  }, [focusDate])

  const cells = useMemo(() => buildMonthCells(cursor), [cursor])
  const eventsByDate = useMemo(() => buildEventsByDate(voyages, vessels, VOYAGE_STATUS_COLORS), [voyages, vessels])
  const today = useMemo(() => new Date(), [])

  function goPrevMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  }
  function goNextMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  }
  function goToday() {
    const now = new Date()
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-28 text-center text-sm font-semibold">{monthLabel(cursor)}</span>
          <button
            type="button"
            onClick={goNextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t.schedule.todayBtn}
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
        {t.schedule.weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth()
          const isToday = isSameDay(day, today)
          const isFocused = !!focusDate && isSameDay(day, focusDate)
          const events = eventsByDate.get(dateKeyOf(day)) ?? []
          const visibleEvents = events.slice(0, MAX_MARKERS_PER_DAY)
          const overflowCount = events.length - visibleEvents.length

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex min-h-[92px] flex-col gap-0.5 bg-white p-1 dark:bg-slate-900',
                isFocused && 'ring-2 ring-inset ring-[#6366f1]',
              )}
            >
              <span
                className={cn(
                  'px-1 text-xs',
                  !inMonth && 'text-slate-300 dark:text-slate-700',
                  inMonth && !isToday && 'text-slate-600 dark:text-slate-300',
                  isToday && 'flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1] font-semibold text-white',
                )}
              >
                {day.getDate()}
              </span>
              {visibleEvents.map((event, idx) => (
                <DayMarker key={idx} event={event} onClick={() => onMarkerClick(event.voyage)} />
              ))}
              {overflowCount > 0 && (
                <span className="px-1 text-[10px] text-slate-400">{t.schedule.moreEvents(String(overflowCount))}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

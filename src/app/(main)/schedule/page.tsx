'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, List, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import type { Voyage } from '@/shared/types'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_REPORTS } from '@/mocks/reports'
import { MOCK_POSITIONS } from '@/mocks/positions'
import { SCHEDULE_CALENDAR_DATE_KEY } from '@/shared/constants'
import { cn } from '@/shared/utils/cn'
import { VoyageTable } from '@/features/schedule/components/VoyageTable'
import { VoyageCalendar } from '@/features/schedule/components/VoyageCalendar'
import { VoyageModal } from '@/features/schedule/components/VoyageModal'
import { filterVoyages, sortVoyages, countByStatus, type StatusFilter } from '@/features/schedule/lib/filter'
import { getRtaProbability } from '@/features/schedule/lib/probability'
import type { VoyageModalMode } from '@/features/schedule/lib/policy'

type ViewTab = 'list' | 'calendar'

export default function SchedulePage() {
  const { t } = useLanguage()
  const [voyages, setVoyages] = useState<Voyage[]>(MOCK_VOYAGES)
  const [viewTab, setViewTab] = useState<ViewTab>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null)
  const [modalMode, setModalMode] = useState<VoyageModalMode | null>(null)
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null)

  // 대시보드 "이번 주 일정" 카드에서 넘어온 딥링크 — 1회성 소비 (SCHEDULE.md 8장)
  useEffect(() => {
    const dateStr = sessionStorage.getItem(SCHEDULE_CALENDAR_DATE_KEY)
    if (!dateStr) return
    sessionStorage.removeItem(SCHEDULE_CALENDAR_DATE_KEY)
    // 마운트 시 1회성 sessionStorage 소비 — 브라우저 전용 API라 렌더 중에는 읽을 수 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalendarFocusDate(new Date(dateStr))
    setViewTab('calendar')
  }, [])

  const counts = useMemo(() => countByStatus(voyages), [voyages])
  const visibleVoyages = useMemo(
    () => sortVoyages(filterVoyages(voyages, MOCK_VESSELS, statusFilter, search)),
    [voyages, statusFilter, search],
  )

  function getProbability(voyage: Voyage) {
    return getRtaProbability(voyage, MOCK_REPORTS, MOCK_VESSELS, MOCK_POSITIONS)
  }

  function openVoyage(voyage: Voyage) {
    setSelectedVoyage(voyage)
    setModalMode('view')
  }

  function handleModalSubmit(voyage: Voyage) {
    setVoyages((prev) => {
      const exists = prev.some((v) => v.id === voyage.id)
      return exists ? prev.map((v) => (v.id === voyage.id ? voyage : v)) : [...prev, voyage]
    })
    setModalMode(null)
  }

  const STATUS_TABS: { value: StatusFilter; labelKey: 'preparing' | 'underway' | 'delayed' | 'completed'; count: number }[] = [
    { value: 'underway', labelKey: 'underway', count: counts.underway },
    { value: 'delayed', labelKey: 'delayed', count: counts.delayed },
    { value: 'preparing', labelKey: 'preparing', count: counts.preparing },
    { value: 'completed', labelKey: 'completed', count: counts.completed },
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.schedule.title} subtitle={t.schedule.subtitle}>
        <button
          type="button"
          onClick={() => {
            setSelectedVoyage(null)
            setModalMode('create')
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5]"
        >
          <Plus className="h-4 w-4" />
          {t.schedule.addVoyage}
        </button>
      </PageHeader>

      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="-mx-6 mb-3 border-b border-slate-200 px-6 dark:border-slate-800">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setViewTab('list')}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 py-2 text-sm font-medium',
                viewTab === 'list' ? 'border-[#6366f1] text-[#6366f1]' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <List className="h-4 w-4" />
              {t.schedule.viewList}
            </button>
            <button
              type="button"
              onClick={() => setViewTab('calendar')}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 py-2 text-sm font-medium',
                viewTab === 'calendar' ? 'border-[#6366f1] text-[#6366f1]' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <CalendarRange className="h-4 w-4" />
              {t.schedule.viewCalendar}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.schedule.searchPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:ring-2 focus:ring-[#6366f1] focus:outline-none dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium',
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500',
              )}
            >
              {t.common.all} <span className="opacity-60">({counts.all})</span>
            </button>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap',
                  statusFilter === tab.value
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500',
                )}
              >
                {t.status[tab.labelKey]} <span className="opacity-60">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {viewTab === 'list' ? (
          <VoyageTable
            voyages={visibleVoyages}
            vessels={MOCK_VESSELS}
            getProbability={getProbability}
            onRowClick={openVoyage}
          />
        ) : (
          <VoyageCalendar
            voyages={visibleVoyages}
            vessels={MOCK_VESSELS}
            focusDate={calendarFocusDate}
            onMarkerClick={openVoyage}
          />
        )}
      </div>

      {modalMode && (
        <VoyageModal
          mode={modalMode}
          voyage={modalMode === 'view' ? selectedVoyage : null}
          vessels={MOCK_VESSELS}
          onClose={() => setModalMode(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  )
}

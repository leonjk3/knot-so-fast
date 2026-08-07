'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { SummaryCards } from '@/features/dashboard/SummaryCards'
import { FleetGaugeCard } from '@/features/dashboard/FleetGaugeCard'
import { FilterBar } from '@/features/dashboard/FilterBar'
import { computeFleetGauges, getActiveVoyages } from '@/features/dashboard/fleetGauge'
import { computeDestinations, computeVisibleVoyageIds, layersForFilters, type QuickFilterKey } from '@/features/dashboard/filters'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_POSITIONS } from '@/mocks/positions'

// Leaflet은 window에 의존하므로 반드시 SSR을 끄고 동적 import 한다 (9.1장)
const MapView = dynamic(() => import('@/features/dashboard/MapView'), { ssr: false })

export default function DashboardPage() {
  const { t } = useLanguage()
  const [selectedVoyageIds, setSelectedVoyageIds] = useState<Set<string>>(new Set())
  const [activeFilters, setActiveFilters] = useState<Set<QuickFilterKey>>(new Set())
  const [destinationFilter, setDestinationFilter] = useState<string | null>(null)
  const [gaugesOpen, setGaugesOpen] = useState(false)
  const [resetMapToken, setResetMapToken] = useState(0)

  const activeVoyages = useMemo(() => getActiveVoyages(MOCK_VOYAGES), [])
  const gauges = useMemo(() => computeFleetGauges(MOCK_VOYAGES, MOCK_VESSELS, MOCK_POSITIONS), [])

  // 최초 진입 시 자사 활성 항차를 전부 선택한다. useRef 플래그로 1회만 실행해야 한다 —
  // 그러지 않으면 사용자가 해제한 선택이 데이터 갱신 때마다 되살아난다(14장 엣지 케이스).
  const didInitSelection = useRef(false)
  useEffect(() => {
    if (didInitSelection.current) return
    didInitSelection.current = true
    setSelectedVoyageIds(new Set(activeVoyages.map((v) => v.id)))
  }, [activeVoyages])

  const destinations = useMemo(() => computeDestinations(activeFilters), [activeFilters])
  const totalVesselCount = useMemo(() => destinations.reduce((sum, d) => sum + d.count, 0), [destinations])

  const visibleVoyageIds = useMemo(
    () => computeVisibleVoyageIds({ filters: activeFilters, destinationFilter, destinations, selectedVoyageIds }),
    [activeFilters, destinationFilter, destinations, selectedVoyageIds],
  )
  const layers = useMemo(() => layersForFilters(activeFilters), [activeFilters])

  // DASHBOARD.md 7.2장 — wasActive는 업데이터 바깥에서 먼저 읽는다. 업데이터 안에서 다른
  // state의 setter를 호출하면 부수효과가 중복 실행돼 "필터가 간헐적으로 안 먹는" 버그가 난다
  // (KNOWN_PITFALLS.md 1.3).
  function toggleQuickFilter(key: QuickFilterKey) {
    const wasActive = activeFilters.has(key)

    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (wasActive) {
        next.delete(key)
      } else {
        next.add(key)
        if (key === 'issues') next.delete('ports')
        if (key === 'ports') next.delete('issues')
      }
      return next
    })

    if (key === 'my') {
      if (!wasActive) setSelectedVoyageIds(new Set(activeVoyages.map((v) => v.id)))
      setGaugesOpen((v) => !v)
    }
    setResetMapToken((t) => t + 1)
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />
      <SummaryCards />

      {/* 함대 게이지 카드 — 활성 항차 1건 이상일 때만 렌더링 (4장) */}
      {activeVoyages.length > 0 && (
        <FleetGaugeCard
          rows={gauges}
          selectedVoyageIds={selectedVoyageIds}
          setSelectedVoyageIds={setSelectedVoyageIds}
          open={gaugesOpen}
          onToggleOpen={() => setGaugesOpen((v) => !v)}
        />
      )}

      <FilterBar
        activeFilters={activeFilters}
        onToggleFilter={toggleQuickFilter}
        destinations={destinations}
        totalVesselCount={totalVesselCount}
        visibleVesselCount={visibleVoyageIds.size}
        destinationFilter={destinationFilter}
        onSelectDestination={setDestinationFilter}
      />

      {/* 지도 영역 (9장 MapView) — 최소 500px 보장, 상단 블록이 늘어나도 짜부라지지 않는다.
          relative는 MapView 내부의 absolute inset-0 컨테이너가 크기를 잡는 기준이 된다. */}
      <div className="relative min-h-[500px] flex-1">
        <MapView visibleVoyageIds={visibleVoyageIds} resetToken={resetMapToken} layers={layers} />
      </div>
    </div>
  )
}

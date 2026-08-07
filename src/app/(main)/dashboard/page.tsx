'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { SummaryCards } from '@/features/dashboard/SummaryCards'
import { FleetGaugeCard } from '@/features/dashboard/FleetGaugeCard'
import { computeFleetGauges, getActiveVoyages } from '@/features/dashboard/fleetGauge'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_POSITIONS } from '@/mocks/positions'

// Leaflet은 window에 의존하므로 반드시 SSR을 끄고 동적 import 한다 (9.1장)
const MapView = dynamic(() => import('@/features/dashboard/MapView'), { ssr: false })

export default function DashboardPage() {
  const { t } = useLanguage()
  const [selectedVoyageIds, setSelectedVoyageIds] = useState<Set<string>>(new Set())

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

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />
      <SummaryCards />

      {/* 함대 게이지 카드 — 활성 항차 1건 이상일 때만 렌더링 (4장) */}
      {activeVoyages.length > 0 && (
        <FleetGaugeCard rows={gauges} selectedVoyageIds={selectedVoyageIds} setSelectedVoyageIds={setSelectedVoyageIds} />
      )}

      {/* 지도 영역 (9장 MapView) — 최소 500px 보장, 상단 블록이 늘어나도 짜부라지지 않는다.
          relative는 MapView 내부의 absolute inset-0 컨테이너가 크기를 잡는 기준이 된다. */}
      <div className="relative min-h-[500px] flex-1">
        <MapView selectedVoyageIds={selectedVoyageIds} />
      </div>
    </div>
  )
}

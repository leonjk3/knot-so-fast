'use client'

import dynamic from 'next/dynamic'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { SummaryCards } from '@/features/dashboard/SummaryCards'

// Leaflet은 window에 의존하므로 반드시 SSR을 끄고 동적 import 한다 (9.1장)
const MapView = dynamic(() => import('@/features/dashboard/MapView'), { ssr: false })

export default function DashboardPage() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />
      <SummaryCards />

      {/* 지도 영역 (9장 MapView) — 최소 500px 보장, 상단 블록이 늘어나도 짜부라지지 않는다.
          relative는 MapView 내부의 absolute inset-0 컨테이너가 크기를 잡는 기준이 된다. */}
      <div className="relative min-h-[500px] flex-1">
        <MapView />
      </div>
    </div>
  )
}

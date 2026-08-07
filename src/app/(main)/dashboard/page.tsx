'use client'

import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { SummaryCards } from '@/features/dashboard/SummaryCards'

export default function DashboardPage() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />
      <SummaryCards />

      {/* 지도 영역 (9장 MapView) — 최소 500px 보장, 상단 블록이 늘어나도 짜부라지지 않는다 */}
      <div className="flex min-h-[500px] flex-1 items-center justify-center bg-slate-50 text-sm text-slate-400 dark:bg-slate-900">
        docs/specs/DASHBOARD.md 9장 — 지도 영역 (placeholder)
      </div>
    </div>
  )
}

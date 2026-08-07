'use client'

import { useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { ReportCard, type ReportCardHandle } from '@/features/ai-report/components/ReportCard'
import { MOCK_REPORTS } from '@/mocks/reports'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_POSITIONS } from '@/mocks/positions'
import { cn } from '@/shared/utils/cn'

export default function AiReportPage() {
  const { t } = useLanguage()
  const cardRefs = useRef<Record<string, ReportCardHandle | null>>({})
  const [pendingCount, setPendingCount] = useState(0)

  function handleReanalyzeAll() {
    Object.values(cardRefs.current).forEach((handle) => handle?.reanalyze())
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.aiReport.title} subtitle={t.aiReport.subtitle}>
        <button
          disabled={pendingCount > 0}
          onClick={handleReanalyzeAll}
          title={t.aiReport.reanalyzeAll}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', pendingCount > 0 && 'animate-spin')} />
          {t.aiReport.reanalyzeAll}
        </button>
      </PageHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {MOCK_REPORTS.map((report, i) => {
          const voyage = MOCK_VOYAGES.find((v) => v.id === report.voyageId)
          const vessel = voyage ? MOCK_VESSELS.find((v) => v.id === voyage.vesselId) : undefined
          if (!voyage || !vessel) return null
          const position = MOCK_POSITIONS.find((p) => p.vesselId === vessel.id)
          return (
            <ReportCard
              key={report.id}
              ref={(el) => {
                cardRefs.current[report.id] = el
              }}
              report={report}
              voyage={voyage}
              vessel={vessel}
              position={position}
              defaultOpen={i === 0}
              onReanalyzeStart={() => setPendingCount((c) => c + 1)}
              onReanalyzeEnd={() => setPendingCount((c) => Math.max(0, c - 1))}
            />
          )
        })}
      </div>
    </div>
  )
}

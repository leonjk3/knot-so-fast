'use client'

import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { ReportCard } from '@/features/ai-report/components/ReportCard'
import { MOCK_REPORTS } from '@/mocks/reports'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'

export default function AiReportPage() {
  const { t } = useLanguage()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.aiReport.title} subtitle={t.aiReport.subtitle}>
        <button
          disabled
          title={t.aiReport.reanalyzeAll}
          className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-300 dark:border-slate-700 dark:text-slate-600"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t.aiReport.reanalyzeAll}
        </button>
      </PageHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {MOCK_REPORTS.map((report, i) => {
          const voyage = MOCK_VOYAGES.find((v) => v.id === report.voyageId)
          const vessel = voyage ? MOCK_VESSELS.find((v) => v.id === voyage.vesselId) : undefined
          if (!voyage || !vessel) return null
          return <ReportCard key={report.id} report={report} voyage={voyage} vessel={vessel} defaultOpen={i === 0} />
        })}
      </div>
    </div>
  )
}

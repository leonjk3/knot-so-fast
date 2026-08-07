'use client'

import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'

export default function AiReportPage() {
  const { t } = useLanguage()
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.nav.aiReport} />
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        docs/specs/AI_REPORT.md
      </div>
    </div>
  )
}

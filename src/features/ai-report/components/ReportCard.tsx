'use client'

import { useState } from 'react'
import {
  Ship,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Info,
  FileDown,
  AlertCircle,
  Wind,
  Anchor,
  Shield,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { RiskBadge } from '@/shared/components/StatusBadge'
import { formatDateTime } from '@/shared/utils/format'
import { cn } from '@/shared/utils/cn'
import { portShortName } from '@/features/ai-report/lib/calc'
import type { EcoSpeedReport, RiskItem, Vessel, Voyage } from '@/shared/types'

const RISK_CATEGORY_ICON: Record<RiskItem['category'], LucideIcon> = {
  weather: Wind,
  port: Anchor,
  geopolitical: Shield,
  mechanical: Wrench,
}

const RISK_LEVEL_ICON_COLOR: Record<RiskItem['level'], string> = {
  high: 'text-red-500',
  medium: 'text-yellow-500',
  low: 'text-[#6366f1]',
}

const RISK_LEVEL_BORDER: Record<RiskItem['level'], string> = {
  high: 'border-red-200 dark:border-red-900/50',
  medium: 'border-yellow-200 dark:border-yellow-900/50',
  low: 'border-slate-200 dark:border-slate-700',
}

function categoryLabel(t: ReturnType<typeof useLanguage>['t'], category: RiskItem['category']): string {
  switch (category) {
    case 'weather':
      return t.aiReport.catWeather
    case 'port':
      return t.aiReport.catPort
    case 'geopolitical':
      return t.aiReport.catGeopolitical
    case 'mechanical':
      return t.aiReport.catMechanical
  }
}

interface ReportCardProps {
  report: EcoSpeedReport
  voyage: Voyage
  vessel: Vessel
  defaultOpen?: boolean
}

export function ReportCard({ report, voyage, vessel, defaultOpen = false }: ReportCardProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      id={`ai-report-${report.id}`}
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
          <Ship className="h-5 w-5 text-[#6366f1]" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{vessel.name}</p>
          <p className="truncate text-sm text-slate-500">
            {portShortName(voyage.departurePort)} → {portShortName(voyage.arrivalPort)} ·{' '}
            {formatDateTime(report.generatedAt)} {t.aiReport.generated}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-6 sm:flex">
          <div className="text-right">
            <p className="text-sm font-bold text-green-600 dark:text-green-400">
              {report.fuelSavingPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">{t.aiReport.fuelSaving}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[#6366f1]">{report.recommendedSpeed} kts</p>
            <p className="text-xs text-slate-400">{t.aiReport.speedComparison}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span
            role="button"
            title={t.aiReport.downloadPdf}
            aria-disabled
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full text-slate-300 dark:text-slate-600"
          >
            <FileDown className="h-4 w-4" />
          </span>
          <span
            role="button"
            title={t.aiReport.reanalyze}
            aria-disabled
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full text-slate-300 dark:text-slate-600"
          >
            <RefreshCw className="h-4 w-4" />
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-200 px-5 py-5 dark:border-slate-700">
          {!voyage.rtaConfirmed && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t.aiReport.rtaUnconfirmedNotice}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-base font-semibold">{t.aiReport.reasoning}</h3>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm whitespace-pre-line text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              {report.reasoning}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold">{t.aiReport.risks}</h3>
            <div className="space-y-2">
              {report.risks.map((risk, i) => {
                const Icon = risk.level === 'low' ? Info : AlertTriangle
                const CategoryIcon = RISK_CATEGORY_ICON[risk.category]
                return (
                  <div
                    key={i}
                    className={cn('rounded-lg border px-4 py-3', RISK_LEVEL_BORDER[risk.level])}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', RISK_LEVEL_ICON_COLOR[risk.level])} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{risk.title}</span>
                          <RiskBadge level={risk.level} />
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <CategoryIcon className="h-3 w-3" />
                            {categoryLabel(t, risk.category)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{risk.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

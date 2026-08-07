'use client'

import { useMemo, useState } from 'react'
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
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  CalendarClock,
  RadioTower,
  Timer,
  CalendarCheck,
  Fuel,
  Leaf,
  type LucideIcon,
} from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { RiskBadge } from '@/shared/components/StatusBadge'
import { formatDateTime, formatNumber } from '@/shared/utils/format'
import { cn } from '@/shared/utils/cn'
import { computeSpeedPlan, computeVoyageProgress, portShortName } from '@/features/ai-report/lib/calc'
import { StatCard } from '@/features/ai-report/components/StatCard'
import { ProbabilityGauge } from '@/features/ai-report/components/ProbabilityGauge'
import { VoyageProgressLine } from '@/features/ai-report/components/VoyageProgressLine'
import type { AisPosition, EcoSpeedReport, RiskItem, Vessel, Voyage } from '@/shared/types'

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

const CONFIDENCE_TEXT: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-red-600 dark:text-red-400',
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
  position?: AisPosition
  defaultOpen?: boolean
}

export function ReportCard({ report, voyage, vessel, position, defaultOpen = false }: ReportCardProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(defaultOpen)

  const deadlineTerm = voyage.rtaConfirmed ? 'RTA' : 'STA'
  const deadlineIso = voyage.rtaConfirmed ? voyage.rta : voyage.sta
  const currentSpeedKnots = position?.speedKnots ?? voyage.plannedSpeedKnots

  const progress = useMemo(
    () => computeVoyageProgress(voyage.plannedRoute, voyage.distanceNm, position),
    [voyage.plannedRoute, voyage.distanceNm, position],
  )

  const speedPlan = useMemo(
    () =>
      computeSpeedPlan({
        vessel,
        voyage,
        report,
        remainingNm: progress.remaining,
        currentSpeedKnots,
        nowIso: report.generatedAt,
        deadlineIso,
      }),
    [vessel, voyage, report, progress.remaining, currentSpeedKnots, deadlineIso],
  )

  const speedDiff = currentSpeedKnots - speedPlan.recommendedSpeedKnots
  const speedDiffLabel =
    Math.abs(speedDiff) < 0.05
      ? t.aiReport.speedMaintain
      : speedDiff > 0
        ? t.aiReport.speedReduceBy(speedDiff.toFixed(1))
        : t.aiReport.speedIncreaseBy(Math.abs(speedDiff).toFixed(1))

  const canGuaranteeDeadline = speedPlan.recommendedSpeedProbability.percent === 100
  const showSwitchHint = canGuaranteeDeadline && speedPlan.currentSpeedProbability.percent < 100

  return (
    <div
      id={`ai-report-${report.id}`}
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
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
              {speedPlan.fuelSavingPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">{t.aiReport.fuelSaving}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[#6366f1]">
              {formatNumber(currentSpeedKnots)} → {formatNumber(speedPlan.recommendedSpeedKnots)} kts
            </p>
            <p className="text-xs text-slate-400">{t.aiReport.speedComparison}</p>
          </div>
          <div className="text-right">
            <p className={cn('text-sm font-bold', CONFIDENCE_TEXT[speedPlan.currentSpeedProbability.confidence])}>
              {speedPlan.currentSpeedProbability.percent}%
            </p>
            <p className="text-xs text-slate-400">{t.aiReport.rtaProbability(deadlineTerm)}</p>
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

          <VoyageProgressLine
            departurePort={voyage.departurePort}
            arrivalPort={voyage.arrivalPort}
            totalDistanceNm={voyage.distanceNm}
            traveledNm={progress.traveled}
            remainingNm={progress.remaining}
            percent={progress.percent}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border-2 border-[#6366f1]/25 bg-white px-4 py-3 dark:bg-slate-800">
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <Navigation className="h-4 w-4" />
                {t.aiReport.speedComparison}
              </span>

              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-slate-500 dark:text-slate-400">
                    {formatNumber(currentSpeedKnots)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t.aiReport.liveSpeed}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-300" />
                <div className="text-center">
                  <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                    {formatNumber(speedPlan.recommendedSpeedKnots)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t.aiReport.recSpeed}</p>
                </div>
              </div>

              <p className="mt-3 text-center text-sm font-medium">{speedDiffLabel}</p>

              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-700">
                {canGuaranteeDeadline ? (
                  <>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      {t.aiReport.recommendedGuarantee(deadlineTerm)}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      {t.aiReport.recommendedInfeasible(
                        deadlineTerm,
                        String(speedPlan.recommendedSpeedProbability.percent),
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>

            <ProbabilityGauge
              label={t.aiReport.rtaProbability(deadlineTerm)}
              probability={speedPlan.currentSpeedProbability}
              tone={voyage.rtaConfirmed ? 'status' : 'blue'}
              descLabel={t.aiReport.rtaProbabilityDesc}
              confidenceLabel={
                speedPlan.currentSpeedProbability.confidence === 'high'
                  ? t.aiReport.confidenceHigh
                  : speedPlan.currentSpeedProbability.confidence === 'medium'
                    ? t.aiReport.confidenceMedium
                    : t.aiReport.confidenceLow
              }
              marginLabel={
                speedPlan.currentSpeedProbability.marginHours >= 0
                  ? t.aiReport.marginBuffer(deadlineTerm, formatNumber(speedPlan.currentSpeedProbability.marginHours))
                  : t.aiReport.marginDeficit(
                      deadlineTerm,
                      formatNumber(Math.abs(speedPlan.currentSpeedProbability.marginHours)),
                    )
              }
              hint={
                showSwitchHint
                  ? t.aiReport.switchToRecommendedHint(deadlineTerm, formatNumber(speedPlan.recommendedSpeedKnots))
                  : undefined
              }
              formula={t.aiReport.requiredSpeedFormula(
                formatNumber(progress.remaining, 0),
                formatNumber(speedPlan.hoursUntilDeadline),
                formatNumber(speedPlan.requiredSpeedKnots),
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={CalendarClock}
              label={t.aiReport.sta}
              value={formatDateTime(voyage.sta)}
              accent={voyage.rtaConfirmed ? 'default' : 'warning'}
            />
            <StatCard
              icon={RadioTower}
              label={t.aiReport.rta}
              value={voyage.rtaConfirmed ? formatDateTime(voyage.rta) : t.aiReport.rtaUnconfirmedValue}
              accent={voyage.rtaConfirmed ? 'default' : 'warning'}
            />
            <StatCard
              icon={Timer}
              label={t.aiReport.etaAtCurrentSpeed}
              value={formatDateTime(speedPlan.etaAtCurrent)}
              accent="default"
            />
            <StatCard
              icon={CalendarCheck}
              label={t.aiReport.etaAtRecommendedSpeed}
              value={formatDateTime(speedPlan.etaAtRecommended)}
              accent="success"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Leaf}
              label={t.aiReport.co2SavingCumulative}
              value={`${speedPlan.co2SavedTon.toFixed(1)} ton`}
              sublabel={t.aiReport.vsOriginalPlan}
              accent="brand"
            />
            <StatCard
              icon={Leaf}
              label={t.aiReport.co2SavingAdjustment}
              value={`${speedPlan.co2SavedTonFromCurrent.toFixed(1)} ton`}
              sublabel={t.aiReport.vsCurrentSpeed}
              accent="brand"
            />
            <StatCard
              icon={Fuel}
              label={t.aiReport.fuelSavingCumulative}
              value={`${speedPlan.fuelSavingPercent.toFixed(1)}%`}
              sublabel={t.aiReport.vsOriginalPlan}
              accent="success"
            />
            <StatCard
              icon={Fuel}
              label={t.aiReport.fuelSavingAdjustment}
              value={`${speedPlan.fuelSavingPercentFromCurrent.toFixed(1)}%`}
              sublabel={t.aiReport.vsCurrentSpeed}
              accent="success"
            />
          </div>

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
                  <div key={i} className={cn('rounded-lg border px-4 py-3', RISK_LEVEL_BORDER[risk.level])}>
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

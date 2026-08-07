'use client'

import { useMemo, useState, type MouseEvent } from 'react'
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
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  type LucideIcon,
} from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { RiskBadge } from '@/shared/components/StatusBadge'
import { formatDateTime, formatNumber } from '@/shared/utils/format'
import { cn } from '@/shared/utils/cn'
import {
  computeSpeedPlan,
  computeVoyageProgress,
  nearbyIssues,
  portShortName,
  remainingRoute,
} from '@/features/ai-report/lib/calc'
import { categoryLabel, confidenceLabel, congestionLevelLabel, trendLabel } from '@/features/ai-report/lib/labels'
import { exportReportPdf } from '@/features/ai-report/lib/pdf'
import { EN_REPORT_CONTENT, EN_REGIONAL_ISSUE_CONTENT, enRiskTitle, enRiskDescription } from '@/features/ai-report/lib/en-content'
import { StatCard } from '@/features/ai-report/components/StatCard'
import { ProbabilityGauge } from '@/features/ai-report/components/ProbabilityGauge'
import { VoyageProgressLine } from '@/features/ai-report/components/VoyageProgressLine'
import { ReportWeatherStats } from '@/features/ai-report/components/ReportWeatherStats'
import { getPortCongestion, congestionLevel, type CongestionTrend } from '@/mocks/port-congestion'
import { MOCK_REGIONAL_ISSUES } from '@/mocks/map-overlays'
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

const CONGESTION_ANCHOR_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-red-500',
  medium: 'text-yellow-500',
  low: 'text-green-500',
}

const TREND_ICON: Record<CongestionTrend, LucideIcon> = {
  rising: TrendingUp,
  stable: Minus,
  falling: TrendingDown,
}

function PortCongestionCard({ arrivalPort }: { arrivalPort: string }) {
  const { t } = useLanguage()
  const congestion = getPortCongestion(arrivalPort)
  const level = congestionLevel(congestion.congestionScore)
  const levelLabel = congestionLevelLabel(t, level)
  const trend = trendLabel(t, congestion.trend)
  const TrendIcon = TREND_ICON[congestion.trend]

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <Anchor className={cn('h-4 w-4', CONGESTION_ANCHOR_COLOR[level])} />
        {t.aiReport.portCongestionTitle}
      </span>

      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn('text-xl font-bold', CONGESTION_ANCHOR_COLOR[level])}>{levelLabel}</span>
        <span className="text-sm text-slate-400">{congestion.congestionScore}/100</span>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {t.aiReport.avgWaitHours} {formatNumber(congestion.avgWaitHours)}h
        </span>
        <span className="flex items-center gap-1">
          <TrendIcon className="h-3.5 w-3.5" />
          {trend}
        </span>
      </div>

      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {t.aiReport.berthAvailability} {t.aiReport.berthCount(String(congestion.berthsAvailable), String(congestion.berthsTotal))}
      </p>
    </div>
  )
}

interface ReportCardProps {
  report: EcoSpeedReport
  voyage: Voyage
  vessel: Vessel
  position?: AisPosition
  defaultOpen?: boolean
}

export function ReportCard({ report, voyage, vessel, position, defaultOpen = false }: ReportCardProps) {
  const { t, lang } = useLanguage()
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

  const arrivalPos = voyage.plannedRoute[voyage.plannedRoute.length - 1]
  const currentPos = position ? { lat: position.lat, lng: position.lng } : voyage.plannedRoute[0]

  const nearbyRegionalIssues = useMemo(
    () => nearbyIssues(remainingRoute(voyage.plannedRoute, position), MOCK_REGIONAL_ISSUES, 600),
    [voyage.plannedRoute, position],
  )

  // 화면 표시용 mock 원문은 언어와 무관하게 항상 한국어 그대로 노출한다(§4.3⑦, 스펙에
  // 명시된 동작). PDF 영문 모드만 §9.3 사전으로 대체한다 — jsPDF 기본 폰트가 한글을
  // 렌더링하지 못하기 때문.
  const pdfReasoning = lang === 'en' ? (EN_REPORT_CONTENT[report.id]?.reasoning ?? report.reasoning) : report.reasoning
  const pdfRisks = useMemo(
    () =>
      lang === 'en'
        ? report.risks.map((risk, i) => ({
            ...risk,
            title: enRiskTitle(report.id, i) || risk.title,
            description: enRiskDescription(report.id, i) || risk.description,
          }))
        : report.risks,
    [lang, report.id, report.risks],
  )
  const pdfRegionalIssues = useMemo(
    () =>
      lang === 'en'
        ? nearbyRegionalIssues.map((issue) => ({
            ...issue,
            title: EN_REGIONAL_ISSUE_CONTENT[issue.id]?.title ?? issue.title,
            description: EN_REGIONAL_ISSUE_CONTENT[issue.id]?.description ?? issue.description,
          }))
        : nearbyRegionalIssues,
    [lang, nearbyRegionalIssues],
  )

  const [pdfGenerating, setPdfGenerating] = useState(false)

  async function handleDownloadPdf(e: MouseEvent) {
    e.stopPropagation()
    if (pdfGenerating) return
    setPdfGenerating(true)
    try {
      await exportReportPdf({
        lang,
        t,
        report,
        voyage,
        vessel,
        progress,
        speedPlan,
        currentSpeedKnots,
        deadlineTerm,
        congestion: getPortCongestion(voyage.arrivalPort),
        reasoning: pdfReasoning,
        risks: pdfRisks,
        regionalIssues: pdfRegionalIssues,
      })
    } finally {
      setPdfGenerating(false)
    }
  }

  return (
    <div
      id={`ai-report-${report.id}`}
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left"
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
          <button
            type="button"
            title={t.aiReport.downloadPdf}
            disabled={pdfGenerating}
            onClick={handleDownloadPdf}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#6366f1] disabled:cursor-wait disabled:opacity-60 dark:text-slate-500 dark:hover:bg-slate-800"
          >
            {pdfGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          </button>
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
      </div>

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
              confidenceLabel={confidenceLabel(t, speedPlan.currentSpeedProbability.confidence)}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PortCongestionCard arrivalPort={voyage.arrivalPort} />
            <ReportWeatherStats
              currentLabel={t.aiReport.currentAreaWeather}
              currentPos={currentPos}
              arrivalLabel={t.aiReport.arrivalPortWeather}
              arrivalPos={arrivalPos}
              refreshToken={0}
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

          <div>
            <h3 className="mb-2 text-base font-semibold">{t.aiReport.regionalIssuesTitle}</h3>
            {nearbyRegionalIssues.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.aiReport.noNearbyIssues}</p>
            ) : (
              <div className="space-y-2">
                {nearbyRegionalIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{issue.title}</span>
                          <RiskBadge level={issue.severity} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{issue.description}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {t.aiReport.source}: {issue.source}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { FlaskConical, PlayCircle, Anchor, Download } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import {
  computeSimulation,
  computeRouteDistanceNm,
  computeCongestionWaitHours,
  computeBerthWaitHours,
  computeDraftFactor,
} from '@/features/simulation/calc'
import { CONGESTION_LEVELS } from '@/features/simulation/constants'
import type { SimInputs } from '@/features/simulation/types'
import { SavingsCard } from '@/features/simulation/components/SavingsCard'
import { ArrivalCard } from '@/features/simulation/components/ArrivalCard'
import { ComparisonChart } from '@/features/simulation/components/ComparisonChart'
import { SpeedCurveChart } from '@/features/simulation/components/SpeedCurveChart'
import { exportSimulationPdf } from '@/features/simulation/pdf'

function portShortName(label: string): string {
  return label.split(' ')[0]
}

function buildDefaultInputs(): SimInputs {
  const completed = MOCK_VOYAGES.filter((v) => v.status === 'completed')
  return {
    voyageId: MOCK_VOYAGES[0].id,
    departureOffset: 0,
    speedKnots: 14,
    cargoPercent: 80,
    route: 'suez',
    portCongestion: 'medium',
    berthProgress: 60,
    compareVoyageId: completed[0]?.id ?? '',
  }
}

const CONGESTION_LABEL_KEYS = {
  low: 'congestionLow',
  medium: 'congestionMedium',
  high: 'congestionHigh',
  severe: 'congestionSevere',
} as const

export default function SimulationPage() {
  const { t } = useLanguage()
  const [draft, setDraft] = useState<SimInputs>(buildDefaultInputs)
  // mock 전용이라 데이터가 항상 동기적으로 존재한다 — SWR로 전환 시에는 §5.1의
  // 초기화 effect(voyages.length 의존)로 바꾸고 이 초기값을 null로 둔다.
  const [applied, setApplied] = useState<SimInputs | null>(buildDefaultInputs)
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const targetCandidates = useMemo(() => MOCK_VOYAGES.filter((v) => v.status === 'preparing' || v.status === 'underway'), [])
  const compareCandidates = useMemo(() => MOCK_VOYAGES.filter((v) => v.status === 'completed'), [])

  function updateDraft<K extends keyof SimInputs>(key: K, value: SimInputs[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const isDirty = !applied || (Object.keys(draft) as (keyof SimInputs)[]).some((k) => draft[k] !== applied[k])

  const draftVoyage = MOCK_VOYAGES.find((v) => v.id === draft.voyageId)
  const draftCongestionWaitHours = computeCongestionWaitHours(draft.portCongestion)
  const draftBerthWaitHours = computeBerthWaitHours(draft.berthProgress)

  const appliedVoyage = applied ? MOCK_VOYAGES.find((v) => v.id === applied.voyageId) : undefined
  const appliedVessel = appliedVoyage ? MOCK_VESSELS.find((v) => v.id === appliedVoyage.vesselId) : undefined
  const compareVoyage = applied?.compareVoyageId ? (MOCK_VOYAGES.find((v) => v.id === applied.compareVoyageId) ?? null) : null

  const output = useMemo(
    () => (applied && appliedVoyage ? computeSimulation(appliedVoyage, applied, compareVoyage) : null),
    [applied, appliedVoyage, compareVoyage],
  )

  if (!applied || !appliedVoyage || !appliedVessel || !output) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t.simulation.title} />
        <div className="p-6 text-xs text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  const appliedRouteDistance = computeRouteDistanceNm(appliedVoyage, applied.route)
  const appliedDraftFactor = computeDraftFactor(applied.cargoPercent)
  const appliedBerthWaitHours = computeBerthWaitHours(applied.berthProgress)

  async function handleDownloadPdf() {
    if (!applied || !appliedVoyage || !appliedVessel || !output || pdfGenerating) return
    setPdfGenerating(true)
    try {
      await exportSimulationPdf({
        voyage: appliedVoyage,
        vessel: appliedVessel,
        applied,
        output,
        routeDistanceNm: appliedRouteDistance,
        berthWaitHours: appliedBerthWaitHours,
        compareVoyage,
      })
    } finally {
      setPdfGenerating(false)
    }
  }

  const departureLabel =
    draft.departureOffset === 0
      ? t.simulation.noChange
      : draft.departureOffset > 0
        ? t.simulation.delayed(String(draft.departureOffset))
        : t.simulation.advanced(String(draft.departureOffset))

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.simulation.title} subtitle={t.simulation.subtitle} />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 좌: 조건 폼 */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#6366f1]" />
              <p className="text-sm font-semibold">{t.simulation.conditions}</p>
            </div>

            {/* 대상 항차 */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.targetVoyage}</label>
              <select
                value={draft.voyageId}
                onChange={(e) => updateDraft('voyageId', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#6366f1] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                {targetCandidates.map((v) => {
                  const vessel = MOCK_VESSELS.find((ves) => ves.id === v.vesselId)
                  return (
                    <option key={v.id} value={v.id}>
                      {vessel?.name} · {portShortName(v.departurePort)} → {portShortName(v.arrivalPort)}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* 출발 시점 조정 */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.departureAdj}</label>
                <span className="text-xs text-slate-500 dark:text-slate-400">{departureLabel}</span>
              </div>
              <input
                type="range"
                min={-24}
                max={72}
                step={6}
                value={draft.departureOffset}
                onChange={(e) => updateDraft('departureOffset', Number(e.target.value))}
                className="mt-1 w-full accent-[#6366f1]"
              />
              <div className="mt-0.5 flex justify-between text-[11px] text-slate-400">
                <span>-24h</span>
                <span>0</span>
                <span>+72h</span>
              </div>
            </div>

            {/* 항해 속도 */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.speed}</label>
                <span className="text-xs font-semibold text-[#6366f1]">{draft.speedKnots} kts</span>
              </div>
              <input
                type="range"
                min={10}
                max={20}
                step={0.5}
                value={draft.speedKnots}
                onChange={(e) => updateDraft('speedKnots', Number(e.target.value))}
                className="mt-1 w-full accent-[#6366f1]"
              />
              <div className="mt-0.5 flex justify-between text-[11px] text-slate-400">
                <span>10 kts ({t.simulation.slowSteam})</span>
                <span>20 kts ({t.simulation.max})</span>
              </div>
            </div>

            {/* 화물 적재율 */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.cargo}</label>
                <span className="text-xs font-semibold text-[#6366f1]">{draft.cargoPercent}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={draft.cargoPercent}
                onChange={(e) => updateDraft('cargoPercent', Number(e.target.value))}
                className="mt-1 w-full accent-[#6366f1]"
              />
            </div>

            {/* 항로 선택 */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.route}</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['suez', 'cape'] as const).map((route) => {
                  const distance = draftVoyage ? computeRouteDistanceNm(draftVoyage, route) : 0
                  const selected = draft.route === route
                  return (
                    <button
                      key={route}
                      type="button"
                      onClick={() => updateDraft('route', route)}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-left text-xs',
                        selected ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1]' : 'border-slate-200 dark:border-slate-700',
                      )}
                    >
                      <p className="font-semibold">{route === 'suez' ? t.simulation.routeSuez : t.simulation.routeCape}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {route === 'suez'
                          ? t.simulation.suezSub(Math.round(distance).toLocaleString())
                          : t.simulation.capeSub(Math.round(distance).toLocaleString())}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 예상 접안 대기 */}
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Anchor className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.simulation.portWaitTitle}</p>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {CONGESTION_LEVELS.map((level) => {
                  const selected = draft.portCongestion === level
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => updateDraft('portCongestion', level)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-center text-[11px]',
                        selected ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1]' : 'border-slate-200 dark:border-slate-700',
                      )}
                    >
                      {t.simulation[CONGESTION_LABEL_KEYS[level]]}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.simulation.congestionWaitSub(String(draftCongestionWaitHours))}</p>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.berthProgress}</label>
                  <span className="text-xs font-semibold text-[#6366f1]">{draft.berthProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={draft.berthProgress}
                  onChange={(e) => updateDraft('berthProgress', Number(e.target.value))}
                  className="mt-1 w-full accent-[#6366f1]"
                />
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.simulation.berthWaitSub(draftBerthWaitHours.toFixed(1))}</p>
              </div>
            </div>

            {/* 비교할 기존 운항기록 */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.simulation.compareVoyage}</label>
              {compareCandidates.length > 0 ? (
                <select
                  value={draft.compareVoyageId}
                  onChange={(e) => updateDraft('compareVoyageId', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#6366f1] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                >
                  {compareCandidates.map((v) => {
                    const vessel = MOCK_VESSELS.find((ves) => ves.id === v.vesselId)
                    return (
                      <option key={v.id} value={v.id}>
                        {vessel?.name} · {portShortName(v.departurePort)} → {portShortName(v.arrivalPort)}
                      </option>
                    )
                  })}
                </select>
              ) : (
                <p className="mt-1 text-xs text-slate-400">{t.simulation.compareVoyageNone}</p>
              )}
            </div>

            {/* 변경 힌트 + 실행 버튼 */}
            {isDirty && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                {t.simulation.dirtyHint}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApplied({ ...draft })}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isDirty ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5]' : 'cursor-default bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                <PlayCircle className="h-4 w-4" />
                {t.simulation.runSim}
              </button>
              <button
                type="button"
                title={t.simulation.downloadPdfHint}
                disabled={pdfGenerating}
                onClick={handleDownloadPdf}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                {t.simulation.downloadPdf}
              </button>
            </div>
          </div>

          {/* 우: 결과 */}
          <div className="space-y-4">
            <SavingsCard savings={output.savings} />
            <ArrivalCard
              plannedEtaIso={appliedVoyage.eta}
              plannedDays={output.planned.days}
              simulatedEtaIso={output.simulated.eta}
              simDays={output.simulated.days}
              portWaitHours={output.portWaitHours}
              portWaitCost={output.portWaitCost}
            />
            <ComparisonChart planned={output.planned} simulated={output.simulated} historical={output.historical} />
            <SpeedCurveChart
              routeDistanceNm={appliedRouteDistance}
              draftFactor={appliedDraftFactor}
              plannedSpeedKnots={appliedVoyage.plannedSpeedKnots}
              simSpeedKnots={applied.speedKnots}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

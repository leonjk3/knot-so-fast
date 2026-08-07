'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Ship, AlertTriangle, CheckCircle, TrendingDown, Leaf, Award, Trophy, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Vessel, Voyage } from '@/shared/types'
import { VOYAGE_STATUS_COLORS } from '@/shared/constants'
import { formatNumber } from '@/shared/utils/format'
import { cn } from '@/shared/utils/cn'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_POSITIONS } from '@/mocks/positions'
import { MOCK_CII_SCORE_BY_VOYAGE, MOCK_FLEET_ECO_RANKING, CARBON_BENCHMARK_MULTIPLIER } from '@/mocks/carbon'
import { computeFleetGauges, getActiveVoyages } from './fleetGauge'
import { ciiGradeFromScore } from './cii'
import { startOfWeek, addDays, isSameDay, formatWeekPeriodLabel } from './date'

// ── 5.1 운항 지표 4종 ────────────────────────────────────────
function StatRow({ icon: Icon, label, value, colorClassName }: { icon: LucideIcon; label: string; value: string; colorClassName: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', colorClassName)} />
      <span className="min-w-0 flex-1 truncate text-right text-[10px] text-slate-500 dark:text-slate-400">{label} :</span>
      <span className="shrink-0 text-xs font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  )
}

function OperationStatsCard({
  activeCount,
  delayedCount,
  completedTodayCount,
  avgFuelSavingPercent,
}: {
  activeCount: number
  delayedCount: number
  completedTodayCount: number
  avgFuelSavingPercent: number
}) {
  return (
    <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="grid h-full grid-flow-col grid-cols-2 grid-rows-2 gap-x-3 gap-y-1">
        <StatRow icon={Ship} label="운항 중 선박" value={`${activeCount}척`} colorClassName="text-[#6366f1]" />
        <StatRow icon={AlertTriangle} label="지연 항차" value={`${delayedCount}건`} colorClassName="text-red-500" />
        <StatRow icon={CheckCircle} label="오늘 완료" value={`${completedTodayCount}건`} colorClassName="text-green-500" />
        <StatRow icon={TrendingDown} label="평균 연료 절감" value={`${Math.round(avgFuelSavingPercent)}%`} colorClassName="text-purple-500" />
      </div>
    </div>
  )
}

// ── 5.2 목표/현재 탄소배출량 ──────────────────────────────────
function CarbonHalf({
  label,
  value,
  iconColorClassName,
  valueColorClassName,
  borderLeft,
}: {
  label: string
  value: string
  iconColorClassName: string
  valueColorClassName: string
  borderLeft?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-0.5 p-1', borderLeft && 'border-l border-slate-200 pl-2 dark:border-slate-700')}>
      <Leaf className={cn('h-3.5 w-3.5', iconColorClassName)} />
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn('text-base font-bold', valueColorClassName)}>{value}</span>
    </div>
  )
}

function CarbonCard({ currentCo2, targetCo2 }: { currentCo2: number; targetCo2: number }) {
  return (
    <div className="col-span-2 grid grid-cols-2 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <CarbonHalf
        label="목표 탄소배출량"
        value={`${formatNumber(targetCo2, 1)}t/일`}
        iconColorClassName="text-slate-400"
        valueColorClassName="text-slate-900 dark:text-white"
      />
      <CarbonHalf
        label="현재 탄소배출량"
        value={`${formatNumber(currentCo2, 1)}t/일`}
        iconColorClassName="text-green-500"
        valueColorClassName="text-green-600"
        borderLeft
      />
    </div>
  )
}

// ── 5.3 CII 등급 ────────────────────────────────────────────
function CiiGradeCard({ score, grade, color }: { score: number; grade: string; color: string }) {
  return (
    <div className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
        <Award className="h-3.5 w-3.5" />
        <span>CII 등급</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[30px] font-extrabold" style={{ color }}>
          {grade}
        </span>
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{score.toFixed(2)}</span>
      </div>
    </div>
  )
}

// ── 5.4 이번 항차 에코 랭킹 ───────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉']

function EcoRankingCard({ top3, vessels }: { top3: { vesselId: string; co2SavedPct: number }[]; vessels: Vessel[] }) {
  return (
    <div className="col-span-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
        <Trophy className="h-3.5 w-3.5" />
        <span>이번 항차 에코 랭킹</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {top3.map((entry, i) => {
          const vessel = vessels.find((v) => v.id === entry.vesselId)
          return (
            <button
              key={entry.vesselId}
              type="button"
              title="탄소 배출 대시보드에서 조회"
              // 딥링크(10.3장)는 L4에서 연결 — 지금은 표시만
              className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span>{MEDALS[i]}</span>
              <span className="min-w-0 flex-1 truncate text-left text-slate-700 dark:text-slate-200">{vessel?.name ?? entry.vesselId}</span>
              <span className="shrink-0 font-semibold text-green-600">-{entry.co2SavedPct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 5.5 이번 주 일정 ─────────────────────────────────────────
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface DayEvent {
  type: '출항' | '입항'
  vesselName: string
  color: string
}

function buildDayEvents(day: Date, voyages: Voyage[], vessels: Vessel[]): DayEvent[] {
  const events: DayEvent[] = []
  for (const voyage of voyages) {
    const vesselName = vessels.find((v) => v.id === voyage.vesselId)?.name ?? voyage.vesselId
    const color = VOYAGE_STATUS_COLORS[voyage.status]
    if (isSameDay(new Date(voyage.etd), day)) events.push({ type: '출항', vesselName, color })
    if (isSameDay(new Date(voyage.rta), day)) events.push({ type: '입항', vesselName, color })
  }
  return events.slice(0, 4)
}

function WeeklyScheduleCard({ voyages, vessels }: { voyages: Voyage[]; vessels: Vessel[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const today = useMemo(() => new Date(), [])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  return (
    <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <CalendarRange className="h-3.5 w-3.5" />
          <span>이번 주 일정</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[9px] text-slate-500 dark:text-slate-400">{formatWeekPeriodLabel(days[0], days[6])}</span>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          const events = buildDayEvents(day, voyages, vessels)
          const isToday = isSameDay(day, today)
          return (
            <button
              key={day.toISOString()}
              type="button"
              title={events.length ? events.map((e) => `${e.type} · ${e.vesselName}`).join('\n') : undefined}
              // 딥링크(10.2장)는 L4에서 연결 — 지금은 표시만
              className="flex flex-col items-center gap-0.5 rounded p-0.5 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <span className="text-[9px] text-slate-400">{WEEKDAY_LABELS[i]}</span>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[12px]',
                  isToday ? 'bg-[#6366f1] font-bold text-white' : 'text-slate-700 dark:text-slate-200',
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex h-1 items-center justify-center gap-0.5">
                {events.map((e, idx) => (
                  <span key={idx} className="h-1 w-1 rounded-full" style={{ backgroundColor: e.color }} />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 컨테이너 ─────────────────────────────────────────────────
export function SummaryCards() {
  const gauges = useMemo(() => computeFleetGauges(MOCK_VOYAGES, MOCK_VESSELS, MOCK_POSITIONS), [])
  const activeVoyages = useMemo(() => getActiveVoyages(MOCK_VOYAGES), [])

  const activeCount = activeVoyages.length
  const delayedCount = MOCK_VOYAGES.filter((v) => v.status === 'delayed').length
  const completedTodayCount = useMemo(() => {
    const today = new Date()
    return MOCK_VOYAGES.filter((v) => v.status === 'completed' && isSameDay(new Date(v.eta), today)).length
  }, [])
  const avgFuelSavingPercent = gauges.length > 0 ? gauges.reduce((s, g) => s + g.fuelSavingPercent, 0) / gauges.length : 0

  const currentCo2 = gauges.reduce((s, g) => s + g.co2TonPerDay, 0)
  const targetCo2 = currentCo2 * CARBON_BENCHMARK_MULTIPLIER

  const avgCiiScore =
    activeVoyages.length > 0
      ? activeVoyages.reduce((s, v) => s + (MOCK_CII_SCORE_BY_VOYAGE[v.id] ?? 4.5), 0) / activeVoyages.length
      : 4.5
  const { grade, color } = ciiGradeFromScore(avgCiiScore)

  const top3 = useMemo(() => [...MOCK_FLEET_ECO_RANKING].sort((a, b) => b.co2SavedPct - a.co2SavedPct).slice(0, 3), [])

  return (
    <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-slate-200 bg-white px-6 py-2 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-8">
      <OperationStatsCard
        activeCount={activeCount}
        delayedCount={delayedCount}
        completedTodayCount={completedTodayCount}
        avgFuelSavingPercent={avgFuelSavingPercent}
      />
      <CarbonCard currentCo2={currentCo2} targetCo2={targetCo2} />
      <CiiGradeCard score={avgCiiScore} grade={grade} color={color} />
      <EcoRankingCard top3={top3} vessels={MOCK_VESSELS} />
      <WeeklyScheduleCard voyages={MOCK_VOYAGES} vessels={MOCK_VESSELS} />
    </div>
  )
}

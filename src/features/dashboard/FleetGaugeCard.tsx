'use client'

import type { Dispatch, KeyboardEvent, SetStateAction } from 'react'
import { Fuel, ChevronDown, Leaf, TrendingDown, LocateFixed, Gauge, BrainCircuit } from 'lucide-react'
import { VoyageBadge } from '@/shared/components/StatusBadge'
import { HorizontalGauge } from '@/shared/components/HorizontalGauge'
import { cn } from '@/shared/utils/cn'
import { formatNumber, formatShortDateTime } from '@/shared/utils/format'
import { getPortCode } from '@/mocks/ports'
import type { FleetGaugeRow } from './fleetGauge'

// ── 헤더 행 (6.2) ────────────────────────────────────────────
function FleetGaugeHeader({
  open,
  onToggleOpen,
  selectedCount,
  total,
  onSelectAll,
  onDeselectAll,
}: {
  open: boolean
  onToggleOpen: () => void
  selectedCount: number
  total: number
  onSelectAll: () => void
  onDeselectAll: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
      >
        <Fuel className="h-3.5 w-3.5" />
        <span>운항 중 선박 연료·탄소 현황</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
      </button>

      {open && (
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button type="button" onClick={onSelectAll} className="font-medium text-[#6366f1] hover:underline">
            전체 선택
          </button>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <button type="button" onClick={onDeselectAll} className="font-medium text-slate-500 hover:underline dark:text-slate-400">
            전체 해제
          </button>
          <span className="text-slate-400">
            {selectedCount}/{total}개 지도 표시 중
          </span>
        </div>
      )}
    </div>
  )
}

// ── 선박 카드 (6.3) ──────────────────────────────────────────
function VesselGaugeCard({ row, selected, onToggle }: { row: FleetGaugeRow; selected: boolean; onToggle: () => void }) {
  const { vessel, voyage, position, fuelTonPerDay, fuelCapacityPercent, co2TonPerDay, co2FleetPercent, fuelSavingPercent } = row
  const depCode = getPortCode(voyage.departurePort) ?? voyage.departurePort.split(' ')[0]
  const arrCode = getPortCode(voyage.arrivalPort) ?? voyage.arrivalPort.split(' ')[0]

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-80 shrink-0 cursor-pointer rounded-lg border px-3 py-1',
        selected
          ? 'border-[#6366f1] bg-[#6366f1]/5'
          : 'border-slate-200 opacity-50 hover:opacity-80 dark:border-slate-700',
      )}
    >
      {/* 상단 행 */}
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{vessel.name}</span>
        <VoyageBadge status={voyage.status} className="px-1.5 py-0 text-[9px]" />
        <button
          type="button"
          title="현재 위치로 이동"
          // 지도 focus(9.9장)는 L3에서 연결 — 지금은 표시만
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <LocateFixed className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="제안속도 전송"
          // 전송 동작(6.4장)은 L4에서 연결 — 지금은 표시만
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#6366f1] hover:bg-[#6366f1]/10"
        >
          <Gauge className="h-3 w-3" />
          Knot
        </button>
        <button
          type="button"
          title="AI 운항 리포트에서 조회"
          // AI 리포트 딥링크(10.1장)는 L4에서 연결 — 지금은 표시만
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          <BrainCircuit className="h-3 w-3" />
          AI
        </button>
      </div>

      {/* 항로 */}
      <div className="mt-0.5 text-[9px] text-slate-400">
        {depCode} → {arrCode}
      </div>

      {/* 하단 행 */}
      <div className="mt-1.5 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <HorizontalGauge icon={Fuel} label="연료 소모" value={`${formatNumber(fuelTonPerDay, 1)}t/일`} percent={fuelCapacityPercent} colorClassName="bg-[#6366f1]" />
          <HorizontalGauge icon={Leaf} label="탄소 배출" value={`${formatNumber(co2TonPerDay, 1)}t/일`} percent={co2FleetPercent} colorClassName="bg-orange-500" />
          <HorizontalGauge icon={TrendingDown} label="연료 절감" value={`${Math.round(fuelSavingPercent)}%`} percent={fuelSavingPercent} colorClassName="bg-green-500" />
        </div>
        <div className="flex w-28 shrink-0 flex-col justify-center gap-1 border-l border-slate-200 pl-2 text-[11px] dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">현재 속도</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{formatNumber(position.speedKnots, 1)}kt</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">ETA</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{formatShortDateTime(voyage.eta)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">권장 속도</span>
            <span className="font-medium text-green-600">{formatNumber(voyage.recommendedSpeedKnots, 1)}kt</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 컨테이너 ─────────────────────────────────────────────────
export function FleetGaugeCard({
  rows,
  selectedVoyageIds,
  setSelectedVoyageIds,
  open,
  onToggleOpen,
}: {
  rows: FleetGaugeRow[]
  selectedVoyageIds: Set<string>
  setSelectedVoyageIds: Dispatch<SetStateAction<Set<string>>>
  open: boolean
  onToggleOpen: () => void
}) {
  const selectedCount = rows.filter((r) => selectedVoyageIds.has(r.voyage.id)).length

  function toggleVoyage(voyageId: string) {
    setSelectedVoyageIds((prev) => {
      const next = new Set(prev)
      if (next.has(voyageId)) next.delete(voyageId)
      else next.add(voyageId)
      return next
    })
  }

  function selectAll() {
    setSelectedVoyageIds(new Set(rows.map((r) => r.voyage.id)))
  }

  function deselectAll() {
    setSelectedVoyageIds(new Set())
  }

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-2 dark:border-slate-800 dark:bg-slate-900">
      <FleetGaugeHeader
        open={open}
        onToggleOpen={onToggleOpen}
        selectedCount={selectedCount}
        total={rows.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
      />

      {open && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {rows.map((row) => (
            <VesselGaugeCard
              key={row.voyage.id}
              row={row}
              selected={selectedVoyageIds.has(row.voyage.id)}
              onToggle={() => toggleVoyage(row.voyage.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

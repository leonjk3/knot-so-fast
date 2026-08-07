'use client'

import { useState, type ReactNode } from 'react'
import { AlertTriangle, Anchor, Sparkles, X } from 'lucide-react'
import { RiskBadge } from '@/shared/components/StatusBadge'
import { MOCK_REGIONAL_ISSUES, MOCK_DANGER_ZONES, type RegionalIssue } from '@/mocks/map-overlays'
import { findPort } from '@/mocks/ports'
import { ALL_VOYAGES, ALL_VESSELS } from './fleetData'
import { aggregateByPort } from './portLayer'
import { issueTypeColor, issueTypeLabel } from './overlayLayer'
import type { QuickFilterKey } from './filters'
import type { MapFocusTarget } from './mapFocus'

type FocusFn = (target: Omit<MapFocusTarget, 'token'>) => void

function TypeDot({ color }: { color: string }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

function SummaryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
    >
      <Sparkles className="h-3 w-3" />
      요약
    </button>
  )
}

// ── 8.1 지역 이슈 리스트 ─────────────────────────────────────
function IssueListSection({ onFocusMap, onOpenSummary }: { onFocusMap: FocusFn; onOpenSummary: () => void }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          지역 이슈 ({MOCK_REGIONAL_ISSUES.length + MOCK_DANGER_ZONES.length}건)
        </div>
        <SummaryButton onClick={onOpenSummary} />
      </div>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {MOCK_REGIONAL_ISSUES.map((issue) => (
          <button
            key={issue.id}
            type="button"
            title={issue.description}
            onClick={() => onFocusMap({ lat: issue.lat, lng: issue.lng, zoom: 6, marker: { kind: 'issue', id: issue.id } })}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <TypeDot color={issueTypeColor(issue.type)} />
            <span className="text-slate-900 dark:text-white">{issue.title}</span>
            <span className="text-[10px] text-slate-400">{issueTypeLabel(issue.type)}</span>
            <RiskBadge level={issue.severity} />
          </button>
        ))}
        {MOCK_DANGER_ZONES.map((zone) => (
          <button
            key={zone.id}
            type="button"
            title={`${zone.label} (클릭 시 지도에서 위치로 이동, 반경 ${zone.radiusKm}km)`}
            onClick={() => onFocusMap({ lat: zone.center[0], lng: zone.center[1], zoom: 6 })}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <TypeDot color={zone.color} />
            <span className="text-slate-900 dark:text-white">{zone.label}</span>
            <span className="text-[10px] text-slate-400">위험구역</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 8.2 항구 현황 리스트 ─────────────────────────────────────
function PortListSection({ onFocusMap, onOpenSummary }: { onFocusMap: FocusFn; onOpenSummary: () => void }) {
  const aggregates = aggregateByPort(ALL_VOYAGES, ALL_VESSELS)
  const entries = [...aggregates.entries()]

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Anchor className="h-3.5 w-3.5" />
          항구 현황 ({entries.length}곳)
        </div>
        <SummaryButton onClick={onOpenSummary} />
      </div>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {entries.map(([code, agg]) => {
          const port = findPort(code)
          if (!port) return null
          return (
            <button
              key={code}
              type="button"
              onClick={() => onFocusMap({ lat: port.lat, lng: port.lng, zoom: 9, marker: { kind: 'port', id: code } })}
              className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="text-xs text-slate-900 dark:text-white">
                {port.name} ({code})
              </div>
              <div className="text-[10px] text-slate-400">
                정박 {agg.berthed.length} · 출항 {agg.departing.length} · 입항예정 {agg.arriving.length}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 8.3 요약 팝업 ────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-[#6366f1]" />
            {title}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function IssueSummaryModal({ onClose }: { onClose: () => void }) {
  const total = MOCK_REGIONAL_ISSUES.length
  const severityCounts: Record<RegionalIssue['severity'], number> = { high: 0, medium: 0, low: 0 }
  const typeCounts = new Map<RegionalIssue['type'], number>()
  for (const issue of MOCK_REGIONAL_ISSUES) {
    severityCounts[issue.severity] += 1
    typeCounts.set(issue.type, (typeCounts.get(issue.type) ?? 0) + 1)
  }
  const highIssues = MOCK_REGIONAL_ISSUES.filter((i) => i.severity === 'high')

  return (
    <ModalShell title="지역 이슈 요약" onClose={onClose}>
      <div className="text-xs text-slate-700 dark:text-slate-200">
        <p>
          현재 지도에 총 <b>{total}건</b>의 지역 이슈가 표시되고 있습니다.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <RiskBadge level="high" />
            {severityCounts.high}건
          </span>
          <span className="flex items-center gap-1">
            <RiskBadge level="medium" />
            {severityCounts.medium}건
          </span>
          <span className="flex items-center gap-1">
            <RiskBadge level="low" />
            {severityCounts.low}건
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {[...typeCounts.entries()].map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <TypeDot color={issueTypeColor(type)} />
                {issueTypeLabel(type)}
              </span>
              <span>{count}건</span>
            </div>
          ))}
        </div>
        {highIssues.length > 0 && (
          <div className="mt-3">
            <p className="font-semibold text-red-600">⚠ 심각도 높음 — 우선 확인 필요</p>
            <ul className="mt-1 list-disc pl-4">
              {highIssues.map((i) => (
                <li key={i.id}>{i.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function PortSummaryModal({ onClose }: { onClose: () => void }) {
  const aggregates = aggregateByPort(ALL_VOYAGES, ALL_VESSELS)
  let berthedTotal = 0
  let departingTotal = 0
  let arrivingTotal = 0
  let busiestCode: string | null = null
  let busiestTotal = -1

  for (const [code, agg] of aggregates) {
    berthedTotal += agg.berthed.length
    departingTotal += agg.departing.length
    arrivingTotal += agg.arriving.length
    const total = agg.berthed.length + agg.departing.length + agg.arriving.length
    if (total > busiestTotal) {
      busiestTotal = total
      busiestCode = code
    }
  }
  const busiestPort = busiestCode ? findPort(busiestCode) : undefined

  return (
    <ModalShell title="항구 현황 요약" onClose={onClose}>
      <div className="text-xs text-slate-700 dark:text-slate-200">
        <p>
          현재 <b>{aggregates.size}개</b> 항구에 선박이 집계되고 있습니다.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-100 p-2 text-center dark:bg-slate-700">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{berthedTotal}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">정박</div>
          </div>
          <div className="rounded-lg bg-slate-100 p-2 text-center dark:bg-slate-700">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{departingTotal}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">출항</div>
          </div>
          <div className="rounded-lg bg-slate-100 p-2 text-center dark:bg-slate-700">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{arrivingTotal}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">입항예정</div>
          </div>
        </div>
        {busiestPort && (
          <p className="mt-3">
            가장 붐비는 항구: <b>
              {busiestPort.name} ({busiestCode})
            </b>{' '}
            — 총 {busiestTotal}척
          </p>
        )}
      </div>
    </ModalShell>
  )
}

// ── 컨테이너 ─────────────────────────────────────────────────
export function ListPanel({ activeFilters, onFocusMap }: { activeFilters: Set<QuickFilterKey>; onFocusMap: FocusFn }) {
  const [summary, setSummary] = useState<'issues' | 'ports' | null>(null)
  const showIssues = activeFilters.has('issues')
  const showPorts = activeFilters.has('ports')

  if (!showIssues && !showPorts) return null

  return (
    <div className="flex shrink-0 gap-4 border-b border-slate-200 bg-white px-6 py-2 dark:border-slate-800 dark:bg-slate-900">
      {showIssues && <IssueListSection onFocusMap={onFocusMap} onOpenSummary={() => setSummary('issues')} />}
      {showPorts && <PortListSection onFocusMap={onFocusMap} onOpenSummary={() => setSummary('ports')} />}
      {summary === 'issues' && <IssueSummaryModal onClose={() => setSummary(null)} />}
      {summary === 'ports' && <PortSummaryModal onClose={() => setSummary(null)} />}
    </div>
  )
}

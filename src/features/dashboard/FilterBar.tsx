'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MapPin, Sailboat, CloudRain, Ship, AlertTriangle, Anchor, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { QUICK_FILTER_DEFS, layersForFilters, computeShowVessels, type QuickFilterKey, type Destination } from './filters'

const ICON_BY_KEY: Record<QuickFilterKey, LucideIcon> = {
  my: Sailboat,
  weather: CloudRain,
  vessels: Ship,
  issues: AlertTriangle,
  ports: Anchor,
}

// ── 7.1 빠른 필터 5종 ────────────────────────────────────────
function QuickFilterPill({ filterKey, active, onClick }: { filterKey: QuickFilterKey; active: boolean; onClick: () => void }) {
  const def = QUICK_FILTER_DEFS.find((d) => d.key === filterKey)!
  const Icon = ICON_BY_KEY[filterKey]
  const isMy = filterKey === 'my'

  return (
    <button
      type="button"
      title={def.title}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        isMy
          ? active
            ? 'border-rose-500 bg-rose-500 text-white'
            : 'border-rose-300 bg-rose-50 text-rose-600'
          : active
            ? 'border-[#6366f1] bg-[#6366f1] text-white'
            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      )}
    >
      <Icon className="h-3 w-3" />
      {def.label}
    </button>
  )
}

// ── 7.4 도착지 필터 ──────────────────────────────────────────
function DestinationFilter({
  destinations,
  totalCount,
  selected,
  onSelect,
}: {
  destinations: Destination[]
  totalCount: number
  selected: string | null
  onSelect: (code: string | null) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState, destinations])

  function pillClass(isSelected: boolean) {
    return cn(
      'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
      isSelected ? 'bg-[#6366f1] text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    )
  }

  return (
    <div className="relative min-w-0 flex-1">
      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent dark:from-slate-900" />
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
            className="absolute top-1/2 left-0 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow dark:bg-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className={cn(
          'flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          canScrollLeft && 'pl-7',
          canScrollRight && 'pr-7',
        )}
      >
        <button type="button" onClick={() => onSelect(null)} className={pillClass(selected === null)}>
          전체 ({totalCount})
        </button>
        {destinations.map((d) => (
          <button key={d.code} type="button" onClick={() => onSelect(selected === d.code ? null : d.code)} className={pillClass(selected === d.code)}>
            {d.code} · {d.name} ({d.count})
          </button>
        ))}
      </div>

      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent dark:from-slate-900" />
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
            className="absolute top-1/2 right-0 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow dark:bg-slate-800"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

// ── 컨테이너 ─────────────────────────────────────────────────
export function FilterBar({
  activeFilters,
  onToggleFilter,
  destinations,
  totalVesselCount,
  visibleVesselCount,
  destinationFilter,
  onSelectDestination,
}: {
  activeFilters: Set<QuickFilterKey>
  onToggleFilter: (key: QuickFilterKey) => void
  destinations: Destination[]
  totalVesselCount: number
  visibleVesselCount: number
  destinationFilter: string | null
  onSelectDestination: (code: string | null) => void
}) {
  const showVessels = computeShowVessels(activeFilters)
  const layers = layersForFilters(activeFilters)

  const disabledReason = !showVessels
    ? `${QUICK_FILTER_DEFS.filter((d) => activeFilters.has(d.key))
        .map((d) => d.label)
        .join(' · ')} 보기 중에는 도착지 필터를 사용할 수 없습니다`
    : null

  const summaryParts: string[] = []
  if (showVessels) summaryParts.push(`${visibleVesselCount}척`)
  if (layers.weather) summaryParts.push('기상')
  if (layers.issues) summaryParts.push('이슈')
  if (layers.ports) summaryParts.push('항구')

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">도착지 필터</span>

      {QUICK_FILTER_DEFS.map((def) => (
        <QuickFilterPill key={def.key} filterKey={def.key} active={activeFilters.has(def.key)} onClick={() => onToggleFilter(def.key)} />
      ))}

      <span className="h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />

      {disabledReason ? (
        <div className="min-w-0 flex-1 truncate text-xs text-slate-400 italic">{disabledReason}</div>
      ) : (
        <DestinationFilter destinations={destinations} totalCount={totalVesselCount} selected={destinationFilter} onSelect={onSelectDestination} />
      )}

      {summaryParts.length > 0 && (
        <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">{summaryParts.join(' · ')} 표시 중</span>
      )}
    </div>
  )
}

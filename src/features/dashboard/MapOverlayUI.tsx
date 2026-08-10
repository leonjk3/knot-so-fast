'use client'

import { ChevronDown, Satellite } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { MAP_LANGUAGE_OPTIONS, type MapLanguage } from './mapLabels'

const PILL_BASE = 'rounded-full px-3 py-1 text-xs font-medium transition-colors'
const PILL_ACTIVE = 'bg-[#6366f1] text-white'
const PILL_INACTIVE = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
// 지도 위 오버레이는 카드와 달리 반투명(bg-white/95 backdrop-blur)을 쓴다 (13장).
const OVERLAY_SURFACE =
  'border border-slate-200 bg-white/95 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-800/95'

interface MapLanguageSelectorProps {
  value: MapLanguage
  onChange: (lang: MapLanguage) => void
}

// ① 언어 선택기(상단 중앙) — 지도 타일은 바뀌지 않는다. 팝업·툴팁 등 지도가 직접 그리는
// 정보의 언어만 바꾼다. 앱 전역 언어(사이드바·헤더)와는 별개다.
export function MapLanguageSelector({ value, onChange }: MapLanguageSelectorProps) {
  return (
    <div className={cn('absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1 rounded-full p-1', OVERLAY_SURFACE)}>
      {MAP_LANGUAGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(PILL_BASE, value === opt.value ? PILL_ACTIVE : PILL_INACTIVE)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export type MapKind = 'standard' | 'satellite'

interface MapTypeToggleProps {
  value: MapKind
  onChange: (kind: MapKind) => void
}

// ② 지도 유형(우상단) — 레이어를 추가·제거하지 않고 기본 타일의 setUrl()만 교체한다.
export function MapTypeToggle({ value, onChange }: MapTypeToggleProps) {
  return (
    <div className={cn('absolute right-3 top-3 z-10 flex gap-1 rounded-full p-1', OVERLAY_SURFACE)}>
      <button type="button" onClick={() => onChange('standard')} className={cn(PILL_BASE, value === 'standard' ? PILL_ACTIVE : PILL_INACTIVE)}>
        기본 지도
      </button>
      <button
        type="button"
        onClick={() => onChange('satellite')}
        className={cn(PILL_BASE, 'flex items-center gap-1', value === 'satellite' ? PILL_ACTIVE : PILL_INACTIVE)}
      >
        <Satellite className="h-3.5 w-3.5" />
        위성
      </button>
    </div>
  )
}

const LEGEND_STATUS = [
  { label: '운항 중', color: '#3b82f6' },
  { label: '지연', color: '#ef4444' },
  { label: '준비 중', color: '#94a3b8' },
  { label: '완료', color: '#22c55e' },
]

const LEGEND_OVERLAYS = [
  { label: '해적/위협구역', color: '#ef4444' },
  { label: '충돌위험구역', color: '#f59e0b' },
  { label: '분쟁수역', color: '#8b5cf6' },
]

interface MapLegendProps {
  open: boolean
  onToggle: () => void
}

// ③ 범례(좌하단) — 컨테이너 전체가 클릭 가능한 접기/펼치기. 기본값은 접힘.
export function MapLegend({ open, onToggle }: MapLegendProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn('absolute bottom-4 left-4 z-10 w-52 rounded-xl p-3 text-left text-[12px]', OVERLAY_SURFACE, 'shadow-lg')}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800 dark:text-white">선박 상태</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', !open && '-rotate-90')} />
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            {LEGEND_STATUS.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                <path d="M12 1.5 L17 9 L15 21.5 L9 21.5 L7 9 Z" fill="#3b82f6" />
              </svg>
              <span className="text-slate-600 dark:text-slate-300">자사 선박</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                <path d="M12 1.5 L17 9 L15 21.5 L9 21.5 L7 9 Z" fill="#3b82f6" fillOpacity="0.4" />
              </svg>
              <span className="text-slate-600 dark:text-slate-300">타사 선박 (참고용)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[14px] shrink-0 text-center text-[11px] leading-none">⚓</span>
              <span className="text-slate-600 dark:text-slate-300">항구 (클릭 시 정박·출항·입항 정보)</span>
            </div>
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">오버레이</span>
            {LEGEND_OVERLAYS.map((o) => (
              <div key={o.label} className="flex items-center gap-2">
                <svg width="16" height="10" className="shrink-0">
                  <line x1="0" y1="5" x2="16" y2="5" stroke={o.color} strokeWidth="2" strokeDasharray="3,2" />
                </svg>
                <span className="text-slate-600 dark:text-slate-300">{o.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </button>
  )
}

import { Gauge } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import type { ProbabilityResult } from '@/features/ai-report/lib/calc'

type Confidence = ProbabilityResult['confidence']
type Tone = 'status' | 'blue'

const STATUS_BORDER: Record<Confidence, string> = {
  high: 'border-green-500',
  medium: 'border-yellow-500',
  low: 'border-red-500',
}
const STATUS_TEXT: Record<Confidence, string> = {
  high: 'text-green-600',
  medium: 'text-yellow-600',
  low: 'text-red-600',
}
const STATUS_BAR: Record<Confidence, string> = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-red-500',
}

const BLUE_BORDER: Record<Confidence, string> = {
  high: 'border-blue-600',
  medium: 'border-blue-500',
  low: 'border-blue-400',
}
const BLUE_TEXT: Record<Confidence, string> = {
  high: 'text-blue-600',
  medium: 'text-blue-500',
  low: 'text-blue-400',
}
const BLUE_BAR: Record<Confidence, string> = {
  high: 'bg-[#2563eb]',
  medium: 'bg-[#3b82f6]',
  low: 'bg-[#60a5fa]',
}

interface ProbabilityGaugeProps {
  label: string
  probability: ProbabilityResult
  tone: Tone
  descLabel: string
  confidenceLabel: string
  marginLabel: string
  hint?: string
  formula?: string
}

export function ProbabilityGauge({
  label,
  probability,
  tone,
  descLabel,
  confidenceLabel,
  marginLabel,
  hint,
  formula,
}: ProbabilityGaugeProps) {
  const border = tone === 'blue' ? BLUE_BORDER[probability.confidence] : STATUS_BORDER[probability.confidence]
  const text = tone === 'blue' ? BLUE_TEXT[probability.confidence] : STATUS_TEXT[probability.confidence]
  const bar = tone === 'blue' ? BLUE_BAR[probability.confidence] : STATUS_BAR[probability.confidence]

  return (
    <div className={cn('rounded-lg border-2 bg-white px-4 py-3 dark:bg-slate-800', border)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Gauge className="h-4 w-4" />
          {label}
        </span>
        <span className={cn('text-[30px] leading-none font-extrabold', text)}>{probability.percent}%</span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${probability.percent}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className={cn('font-bold', text)}>
          {descLabel} · {confidenceLabel}
        </span>
        <span className="text-slate-500 dark:text-slate-400">{marginLabel}</span>
      </div>

      {hint && <p className="mt-1 text-sm text-green-600 dark:text-green-400">{hint}</p>}

      {formula && (
        <p className="mt-2 border-t border-slate-100 pt-2 font-mono text-xs text-slate-400 dark:border-slate-700">
          {formula}
        </p>
      )}
    </div>
  )
}

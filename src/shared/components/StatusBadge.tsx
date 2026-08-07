'use client'

import { useLanguage } from '@/features/i18n/LanguageContext'
import type { VoyageStatus, VesselStatus } from '@/shared/types'
import { cn } from '@/shared/utils/cn'

const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

const VOYAGE_CLASSES: Record<VoyageStatus, string> = {
  preparing: 'bg-slate-100 text-slate-600',
  underway: 'bg-blue-100 text-blue-700',
  delayed: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

export function VoyageBadge({ status }: { status: VoyageStatus }) {
  const { t } = useLanguage()
  return <span className={cn(BADGE_BASE, VOYAGE_CLASSES[status])}>{t.status[status]}</span>
}

const VESSEL_CLASSES: Record<VesselStatus, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  idle: 'bg-slate-100 text-slate-600',
}

export function VesselBadge({ status }: { status: VesselStatus }) {
  const { t } = useLanguage()
  return <span className={cn(BADGE_BASE, VESSEL_CLASSES[status])}>{t.status[status]}</span>
}

type RiskLevel = 'high' | 'medium' | 'low'

const RISK_CLASSES: Record<RiskLevel, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-[#6366f1]/10 text-[#6366f1]',
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useLanguage()
  return <span className={cn(BADGE_BASE, RISK_CLASSES[level])}>{t.status[level]}</span>
}

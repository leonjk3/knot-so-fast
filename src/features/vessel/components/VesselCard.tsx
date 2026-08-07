'use client'

import { Anchor, Wrench } from 'lucide-react'
import type { Vessel, VesselType, Voyage } from '@/shared/types'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { VesselBadge } from '@/shared/components/StatusBadge'
import { formatNumber } from '@/shared/utils/format'
import { cn } from '@/shared/utils/cn'
import { findActiveVoyage, portToken, FOULING_WARNING_THRESHOLD } from '../lib/calc'

const TYPE_LABEL_KEY: Record<VesselType, 'typeContainer' | 'typeBulk' | 'typeTanker' | 'typeRoro'> = {
  container: 'typeContainer',
  bulk: 'typeBulk',
  tanker: 'typeTanker',
  roro: 'typeRoro',
}

interface VesselCardProps {
  vessel: Vessel
  selected: boolean
  voyages: Voyage[]
  onClick: () => void
}

export function VesselCard({ vessel, selected, voyages, onClick }: VesselCardProps) {
  const { t } = useLanguage()
  const activeVoyage = findActiveVoyage(vessel.id, voyages)
  const foulingWarning = vessel.foulingFactor > FOULING_WARNING_THRESHOLD

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-white p-4 text-left dark:bg-slate-800',
        selected
          ? 'border-[#6366f1] shadow-md ring-1 ring-[#6366f1]/30'
          : 'border-slate-200 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
          {vessel.status === 'maintenance' ? (
            <Wrench className="h-5 w-5 text-yellow-500" />
          ) : (
            <Anchor className="h-5 w-5 text-[#6366f1]" />
          )}
        </span>
        <VesselBadge status={vessel.status} />
      </div>

      <p className="text-sm font-semibold text-slate-900 dark:text-white">{vessel.name}</p>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        IMO {vessel.imo} · {t.vessel[TYPE_LABEL_KEY[vessel.type]]} · {vessel.buildYear}
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <p className="text-slate-500 dark:text-slate-400">{t.vessel.grossTonnage}</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">{formatNumber(vessel.grossTonnage, 0)} GT</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">{t.vessel.draft}</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {vessel.currentDraft}m / {vessel.maxDraft}m
          </p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">{t.vessel.loa}</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">{vessel.lengthOverall}m</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">{t.vessel.fouling}</p>
          <p className={cn('font-medium', foulingWarning ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-200')}>
            ×{vessel.foulingFactor.toFixed(2)}
          </p>
        </div>
      </div>

      {activeVoyage && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium text-[#6366f1] dark:border-slate-700">
          {t.vessel.underway}: {portToken(activeVoyage.departurePort)} → {portToken(activeVoyage.arrivalPort)}
        </p>
      )}
    </button>
  )
}

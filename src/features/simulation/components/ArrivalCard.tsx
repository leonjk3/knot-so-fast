'use client'

import { Clock, Anchor } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { formatDateTime } from '@/shared/utils/format'

interface ArrivalCardProps {
  plannedEtaIso: string
  plannedDays: number
  simulatedEtaIso: string
  simDays: number
  portWaitHours: number
  portWaitCost: number
}

export function ArrivalCard({ plannedEtaIso, plannedDays, simulatedEtaIso, simDays, portWaitHours, portWaitCost }: ArrivalCardProps) {
  const { t } = useLanguage()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-400" />
        <p className="text-sm font-semibold">{t.simulation.etaTitle}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.simulation.plannedEta}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{formatDateTime(plannedEtaIso)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.simulation.daysLabel(plannedDays.toFixed(1))}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.simulation.simEta}</p>
          <p className="text-sm font-medium text-[#6366f1]">{formatDateTime(simulatedEtaIso)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.simulation.daysLabel(simDays.toFixed(1))}</p>
        </div>
      </div>

      {portWaitHours > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Anchor className="h-3.5 w-3.5" />
            {t.simulation.portWaitTitle}
          </span>
          <span className="font-semibold text-amber-600">
            +{portWaitHours.toFixed(1)}h · {t.simulation.portWaitCost(`$${Math.round(portWaitCost).toLocaleString()}`)}
          </span>
        </div>
      )}
    </div>
  )
}

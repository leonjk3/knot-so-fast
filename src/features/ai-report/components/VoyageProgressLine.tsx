import { Navigation, Ship } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { formatNm } from '@/shared/utils/format'
import { portShortName } from '@/features/ai-report/lib/calc'

interface VoyageProgressLineProps {
  departurePort: string
  arrivalPort: string
  totalDistanceNm: number
  traveledNm: number
  remainingNm: number
  percent: number
}

export function VoyageProgressLine({
  departurePort,
  arrivalPort,
  totalDistanceNm,
  traveledNm,
  remainingNm,
  percent,
}: VoyageProgressLineProps) {
  const { t } = useLanguage()
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const labelPercent = Math.min(94, Math.max(6, clampedPercent))

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <Navigation className="h-4 w-4 text-[#6366f1]" />
          {t.aiReport.progressLineTitle}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {t.aiReport.totalDistance} {formatNm(totalDistanceNm)}
        </span>
      </div>

      <div className="relative mt-7 mb-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
        <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${clampedPercent}%` }} />

        <span className="absolute top-1/2 left-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300 dark:border-slate-800" />
        <span className="absolute top-1/2 right-0 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300 dark:border-slate-800" />

        <div
          className="absolute top-1/2"
          style={{ left: `${clampedPercent}%`, transform: 'translate(-50%, -50%)' }}
        >
          <Ship className="h-5 w-5 text-[#6366f1]" />
        </div>
        <div
          className="absolute -top-5 text-xs font-bold whitespace-nowrap text-[#6366f1]"
          style={{ left: `${labelPercent}%`, transform: 'translateX(-50%)' }}
        >
          {t.aiReport.currentPosition} · {Math.round(clampedPercent)}%
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <p className="font-medium">{portShortName(departurePort)}</p>
          <p className="text-slate-500 dark:text-slate-400">
            {t.aiReport.traveledDistance} {formatNm(traveledNm)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium">{portShortName(arrivalPort)}</p>
          <p className="text-slate-500 dark:text-slate-400">
            {t.aiReport.remainingDistance} {formatNm(remainingNm)}
          </p>
        </div>
      </div>
    </div>
  )
}

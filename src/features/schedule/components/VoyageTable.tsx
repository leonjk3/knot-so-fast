'use client'

import { CalendarDays, ChevronRight, Fuel, MapPin, Ship } from 'lucide-react'
import type { Vessel, Voyage } from '@/shared/types'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { VoyageBadge } from '@/shared/components/StatusBadge'
import { cn } from '@/shared/utils/cn'
import { formatDateTime, formatNm } from '@/shared/utils/format'
import type { RtaProbabilityResult } from '../lib/probability'

function firstToken(label: string): string {
  return label.split(' ')[0]
}

const PROB_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-green-600',
  medium: 'text-yellow-600',
  low: 'text-red-600',
}

function ComplianceCell({ result }: { result: RtaProbabilityResult | null }) {
  if (!result) return <span className="text-sm text-slate-400">—</span>
  const colorClass = result.term === 'STA' ? 'text-blue-600' : PROB_COLOR[result.confidence]
  return (
    <div className="leading-tight">
      <span className="text-[10px] text-slate-400">{result.term}</span>
      <p className={cn('text-xs font-semibold', colorClass)}>{result.percent}%</p>
    </div>
  )
}

interface VoyageTableProps {
  voyages: Voyage[]
  vessels: Vessel[]
  getProbability: (voyage: Voyage) => RtaProbabilityResult | null
  onRowClick: (voyage: Voyage) => void
}

export function VoyageTable({ voyages, vessels, getProbability, onRowClick }: VoyageTableProps) {
  const { t } = useLanguage()

  return (
    <div className="min-h-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colVessel}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colRoute}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colEtd}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colEtaRta}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colRtaProb}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colDistance}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colRecSpeed}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.schedule.colStatus}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {voyages.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                  {t.common.noResults}
                </td>
              </tr>
            )}
            {voyages.map((voyage) => {
              const vessel = vessels.find((v) => v.id === voyage.vesselId)
              const probability = getProbability(voyage)
              return (
                <tr
                  key={voyage.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Ship className="h-3.5 w-3.5 text-slate-500" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{vessel?.name ?? '-'}</p>
                        <p className="text-xs text-slate-500">{vessel?.imo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-200">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {firstToken(voyage.departurePort)}
                      <span className="text-slate-400">→</span>
                      {firstToken(voyage.arrivalPort)}
                    </div>
                    <p className="max-w-40 truncate text-xs text-slate-500">{voyage.cargoDescription}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDateTime(voyage.etd)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className={cn('text-xs', voyage.status === 'delayed' ? 'text-red-600' : 'text-slate-700 dark:text-slate-200')}>
                      ETA {formatDateTime(voyage.eta)}
                    </p>
                    <p
                      className={cn(
                        'text-xs',
                        voyage.rtaConfirmed ? 'font-bold text-slate-600 dark:text-slate-300' : 'text-slate-500',
                      )}
                    >
                      RTA {formatDateTime(voyage.rta)}
                      {voyage.rtaConfirmed && <span className="ml-1 text-green-600">{t.schedule.rtaConfirmedTag}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceCell result={probability} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {voyage.distanceNm > 0 ? formatNm(voyage.distanceNm) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Fuel className="h-3.5 w-3.5 text-green-600" />
                      <span className="font-medium text-green-600">{voyage.recommendedSpeedKnots} kts</span>
                      <span className="text-slate-400 line-through">{voyage.plannedSpeedKnots}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <VoyageBadge status={voyage.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRowClick(voyage)}
                      className="text-slate-400 hover:text-[#6366f1]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

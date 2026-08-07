'use client'

import { Pencil } from 'lucide-react'
import type { Vessel, VesselType, Voyage } from '@/shared/types'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { formatNumber } from '@/shared/utils/format'
import { findActiveVoyage, portToken } from '../lib/calc'
import { FuelCurveChart } from './FuelCurveChart'

const TYPE_LABEL_KEY: Record<VesselType, 'typeContainer' | 'typeBulk' | 'typeTanker' | 'typeRoro'> = {
  container: 'typeContainer',
  bulk: 'typeBulk',
  tanker: 'typeTanker',
  roro: 'typeRoro',
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}

interface VesselDetailPanelProps {
  vessel: Vessel
  voyages: Voyage[]
  onEdit: () => void
}

export function VesselDetailPanel({ vessel, voyages, onEdit }: VesselDetailPanelProps) {
  const { t } = useLanguage()
  const activeVoyage = findActiveVoyage(vessel.id, voyages)

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{vessel.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.vessel[TYPE_LABEL_KEY[vessel.type]]}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          title="선박 정보 수정"
          className="text-slate-400 hover:text-[#6366f1]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t.vessel.specs}</h3>
          <div className="space-y-1.5">
            <SpecRow label="IMO" value={vessel.imo} />
            <SpecRow label={t.vessel.flag} value={vessel.flag} />
            <SpecRow label={t.vessel.grossTonnage} value={`${formatNumber(vessel.grossTonnage, 0)} GT`} />
            <SpecRow label="LOA" value={`${vessel.lengthOverall} m`} />
            <SpecRow label={t.vessel.beam} value={`${vessel.beam} m`} />
            <SpecRow label={t.vessel.maxDraft} value={`${vessel.maxDraft} m`} />
            <SpecRow label={t.vessel.curDraft} value={`${vessel.currentDraft} m`} />
            <SpecRow label={t.vessel.enginePower} value={`${formatNumber(vessel.enginePower, 0)} kW`} />
            <SpecRow label={t.vessel.hullFouling} value={`×${vessel.foulingFactor.toFixed(2)}`} />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t.vessel.fuelCurve}</h3>
          <FuelCurveChart fuelCurve={vessel.fuelCurve} foulingFactor={vessel.foulingFactor} />
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400">
                <th className="py-1 text-left font-normal">{t.vessel.speedCol}</th>
                <th className="py-1 text-right font-normal">{t.vessel.consumeCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {vessel.fuelCurve.map((point) => (
                <tr key={point.speedKnots}>
                  <td className="py-1 text-left text-slate-500 dark:text-slate-400">{point.speedKnots} kts</td>
                  <td className="py-1 text-right font-medium text-slate-700 dark:text-slate-200">{point.fuelTonPerDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeVoyage && (
          <div className="rounded-lg bg-[#6366f1]/10 p-3">
            <h3 className="text-xs font-semibold text-[#6366f1]">{t.vessel.activeVoyage}</h3>
            <p className="mt-1 text-xs text-[#6366f1]">
              {portToken(activeVoyage.departurePort)} → {portToken(activeVoyage.arrivalPort)}
            </p>
            <p className="mt-1 text-xs text-[#6366f1]/70">{activeVoyage.cargoDescription}</p>
          </div>
        )}
      </div>
    </div>
  )
}

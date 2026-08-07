'use client'

import { useMemo, useState } from 'react'
import { Award, Leaf, Fuel, TrendingDown, FileText, Sparkles } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { computeEmissions, computeThreeWayComparison, computeScope3 } from '@/features/carbon/calc'
import { CarbonStatCard } from '@/features/carbon/components/CarbonStatCard'

function portShortName(label: string): string {
  return label.split(' ')[0]
}

export default function CarbonPage() {
  const { t } = useLanguage()
  const [voyageId, setVoyageId] = useState<string | null>(null)

  // §5.1 — 항차/선박을 찾지 못하면 조기 반환한다.
  const selectedVoyage = MOCK_VOYAGES.find((v) => v.id === voyageId) ?? MOCK_VOYAGES[0]
  const selectedVessel = selectedVoyage ? MOCK_VESSELS.find((v) => v.id === selectedVoyage.vesselId) : undefined

  const emissions = useMemo(
    () => (selectedVessel && selectedVoyage ? computeEmissions(selectedVessel, selectedVoyage) : null),
    [selectedVessel, selectedVoyage],
  )
  const comparison = useMemo(() => (emissions ? computeThreeWayComparison(emissions) : null), [emissions])
  const scope3 = useMemo(() => (comparison ? computeScope3(comparison) : null), [comparison])

  if (!selectedVoyage || !selectedVessel || !emissions || !comparison || !scope3) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t.carbon.title} />
        <div className="p-6 text-xs text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.carbon.title} subtitle={t.carbon.subtitle(selectedVessel.name)} />

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.carbon.voyageSelectLabel}</label>
          <select
            value={selectedVoyage.id}
            onChange={(e) => setVoyageId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#6366f1] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            {MOCK_VOYAGES.map((v) => {
              const vessel = MOCK_VESSELS.find((ves) => ves.id === v.vesselId)
              return (
                <option key={v.id} value={v.id}>
                  {vessel?.name} · {portShortName(v.departurePort)} → {portShortName(v.arrivalPort)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <CarbonStatCard
              icon={Award}
              iconColorClass="text-orange-600"
              value={comparison.current.avgCiiScore.toFixed(2)}
              description={`${t.carbon.ciiScore} · ${t.carbon.grade} ${comparison.current.ciiGrade}`}
            />
            <CarbonStatCard
              icon={Leaf}
              iconColorClass="text-green-600"
              value={`${(comparison.current.totalCo2Ton / 1000).toFixed(1)} k ton`}
              description={`${t.carbon.totalCo2} · ${t.carbon.curVoyage}`}
            />
            <CarbonStatCard
              icon={Fuel}
              iconColorClass="text-[#6366f1]"
              value={`${(comparison.current.totalFuelTon / 1000).toFixed(1)} k ton`}
              description={`${t.carbon.totalFuel} · ${t.carbon.hfoBase}`}
            />
            <CarbonStatCard
              icon={TrendingDown}
              iconColorClass="text-purple-600"
              value={`-${scope3.scope3SavedPct.toFixed(1)}%`}
              description={`${t.carbon.vsBenchmark} · ${t.carbon.co2Saving}`}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10">
                <FileText className="h-4 w-4 text-[#6366f1]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t.carbon.scope3Title}</p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{t.carbon.scope3Desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-xs dark:bg-purple-500/10">
                <Sparkles className="h-4 w-4 shrink-0 text-purple-600" />
                <p>
                  <span className="font-semibold text-purple-600">{t.carbon.scope3AiLabel}</span>{' '}
                  {t.carbon.scope3AiValue(scope3.scope3SavedTon.toFixed(1), scope3.scope3SavedPct.toFixed(1))}
                </p>
              </div>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4f46e5]"
              >
                <FileText className="h-3.5 w-3.5" />
                {t.carbon.scope3Button}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

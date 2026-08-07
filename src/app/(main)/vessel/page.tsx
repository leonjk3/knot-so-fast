'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import type { Vessel } from '@/shared/types'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { VesselCard } from '@/features/vessel/components/VesselCard'
import { VesselDetailPanel } from '@/features/vessel/components/VesselDetailPanel'
import { VesselModal } from '@/features/vessel/components/VesselModal'
import { findActiveVoyage } from '@/features/vessel/lib/calc'
import type { VesselModalMode } from '@/features/vessel/lib/lock'

export default function VesselPage() {
  const { t } = useLanguage()
  const [vessels, setVessels] = useState<Vessel[]>(MOCK_VESSELS)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<VesselModalMode | null>(null)

  const filteredVessels = vessels.filter((v) => v.name.includes(search) || v.imo.includes(search))
  const selectedVessel = vessels.find((v) => v.id === selectedId) ?? null
  const hasActiveVoyage = selectedVessel ? !!findActiveVoyage(selectedVessel.id, MOCK_VOYAGES) : false

  function handleCardClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  function handleModalSubmit(vessel: Vessel) {
    setVessels((prev) => {
      const exists = prev.some((v) => v.id === vessel.id)
      return exists ? prev.map((v) => (v.id === vessel.id ? vessel : v)) : [...prev, vessel]
    })
    setModalMode(null)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.vessel.title} subtitle={t.vessel.subtitle}>
        <button
          type="button"
          onClick={() => setModalMode('create')}
          className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5]"
        >
          <Plus className="h-4 w-4" />
          {t.vessel.addVessel}
        </button>
      </PageHeader>

      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.vessel.searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:ring-2 focus:ring-[#6366f1] focus:outline-none dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredVessels.map((vessel) => (
              <VesselCard
                key={vessel.id}
                vessel={vessel}
                selected={vessel.id === selectedId}
                voyages={MOCK_VOYAGES}
                onClick={() => handleCardClick(vessel.id)}
              />
            ))}
          </div>
        </div>

        {selectedVessel && (
          <VesselDetailPanel vessel={selectedVessel} voyages={MOCK_VOYAGES} onEdit={() => setModalMode('view')} />
        )}
      </div>

      {modalMode && (
        <VesselModal
          mode={modalMode}
          vessel={modalMode === 'view' ? selectedVessel : null}
          hasActiveVoyage={hasActiveVoyage}
          onClose={() => setModalMode(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  )
}

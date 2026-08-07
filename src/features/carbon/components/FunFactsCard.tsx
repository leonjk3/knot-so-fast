'use client'

import { PartyPopper, TreePine, Car, UtensilsCrossed } from 'lucide-react'
import { useLanguage } from '@/features/i18n/LanguageContext'
import type { FunFacts } from '@/features/carbon/calc'

interface FunFactsCardProps {
  scope3SavedTon: number
  facts: FunFacts
}

export function FunFactsCard({ scope3SavedTon, facts }: FunFactsCardProps) {
  const { t } = useLanguage()

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#6366f1]/5 to-purple-500/5 p-5 dark:border-slate-800 dark:from-[#6366f1]/10 dark:to-purple-500/10">
      <div className="flex items-center gap-2">
        <PartyPopper className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold">{t.carbon.funTitle}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.carbon.funSubtitle(scope3SavedTon.toFixed(1))}</p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <TreePine className="h-4 w-4 shrink-0 text-green-600" />
          <p className="text-sm">{t.carbon.funTrees(facts.trees.toLocaleString())}</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <Car className="h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-sm">{t.carbon.funEarthLaps(facts.earthLaps.toFixed(1))}</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <UtensilsCrossed className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm">{t.carbon.funChicken(facts.chickens.toLocaleString())}</p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400">{t.carbon.funDisclaimer}</p>
    </div>
  )
}

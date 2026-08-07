'use client'

import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'

export default function AdminUsersPage() {
  const { t } = useLanguage()
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.nav.users} />
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        docs/specs/ADMIN_USERS.md
      </div>
    </div>
  )
}

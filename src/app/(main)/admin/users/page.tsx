'use client'

import { useState } from 'react'
import { Plus, Search, UserCheck, UserX } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { ROLE_ORDER, ROLE_ICON, ROLE_COLOR_CLASS } from '@/features/admin-users/roleConfig'
import { MOCK_USERS } from '@/mocks/users'
import { MOCK_VESSELS } from '@/mocks/vessels'
import type { UserRole } from '@/shared/types'

export default function AdminUsersPage() {
  const { t } = useLanguage()
  const [users, setUsers] = useState(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  // §5.2 — 요약 카드는 항상 전체 사용자 기준으로 집계한다(필터와 무관).
  const roleCounts: Record<UserRole, number> = { ADMIN: 0, LOGISTICS: 0, CAPTAIN: 0, CLIENT: 0 }
  users.forEach((u) => {
    roleCounts[u.role] += 1
  })

  // §5.1 — 대소문자를 구분하는 단순 부분 문자열 포함(원본 그대로), 정렬 없음.
  const filtered = users.filter(
    (u) => (roleFilter === 'all' || u.role === roleFilter) && (search === '' || u.name.includes(search) || u.email.includes(search)),
  )

  function toggleActive(id: string) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)))
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t.users.title} subtitle={t.users.subtitle}>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5]"
        >
          <Plus className="h-4 w-4" />
          {t.users.addUser}
        </button>
      </PageHeader>

      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ROLE_ORDER.map((role) => {
            const Icon = ROLE_ICON[role]
            return (
              <div
                key={role}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ROLE_COLOR_CLASS[role])}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold">{roleCounts[role]}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t.role[role]}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.users.searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm focus:ring-2 focus:ring-[#6366f1] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium',
                roleFilter === 'all' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {t.common.all}
            </button>
            {ROLE_ORDER.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  roleFilter === role ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {t.role[role]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.users.colUser}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.users.colRole}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.users.colDept}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.users.colVessel}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t.users.colStatus}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{t.users.colAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((user) => {
                const RoleIcon = ROLE_ICON[user.role]
                // §5.3 — filter(Boolean) 필수: 선박 목록에 없는 id가 섞이면 undefined가 낀다.
                const assignedVessels = (user.assignedVesselIds
                  ?.map((id) => MOCK_VESSELS.find((v) => v.id === id)?.name)
                  .filter(Boolean) ?? []) as string[]

                return (
                  <tr
                    key={user.id}
                    className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/40', !user.active && 'opacity-50')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold dark:bg-slate-700">
                          {user.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{user.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                          ROLE_COLOR_CLASS[user.role],
                        )}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {t.role[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{user.department ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {assignedVessels.length > 0 ? assignedVessels.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          user.active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {user.active ? t.status.enabled : t.status.disabled}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleActive(user.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {user.active ? (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            {t.users.deactivate}
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            {t.users.activate}
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

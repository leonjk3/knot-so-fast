'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  BrainCircuit,
  Leaf,
  FlaskConical,
  CalendarDays,
  Anchor,
  Users,
  Ship,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useLanguage } from '@/features/i18n/LanguageContext'
import type { UserRole } from '@/shared/types'
import { cn } from '@/shared/utils/cn'

interface MenuItem {
  href: string
  labelKey: 'dashboard' | 'aiReport' | 'carbon' | 'simulation' | 'schedule' | 'vessel' | 'users'
  icon: LucideIcon
  roles: UserRole[]
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'LOGISTICS', 'CAPTAIN', 'CLIENT'] },
  { href: '/ai-report', labelKey: 'aiReport', icon: BrainCircuit, roles: ['ADMIN', 'LOGISTICS', 'CAPTAIN'] },
  { href: '/carbon', labelKey: 'carbon', icon: Leaf, roles: ['ADMIN', 'LOGISTICS'] },
  { href: '/simulation', labelKey: 'simulation', icon: FlaskConical, roles: ['ADMIN', 'LOGISTICS'] },
  { href: '/schedule', labelKey: 'schedule', icon: CalendarDays, roles: ['ADMIN', 'LOGISTICS'] },
  { href: '/vessel', labelKey: 'vessel', icon: Anchor, roles: ['ADMIN', 'LOGISTICS', 'CAPTAIN'] },
  { href: '/admin/users', labelKey: 'users', icon: Users, roles: ['ADMIN'] },
]

const COLLAPSE_KEY = 'ksf-sidebar-collapsed'

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        'flex items-center gap-2 border-b border-slate-200 px-4 py-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50',
        collapsed && 'justify-center px-0',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]">
        <Ship className="h-4 w-4 text-white" />
      </span>
      {!collapsed && <span className="text-sm font-bold whitespace-nowrap">KNOT SO FAST</span>}
    </Link>
  )
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { t } = useLanguage()

  const items = MENU_ITEMS.filter((item) => user && item.roles.includes(user.role))

  return (
    <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-[#f5f7ff] font-semibold text-[#6366f1] dark:bg-[#6366f1]/15'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{t.nav[item.labelKey]}</span>}
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-2 rounded-md bg-slate-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                {t.nav[item.labelKey]}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY)
    // false로 시작한 뒤 마운트 후 1회만 동기화한다(하이드레이션 안전, BOOTSTRAP.md 8.2장).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSE_KEY, String(next))
  }

  return (
    <aside
      className={cn(
        'hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex dark:border-slate-800 dark:bg-[#0B192C]',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <Logo collapsed={collapsed} />
      <NavList collapsed={collapsed} />
      <button
        onClick={toggleCollapsed}
        className={cn(
          'flex items-center gap-2 border-t border-slate-200 px-3 py-3 text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800',
          collapsed && 'justify-center',
        )}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span>{t.nav.collapse}</span>
          </>
        )}
      </button>
    </aside>
  )
}

function MobileHeader() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <div className="lg:hidden">
      <div className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#0B192C]">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366f1]">
            <Ship className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-bold whitespace-nowrap">KNOT SO FAST</span>
        </button>
        <button onClick={() => setOpen((o) => !o)} className="p-1">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 flex">
          <div className="flex w-56 flex-col border-r border-slate-200 bg-white pt-14 dark:border-slate-800 dark:bg-[#0B192C]">
            <NavList collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileHeader />
    </>
  )
}

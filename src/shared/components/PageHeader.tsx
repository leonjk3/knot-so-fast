'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/features/theme/ThemeContext'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

function Divider() {
  return <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLanguage()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="text-base font-bold whitespace-nowrap">{title}</h1>
        {subtitle && (
          <>
            <span className="hidden text-slate-300 sm:inline">·</span>
            <p className="hidden truncate text-sm text-slate-500 sm:block">{subtitle}</p>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {children}

        <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-700">
          <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              onClick={() => setLang('ko')}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                lang === 'ko' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500',
              )}
            >
              KO
            </button>
            <button
              onClick={() => setLang('en')}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                lang === 'en' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500',
              )}
            >
              EN
            </button>
          </div>

          <Divider />

          <button
            onClick={toggle}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <Divider />

          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6366f1]/10 text-sm font-bold text-[#6366f1]">
              {user?.name?.charAt(0) ?? '?'}
            </span>
            <span className="hidden max-w-40 truncate text-sm md:block">{user?.name}</span>
          </div>

          <Divider />

          <button
            onClick={handleLogout}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}

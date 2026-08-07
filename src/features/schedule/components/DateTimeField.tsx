'use client'

import { cn } from '@/shared/utils/cn'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { joinLocalDateTime, splitLocalDateTime } from '../lib/datetime'
import { inputClassName } from '../lib/fieldStyles'

// 오전을 먼저 나열해 브라우저 기본 순서에 의존하지 않는다 (SCHEDULE.md 5.6장)
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

interface DateTimeFieldProps {
  value: string
  onChange: (local: string) => void
  disabled?: boolean
  hasError?: boolean
}

export function DateTimeField({ value, onChange, disabled = false, hasError = false }: DateTimeFieldProps) {
  const { t } = useLanguage()
  const { date, hour12, minute, ampm } = splitLocalDateTime(value)

  function update(next: Partial<{ date: string; hour12: string; minute: string; ampm: 'AM' | 'PM' }>) {
    const merged = { date, hour12, minute, ampm, ...next }
    onChange(joinLocalDateTime(merged.date, merged.hour12, merged.minute, merged.ampm))
  }

  return (
    <div className="space-y-1">
      <input
        type="date"
        value={date}
        disabled={disabled}
        onChange={(e) => update({ date: e.target.value })}
        className={inputClassName(disabled, hasError)}
      />
      <div className="flex gap-1">
        <select
          value={hour12}
          disabled={disabled}
          onChange={(e) => update({ hour12: e.target.value })}
          className={cn(inputClassName(disabled, hasError), 'w-11 px-1')}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          value={minute}
          disabled={disabled}
          onChange={(e) => update({ minute: e.target.value })}
          className={cn(inputClassName(disabled, hasError), 'w-11 px-1')}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={ampm}
          disabled={disabled}
          onChange={(e) => update({ ampm: e.target.value as 'AM' | 'PM' })}
          className={cn(inputClassName(disabled, hasError), 'min-w-[56px] flex-1 appearance-none text-center')}
        >
          <option value="AM">{t.modal.am}</option>
          <option value="PM">{t.modal.pm}</option>
        </select>
      </div>
    </div>
  )
}

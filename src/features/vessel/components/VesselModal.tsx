'use client'

import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Activity, Calendar, Flag, Gauge, Ruler, Ship, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Vessel } from '@/shared/types'
import { OWN_COMPANY_NAME } from '@/shared/constants'
import { cn } from '@/shared/utils/cn'
import { buildFuelCurve } from '../lib/calc'
import { isFieldEditable, type LockableField, type VesselModalMode } from '../lib/lock'
import { createDefaultFormState, vesselToFormState, type VesselFormState } from '../lib/form'
import { validateVesselForm, type VesselFormErrors } from '../lib/validate'

interface VesselModalProps {
  mode: VesselModalMode
  vessel: Vessel | null
  hasActiveVoyage: boolean
  onClose: () => void
  onSubmit: (vessel: Vessel) => void
}

function inputClassName(disabled: boolean, hasError: boolean) {
  return cn(
    'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]',
    disabled
      ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-60 dark:bg-slate-700'
      : 'bg-white dark:bg-slate-800',
    hasError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600',
  )
}

function FieldLabel({ icon: Icon, required, children }: { icon: LucideIcon; required?: boolean; children: ReactNode }) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      <Icon className="h-3.5 w-3.5" />
      {children}
      {required && <span className="text-red-500">*</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-500">{message}</p>
}

export function VesselModal({ mode, vessel, hasActiveVoyage, onClose, onSubmit }: VesselModalProps) {
  const [form, setForm] = useState<VesselFormState>(() => (vessel ? vesselToFormState(vessel) : createDefaultFormState()))
  const [errors, setErrors] = useState<VesselFormErrors>({})

  function editable(key: LockableField) {
    return isFieldEditable(key, mode, hasActiveVoyage)
  }

  function updateField<K extends keyof VesselFormState>(key: K, value: VesselFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleSubmit() {
    const validationErrors = validateVesselForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const isEditing = mode === 'view' && vessel !== null
    const result: Vessel = {
      id: isEditing ? vessel!.id : `v${Date.now()}`,
      name: form.name.trim(),
      imo: form.imo,
      type: form.type,
      flag: form.flag.trim().toUpperCase(),
      company: isEditing ? vessel!.company : OWN_COMPANY_NAME,
      grossTonnage: Number(form.grossTonnage),
      lengthOverall: Number(form.lengthOverall),
      beam: Number(form.beam),
      maxDraft: Number(form.maxDraft),
      currentDraft: Number(form.currentDraft),
      enginePower: Number(form.enginePower),
      fuelCurve: isEditing ? vessel!.fuelCurve : buildFuelCurve(Number(form.designSpeedKnots), Number(form.designSpeedFuelTon)),
      designSpeedKnots: Number(form.designSpeedKnots),
      designSpeedFuelTon: Number(form.designSpeedFuelTon),
      foulingFactor: Number(form.foulingFactor),
      status: form.status,
      buildYear: Number(form.buildYear),
    }
    onSubmit(result)
  }

  const title = mode === 'create' ? '선박 등록' : '선박 정보 조회 · 수정'
  const subtitle = mode === 'create' ? '새 선박 프로필을 등록합니다' : '등록된 선박 정보를 확인하고 일부 항목을 수정합니다'
  const bannerText =
    mode === 'create'
      ? '연료 소모 커브는 기준 속도·소모량을 바탕으로 해군 배수량 법칙(속도³ 비례)에 따라 자동 산출됩니다. 등록 후 상세 패널에서 확인할 수 있습니다.'
      : '기준 속도·연료소모량은 AI 운항 리포팅의 연료·CO₂ 절감 계산 기초값이라 등록 후에는 수정할 수 없습니다. 그 외 선체 치수·엔진출력 등 진수 시점에 확정되는 제원도 함께 잠겨 있습니다.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366f1]/15">
              <Ship className="h-4 w-4 text-[#6366f1]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel icon={Ship} required>
                선박명
              </FieldLabel>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="예: HECO PIONEER"
                className={inputClassName(false, !!errors.name)}
              />
              <FieldError message={errors.name} />
            </div>
            <div>
              <FieldLabel icon={Ship} required>
                IMO 번호
              </FieldLabel>
              <input
                type="text"
                value={form.imo}
                disabled={!editable('imo')}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateField('imo', e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="예: 9876543"
                className={inputClassName(!editable('imo'), !!errors.imo)}
              />
              <FieldError message={errors.imo} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel icon={Ship}>선종</FieldLabel>
              <select
                value={form.type}
                disabled={!editable('type')}
                onChange={(e) => updateField('type', e.target.value as VesselFormState['type'])}
                className={inputClassName(!editable('type'), false)}
              >
                <option value="container">컨테이너선</option>
                <option value="bulk">벌크선</option>
                <option value="tanker">탱커선</option>
                <option value="roro">로로선</option>
              </select>
            </div>
            <div>
              <FieldLabel icon={Flag} required>
                선적국
              </FieldLabel>
              <input
                type="text"
                value={form.flag}
                onChange={(e) => updateField('flag', e.target.value.slice(0, 2).toUpperCase())}
                placeholder="예: KR"
                className={inputClassName(false, !!errors.flag)}
              />
              <FieldError message={errors.flag} />
            </div>
            <div>
              <FieldLabel icon={Calendar} required>
                건조년도
              </FieldLabel>
              <input
                type="number"
                value={form.buildYear}
                disabled={!editable('buildYear')}
                onChange={(e) => updateField('buildYear', e.target.value)}
                className={inputClassName(!editable('buildYear'), !!errors.buildYear)}
              />
              <FieldError message={errors.buildYear} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel icon={Ruler} required>
                총톤수 (GT)
              </FieldLabel>
              <input
                type="number"
                min={1}
                value={form.grossTonnage}
                disabled={!editable('grossTonnage')}
                onChange={(e) => updateField('grossTonnage', e.target.value)}
                placeholder="예: 94500"
                className={inputClassName(!editable('grossTonnage'), !!errors.grossTonnage)}
              />
              <FieldError message={errors.grossTonnage} />
            </div>
            <div>
              <FieldLabel icon={Ruler} required>
                전장(LOA, m)
              </FieldLabel>
              <input
                type="number"
                min={1}
                step={0.1}
                value={form.lengthOverall}
                disabled={!editable('lengthOverall')}
                onChange={(e) => updateField('lengthOverall', e.target.value)}
                placeholder="예: 299"
                className={inputClassName(!editable('lengthOverall'), !!errors.lengthOverall)}
              />
              <FieldError message={errors.lengthOverall} />
            </div>
            <div>
              <FieldLabel icon={Ruler} required>
                선폭 (m)
              </FieldLabel>
              <input
                type="number"
                min={1}
                step={0.1}
                value={form.beam}
                disabled={!editable('beam')}
                onChange={(e) => updateField('beam', e.target.value)}
                placeholder="예: 48.2"
                className={inputClassName(!editable('beam'), !!errors.beam)}
              />
              <FieldError message={errors.beam} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel icon={Gauge} required>
                최대 흘수 (m)
              </FieldLabel>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.maxDraft}
                disabled={!editable('maxDraft')}
                onChange={(e) => updateField('maxDraft', e.target.value)}
                placeholder="예: 14.5"
                className={inputClassName(!editable('maxDraft'), !!errors.maxDraft)}
              />
              <FieldError message={errors.maxDraft} />
            </div>
            <div>
              <FieldLabel icon={Gauge} required>
                현재 흘수 (m)
              </FieldLabel>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.currentDraft}
                onChange={(e) => updateField('currentDraft', e.target.value)}
                placeholder="예: 13.1"
                className={inputClassName(false, !!errors.currentDraft)}
              />
              <FieldError message={errors.currentDraft} />
            </div>
            <div>
              <FieldLabel icon={Activity} required>
                엔진 출력 (kW)
              </FieldLabel>
              <input
                type="number"
                min={1}
                value={form.enginePower}
                disabled={!editable('enginePower')}
                onChange={(e) => updateField('enginePower', e.target.value)}
                placeholder="예: 72240"
                className={inputClassName(!editable('enginePower'), !!errors.enginePower)}
              />
              <FieldError message={errors.enginePower} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel icon={Activity} required>
                선체 노후 계수
              </FieldLabel>
              <input
                type="number"
                min={1}
                step={0.01}
                value={form.foulingFactor}
                onChange={(e) => updateField('foulingFactor', e.target.value)}
                className={inputClassName(false, !!errors.foulingFactor)}
              />
              <FieldError message={errors.foulingFactor} />
            </div>
            <div>
              <FieldLabel icon={Activity}>운항 상태</FieldLabel>
              <select
                value={form.status}
                disabled={!editable('status')}
                onChange={(e) => updateField('status', e.target.value as VesselFormState['status'])}
                className={inputClassName(!editable('status'), false)}
              >
                <option value="active">운항 가능</option>
                <option value="maintenance">정비 중</option>
                <option value="idle">대기</option>
              </select>
              {!editable('status') && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">운항중인 항차가 있어 수정할 수 없습니다</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel icon={Gauge} required>
                기준 속도 (kts)
              </FieldLabel>
              <input
                type="number"
                min={1}
                step={0.5}
                value={form.designSpeedKnots}
                disabled={!editable('designSpeedKnots')}
                onChange={(e) => updateField('designSpeedKnots', e.target.value)}
                className={inputClassName(!editable('designSpeedKnots'), !!errors.designSpeedKnots)}
              />
              <FieldError message={errors.designSpeedKnots} />
            </div>
            <div>
              <FieldLabel icon={Gauge} required>
                기준 속도 연료소모 (ton/day)
              </FieldLabel>
              <input
                type="number"
                min={1}
                value={form.designSpeedFuelTon}
                disabled={!editable('designSpeedFuelTon')}
                onChange={(e) => updateField('designSpeedFuelTon', e.target.value)}
                className={inputClassName(!editable('designSpeedFuelTon'), !!errors.designSpeedFuelTon)}
              />
              <FieldError message={errors.designSpeedFuelTon} />
            </div>
          </div>

          <div className="rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/8 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
            {bannerText}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5]"
          >
            {mode === 'create' ? '선박 등록' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

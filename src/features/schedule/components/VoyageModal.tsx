'use client'

import { useEffect, useState } from 'react'
import { Calendar, Fuel, Gauge, MapPin, Package, Ship, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Vessel, VesselType, Voyage, VoyageStatus } from '@/shared/types'
import { useLanguage } from '@/features/i18n/LanguageContext'
import { cn } from '@/shared/utils/cn'
import { formatDateTime } from '@/shared/utils/format'
import { PORTS, findPort, formatPortLabel } from '@/mocks/ports'
import { resolvePortPairRoute } from '../lib/route'
import { toIso } from '../lib/datetime'
import { isFieldEditable, type VoyageModalMode } from '../lib/policy'
import { createDefaultFormState, voyageToFormState, type VoyageFormState } from '../lib/form'
import { validateVoyageForm, type VoyageFormErrors } from '../lib/validate'
import { inputClassName } from '../lib/fieldStyles'
import { DateTimeField } from './DateTimeField'

interface VoyageModalProps {
  mode: VoyageModalMode
  voyage: Voyage | null
  vessels: Vessel[]
  onClose: () => void
  onSubmit: (voyage: Voyage) => void
}

const VESSEL_TYPE_LABEL_KEY: Record<VesselType, 'container' | 'bulk' | 'tanker' | 'roro'> = {
  container: 'container',
  bulk: 'bulk',
  tanker: 'tanker',
  roro: 'roro',
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

export function VoyageModal({ mode, voyage, vessels, onClose, onSubmit }: VoyageModalProps) {
  const { t } = useLanguage()
  const [form, setForm] = useState<VoyageFormState>(() => (voyage ? voyageToFormState(voyage) : createDefaultFormState()))
  const [errors, setErrors] = useState<VoyageFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [etaPreviewState, setEtaPreviewState] = useState<{ key: string; etaIso: string | null }>({
    key: '',
    etaIso: null,
  })

  const status: VoyageStatus = voyage?.status ?? 'preparing'

  function editable(key: string) {
    return isFieldEditable(key, mode, status)
  }

  function updateField<K extends keyof VoyageFormState>(key: K, value: VoyageFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // ports/ETD/속도는 잠금 정책상 항상 함께 잠기므로 etd 필드 하나로 그룹 전체를 대표한다
  const etaFieldsEditable = editable('etd')
  const speedNum = Number(form.plannedSpeedKnots)
  const hasEtaInputs =
    etaFieldsEditable && !!form.departurePortCode && !!form.arrivalPortCode && !!form.etd && speedNum > 0
  const etaKey = hasEtaInputs ? `${form.departurePortCode}|${form.arrivalPortCode}|${form.etd}|${speedNum}` : ''

  useEffect(() => {
    if (!hasEtaInputs) return // 아직 입력이 안 갖춰졌으면 조회를 시작하지 않는다 — setState 없음
    let cancelled = false
    resolvePortPairRoute(form.departurePortCode, form.arrivalPortCode).then((route) => {
      if (cancelled) return
      const distanceNm = route?.distanceNm ?? 0
      if (distanceNm <= 0) return
      const etaMs = new Date(toIso(form.etd)).getTime() + (distanceNm / speedNum) * 3600000
      setEtaPreviewState({ key: etaKey, etaIso: new Date(etaMs).toISOString() })
    })
    return () => {
      cancelled = true
    }
  }, [hasEtaInputs, etaKey, form.departurePortCode, form.arrivalPortCode, form.etd, speedNum])

  // key가 최신 입력 조합과 다르면 아직 그 조합의 조회가 끝나지 않은 것이므로 이전 값을 보여주지 않는다
  const etaPreview = hasEtaInputs && etaPreviewState.key === etaKey ? etaPreviewState.etaIso : null
  const displayEta = etaFieldsEditable ? etaPreview : mode === 'view' ? (voyage?.eta ?? null) : null
  const effectiveRtaIso = editable('rta') ? toIso(form.rta) : (voyage?.rta ?? '')
  const showLateWarning = !!displayEta && !!effectiveRtaIso && effectiveRtaIso < displayEta

  const isReadOnly = mode === 'view' && !editable('vesselId') && !editable('sta') // 완료/취소 — 아무 필드도 편집 불가
  const isRestricted = mode === 'view' && status !== 'preparing' && !isReadOnly

  const vesselOptions = vessels.filter((v) => v.status !== 'maintenance' || v.id === form.vesselId)

  async function handleSubmit() {
    const validationErrors = validateVoyageForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    const isEditing = mode === 'view' && voyage !== null

    const depPort = findPort(form.departurePortCode)
    const arrPort = findPort(form.arrivalPortCode)
    const route = await resolvePortPairRoute(form.departurePortCode, form.arrivalPortCode)
    const distanceNm = route?.distanceNm ?? (isEditing ? voyage!.distanceNm : 0)

    const etdIso = toIso(form.etd)
    const rtaIso = toIso(form.rta)
    const speed = Number(form.plannedSpeedKnots)
    const etaIso =
      distanceNm > 0 ? new Date(new Date(etdIso).getTime() + (distanceNm / speed) * 3600000).toISOString() : rtaIso

    const result: Voyage = {
      id: isEditing ? voyage!.id : `voy${Date.now()}`,
      vesselId: form.vesselId,
      cargoDescription: form.cargoDescription.trim(),
      departurePort: depPort ? formatPortLabel(depPort) : isEditing ? voyage!.departurePort : '',
      arrivalPort: arrPort ? formatPortLabel(arrPort) : isEditing ? voyage!.arrivalPort : '',
      etd: etdIso,
      sta: form.sta ? toIso(form.sta) : rtaIso,
      rta: rtaIso,
      rtaConfirmed: form.rtaConfirmed,
      eta: etaIso,
      status: isEditing ? voyage!.status : 'preparing',
      plannedRoute: route?.points ?? (isEditing ? voyage!.plannedRoute : []),
      actualRoute: isEditing ? voyage!.actualRoute : [],
      plannedSpeedKnots: speed,
      recommendedSpeedKnots: isEditing ? voyage!.recommendedSpeedKnots : speed,
      fuelType: form.fuelType,
      cargoTon: Number(form.cargoTon),
      distanceNm,
    }

    onSubmit(result)
    setSubmitting(false)
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const title = mode === 'create' ? t.modal.registerVoyage : t.modal.viewVoyage
  const subtitle = mode === 'create' ? t.modal.registerSub : t.modal.viewSub

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
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
          <div>
            <FieldLabel icon={Ship} required>
              {t.modal.selectVessel}
            </FieldLabel>
            <select
              value={form.vesselId}
              disabled={!editable('vesselId')}
              onChange={(e) => updateField('vesselId', e.target.value)}
              className={inputClassName(!editable('vesselId'), !!errors.vesselId)}
            >
              <option value="">{t.modal.selectVesselPh}</option>
              {vesselOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — IMO {v.imo} ({t.modal[VESSEL_TYPE_LABEL_KEY[v.type]]})
                </option>
              ))}
            </select>
            <FieldError message={errors.vesselId && t.modal[errors.vesselId]} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel icon={MapPin} required>
                {t.modal.departure}
              </FieldLabel>
              <select
                value={form.departurePortCode}
                disabled={!editable('departurePortCode')}
                onChange={(e) => updateField('departurePortCode', e.target.value)}
                className={inputClassName(!editable('departurePortCode'), !!errors.departurePortCode)}
              >
                <option value="">{t.modal.depPlaceholder}</option>
                {PORTS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {formatPortLabel(p)}
                  </option>
                ))}
              </select>
              <FieldError message={errors.departurePortCode && t.modal[errors.departurePortCode]} />
            </div>
            <div>
              <FieldLabel icon={MapPin} required>
                {t.modal.arrival}
              </FieldLabel>
              <select
                value={form.arrivalPortCode}
                disabled={!editable('arrivalPortCode')}
                onChange={(e) => updateField('arrivalPortCode', e.target.value)}
                className={inputClassName(!editable('arrivalPortCode'), !!errors.arrivalPortCode)}
              >
                <option value="">{t.modal.arrPlaceholder}</option>
                {PORTS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {formatPortLabel(p)}
                  </option>
                ))}
              </select>
              <FieldError message={errors.arrivalPortCode && t.modal[errors.arrivalPortCode]} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel icon={Calendar} required>
                {t.modal.etd}
              </FieldLabel>
              <DateTimeField
                value={form.etd}
                disabled={!editable('etd')}
                hasError={!!errors.etd}
                onChange={(v) => updateField('etd', v)}
              />
              <FieldError message={errors.etd && t.modal[errors.etd]} />
            </div>
            <div>
              <FieldLabel icon={Calendar} required>
                {t.modal.rta}
              </FieldLabel>
              <DateTimeField
                value={form.rta}
                disabled={!editable('rta')}
                hasError={!!errors.rta}
                onChange={(v) => updateField('rta', v)}
              />
              <FieldError message={errors.rta && t.modal[errors.rta]} />
              {showLateWarning && <p className="mt-1 text-xs font-bold text-red-600">{t.modal.lateWarning}</p>}
            </div>
            <div>
              <FieldLabel icon={Calendar}>{t.modal.sta}</FieldLabel>
              <DateTimeField
                value={form.sta}
                disabled={!editable('sta')}
                hasError={!!errors.sta}
                onChange={(v) => updateField('sta', v)}
              />
              <FieldError message={errors.sta && t.modal[errors.sta]} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.modal.staHint}</p>
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.rtaConfirmed}
                  disabled={!editable('rtaConfirmed')}
                  onChange={(e) => updateField('rtaConfirmed', e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#6366f1]"
                />
                {t.modal.rtaConfirmed}
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5" />
              {t.modal.etaLabel}
            </div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              {displayEta ? formatDateTime(displayEta) : <span className="text-xs font-normal text-slate-400">{t.modal.etaAutoHint}</span>}
            </div>
          </div>

          <div>
            <FieldLabel icon={Package} required>
              {t.modal.cargo}
            </FieldLabel>
            <input
              type="text"
              value={form.cargoDescription}
              disabled={!editable('cargoDescription')}
              onChange={(e) => updateField('cargoDescription', e.target.value)}
              placeholder={t.modal.cargoPlaceholder}
              className={inputClassName(!editable('cargoDescription'), !!errors.cargoDescription)}
            />
            <FieldError message={errors.cargoDescription && t.modal[errors.cargoDescription]} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel icon={Package} required>
                {t.modal.cargoTon}
              </FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                value={form.cargoTon ? Number(form.cargoTon).toLocaleString('en-US') : ''}
                disabled={!editable('cargoTon')}
                onChange={(e) => updateField('cargoTon', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="50,000"
                className={inputClassName(!editable('cargoTon'), !!errors.cargoTon)}
              />
              <FieldError message={errors.cargoTon && t.modal[errors.cargoTon]} />
            </div>
            <div>
              <FieldLabel icon={Fuel}>{t.modal.fuelType}</FieldLabel>
              <select
                value={form.fuelType}
                disabled={!editable('fuelType')}
                onChange={(e) => updateField('fuelType', e.target.value as VoyageFormState['fuelType'])}
                className={inputClassName(!editable('fuelType'), false)}
              >
                <option value="HFO">HFO</option>
                <option value="MGO">MGO</option>
                <option value="LNG">LNG</option>
              </select>
            </div>
            <div>
              <FieldLabel icon={Gauge}>{t.modal.planSpeed}</FieldLabel>
              <input
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={form.plannedSpeedKnots}
                disabled={!editable('plannedSpeedKnots')}
                onChange={(e) => updateField('plannedSpeedKnots', e.target.value)}
                className={inputClassName(!editable('plannedSpeedKnots'), !!errors.plannedSpeedKnots)}
              />
              <FieldError message={errors.plannedSpeedKnots && t.modal[errors.plannedSpeedKnots]} />
            </div>
          </div>

          {mode === 'create' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {t.modal.notice}
            </div>
          )}
          {isRestricted && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
              {t.modal.editRestrictedNotice}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {mode === 'create' ? t.modal.cancel : t.modal.close}
          </button>
          {(mode === 'create' || !isReadOnly) && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5]',
                submitting && 'cursor-not-allowed opacity-60',
              )}
            >
              {mode === 'create' ? (submitting ? t.modal.submitting : t.modal.submit) : t.modal.save}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

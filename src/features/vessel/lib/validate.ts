import type { VesselFormState } from './form'

export type VesselFormErrors = Partial<Record<keyof VesselFormState, string>>

// 검증 규칙 14종 — VESSEL.md 6.5장. 9·10번은 같은 필드(currentDraft)를 대상으로 하며
// 10번이 나중에 실행되어 덮어쓴다. 이 모달은 다국어를 쓰지 않으므로 메시지는 한국어 하드코딩이다.
export function validateVesselForm(form: VesselFormState): VesselFormErrors {
  const errors: VesselFormErrors = {}

  if (!form.name.trim()) errors.name = '선박명을 입력해주세요'
  if (!/^\d{7}$/.test(form.imo)) errors.imo = 'IMO 번호 7자리를 입력해주세요'
  if (!form.flag.trim()) errors.flag = '선적국을 입력해주세요'

  const buildYear = Number(form.buildYear)
  if (!form.buildYear || buildYear < 1950) errors.buildYear = '건조년도를 입력해주세요'

  const grossTonnage = Number(form.grossTonnage)
  if (!form.grossTonnage || grossTonnage <= 0) errors.grossTonnage = '총톤수를 입력해주세요'

  const lengthOverall = Number(form.lengthOverall)
  if (!form.lengthOverall || lengthOverall <= 0) errors.lengthOverall = '전장을 입력해주세요'

  const beam = Number(form.beam)
  if (!form.beam || beam <= 0) errors.beam = '선폭을 입력해주세요'

  const maxDraft = Number(form.maxDraft)
  if (!form.maxDraft || maxDraft <= 0) errors.maxDraft = '최대 흘수를 입력해주세요'

  const currentDraft = Number(form.currentDraft)
  if (!form.currentDraft || currentDraft <= 0) errors.currentDraft = '현재 흘수를 입력해주세요'
  if (currentDraft > maxDraft) errors.currentDraft = '현재 흘수는 최대 흘수를 초과할 수 없습니다'

  const enginePower = Number(form.enginePower)
  if (!form.enginePower || enginePower <= 0) errors.enginePower = '엔진 출력을 입력해주세요'

  const foulingFactor = Number(form.foulingFactor)
  if (!form.foulingFactor || foulingFactor < 1) errors.foulingFactor = '노후 계수는 1.00 이상이어야 합니다'

  const designSpeedKnots = Number(form.designSpeedKnots)
  if (!form.designSpeedKnots || designSpeedKnots <= 0) errors.designSpeedKnots = '기준 속도를 입력해주세요'

  const designSpeedFuelTon = Number(form.designSpeedFuelTon)
  if (!form.designSpeedFuelTon || designSpeedFuelTon <= 0) errors.designSpeedFuelTon = '기준 속도 연료소모량을 입력해주세요'

  return errors
}

import type { VoyageFormState } from './form'

// 오류 메시지는 t.modal.* 사전 키를 그대로 가리킨다(이 모달은 SCHEDULE.md 9장에 따라
// 다국어를 지원한다 — VESSEL.md 모달과 달리 한국어 하드코딩이 아니다).
export type VoyageFormErrorKey =
  | 'errVessel'
  | 'errDeparture'
  | 'errArrival'
  | 'errPortSame'
  | 'errEtd'
  | 'errRta'
  | 'errRtaAfterEtd'
  | 'errStaAfterEtd'
  | 'errCargo'
  | 'errCargoTon'
  | 'errSpeed'

export type VoyageFormErrors = Partial<Record<keyof VoyageFormState, VoyageFormErrorKey>>

// 검증 규칙 11종 — SCHEDULE.md 5.11장. "YYYY-MM-DDTHH:mm" 형식 문자열은 사전순 비교가
// 곧 시간순 비교이므로 Date 변환 없이 직접 비교한다.
export function validateVoyageForm(form: VoyageFormState): VoyageFormErrors {
  const errors: VoyageFormErrors = {}

  if (!form.vesselId) errors.vesselId = 'errVessel'
  if (!form.departurePortCode) errors.departurePortCode = 'errDeparture'
  if (!form.arrivalPortCode) errors.arrivalPortCode = 'errArrival'
  if (form.departurePortCode && form.arrivalPortCode && form.departurePortCode === form.arrivalPortCode) {
    errors.arrivalPortCode = 'errPortSame'
  }

  if (!form.etd) errors.etd = 'errEtd'
  if (!form.rta) errors.rta = 'errRta'
  if (form.etd && form.rta && form.etd >= form.rta) errors.rta = 'errRtaAfterEtd'
  if (form.etd && form.sta && form.etd >= form.sta) errors.sta = 'errStaAfterEtd'

  if (!form.cargoDescription.trim()) errors.cargoDescription = 'errCargo'

  const cargoTon = Number(form.cargoTon)
  if (!form.cargoTon || cargoTon <= 0) errors.cargoTon = 'errCargoTon'

  const speed = Number(form.plannedSpeedKnots)
  if (!form.plannedSpeedKnots || speed <= 0) errors.plannedSpeedKnots = 'errSpeed'

  return errors
}

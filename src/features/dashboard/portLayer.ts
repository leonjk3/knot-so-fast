import type { Voyage, Vessel } from '@/shared/types'
import { OWN_COMPANY_NAME } from '@/shared/constants'
import { formatDate, formatDateTime } from '@/shared/utils/format'
import { getPortCode, findPort, formatPortLabel } from '@/mocks/ports'

export interface PortVoyageEntry {
  voyage: Voyage
  vessel: Vessel
}

export interface PortAggregate {
  berthed: PortVoyageEntry[]
  departing: PortVoyageEntry[]
  arriving: PortVoyageEntry[]
}

// DASHBOARD.md 9.6장 — 선박 필터·선택과 무관하게 항상 전체 항차 기준으로 집계한다.
export function aggregateByPort(voyages: Voyage[], vessels: Vessel[]): Map<string, PortAggregate> {
  const result = new Map<string, PortAggregate>()

  function bucket(code: string): PortAggregate {
    let agg = result.get(code)
    if (!agg) {
      agg = { berthed: [], departing: [], arriving: [] }
      result.set(code, agg)
    }
    return agg
  }

  for (const voyage of voyages) {
    if (voyage.status === 'cancelled') continue
    const vessel = vessels.find((v) => v.id === voyage.vesselId)
    if (!vessel) continue

    const entry: PortVoyageEntry = { voyage, vessel }
    const depCode = getPortCode(voyage.departurePort)
    const arrCode = getPortCode(voyage.arrivalPort)

    if (depCode) {
      if (voyage.status === 'preparing') bucket(depCode).berthed.push(entry)
      else if (voyage.status === 'underway' || voyage.status === 'delayed') bucket(depCode).departing.push(entry)
    }
    if (arrCode) {
      if (voyage.status === 'completed') bucket(arrCode).berthed.push(entry)
      else if (voyage.status === 'underway' || voyage.status === 'delayed') bucket(arrCode).arriving.push(entry)
    }
  }

  return result
}

// 30×30px 하늘색 라운드 사각형 + 닻 이모지 + 관련 선박 1척 이상이면 우상단 빨간 배지
export function buildPortMarkerHtml(totalCount: number): string {
  const badge =
    totalCount > 0
      ? `<div style="position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 3px;border-radius:9999px;background:#ef4444;color:#ffffff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;">${totalCount}</div>`
      : ''
  return `<div style="position:relative;width:30px;height:30px;"><div style="width:30px;height:30px;border-radius:8px;background:#0ea5e9;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:15px;">⚓</div>${badge}</div>`
}

function shipRow(entry: PortVoyageEntry, detail: string): string {
  const isOwn = entry.vessel.company === OWN_COMPANY_NAME
  const companyLabel = isOwn
    ? `<span style="color:#6366f1;font-weight:600;">자사 선박</span>`
    : `<span style="color:#64748b;">${entry.vessel.company}</span>`
  return `<div style="padding:3px 0;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;font-weight:600;color:#0f172a;">${entry.vessel.name}</span>${companyLabel}</div><div style="font-size:10px;color:#64748b;">${detail}</div></div>`
}

function berthedDetail(entry: PortVoyageEntry): string {
  return entry.voyage.status === 'preparing' ? `출항 예정: ${formatDateTime(entry.voyage.etd)}` : `ETA: ${formatDateTime(entry.voyage.eta)}`
}

function departingDetail(entry: PortVoyageEntry): string {
  return `목적지: ${entry.voyage.arrivalPort.split(' ')[0]} · ETA ${formatDate(entry.voyage.eta)}`
}

function arrivingDetail(entry: PortVoyageEntry): string {
  return `출발: ${entry.voyage.departurePort.split(' ')[0]} · ETA ${formatDateTime(entry.voyage.eta)}`
}

function portSection(title: string, color: string, entries: PortVoyageEntry[], detailFn: (e: PortVoyageEntry) => string): string {
  if (entries.length === 0) return ''
  return `<div style="margin-top:6px;"><div style="font-size:11px;font-weight:700;color:${color};">${title} (${entries.length})</div>${entries.map((e) => shipRow(e, detailFn(e))).join('')}</div>`
}

// 팝업(폭 220~260px, 최대 높이 240px 스크롤)
export function buildPortPopupHtml(code: string, agg: PortAggregate | undefined): string {
  const port = findPort(code)
  const title = port ? formatPortLabel(port) : code
  const total = agg ? agg.berthed.length + agg.departing.length + agg.arriving.length : 0

  const body =
    total === 0
      ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8;">이 항구에 등록된 선박이 없습니다.</div>`
      : [
          portSection('정박', '#16a34a', agg?.berthed ?? [], berthedDetail),
          portSection('출항', '#f59e0b', agg?.departing ?? [], departingDetail),
          portSection('입항 예정', '#6366f1', agg?.arriving ?? [], arrivingDetail),
        ].join('')

  return [
    `<div style="max-height:240px;overflow-y:auto;">`,
    `<div style="font-size:14px;font-weight:700;color:#0f172a;">${title}</div>`,
    `<div style="font-size:10px;color:#64748b;">${code}</div>`,
    body,
    `</div>`,
  ].join('')
}

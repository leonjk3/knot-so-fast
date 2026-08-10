import type { VoyageStatus } from '@/shared/types'
import type { TyphoonWarning } from '@/mocks/map-overlays'

// DASHBOARD.md 9.10장 — 지도 위 언어 선택기가 바꾸는 것은 앱 전역 언어(사이드바·헤더,
// LanguageContext)가 아니라 지도가 직접 그리는 팝업·툴팁의 표시 언어뿐이다. 그래서 별도
// 사전을 둔다(12장 "지도 팝업 전용 사전(MAP_LABELS)").
export type MapLanguage = 'ko' | 'en' | 'zh' | 'ja'

export interface MapLabels {
  ownFleet: string
  voyage: string
  currentSpeed: string
  eta: string
  status: string
  statusLabel: Record<VoyageStatus, string>
  intensity: string
  typhoonIntensity: Record<TyphoonWarning['intensity'], string>
  maxWind: string
  radius: string
  movingDir: string
  windSpeed: string
  windDir: string
  waveHeight: string
  marineWeather: string
  source: string
  vessel: string
  recommendedSpeed: string
  sendSpeedBtn: string
  sendSpeedSending: string
  sendSpeedSuccessTitle: string
  sendSpeedFailTitle: string
  route: string
  sentAt: string
  target: string
  portBerthed: string
  portDeparting: string
  portArriving: string
  portNoVessels: string
  portEtd: string
  portBoundFor: string
  portFrom: string
}

export interface MapLanguageOption {
  value: MapLanguage
  label: string
  title: string
}

export const MAP_LANGUAGE_OPTIONS: MapLanguageOption[] = [
  { value: 'ko', label: '한국어', title: '지도 위 정보 표시 언어: 한국어' },
  { value: 'en', label: 'English', title: 'Map info display language: English' },
  { value: 'zh', label: '中文', title: '地图信息显示语言：中文' },
  { value: 'ja', label: '日本語', title: '地図上の情報表示言語：日本語' },
]

export const MAP_LABELS: Record<MapLanguage, MapLabels> = {
  ko: {
    ownFleet: '자사 선박',
    voyage: '항차',
    currentSpeed: '현재 속도',
    eta: 'ETA',
    status: '상태',
    statusLabel: { preparing: '준비 중', underway: '운항 중', delayed: '지연', completed: '완료', cancelled: '취소' },
    intensity: '강도',
    typhoonIntensity: { TD: '열대저압부', TS: '열대폭풍', TY: '태풍', STY: '매우 강한 태풍' },
    maxWind: '최대 풍속',
    radius: '반경',
    movingDir: '이동 방향·속도',
    windSpeed: '풍속',
    windDir: '풍향',
    waveHeight: '파고',
    marineWeather: '해상 기상',
    source: '출처',
    vessel: '선박',
    recommendedSpeed: '권장 속도',
    sendSpeedBtn: '제안속도 전송',
    sendSpeedSending: '전송 중...',
    sendSpeedSuccessTitle: '전송 완료',
    sendSpeedFailTitle: '전송 실패',
    route: '항로',
    sentAt: '전송 시각',
    target: '대상',
    portBerthed: '정박',
    portDeparting: '출항',
    portArriving: '입항 예정',
    portNoVessels: '이 항구에 등록된 선박이 없습니다.',
    portEtd: '출항 예정',
    portBoundFor: '목적지',
    portFrom: '출발',
  },
  en: {
    ownFleet: 'Own Fleet',
    voyage: 'Voyage',
    currentSpeed: 'Current Speed',
    eta: 'ETA',
    status: 'Status',
    statusLabel: { preparing: 'Preparing', underway: 'Underway', delayed: 'Delayed', completed: 'Completed', cancelled: 'Cancelled' },
    intensity: 'Intensity',
    typhoonIntensity: { TD: 'Tropical Depression', TS: 'Tropical Storm', TY: 'Typhoon', STY: 'Super Typhoon' },
    maxWind: 'Max Wind',
    radius: 'Radius',
    movingDir: 'Moving Dir. · Speed',
    windSpeed: 'Wind Speed',
    windDir: 'Wind Dir.',
    waveHeight: 'Wave Height',
    marineWeather: 'Marine Weather',
    source: 'Source',
    vessel: 'Vessel',
    recommendedSpeed: 'Rec. Speed',
    sendSpeedBtn: 'Send Speed Recommendation',
    sendSpeedSending: 'Sending...',
    sendSpeedSuccessTitle: 'Sent',
    sendSpeedFailTitle: 'Send Failed',
    route: 'Route',
    sentAt: 'Sent At',
    target: 'Target',
    portBerthed: 'Berthed',
    portDeparting: 'Departing',
    portArriving: 'Arriving',
    portNoVessels: 'No vessels registered at this port.',
    portEtd: 'ETD',
    portBoundFor: 'Bound for',
    portFrom: 'From',
  },
  zh: {
    ownFleet: '自营船舶',
    voyage: '航次',
    currentSpeed: '当前航速',
    eta: '预计到达时间',
    status: '状态',
    statusLabel: { preparing: '准备中', underway: '航行中', delayed: '延误', completed: '已完成', cancelled: '已取消' },
    intensity: '强度',
    typhoonIntensity: { TD: '热带低压', TS: '热带风暴', TY: '台风', STY: '超强台风' },
    maxWind: '最大风速',
    radius: '半径',
    movingDir: '移动方向·速度',
    windSpeed: '风速',
    windDir: '风向',
    waveHeight: '浪高',
    marineWeather: '海上气象',
    source: '来源',
    vessel: '船舶',
    recommendedSpeed: '建议航速',
    sendSpeedBtn: '发送建议航速',
    sendSpeedSending: '发送中...',
    sendSpeedSuccessTitle: '发送成功',
    sendSpeedFailTitle: '发送失败',
    route: '航线',
    sentAt: '发送时间',
    target: '对象',
    portBerthed: '在港',
    portDeparting: '出港',
    portArriving: '预计入港',
    portNoVessels: '该港口暂无登记船舶。',
    portEtd: '预计出港时间',
    portBoundFor: '目的港',
    portFrom: '出发港',
  },
  ja: {
    ownFleet: '自社船',
    voyage: '航海',
    currentSpeed: '現在速度',
    eta: 'ETA',
    status: '状態',
    statusLabel: { preparing: '準備中', underway: '運航中', delayed: '遅延', completed: '完了', cancelled: 'キャンセル' },
    intensity: '強度',
    typhoonIntensity: { TD: '熱帯低気圧', TS: '熱帯暴風', TY: '台風', STY: '非常に強い台風' },
    maxWind: '最大風速',
    radius: '半径',
    movingDir: '進行方向・速度',
    windSpeed: '風速',
    windDir: '風向',
    waveHeight: '波高',
    marineWeather: '海上気象',
    source: '出典',
    vessel: '船舶',
    recommendedSpeed: '推奨速度',
    sendSpeedBtn: '推奨速度を送信',
    sendSpeedSending: '送信中...',
    sendSpeedSuccessTitle: '送信完了',
    sendSpeedFailTitle: '送信失敗',
    route: '航路',
    sentAt: '送信時刻',
    target: '対象',
    portBerthed: '停泊',
    portDeparting: '出港',
    portArriving: '入港予定',
    portNoVessels: 'この港に登録された船舶はありません。',
    portEtd: '出港予定',
    portBoundFor: '目的地',
    portFrom: '出発地',
  },
}

export function getMapLabels(lang: MapLanguage): MapLabels {
  return MAP_LABELS[lang]
}

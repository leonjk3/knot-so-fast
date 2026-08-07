// DASHBOARD.md 9.9장 — 리스트·게이지 카드 등 외부에서 지도를 특정 위치로 이동시키는 인터페이스.
export interface MapFocusTarget {
  lat: number
  lng: number
  zoom: number
  // 매 호출마다 증가한다 — 같은 좌표를 다시 클릭해도 effect가 재실행되도록 하기 위함
  token: number
  // 이동 후 이 마커의 팝업을 자동으로 연다
  marker?: { kind: 'issue' | 'port'; id: string }
  // true면 setView(줌 델타가 큰 이동), false/미지정이면 flyTo
  direct?: boolean
}

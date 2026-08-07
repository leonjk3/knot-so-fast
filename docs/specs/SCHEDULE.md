
# 물류 일정 관리 — 단독 기능 명세서 (Logistics Schedule / Voyage Management)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "물류 일정 관리" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 원본 프로젝트의 다른 화면(대시보드·선박 관리·AI 운항 리포팅·탄소 배출 등)에 의존하지 않고 물류 일정 관리만 별도로 구현하는 것을 전제로 작성되었습니다. 다만 두 가지 연동이 존재하며 각각 선택 구현으로 분리해 두었습니다 — ① 대시보드 "이번 주 일정" 카드에서 캘린더로 넘어오는 딥링크(8장), ② 목록의 "준수 확률" 열이 AI 운항 리포팅과 동일한 계산을 재사용하는 부분(6.1장).

해커톤 원칙: 17장, 910장은 화면이 100% 정상 동작하기 위한 Must 항목입니다. 8장(딥링크)과 11장(엣지 케이스)은 시간이 남을 때만 구현해도 됩니다. 특히 6.1장의 준수 확률 계산은 분량이 크므로, 시간이 부족하면 해당 열을 통째로 생략하고 나머지를 완성하는 편이 낫습니다.



## 목차
개요
접근 권한
데이터 모델
화면 구성
항차 등록·조회 모달
핵심 계산 로직
상태별 편집 정책
외부 딥링크 연동 (선택)
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
선사가 운영 중인 항차(Voyage) 를 등록·조회·수정하고, 전체 항차의 진행 상황을 목록과 캘린더 두 가지 뷰로 파악하는 화면이다. 항차 등록 시 출발항·도착항의 실해상 항로 실거리를 조회해 ETA를 자동 역산하고, 이미 출발한 항차는 운항 상태에 따라 수정 가능한 항목을 제한한다.

### 1.2 핵심 개념
항차(Voyage): 선박 1척이 출발항에서 도착항까지 화물을 운송하는 1회 운항 단위. 이 화면의 유일한 주 엔티티다.

ETD / ETA / STA / RTA — 이 화면에서 가장 혼동하기 쉬운 4개 시각. 반드시 구분해서 구현한다.


| 약어 | 정식 명칭 | 성격 | 이 화면에서의 취급 |
| --- | --- | --- | --- |
| ETD | Estimated Time of Departure | 출발 예정 시각 | 사용자 입력(필수) |
| ETA | Estimated Time of Arrival | 도착 예상 시각 | 자동 계산(입력 불가) — ETD + 실거리 ÷ 계획속도 |
| STA | Scheduled Time of Arrival | 선사가 잡은 예정 도착일 | 사용자 입력(선택) — 비우면 RTA와 동일 |
| RTA | Required Time of Arrival | 화주/관제소가 요구한 도착 마감 | 사용자 입력(필수) |


RTA 확정 여부(rtaConfirmed): 화주와 RTA가 확정되었는지를 나타내는 boolean. 미확정이면 모든 마감 기준 계산이 RTA 대신 STA를 사용한다. 목록의 "준수 확률" 열도 이 값에 따라 RTA 92% / STA 100% 처럼 접두 라벨과 색상 계열이 함께 바뀐다.

항차 상태(5종): preparing(준비 중) · underway(운항 중) · delayed(지연) · completed(완료) · cancelled(취소). 상태는 화면에서 직접 바꿀 수 없고, 등록 시 항상 preparing으로 고정된다.

두 가지 뷰: 목록(테이블) / 캘린더(월간 그리드). 검색·상태 필터 결과는 두 뷰에 동일하게 반영된다.



## 2. 접근 권한
RBAC가 있는 시스템이라면 ADMIN, LOGISTICS(물류 담당자) 역할만 접근 가능하도록 사이드바/라우팅에 노출한다. CAPTAIN(선장·선원), CLIENT(화주)에는 노출하지 않는다.
별도 프론트 전용 데모 앱으로 만든다면(백엔드 인증 없이) 이 제약은 생략해도 무방하다.



## 3. 데이터 모델

### 3.1 타입 정의
type VoyageStatus = 'preparing' | 'underway' | 'delayed' | 'completed' | 'cancelled'
type FuelType = 'HFO' | 'MGO' | 'LNG'

interface Waypoint { lat: number; lng: number; name?: string }

interface Voyage {
  id: string
  vesselId: string
  cargoDescription: string      // 화물 내용 (자유 텍스트)
  departurePort: string          // "부산 (Busan)" 형태 — 한글명 + 괄호 안 영문명
  arrivalPort: string
  etd: string                    // ISO 8601 — 출발 예정
  sta: string                    // ISO 8601 — 선사 예정 도착
  rta: string                    // ISO 8601 — 요구 도착 마감
  rtaConfirmed: boolean          // false면 마감 기준을 RTA 대신 STA로 사용
  eta: string                    // ISO 8601 — 자동 계산된 도착 예상
  status: VoyageStatus
  plannedRoute: Waypoint[]       // 항로 좌표 배열(지도·진행률 계산용)
  actualRoute: Waypoint[]        // 실제 항적(이 화면에서는 보존만 하고 쓰지 않음)
  plannedSpeedKnots: number
  recommendedSpeedKnots: number  // AI 권장 속도(이 화면에서는 표시만)
  fuelType: FuelType
  cargoTon: number
  distanceNm: number             // 항로 실거리(해리)
}

// 목록의 선박명·IMO 표시와 등록 모달의 선박 선택에만 사용하는 최소 필드
interface Vessel {
  id: string
  name: string
  imo: string
  type: 'container' | 'bulk' | 'tanker' | 'roro'
  status: 'active' | 'maintenance' | 'idle'
  // fuelCurve 등 나머지 선박 스펙은 이 화면에서 쓰이지 않음 (준수 확률 열을 구현할 때만 fuelCurve 필요)
}

// 항구 사전 — 등록 모달의 출발/도착 선택 목록과 항구 코드 추출에 사용
interface Port {
  code: string     // 3자리 코드, 예: 'PUS'
  name: string     // 한글명, 예: '부산'
  nameEn: string   // 영문명, 예: 'Busan'
  lat: number
  lng: number
}

### 3.2 재현용 샘플 데이터 — 항구 사전 (30곳, 그대로 사용 권장)
formatPortLabel(port) = `${port.name} (${port.nameEn})` — 이 형식이 Voyage.departurePort 문자열의 표준이다.


| code | name | nameEn | lat | lng |
| --- | --- | --- | --- | --- |
| PUS | 부산 | Busan | 35.10 | 129.04 |
| ULS | 울산 | Ulsan | 35.50 | 129.30 |
| GGY | 광양 | Gwangyang | 34.90 | 127.70 |
| INC | 인천 | Incheon | 37.45 | 126.60 |
| SHA | 상하이 | Shanghai | 31.20 | 121.50 |
| HKG | 홍콩 | Hong Kong | 22.30 | 114.20 |
| SIN | 싱가포르 | Singapore | 1.30 | 103.80 |
| KHH | 가오슝 | Kaohsiung | 22.60 | 120.30 |
| TYO | 도쿄 | Tokyo | 35.60 | 139.80 |
| YOK | 요코하마 | Yokohama | 35.45 | 139.65 |
| MNL | 마닐라 | Manila | 14.60 | 120.95 |
| PHE | 포트헤들랜드 | Port Hedland | -20.30 | 118.60 |
| RTN | 라스 타누라 | Ras Tanura | 26.60 | 50.20 |
| DXB | 두바이 | Dubai | 25.00 | 55.06 |
| RTM | 로테르담 | Rotterdam | 51.90 | 4.50 |
| ANT | 앤트워프 | Antwerp | 51.26 | 4.40 |
| HAM | 함부르크 | Hamburg | 53.50 | 9.90 |
| FEL | 펠릭스토 | Felixstowe | 51.96 | 1.35 |
| PIR | 피레우스 | Piraeus | 37.94 | 23.63 |
| BCN | 바르셀로나 | Barcelona | 41.35 | 2.17 |
| LAX | 로스앤젤레스 | Los Angeles | 33.70 | -118.20 |
| LGB | 롱비치 | Long Beach | 33.75 | -118.19 |
| OAK | 오클랜드(미) | Oakland | 37.80 | -122.30 |
| SEA | 시애틀 | Seattle | 47.60 | -122.34 |
| VAN | 밴쿠버 | Vancouver | 49.29 | -123.11 |
| NYC | 뉴욕 | New York | 40.70 | -74.00 |
| SAV | 서배너 | Savannah | 32.08 | -81.09 |
| AKL | 오클랜드 | Auckland | -36.80 | 174.80 |
| SYD | 시드니 | Sydney | -33.85 | 151.21 |
| MEL | 멜버른 | Melbourne | -37.84 | 144.93 |


### 3.3 재현용 샘플 데이터 — 선박 5척

| id | name | imo | type | status |
| --- | --- | --- | --- | --- |
| v001 | KSF PIONEER | 9876543 | container | active |
| v002 | KSF NAVIGATOR | 9765432 | container | active |
| v003 | KSF VENTURE | 9654321 | bulk | active |
| v004 | KSF HORIZON | 9543210 | tanker | active |
| v005 | KSF ASPIRE | 9432109 | container | maintenance |


v005가 maintenance인 것은 의도된 설정이다 — 5.3장의 "정비 중 선박 제외" 규칙이 화면에서 실제로 눈에 보이게 하기 위한 샘플이다.

### 3.4 재현용 샘플 데이터 — 항차 8건
plannedRoute / actualRoute 좌표 배열은 이 화면에서 렌더링에 쓰이지 않으므로 빈 배열 []로 두어도 무방하다(준수 확률 열을 구현할 때만 plannedRoute가 필요하며, 그마저도 없으면 distanceNm으로 폴백된다).


| id | vesselId | 출발 → 도착 | etd | sta | rta | rtaConf | eta | status | 계획/권장 속도 | fuel | cargoTon | distanceNm | 화물 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| voy001 | v001 | 부산 → 로테르담 | 2026-07-10T08:00Z | 2026-08-02T06:00Z | 2026-08-01T18:00Z | false | 2026-08-01T14:30Z | underway | 16.0 / 13.5 | HFO | 62,400 | 11,200 | 전자제품, 자동차 부품 |
| voy002 | v002 | 상하이 → 로스앤젤레스 | 2026-07-15T10:00Z | 2026-08-05T02:00Z | 2026-08-05T06:00Z | true | 2026-08-06T09:00Z | delayed | 17.0 / 14.0 | MGO | 54,200 | 5,600 | 소비재, 섬유류 |
| voy003 | v003 | 포트헤들랜드 → 광양 | 2026-07-18T06:00Z | 2026-08-02T09:00Z | 2026-08-02T12:00Z | true | 2026-08-01T16:00Z | underway | 13.0 / 12.5 | HFO | 178,000 | 4,200 | 철광석 |
| voy004 | v004 | 라스 타누라 → 울산 | 2026-07-12T14:00Z | 2026-07-28T05:00Z | 2026-07-28T08:00Z | true | 2026-07-27T20:00Z | underway | 14.5 / 13.0 | HFO | 256,000 | 5,800 | 원유 |
| voy005 | v001 | 함부르크 → 부산 | 2026-08-10T09:00Z | 2026-09-02T18:00Z | 2026-09-02T18:00Z | true | 2026-09-01T10:00Z | preparing | 15.5 / 14.0 | MGO | 47,800 | 11,400 | 기계류, 산업장비 |
| voy006 | v002 | 오클랜드 → 부산 | 2026-06-20T06:00Z | 2026-07-15T18:00Z | 2026-07-15T18:00Z | true | 2026-07-14T12:00Z | completed | 16.0 / 15.0 | MGO | 38,900 | 5,200 | 냉동식품, 농산물 |
| voy007 | v001 | 부산 → 로테르담 | 2026-05-02T08:00Z | 2026-05-24T14:00Z | 2026-05-24T18:00Z | true | 2026-05-24T09:00Z | completed | 15.5 / 14.0 | HFO | 59,800 | 11,200 | 전자제품, 자동차 부품 |
| voy008 | v002 | 상하이 → 로스앤젤레스 | 2026-04-10T10:00Z | 2026-04-27T02:00Z | 2026-04-27T06:00Z | true | 2026-04-26T22:00Z | completed | 16.5 / 14.5 | MGO | 51,200 | 5,600 | 소비재, 섬유류 |


샘플 설계 의도: voy001만 rtaConfirmed: false라서 목록에서 유일하게 STA 라벨(파란색)로 표시되고, voy002만 delayed라서 ETA가 빨간색으로 표시된다. 상태 5종 중 4종(preparing/underway/delayed/completed)이 모두 등장하도록 구성되어 있으므로 그대로 사용하는 것을 강력히 권장한다.

### 3.5 데이터 소스 (둘 중 택1)

| 방식 | 구현 | 권장 상황 |
| --- | --- | --- |
| A. 정적 데이터 | 위 샘플을 모듈 상수로 두고 useState로 관리. 등록·수정은 배열을 갱신 | 해커톤 기본값 — DB·네트워크 의존이 없어 가장 빠르고 안전 |
| B. REST + SWR | useSWR('/api/voyages', fetcher) → 서버가 DB 조회 | 백엔드까지 보여줘야 할 때 |


방식 B를 택하는 경우의 API 계약은 아래가 전부다. 응답·요청 바디는 모두 Voyage(또는 그 배열) 그대로다.


| 메서드 | 경로 | 용도 | 응답 |
| --- | --- | --- | --- |
| GET | /api/voyages | 전체 항차 조회 | Voyage[] |
| POST | /api/voyages | 항차 등록 | Voyage (201) |
| PATCH | /api/voyages/{id} | 항차 수정 | Voyage |
| GET | /api/vessels | 선박 목록(선택 드롭다운·목록 선박명용) | Vessel[] |


등록·수정 후에는 반드시 목록을 재검증(mutate())해 화면에 즉시 반영한다.



## 4. 화면 구성
전체 페이지는 세로 flex 레이아웃(flex flex-col h-full)이며, 위에서부터 ① 페이지 헤더 → ② 뷰 탭 + 검색·필터 바 → ③ 콘텐츠(목록 또는 캘린더) 3단 구조다. ③만 스크롤되고 ①②는 고정된다(shrink-0). 모든 색은 라이트·다크 모드를 함께 정의한다.

### 4.1 페이지 헤더
높이 64px(h-16) 고정, 좌우 패딩 24px, 하단 보더, 배경 bg-white(다크 bg-slate-900).
좌측: 타이틀 "물류 일정 관리"(볼드, 16px) + 가운뎃점 구분자 + 부제 "항차 일정 등록 및 현황 관리" (회색, 14px, 640px 미만에서 숨김).
우측: "항차 등록" 버튼 — 인디고 배경(#6366f1, hover #4f46e5), 흰 텍스트, rounded-lg, px-4 py-2, Plus 아이콘 + 라벨. 클릭 시 5장 모달을 create 모드로 연다.

### 4.2 뷰 탭 + 검색·필터 바
헤더 바로 아래 px-6 py-3 블록. 배경 흰색(다크 slate-900), 하단 보더.

① 뷰 탭 (상단) — 밑줄형 탭 2개, 하단 보더를 좌우 패딩 밖까지 늘림(-mx-6 px-6):


| 탭 | 아이콘 | 라벨 |
| --- | --- | --- |
| list | List | 목록 |
| calendar | CalendarRange | 캘린더 |


선택된 탭은 border-b-2 border-[#6366f1] text-[#6366f1], 비선택은 border-transparent text-slate-500 (hover 시 text-slate-700). 탭 자체를 -mb-px로 올려 하단 보더와 겹치게 한다.

② 검색 + 상태 필터 (하단) — 좁은 화면은 세로(flex-col), 640px 이상은 가로(sm:flex-row), 간격 12px:

검색 입력: flex-1로 남는 폭 전체 차지. 왼쪽 안쪽에 Search 아이콘(회색, 절대 위치), 좌측 패딩 36px. placeholder "항구명, 선박명 검색". 포커스 시 인디고 2px 링.

상태 필터 세그먼트: 회색 배경(bg-slate-100, 다크 slate-800) 안에 알약 버튼 5개(p-1, gap-1). 각 버튼은 라벨 (건수) 형태이며 건수는 opacity-60으로 흐리게. 선택된 버튼만 흰 배경 + 그림자.


| 순서 | value | 라벨 | 건수 계산 |
| --- | --- | --- | --- |
| 1 | all | 전체 | 전체 항차 수 |
| 2 | underway | 운항 중 | 해당 상태 항차 수 |
| 3 | delayed | 지연 | 〃 |
| 4 | preparing | 준비 중 | 〃 |
| 5 | completed | 완료 | 〃 |


cancelled(취소)는 탭에 노출하지 않는다. 데이터에는 존재할 수 있고 "전체"에는 포함되지만 전용 탭은 없다.

### 4.3 목록 뷰 (테이블)
바깥 컨테이너: 흰 카드(rounded-xl, 얇은 테두리, overflow-hidden, min-h-full). 내부는 overflow-x-auto로 감싸 좁은 화면에서 가로 스크롤만 생기게 하고 페이지 자체는 가로로 늘어나지 않게 한다.

헤더 행: 배경 bg-slate-50(다크 slate-800/60), 하단 보더, 셀은 text-xs font-semibold text-slate-500, 좌측 정렬, px-4 py-3. 본문 행 사이는 divide-y, hover 시 배경 slate-50(다크 slate-800/40).

열 구성 (총 9열)


| # | 헤더 | 내용 |
| --- | --- | --- |
| 1 | 선박 | 28×28px 회색 라운드 박스 안 Ship 아이콘 + 우측에 선박명(font-medium) / IMO(12px 회색) 2줄. 선박을 못 찾으면 이름은 - |
| 2 | 출발 → 도착 | MapPin(12px 회색) + 출발항 첫 토큰 + 회색 → + 도착항 첫 토큰. 그 아래 줄에 화물 내용(12px 회색, truncate max-w-40) |
| 3 | ETD | CalendarDays 아이콘 + formatDateTime(etd) (12px 회색) |
| 4 | ETA / RTA | 1행 ETA {포맷} — 지연 상태면 빨강(text-red-600), 아니면 slate-700. 2행 RTA {포맷}(12px 회색) — rtaConfirmed면 굵게 + 진한 회색으로 강조하고 뒤에 초록색 "(확정)" 태그 |
| 5 | 준수 확률 | 6.1장 참조. 앞에 10px 회색 RTA/STA 접두 라벨 + 퍼센트(12px, semibold, 규칙별 색). 계산 불가면 회색 — |
| 6 | 거리 | distanceNm > 0이면 formatNm()(천단위 콤마 + nm), 아니면 — |
| 7 | 권장속도 | Fuel 아이콘(초록) + 권장속도 {n} kts(초록 font-medium) + 그 뒤에 계획속도를 취소선 회색으로 |
| 8 | 상태 | VoyageBadge — 알약 배지(10장 색상표) |
| 9 | (빈 헤더) | ChevronRight 아이콘 버튼 → 클릭 시 5장 모달을 view 모드로 연다 |


빈 상태: 필터 결과가 0건이면 colSpan={9} 셀 하나에 가운데 정렬로 "검색 결과가 없습니다." (회색, 14px, py-12).

### 4.4 캘린더 뷰
흰 카드(rounded-xl, 테두리, p-4) 안에 월간 그리드.

① 상단 바 (좌우 배치)

좌측: ChevronLeft 버튼 — YYYY.MM(예: 2026.08, 14px semibold, 고정폭 112px 가운데 정렬) — ChevronRight 버튼. 버튼은 28×28px 라운드, hover 시 회색 배경.
우측: "오늘" 버튼(12px, 테두리 있는 아웃라인, px-3 py-1) — 누르면 이번 달 1일로 커서 이동.

② 요일 헤더 — 7열 그리드, 가운데 정렬, 12px semibold 회색. 라벨은 ['일','월','화','수','목','금','토'] (영문 모드는 ['Sun',...,'Sat']). 일요일 시작 고정.

③ 날짜 그리드

항상 42칸(6주 × 7일) 고정. 그리드 시작일 = 해당 월 1일 - 그 날의 getDay().
칸 사이는 gap-px + 컨테이너 배경 회색으로 1px 구분선 효과. 전체를 rounded-lg overflow-hidden.
각 칸: 흰 배경(다크 slate-900), 최소 높이 92px, p-1, 세로 flex(gap-0.5).
날짜 숫자(12px, px-1):
이번 달이 아니면 text-slate-300(다크 slate-700)로 흐리게
오늘이면 20×20px 인디고 원형 배경 + 흰 글씨 + semibold
그 외 text-slate-600
포커스 표시: 딥링크로 넘어온 날짜(8장)는 칸 전체에 인디고 2px 안쪽 링 (ring-2 ring-inset ring-[#6366f1]).

④ 이벤트 마커

항차 1건당 최대 2개의 마커가 생긴다 — etd 날짜에 departure, rta 날짜에 arrival.

왜 기간 막대가 아니라 점 마커인가: 운항 기간을 가로 막대로 그리면 항차 수·기간이 늘수록 칸 높이가 계속 늘어나 레이아웃이 무너진다. 출발일·도착일에만 점을 찍어 칸 높이를 항상 일정하게 유지한다.

각 마커 버튼:

내용: 방향 아이콘 + 선박명(출발코드-도착코드). 예: KSF PIONEER(PUS-RTM). 괄호 부분은 opacity-70. 항구 코드를 못 찾으면(6.4장) 괄호 전체를 생략한다.

아이콘: 출발 = ArrowUpRight, 도착 = ArrowDownLeft (각 10px, shrink-0).

색: 항차 상태별 색을 글자색으로, 같은 색 + 투명도 20(16진 접미사)을 배경색으로 인라인 스타일 지정.


| status | 색상 |
| --- | --- |
| underway | #3b82f6 |
| delayed | #ef4444 |
| preparing | #94a3b8 |
| completed | #22c55e |
| cancelled | #64748b |


이 팔레트는 대시보드 지도 마커(MapView)와 동일한 값이다. 지도·캘린더 색을 통일하기 위한 것이니 두 화면을 함께 만든다면 상수를 공유한다.

크기: 10px 글씨, rounded px-1 py-0.5, truncate, hover 시 opacity-75.

title 속성(툴팁): `${출발|도착} · ${선박명}(${코드쌍})`

클릭 시 해당 항차의 상세 모달을 view 모드로 연다.

⑤ 넘침 처리: 하루 마커가 3개를 초과하면 앞 3개만 보이고, 그 아래 10px 회색 글씨로 "+N건 더보기"(영문 +N more)를 표시한다. 이 텍스트는 클릭 동작이 없다(표시 전용).



## 5. 항차 등록·조회 모달
등록(create)과 조회·수정(view)이 같은 컴포넌트이며 mode prop으로만 갈린다. 별도의 "수정" 버튼이나 모드 전환이 없고, 모달을 여는 즉시 항차 상태에 따라 각 필드의 활성/비활성이 결정된다(7장).

### 5.1 모달 셸
오버레이: fixed inset-0 z-50, 반투명 검정(bg-black/50) + backdrop-blur-sm, p-4, 가운데 정렬. 오버레이 자신을 직접 클릭했을 때만 닫는다(e.target === e.currentTarget — 내부 클릭이 버블링돼 닫히는 것 방지).

패널: 최대 폭 max-w-3xl, 흰 배경(다크 slate-900), rounded-2xl shadow-2xl, 세로 flex, 최대 높이 90vh(본문만 스크롤).

헤더(px-6 py-4, 하단 보더): 32×32px 회색 라운드 박스 안 Ship 아이콘(인디고) + 제목/부제 2줄 + 우측 X 닫기 버튼.


| mode | 제목 | 부제 |
| --- | --- | --- |
| create | 항차 등록 | 새 운항 항차를 등록합니다 |
| view | 항차 상세 | 등록된 항차의 세부 내역입니다 |


본문(flex-1 overflow-y-auto px-6 py-5 space-y-5): 아래 5.3~5.9 필드 블록들.

푸터(px-6 py-4, 상단 보더, 우측 정렬, gap-3):


| mode | 버튼 |
| --- | --- |
| create | 취소(고스트) + 항차 등록(인디고, 제출 중이면 등록 중... + 비활성) |
| view | 닫기(고스트) + (수정 가능할 때만) 저장(인디고) |


### 5.2 공통 입력 스타일
모든 input/select는 동일 클래스를 공유한다: w-full px-3 py-2 rounded-lg border text-sm, 흰 배경(다크 slate-800), 포커스 시 인디고 2px 링, 비활성 시 opacity-60 cursor-not-allowed + 회색 배경. 해당 필드에 검증 오류가 있으면 테두리만 빨강(border-red-400)으로 바뀐다.

라벨은 공통적으로 flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5 + 14px 아이콘, 필수 항목은 뒤에 빨간 *. 오류 메시지는 필드 아래 12px 빨강.

### 5.3 선박 선택 필드
라벨: Ship 아이콘 + "선박 선택" + *
<select> — 첫 옵션은 placeholder "선박을 선택하세요"(value '').
옵션 문구: `${name} — IMO ${imo} (${선종라벨})` 예: KSF PIONEER — IMO 9876543 (컨테이너)
정비 중 선박 제외: status === 'maintenance'인 선박은 목록에서 뺀다. 단, 현재 선택된 선박이라면 남긴다 — 이미 그 선박으로 등록된 기존 항차를 조회할 때 선택값이 사라지는 것을 막기 위함이다.
선종 라벨은 t.modal.container/bulk/tanker/roro = 컨테이너 / 벌크 / 탱커 / 로로 (선박 관리 화면의 "컨테이너선"과 달리 "선" 접미사가 없다 — 원본 그대로다).

### 5.4 출발항 / 도착항 (2열 그리드)
각각 MapPin 아이콘 + 라벨("출발항" / "도착항") + *
placeholder 옵션: "출발항을 선택하세요" / "도착항을 선택하세요"
옵션 목록은 3.2장 항구 30곳 전체, 표시 문구는 formatPortLabel = 부산 (Busan). value는 항구 코드(PUS).

### 5.5 ETD / RTA / STA (3열 그리드)
세 필드 모두 동일한 커스텀 날짜·시각 위젯을 쓴다(5.6). 라벨은 각각 Calendar 아이콘 +


| 필드 | 라벨 | 필수 | 부가 요소 |
| --- | --- | --- | --- |
| etd | 출발 예정일시 (ETD) | ✅ | — |
| rta | 도착 요구일시 (RTA) | ✅ | 지각 경고(5.8) |
| sta | 선사 예정 도착일시 (STA) | ❌ | 힌트 문구 + RTA 확정 체크박스 |


STA 힌트(12px 회색): "선택 입력 — 비워두면 RTA와 동일. RTA 미확정 시 기준일시로 사용됩니다."

STA 칸 아래에 체크박스 "화주 RTA 확정됨"(12px, 인디고 체크박스) — rtaConfirmed에 바인딩.

### 5.6 커스텀 날짜·시각 위젯
왜 <input type="datetime-local">을 쓰지 않는가: 네이티브 위젯의 오전/오후 표시 순서는 OS·브라우저가 정하며 웹에서 제어할 수 없다. 한국어 UI인데 PM/AM 순으로 나오거나 순서가 뒤집히는 문제가 있어, 날짜 + 시(12h) + 분 + 오전/오후를 직접 조합해 순서를 고정한다.

레이아웃(좁은 3열 그리드에 맞춘 2행 구성):

[  날짜 (input type="date", 폭 100%)  ]
[시▼][분▼][   오전/오후 ▼   ]

시: 1~12 (12시간제), 폭 44px
분: 00~59 (2자리 0채움, 60개 전체), 폭 44px
오전/오후: "오전"을 먼저 나열(브라우저 기본 순서에 의존하지 않음). flex-1 min-w-[56px], 가운데 정렬, appearance-none으로 네이티브 화살표 제거 — 좁은 폭에서 화살표가 텍스트를 밀어내 선택값이 안 보이는 문제 때문이다.

상태 ↔ 표시 변환

splitLocalDateTime(local)   # "2026-08-10T14:30" → {date, hour12, minute, ampm}
  값이 비어 있으면 기본값 { date: '', hour12: '9', minute: '00', ampm: 'AM' }
  h24 = Number(시)
  ampm   = h24 >= 12 ? 'PM' : 'AM'
  hour12 = (h24 % 12 === 0) ? 12 : h24 % 12        # 0시·12시를 12로

joinLocalDateTime(date, hour12, minute, ampm)  # → "YYYY-MM-DDTHH:mm"
  d   = date || 오늘 날짜(YYYY-MM-DD)            # ★ 아래 주의 참고
  h24 = (Number(hour12) % 12) + (ampm === 'PM' ? 12 : 0)
  return `${d}T${pad2(h24)}:${pad2(minute)}`

주의(놓치기 쉬움): 사용자가 날짜를 고르기 전에 시·분·오전오후를 먼저 바꿀 수 있다. 이때 날짜가 비었다고 ''를 반환해버리면 그 선택이 조용히 버려져 화면에도 반영되지 않는다. 날짜 미선택 시 오늘 날짜를 기본값으로 채워 항상 완전한 값을 저장한다.

ISO ↔ 로컬 변환

toIso(local)     = local ? new Date(local).toISOString() : ''
isoToLocal(iso)  = Date의 로컬 getter(getFullYear/getMonth/...)로 "YYYY-MM-DDTHH:mm" 재구성

주의(놓치기 쉬움): isoToLocal을 iso.slice(0,16)으로 구현하면 안 된다. UTC 문자열을 그대로 자르면 브라우저 로컬 타임존 변환이 일어나지 않아, 목록 화면(formatDateTime → toLocaleString)과 모달의 시·분이 어긋난다. 반드시 Date의 로컬 getter로 재구성한다.

### 5.7 ETA 표시 줄 (읽기 전용)
날짜 3열 그리드 바로 아래, 회색 배경 박스(rounded-lg bg-slate-50, 테두리, px-4 py-2.5)에 좌우 배치:

좌: Calendar 아이콘 + "예상 도착 (ETA)"(12px semibold 회색)
우: 계산된 ETA를 formatDateTime으로(14px font-medium). 계산 불가 시:
view 모드면 저장된 voyage.eta를 표시
그것도 없으면 힌트 "출발항·도착항·ETD·속도 입력 시 자동 계산"

계산 조건과 공식은 6.2장 참조.

### 5.8 지각 경고
RTA 필드 아래에 조건부로 12px 빨강 굵은 글씨:

"현재 계획 속도로는 RTA까지 도착하기 어렵습니다. 속도를 높이거나 출발을 앞당기세요."

조건: 계산된 ETA와 현재 RTA가 모두 있고 RTA < ETA 일 때. 여기서 "현재 ETA/RTA"는 편집 가능한 상태면 폼 입력값 기준, 조회 전용이면 저장된 voyage.eta / voyage.rta 기준이다.

### 5.9 화물·연료·속도 필드
화물 내용(단독 행): Package 아이콘 + "화물 내용" + *, 텍스트 입력, placeholder "예: 전자제품, 자동차 부품"

3열 그리드:


| 필드 | 라벨 | 입력 형태 |
| --- | --- | --- |
| cargoTon | 화물량 (ton) * | type="text" inputMode="numeric". 입력은 숫자만 남기고(replace(/[^0-9]/g,'')), 표시는 천단위 콤마(en-US 로케일). placeholder 50,000 |
| fuelType | 연료 종류 | select — HFO / MGO / LNG |
| plannedSpeedKnots | 계획 속도 (kts) | type="number" min=1 max=30 step=0.5, 기본값 14 |


### 5.10 안내 배너 (조건부)
create 모드: 회색 박스(bg-slate-50, 테두리, px-4 py-3)에 12px 회색 문구 — "등록 후 상태는 준비 중으로 설정됩니다. AI 에코스피드 권장 속도와 실제 항로는 운항 시작 후 자동 계산됩니다."
부분 수정 제한 상태(운항 중·지연): 호박색 박스(bg-amber-50, border-amber-200)에 12px 호박색 문구 — "운항이 이미 시작된 항차는 STA(선사 예정 도착)와 계획 속도만 수정할 수 있습니다."

### 5.11 검증 규칙 (제출 시 일괄 실행)
순서대로 검사하고, 하나라도 걸리면 제출을 중단한 뒤 각 필드 아래에 메시지를 표시한다.


| # | 조건 | 대상 필드 | 메시지 |
| --- | --- | --- | --- |
| 1 | 선박 미선택 | vesselId | 선박을 선택해주세요 |
| 2 | 출발항 미선택 | departurePortCode | 출발항을 선택해주세요 |
| 3 | 도착항 미선택 | arrivalPortCode | 도착항을 선택해주세요 |
| 4 | 출발항 == 도착항 | arrivalPortCode | 출발항과 도착항은 서로 달라야 합니다 |
| 5 | ETD 미입력 | etd | ETD를 입력해주세요 |
| 6 | RTA 미입력 | rta | RTA를 입력해주세요 |
| 7 | etd >= rta (문자열 비교) | rta | RTA는 ETD 이후여야 합니다 |
| 8 | etd >= sta (STA 입력된 경우만) | sta | STA는 ETD 이후여야 합니다 |
| 9 | 화물 내용 공백 | cargoDescription | 화물 내용을 입력해주세요 |
| 10 | 화물량 미입력 또는 ≤ 0 | cargoTon | 화물량을 입력해주세요 |
| 11 | 계획 속도 미입력 또는 ≤ 0 | plannedSpeedKnots | 계획 속도를 입력해주세요 |


7·8번은 "YYYY-MM-DDTHH:mm" 형식 문자열끼리 직접 비교한다 — 이 형식은 사전순 비교가 곧 시간순 비교이므로 Date 변환 없이 안전하다.

필드를 다시 편집하면 해당 필드의 오류만 즉시 지운다(전체 재검증이 아니라 개별 초기화).

### 5.12 제출 처리
handleSubmit():
  if (!validate()) return
  submitting = true
  isEditing = (mode === 'view' && voyage 존재)

  depPort = findPort(출발코드);  arrPort = findPort(도착코드)
  route   = await resolvePortPairRoute(depPort.code, arrPort.code)     # 6.3장
  distanceNm = route?.distanceNm ?? (isEditing ? 기존 distanceNm : 0)

  etdIso = toIso(etd);  rtaIso = toIso(rta)
  etaIso = distanceNm > 0
             ? etdIso + (distanceNm / 속도) 시간                        # 실거리 확보 시 역산
             : rtaIso                                                   # 미확보 시 RTA로 대체

  결과 Voyage = {
    id:            isEditing ? 기존 id : `voy${Date.now()}`
    departurePort: formatPortLabel(depPort)      # "부산 (Busan)"
    arrivalPort:   formatPortLabel(arrPort)
    sta:           STA 입력값이 있으면 그 ISO, 없으면 rtaIso            # ★ 빈 STA는 RTA로 대체
    eta:           etaIso
    status:        isEditing ? 기존 status : 'preparing'                # ★ 신규는 항상 preparing
    plannedRoute:  route?.points ?? (isEditing ? 기존 값 : [])
    actualRoute:   isEditing ? 기존 값 : []
    recommendedSpeedKnots: isEditing ? 기존 값 : 계획속도               # ★ 신규는 계획속도와 동일
    ...나머지는 폼 값 그대로
  }
  onSubmit(결과)
  submitting = false
  if (isEditing) 모달 닫기          # 등록 모드는 부모가 닫음



## 6. 핵심 계산 로직

### 6.1 RTA/STA 준수 확률 (목록 열)
선택 구현: 이 계산은 AI 운항 리포팅 화면과 완전히 동일한 함수를 공유해야 한다(같은 항차가 두 화면에서 다른 확률로 보이면 안 됨). 일정 관리만 단독 구현한다면 이 열을 생략하고 —만 표시해도 나머지 화면은 완전하게 동작한다.

필요한 추가 입력: 항차별 AI 리포트(EcoSpeedReport)와 선박의 AIS 실시간 위치(AisPosition).

interface EcoSpeedReport {
  voyageId: string
  generatedAt: string        // 이 리포트의 "지금"으로 취급(계산 기준 시각)
  recommendedSpeed: number   // 권장 속도(kts)
  currentPlanSpeed: number
  etaIfRecommended: string   // 권장 속도로 운항 시 도착 예정 — 유일한 신뢰 앵커
}
interface AisPosition { vesselId: string; lat: number; lng: number; speedKnots: number }

샘플 리포트 4건


| id | voyageId | generatedAt | recommendedSpeed | currentPlanSpeed | etaIfRecommended |
| --- | --- | --- | --- | --- | --- |
| rep001 | voy001 | 2026-07-18T06:00Z | 13.5 | 16.0 | 2026-07-31T22:00Z |
| rep002 | voy002 | 2026-07-18T06:30Z | 14.0 | 17.0 | 2026-08-05T16:00Z |
| rep003 | voy003 | 2026-07-18T07:00Z | 12.5 | 13.0 | 2026-08-01T20:00Z |
| rep004 | voy004 | 2026-07-18T07:30Z | 13.0 | 14.5 | 2026-07-28T02:00Z |


샘플 AIS 위치 4건


| vesselId | lat | lng | speedKnots |
| --- | --- | --- | --- |
| v001 | 1.10 | 103.60 | 13.5 |
| v002 | 41.26 | 139.74 | 14.2 |
| v003 | -19.60 | 118.60 | 12.8 |
| v004 | 9.70 | 75.30 | 13.1 |


계산 절차

getRtaProbability(voyage):
  report = 리포트 중 voyageId === voyage.id 인 것
  vessel = 선박 중 id === voyage.vesselId 인 것
  if (!report || !vessel) return null            # ★ 신규 등록 항차는 리포트가 없어 항상 null → "—"

  position   = AIS 중 vesselId === voyage.vesselId 인 것 (없을 수 있음)
  routePoints    = voyage.plannedRoute
  totalDistance  = voyage.distanceNm
  progress       = computeVoyageProgress(routePoints, totalDistance, position)
  currentSpeed   = position?.speedKnots ?? report.currentPlanSpeed
  term           = voyage.rtaConfirmed ? 'RTA' : 'STA'
  deadlineIso    = voyage.rtaConfirmed ? voyage.rta : voyage.sta      # ★ 유일한 분기 지점

  plan = computeSpeedPlan(vessel, voyage, report,
                          progress.remainingNm, currentSpeed,
                          report.generatedAt, deadlineIso)
  return { ...plan.currentSpeedProbability, term }

① 항해 진행률

haversineNm(a, b):                       # 대권 거리(해리), 지구 반지름 3440.065nm
  dLat = rad(b.lat - a.lat); dLng = rad(b.lng - a.lng)
  h = sin²(dLat/2) + cos(rad(a.lat))·cos(rad(b.lat))·sin²(dLng/2)
  return 2 · 3440.065 · asin(min(1, sqrt(h)))

computeVoyageProgress(routePoints, totalDistanceNm, position):
  if (!position || routePoints.length < 2)
    return { traveledNm: 0, remainingNm: totalDistanceNm, progressPercent: 0 }
  idx = routePoints 중 position과 haversine 거리가 최소인 인덱스
  traveled = Σ haversineNm(routePoints[i], routePoints[i+1]) for i in 0..idx-1
           + haversineNm(routePoints[idx], position)
  traveled  = min(traveled, totalDistanceNm)                # 총거리 초과 방지
  remaining = max(totalDistanceNm - traveled, 0)
  percent   = totalDistanceNm > 0 ? traveled/totalDistanceNm·100 : 0

② 마진 → 확률

marginToProbability(marginHours):
  if (marginHours >= 0)
    return { percent: 100, confidence: 'high', marginHours }
  percent    = clamp(round(50 + marginHours · 4), 3, 49)     # 늦을수록 선형 하락
  confidence = percent >= 40 ? 'medium' : 'low'

③ 앵커 비율 방식으로 ETA·마진 산출

왜 남은 거리를 속도로 직접 나누지 않는가: 샘플 데이터는 거리(distanceNm)·속도·일정(sta/rta)이 서로 물리적으로 완전히 들어맞지 않는다. 실거리로 직접 계산하면 시나리오마다 결과가 어긋난다. 그래서 "권장 속도 @ 권장 ETA" 한 쌍만 절대 기준(앵커) 으로 삼고, 다른 속도의 도착 시각은 앵커 대비 속도 비율로 환산한다.

nowMs       = Date(report.generatedAt)
anchorHours = max(0.01, (Date(report.etaIfRecommended) - nowMs) / 3600000)
deadlineMs  = Date(deadlineIso)

etaMsAtSpeed(speed) = nowMs + anchorHours · (report.recommendedSpeed / speed) · 3600000

etaAtCurrent   = etaMsAtSpeed(currentSpeed)
marginAtCurrent = (deadlineMs - etaAtCurrent) / 3600000
currentSpeedProbability = marginToProbability(marginAtCurrent)      # ← 목록 열에 표시되는 값

④ 표시 규칙

형식: 10px 회색 접두 라벨(RTA 또는 STA) + 12px semibold 퍼센트 {n}%
색상: STA 기준이면 신뢰도와 무관하게 항상 파랑(text-blue-600). RTA 기준이면 신뢰도별로 high=초록 / medium=노랑 / low=빨강.
null이면 회색 —

### 6.2 ETA 자동 계산
계산 조건(hasEtaInputs) — 아래를 모두 만족할 때만 계산한다. 그리고 이 조건은 편집 가능한 상태에서만 평가한다(조회 전용 모드는 저장된 voyage.eta를 그대로 쓰고 재계산하지 않는다).

출발항 코드 있음 · 도착항 코드 있음 · ETD 있음 · 계획 속도 > 0

useEffect([hasEtaInputs, 출발코드, 도착코드, etd, 속도]):
  if (!hasEtaInputs) return
  cancelled = false
  resolvePortPairRoute(출발코드, 도착코드).then(route => {
    if (cancelled) return                       # ★ 경쟁 상태 방지
    distanceNm = route?.distanceNm ?? 0
    if (distanceNm <= 0) return                 # 항로 미확보 시 미리보기 갱신 안 함
    etaPreview = ETD + (distanceNm / 속도) 시간
  })
  cleanup: cancelled = true

비동기 조회가 끝나기 전에 입력이 또 바뀔 수 있으므로 cleanup에서 취소 플래그를 세워 뒤늦게 도착한 이전 응답이 최신 값을 덮어쓰지 않게 한다.

### 6.3 항구쌍 실해상 항로 조회
Track A — 반입한 mocks/port-pairs.json(항구 30곳 전 조합 435개)을 그대로 쓴다. 아래 원본 구현대로 만들면 되고 폴백은 필요 없다.

Track B — 파일이 없으므로 아래 폴백 구현을 쓴다. 자세한 배경은 BOOTSTRAP.md 1.2장 참고.

원본 구현 (Track A)

resolvePortPairRoute(fromCode, toCode) -> { points, distanceNm, waypoints } | null
  ROUTES = 항구쌍 사전                       # 키 형식: "PUS-RTM"
  forward = ROUTES[`${fromCode}-${toCode}`]
  if (forward) return forward
  reverse = ROUTES[`${toCode}-${fromCode}`]
  if (reverse) return { ...reverse, points: reverse.points 역순 }    # ★ 좌표 순서 뒤집기
  return null

사전은 알파벳 오름차순 코드 조합으로만 저장되어 있으므로 역방향은 좌표를 뒤집어 반환해야 한다.
사전 크기가 크면(항구 30곳 전 조합 435개) 동적 import로 제출 시점에만 로드한다 — 정적 import 시 다른 페이지 번들까지 커져 초기 로드가 느려진다.

폴백 구현 (Track B): 항로 사전이 없으면 resolvePortPairRoute를 두 항구 좌표의 haversine 거리 × 1.25(육지 우회 보정 계수)를 반환하는 함수로 대체한다. 그러면 ETA 자동 계산과 거리 표시가 그럴듯하게 동작하며, 이 화면의 다른 로직은 전혀 바꾸지 않아도 된다. 차이는 지도에서 항로가 직선으로 보이는 것뿐이다.

resolvePortPairRoute(from, to):
  a = findPort(from); b = findPort(to)
  if (!a || !b) return null
  return { points: [a, b], distanceNm: haversineNm(a, b) * 1.25, waypoints: 2 }

### 6.4 항구 코드 추출
캘린더 마커의 PUS-RTM 표기와 모달 조회 시 항구 선택값 복원에 쓰인다.

getPortCode(label) -> string | undefined
  # "로스앤젤레스 (Los Angeles)" → 괄호 안 영문명 추출
  en = label의 첫 괄호 안 문자열(없으면 label 전체), trim + 소문자
  return PORTS 중 nameEn.toLowerCase() === en 인 항구의 code

사전에 없는 항구명이면 undefined → 캘린더 마커는 괄호 부분을 생략하고, 모달은 선택값이 비게 된다.

### 6.5 목록 필터링·정렬
필터 (두 조건의 AND):

matchStatus = (statusFilter === 'all') || (voyage.status === statusFilter)
matchSearch = 검색어 없음
            || voyage.departurePort.includes(검색어)
            || voyage.arrivalPort.includes(검색어)
            || vessel?.name.includes(검색어)

대소문자를 구분하는 단순 부분 문자열 포함이다(원본 그대로). 한글 항구명 검색이 주 용도라 문제가 되지 않지만, 영문 선박명은 대문자로 입력해야 걸린다(KSF는 되지만 ksf는 안 됨).

정렬 (3단계):

상태 우선순위 오름차순 — underway: 0, delayed: 0, preparing: 1, completed: 2, cancelled: 3

underway와 delayed가 같은 0인 것은 의도된 설계다. 운항 중인 항차는 지연 여부와 무관하게 함께 최상단에 모아 보여준다.

같으면 ETA 오름차순
그래도 같으면 RTA 오름차순

건수 집계: all은 전체 길이, 나머지는 상태별 개수. 필터 결과가 아니라 항상 전체 데이터 기준으로 센다(검색어를 입력해도 탭 옆 숫자는 변하지 않음).

### 6.6 포맷 함수
날짜·숫자 로케일은 UI 언어와 무관하게 항상 ko-KR 고정이다(영문 UI에서도 2026. 08. 02. 06:00).

formatDateTime(iso) = Date(iso).toLocaleString('ko-KR',
    { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
formatNumber(n, d=1) = n.toLocaleString('ko-KR', { maximumFractionDigits: d })
formatNm(n)          = `${formatNumber(n, 0)} nm`



## 7. 상태별 편집 정책
이 화면의 가장 중요한 비즈니스 규칙이다(요구사항 FR-208).

editableFieldsForStatus(status):
  'preparing'            -> 'all'                          # 아직 출발 전 → 전 항목 수정 가능
  'underway' | 'delayed' -> ['sta', 'plannedSpeedKnots']   # 이미 출발 → 2개만
  'completed'|'cancelled'-> 'none'                         # 종료된 기록 → 조회 전용


| 상태 | 수정 가능 항목 | 저장 버튼 | 배너 |
| --- | --- | --- | --- |
| 준비 중 | 전 항목 | 노출 | 없음 |
| 운항 중 / 지연 | STA · 계획 속도만 | 노출 | 호박색 제한 안내(5.10) |
| 완료 / 취소 | 없음 | 미노출(닫기만) | 없음 |


필드별 활성 판정: create 모드면 항상 true. view 모드면 위 정책의 허용 목록에 포함될 때만 true.
비활성 필드는 disabled 처리 + 흐린 회색 배경(5.2의 공통 스타일이 자동 적용).



## 8. 외부 딥링크 연동 (선택)
대시보드의 "이번 주 일정" 카드에서 날짜를 클릭하면 이 화면의 캘린더 탭으로 이동하고 해당 날짜가 속한 달을 열어 그 칸을 강조하는 연동이다. 일정 관리만 단독 구현한다면 통째로 생략한다.

전달 방식: sessionStorage 1회성 키.

키: 'ksf:schedule-calendar-date'    값: 'YYYY-MM-DD'

[보내는 쪽 — 대시보드]
  sessionStorage.setItem(KEY, 클릭한 날짜)
  router.push('/schedule')

[받는 쪽 — 이 화면, 마운트 시 1회]
  useEffect(() => {
    const dateStr = sessionStorage.getItem(KEY)
    if (!dateStr) return
    sessionStorage.removeItem(KEY)        # ★ 즉시 제거 — 1회성 소비
    setCalendarFocusDate(new Date(dateStr))
    setViewTab('calendar')                # 캘린더 탭으로 자동 전환
  }, [])

캘린더 쪽 반응: focusDate prop이 바뀔 때마다 그 달로 커서를 옮긴다.

useEffect(() => {
  if (!focusDate) return
  setCursor(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1))
}, [focusDate])

같은 날짜를 다시 클릭해도 보내는 쪽에서 새 Date 인스턴스를 넘기므로 참조가 바뀌어 항상 반응한다.

해당 날짜 칸은 인디고 안쪽 링으로 강조된다(4.4장 ③).



## 9. 다국어 텍스트 전체 사전
t.schedule.*


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 물류 일정 관리 | Voyage Schedule |
| subtitle | 항차 일정 등록 및 현황 관리 | Register and manage voyage schedules |
| addVoyage | 항차 등록 | Add Voyage |
| searchPlaceholder | 항구명, 선박명 검색 | Search port, vessel name |
| colVessel | 선박 | Vessel |
| colRoute | 출발 → 도착 | Departure → Arrival |
| colEtd | ETD | ETD |
| colEtaRta | ETA / RTA | ETA / RTA |
| rtaConfirmedTag | (확정) | (Confirmed) |
| colRtaProb | 준수 확률 | Compliance Probability |
| colDistance | 거리 | Distance |
| colRecSpeed | 권장속도 | Rec. Speed |
| colStatus | 상태 | Status |
| viewList | 목록 | List |
| viewCalendar | 캘린더 | Calendar |
| todayBtn | 오늘 | Today |
| departureTag | 출발 | Dep |
| arrivalTag | 도착 | Arr |
| moreEvents(n) | +{n}건 더보기 | +{n} more |
| weekdays | 일 월 화 수 목 금 토 | Sun Mon Tue Wed Thu Fri Sat |


t.modal.* (등록·조회 모달 전용)


| 키 | 한국어 | English |
| --- | --- | --- |
| registerVoyage | 항차 등록 | Register Voyage |
| registerSub | 새 운항 항차를 등록합니다 | Register a new voyage |
| viewVoyage | 항차 상세 | Voyage Details |
| viewSub | 등록된 항차의 세부 내역입니다 | Details of the registered voyage |
| selectVessel | 선박 선택 | Select Vessel |
| selectVesselPh | 선박을 선택하세요 | Select a vessel |
| departure | 출발항 | Departure Port |
| arrival | 도착항 | Arrival Port |
| depPlaceholder | 출발항을 선택하세요 | Select departure port |
| arrPlaceholder | 도착항을 선택하세요 | Select arrival port |
| etd | 출발 예정일시 (ETD) | Estimated Time of Departure (ETD) |
| rta | 도착 요구일시 (RTA) | Required Time of Arrival (RTA) |
| sta | 선사 예정 도착일시 (STA) | Scheduled Time of Arrival (STA) |
| staHint | 선택 입력 — 비워두면 RTA와 동일. RTA 미확정 시 기준일시로 사용됩니다. | Optional — defaults to RTA. Used as deadline until RTA is confirmed. |
| am / pm | 오전 / 오후 | AM / PM |
| etaLabel | 예상 도착 (ETA) | Estimated Arrival (ETA) |
| etaAutoHint | 출발항·도착항·ETD·속도 입력 시 자동 계산 | Calculated automatically once ports, ETD, and speed are set |
| lateWarning | 현재 계획 속도로는 RTA까지 도착하기 어렵습니다. 속도를 높이거나 출발을 앞당기세요. | At the current planned speed, the vessel won't make RTA. Increase speed or move up departure. |
| rtaConfirmed | 화주 RTA 확정됨 | Client RTA confirmed |
| cargo | 화물 내용 | Cargo Description |
| cargoPlaceholder | 예: 전자제품, 자동차 부품 | e.g. Electronics, Auto Parts |
| cargoTon | 화물량 (ton) | Cargo (ton) |
| fuelType | 연료 종류 | Fuel Type |
| planSpeed | 계획 속도 (kts) | Planned Speed (kts) |
| notice | 등록 후 상태는 준비 중으로 설정됩니다. AI 에코스피드 권장 속도와 실제 항로는 운항 시작 후 자동 계산됩니다. | Status will be set to Preparing after registration. AI eco-speed and actual route will be calculated once underway. |
| submit / submitting | 항차 등록 / 등록 중... | Register Voyage / Registering... |
| cancel / close / save | 취소 / 닫기 / 저장 | Cancel / Close / Save |
| editRestrictedNotice | 운항이 이미 시작된 항차는 STA(선사 예정 도착)와 계획 속도만 수정할 수 있습니다. | For a voyage already underway, only STA (Scheduled Time of Arrival) and planned speed can be edited. |
| errVessel | 선박을 선택해주세요 | Please select a vessel |
| errDeparture | 출발항을 선택해주세요 | Please select departure port |
| errArrival | 도착항을 선택해주세요 | Please select arrival port |
| errPortSame | 출발항과 도착항은 서로 달라야 합니다 | Departure and arrival ports must differ |
| errEtd | ETD를 입력해주세요 | Please enter ETD |
| errRta | RTA를 입력해주세요 | Please enter RTA |
| errRtaAfterEtd | RTA는 ETD 이후여야 합니다 | RTA must be after ETD |
| errStaAfterEtd | STA는 ETD 이후여야 합니다 | STA must be after ETD |
| errCargo | 화물 내용을 입력해주세요 | Please enter cargo description |
| errCargoTon | 화물량을 입력해주세요 | Please enter cargo amount |
| errSpeed | 계획 속도를 입력해주세요 | Please enter planned speed |
| container / bulk / tanker / roro | 컨테이너 / 벌크 / 탱커 / 로로 | Container / Bulk / Tanker / RoRo |


t.status.* / t.common.* (공용)


| 키 | 한국어 | English |
| --- | --- | --- |
| status.preparing | 준비 중 | Preparing |
| status.underway | 운항 중 | Underway |
| status.delayed | 지연 | Delayed |
| status.completed | 완료 | Completed |
| status.cancelled | 취소 | Cancelled |
| common.all | 전체 | All |
| common.noResults | 검색 결과가 없습니다. | No results found. |




## 10. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 (버튼 배경·선택 탭·포커스 링·오늘 날짜 원·캘린더 포커스 링). 버튼 hover는 #4f46e5.

항차 상태 배지(VoyageBadge) — 알약형 rounded-full px-2 py-0.5 text-xs font-medium:


| status | 클래스 |
| --- | --- |
| preparing | bg-slate-100 text-slate-600 |
| underway | bg-blue-100 text-blue-700 |
| delayed | bg-red-100 text-red-700 |
| completed | bg-green-100 text-green-700 |
| cancelled | bg-slate-100 text-slate-500 |


캘린더 마커 색은 배지와 다른 팔레트다(4.4장 ④ 표) — 지도와 통일하기 위한 값이니 혼동하지 말 것.

카드 기본 스타일: bg-white dark:bg-slate-900, border border-slate-200 dark:border-slate-800, rounded-xl. 모달 패널만 rounded-2xl shadow-2xl.

타이포: 페이지 타이틀 16px bold / 테이블 헤더 12px semibold 회색 / 본문 셀 12~14px / 모달 라벨 12px semibold.

간격: 페이지 좌우 패딩 24px(px-6), 모달 본문 블록 간 20px(space-y-5), 그리드 칸 12~16px.

아이콘 세트: lucide-react. 이 화면에서 쓰인 아이콘 — Plus, Search, Ship, CalendarDays, MapPin, Fuel, ChevronRight, ChevronLeft, List, CalendarRange, ArrowUpRight, ArrowDownLeft, X, Calendar, Package, Gauge.

다크 모드: 모든 배경/텍스트/테두리에 dark: variant를 함께 정의한다.



## 11. 엣지 케이스 및 불변식
재구현 시 특히 놓치기 쉬운 항목들이다.

ETA는 절대 사용자 입력이 아니다. 항상 ETD + 실거리 ÷ 계획속도로 파생된다. 실거리를 못 구하면 RTA를 잠정 ETA로 대체한다(etaIso = rtaIso).
빈 STA는 RTA로 대체해 저장한다. sta 필드는 화면상 선택 입력이지만, 저장되는 Voyage에는 항상 값이 들어 있어야 한다(sta: form.sta ? toIso(form.sta) : rtaIso).
rtaConfirmed === false면 마감 기준이 STA로 바뀌는 지점은 단 한 곳이다(deadlineIso 파생부). 하위 계산 함수들은 rtaConfirmed를 다시 참조하지 않고 넘겨받은 deadlineIso만 본다.
신규 등록 항차는 준수 확률이 항상 — 다. AI 리포트가 없어 계산 근거가 없기 때문이며, 버그가 아니라 의도된 동작이다.
신규 항차의 recommendedSpeedKnots는 계획 속도와 동일하게 저장한다. 목록의 "권장속도" 열에서 취소선 계획속도와 초록 권장속도가 같은 값으로 보이는 것이 정상이다.
상태는 화면에서 바꿀 수 없다. 등록은 항상 preparing, 수정 시에는 기존 상태를 그대로 보존한다.
날짜 위젯에서 날짜를 고르기 전에 시각만 바꿔도 값이 저장돼야 한다(5.6장 주의 참고). 오늘 날짜를 기본값으로 채운다.
ISO → 로컬 변환에 slice(0,16)을 쓰면 안 된다(5.6장 두 번째 주의). 목록과 모달의 시각이 어긋나는 원인이 된다.
캘린더는 항상 42칸이다. 달에 따라 행 수를 가변으로 만들면 뷰 전환 시 레이아웃이 튄다.
하루 마커는 최대 3개까지만 렌더링하고 나머지는 "+N건 더보기"로 접는다. 이 규칙이 없으면 특정 날짜에 이벤트가 몰릴 때 칸 높이가 무너진다.
모달 오버레이는 자기 자신을 클릭했을 때만 닫는다. e.target === e.currentTarget 검사를 빼면 모달 내부를 클릭해도 닫히는 버그가 생긴다.
정비 중 선박은 선택 목록에서 제외하되, 이미 선택된 선박은 남긴다. 이 예외가 없으면 기존 항차를 조회할 때 선박 선택이 비어 보인다.
탭 옆 건수는 검색어와 무관하게 전체 기준으로 집계한다.
날짜/숫자 포맷은 UI 언어와 무관하게 항상 ko-KR 고정이다. 원본과 100% 동일하게 가려면 영문 모드에서도 2026. 08. 02. 06:00 형식을 유지한다.



## 12. 재구현 체크리스트
데이터 모델 3종(Voyage / Vessel 최소 필드 / Port) + 샘플 3세트(항구 30·선박 5·항차 8) 입력
페이지 3단 레이아웃(헤더 고정 / 필터 바 고정 / 콘텐츠만 스크롤)
뷰 탭 2종(목록·캘린더) + 검색 입력 + 상태 필터 세그먼트 5개(건수 배지 포함)
목록 테이블 9열 렌더링 — 특히 ETA/RTA 2줄 셀, 지연 시 빨강, RTA 확정 시 "(확정)" 초록 태그
필터링(상태 AND 검색) + 3단계 정렬(상태 우선순위 → ETA → RTA)
빈 결과 시 "검색 결과가 없습니다." 표시
캘린더 42칸 그리드 + 월 이동 + "오늘" 버튼 + 요일 헤더(일요일 시작)
캘린더 이벤트 마커(출발/도착 2종, 상태별 색, 최대 3개 + "+N건 더보기")
등록 모달 — 선박(정비 중 제외) / 출발·도착항 / ETD·RTA·STA / 화물·연료·속도
커스텀 날짜·시각 위젯(날짜 + 12시간 + 분 + 오전/오후, 오전 먼저, appearance-none)
ETA 자동 계산(비동기 항로 조회 + 취소 플래그) + ETA 읽기 전용 표시 줄
RTA 지각 경고 문구
검증 11종 + 필드별 오류 메시지 + 개별 오류 초기화
제출 처리(신규 preparing 고정, 빈 STA→RTA 대체, 실거리 미확보 시 ETA→RTA 대체)
조회 모달 + 상태별 편집 정책(전체 / STA·속도만 / 조회 전용) + 제한 안내 배너
(선택) 준수 확률 열 — 진행률·앵커 비율·마진 확률 계산 + RTA/STA 접두 라벨과 색 분기
(선택) 대시보드 → 캘린더 딥링크(sessionStorage 1회성 키 + 포커스 링)
다국어(ko/en) 텍스트 전체 적용 + 날짜·숫자는 ko-KR 고정
다크 모드 대응


# 선박 관리 — 단독 기능 명세서 (Fleet / Vessel Management)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "선박 관리" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 원본 프로젝트의 다른 화면(대시보드·물류 일정·AI 운항 리포팅·탄소 배출 등)에 의존하지 않고 선박 관리만 별도로 구현하는 것을 전제로 작성되었습니다. 다만 카드/상세 패널의 "현재 운항 항차" 표시를 위해 항차(Voyage) 데이터를 읽기 전용으로 참조하며, 이는 3.4장에서 최소 필드만 정의해 두었습니다(항차 데이터가 없으면 해당 블록만 자연스럽게 사라지므로 생략 가능).

해커톤 원칙: 1~8장, 10장은 화면이 100% 정상 동작하기 위한 Must 항목입니다. 5장(연료 커브 차트)은 시각적 임팩트가 가장 큰 요소이므로 가급적 구현하되, 차트 라이브러리 도입이 부담되면 표만 남기고 건너뛰어도 나머지는 완전히 동작합니다. 11장(엣지 케이스)은 시간이 남을 때 확인합니다.



## 목차
개요
접근 권한
데이터 모델
화면 구성
연료 소모 커브 차트
선박 등록·수정 모달
필드 잠금 정책
핵심 계산 로직
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
선사가 보유한 선박(Vessel) 의 마스터 정보를 등록·조회·수정하는 화면이다. 선체 제원(톤수·전장·전폭· 흘수)과 엔진 프로필에 더해, 속도별 연료 소모량 커브를 관리한다. 이 커브는 AI 운항 리포팅의 연료·CO₂ 절감 계산의 기초값이 되므로, 한 번 등록되면 사후 변경이 불가능하도록 잠긴다.

### 1.2 핵심 개념
선박(Vessel): 이 화면의 유일한 주 엔티티. 카드 그리드로 나열하고, 하나를 선택하면 우측에 상세 패널이 열린다.
연료 소모 커브(fuelCurve): { speedKnots, fuelTonPerDay } 배열. 등록 시 사용자가 입력한 기준 속도와 기준 속도에서의 연료 소모량 두 값만으로 해군 배수량 법칙(속도³ 비례) 에 따라 6개 지점을 자동 생성한다(8.1장).
선체 노후 계수(foulingFactor): 선저 오손·노후로 인한 연료 효율 저하 배수(1.00 = 신조 상태). 1.07을 초과하면 카드에서 주황색으로 경고 표시된다.
선박 상태(3종): active(운항 가능) · maintenance(정비 중) · idle(대기 중).
잠금 정책: 이 화면의 핵심 비즈니스 규칙. 진수 시점에 확정되는 물리적 스펙과 AI 계산 기초값은 등록 후 항상 수정 불가이며, 운항 상태는 활성 항차가 있으면 추가로 잠긴다(7장).



## 2. 접근 권한
RBAC가 있는 시스템이라면 ADMIN, LOGISTICS(물류 담당자) 역할만 접근 가능하도록 사이드바/라우팅에 노출한다. CAPTAIN, CLIENT에는 노출하지 않는다.
별도 프론트 전용 데모 앱으로 만든다면(백엔드 인증 없이) 이 제약은 생략해도 무방하다.



## 3. 데이터 모델

### 3.1 타입 정의
type VesselType = 'container' | 'bulk' | 'tanker' | 'roro'
type VesselStatus = 'active' | 'maintenance' | 'idle'

interface FuelPoint {
  speedKnots: number
  fuelTonPerDay: number
}

interface Vessel {
  id: string
  name: string                 // 선박명, 예: 'KSF PIONEER'
  imo: string                  // IMO 번호 — 숫자 7자리 문자열
  type: VesselType
  flag: string                 // 선적국 2자리 코드, 예: 'KR'
  company: string              // 선사명 — 등록 시 자사명으로 자동 고정(입력 필드 없음)
  grossTonnage: number         // 총톤수 (GT)
  lengthOverall: number        // 전장 LOA (m)
  beam: number                 // 선폭 (m)
  maxDraft: number             // 최대 흘수 (m)
  currentDraft: number         // 현재 흘수 (m)
  enginePower: number          // 엔진 출력 (kW)
  fuelCurve: FuelPoint[]       // 속도→일일 연료소모량 곡선 (자동 생성)
  designSpeedKnots: number     // 기준 속도 (커브 생성의 기준점)
  designSpeedFuelTon: number   // 기준 속도에서의 연료 소모량 (ton/day)
  foulingFactor: number        // 선체 노후 계수 (≥ 1.00)
  status: VesselStatus
  buildYear: number
}

### 3.2 재현용 샘플 데이터 (선박 5척, 그대로 사용 권장)
기본 제원


| id | name | imo | type | flag | buildYear | GT | LOA(m) | beam(m) | maxDraft | curDraft | enginePower(kW) | fouling | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v001 | KSF PIONEER | 9876543 | container | KR | 2019 | 94,500 | 299 | 48.2 | 14.5 | 13.1 | 72,240 | 1.04 | active |
| v002 | KSF NAVIGATOR | 9765432 | container | KR | 2017 | 86,400 | 285 | 45.6 | 14.0 | 12.4 | 68,400 | 1.07 | active |
| v003 | KSF VENTURE | 9654321 | bulk | KR | 2015 | 58,200 | 229 | 38.0 | 13.5 | 11.8 | 11,060 | 1.09 | active |
| v004 | KSF HORIZON | 9543210 | tanker | KR | 2020 | 71,300 | 243 | 42.0 | 14.8 | 13.6 | 15,820 | 1.05 | active |
| v005 | KSF ASPIRE | 9432109 | container | KR | 2022 | 102,000 | 320 | 48.2 | 15.0 | 14.2 | 78,400 | 1.02 | maintenance |


연료 커브 및 기준값


| id | designSpeedKnots | designSpeedFuelTon | fuelCurve (kts → ton/day) |
| --- | --- | --- | --- |
| v001 | 14 | 112 | 10→52, 12→78, 14→112, 16→158, 18→215, 20→285 |
| v002 | 14 | 103 | 10→48, 12→71, 14→103, 16→147, 18→201, 20→268 |
| v003 | 13 | 61 | 9→28, 11→41, 13→61, 15→88 |
| v004 | 14 | 94 | 10→44, 12→65, 14→94, 16→135 |
| v005 | 14 | 124 | 10→58, 12→86, 14→124, 16→175, 18→238, 20→317 |


샘플 설계 의도

v003(1.09)과 v002(1.07)는 노후 계수 경고 임계값 > 1.07 경계를 검증하기 위한 값이다. v003만 주황색으로 표시되고 v002는 표시되지 않아야 정상이다(초과 비교이므로 1.07은 미해당).
v005만 maintenance라 카드 아이콘이 Wrench(노랑)로 바뀐다.
커브 지점 수가 6개(container)와 4개(bulk/tanker)로 다른 것은 의도된 것이다 — 기준 속도를 중심으로 생성하되 속도가 0 이하인 지점은 제외되기 때문이다(8.1장).
company는 전부 자사명(KSF Line)이다. 이 값은 입력 필드가 없고 등록 시 상수로 자동 부여된다.

### 3.3 데이터 소스 (둘 중 택1)

| 방식 | 구현 | 권장 상황 |
| --- | --- | --- |
| A. 정적 데이터 | 위 샘플을 모듈 상수로 두고 useState로 관리 | 해커톤 기본값 — DB·네트워크 의존이 없어 가장 빠르고 안전 |
| B. REST + SWR | useSWR('/api/vessels', fetcher) → 서버가 DB 조회 | 백엔드까지 보여줘야 할 때 |


방식 B의 API 계약(요청·응답 바디는 모두 Vessel 또는 그 배열):


| 메서드 | 경로 | 용도 | 응답 |
| --- | --- | --- | --- |
| GET | /api/vessels | 전체 선박 조회 | Vessel[] |
| POST | /api/vessels | 선박 등록 | Vessel (201) |
| PATCH | /api/vessels/{id} | 선박 수정 | Vessel |
| GET | /api/voyages | 항차 목록(현재 운항 표시용) | Voyage[] |


등록·수정 후에는 반드시 목록을 재검증(mutate())해 화면에 즉시 반영한다.

### 3.4 항차(Voyage) 참조 — 최소 필드
"현재 운항 항차" 표시에만 사용한다. 아래 4개 필드면 충분하다.

interface Voyage {
  vesselId: string
  status: 'preparing' | 'underway' | 'delayed' | 'completed' | 'cancelled'
  departurePort: string     // "부산 (Busan)" 형태
  arrivalPort: string
  cargoDescription: string
}

활성 항차 판정: vesselId가 일치하면서 status가 underway 또는 delayed 인 첫 번째 항차.

샘플로는 아래 3건이면 화면 검증에 충분하다.


| vesselId | status | 출발 → 도착 | 화물 |
| --- | --- | --- | --- |
| v001 | underway | 부산 (Busan) → 로테르담 (Rotterdam) | 전자제품, 자동차 부품 |
| v002 | delayed | 상하이 (Shanghai) → 로스앤젤레스 (Los Angeles) | 소비재, 섬유류 |
| v003 | underway | 포트헤들랜드 (Port Hedland) → 광양 (Gwangyang) | 철광석 |




## 4. 화면 구성
전체 페이지는 세로 flex(flex flex-col h-full)이며 ① 페이지 헤더 → ② 검색 바 → ③ 본문(카드 그리드 + 상세 패널) 3단 구조다. ①②는 고정(shrink-0), ③만 스크롤된다.

③은 다시 가로 flex로 나뉘어 좌측이 카드 그리드(flex-1, 세로 스크롤), 우측이 상세 패널(고정 폭 288px)이다. 상세 패널은 선박을 선택했을 때만 나타난다.

### 4.1 페이지 헤더
높이 64px(h-16) 고정, 좌우 패딩 24px, 하단 보더, 배경 bg-white(다크 bg-slate-900).
좌측: 타이틀 "선박 관리"(볼드, 16px) + 가운뎃점 + 부제 "선박 프로필 및 엔진 스펙 관리" (회색, 14px, 640px 미만에서 숨김).
우측: "선박 등록" 버튼 — 인디고 배경(#6366f1, hover #4f46e5), 흰 텍스트, rounded-lg, px-4 py-2, Plus 아이콘 + 라벨. 클릭 시 6장 모달을 create 모드로 연다.

### 4.2 검색 바
헤더 아래 px-6 py-3 블록(흰 배경, 하단 보더). 폭 100% 검색 입력 하나만 있다.

왼쪽 안쪽에 Search 아이콘(16px 회색, 절대 위치, left-3, 세로 가운데), 좌측 패딩 36px.
placeholder: "선박명, IMO 번호 검색"
포커스 시 인디고 2px 링.
필터 조건: name.includes(검색어) || imo.includes(검색어) — 대소문자 구분 단순 부분 문자열.

상태 필터·정렬은 없다. 카드 순서는 원본 데이터 배열 순서 그대로다.

### 4.3 선박 카드 그리드
반응형 그리드, 칸 간격 12px(gap-3):


| 뷰포트 | 열 수 |
| --- | --- |
| 기본(모바일) | 1 |
| ≥ 640px (sm) | 2 |
| ≥ 1280px (xl) | 3 |
| ≥ 1536px (2xl) | 4 |


각 카드는 버튼 요소(클릭 가능)이며 text-left p-4 rounded-xl border, 흰 배경(다크 slate-800).

선택 상태: 인디고 테두리 + shadow-md + 인디고 30% 링(ring-1 ring-[#6366f1]/30)
비선택: 회색 테두리, hover 시 테두리가 진해지고 shadow-sm
토글 동작: 이미 선택된 카드를 다시 클릭하면 선택이 해제된다(상세 패널이 닫힘).

카드 내부 구성(위→아래)

상단 행(좌우 배치, 하단 여백 12px)

좌: 40×40px 회색 라운드 박스(rounded-xl) 안 아이콘 — status === 'maintenance'면 Wrench(노랑 text-yellow-500), 그 외 Anchor(인디고)
우: 상태 배지(VesselBadge, 10장 색상표)

선박명: 14px semibold

부제: IMO {imo} · {선종라벨} · {건조년도} (12px 회색, 하단 여백 12px)

제원 4칸 그리드(2열, 12px 글씨) — 각 칸은 회색 라벨 + 그 아래 값(font-medium)


| 라벨 | 값 형식 |
| --- | --- |
| 총톤수 | {천단위 콤마} GT |
| 흘수 | {현재}m / {최대}m |
| 전장 | {n}m |
| 노후 계수 | ×{소수 2자리} |


노후 계수 경고: foulingFactor > 1.07이면 이 칸의 값만 주황색(text-orange-600, 다크 text-orange-400)으로 표시한다. 나머지 값은 text-slate-700.

현재 운항 항차(조건부, 활성 항차가 있을 때만): 상단 구분선(border-t) + 12px 인디고 font-medium 텍스트 — `운항 중: {출발항 첫 토큰} → {도착항 첫 토큰}`

### 4.4 상세 패널 (우측)
선택된 선박이 있을 때만 렌더링. 폭 288px 고정(w-72 shrink-0), 좌측 보더, 세로 스크롤, 흰 배경.

① 패널 헤더 (px-4 py-3, 하단 보더, 회색 배경 bg-slate-50, sticky top-0으로 상단 고정)

좌: 선박명(14px semibold) + 그 아래 선종 라벨(12px 회색)
우: Pencil 아이콘 버튼(14px) — title="선박 정보 수정", hover 시 인디고. 클릭 시 6장 모달을 view 모드로 연다.

② 기본 제원 섹션 — 소제목 "기본 제원"(12px semibold). 아래에 라벨-값 쌍을 좌우 양끝 정렬로 9줄(space-y-1.5, 12px). 라벨은 회색, 값은 font-medium.


| 순서 | 라벨 | 값 형식 |
| --- | --- | --- |
| 1 | IMO | 그대로 |
| 2 | 선적국 | 그대로 (예: KR) |
| 3 | 총톤수 | {콤마} GT |
| 4 | LOA | {n} m |
| 5 | 선폭 | {n} m |
| 6 | 최대 흘수 | {n} m |
| 7 | 현재 흘수 | {n} m |
| 8 | 엔진 출력 | {콤마} kW |
| 9 | 선체 노후 계수 | ×{소수 2자리} |


1번 IMO와 4번 LOA는 다국어 사전을 거치지 않는 고정 문자열이다(영문 약어 그대로).

③ 연료 소모 커브 섹션 — 소제목 "연료 소모 커브". 위에 차트(높이 176px, 5장), 아래에 표 2열.


| 열 | 헤더 | 정렬 | 값 |
| --- | --- | --- | --- |
| 1 | 속도 (kts) | 좌 | {n} kts (회색) |
| 2 | 소모 (ton/day) | 우 | {n} (font-medium) |


행 사이는 얇은 구분선(divide-y divide-slate-50), 각 셀 py-1.

④ 현재 운항 항차 섹션(조건부) — 인디고 10% 배경 박스(bg-[#6366f1]/10 rounded-lg p-3):

소제목 "현재 운항 항차"(인디고, semibold)
{출발항 첫 토큰} → {도착항 첫 토큰} (인디고)
화물 내용 (인디고 70% 투명도, 위 여백 4px)



## 5. 연료 소모 커브 차트
Apache ECharts 라인 차트다. Next.js App Router에서는 반드시 SSR을 끄고 동적 import 한다 (dynamic(() => import('echarts-for-react'), { ssr: false })) — 그러지 않으면 서버 렌더링 단계에서 window 참조로 깨진다.

컨테이너 높이 176px(h-44), 아래 여백 12px. notMerge 옵션을 켜서 선박을 바꿀 때 이전 옵션이 남지 않게 한다.

테마 연동 색상(다크 모드에 따라 스위칭)


| 용도 | 라이트 | 다크 |
| --- | --- | --- |
| 축·격자선 | #e2e8f0 | #334155 |
| 축 라벨 | #64748b | #94a3b8 |
| 툴팁 배경 | #ffffff | #1e293b |
| 툴팁 테두리 | #e2e8f0 | #334155 |
| 툴팁 글자 | #334155 | #e2e8f0 |


옵션 구성

backgroundColor: 'transparent'
animation: true, animationDuration: 1000, animationEasing: 'cubicOut'
grid: { top: 12, right: 12, bottom: 28, left: 12, containLabel: true }

tooltip:
  trigger: 'axis'
  배경/테두리/글자색은 위 표
  formatter: `${속도} kts<br/><b>${소모량} ton/day</b>`

xAxis:
  type: 'category', data = fuelCurve의 speedKnots 배열
  axisLabel: 10px, formatter `${v}kts`
  axisTick: 숨김
  name: '속도', nameLocation: 'middle', nameGap: 22, 10px

yAxis:
  type: 'value'
  splitLine: 점선(dashed), 색은 축 색
  axisLabel: 10px, formatter `${v}t`

series[0]:
  type: 'line', data = fuelCurve의 fuelTonPerDay 배열
  smooth: true
  symbol: 'circle', symbolSize: 7
  lineStyle: { color: '#6366f1', width: 2.5 }
  itemStyle: { color: '#6366f1', borderColor: 다크?'#1e293b':'#fff', borderWidth: 2 }
  label: { show: true, position: 'top', 10px }        # 각 점 위에 값 표시
  areaStyle: 세로 선형 그라디언트
      offset 0 → rgba(99,102,241, 다크 0.35 / 라이트 0.15)
      offset 1 → rgba(99,102,241, 0)
  markLine:
      silent: true, symbol: ['none','none']
      lineStyle: { color: '#f59e0b', type: 'dashed', width: 1.5 }
      data: [{ type: 'average',
               label: { formatter: `×${foulingFactor.toFixed(2)}`,
                        color: '#f59e0b', fontSize: 10, position: 'insideEndTop' } }]

markLine의 의미: 평균선 자체는 ECharts의 type: 'average'가 자동 계산하지만, 라벨에는 평균값이 아니라 선체 노후 계수(×1.04)를 표시한다. "이 커브에 노후 계수가 곱해져 실제 소모량이 된다"는 것을 한 눈에 보여주기 위한 의도적 표기이며, 호박색(#f59e0b) 점선으로 그린다.

차트를 생략하는 경우: 표(4.4 ③)만 남겨도 정보 손실은 없다. 다만 이 화면에서 시각적 밀도가 가장 높은 요소이므로 데모 임팩트를 위해 가급적 구현을 권장한다.



## 6. 선박 등록·수정 모달
등록(create)과 조회·수정(view)이 같은 컴포넌트이며 mode prop으로 갈린다. 별도 "수정" 버튼 없이 모달을 여는 즉시 잠금 정책에 따라 각 필드의 활성/비활성이 결정된다(7장).

주의 — 이 모달은 다국어를 지원하지 않는다. 원본에서 이 모달의 모든 라벨·placeholder·오류 메시지· 버튼 문구는 한국어 하드코딩 문자열이다(항차 등록 모달이 t.modal.*을 쓰는 것과 대조적이다). 원본과 100% 동일하게 재현하려면 그대로 하드코딩하고, 개선하고 싶다면 사전으로 빼도 무방하다.

### 6.1 모달 셸
오버레이: fixed inset-0 z-50, bg-black/50 backdrop-blur-sm, p-4, 가운데 정렬. 오버레이 자신을 직접 클릭했을 때만 닫는다(e.target === e.currentTarget).

패널: 최대 폭 max-w-2xl(항차 모달의 3xl보다 좁다), 흰 배경(다크 slate-900), rounded-2xl shadow-2xl, 세로 flex, 최대 높이 90vh.

헤더(px-6 py-4, 하단 보더): 32×32px 인디고 15% 배경 라운드 박스 안 Ship 아이콘(인디고)

제목/부제 2줄 + 우측 X 닫기 버튼.


| mode | 제목 | 부제 |
| --- | --- | --- |
| create | 선박 등록 | 새 선박 프로필을 등록합니다 |
| view | 선박 정보 조회 · 수정 | 등록된 선박 정보를 확인하고 일부 항목을 수정합니다 |


본문: flex-1 overflow-y-auto px-6 py-5 space-y-5

푸터(px-6 py-4, 상단 보더, 우측 정렬, gap-3): 취소(고스트) + 인디고 버튼 (create면 "선박 등록", view면 "저장").

항차 모달과 달리 view 모드에서도 저장 버튼이 항상 노출된다. 선박은 어떤 상태에서도 최소한 선박명·선적국·현재 흘수·노후 계수는 수정 가능하기 때문이다.

### 6.2 공통 입력 스타일
항차 모달과 동일하다 — w-full px-3 py-2 rounded-lg border text-sm, 흰 배경(다크 slate-800), 포커스 시 인디고 2px 링, 비활성 시 opacity-60 cursor-not-allowed + 회색 배경, 오류 시 테두리만 빨강.

라벨: flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5 + 14px 아이콘, 필수는 뒤에 빨간 *. 오류 메시지는 필드 아래 12px 빨강.

### 6.3 필드 구성 (위→아래)
① 선박명 / IMO 번호 (2열)


| 필드 | 아이콘 | 라벨 | 입력 | 특이사항 |
| --- | --- | --- | --- | --- |
| name | Ship | 선박명 * | text | placeholder 예: HECO PIONEER |
| imo | Ship | IMO 번호 * | text | 입력 시 숫자만 남기고 7자리로 자르기(replace(/\D/g,'').slice(0,7)), placeholder 예: 9876543 |


placeholder의 HECO는 프로젝트 구명(舊名) 잔재다. 원본 그대로 재현하려면 유지하고, 정리하려면 KSF PIONEER로 바꾼다.

② 선종 / 선적국 / 건조년도 (3열)


| 필드 | 아이콘 | 라벨 | 입력 |
| --- | --- | --- | --- |
| type | Ship | 선종 | select — 컨테이너선 / 벌크선 / 탱커선 / 로로선 |
| flag | Flag | 선적국 * | text — 2자리로 자르고 자동 대문자화(slice(0,2).toUpperCase()), placeholder 예: KR |
| buildYear | Calendar | 건조년도 * | number |


선종 옵션 라벨은 "컨테이너선 / 벌크선 / 탱커선 / 로로선"(뒤에 "선"이 붙는다). 항차 등록 모달의 "컨테이너 / 벌크 / 탱커 / 로로"와 다르므로 혼동하지 말 것.

③ 총톤수 / 전장 / 선폭 (3열)


| 필드 | 아이콘 | 라벨 | 입력 |
| --- | --- | --- | --- |
| grossTonnage | Ruler | 총톤수 (GT) * | number min=1, placeholder 예: 94500 |
| lengthOverall | Ruler | 전장(LOA, m) * | number min=1 step=0.1, placeholder 예: 299 |
| beam | Ruler | 선폭 (m) * | number min=1 step=0.1, placeholder 예: 48.2 |


④ 최대 흘수 / 현재 흘수 / 엔진 출력 (3열)


| 필드 | 아이콘 | 라벨 | 입력 |
| --- | --- | --- | --- |
| maxDraft | Gauge | 최대 흘수 (m) * | number min=0 step=0.1, placeholder 예: 14.5 |
| currentDraft | Gauge | 현재 흘수 (m) * | number min=0 step=0.1, placeholder 예: 13.1 |
| enginePower | Activity | 엔진 출력 (kW) * | number min=1, placeholder 예: 72240 |


⑤ 선체 노후 계수 / 운항 상태 (2열)


| 필드 | 아이콘 | 라벨 | 입력 |
| --- | --- | --- | --- |
| foulingFactor | Activity | 선체 노후 계수 * | number min=1 step=0.01 |
| status | Activity | 운항 상태 | select — 운항 가능(active) / 정비 중(maintenance) / 대기(idle) |


view 모드에서 활성 항차가 있어 상태가 잠긴 경우, select 아래에 12px 회색 안내 — "운항중인 항차가 있어 수정할 수 없습니다"

⑥ 기준 속도 / 기준 속도 연료소모 (2열)


| 필드 | 아이콘 | 라벨 | 입력 | 기본값 |
| --- | --- | --- | --- | --- |
| designSpeedKnots | Gauge | 기준 속도 (kts) * | number min=1 step=0.5 | 14 |
| designSpeedFuelTon | Gauge | 기준 속도 연료소모 (ton/day) * | number min=1 | 100 |


⑦ 안내 배너 — 인디고 8% 배경 박스(bg-[#6366f1]/8, border-[#6366f1]/20, px-4 py-3), 12px 회색 문구. 모드별로 내용이 다르다.

create: "연료 소모 커브는 기준 속도·소모량을 바탕으로 해군 배수량 법칙(속도³ 비례)에 따라 자동 산출됩니다. 등록 후 상세 패널에서 확인할 수 있습니다."
view: "기준 속도·연료소모량은 AI 운항 리포팅의 연료·CO₂ 절감 계산 기초값이라 등록 후에는 수정할 수 없습니다. 그 외 선체 치수·엔진출력 등 진수 시점에 확정되는 제원도 함께 잠겨 있습니다."

### 6.4 폼 기본값 (create 모드)

| 필드 | 기본값 |
| --- | --- |
| type | container |
| flag | KR |
| buildYear | 올해 연도 |
| foulingFactor | 1.00 |
| status | active |
| designSpeedKnots | 14 |
| designSpeedFuelTon | 100 |
| 그 외 | 빈 문자열 |


### 6.5 검증 규칙 (제출 시 일괄 실행)

| # | 조건 | 대상 | 메시지 |
| --- | --- | --- | --- |
| 1 | 선박명 공백 | name | 선박명을 입력해주세요 |
| 2 | IMO가 정확히 숫자 7자리가 아님 (/^\d{7}$/) | imo | IMO 번호 7자리를 입력해주세요 |
| 3 | 선적국 공백 | flag | 선적국을 입력해주세요 |
| 4 | 건조년도 없음 또는 < 1950 | buildYear | 건조년도를 입력해주세요 |
| 5 | 총톤수 없음 또는 ≤ 0 | grossTonnage | 총톤수를 입력해주세요 |
| 6 | 전장 없음 또는 ≤ 0 | lengthOverall | 전장을 입력해주세요 |
| 7 | 선폭 없음 또는 ≤ 0 | beam | 선폭을 입력해주세요 |
| 8 | 최대 흘수 없음 또는 ≤ 0 | maxDraft | 최대 흘수를 입력해주세요 |
| 9 | 현재 흘수 없음 또는 ≤ 0 | currentDraft | 현재 흘수를 입력해주세요 |
| 10 | 현재 흘수 > 최대 흘수 | currentDraft | 현재 흘수는 최대 흘수를 초과할 수 없습니다 |
| 11 | 엔진 출력 없음 또는 ≤ 0 | enginePower | 엔진 출력을 입력해주세요 |
| 12 | 노후 계수 없음 또는 < 1 | foulingFactor | 노후 계수는 1.00 이상이어야 합니다 |
| 13 | 기준 속도 없음 또는 ≤ 0 | designSpeedKnots | 기준 속도를 입력해주세요 |
| 14 | 기준 연료소모 없음 또는 ≤ 0 | designSpeedFuelTon | 기준 속도 연료소모량을 입력해주세요 |


9번과 10번은 같은 필드(currentDraft)를 대상으로 하며 순서상 10번이 나중에 실행되어 덮어쓴다.

필드를 다시 편집하면 해당 필드의 오류만 즉시 지운다.

### 6.6 제출 처리
handleSubmit():
  if (!validate()) return
  isEditing = (mode === 'view' && vessel 존재)

  결과 Vessel = {
    id:       isEditing ? 기존 id : `v${Date.now()}`
    name:     trim 적용
    flag:     trim + 대문자
    company:  isEditing ? 기존 값 : 자사명 상수('KSF Line')      # ★ 입력 필드 없음
    fuelCurve: isEditing
                 ? 기존 fuelCurve 그대로                          # ★ 재계산하지 않음
                 : buildFuelCurve(기준속도, 기준연료)             # 8.1장
    ...나머지 수치 필드는 Number() 변환
  }
  onSubmit(결과)
  if (isEditing) 모달 닫기        # 등록 모드는 부모가 닫음

fuelCurve를 수정 시 재계산하지 않는 이유: 기준 속도·연료소모량은 수정 화면에서 잠겨 있으므로 값이 항상 동일하다. 그런데도 재계산하면 반올림 오차로 최초 등록 곡선과 미세하게 달라질 수 있고, 그러면 이미 산출된 AI 리포트의 연료·CO₂ 수치와 어긋난다. 등록 시점 커브를 그대로 보존한다.



## 7. 필드 잠금 정책
이 화면의 가장 중요한 비즈니스 규칙이다(요구사항 FR-305).

### 7.1 항상 잠기는 필드 (등록 후 영구 수정 불가)
ALWAYS_LOCKED = [imo, buildYear, type, grossTonnage, lengthOverall,
                 beam, maxDraft, enginePower, designSpeedKnots, designSpeedFuelTon]

두 부류로 나뉜다.


| 부류 | 필드 | 잠그는 이유 |
| --- | --- | --- |
| 진수 시점에 확정되는 물리적 스펙 | IMO · 건조년도 · 선종 · 총톤수 · 전장 · 선폭 · 최대 흘수 · 엔진출력 | 선박의 물리적 실체이므로 사후에 바뀔 수 없다 |
| AI 리포트 계산의 기초값 | 기준 속도 · 기준 속도 연료소모량 | 변경 시 이미 산출된 리포트 수치와 어긋난다 |


### 7.2 조건부 잠금

| 필드 | 조건 |
| --- | --- |
| status(운항 상태) | 활성 항차(운항 중·지연)가 있으면 잠금 — 실제로 바다에 떠 있는 선박을 "정비 중"으로 바꿔버리는 데이터 불일치를 막기 위함 |


### 7.3 항상 수정 가능한 필드
선박명 · 선적국 · 현재 흘수 · 선체 노후 계수 — 운영 중에도 계속 갱신돼야 하는 값이므로 상태와 무관하게 항상 편집 가능하다.

### 7.4 판정 함수
isFieldEditable(key):
  if (mode === 'create')            return true      # 등록 시엔 전부 입력 가능
  if (ALWAYS_LOCKED.includes(key))  return false
  if (key === 'status' && hasActiveVoyage) return false
  return true

요약표


| 필드 | create | view (활성 항차 없음) | view (활성 항차 있음) |
| --- | --- | --- | --- |
| 선박명 · 선적국 · 현재 흘수 · 노후 계수 | ✅ | ✅ | ✅ |
| 운항 상태 | ✅ | ✅ | ❌ |
| IMO · 건조년도 · 선종 · 총톤수 · 전장 · 선폭 · 최대 흘수 · 엔진출력 · 기준 속도 · 기준 연료소모 | ✅ | ❌ | ❌ |




## 8. 핵심 계산 로직

### 8.1 연료 커브 자동 생성 (해군 배수량 법칙)
선박의 연료 소모량은 속도의 세제곱에 비례한다는 해군 배수량 법칙(Admiralty rule) 근사를 사용한다.

buildFuelCurve(designSpeed, designFuel):
  offsets = [-4, -2, 0, +2, +4, +6]
  return offsets
    .map(o => designSpeed + o)
    .filter(speed => speed > 0)                # ★ 0 이하 속도는 제외
    .map(speed => ({
        speedKnots:    speed,
        fuelTonPerDay: round(designFuel · (speed / designSpeed)³)
      }))

검산 — 기준 속도 14kts, 기준 연료 112 ton/day(샘플 v001)를 넣으면:


| 속도(kts) | 계산 | 결과 |
| --- | --- | --- |
| 10 | 112 × (10/14)³ = 112 × 0.3644 | 41 |
| 12 | 112 × (12/14)³ = 112 × 0.6297 | 71 |
| 14 | 112 × 1 | 112 |
| 16 | 112 × (16/14)³ = 112 × 1.4927 | 167 |
| 18 | 112 × (18/14)³ = 112 × 2.1254 | 238 |
| 20 | 112 × (20/14)³ = 112 × 2.9155 | 327 |


주의: 위 계산 결과는 3.2장의 v001 샘플 커브 (10→52, 12→78, 14→112, 16→158, 18→215, 20→285)와 일치하지 않는다. 샘플 커브는 실제 선박 데이터를 참고해 손으로 작성한 것이고, 자동 생성 함수는 신규 등록 시에만 쓰이기 때문이다. 둘 다 그대로 두는 것이 원본과 동일하다 — 샘플 5척은 표의 값을 그대로 쓰고, 사용자가 새로 등록한 선박만 세제곱 법칙으로 생성된다.

커브 지점 수가 선박마다 다른 이유: filter(speed > 0) 때문이다. 기준 속도가 4 이하이면 첫 지점이 잘려 5개 이하가 된다. 샘플에서 v003(bulk, 기준 13kts)이 4개 지점인 것은 손으로 작성한 데이터라서이며, 자동 생성 로직과는 무관하다.

### 8.2 활성 항차 조회
activeVoyage(vesselId) =
  voyages.find(v => v.vesselId === vesselId && ['underway','delayed'].includes(v.status))

카드에서는 각 선박마다 이 조회를 수행해 "운항 중: A → B" 줄의 표시 여부를 결정한다.
상세 패널에서는 선택된 선박에 대해서만 수행해 "현재 운항 항차" 섹션과 모달의 hasActiveVoyage prop(7.2장)에 함께 사용한다.

### 8.3 항구명 축약
카드와 상세 패널의 항로 표시는 항구 라벨의 공백 기준 첫 토큰만 쓴다.

"부산 (Busan)" → split(' ')[0] → "부산"
"로스앤젤레스 (Los Angeles)" → "로스앤젤레스"

### 8.4 숫자 포맷
총톤수·엔진출력: toLocaleString() (천단위 콤마)
노후 계수: toFixed(2) — 항상 소수 2자리(×1.04)
흘수·전장·선폭: 원본 숫자 그대로(추가 포맷 없음)



## 9. 다국어 텍스트 전체 사전
t.vessel.* — 화면 본체에만 적용된다(6장 모달은 한국어 하드코딩).


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 선박 관리 | Fleet Management |
| subtitle | 선박 프로필 및 엔진 스펙 관리 | Vessel profiles and engine specifications |
| addVessel | 선박 등록 | Add Vessel |
| searchPlaceholder | 선박명, IMO 번호 검색 | Search vessel name, IMO |
| typeContainer | 컨테이너선 | Container |
| typeBulk | 벌크선 | Bulk |
| typeTanker | 탱커선 | Tanker |
| typeRoro | 로로선 | RoRo |
| specs | 기본 제원 | Specifications |
| fuelCurve | 연료 소모 커브 | Fuel Consumption Curve |
| activeVoyage | 현재 운항 항차 | Current Voyage |
| underway | 운항 중 | Underway |
| grossTonnage | 총톤수 | GT |
| draft | 흘수 | Draft |
| loa | 전장 | LOA |
| fouling | 노후 계수 | Fouling Factor |
| flag | 선적국 | Flag |
| beam | 선폭 | Beam |
| maxDraft | 최대 흘수 | Max Draft |
| curDraft | 현재 흘수 | Current Draft |
| enginePower | 엔진 출력 | Engine Power |
| hullFouling | 선체 노후 계수 | Hull Fouling Factor |
| speedCol | 속도 (kts) | Speed (kts) |
| consumeCol | 소모 (ton/day) | Consumption (t/day) |
| speed | 속도 | Speed |


t.status.* (상태 배지)


| 키 | 한국어 | English |
| --- | --- | --- |
| active | 운항 가능 | Available |
| maintenance | 정비 중 | Maintenance |
| idle | 대기 중 | Idle |


모달 하드코딩 문자열 목록(원본 그대로 재현용) — 라벨: 선박명 / IMO 번호 / 선종 / 선적국 / 건조년도 / 총톤수 (GT) / 전장(LOA, m) / 선폭 (m) / 최대 흘수 (m) / 현재 흘수 (m) / 엔진 출력 (kW) / 선체 노후 계수 / 운항 상태 / 기준 속도 (kts) / 기준 속도 연료소모 (ton/day). 선종 옵션: 컨테이너선 / 벌크선 / 탱커선 / 로로선. 상태 옵션: 운항 가능 / 정비 중 / 대기. 버튼: 취소 / 선박 등록 / 저장. 오류 메시지 14종은 6.5장 표 참조.



## 10. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 — 버튼 배경, 카드 선택 테두리·링, Anchor 아이콘, 차트 라인·영역, "현재 운항 항차" 블록, 모달 헤더 아이콘 배경(15% 투명도), 안내 배너(8% 투명도). hover는 #4f46e5.

선박 상태 배지(VesselBadge) — 알약형 rounded-full px-2 py-0.5 text-xs font-medium:


| status | 클래스 |
| --- | --- |
| active | bg-green-100 text-green-700 |
| maintenance | bg-yellow-100 text-yellow-700 |
| idle | bg-slate-100 text-slate-600 |


경고 색:

노후 계수 초과(> 1.07) → text-orange-600 / 다크 text-orange-400
정비 중 아이콘(Wrench) → text-yellow-500
차트 markLine → #f59e0b(호박)

카드 스타일: rounded-xl border p-4, 흰 배경(다크 slate-800). 선택 시 인디고 테두리 + shadow-md + ring-1 ring-[#6366f1]/30.

상세 패널: 폭 w-72(288px), 좌측 보더, 헤더는 sticky top-0 + bg-slate-50(다크 slate-800/60).

타이포: 페이지 타이틀 16px bold / 카드 선박명 14px semibold / 카드 부제·제원 12px / 패널 소제목 12px semibold / 패널 값 12px.

간격: 페이지 좌우 패딩 24px, 카드 그리드 간격 12px(gap-3), 패널 섹션 간 16px(space-y-4), 모달 블록 간 20px(space-y-5).

아이콘 세트: lucide-react. 이 화면에서 쓰인 아이콘 — Plus, Search, Anchor, Wrench, Pencil, X, Ship, Flag, Ruler, Gauge, Calendar, Activity.

다크 모드: 모든 배경/텍스트/테두리에 dark: variant를 함께 정의하고, 차트 색은 5장 표대로 런타임에 스위칭한다.



## 11. 엣지 케이스 및 불변식
재구현 시 특히 놓치기 쉬운 항목들이다.

노후 계수 경고는 > 1.07 초과 비교다. >=로 구현하면 샘플 v002(정확히 1.07)까지 주황색이 되어 원본과 달라진다.
카드 클릭은 토글이다. 선택된 카드를 다시 누르면 선택이 해제되고 상세 패널이 닫힌다.
상세 패널은 선택이 있을 때만 DOM에 존재한다. 숨김 처리(hidden)가 아니라 조건부 렌더링이므로, 패널이 없을 때 카드 그리드가 가로 폭 전체를 차지한다.
fuelCurve는 수정 시 재계산하지 않는다(6.6장 주의 참고). 반올림 오차로 AI 리포트 수치와 어긋나는 것을 막기 위함이다.
company 필드는 입력 UI가 없다. 등록 시 자사명 상수로 자동 부여되고, 수정 시 기존 값을 보존한다.
IMO 입력은 실시간으로 숫자만 남기고 7자리에서 자른다. 검증(/^\d{7}$/)은 제출 시 한 번 더 한다.
선적국은 실시간으로 2자리 대문자화된다. 제출 시 trim().toUpperCase()를 한 번 더 적용한다.
일부 필드에는 disabled 바인딩이 아예 없다. 원본에서 flag(선적국) · currentDraft(현재 흘수) · foulingFactor(노후 계수)는 disabled 속성 자체가 붙어 있지 않다. 셋 다 "항상 수정 가능" 그룹이라 결과적인 동작은 정상이지만, 같은 그룹인 name(선박명)에는 disabled={!isFieldEditable('name')}이 붙어 있어 코드상 일관성이 없다. 전부 붙이든 전부 빼든 화면 동작은 동일하다.
현재 흘수 > 최대 흘수 검증은 같은 필드에 두 번째 메시지를 덮어쓴다. 값이 비어 있으면 "현재 흘수를 입력해주세요", 값이 있는데 초과면 "현재 흘수는 최대 흘수를 초과할 수 없습니다"가 표시된다.
활성 항차 판정은 underway와 delayed 두 가지만 포함한다. preparing은 아직 출발 전이므로 운항 상태를 잠그지 않는다.
ECharts는 반드시 ssr: false로 동적 import 한다. App Router에서 정적 import하면 서버 렌더링 단계에서 깨진다.
차트에 notMerge를 켠다. 끄면 선박을 바꿀 때 이전 선박의 옵션(특히 markLine 라벨)이 남는다.
차트 markLine 라벨은 평균값이 아니라 노후 계수를 표시한다(5장 주의 참고).
모달 오버레이는 자기 자신을 클릭했을 때만 닫는다. e.target === e.currentTarget 검사가 없으면 모달 내부 클릭에도 닫힌다.
이 모달은 다국어를 지원하지 않는다(6장 주의 참고). 화면 본체만 t.vessel.* 를 쓴다.
선종 라벨이 화면과 항차 모달에서 다르다 — 이 화면은 "컨테이너선", 항차 등록 모달은 "컨테이너". 두 화면을 함께 만든다면 의도된 차이임을 알고 유지하거나, 통일하되 일관되게 적용한다.



## 12. 재구현 체크리스트
데이터 모델(Vessel + FuelPoint) + 샘플 선박 5척(제원·커브 전체) 입력
(선택) 항차 최소 필드 + 샘플 3건 — "현재 운항 항차" 표시용
페이지 3단 레이아웃(헤더 고정 / 검색 바 고정 / 본문 가로 분할)
검색 필터(선박명 · IMO 부분 일치)
반응형 카드 그리드(1 → 2 → 3 → 4열) + 선택 토글 + 선택 시 인디고 테두리·링
카드 내부 — 상태별 아이콘(Anchor/Wrench) · 상태 배지 · 제원 4칸 · 노후 계수 > 1.07 주황 경고
카드 하단 "운항 중: A → B" 조건부 블록
상세 패널(288px, sticky 헤더, 수정 연필 버튼)
기본 제원 9줄 라벨-값 목록
연료 소모 커브 표(속도 / 소모량 2열)
ECharts 라인 차트(ssr:false 동적 import, 그라디언트 영역, 점 라벨, 노후 계수 markLine, 테마 연동)
"현재 운항 항차" 인디고 박스(조건부)
등록 모달 — 15개 입력 필드(6.3장 ①~⑥) + 모드별 안내 배너
IMO 숫자 7자리 마스킹 · 선적국 2자리 대문자 마스킹
검증 14종 + 필드별 오류 메시지 + 개별 오류 초기화
제출 처리(신규만 buildFuelCurve 실행, 수정 시 기존 커브 보존, company 자동 부여)
필드 잠금 정책(항상 잠금 10개 / 활성 항차 시 상태 잠금 / 항상 수정 가능 4개) + 상태 잠금 안내 문구
다국어(ko/en) — 화면 본체만 적용, 모달은 한국어 고정
다크 모드 대응(차트 색 런타임 스위칭 포함)

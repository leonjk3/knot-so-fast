
# 물류 시뮬레이션 — 단독 기능 명세서 (Logistics What-if Simulation)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "물류 시뮬레이션" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 원본 프로젝트의 다른 화면(대시보드·물류 일정·선박 관리·AI 운항 리포팅·탄소 배출 등)에 전혀 의존하지 않습니다. 딥링크도 없어 7개 화면 중 가장 독립적이며, 필요한 것은 항차·선박 데이터뿐입니다.

선행 문서: 프로젝트 세팅(프로젝트 생성·의존성·테마·공통 셸)은 BOOTSTRAP.md를 먼저 끝낸 뒤 이 문서를 시작한다. 구현 중 막히면 KNOWN_PITFALLS.md의 증상 인덱스에서 찾는다.

해커톤 원칙: 16장, 89장은 화면이 100% 정상 동작하기 위한 Must 항목입니다. 7장(PDF 내보내기)은 없어도 화면이 완결되므로 시간이 부족하면 버튼째 생략해도 됩니다. 10장(엣지 케이스)은 시간이 남을 때 확인합니다.



## 목차
개요
접근 권한
데이터 모델
화면 구성
핵심 계산 로직
차트 명세
PDF 내보내기
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
운항 중이거나 준비 중인 항차 1건을 골라, 출발 시점·속도·적재율·항로·항만 대기 조건을 바꿔가며 연료·비용·CO₂·도착 시각이 어떻게 달라지는지 가상으로 분석한다(What-if). 결과는 현재 계획 및 과거 완료 항차와 3원 비교하고, PDF 리포트로 내보낼 수 있다.

### 1.2 핵심 개념
초안(draft) vs 적용(applied) — 이 화면의 가장 중요한 구조. 좌측 폼의 컨트롤을 조작하면 화면의 입력값은 즉시 바뀌지만, 우측 결과·차트·PDF는 "시뮬레이션 실행" 버튼을 눌러야만 갱신된다. 두 상태가 다르면 "조건이 변경되었습니다" 힌트를 띄운다.
3원 비교: ① 현재 계획 ② 시뮬레이션 결과 ③ (선택) 과거 완료 항차 실적.
항만 대기 2요소: 도착항 번잡도(등급별 고정 대기) + 앞 선박의 하역 진행률(잔여 비례 대기). 이 둘의 합이 ETA를 늦추고 대기 비용을 발생시킨다.
항로 2종: 수에즈 운하(통과료 있음, 거리 짧음) vs 희망봉 우회(통과료 없음, 거리 1.28배).

### 1.3 이 화면만의 연료 모델 (중요)
이 화면은 선박의 fuelCurve를 쓰지 않는다. 다른 화면(VESSEL.md · CARBON.md · DASHBOARD.md)은 선박별 실측 연료 커브를 보간해 계산하지만, 이 화면은 모든 선박에 공통으로 적용되는 단순 3제곱 법칙 모델을 쓴다 (5.3장).

그래서 같은 항차라도 이 화면의 연료·CO₂ 값은 다른 화면과 일치하지 않는다. 이는 버그가 아니라 "가정을 바꿔가며 비교하는" 시뮬레이션의 성격상 의도된 단순화다. 재구현 시에도 이 모델을 그대로 쓴다.



## 2. 접근 권한
RBAC가 있는 시스템이라면 ADMIN, LOGISTICS(물류 담당자) 역할만 접근 가능하도록 사이드바/라우팅에 노출한다. CAPTAIN, CLIENT에는 노출하지 않는다.
별도 프론트 전용 데모 앱으로 만든다면 이 제약은 생략해도 무방하다.



## 3. 데이터 모델

### 3.1 타입 정의
type PortCongestion = 'low' | 'medium' | 'high' | 'severe'

// 시뮬레이션 입력 8종 — 초안·적용 두 벌로 관리한다
interface SimInputs {
  voyageId: string
  departureOffset: number      // 시간 단위, -24 ~ +72
  speedKnots: number           // 10 ~ 20
  cargoPercent: number         // 30 ~ 100
  route: 'suez' | 'cape'
  portCongestion: PortCongestion
  berthProgress: number        // 0 ~ 100 (%)
  compareVoyageId: string      // 빈 문자열이면 비교 안 함
}

// 계산 결과 3종(현재 계획·시뮬레이션·과거)이 공유하는 형태
interface SimulationResult {
  fuel: number    // ton
  days: number    // 항해 일수
  cost: number    // USD
  co2: number     // ton
}

이 화면이 항차·선박에서 실제로 읽는 필드는 아래가 전부다.

interface Voyage {
  id: string
  vesselId: string
  departurePort: string        // "부산 (Busan)" 형태
  arrivalPort: string
  etd: string                   // ISO — 시뮬레이션 ETA의 기준점
  eta: string                   // ISO — "현재 계획 ETA" 표시용
  status: 'preparing' | 'underway' | 'delayed' | 'completed' | 'cancelled'
  plannedSpeedKnots: number
  distanceNm: number
}

interface Vessel { id: string; name: string; imo: string }

fuelCurve는 필요 없다(1.3장). 선박은 이름과 IMO 표시 용도로만 쓰인다.

원본에 SimulationScenario 타입이 정의되어 있으나 이 화면은 쓰지 않는다. 사용하지 않는 잔재이니 재구현 시 만들지 않아도 된다.

### 3.2 재현용 상수 (그대로 사용 권장)
FUEL_PRICE_USD_TON      = 580        // 연료 단가
CANAL_TOLL_USD          = 420_000    // 수에즈 운하 통과료
CAPE_DISTANCE_FACTOR    = 1.28       // 희망봉 우회 시 거리 배수
BASE_FUEL_PER_DAY       = 140        // 기준 속도(14kts)에서의 일일 연료 소모량(ton)
REFERENCE_SPEED_KNOTS   = 14         // 3제곱 법칙의 기준 속도
CO2_FACTOR              = 3.114      // 연료 1톤당 CO₂ 배출량(HFO 기준, 고정)

AVG_BERTH_UNLOAD_HOURS  = 30         // 선석 하역 총 소요시간(진행률 0%일 때의 대기)
WAIT_COST_USD_PER_HOUR  = 3_000      // 항만 대기 1시간당 비용

CONGESTION_WAIT_HOURS = { low: 0, medium: 8, high: 20, severe: 40 }

SPEED_RANGE = [10, 10.5, 11, ... , 20]     // 0.5 간격 21개 — 속도 커브 차트용

CO2_FACTOR가 3.114로 고정되어 있다. 다른 화면은 연료 종류(HFO/MGO/LNG)별 계수를 쓰지만 이 화면은 항상 HFO 기준이다.

### 3.3 폼 기본값
departureOffset : 0
speedKnots      : 14
cargoPercent    : 80
route           : 'suez'
portCongestion  : 'medium'
berthProgress   : 60
voyageId        : voyages[0].id                    // ★ 후보 목록이 아니라 전체 항차의 첫 번째
compareVoyageId : 완료 항차 첫 번째의 id (없으면 '')

cargoPercent의 기본값 80은 의미가 있다 — 흘수 보정 계수의 기준점이라 80%일 때 보정이 정확히 1.0이 된다(5.3장).

### 3.4 항차·선박 데이터
SCHEDULE.md 3.3~3.4장의 선박 5척·항차 8건을 그대로 쓴다. 이 화면에는 완료 항차가 반드시 3건 이상 필요하다(비교 대상 드롭다운) — 샘플의 voy006·voy007·voy008이 그 역할을 한다.

### 3.5 데이터 소스
SCHEDULE.md 3.5장과 동일 — mock 전용이 기본 권장. 이 화면은 읽기 전용이라 등록·수정 API가 전혀 필요 없다.



## 4. 화면 구성
전체 페이지는 세로 flex(flex flex-col h-full). 상단 고정 헤더 + 스크롤 영역(flex-1 overflow-y-auto px-6 py-4) 구조이며, 스크롤 영역 안은 좌우 2열(grid lg:grid-cols-2 gap-6)이다.


| 열 | 내용 |
| --- | --- |
| 좌 | 시뮬레이션 조건 폼 (카드 1장, space-y-5) |
| 우 | 결과 카드 4장 (space-y-4) — 절감 효과 · 도착 일시 · 비교 차트 · 속도 커브 |


카드 공통: bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800.

### 4.1 페이지 헤더
공용 PageHeader(높이 64px 고정). 타이틀 "물류 시뮬레이션", 부제 "출발 시점·항로·적재량 변경 시 연료비·탄소 변화를 가상으로 분석합니다". 우측 액션 버튼은 없다.

### 4.2 조건 폼 — 헤더
FlaskConical 아이콘(인디고) + "시뮬레이션 조건"(14px semibold).

### 4.3 대상 항차 선택
라벨(12px font-medium 회색): "대상 항차"
<select> 옵션: `${선박명} · ${출발항 첫 토큰} → ${도착항 첫 토큰}`
후보는 preparing 또는 underway 상태만이다.

delayed는 후보에서 제외된다(원본 그대로). 이미 지연된 항차는 what-if 대상이 아니라는 판단.

### 4.4 출발 시점 조정 (슬라이더)
라벨 행: 좌측 "출발 시점 조정", 우측에 현재 값 라벨(12px 회색)


| 조건 | 라벨 |
| --- | --- |
| > 0 | +{n}시간 지연 |
| < 0 | {n}시간 앞당김 (음수 그대로 — 예: -12시간 앞당김) |
| = 0 | 변경 없음 |


<input type="range" min={-24} max={72} step={6}>, accent-[#6366f1]

슬라이더 아래 3점 눈금(12px 회색, 좌/중/우 배치): -24h / 0 / +72h

### 4.5 항해 속도 (슬라이더)
라벨 행: 좌측 "항해 속도", 우측 {n} kts(12px semibold 인디고)
min={10} max={20} step={0.5}
아래 눈금 2개: 10 kts (슬로우 스팀) / 20 kts (최대)

### 4.6 화물 적재율 (슬라이더)
라벨 행: 좌측 "화물 적재율", 우측 {n}%(12px semibold 인디고)
min={30} max={100} step={5}
눈금 없음

### 4.7 항로 선택 (2열 버튼)
grid grid-cols-2 gap-2, 각 버튼은 좌측 정렬 px-3 py-2.5 rounded-lg border text-xs.


| value | 제목(semibold) | 부제(회색) |
| --- | --- | --- |
| suez | 수에즈 운하 | +$420k 통과료 · {거리} nm |
| cape | 희망봉 우회 | 통과료 없음 · {거리×1.28 반올림} nm |


선택된 버튼: border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1]. 비선택: 회색 테두리.

부제의 거리는 선택된 항차의 distanceNm 기준으로 실시간 계산해 표시한다.

### 4.8 예상 접안 대기 (구분선 아래 하위 섹션)
상단 구분선(border-t) 후 Anchor 아이콘(회색) + "예상 접안 대기"(12px semibold 회색).

① 도착항 번잡도 — grid grid-cols-4 gap-1.5 버튼 4개(11px):


| value | 라벨 | 대기 시간 |
| --- | --- | --- |
| low | 원활 | 0h |
| medium | 보통 | 8h |
| high | 혼잡 | 20h |
| severe | 매우 혼잡 | 40h |


선택 스타일은 항로 버튼과 동일. 아래에 힌트(12px 회색): 평균 대기 +{n}h

② 접안 예정 선석의 타선박 하역 진행률 — 슬라이더

라벨 행: 좌측 "접안 예정 선석의 타선박 하역 진행률", 우측 {n}%(semibold 인디고)
min={0} max={100} step={5}
아래 힌트(12px 회색): 잔여 대기 예상 {n}h(소수 1자리)

두 힌트는 "적용" 값이 아니라 "초안" 값 기준으로 즉시 갱신된다. 슬라이더를 움직이면 바로 반응해야 조작감이 자연스럽기 때문이다(5.2장 참고).

### 4.9 비교할 기존 운항기록
라벨: "비교할 기존 운항기록"
완료 항차가 있으면 <select>(옵션 형식은 4.3장과 동일)
완료 항차가 하나도 없으면 select 대신 회색 문구 "기존 운항기록 없음"(12px)

### 4.10 변경 힌트와 실행 버튼
변경 힌트(초안 ≠ 적용일 때만): 호박색 12px 문구 + 앞에 깜빡이는 점 (w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse) —

"조건이 변경되었습니다 · 실행을 눌러 반영하세요"

버튼 행(flex gap-2):

시뮬레이션 실행(flex-1): PlayCircle 아이콘 + 라벨.
변경됨 → 인디고 배경(hover #4f46e5)
변경 없음 → 회색 배경 + cursor-default(비활성처럼 보이지만 disabled는 아니다)
PDF로 다운로드: Download 아이콘 + 라벨, 아웃라인 스타일. title="조건·결과·비교표를 담은 리포트를 PDF로 저장합니다"

### 4.11 절감 효과 카드
테두리 색이 결과에 따라 바뀐다 — 비용 절감이 양수면 초록(border-green-200), 아니면 빨강 (border-red-200). 배경은 없다(투명).

제목 "현재 계획 대비 절감 효과"(14px semibold). 아래 grid grid-cols-3 gap-3, 각 칸 가운데 정렬:


| # | 아이콘 | 라벨 | 값 |
| --- | --- | --- | --- |
| 1 | Fuel | 연료 | {±}{절댓값} ton |
| 2 | DollarSign | 비용 | {±}${절댓값/1000}k |
| 3 | TrendingDown | CO₂ | {±}{절댓값} ton |


부호 규칙: 절감(양수)이면 -, 증가(음수)면 + 를 앞에 붙인다.

직관과 반대로 보이지만 의도된 것이다 — "연료를 덜 쓴다"를 -로 표현한다.

색: 절감이면 초록(text-green-700), 증가면 빨강(text-red-600). 아이콘도 같은 색.
값은 18px bold, 라벨은 12px 회색.

### 4.12 예상 도착 일시 카드
Clock 아이콘 + 제목 "예상 도착 일시"(14px semibold).

grid grid-cols-2 gap-3:


|  | 좌 | 우 |
| --- | --- | --- |
| 라벨(12px 회색) | 현재 계획 ETA | 시뮬레이션 ETA |
| 값 | voyage.eta 로컬 문자열(회색) | 계산된 ETA(인디고) |
| 부가(12px 회색) | {n}일 소요 | {n}일 소요 |


날짜는 toLocaleString('ko-KR') 고정.

항만 대기 행(대기 시간 > 0일 때만): 상단 구분선 후 좌우 배치(12px) — 좌측 Anchor 아이콘 + "예상 접안 대기"(회색), 우측 +{n}h · 대기 비용 약 ${n}(호박색 semibold).

### 4.13 비교 차트 카드
제목 "연료 · 비용 · CO₂ 비교"(14px semibold). 아래 높이 208px(h-52) 막대 차트(6.1장).

### 4.14 속도 커브 카드
제목 행(좌우 배치): 좌측 "속도별 연료 소모 커브"(14px semibold), 우측에 범례 2개(12px) — — 호박색 선 + "계획 속도", — 에메랄드 선 + "시뮬레이션".

아래 높이 192px(h-48) 라인 차트(6.2장).



## 5. 핵심 계산 로직

### 5.1 초기화
useEffect(deps: [voyages.length]):
  if (applied 이미 있음 || voyages 비어 있음) return
  기본값 = { voyageId: voyages[0].id, departureOffset: 0, speedKnots: 14,
            cargoPercent: 80, route: 'suez', portCongestion: 'medium',
            berthProgress: 60, compareVoyageId: 완료항차[0]?.id ?? '' }
  초안의 voyageId·compareVoyageId를 채우고, applied에 기본값 전체를 넣는다

applied가 아직 null이면 → "불러오는 중..." 텍스트만 렌더링하고 조기 반환

의존성을 voyages.length로 둔 것은 데이터 로딩 완료 시점에 딱 한 번만 반영하기 위함이다 (mock 전용이면 []로 두어도 된다).

### 5.2 초안 vs 적용 상태
이 화면의 핵심 구조다.

초안 상태 8개 : voyageId, departureOffset, speedKnots, cargoPercent,
                route, portCongestion, berthProgress, compareVoyageId
적용 상태 1개 : applied: SimInputs | null

runSimulation() = setApplied({ ...현재 초안 8개 전부 })

isDirty = 8개 필드 중 하나라도 applied와 다르면 true

모든 결과·차트·PDF는 applied만 참조한다. 초안 값은 폼 컨트롤 표시와 4.8장의 두 힌트에만 쓴다.
초안 값을 결과 계산에 섞어 쓰면 안 된다. 원본에서 비교 항차 선택이 즉시 반영되던 것을 "실행 버튼을 눌러야 반영"으로 고친 이력이 있다(PROMPTS #154).

### 5.3 연료 계산 모델
해군 배수량 법칙(속도³ 비례) 기반의 단순 모델이다. 선박별 연료 커브를 쓰지 않는다.

calcFuel(distanceNm, speedKnots, baseFuelPerDay, draftFactor):
  days = distanceNm / (speedKnots × 24)
  return baseFuelPerDay × (speedKnots / 14)³ × days × draftFactor

baseFuelPerDay는 항상 140(모든 선박 공통)

기준 속도 14kts — 이 속도에서 배수가 정확히 1이 된다

흘수 보정 계수:

draftFactor = 1 + (cargoPercent - 80) × 0.003

적재율 80%에서 1.0, 100%에서 1.06, 30%에서 0.85가 된다.

속도를 올리면 일일 소모량은 세제곱으로 늘지만 항해 일수는 반비례로 준다. 순효과는 속도의 제곱에 비례해 총 연료가 증가한다 — 그래서 속도 커브가 우상향 곡선이 된다.

### 5.4 거리와 통과료
routeDistance = route === 'suez' ? voyage.distanceNm : voyage.distanceNm × 1.28
canalCost     = route === 'suez' ? 420_000 : 0

### 5.5 항만 대기
congestionWaitHours = CONGESTION_WAIT_HOURS[portCongestion]          // 0 / 8 / 20 / 40
berthWaitHours      = max(0, ((100 - berthProgress) / 100) × 30)     // 진행률 0% → 30h
portWaitHours       = congestionWaitHours + berthWaitHours
portWaitCost        = portWaitHours × 3_000

기본값(medium + 60%)이면 8 + 12 = 20h, 비용 $60,000이 된다.

### 5.6 세 가지 결과
① 현재 계획(planned) — 원래 계획 속도로, 원래 거리를 갔을 때

fuel = calcFuel(voyage.distanceNm, voyage.plannedSpeedKnots, 140, draftFactor)
days = voyage.distanceNm / (voyage.plannedSpeedKnots × 24)
cost = fuel × 580 + canalCost
co2  = fuel × 3.114

주의: draftFactor는 시뮬레이션 입력의 적재율을 그대로 쓰고, canalCost도 시뮬레이션에서 선택한 항로를 따른다. 즉 "현재 계획"은 완전히 고정된 기준선이 아니라 일부 입력에 함께 반응한다 (10장 3번 참고).

② 시뮬레이션(simulated)

fuel = calcFuel(routeDistance, speedKnots, 140, draftFactor)
days = routeDistance / (speedKnots × 24)

etd  = voyage.etd에 departureOffset 시간을 더한 값
eta  = etd + (days × 24 + portWaitHours) 시간

cost = fuel × 580 + (route === 'cape' ? 0 : canalCost) + portWaitCost
co2  = fuel × 3.114

③ 과거 실적(historical) — 비교 항차가 선택된 경우만, 아니면 null

fuel = calcFuel(compareVoyage.distanceNm, compareVoyage.plannedSpeedKnots, 140, 1)
                                                                              ↑ ★ 항상 1
days = compareVoyage.distanceNm / (compareVoyage.plannedSpeedKnots × 24)
cost = fuel × 580                    // ★ 통과료·대기비용 없음
co2  = fuel × 3.114

과거 항차는 draftFactor를 1로 고정한다 — 실측 적재율 데이터가 없어 표준 적재를 가정한다. 통과료와 대기 비용도 붙이지 않는다.

### 5.7 절감 효과
saving.fuel = planned.fuel - simulated.fuel
saving.cost = planned.cost - simulated.cost
saving.co2  = planned.co2  - simulated.co2

양수 = 절감(화면에 - 부호로 표시), 음수 = 증가(+ 로 표시).



## 6. 차트 명세
두 차트 모두 Apache ECharts이며 반드시 SSR을 끄고 동적 import 한다 (dynamic(() => import('echarts-for-react'), { ssr: false })). notMerge를 켜서 조건을 바꿔 다시 실행했을 때 이전 옵션이 남지 않게 한다.

테마 연동 색상(두 차트 공통)


| 용도 | 라이트 | 다크 |
| --- | --- | --- |
| 축·격자선 | #e2e8f0 | #334155 |
| 축 라벨 | #64748b | #94a3b8 |
| 툴팁 배경 | #ffffff | #1e293b |
| 툴팁 테두리 | #e2e8f0 | #334155 |
| 툴팁 글자 | #334155 | #e2e8f0 |


### 6.1 비교 막대 차트
backgroundColor: 'transparent'
animation: true, animationDuration: 900, animationEasing: 'elasticOut'   # ★ 탄성 효과
grid: { top: 28, right: 8, bottom: 24, left: 8, containLabel: true }
legend: { top: 4, itemWidth: 12, itemHeight: 8, 11px }
tooltip: { trigger: 'axis' }

xAxis: type 'category'
  data = ['현재 계획', '시뮬레이션', ...(과거 실적이 있으면 '기존 항차 실적')]
  axisLabel: 12px bold                              # ★ 다른 축보다 굵게
  axisTick 숨김

yAxis: type 'value', splitLine 점선, axisLabel 11px

series 3개 — 모두 type 'bar', barMaxWidth 44, itemStyle.borderRadius [6,6,0,0]
             label: { show: true, position: 'top', 10px }


| # | 계열명 | 그라디언트(세로) | 값 | 라벨 형식 |
| --- | --- | --- | --- | --- |
| 1 | 연료 (ton) | #67e8f9 → #6366f1 | 연료 반올림 | {n} |
| 2 | 비용 (천$) | #c084fc → #7c3aed | 비용/1000 반올림 | ${n}k |
| 3 | CO₂ (ton) | #4ade80 → #16a34a | CO₂ 반올림 | {n} |


첫 계열에만 barGap: '10%'를 준다.
세 번째 계열명 'CO₂ (ton)'은 다국어 사전을 거치지 않는 고정 문자열이다.
과거 실적이 없으면 x축 카테고리와 각 계열 데이터에서 세 번째 항목을 통째로 뺀다(빈 막대를 그리지 않는다).

### 6.2 속도 커브 라인 차트
backgroundColor: 'transparent'
animation: true, animationDuration: 1000, animationEasing: 'cubicOut'
grid: { top: 16, right: 16, bottom: 36, left: 16, containLabel: true }

tooltip: trigger 'axis'
  formatter: `${속도} kts<br/>연료: <b>${값 천단위콤마} ton</b>`

xAxis: type 'value'                                  # ★ category 아님
  name 'Speed (kts)', nameLocation 'middle', nameGap 26
  min 10, max 20, interval 2, splitLine 숨김

yAxis: type 'value'
  name 'Fuel (ton)', nameLocation 'middle', nameGap 44
  splitLine 점선

series[0]: type 'line', smooth: true, symbol: 'none'
  data = SPEED_RANGE.map(s => [s, round(calcFuel(routeDistance, s, 140, draftFactor))])
  lineStyle { color '#6366f1', width 2.5 }
  areaStyle: 세로 그라디언트
      offset 0 → rgba(99,102,241, 다크 0.3 / 라이트 0.12)
      offset 1 → rgba(99,102,241, 0)

  markLine (silent, symbol 없음) 2개:
    ① xAxis = voyage.plannedSpeedKnots
       호박색(#f59e0b) 점선 2px, 라벨 `계획 속도\n{n}kts` (10px, insideEndTop)
    ② xAxis = applied.speedKnots
       에메랄드(#10b981) 점선 2px, 라벨 `Sim\n{n}kts`

  markPoint (circle, size 10) 2개:
    ① [계획 속도, 그 속도의 연료값]  — 호박색
    ② [시뮬 속도, 그 속도의 연료값]  — 에메랄드

x축이 value 타입이므로 데이터를 [x, y] 쌍 배열로 넘긴다. category로 만들면 markLine의 xAxis 좌표 지정이 동작하지 않는다.

두 번째 markLine 라벨만 Sim으로 영문 고정이다(다국어 사전 미적용).



## 7. PDF 내보내기
jsPDF로 클라이언트에서 즉시 생성한다(서버 왕복 없음). A4 세로, 단위 mm.

### 7.1 영문 전용 정책
이 PDF는 언어 설정과 무관하게 항상 영문으로 생성된다. jsPDF 기본 폰트(Helvetica)에 한글 글리프가 없기 때문이다. 한글 폰트를 임베딩하는 방법은 AI_REPORT.md 9.2장에 있으나, 이 화면은 더 단순한 영문 고정 방식을 택했다(KNOWN_PITFALLS.md 7.4).

두 가지 방어 장치를 반드시 구현한다.

① 항구명에서 영문만 추출

extractEnglishPort("부산 (Busan)") → "Busan"        # 괄호 안이 없으면 원문 그대로

② Latin-1 안전 필터 — 모든 텍스트 출력을 이 함수에 통과시킨다.

WINANSI_SAFE_EXTRA = { — – ' ' " " … • € }         # Helvetica가 지원하는 예외 문자

safeText(str):
  각 문자에 대해
    코드포인트 <= 0xFF 이거나 WINANSI_SAFE_EXTRA에 있으면 → 그대로
    아니면 → '?' 로 치환하고 플래그 세움
  치환이 있었고 개발 모드면 console.warn으로 경고

### 7.2 문서 구성
여백: 좌 15mm, 우 195mm. 세로 위치는 위에서부터 누적한다.

[제목] 16px bold   : "KSF Line — Voyage Simulation Report"
[생성시각] 9px 회색 : "Generated: {en-US 로컬 문자열}"

[선박] 11px bold   : "Vessel: {선박명}  (IMO {imo})"
[항로] 11px bold   : "Route: {출발 영문항구} -> {도착 영문항구}"

섹션 제목 스타일: 12px bold + 바로 아래 좌→우 가로 실선(setDrawColor(210)). 행 스타일: 라벨은 좌측 15mm, 값은 115mm 위치, 10px normal, 행 간격 6mm.

섹션 1 — Simulation Conditions


| 라벨 | 값 |
| --- | --- |
| Departure Adjustment | +{n}h delay / {n}h earlier / No change |
| Speed | {n} kts |
| Cargo Load | {n}% |
| Route | Suez Canal / Cape of Good Hope |
| Destination Port Congestion | {Clear\|Moderate\|Congested\|Severe} (~{n}h wait) |
| Berth Unloading Progress (vessel ahead) | {n}% (~{n}h wait) |


섹션 2 — Results Summary (4열 표)

열 x좌표: 15 / 80 / 122 / 164. 헤더는 9px bold(Metric / Planned / Simulated / Historical)

아래 구분선(setDrawColor(230)).


| Metric | 값 형식 |
| --- | --- |
| Fuel (ton) | 정수 천단위 콤마 |
| Cost (USD) | ${정수} |
| CO2 (ton) | 정수 |
| Days | 소수 1자리 |


과거 실적이 없으면 4번째 열은 전부 -. 있으면 표 아래에 8px 회색으로 Historical reference: {출발} -> {도착} ({항차 id}) 한 줄을 덧붙인다.

섹션 3 — Savings vs Current Plan: Fuel / Cost / CO2 3행. 부호는 화면과 동일하게 절감이면 -, 증가면 +.

섹션 4 — Arrival & Port Wait: Planned ETA / Simulated ETA / Expected Port Wait / Estimated Waiting Cost 4행. 날짜는 en-US 로케일.

푸터(y=287, 8px 회색): Generated by KSF Line — Logistics Simulation (demo data, for planning reference only).

파일명: KSF-Simulation-{항차 id}-{타임스탬프}.pdf

PDF는 applied가 아니라 일부 초안 값을 섞어 쓰지 않도록 주의한다. 원본은 조건 섹션에 applied.*를, 결과에 계산된 값을 넘긴다.



## 8. 다국어 텍스트 전체 사전
t.simulation.*


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 물류 시뮬레이션 | Logistics Simulation |
| subtitle | 출발 시점·항로·적재량 변경 시 연료비·탄소 변화를 가상으로 분석합니다 | Simulate fuel, cost & carbon impact of schedule or route changes |
| conditions | 시뮬레이션 조건 | Simulation Parameters |
| targetVoyage | 대상 항차 | Target Voyage |
| departureAdj | 출발 시점 조정 | Departure Adjustment |
| noChange | 변경 없음 | No change |
| delayed(h) | +{h}시간 지연 | +{h}h delay |
| advanced(h) | {h}시간 앞당김 | {abs(h)}h earlier |
| speed | 항해 속도 | Speed |
| cargo | 화물 적재율 | Cargo Load |
| route | 항로 선택 | Route |
| routeSuez | 수에즈 운하 | Suez Canal |
| routeCape | 희망봉 우회 | Cape of Good Hope |
| suezSub(nm) | +$420k 통과료 · {nm} nm | +$420k toll · {nm} nm |
| capeSub(nm) | 통과료 없음 · {nm} nm | No toll · {nm} nm |
| runSim | 시뮬레이션 실행 | Run Simulation |
| savingTitle | 현재 계획 대비 절감 효과 | Savings vs Current Plan |
| fuel | 연료 | Fuel |
| cost | 비용 | Cost |
| etaTitle | 예상 도착 일시 | Estimated Arrival |
| plannedEta | 현재 계획 ETA | Planned ETA |
| simEta | 시뮬레이션 ETA | Simulation ETA |
| daysLabel(d) | {d}일 소요 | {d} days |
| compareTitle | 연료 · 비용 · CO₂ 비교 | Fuel · Cost · CO₂ Comparison |
| curPlan | 현재 계획 | Current Plan |
| simResult | 시뮬레이션 | Simulation |
| fuelLegend | 연료 (ton) | Fuel (ton) |
| costLegend | 비용 (천$) | Cost ($k) |
| speedCurve | 속도별 연료 소모 커브 | Speed-Fuel Curve |
| planSpeed | 계획 속도 | Planned |
| slowSteam | 슬로우 스팀 | Slow Steam |
| max | 최대 | Max |
| portCongestion | 도착항 번잡도 | Destination Port Congestion |
| congestionLow | 원활 | Clear |
| congestionMedium | 보통 | Moderate |
| congestionHigh | 혼잡 | Congested |
| congestionSevere | 매우 혼잡 | Severe |
| congestionWaitSub(h) | 평균 대기 +{h}h | Avg. wait +{h}h |
| berthProgress | 접안 예정 선석의 타선박 하역 진행률 | Berth Unloading Progress (vessel ahead) |
| berthWaitSub(h) | 잔여 대기 예상 {h}h | Est. remaining wait {h}h |
| portWaitTitle | 예상 접안 대기 | Expected Port Wait |
| portWaitCost(c) | 대기 비용 약 {c} | Est. waiting cost {c} |
| compareVoyage | 비교할 기존 운항기록 | Compare with Historical Voyage |
| compareVoyageNone | 기존 운항기록 없음 | No historical records |
| historicalLabel | 기존 항차 실적 | Historical Voyage |
| downloadPdf | PDF로 다운로드 | Download PDF |
| downloadPdfHint | 조건·결과·비교표를 담은 리포트를 PDF로 저장합니다 | Save a report with conditions, results and comparison as PDF |
| dirtyHint | 조건이 변경되었습니다 · 실행을 눌러 반영하세요 | Conditions changed · click Run to apply |


다국어 사전을 거치지 않는 고정 문자열: 비교 차트의 세 번째 계열명 'CO₂ (ton)', 속도 커브의 축 이름 'Speed (kts)'·'Fuel (ton)', markLine 라벨 'Sim', 절감 카드의 'CO₂' 라벨, 그리고 PDF 전문(7장).



## 9. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 — 슬라이더 accent, 선택된 버튼, 실행 버튼, 시뮬레이션 ETA 값, 속도 커브 선. hover #4f46e5.
결과 색: 절감 초록(green-600/700, 다크 green-400) / 증가 빨강(red-600) — 절감 카드의 아이콘·값·카드 테두리에 함께 적용.
강조 색:
호박(amber-500/600) — 변경 힌트 점·문구, 항만 대기 값, 속도 커브의 계획 속도 마커
에메랄드(#10b981) — 속도 커브의 시뮬레이션 속도 마커
차트 그라디언트: 연료 #67e8f9 → #6366f1 / 비용 #c084fc → #7c3aed / CO₂ #4ade80 → #16a34a
카드: bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800, 조건 폼은 p-5 space-y-5, 결과 카드는 p-4.
타이포: 페이지 타이틀 16px bold / 카드 제목 14px semibold / 폼 라벨 12px medium / 슬라이더 값 12px semibold / 절감 값 18px bold / 눈금·힌트 12px.
슬라이더: w-full accent-[#6366f1], 네이티브 <input type="range"> 그대로 사용.
아이콘 세트: lucide-react — FlaskConical, PlayCircle, TrendingDown, Clock, Fuel, DollarSign, Anchor, Download
다크 모드: 모든 배경/텍스트/테두리에 dark: variant를 정의하고, 차트 색은 6장 표대로 런타임에 스위칭한다.



## 10. 엣지 케이스 및 불변식
applied가 null이면 조기 반환한다. 회색 12px "불러오는 중..."만 렌더링. SWR을 쓰면 첫 렌더에 반드시 이 경로를 지나므로 생략하면 화면이 터진다.
결과·차트·PDF는 오직 applied만 참조한다. 초안 값이 섞이면 "실행 버튼을 눌러야 반영된다"는 이 화면의 핵심 규칙이 깨진다(5.2장).
예외 2곳: 4.8장의 번잡도·선석 힌트는 초안 기준 으로 즉시 갱신된다.
"현재 계획"은 완전히 고정된 기준선이 아니다. draftFactor(적재율)와 canalCost(항로)를 시뮬레이션 입력과 공유하므로, 적재율이나 항로를 바꾸면 비교 대상인 planned 값도 함께 움직인다. 원본 그대로이니 유지하되, 데모 중 "왜 계획값이 바뀌지?"라는 질문에 답할 수 있어야 한다.
희망봉을 고르면 통과료가 planned에서도 사라진다. canalCost가 이미 0이 되기 때문이며, simulated의 route === 'cape' ? 0 : canalCost 분기는 사실상 중복이다(둘 다 0). 원본 그대로 둔다.
절감 부호는 직관과 반대다 — 절감(양수)이 -, 증가(음수)가 +. "연료를 덜 쓴다"를 마이너스로 표현한 것이다.
대상 항차 후보에 delayed가 없다. preparing·underway만 포함한다.
비교 항차 후보는 completed만이다. 하나도 없으면 select 대신 안내 문구를 띄우고, 차트의 세 번째 막대도 통째로 생략한다.
과거 실적은 draftFactor = 1 고정이며 통과료·대기비용을 포함하지 않는다(5.6장).
연료 모델이 다른 화면과 다르다(1.3장). 같은 항차라도 값이 일치하지 않는 것이 정상이다.
CO₂ 계수가 3.114로 고정이다. 항차의 fuelType을 보지 않는다.
속도 커브 x축은 value 타입이어야 markLine의 좌표 지정이 동작한다(6.2장).
ETA 계산 시 Date 객체 변형에 주의한다. etd로 새 Date를 만든 뒤 시간을 더하고, 거기에 항해 시간 + 대기 시간을 밀리초로 더한다. 원본 voyage.etd를 변형하면 안 된다.
PDF는 항상 영문이며, 모든 출력 문자열을 Latin-1 안전 필터에 통과시킨다(7.1장).
실행 버튼은 변경 없을 때도 disabled가 아니다 — 회색으로 보이고 cursor-default일 뿐, 눌러도 무해하다(같은 값으로 다시 적용).
ECharts는 ssr:false 동적 import + notMerge 를 지킨다.
날짜 표시는 화면이 ko-KR, PDF가 en-US 로 서로 다르다.



## 11. 재구현 체크리스트
상수 세트 입력(연료 단가 · 통과료 · 거리 배수 · 기준 연료/속도 · CO₂ 계수 · 번잡도 대기 · 대기 비용)
SimInputs 타입 + 초안 8개 상태 + applied 1개 상태
초기화 effect(voyages.length 의존, 1회) + applied === null 조기 반환
isDirty 8개 필드 비교
calcFuel + draftFactor 공식
항로 거리·통과료 분기
항만 대기 2요소(번잡도 + 선석 진행률) + 대기 비용
세 결과 계산(planned / simulated / historical) + 절감 3종
페이지 셸(헤더 + 좌우 2열 그리드)
조건 폼 — 대상 항차 select(preparing·underway만)
출발 시점 슬라이더(-24~+72, step 6) + 3점 눈금 + 상태별 라벨 3종
항해 속도 슬라이더(10~20, step 0.5) + 눈금 2개
화물 적재율 슬라이더(30~100, step 5)
항로 2열 버튼(거리·통과료 부제 실시간 계산)
접안 대기 섹션 — 번잡도 4버튼 + 선석 슬라이더 + 초안 기준 힌트 2개
비교 항차 select(completed만) + 없을 때 안내 문구
변경 힌트(깜빡이는 점) + 실행 버튼(색 전환) + PDF 버튼
절감 효과 카드(부호 반전 · 색 전환 · 테두리 색 전환)
예상 도착 일시 카드(2열 + 조건부 항만 대기 행)
비교 막대 차트(3계열 · 그라디언트 · 상단 라벨 · 과거 없으면 3번째 항목 제거)
속도 커브 라인 차트(value x축 · markLine 2 · markPoint 2 · 영역 그라디언트)
(선택) PDF 내보내기 — 영문 고정 · 항구명 추출 · Latin-1 필터 · 4개 섹션 · 파일명
다국어(ko/en) 전체 적용
다크 모드 대응(차트 색 런타임 스위칭 포함)

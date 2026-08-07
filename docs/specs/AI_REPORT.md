
# AI 운항 리포팅 — 단독 기능 명세서 (AI Voyage/Operations Report)
문서 버전: 1.1.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "AI 운항 리포팅" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 원본 프로젝트의 다른 화면(대시보드·물류 일정·선박 관리·탄소 배출 등)에 의존하지 않고 AI 운항 리포팅만 별도로 구현하는 것을 전제로 작성되었습니다. 다만 원본에서는 대시보드의 함대 게이지 카드 "AI" 버튼에서 특정 선박 리포트로 딥링크되는 연동이 있는데, 이는 8장에서 선택 구현 사항으로 별도 표시했습니다.

해커톤 원칙: 이 문서의 1~11장은 화면이 100% 정상 동작하기 위한 Must 항목입니다. 12장(엣지 케이스)과 8장(딥링크)은 시간이 남을 때만 구현해도 됩니다.

선행 문서: 프로젝트 세팅(프로젝트 생성·의존성·테마·공통 셸)은 BOOTSTRAP.md를 먼저 끝낸 뒤 이 문서를 시작한다. 구현 중 막히면 KNOWN_PITFALLS.md의 증상 인덱스에서 찾는다.

다른 화면과 함께 만드는 경우: 이 문서의 샘플 데이터는 SCHEDULE.md · VESSEL.md · DASHBOARD.md · CARBON.md와 공유되는 부분집합이다(3.2장 참고). 두 화면 이상을 만든다면 mock 데이터를 한 곳에 두고 공유한다.



## 목차
개요
접근 권한
데이터 모델
화면 구성
공용 컴포넌트 명세
핵심 계산 로직
AI 재분석 (Gemini 연동)
외부 딥링크 연동 (선택)
PDF 내보내기
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
특정 항차(Voyage)에 대해 **RTA(또는 미확정 시 STA)를 준수하면서 연료 소모를 최소화하는 최적 항속(에코스피드)**을 계산·제안하고, 그 판단 근거와 운항 리스크를 사람이 읽을 수 있는 리포트 형태로 보여준다. "재분석" 버튼을 누르면 실시간 기상·항만 혼잡도·인근 지역 이슈를 반영해 Gemini(LLM)가 권장 속도와 분석 근거·리스크를 다시 생성한다.

### 1.2 핵심 개념
리포트(EcoSpeedReport): 항차 1건당 1개. 규칙 기반으로 미리 계산된 baseline 권장 속도·근거·리스크를 담은 mock 데이터. "재분석"을 누르기 전까지는 이 baseline이 그대로 화면에 표시된다.
AI 재분석(override): 사용자가 "재분석"을 누르면 서버가 실시간 데이터를 모아 Gemini에 보내고, 그 결과로 받은 권장 속도·근거·리스크가 baseline을 화면상에서 대체한다(mock 데이터 자체는 변경하지 않음. 클라이언트 상태로만 override).
RTA vs STA: RTA(Required Time of Arrival)는 관제소/터미널과 확정된 도착 요구 시각. 아직 확정되지 않았으면 그 대신 STA(Scheduled Time of Arrival, 선사 예정 도착일)를 기준으로 모든 확률·마진을 계산·표시하고, 화면에 "RTA 미확정" 안내 배너를 띄운다.
속도 시나리오 3종: ① 현재 실시간 속도(AIS), ② 최초 계획 속도(voyage.plannedSpeedKnots 계열), ③ baseline 또는 AI 권장 속도. 리포트는 이 세 시나리오를 항상 나란히 비교해서 보여준다.



## 2. 접근 권한
이 화면은 역할 기반 접근 제어(RBAC)가 있는 시스템이라면 ADMIN, LOGISTICS(물류 담당자), CAPTAIN(선장·선원) 역할만 접근 가능하도록 사이드바/라우팅에 노출한다. CLIENT(화주) 역할에는 노출하지 않는다.
별도 프론트 전용 데모 앱으로 만든다면(백엔드 인증 없이) 이 제약은 생략해도 무방하다.



## 3. 데이터 모델
아래 타입과 mock 데이터를 최대한 그대로 사용한다. 실거리·항로 좌표(searoute-py로 사전 계산한 정밀 데이터)가 없다면, 모든 거리·항로 계산은 각 항차의 plannedRoute(직선 근사 waypoint 배열)와 distanceNm(계획 거리)으로 대체한다 — 이 문서의 모든 로직은 이 폴백을 전제로 설명한다.

### 3.1 타입 정의
type VesselType = 'container' | 'bulk' | 'tanker' | 'roro'

interface FuelPoint {
  speedKnots: number
  fuelTonPerDay: number
}

interface Vessel {
  id: string
  name: string
  imo: string
  type: VesselType
  fuelCurve: FuelPoint[]        // 속도→일일 연료소모량(ton/day) 곡선, 오름차순이 아니어도 됨(정렬해서 씀)
  // 이 화면에서 직접 쓰이지 않는 그 외 선박 스펙 필드는 생략 가능
}

type FuelType = 'HFO' | 'MGO' | 'LNG'

interface Waypoint { lat: number; lng: number; name?: string }

interface Voyage {
  id: string
  vesselId: string
  cargoDescription: string
  departurePort: string   // 예: "부산 (Busan)" — 공백 기준 첫 토큰만 UI에 노출
  arrivalPort: string
  sta: string              // ISO 8601, 예정 도착시간
  rta: string               // ISO 8601, 관제소 확정 도착시간
  rtaConfirmed: boolean     // false면 화면 전체에서 RTA 대신 STA를 기준으로 계산·표시
  plannedRoute: Waypoint[]  // 직선 근사 항로(실좌표 없을 때 대체용)
  plannedSpeedKnots: number
  fuelType: FuelType
  distanceNm: number         // 계획 총 거리(정밀 항로 데이터 없을 때 대체)
}

interface AisPosition {
  vesselId: string
  lat: number
  lng: number
  speedKnots: number
  updatedAt: string
}

interface RiskItem {
  level: 'high' | 'medium' | 'low'
  category: 'weather' | 'geopolitical' | 'port' | 'mechanical'
  title: string
  description: string
}

interface EcoSpeedReport {
  id: string
  voyageId: string
  generatedAt: string        // ISO 8601 — 이 리포트의 "지금"으로 취급(모든 계산의 nowIso)
  recommendedSpeed: number    // baseline 권장 속도(kts)
  currentPlanSpeed: number    // 이 리포트가 만들어질 당시의 "계획 속도"(voyage.plannedSpeedKnots와 별개로 리포트에 박제)
  etaIfRecommended: string    // baseline 권장 속도로 운항했을 때의 도착 예정시각(ISO) — 유일한 "신뢰 가능한 앵커"
  reasoning: string           // 줄바꿈(\n)으로 문장 구분된 분석 근거 서술
  risks: RiskItem[]
}

type CongestionLevel = 'low' | 'medium' | 'high'
type CongestionTrend = 'rising' | 'stable' | 'falling'

interface PortCongestion {
  portKey: string
  matchNames: string[]        // 소문자 부분일치로 항구명을 매칭
  congestionScore: number      // 0~100
  avgWaitHours: number
  berthsAvailable: number
  berthsTotal: number
  trend: CongestionTrend
}

interface RegionalIssue {
  id: string
  lat: number
  lng: number
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  source: string
}

왜 etaIfRecommended가 "유일한 신뢰 가능한 앵커"인가: mock 데이터는 거리(distanceNm)·속도 (recommendedSpeed)·일정(sta/rta)이 서로 물리적으로 완전히 들어맞지 않는다(실거리 기준으로 계산하면 시나리오마다 결과가 어긋난다). 그래서 이 기능은 "baseline 속도 @ baseline ETA" 딱 한 쌍만 절대 기준(앵커)으로 삼고, 다른 모든 속도 시나리오의 도착시각은 이 앵커 대비 속도 비율로 환산한다. 6.4장에서 자세히 설명한다.

### 3.2 재현용 샘플 데이터 (그대로 사용 권장)
다른 스펙과의 관계: 아래 데이터는 다른 화면 스펙의 샘플과 완전히 동일한 부분집합이다 (값이 어긋나는 곳은 없다). 이 화면만 만든다면 아래 표만으로 충분하고, 다른 화면을 함께 만든다면 아래 표를 더 큰 집합으로 확장해 한 곳에서 공유한다.


| 데이터 | 이 문서 | 전체 집합 |
| --- | --- | --- |
| 선박 | 4척(v001~v004) | 5척 — VESSEL.md 3.2장 (v005 KSF ASPIRE, 정비 중) |
| 항차 | 4건(voy001~voy004) | 8건 — SCHEDULE.md 3.4장 |
| AIS 위치 | 4건 | 동일 — SCHEDULE.md 6.1장 |
| 리포트 | 4건 | 동일 — 〃 |
| 항구 | 필요한 곳만 | 30곳 — SCHEDULE.md 3.2장 |
| 지역 이슈 | 6.6장에서 사용 | 7건 — DASHBOARD.md 3.2장 |


항차 표의 필드도 부분집합이다 — 다른 화면이 추가로 쓰는 etd·eta·status·recommendedSpeedKnots· cargoTon은 SCHEDULE.md 3.4장에 있다.

선박 4척


| id | name | type | fuelCurve (kts → ton/day) |
| --- | --- | --- | --- |
| v001 | KSF PIONEER | container | 10→52, 12→78, 14→112, 16→158, 18→215, 20→285 |
| v002 | KSF NAVIGATOR | container | 10→48, 12→71, 14→103, 16→147, 18→201, 20→268 |
| v003 | KSF VENTURE | bulk | 9→28, 11→41, 13→61, 15→88 |
| v004 | KSF HORIZON | tanker | 10→44, 12→65, 14→94, 16→135 |


항차 4건


| id | vesselId | 출발 → 도착 | sta | rta | rtaConfirmed | plannedSpeedKnots | fuelType | distanceNm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| voy001 | v001 | 부산 (Busan) → 로테르담 (Rotterdam) | 2026-08-02T06:00:00Z | 2026-08-01T18:00:00Z | false | 16.0 | HFO | 11200 |
| voy002 | v002 | 상하이 (Shanghai) → 로스앤젤레스 (Los Angeles) | 2026-08-05T02:00:00Z | 2026-08-05T06:00:00Z | true | 17.0 | MGO | 5600 |
| voy003 | v003 | 포트헤들랜드 (Port Hedland) → 광양 (Gwangyang) | 2026-08-02T09:00:00Z | 2026-08-02T12:00:00Z | true | 13.0 | HFO | 4200 |
| voy004 | v004 | 라스 타누라 (Ras Tanura) → 울산 (Ulsan) | 2026-07-28T05:00:00Z | 2026-07-28T08:00:00Z | true | 14.5 | HFO | 5800 |


각 항차의 plannedRoute는 출발항 → 주요 경유 해역(대략 3~7개 지점) → 도착항 순의 위경도 배열이면 된다(정밀도는 중요하지 않음, 진행률 계산용). 예: voy001 = 부산(35.1,129.04) → 상하이근방(30.0,121.0) → 홍콩근방(22.3,114.2) → 싱가포르(1.3,103.8) → 아덴만(12.8,45.0) → 수에즈운하(29.9,32.5) → 지중해(36.5,5.0) → 지브롤터(36.1,-5.3) → 로테르담(51.9,4.5).

실시간 위치(AIS) 4건 — EcoSpeedReport.generatedAt과 같은 시점 기준의 스냅샷으로 취급


| vesselId | lat | lng | speedKnots |
| --- | --- | --- | --- |
| v001 | 1.1 | 103.6 | 13.5 |
| v002 | 41.26 | 139.74 | 14.2 |
| v003 | -19.6 | 118.6 | 12.8 |
| v004 | 9.7 | 75.3 | 13.1 |


리포트 4건(EcoSpeedReport)

[
  {
    "id": "rep001", "voyageId": "voy001", "generatedAt": "2026-07-18T06:00:00Z",
    "recommendedSpeed": 13.5, "currentPlanSpeed": 16.0,
    "etaIfRecommended": "2026-07-31T22:00:00Z",
    "reasoning": "현재 도착지(로테르담) 항만 체선이 약 18시간 예상됩니다.\n계획 속도 16kts를 13.5kts로 낮추면 연료 18.2%를 절감하면서도 RTA보다 20시간 일찍 도착할 수 있습니다.\n홍해 구간 파고 2.1m 예상 — 감속 운항이 선체 응력에도 유리합니다.",
    "risks": [
      { "level": "medium", "category": "weather", "title": "홍해 북부 높은 파고", "description": "향후 48시간 파고 2.1~2.8m 예보. 선수 방향 조정 및 속도 유지 권장." },
      { "level": "low", "category": "port", "title": "로테르담 항만 체선", "description": "현재 평균 대기 시간 18.5시간. 조기 도착보다 적정 속도 유지가 비용 효율적." },
      { "level": "low", "category": "geopolitical", "title": "수에즈 운하 통과 대기", "description": "수에즈 운하 남북 단방향 통항 대기 약 6시간 예상. 일정 반영 완료." }
    ]
  },
  {
    "id": "rep002", "voyageId": "voy002", "generatedAt": "2026-07-18T06:30:00Z",
    "recommendedSpeed": 14.0, "currentPlanSpeed": 17.0,
    "etaIfRecommended": "2026-08-05T16:00:00Z",
    "reasoning": "북태평양 저기압으로 인해 항로 북쪽 구간에 파고 4.5m 이상 예보.\n현재 계획 항로 우회를 권장하며, 우회 시 거리 180nm 증가하지만 선체 안전 및 화물 보호를 위해 필요합니다.\n우회 후 14kts 유지 시 RTA 대비 10시간 지연 예상.\n하역 일정 재협의 권고.",
    "risks": [
      { "level": "high", "category": "weather", "title": "북태평양 저기압 — 항로 우회 필요", "description": "7월 19~22일 항로 상 파고 4.5~6.0m, 풍속 35kts 이상 예보. 남쪽으로 2도 우회 권장." },
      { "level": "medium", "category": "port", "title": "LA 항 체선 심화", "description": "현재 LA 항 평균 대기 시간 32시간으로 증가. 10시간 지연과 합산 시 실질 영향 최소화." }
    ]
  },
  {
    "id": "rep003", "voyageId": "voy003", "generatedAt": "2026-07-18T07:00:00Z",
    "recommendedSpeed": 12.5, "currentPlanSpeed": 13.0,
    "etaIfRecommended": "2026-08-01T20:00:00Z",
    "reasoning": "현재 항차는 계획 일정보다 16시간 여유가 있습니다.\n속도를 0.5kts 낮추면 소폭의 연료 절감이 가능하며, RTA 준수에 문제가 없습니다.\n남중국해 구간 파고는 양호(1.2m 미만)합니다.",
    "risks": [
      { "level": "low", "category": "weather", "title": "남중국해 소규모 스콜", "description": "필리핀 동쪽 해상 국지성 스콜 예보. 레이더 모니터링 권장, 항로 변경 불필요." }
    ]
  },
  {
    "id": "rep004", "voyageId": "voy004", "generatedAt": "2026-07-18T07:30:00Z",
    "recommendedSpeed": 13.0, "currentPlanSpeed": 14.5,
    "etaIfRecommended": "2026-07-28T02:00:00Z",
    "reasoning": "아덴만 통과 구간 해적 위험 해역 접근.\n권고 항로(UKMTO 002) 준수 중.\n말라카 해협 통과 예상 시 조류 방향 유리(0.5kts 순방향).\n13.0kts 유지 시 RTA 6시간 전 도착 예상.",
    "risks": [
      { "level": "high", "category": "geopolitical", "title": "아덴만 — 해적 위험 해역", "description": "UKMTO 권고 항로 준수 필요. 현재 통과 완료. 야간 항행 경계 강화 권고." },
      { "level": "low", "category": "weather", "title": "인도양 남서 몬순", "description": "인도양 구간 파고 1.8~2.4m, 선미 방향 파도로 오히려 추진력에 유리." }
    ]
  }
]

항구 혼잡도(부분 일치 매칭, 항구명 문자열에 matchNames가 포함되면 매칭)

Track A — 반입한 mocks/port-congestion.ts에 항구 12곳이 들어 있으므로 그대로 쓴다. Track B — 아래 4곳 + 기본값만으로 충분하다(이 화면의 샘플 항차 4건이 쓰는 도착항을 모두 덮는다). BOOTSTRAP.md 1.2장 참고.


| portKey | matchNames | score | avgWaitHours | berths | trend |
| --- | --- | --- | --- | --- | --- |
| rotterdam | 로테르담, rotterdam | 42 | 18.5 | 3/9 | stable |
| losangeles | 로스앤젤레스, los angeles, "la " | 78 | 32 | 2/10 | rising |
| gwangyang | 광양, gwangyang | 25 | 6 | 6/8 | stable |
| ulsan | 울산, ulsan | 30 | 8 | 5/7 | stable |


매칭 실패 시 기본값: { score: 35, avgWaitHours: 10, berths: 5/8, trend: 'stable' }. 등급 산정: score >= 65 → high, score >= 40 → medium, 그 외 low.

기본값이 있어 어떤 항구든 안전하게 동작한다. 사전에 없는 도착항이면 위 기본값이 쓰인다.

지역 이슈(전체 노선 공용 풀, 항로 인근 것만 필터링해서 노출 — 6.6장 참고)


| id | lat,lng | severity | title | 요지 |
| --- | --- | --- | --- | --- |
| i001 | 12.5,45 | high | 해적 활동 경보 | 아덴만 해적 위협, IMB Level 2 |
| i002 | 30.5,32.3 | medium | 수에즈 운하 통항 지연 | 평균 18시간 대기 |
| i003 | 31.3,121.8 | medium | 상하이항 터미널 혼잡 | 입항 대기 평균 3.2일 |
| i004 | 1.3,103.8 | low | 말라카 해협 통항 규제 | 대형선 야간 통항 제한 |
| i005 | 15,42 | high | 홍해 안보 위협 | 후티 공격 지속, 희망봉 우회 권고 |
| i006 | 22.3,114.2 | low | 홍콩항 혼잡 | 입항 대기 1.8일 |
| i007 | 26.6,56.5 | high | 호르무즈 해협 긴장 고조 | 상선 통항 제한 가능성 |




## 4. 화면 구성
전체 페이지는 세로 flex 레이아웃(flex flex-col h-full)이며, 상단 고정 헤더 + 스크롤 가능한 리포트 목록으로 구성된다. 배경/텍스트는 라이트·다크 모드를 모두 지원한다(다크 모드가 없다면 라이트 클래스만 써도 무방).

### 4.1 페이지 헤더
높이 64px(h-16) 고정, 좌우 패딩 24px, 하단 보더, 배경 bg-white(다크: bg-slate-900).
좌측: 페이지 타이틀 "AI 운항 리포트"(볼드, 16px) + 가운뎃점 구분자 + 부제 "에코스피드 권장안 및 운항 리스크 보고서"(회색, 14px, 작은 화면에서 숨김).
우측: "전체 재분석" 버튼 (외곽선 스타일, 아이콘 RefreshCw + 라벨. 클릭 시 아이콘이 animate-spin으로 회전하고 버튼 비활성화).

### 4.2 리포트 카드 — 헤더 행 (항상 보임, 클릭하면 펼침/접힘 토글)
구현 주의: 이 헤더 행 전체를 펼침/접힘 토글로 만들면서 그 안에 PDF 다운로드·재분석처럼 실제 동작하는 `<button>`을 넣으면 `<button>` 안에 `<button>`이 중첩되어 hydration 에러가 난다. 바깥쪽 토글 컨테이너는 `<button>`이 아니라 `<div role="button" tabIndex={0}>` + onClick/onKeyDown(Enter·Space)으로 구현한다(KNOWN_PITFALLS.md 1.8).

각 리포트는 둥근 모서리(rounded-xl) 카드, 흰 배경(다크: slate-900), 얇은 테두리. 카드 헤더 행 좌→우 순서:

선박 아이콘 배지: 44×44px 회색 박스(bg-slate-100, 다크 bg-slate-700) 안에 Ship 아이콘(인디고 #6366f1).
선박명 + 부제 줄: 선박명(볼드, 18px) 아래 줄에 출발항첫단어 → 도착항첫단어 · 생성일시 생성 (회색, 14px).
항구명은 " (영문)" 괄호 앞의 첫 토큰만 표시(예: "부산 (Busan)" → "부산").
날짜는 formatDateTime(연-월-일 시:분, 로케일 고정 — 10.x장 참고).
요약 통계 3종(가로 640px 이상에서만 보임, hidden sm:flex):
연료 절감률(%, 초록, 굵게) + "연료 절감" 라벨
현재속도 → 화살표(ArrowRight) → 권장속도(인디고, 굵게) + "kts" + "속도 비교" 라벨
RTA/STA 준수확률(%) — 색상은 6.2장 규칙, "{RTA|STA} 준수 확률" 라벨
PDF 다운로드 버튼: FileDown 아이콘만, hover 시 인디고로 변함. 클릭 시 이벤트 버블링 정지(stopPropagation) 후 9장 실행.
재분석 버튼: RefreshCw 아이콘만. 개별 로딩 중이면 회전 애니메이션 + 비활성화.
펼침 표시: ChevronUp/ChevronDown.

### 4.3 리포트 카드 — 펼친 영역 (아코디언, 상단 보더로 구분)
펼쳤을 때 위에서부터 아래 순서로 다음 블록들이 space-y-5(20px 간격 세로 스택)로 나열된다.

① 배너(조건부, 있으면 맨 위)

AI 분석 진행 중 배너: 이 리포트가 재분석 요청 중일 때만. 인디고 테두리/배경 카드, RefreshCw(회전) + "Gemini AI가 실시간 기상·혼잡도·일정을 반영해 권장 속도와 분석 근거를 다시 계산하고 있습니다 (약 15~30초 소요)."
RTA 미확정 배너: voyage.rtaConfirmed === false일 때 항상. 호박색(amber) 테두리/배경, AlertCircle + "RTA 미확정 — 관제소와 아직 확정되지 않아, 이하 모든 기준은 STA(예정 도착시간)로 표시됩니다."

② 항해 진행 상황 — 5.3장 컴포넌트. RTA가 확정된 경우만 위쪽에 pt-4 여백 추가(배너가 없어서 헤더와 붙는 것 방지).

③ 속도 비교 + RTA/STA 확률 게이지 (2열 그리드, 좁은 화면은 1열)

왼쪽 카드 — 인디고 2px 테두리(border-2 border-[#6366f1]/25):
상단 라벨: Navigation 아이콘 + "속도 비교" (+ AI 재분석 결과가 적용됐으면 옆에 "Gemini AI 생성" 배지: 인디고 알약형, Sparkles 아이콘)
가운데: 현재속도(큰 회색 숫자, 36px) — 화살표(ArrowRight) — 권장속도(큰 초록 숫자, 36px), 각각 아래에 "현재 실시간 속도" / "AI 권장 속도" 라벨
그 아래 가운데 정렬 문장: 속도차 0.05kts 미만이면 "현재 속도 유지 권장", 권장이 더 느리면 "N kts 감속", 더 빠르면 "N kts 증속" (N은 소수 1자리)
맨 아래(상단 보더로 구분): 권장 속도로 마감시각을 100% 지킬 수 있으면 초록 ShieldCheck + "AI 권장 속도로 운항 시 {RTA|STA} 100% 준수", 못 지키면(=최고속력으로도 부족) 빨강 ShieldAlert + "선박 최고속력으로도 {RTA|STA} 준수가 어렵습니다 (예상 확률 N%)"
오른쪽 — 5.2장 ProbabilityGauge 컴포넌트. tone은 STA 기준이면 'blue', RTA 확정이면 'status'(신호등 색).

④ STA/RTA/ETA — 4칸 스탯 카드 그리드 (2열, sm 이상 4열) — 5.1장 StatCard 4개:


| # | 아이콘 | 라벨 | 값 | accent |
| --- | --- | --- | --- | --- |
| 1 | CalendarClock | STA (예정 도착시간) | voyage.sta 포맷 | RTA 확정이면 default, 아니면 warning |
| 2 | RadioTower | RTA (관제소 확정 도착시간) | 확정이면 voyage.rta 포맷, 아니면 "미확정" | 동일 규칙 |
| 3 | Timer | 현재 속도 도착예정 | speedPlan.etaAtCurrent 포맷 | default |
| 4 | CalendarCheck | 권장 속도 도착예정 | speedPlan.etaAtRecommended 포맷 | success(초록) |


⑤ CO₂·연료 절감 — 4칸 스탯 카드 그리드 (2열, sm 4열):


| # | 아이콘 | 라벨 | 값 | sublabel | accent |
| --- | --- | --- | --- | --- | --- |
| 1 | Leaf | 누적 CO₂ 절감 | speedPlan.co2SavedTon.toFixed(1) + " ton" | 최초 계획 속도 대비 | brand(인디고) |
| 2 | Leaf | 권장속도 조정 CO₂ 절감 | co2SavedTonFromCurrent.toFixed(1) + " ton" | 현재 속도 대비 (AI 권장 속도 적용 시) | brand |
| 3 | Fuel | 누적 연료 절감 | fuelSavingPercent.toFixed(1) + "%" | 최초 계획 속도 대비 | success |
| 4 | Fuel | 권장속도 조정 연료 절감 | fuelSavingPercentFromCurrent.toFixed(1) + "%" | 현재 속도 대비 | success |


⑥ 도착항 혼잡도 + 실시간 기상 2종 — 3칸 그리드 (1열 → sm 3열):

혼잡도 카드(직접 마크업, StatCard 아님): Anchor 아이콘(색은 등급별: high=red-500, medium=yellow-500, low=green-500) + "도착항 예상 혼잡도" 라벨. 그 아래 등급 라벨(원활/보통/혼잡, 등급색)과 "score/100"을 나란히. 그 아래 줄: "평균 대기시간 Nh"와 추세 아이콘(TrendIcon: rising=TrendingUp, stable=Minus, falling=TrendingDown) + 추세 라벨(악화 추세/유지/개선 추세)을 좌우로. 맨 아래: "접안 가능 선석 N / M척".
현재 운항해역 날씨, 도착항 날씨 — 5.4장 ReportWeatherStats 컴포넌트 2개.

⑦ AI 분석 근거 — 소제목 "AI 분석 근거"(+ override 적용 시 "Gemini AI 생성" 배지). AI 실패 에러가 있으면 호박색 경고 문장(AlertCircle + API 키 미설정/재분석 실패 안내). 본문은 회색 배경 박스(bg-slate-50), whitespace-pre-line으로 \n 그대로 줄바꿈 반영.

⑧ 운항 고려사항(리스크 목록) — 소제목 "운항 고려사항". 리스크마다 카드 한 장:

아이콘: level이 low면 Info, 아니면 AlertTriangle. 색: high=red-500, medium=yellow-500, low=인디고.
테두리 색: high=red-200, medium=yellow-200, low=slate-200.
내용: 제목(굵게) + RiskBadge(레벨 배지, 5.5장) + 카테고리 아이콘·라벨(회색, 작게) 한 줄, 그 아래 설명 문장(회색).

⑨ 남은 항로 인근 지역 이슈 — 소제목 "남은 항로 인근 지역 이슈". 없으면 "남은 항로 인근에 특이 이슈가 없습니다." 회색 문구. 있으면 이슈마다 카드: MapPin 아이콘(회색) + 제목(굵게) + RiskBadge(심각도) 한 줄, 설명, "출처: {source}"(회색, 작게).



## 5. 공용 컴포넌트 명세

### 5.1 StatCard
작은 흰 카드(bg-white dark:bg-slate-800, 얇은 테두리, rounded-lg px-4 py-3). 상단 줄: 작은 아이콘(16px) + 라벨(회색, 14px, truncate). 그 아래: 값(20px, bold, accent 색). sublabel이 있으면 그 아래 한 줄 더(회색, 14px).

accent 5종 → 텍스트/아이콘 색 매핑:


| accent | 텍스트 색 | 아이콘 색 |
| --- | --- | --- |
| default | slate-700 / slate-300(dark) | slate-400 / slate-500(dark) |
| success | green-600 / green-400(dark) | green-500 |
| warning | yellow-600 / yellow-400(dark) | yellow-500 |
| danger | red-600 / red-400(dark) | red-500 |
| brand | #6366f1 | #6366f1 |


### 5.2 ProbabilityGauge
RTA/STA 준수 확률을 보여주는 게이지 카드. 2px 테두리 색은 신뢰도(high/medium/low)에 따라 초록/노랑/빨강 링, tone='blue'(STA 표시용)이면 항상 파란 계열(진하기만 신뢰도별로 3단계) 링으로 바뀐다.

상단 줄: Gauge 아이콘 + 라벨(좌) — 큰 퍼센트 숫자(우, 30px, extrabold, 신뢰도색).
진행 바: 회색 트랙(10px 높이, 완전 둥근 모서리) 위에 확률(%)만큼 채워진 색 바(transition-all로 애니메이션).
하단 줄: "{descLabel} · {신뢰도라벨}"(좌, 신뢰도색, 굵게) — "{margin 라벨}"(우, 회색).
(선택) hint 줄: 현재 속도로는 미달인데 권장 속도로는 100% 충족 가능할 때만, 초록 작은 글씨로 "→ AI 권장 속도(N kts)로 전환 시 {RTA|STA} 100% 준수 가능".
(선택) formula 줄: 상단 보더로 구분된 모노스페이스 회색 작은 글씨. "필요 평균 속도 = 예상 거리 {nm}nm ÷ 잔여 시간 {h}h = {kts}kts".

색상 티어(3단계, high/medium/low):

status(RTA):  high=#22c55e(green-600 text)  medium=#eab308(yellow-600 text)  low=#ef4444(red-600 text)
blue(STA):    high=blue-600 text/#2563eb bar  medium=blue-500 text/#3b82f6 bar  low=blue-400 text/#60a5fa bar

### 5.3 VoyageProgressLine
항해 진행률을 시각화하는 트랙 바 카드.

상단 줄: Navigation 아이콘 + "항해 진행 상황"(좌) — "총 거리 N nm"(우, N은 정수 콤마 포맷).
트랙: 회색 8px 높이 완전 둥근 바. 그 위에 인디고 색으로 진행률(%)만큼 채운 바. 좌우 끝에 작은 회색 원(출발/도착 지점 마커, 흰 테두리).
트랙 위, 진행률 위치에 Ship 아이콘(20px, 인디고)이 진행률만큼 좌우로 이동해 배치된다.
그 아이콘 위쪽에 "현위치 · N%" 라벨(인디고, 굵게) — 단, 라벨의 좌우 위치는 카드 밖으로 잘리지 않도록 6%~94% 범위로만 clamp한다(아이콘 자체 위치는 clamp하지 않고 실제 진행률 그대로 사용).
하단 좌우: 왼쪽에 출발항 이름(첫 토큰) + "현재까지 운항거리 N nm", 오른쪽에 도착항 이름(첫 토큰) + "남은 운항거리 N nm"(우측 정렬).

### 5.4 ReportWeatherStats
두 지점(현재 위치, 도착항)의 실시간 풍속·파고를 Open-Meteo에서 가져와 StatCard 2장으로 보여주는 컴포넌트. 자세한 조회 로직은 6.7장. 로딩 중에는 각 지점 자리에 Loader2(회전) + "{지점 라벨} · 실시간 기상 조회 중..." 한 줄짜리 회색 박스를 보여준다. 실패 시 "{지점 라벨} · 실시간 데이터를 불러올 수 없습니다."

값 형식: "{풍속.toFixed(1)} m/s · {파고.toFixed(1)}m", sublabel은 해상 상태 라벨(아래 표). accent는 해상 상태에 따라 자동 결정:


| 파고(m) | 상태 | 라벨 | accent |
| --- | --- | --- | --- |
| < 1 | calm | 평온 | success |
| 1~2 | moderate | 보통 | default |
| 2~4 | rough | 거침 | warning |
| ≥ 4 | high | 높음 | danger |


### 5.5 RiskBadge / 상태 배지
작은 알약형 배지(rounded-full px-2 py-0.5 text-xs font-medium). level 별 배경/텍스트 색:


| level | 배경/텍스트 |
| --- | --- |
| high | bg-red-100 text-red-700 |
| medium | bg-yellow-100 text-yellow-700 |
| low | bg-[#6366f1]/10 text-[#6366f1] |


텍스트는 10장의 status.high/status.medium/status.low (위험/주의/정보).



## 6. 핵심 계산 로직
이 장의 모든 함수는 순수 함수로 구현하고, 화면 렌더링과 "재분석" 요청 컨텍스트 구성(7장) 양쪽에서 동일하게 재사용해야 한다 — 그래야 화면에 보이는 숫자와 Gemini에게 주는 근거 숫자가 항상 일치한다.

다른 화면과 공유하는 계산이다. SCHEDULE.md 6.1장의 항차 목록 "준수 확률" 열이 6.1~6.4장의 함수를 그대로 재사용한다. 두 화면을 함께 만든다면 반드시 한 곳에 구현해 공유할 것 — 같은 항차가 두 화면에서 다른 확률로 보이면 안 된다. 원본에서 화면마다 공식을 따로 구현했다가 전 화면을 재작업한 이력이 있다 (KNOWN_PITFALLS.md 5.2).

### 6.1 항해 진행률
haversineNm(a, b):  # 대권 거리(해리 단위), 지구 반지름 3440.065nm
  dLat = rad(b.lat - a.lat); dLng = rad(b.lng - a.lng)
  h = sin²(dLat/2) + cos(rad(a.lat))·cos(rad(b.lat))·sin²(dLng/2)
  return 2 · 3440.065 · asin(min(1, sqrt(h)))

findClosestIndex(routePoints, position):
  routePoints 중 position과 haversineNm 거리가 가장 짧은 점의 인덱스 반환

computeVoyageProgress(routePoints, totalDistanceNm, position):
  position이 없거나 routePoints < 2개면 → { traveled: 0, remaining: totalDistanceNm, percent: 0 }
  idx = findClosestIndex(routePoints, position)
  traveled = sum(haversineNm(routePoints[i], routePoints[i+1]) for i in 0..idx-1)
             + haversineNm(routePoints[idx], position)
  traveled = min(traveled, totalDistanceNm)          # 총거리를 넘지 않도록 clamp
  remaining = max(totalDistanceNm - traveled, 0)
  percent = totalDistanceNm > 0 ? traveled/totalDistanceNm·100 : 0
  return { traveled, remaining, percent }

remainingRoute(routePoints, position): 남은 항로만 추출 — routePoints.slice(findClosestIndex(...)). 인근 이슈 탐색(6.6장)에 사용.

### 6.2 RTA/STA 준수 확률
"이 속도로 남은 거리를 소화했을 때 마감시각 전에 도착하는가"를 여유시간(마진, 시간 단위) 기반으로 계산한다. 마진이 0 이상이면(=계산상 제시간 도착) 100%로 본다 — 현재 속도든 권장 속도든 항상 이 함수 하나만 쓴다(권장 속도라고 해서 별도로 100%를 하드코딩하지 않는다). 마진이 음수(이미 늦음)면 부족한 시간에 비례해 확률이 낮아진다.

marginToProbability(marginHours):
  if marginHours >= 0:
    return { percent: 100, confidence: 'high', marginHours }
  percent = clamp(round(50 + marginHours·4), 3, 49)
  confidence = percent >= 40 ? 'medium' : 'low'
  return { percent, confidence, marginHours }

### 6.3 필요 평균 속도
마감시각에 정확히 맞추려면 지금부터 평균 몇 노트로 가야 하는지 계산한다. "앵커 대비 비율" 관계를 반대로 풀어서 구한다(6.4장의 원리와 동일선상). 소수 첫째 자리로 올림 처리한다 — 이 값을 권장 속도의 하한으로 써도 반올림 오차 때문에 마진이 살짝 음수가 되는 일이 없도록.

computeRequiredSpeedKnots(anchorSpeedKnots, anchorEtaIso, nowIso, deadlineIso):
  anchorHours = max(0.01, (anchorEtaIso - nowIso) in hours)
  hoursUntilDeadline = max(0.01, (deadlineIso - nowIso) in hours)
  raw = anchorSpeedKnots · anchorHours / hoursUntilDeadline
  return ceil(raw · 10) / 10

이 함수는 클라이언트(화면 표시용)와 서버(Gemini 프롬프트용, 7장)에서 완전히 동일하게 사용해야 한다.

### 6.4 속도 계획 전체 (computeSpeedPlan)
리포트 하나를 펼쳤을 때 필요한 파생 수치를 한 번에 계산하는 핵심 함수. 입력: vessel, voyage, report, remainingNm, currentSpeedKnots, nowIso, deadlineIso, aiRecommendedSpeedKnots?(있으면 baseline 대신 이 값 사용).

① 세 시나리오의 ETA를 앵커 비율로 환산

etaMsAtSpeed(anchorSpeedKnots, anchorHours, nowMs, speedKnots):
  hours = anchorHours · (anchorSpeedKnots / speedKnots)
  return nowMs + hours·3600000

anchorHours = max(0.01, (report.etaIfRecommended - nowIso) in hours) — baseline 권장 속도 기준 도착까지 남은 시간(= 앵커).
권장/AI 속도 ETA = etaMsAtSpeed(report.recommendedSpeed, anchorHours, now, recommendedSpeedKnots) (여기서 recommendedSpeedKnots = aiRecommendedSpeedKnots ?? report.recommendedSpeed).
현재 속도 ETA = etaMsAtSpeed(report.recommendedSpeed, anchorHours, now, currentSpeedKnots).
각각의 마진 = (deadlineMs - etaMs) / 3600000 → 6.2장 함수에 넣어 확률 산출. → recommendedSpeedProbability, currentSpeedProbability.

② 필요 속도: computeRequiredSpeedKnots(report.recommendedSpeed, report.etaIfRecommended, nowIso, deadlineIso).

③ 연료/CO₂ 절감 (최초 계획 속도 대비) — 일정과 무관하게, 남은 거리를 "계획 속도"로 갔을 때와 "권장 속도"로 갔을 때의 실제 연료 소모 차이(선박 연료 커브 선형보간 기반)로 계산한다:

interpolateFuelRate(fuelCurve, speedKnots):
  curve를 speedKnots 오름차순 정렬
  speedKnots가 최솟값보다 작으면 → 최솟값의 fuelTonPerDay
  speedKnots가 최댓값보다 크면 → 최댓값의 fuelTonPerDay
  그 사이면 인접한 두 점 사이 선형보간

planDailyRate = interpolateFuelRate(vessel.fuelCurve, report.currentPlanSpeed)
recDailyRate  = interpolateFuelRate(vessel.fuelCurve, recommendedSpeedKnots)
planFuelTon = planDailyRate · (remainingNm / report.currentPlanSpeed / 24)
recFuelTon  = recDailyRate  · (remainingNm / recommendedSpeedKnots / 24)
fuelSavedTon = planFuelTon - recFuelTon
fuelSavingPercent = planFuelTon > 0 ? fuelSavedTon/planFuelTon·100 : 0
co2SavedTon = fuelSavedTon · fuelEmissionFactor(voyage.fuelType)

fuelEmissionFactor: HFO=3.114, MGO=3.206, LNG=2.750 (ton CO₂ / ton 연료), 알 수 없는 값은 HFO 계수로 폴백.

④ 연료/CO₂ 절감 (현재 실시간 속도 대비) — 동일한 계산을 "계획 속도" 대신 "지금 이 순간의 실시간 속도" 기준으로 한 번 더 수행 (지금부터 권장 속도로 전환하면 추가로 얻는 절감분):

currentDailyRate = interpolateFuelRate(vessel.fuelCurve, currentSpeedKnots)
currentLiveFuelTon = currentDailyRate · (remainingNm / currentSpeedKnots / 24)
fuelSavedTonFromCurrent = currentLiveFuelTon - recFuelTon
fuelSavingPercentFromCurrent = currentLiveFuelTon > 0 ? fuelSavedTonFromCurrent/currentLiveFuelTon·100 : 0
co2SavedTonFromCurrent = fuelSavedTonFromCurrent · fuelEmissionFactor(voyage.fuelType)

출력 필드: recommendedSpeedKnots, requiredSpeedKnots, hoursUntilDeadline, currentSpeedProbability, recommendedSpeedProbability, etaAtCurrent, etaAtRecommended, fuelSavingPercent, co2SavedTon, fuelSavingPercentFromCurrent, co2SavedTonFromCurrent.

### 6.5 도착항 혼잡도
getPortCongestion(portName): 항구명을 소문자로 변환 후, congestion 테이블의 matchNames 중 하나라도 부분 문자열로 포함되면 그 행을 반환. 없으면 기본값(3.2장 표 참고). congestionLevel(score): score>=65→high, score>=40→medium, 그 외 low.

### 6.6 인근 지역 이슈
nearbyIssues(remainingRoutePoints, issues, thresholdNm=600):
  remainingRoutePoints 중 하나라도 issue와의 haversineNm 거리가 thresholdNm 이내인 issue만 반환

remainingRoutePoints는 6.1장의 remainingRoute(routePoints, position) 결과(현재 위치부터 도착지까지). 즉 이미 지난 구간에만 있던 이슈는 제외된다.

### 6.7 실시간 기상
두 지점(현재 위치, 도착항 좌표)에 대해 Open-Meteo를 병렬 호출한다(각 8초 타임아웃):

GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms
GET https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lng}&current=wave_height

풍속(m/s)·풍향(도)·파고(m)를 읽는다(응답에 없으면 0으로 폴백). 두 호출 중 일부가 실패해도(Promise.allSettled) 성공한 지점만 표시하고, 모두 실패했을 때만 에러 상태로 표시한다. "재분석" 버튼을 누르면 좌표가 그대로여도 refreshToken을 증가시켜 강제로 재조회한다. 해상 상태 등급 기준은 5.4장 표와 동일.



## 7. AI 재분석 (Gemini 연동)

### 7.1 트리거
카드별 재분석 버튼(개별) — 클릭 시 해당 리포트만 재분석.
헤더의 "전체 재분석" 버튼 — 모든 리포트를 Promise.all로 동시에 재분석 요청.
두 경우 모두: 요청 시작 시 ① 해당 리포트를 "분석 중" 상태로 표시(배너), ② 그 리포트의 기상 refreshToken을 1 증가시켜 실시간 기상도 함께 강제 재조회, ③ 이전 에러 상태가 있었다면 제거.

### 7.2 클라이언트 → 서버 요청 payload
interface AiReanalyzeRequest {
  lang: 'ko' | 'en'
  vessel: { name: string; type: string; imo: string }
  route: { departurePort: string; arrivalPort: string; cargoDescription: string }
  deadlineTerm: 'RTA' | 'STA'
  deadlineAt: string          // rtaConfirmed ? voyage.rta : voyage.sta
  nowIso: string               // report.generatedAt (6장과 동일한 "지금")
  baselineEtaAt: string        // report.etaIfRecommended (6.4장의 앵커)
  progress: { totalNm: number; traveledNm: number; remainingNm: number; progressPercent: number }
  currentPos: { lat: number; lng: number }
  arrivalPos: { lat: number; lng: number }   // 남은 항로의 마지막 좌표(없으면 {0,0})
  currentSpeedKnots: number
  currentSpeedProbabilityPercent: number
  marginHoursAtCurrentSpeed: number
  planSpeedKnots: number                     // report.currentPlanSpeed
  baselineRecommendedSpeedKnots: number      // report.recommendedSpeed
  speedRangeKnots: { min: number; max: number }  // vessel.fuelCurve의 speedKnots 최소/최대
  fuelCurve: { speedKnots: number; fuelTonPerDay: number }[]
  congestion: { level: 'low'|'medium'|'high'; score: number; avgWaitHours: number; berthsAvailable: number; berthsTotal: number; trend: 'rising'|'stable'|'falling' }
  nearbyIssues: { title: string; description: string; severity: 'high'|'medium'|'low' }[]
}

요청은 POST /api/ai-report/reanalyze, 60초 타임아웃.

### 7.3 서버 처리
body 필수 필드 검증(누락 시 { ok: false, reason: 'bad_request' }, HTTP 400).
Gemini 설정 확인: Vertex AI 경로면 GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT, 아니면 GEMINI_API_KEY(또는 GOOGLE_API_KEY) 필요. 미설정이면 { ok: false, reason: 'no_api_key' }(HTTP 200 — 실패이지만 "정상적으로 설정 안 됨"이라는 의미라 200으로 반환).
클라이언트와 동일한 Open-Meteo 조회를 서버에서 한 번 더 수행(현재 위치·도착항 풍속/파고) — Gemini 키는 서버 전용이라 클라이언트 상태에 의존하지 않기 위함. 구현 주의: 6.7장의 조회 로직을 재사용하려고 클라이언트 훅(useState/useEffect) 파일을 서버 라우트가 그대로 import하면 "client 훅을 import했다"는 빌드 에러가 난다. fetch 로직은 훅이 없는 별도 파일로 분리해 클라이언트 훅 파일과 서버 라우트 양쪽에서 그 파일만 import한다(KNOWN_PITFALLS.md 1.9).
requiredSpeedKnots = computeRequiredSpeedKnots(baselineRecommendedSpeedKnots, baselineEtaAt, nowIso, deadlineAt) — 6.3장과 완전히 동일한 함수/공식을 서버에도 구현.
Gemini 호출: 모델 기본값 gemini-2.5-flash(env GEMINI_MODEL로 override 가능). responseMimeType: application/json + 아래 JSON 스키마로 구조화 출력 강제:

{
  "type": "object",
  "properties": {
    "recommendedSpeedKnots": { "type": "number" },
    "reasoning": { "type": "string" },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "level": { "type": "string", "enum": ["high", "medium", "low"] },
          "category": { "type": "string", "enum": ["weather", "port", "geopolitical", "mechanical"] },
          "title": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["level", "category", "title", "description"]
      }
    }
  },
  "required": ["recommendedSpeedKnots", "reasoning", "risks"]
}

프롬프트 전문 (영어로 고정 작성, 마지막에 "Write the response in {Korean|English}"로 응답 언어만 지정):

You are a maritime voyage-optimization analyst for a shipping line. Given the following REAL-TIME voyage
data, recommend an optimal speed and produce a concise, grounded operational analysis. Only reference facts
given below -- do not invent vessel incidents, ports, or figures not present here. Treat the numbers below
(especially the required-speed constraint) as ground truth -- do not recompute them differently yourself.

Vessel: {vessel.name} ({vessel.type}, IMO {vessel.imo})
Feasible speed range: {min}-{max}kts
Fuel consumption curve (speed -> daily fuel use, lower speed = more efficient): {speed}kts -> {fuel} ton/day, ...
Route: {departurePort} -> {arrivalPort}
Cargo: {cargoDescription}
Original planned speed: {planSpeedKnots}kts
Rule-based baseline recommended speed (for reference only, you may deviate from it as long as you respect
the required-speed constraint below): {baselineRecommendedSpeedKnots}kts
Deadline ({deadlineTerm}): {deadlineAt} ({hoursUntilDeadline}h from now)
Progress: {traveledNm}nm traveled / {remainingNm}nm remaining of {totalNm}nm total ({progressPercent}%)
Current speed: {currentSpeedKnots}kts -- {deadlineTerm} compliance probability at current speed:
{currentSpeedProbabilityPercent}% (margin {marginHoursAtCurrentSpeed}h)
{requiredSpeedNote}
Current position weather: wind {windSpeed|unknown} m/s, wave height {waveHeight|unknown} m
Arrival port weather: wind {windSpeed|unknown} m/s, wave height {waveHeight|unknown} m
Arrival port congestion: {level} (score {score}/100), avg wait {avgWaitHours}h, berths available
{berthsAvailable}/{berthsTotal}, trend {trend}
Regional issues near the remaining route:
{issue 목록, "- [severity] title: description" 형식, 없으면 "(none reported)"}

Recommend a speed (knots, within the feasible range above) that balances:
- Meeting the {deadlineTerm} deadline per the required-speed constraint above (this is a hard floor, not a
  suggestion).
- Above that floor, minimizing fuel burn per the fuel curve -- do not recommend faster than necessary if
  there is schedule slack above the floor, especially if the arrival port is congested (arriving early into
  a congested port wastes fuel for no benefit).
- Weather/sea-state safety -- if wave height is high, mention the tradeoff, but you may still need to stay
  at or above the required-speed floor to meet the deadline.

Write the response in {Korean|English}.
Produce:
1. "recommendedSpeedKnots": the single recommended speed in knots (a number, within the feasible range,
   respecting the required-speed constraint above).
2. "reasoning": a 2-4 sentence operational analysis explaining WHY that speed was chosen (schedule margin,
   congestion, weather, fuel efficiency), explicitly referencing the real figures above -- the speed you
   state here MUST match recommendedSpeedKnots exactly. Put each distinct point on its own line (use \n
   between sentences).
3. "risks": 1-4 risk items synthesized strictly from the weather/congestion/regional-issue data above (skip
   categories with nothing to report; never invent unrelated risks). Each item needs a level
   (high/medium/low), a category (weather/port/geopolitical/mechanical), a short title, and a one-sentence
   description.

requiredSpeedNote는 두 경우로 분기:

필요속도가 최대 가능속도를 넘으면(마감 불가능): "Required average speed to meet the deadline is {N}kts, which EXCEEDS this vessel's max feasible speed ({max}kts) -- the deadline cannot be met even at full speed. In this case you MUST recommend exactly {max}kts (the max feasible speed) as the best effort, and explain in the reasoning that even max speed cannot meet the deadline."
가능하면: "Required average speed to meet the deadline is {N}kts (feasible). Your recommendedSpeedKnots MUST be >= {N}kts so the deadline is met with zero or positive margin -- never recommend a speed below this, even to save fuel."

### 7.4 응답 후처리(서버 측 보정 — 반드시 구현)
응답 JSON 파싱 실패, 타입 불일치(recommendedSpeedKnots가 유한한 숫자가 아님/reasoning이 문자열이 아님/risks가 배열이 아님), 또는 유효한 risk가 0개면 → { ok: false, reason: 'upstream_error' }.
risks는 level/category가 허용된 enum 값이고 title/description이 문자열인 항목만 걸러서 최대 6개까지만 사용.
속도 강제 보정(이 기능의 핵심 불변식) — 모델이 범위를 벗어나거나 마감을 못 지키는 속도를 제안해도, 서버가 최종적으로 항상 보정한다: "권장 속도에서 {RTA|STA} 준수 확률은 항상 100%(불가능하면 최고속력)"라는 원칙을 모델의 실수와 무관하게 보장해야 한다.

clamped = clamp(gemini의 recommendedSpeedKnots, speedRangeKnots.min, speedRangeKnots.max)
if requiredSpeedKnots > speedRangeKnots.max:
  최종 speed = round(speedRangeKnots.max · 10) / 10          # 최고속력이 최선
else:
  최종 speed = clamp(round(clamped · 10) / 10, 하한=requiredSpeedKnots, 상한=speedRangeKnots.max)

reasoning에 줄바꿈이 하나도 없으면(모델이 \n 지시를 무시한 경우), 문장 종결부호(.!?) 뒤에서 강제로 줄바꿈을 삽입하는 방어 로직을 둔다.
3번에서 최종 속도가 모델이 원래 제안한 값과 0.05kts 이상 다르면, reasoning 끝에 보정 안내를 한 줄 덧붙인다:
ko: (참고: {RTA|STA} 준수를 위해 필요한 속도 기준으로 {N}kts로 자동 보정되었습니다.)
en: (Note: automatically adjusted to {N}kts to meet the {RTA|STA} deadline.)
성공 응답: { ok: true, reasoning, risks, recommendedSpeedKnots, model }. 실패(Gemini 호출 자체 예외 포함)는 { ok: false, reason: 'upstream_error' }.

### 7.5 클라이언트 반영 규칙
성공하면 { reasoning, risks, recommendedSpeedKnots, lang }을 그 리포트 id의 override로 저장하고, 이후 화면·PDF 모두 이 override를 baseline 대신 사용한다(baseline mock 데이터 자체는 변경하지 않음).
언어 불일치 무효화: override는 생성 당시 UI 언어와 현재 UI 언어가 같을 때만 사용한다. 사용자가 언어를 전환하면(예: ko→en) 재분석 전까지는 다시 baseline mock으로 되돌아간다(다른 언어로 재분석 결과를 잘못 노출하지 않기 위함).
실패하면 해당 리포트의 에러 상태만 기록하고(no_api_key | 그 외), 화면에는 baseline 그대로 표시 + 경고 문구만 추가로 노출한다.



## 8. 외부 딥링크 연동 (선택)
보내는 쪽 명세: DASHBOARD.md 10장의 함대 게이지 카드 AI 버튼이다. 원본에서 쓰는 정확한 키 이름은 ksf:ai-report-vessel-id 이므로, 대시보드를 함께 만든다면 양쪽 키를 반드시 일치시킨다.

다른 화면(예: 대시보드의 함대 게이지 카드)에서 특정 선박의 리포트로 바로 이동시키고 싶을 때의 패턴:

이동 전: sessionStorage.setItem('ai-report-vessel-id', vesselId) 후 /ai-report로 라우팅.
AI 리포트 페이지 마운트 시 useEffect에서 그 키를 읽고 즉시 제거(1회성 소비) → 해당 선박의 항차 → 리포트를 찾는다.
찾았으면 requestAnimationFrame 콜백 안에서 동기적으로(React의 flushSync 등으로) 그 리포트를 펼침 상태로 먼저 커밋한 뒤, document.getElementById('ai-report-{reportId}').scrollIntoView({ behavior: 'smooth', block: 'start' })를 실행한다.
왜 동기 커밋이 필요한가: 목록은 기본적으로 첫 리포트가 펼쳐진 채로 시작한다. 펼침 상태 변경을 비동기로 두면, 스크롤 위치 계산이 아직 접힘/펼침 전환 전의 레이아웃 높이 기준으로 이루어져 목표 카드가 화면 최상단에서 어긋난다.
각 리포트 카드 최상위 엘리먼트에는 펼침 여부와 무관하게 항상 id="ai-report-{reportId}"를 부여해 둔다 (스크롤 대상 자체는 접힌 상태에서도 안정적으로 찾을 수 있어야 하므로).



## 9. PDF 내보내기
카드 헤더의 FileDown 버튼 클릭 시 브라우저에서 바로 PDF를 생성해 다운로드한다(서버 왕복 없음). 파일명: KSF-AIReport-{voyageId}-{timestamp}.pdf.

### 9.1 문서 레이아웃
A4, 여백 좌 15mm/우 15mm, 본문 폭 180mm, 페이지 하단 280mm에서 자동 페이지 분할. 순서대로:

제목 "KSF Line — AI 운항 리포트"(16pt, 볼드) + 생성 일시(9pt, 회색)
선박명(IMO) + 항로(11pt, 볼드)
섹션 "항해 진행 상황": 총거리/운항거리/남은거리/진행률 (라벨-값 2열 표 형식, 라벨은 좌 15mm, 값은 x=105mm)
섹션 "속도 & {RTA|STA} 준수": 현재속도, 권장속도, STA, RTA, 각 속도별 ETA, 준수확률(+신뢰도), 마진/부족시간, AI 권장 속도 기준 결과, 맨 아래 8pt 회색으로 필요속도 공식
섹션 "연료 절감 & CO₂ 절감": 4개 행(누적/조정 × 연료/CO₂)
섹션 "도착항 예상 혼잡도": 등급(score), 평균대기, 접안가능, 추세
섹션 "AI 분석 근거": 본문 단락(줄바꿈 유지, splitTextToSize로 폭에 맞춰 자동 개행)
섹션 "운항 고려사항": 리스크마다 [레벨라벨] 제목(볼드) + 카테고리(우측, 회색) + 설명 단락
섹션 "남은 항로 인근 지역 이슈": 이슈마다 [심각도라벨] 제목 + 설명 + "출처: {source}"(회색)
하단: "KSF Line — AI 운항 리포팅 생성 (데모 데이터, 참고용)."

섹션 제목은 12pt 볼드 + 밑에 회색 가로선. 표 형태 행(row)은 10pt.

### 9.2 한글 폰트 처리
이 항목은 KNOWN_PITFALLS.md 7.4에 요약되어 있으나, 실제 구현 절차는 이 절이 가장 상세하다. 다른 화면에서 PDF를 내보낼 일이 생기면 여기를 참조한다.

jsPDF 기본 내장 폰트(Helvetica)는 한글 글리프가 없다.

Track A — 반입한 public/fonts/NotoSansKR-Regular.ttf 를 그대로 쓴다. 아래 1번의 "준비" 단계가 필요 없고, fetch('/fonts/NotoSansKR-Regular.ttf')로 바로 시작하면 된다.

Track B — 폰트 파일이 없으면 PDF를 영문 전용으로 만든다 (SIMULATION.md 7.1장의 방식이 그대로 적용 가능하다). 한국어 UI에서도 PDF만 영문으로 나가며, 기능 손실은 없다. 자세한 배경은 BOOTSTRAP.md 1.2장 참고.

한국어 모드로 내보낼 때는:

서브셋된 한글 TTF(예: Noto Sans KR Regular, SIL OFL 라이선스)를 정적 파일로 준비해 fetch.
ArrayBuffer → Uint8Array → base64 문자열로 변환(청크 단위로 String.fromCharCode 후 btoa).
doc.addFileToVFS('폰트파일명.ttf', base64) → doc.addFont(...)로 normal/bold 등록 → 문서 전체에서 이 폰트를 사용.
최초 1회만 fetch하고 이후 호출에서는 캐시(Promise)를 재사용한다.

### 9.3 영문 모드
영문 모드는 기본 Helvetica 폰트를 그대로 쓰되, WinAnsi(Latin-1)로 표현 불가능한 문자(예: 한글)가 들어오면 ?로 치환하는 안전 필터를 거친다(단, — – ' ' " " … • € 등 일부 특수문자는 예외적으로 허용).
mock 리포트 원문(reasoning/risks/지역 이슈)은 한국어로만 작성돼 있으므로, 영문 모드 PDF에서는 report.id(및 risk 인덱스, issue.id)를 키로 하는 영문 번역 사전을 별도로 유지해 그것을 대신 사용한다. (AI 재분석으로 얻은 override 텍스트는 이미 요청 시점의 언어로 생성돼 있으므로 그대로 사용하고 이 사전을 거치지 않는다.) 사전 내용은 이 문서의 부록用으로 원본 한국어 문장과 1:1 대응하는 자연스러운 영어 번역을 작성하면 된다 — 정확한 어휘 일치보다 "같은 정보를 전달하는 영문 문장"이면 충분하다.



## 10. 다국어 텍스트 전체 사전
{term} 형태는 RTA 또는 STA 문자열이 그대로 삽입됨을 뜻한다.


| key | 한국어 | English |
| --- | --- | --- |
| title | AI 운항 리포트 | AI Operations Report |
| subtitle | 에코스피드 권장안 및 운항 리스크 보고서 | Eco-speed recommendations & voyage risk reports |
| reanalyze | 재분석 | Reanalyze |
| reanalyzeAll | 전체 재분석 | Reanalyze All |
| downloadPdf | PDF 다운로드 | Download PDF |
| recSpeed | AI 권장 속도 | AI Rec. Speed |
| co2Saving | CO₂ 절감 | CO₂ Saved |
| co2SavingCumulative | 누적 CO₂ 절감 | Cumulative CO₂ Saved |
| co2SavingAdjustment | 권장속도 조정 CO₂ 절감 | CO₂ Saved (Speed Adjustment) |
| vsOriginalPlan | 최초 계획 속도 대비 | vs. original plan |
| vsCurrentSpeed | 현재 속도 대비 (AI 권장 속도 적용 시) | vs. current speed (if AI speed applied) |
| sta | STA (예정 도착시간) | STA (Scheduled Time of Arrival) |
| rta | RTA (관제소 확정 도착시간) | RTA (Confirmed with Control Center) |
| rtaUnconfirmedValue | 미확정 | Unconfirmed |
| etaAtCurrentSpeed | 현재 속도 도착예정 | ETA at Current Speed |
| etaAtRecommendedSpeed | 권장 속도 도착예정 | ETA at Recommended Speed |
| rtaUnconfirmedNotice | RTA 미확정 — 관제소와 아직 확정되지 않아, 이하 모든 기준은 STA(예정 도착시간)로 표시됩니다. | RTA unconfirmed — not yet finalized with the control center. All figures below are shown against STA (Scheduled Time of Arrival) instead. |
| reasoning | AI 분석 근거 | AI Analysis |
| risks | 운항 고려사항 | Risk Factors |
| fuelSaving | 연료 절감 | Fuel Saved |
| fuelSavingCumulative | 누적 연료 절감 | Cumulative Fuel Saved |
| fuelSavingAdjustment | 권장속도 조정 연료 절감 | Fuel Saved (Speed Adjustment) |
| generated | 생성 | generated |
| progressLineTitle | 항해 진행 상황 | Voyage Progress |
| totalDistance | 총 거리 | Total Distance |
| currentPosition | 현위치 | Current Position |
| liveSpeed | 현재 실시간 속도 | Current Live Speed |
| speedComparison | 속도 비교 | Speed Comparison |
| speedReduceBy(v) | {v} kts 감속 | Reduce by {v} kts |
| speedIncreaseBy(v) | {v} kts 증속 | Increase by {v} kts |
| speedMaintain | 현재 속도 유지 권장 | Maintain current speed |
| traveledDistance | 현재까지 운항거리 | Distance Traveled |
| remainingDistance | 남은 운항거리 | Remaining Distance |
| rtaProbability(term) | {term} 준수 확률 | {term} Compliance Probability |
| rtaProbabilityDesc | 현재 속도 유지 시 | If maintaining current speed |
| confidenceHigh / Medium / Low | 높음 / 보통 / 낮음 | High / Medium / Low |
| marginBuffer(term,h) | {term} 대비 {h}시간 여유 | {h}h buffer vs. {term} |
| marginDeficit(term,h) | {term} 대비 {h}시간 부족 | {h}h short of {term} |
| recommendedGuarantee(term) | AI 권장 속도로 운항 시 {term} 100% 준수 | {term} 100% compliant at AI-recommended speed |
| recommendedInfeasible(term,p) | 선박 최고속력으로도 {term} 준수가 어렵습니다 (예상 확률 {p}%) | Even at max speed, {term} may not be met (est. {p}%) |
| portCongestionTitle | 도착항 예상 혼잡도 | Arrival Port Congestion |
| congestionLow / Medium / High | 원활 / 보통 / 혼잡 | Low / Moderate / High |
| avgWaitHours | 평균 대기시간 | Avg. Wait Time |
| berthAvailability | 접안 가능 선석 | Berth Availability |
| berthCount(a,t) | {a} / {t}척 | {a} / {t} |
| trendRising / Stable / Falling | 악화 추세 / 유지 / 개선 추세 | Worsening / Stable / Improving |
| currentAreaWeather | 현재 운항해역 날씨 | Current Area Weather |
| arrivalPortWeather | 도착항 날씨 | Arrival Port Weather |
| seaStateCalm / Moderate / Rough / High | 평온 / 보통 / 거침 / 높음 | Calm / Moderate / Rough / High |
| weatherFetching | 실시간 기상 조회 중... | Fetching live weather... |
| weatherUnavailable | 실시간 데이터를 불러올 수 없습니다. | Live data unavailable. |
| catWeather / Port / Geopolitical / Mechanical | 기상 / 항만 / 지정학 / 기계 | Weather / Port / Geopolitical / Mechanical |
| regionalIssuesTitle | 남은 항로 인근 지역 이슈 | Regional Issues Ahead |
| noNearbyIssues | 남은 항로 인근에 특이 이슈가 없습니다. | No notable issues on the remaining route. |
| source | 출처 | Source |
| aiGeneratedBadge | Gemini AI 생성 | Gemini AI-Generated |
| aiApiKeyMissing | Gemini API 키가 설정되지 않아 AI 재분석을 사용할 수 없습니다. 기본 데이터를 표시합니다. | Gemini API key is not configured, so AI reanalysis is unavailable. Showing baseline data. |
| aiReanalyzeFailed | AI 재분석에 실패했습니다. 기본 데이터를 표시합니다. 잠시 후 다시 시도해주세요. | AI reanalysis failed. Showing baseline data -- please try again shortly. |
| aiAnalyzingBanner | Gemini AI가 실시간 기상·혼잡도·일정을 반영해 권장 속도와 분석 근거를 다시 계산하고 있습니다 (약 15~30초 소요). | Gemini AI is recalculating the recommended speed and analysis using live weather, congestion, and schedule data (takes about 15-30s). |
| requiredSpeedFormula(nm,h,kts) | 필요 평균 속도 = 예상 거리 {nm}nm ÷ 잔여 시간 {h}h = {kts}kts | Required avg. speed = est. distance {nm}nm / time remaining {h}h = {kts}kts |
| switchToRecommendedHint(term,kts) | → AI 권장 속도({kts}kts)로 전환 시 {term} 100% 준수 가능 | → Switching to the AI-recommended speed ({kts}kts) achieves 100% {term} compliance |


공용(risk/congestion severity) 라벨 — status.high/medium/low: 위험/주의/정보 (High/Medium/Info).



## 11. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 (강조 텍스트·아이콘·포커스 링·진행 바에 전역적으로 사용).
의미 색: 성공=green-600/400(dark), 경고=yellow-600/400, 위험=red-600/400, 정보/기본=slate 계열.
카드 기본 스타일: bg-white dark:bg-slate-800(또는 최상위 카드는 slate-900), border border-slate-200 dark:border-slate-700, rounded-lg(작은 카드) / rounded-xl(리포트 카드 전체), 내부 여백 px-4 py-3.
타이포: 카드 라벨 14px 회색, 값 20~36px(강조 영역일수록 크게) bold, 섹션 소제목 16px semibold.
간격: 리포트 카드 내부 섹션 간 20px(space-y-5), 그리드 칸 간격 12px(gap-3).
다크 모드: 모든 텍스트/배경/테두리 색은 dark: variant를 함께 정의한다(다크 모드 없이 구현해도 기능상 문제는 없음).
아이콘 세트: lucide-react를 사용. 이 화면에서 쓰인 아이콘: Ship, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Info, ArrowRight, Navigation, Anchor, Wind, Shield, Wrench, MapPin, TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert, Fuel, Leaf, Timer, CalendarCheck, CalendarClock, AlertCircle, RadioTower, FileDown, Sparkles, Gauge, Waves, Loader2.



## 12. 엣지 케이스 및 불변식
이 항목들은 재구현 시 특히 놓치기 쉬운 부분이다.

날짜/숫자 로케일은 UI 언어와 무관하게 고정: 이 프로젝트에서는 날짜·숫자 포맷 함수가 항상 ko-KR 로케일로 고정되어 있다(영문 UI에서도 날짜가 2026. 08. 02. 06:00 형식으로 보임). 다국어를 지원하되 "숫자 포맷까지 언어별로 바꿀지"는 재구현 시 자유롭게 선택해도 되는 부분이지만, 원본과 100% 동일하게 가려면 날짜/숫자는 항상 ko-KR 고정으로 구현한다.
RTA 미확정 시 모든 계산은 STA를 사용: deadlineIso, deadlineTerm을 파생하는 지점(6.4장 호출부)에서 한 곳만 분기하면 나머지 계산 함수들은 파라미터로 받은 deadlineIso만 보고 그대로 동작해야 한다(함수 내부에서 다시 rtaConfirmed를 참조하지 않는다).
권장 속도 확률은 항상 100%이거나, 그게 불가능하면 최고속력 기준값: 규칙 기반 baseline이든 Gemini 재분석이든, "권장 속도"라는 것 자체가 이미 마감을 지키도록 역산된 값이어야 한다는 것이 이 기능의 핵심 전제다. UI에도(ShieldCheck/ShieldAlert 분기) 이 전제가 그대로 노출된다.
연료/CO₂ 절감은 일정 마진과 무관하게 항상 "속도 변경으로 인한 실제 연료 차이": 즉 "얼마나 여유 있는지"가 아니라 "그 속도 변경이 실제로 연료를 얼마나 아꼈는지"를 보여주는 지표이므로, 마진 계산과 완전히 분리된 별도 공식(6.4장 ③④)이다.
언어 전환 시 AI override 초기화: override는 "생성 당시 언어"를 함께 저장해두고, 현재 언어와 다르면 화면에서 무시(=baseline으로 자동 복귀)한다. mock 자체를 지우지는 않는다.
인근 이슈는 "남은 항로"만 기준: 이미 지나온 구간 근처의 이슈는 나열하지 않는다(현재 위치 기준으로 항로를 앞부분만 잘라서 검사).
속도 비교 문구의 임계값: 현재 속도와 권장 속도 차이가 0.05kts 미만일 때만 "유지 권장" 문구를 쓰고, 그 이상 차이 나면 감속/증속 문구를 쓴다(부동소수점 오차로 미세하게 다른데 "유지"가 안 뜨는 문제 방지).
PDF는 클라이언트에서 즉시 생성: 서버 왕복이 없고, 재분석 override가 있으면(현재 UI 언어와 일치하는 경우) override를 우선 사용하고, 없으면 언어별 mock 텍스트(한국어 원문 또는 영문 사전)를 사용한다.



## 13. 재구현 체크리스트
데이터 모델 4종(Vessel/Voyage/EcoSpeedReport/PortCongestion) + mock 4세트(선박·항차·리포트·위치) 입력
리포트 목록을 아코디언 카드로 렌더링(기본: 첫 리포트 펼침), 헤더 요약 3지표 노출
항해 진행률(haversine 기반) + 진행 바 컴포넌트
RTA/STA 준수 확률 게이지(마진 기반, 색상 3단계 + STA용 파란 계열)
필요 속도·속도 계획 계산(앵커 비율 방식) — 4개 스탯 카드(STA/RTA/ETA×2) + 4개 스탯 카드(CO₂/연료×2)
항구 혼잡도 매칭 + 등급 카드
Open-Meteo 실시간 기상 2지점(현재/도착항) 조회 + 해상 상태 등급
인근 지역 이슈 필터링(600nm, 남은 항로만) + 리스트 UI
"재분석" 개별/전체 버튼 → Gemini 호출(서버 라우트) → 응답 보정 로직 → override 반영
Gemini 미설정/실패 시 에러 배너 + baseline 폴백
언어 전환 시 override 무효화
PDF 다운로드(A4, 한글 폰트 임베딩 또는 영문 폴백)
다국어(ko/en) 텍스트 전체 적용
(선택) 다른 화면에서의 선박별 딥링크 연동

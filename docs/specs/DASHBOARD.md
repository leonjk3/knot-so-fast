
# 실시간 운항 대시보드 — 단독 기능 명세서 (Live Operations Dashboard)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "실시간 운항 대시보드" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 화면은 원본 프로젝트에서 가장 크고 데모 임팩트가 가장 큰 화면입니다(원본 코드 약 2,000줄). 다른 화면에 의존하지 않고 단독 구현 가능하며, 다른 화면으로 나가는 딥링크 3종은 10장에 선택 구현으로 분리했습니다.

해커톤 원칙 — 반드시 읽을 것: 이 화면은 분량이 크므로 단계별로 완성한다. 아래 순서대로 구현하면 어느 단계에서 멈춰도 "동작하는 대시보드"가 남는다.


| 단계 | 범위 | 누적 소요 감각 |
| --- | --- | --- |
| L1 (필수) | 상단 요약 카드 + 지도 + 선박 마커 + 항로 | 화면이 "돌아가는" 최소선 |
| L2 (권장) | 빠른 필터 + 도착지 필터 + 함대 게이지 카드 | 데모의 핵심 인터랙션 |
| L3 (여유) | 이슈/항구 리스트 패널 + 요약 팝업 + 범례 | 밀도 |
| L4 (선택) | 실시간 기상·태풍 API, 딥링크, 자동 새로고침 | 외부 의존 |


지도 관련 함정은 이미 KNOWN_PITFALLS.md 2장에 9건이 정리되어 있다. 지도를 만지기 전에 그 장을 먼저 읽으면 대부분을 겪지 않는다.



## 목차
개요
접근 권한
데이터 모델
화면 레이아웃 개요
상단 요약 카드 6종
함대 게이지 카드
필터 바
이슈·항구 리스트 패널과 요약 팝업
지도 (MapView)
외부 딥링크 연동 (선택)
외부 API 연동 (선택)
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
선단 전체의 현재 상태를 한 화면에서 파악하는 관제 화면이다. 상단에는 운항·탄소 지표 요약, 중단에는 선박별 연료·탄소 게이지, 하단에는 전 세계 지도에 선박·항로·항구·기상·태풍·지역 이슈를 겹쳐 표시한다.

### 1.2 핵심 개념
자사 선단 vs 타사 선단: 지도에는 자사 선박(company === 'KSF Line')과 타사 선박이 함께 뜬다. 타사는 배경 트래픽(참고용)이며 옅은 채움으로 구분한다. 통계·게이지·랭킹은 자사만 집계한다.
활성 항차(activeVoyages): 자사 항차 중 underway 또는 delayed. 상단 통계와 함대 게이지의 기준 집합이다.
빠른 필터(Quick Filter) — 이 화면의 인터랙션 중심. My / 기상 / 선박 / 이슈 / 항구 5개를 다중 선택할 수 있고, 아무것도 선택하지 않으면 전체 표시, 하나라도 선택하면 선택한 것만 표시(좁혀나가기) 방식으로 동작한다.
도착지 필터: 도착 항구 코드별로 선박을 좁히는 2차 필터. 가로 스크롤되는 알약 버튼 목록.
지도 이음매(seam): 지도를 표준 ±180°가 아니라 경도 -30°(북대서양 한가운데) 에서 끊어, 좌측부터 유럽·아프리카 → 아시아 → 태평양 → 미주 순으로 이어 보이게 한다. 이 화면 지도 로직의 상당 부분이 이 결정에서 파생된다(9.2장).



## 2. 접근 권한
모든 역할(ADMIN · LOGISTICS · CAPTAIN · CLIENT)이 접근 가능한 유일한 화면이다. 로그인 후 기본 랜딩 페이지이기도 하다(/ → /dashboard 리다이렉트).
별도 프론트 전용 데모 앱으로 만든다면 이 제약은 생략해도 무방하다.



## 3. 데이터 모델

### 3.1 타입 정의
// ── 공통 도메인(다른 스펙과 동일) ─────────────────────────
interface Vessel {
  id: string; name: string; imo: string; company: string
  fuelCurve: { speedKnots: number; fuelTonPerDay: number }[]
  // 그 외 선박 스펙은 이 화면에서 쓰이지 않음
}

interface Voyage {
  id: string; vesselId: string
  departurePort: string; arrivalPort: string   // "부산 (Busan)" 형태
  etd: string; eta: string; rta: string        // ISO 8601
  status: 'preparing' | 'underway' | 'delayed' | 'completed' | 'cancelled'
  plannedRoute: { lat: number; lng: number }[]
  plannedSpeedKnots: number; recommendedSpeedKnots: number
  fuelType: 'HFO' | 'MGO' | 'LNG'
  distanceNm: number
}

interface AisPosition {
  vesselId: string; lat: number; lng: number
  speedKnots: number
  cogDegrees: number      // 침로(0~360) — 선박 마커 회전각
}

interface Port { code: string; name: string; nameEn: string; lat: number; lng: number }

// ── 이 화면 전용 오버레이 ────────────────────────────────
interface TyphoonWarning {
  id: string; name: string; lat: number; lng: number
  intensity: 'TD' | 'TS' | 'TY' | 'STY'
  windSpeedKnots: number; radiusKm: number
  movingDir: string; movingSpeedKnots: number
}

interface RegionalIssue {
  id: string; lat: number; lng: number
  type: 'piracy' | 'port_congestion' | 'geopolitical' | 'canal_control'
  title: string; description: string
  severity: 'high' | 'medium' | 'low'
  source: string
}

interface DangerZone {
  id: string; center: [number, number]; radiusKm: number
  type: 'collision_risk' | 'restricted' | 'piracy'
  label: string; color: string          // 색을 데이터가 직접 들고 있다
}

interface WeatherPoint {
  name: string; lat: number; lng: number
  windSpeed: number    // m/s
  windDir: number      // 도(기상학적 — 바람이 불어오는 방향)
  waveHeight: number   // m
}

### 3.2 재현용 샘플 데이터 — 지역 이슈 7건

| id | 위치(lat, lng) | type | title | severity | source |
| --- | --- | --- | --- | --- | --- |
| i001 | 12.5, 45 | piracy | 해적 활동 경보 | high | IMB Piracy Reporting Centre |
| i002 | 30.5, 32.3 | canal_control | 수에즈 운하 통항 지연 | medium | SCA (수에즈 운하청) |
| i003 | 31.3, 121.8 | port_congestion | 상하이항 터미널 혼잡 | medium | 상하이 항만국 |
| i004 | 1.3, 103.8 | geopolitical | 말라카 해협 통항 규제 | low | 말레이시아 해사청 |
| i005 | 15, 42 | geopolitical | 홍해 안보 위협 | high | UKMTO / MSCHOA |
| i006 | 22.3, 114.2 | port_congestion | 홍콩항 혼잡 | low | 홍콩 항만물류국 |
| i007 | 26.6, 56.5 | geopolitical | 호르무즈 해협 긴장 고조 | high | UKMTO / IMO |


설명문(description)은 팝업과 리스트 툴팁에 그대로 노출된다. 예시:

i001 — 아덴만 일대 해적 위협 증가. IMB 경보 Level 2. 순찰 강화 중이나 우회 항로 권고.
i002 — 선박 증가로 대기 시간 평균 18시간. 남·북행 각 2개 호송대 운영 중.
i003 — 컨테이너 터미널 혼잡으로 입항 대기 평균 3.2일. 양양·닝보 대체 입항 권장.
i004 — 대형 선박(DWT 300,000+) 야간 통항 제한. 파일럿 필수 탑승.
i005 — 후티 세력의 민간 선박 공격 지속. 미·영 합동 호위 작전 운영 중. 희망봉 우회 권고.
i006 — 파업 여파로 컨테이너 처리 지연. 입항 대기 1.8일.
i007 — 이란-미국 군사 대치로 상선 통항 제한 가능성. 이란 혁명수비대 해상 검문 사례 보고. 통항 시 VHF Ch.16 상시 감청 및 속도 제한 준수 요망.

설계 의도: high 3건 / medium 2건 / low 2건으로 배분되어, 요약 팝업의 심각도 집계와 "⚠ 심각도 높음" 목록이 모두 비지 않게 되어 있다. 유형도 4종이 모두 등장한다.

### 3.3 재현용 샘플 데이터 — 위험구역 5건

| id | center(lat, lng) | radiusKm | type | label | color |
| --- | --- | --- | --- | --- | --- |
| dz001 | 1.3, 103.8 | 120 | collision_risk | 말라카 해협 충돌 위험 | #f59e0b |
| dz002 | 12, 44 | 300 | piracy | 아덴만 해적 위험구역 | #ef4444 |
| dz003 | 16, 112 | 400 | restricted | 남중국해 분쟁 수역 | #8b5cf6 |
| dz004 | 14.5, 42.5 | 400 | piracy | 홍해 위협 구역 | #ef4444 |
| dz005 | 26.6, 56.5 | 180 | restricted | 호르무즈 해협 분쟁수역 | #8b5cf6 |


### 3.4 재현용 샘플 데이터 — 태풍 2건

| id | name | 위치 | intensity | windSpeedKnots | radiusKm | movingDir | movingSpeedKnots |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t001 | 태풍 MAWAR | 18, 135 | TY | 85 | 350 | 북북서 | 12 |
| t002 | 저기압 BOB-02 | 12, 88 | TS | 45 | 200 | 북 | 8 |


### 3.5 재현용 샘플 데이터 — 기상 8지점
실시간 API를 붙이지 않으면 아래 좌표에 임의의 값(풍속 318 m/s, 파고 0.54.5 m)을 넣어 그대로 쓴다.


| name | lat | lng |
| --- | --- | --- |
| 아라비아해 | 15 | 65 |
| 말라카 해협 | 3 | 104 |
| 남중국해 | 12 | 118 |
| 서태평양 | 25 | 145 |
| 홍해 | 15 | 42 |
| 지중해 | 36 | 24 |
| 희망봉 | -35 | 20 |
| 북대서양 | 45 | -30 |


### 3.6 재현용 샘플 데이터 — 탄소 지표
CARBON_BENCHMARK_MULTIPLIER = 1.2145      // 목표 배출량 = 현재 × 이 배수

MOCK_CII_SCORE_BY_VOYAGE = {
  voy001: 4.50, voy002: 3.30, voy003: 4.70,
  voy004: 5.35, voy005: 3.95, voy006: 5.75,
}

MOCK_FLEET_ECO_RANKING = [               // co2SavedPct 내림차순으로 상위 3척만 표시
  { vesselId: 'v001', co2SavedPct: 17.7 },   // KSF PIONEER
  { vesselId: 'v005', co2SavedPct: 24.3 },   // KSF ASPIRE   ← 1위
  { vesselId: 'v004', co2SavedPct: 21.1 },   // KSF HORIZON  ← 2위
  { vesselId: 'v002', co2SavedPct: 14.2 },   // KSF NAVIGATOR
  { vesselId: 'v003', co2SavedPct:  9.8 },   // KSF VENTURE
]

CII 등급 산출 (점수가 낮을수록 좋음):

ciiGradeFromScore(score):
  score < 3.5  → 'A'      색 #16a34a
  score < 4.0  → 'B'      색 #84cc16
  score < 4.95 → 'C'      색 #d97706
  score < 5.6  → 'D'      색 #ea580c
  그 외        → 'E'      색 #dc2626

### 3.7 선박·항차·위치 데이터
자사 선박 5척·항차 8건·AIS 위치 4건은 SCHEDULE.md 3.3~3.4장과 VESSEL.md 3.2장의 것을 그대로 쓴다. AIS 위치는 SCHEDULE.md 6.1장의 표를 사용한다.

타사 선단(선택): 원본은 타사 선박 34척을 배경 트래픽으로 깔았다.

Track A — 반입한 mocks/otherFleet.ts를 그대로 쓴다(회사 8곳·선명 조합·항로 보간까지 포함된 절차적 생성 코드다). 추가 작업 없음.
Track B — 생략한다. 지도가 다소 한산해 보일 뿐 기능은 완전하다. 자세한 배경은 BOOTSTRAP.md 1.2장 참고.

직접 만든다면 자사와 동일한 Vessel/Voyage/AisPosition 형태로 만들되 company만 타사명으로 둔다.

### 3.8 데이터 소스
SCHEDULE.md 3.5장과 동일하다 — mock 전용이 기본 권장. 오버레이 데이터(이슈·위험구역·태풍·기상)는 DB로 이관하지 않고 항상 정적 상수로 둔다.



## 4. 화면 레이아웃 개요
세로 flex(flex flex-col min-h-full)로 위에서부터 6개 블록이 쌓인다. 페이지 전체가 스크롤되며, 지도만 따로 스크롤되지 않는다.


| # | 블록 | 조건부 | 장 |
| --- | --- | --- | --- |
| 1 | 페이지 헤더(+ 자동 새로고침 버튼) | 항상 | 4.1 |
| 2 | 상단 요약 카드 6종 (8열 그리드) | 항상 | 5 |
| 3 | 함대 게이지 카드 | 활성 항차 ≥ 1 | 6 |
| 4 | 필터 바 | 항상 | 7 |
| 5 | 이슈·항구 리스트 패널 | "이슈" 또는 "항구" 필터 ON | 8 |
| 6 | 지도 영역 | 항상 | 9 |


지도 영역의 최소 높이: flex-1 flex min-h-[500px]. 상단 블록이 늘어나 뷰포트를 넘겨도 지도를 계속 짜부라뜨리지 않고, 최소 500px를 보장한 뒤 페이지 전체가 스크롤되게 한다.

### 4.1 페이지 헤더
공용 PageHeader(높이 64px 고정) 사용. 타이틀 "실시간 운항 대시보드", 부제 "선박 위치 및 항로·해상 기상 현황".
우측 액션 영역(children)에 자동 새로고침 컨트롤 하나:
28×28px RefreshCw 아이콘 버튼. 클릭하면 아이콘이 왼쪽으로 살짝 밀리며(-translate-x-1) 오른쪽에서 주기 선택 <select>가 폭 0 → 96px로 펼쳐진다(transition-all duration-300).
주기를 고르면 select는 다시 접히고 아이콘이 제자리로 돌아온다.
주기가 설정된 동안에는 아이콘이 빨간색으로 바뀌고 3초 주기로 천천히 회전한다 (animate-[spin_3s_linear_infinite]).
옵션: 새로고침 안함(0) / 10분 / 30분 / 1시간.
동작: setInterval로 router.refresh() 호출. 값이 0이면 타이머를 걸지 않는다.



## 5. 상단 요약 카드 6종
컨테이너: px-6 py-2, grid grid-cols-4 md:grid-cols-8 gap-2, 흰 배경, 하단 보더, shrink-0. 카드는 모두 rounded-lg bg-white dark:bg-slate-800 border shadow-sm.


| 카드 | 차지 열 | 내용 |
| --- | --- | --- |
| ① 운항 지표 4종 | 2 | 2×2 배치 |
| ② 목표/현재 탄소배출량 | 2 | 좌우 2분할 |
| ③ CII 등급 | 1 |  |
| ④ 이번 항차 에코 랭킹 | 1 | Top 3 |
| ⑤ 이번 주 일정 | 2 | 주간 캘린더 |


### 5.1 ① 운항 지표 4종 (2칸)
2×2 그리드로 배치한다 — grid grid-cols-2 grid-rows-2 grid-flow-col을 명시해야 배열 순서가 1열: 운항중선박/지연항차, 2열: 오늘완료/평균연료절감으로 흐른다.

각 항목 한 줄: 아이콘(14px) + 라벨(10px 회색, 우측정렬, truncate) + " :" + 값(12px bold).


| 라벨 | 값 | 아이콘 | 색 |
| --- | --- | --- | --- |
| 운항 중 선박 | {활성 항차 수}척 | Ship | #6366f1 |
| 지연 항차 | {delayed 수}건 | AlertTriangle | red-500 |
| 오늘 완료 | {오늘 ETA인 completed 수}건 | CheckCircle | green-500 |
| 평균 연료 절감 | {평균}%(소수 0자리) | TrendingDown | purple-500 |


오늘 완료 = 자사 항차 중 status === 'completed' && eta의 날짜가 오늘
평균 연료 절감 = 함대 게이지 각 행의 fuelSavingPercent 산술평균 (없으면 0)

레이아웃 주의: grid-cols-2는 Tailwind가 minmax(0,1fr) 트랙을 만들어 주므로, 사이드바를 펼쳐 화면이 좁아져도 카드 밖으로 넘치지 않고 라벨이 줄어들며 말줄임 처리된다. 고정폭을 쓰면 저해상도에서 넘친다(KNOWN_PITFALLS.md 4.2).

### 5.2 ② 목표/현재 탄소배출량 (2칸)
카드 하나를 좌우 2분할(grid grid-cols-2)하고, 각 절반 안에서 세로·가로 모두 중앙 정렬한다. 오른쪽 절반에는 좌측 보더(border-l pl-2).


| 위치 | 라벨 | 아이콘 색 | 값 | 값 색 |
| --- | --- | --- | --- | --- |
| 좌 | 목표 탄소배출량 | slate-400 | {n}t/일 | slate-900 |
| 우 | 현재 탄소배출량 | green-500 | {n}t/일 | green-600 |


현재 = Σ(함대 게이지 각 행의 co2TonPerDay)
목표 = 현재 × 1.2145        # CARBON_BENCHMARK_MULTIPLIER

값은 formatNumber(n, 1)(천단위 콤마 + 소수 1자리), 라벨 11px, 값 16px bold.

"목표"가 "현재"보다 큰 것이 정상이다 — 에코스피드를 적용하지 않았을 때의 예상 배출량이므로, 현재가 목표보다 낮아야 잘하고 있는 것이다.

### 5.3 ③ CII 등급 (1칸)
세로 중앙 정렬. 상단에 Award 아이콘 + 라벨 "CII 등급"(10px 회색). 그 아래 등급 문자(30px extrabold, 등급색) 와 점수(14px semibold 회색) 를 baseline 정렬로 나란히.

평균 점수 = 활성 항차들의 MOCK_CII_SCORE_BY_VOYAGE 값 평균 (없는 항차는 4.5로 간주)
활성 항차가 0건이면 4.5
등급 = ciiGradeFromScore(평균 점수)          # 3.6장

점수는 toFixed(2).

### 5.4 ④ 이번 항차 에코 랭킹 (1칸)
상단에 Trophy 아이콘 + 라벨 "이번 항차 에코 랭킹"(10px 회색). 그 아래 버튼 3개(10px), 각 줄: 메달 이모지 + 선박명(truncate) + -{n}%(green-600, semibold).

메달: 1위 🥇 / 2위 🥈 / 3위 🥉
정렬: co2SavedPct 내림차순, 상위 3개만
선박명은 vesselId로 조회, 못 찾으면 id를 그대로 표시
hover 시 연회색 배경. 클릭 시 탄소 배출 화면으로 딥링크(10.3장) — title="탄소 배출 대시보드에서 조회"

샘플 데이터 기준 표시는 🥇 KSF ASPIRE -24.3% / 🥈 KSF HORIZON -21.1% / 🥉 KSF PIONEER -17.7%.

### 5.5 ⑤ 이번 주 일정 (2칸)
월간 캘린더를 주 단위로 압축한 카드.

상단 행: 좌측에 CalendarRange 아이콘 + "이번 주 일정"(10px 회색). 우측에 ChevronLeft — 기간 라벨 — ChevronRight(각 16px 버튼). 기간 라벨 형식: 8.03 - 8.09(9px 회색, M.DD - M.DD). 좌우 버튼은 커서를 ±7일 이동시킨다.
7열 그리드(gap-0.5), 각 칸은 버튼이며 세로로 3단:
요일(9px 회색) — ['일','월','화','수','목','금','토'], 일요일 시작 고정
날짜(12px). 오늘이면 20×20px 인디고 원형 배경 + 흰 글씨 + bold
이벤트 점 — 높이 4px 영역에 4px 원을 가로로 나열
이벤트 점 규칙: 항차 1건당 etd(출항)·rta(입항) 각 1개. 최대 4개까지만 표시하고 나머지는 버리며, "+N" 표기는 하지 않는다(카드가 매우 작기 때문). 색은 항차 상태색(13장 마커 팔레트).
툴팁(title): 그날 이벤트를 줄바꿈으로 나열 — 출항 · KSF PIONEER 형식. 없으면 툴팁 없음.
날짜 클릭 시 물류 일정 화면으로 딥링크(10.2장).
자사 선박·항차만 대상으로 한다.



## 6. 함대 게이지 카드
활성 항차가 1건 이상일 때만 렌더링한다. 컨테이너 px-6 py-2, 흰 배경, 하단 보더.

### 6.1 게이지 데이터 계산
활성 항차마다 한 행을 만든다. 선박 또는 AIS 위치가 없으면 그 행은 생략한다.

각 행:
  maxFuel      = max(vessel.fuelCurve의 fuelTonPerDay)
  currentFuel  = interpolateFuelTonPerDay(vessel.fuelCurve, position.speedKnots)
  plannedFuel  = interpolateFuelTonPerDay(vessel.fuelCurve, voyage.plannedSpeedKnots)
  emissionFac  = fuelEmissionFactor(voyage.fuelType)      # HFO 3.114 / MGO 3.206 / LNG 2.750

  fuelTonPerDay       = currentFuel
  fuelCapacityPercent = maxFuel > 0 ? min(100, currentFuel/maxFuel*100) : 0
  co2TonPerDay        = currentFuel × emissionFac
  fuelSavingPercent   = plannedFuel > 0
                          ? clamp((plannedFuel - currentFuel)/plannedFuel*100, 0, 100)
                          : 0

전체 행이 만들어진 뒤 2차 패스:
  maxCo2           = max(모든 행의 co2TonPerDay, 최소 1)
  co2FleetPercent  = min(100, co2TonPerDay / maxCo2 × 100)

co2FleetPercent는 절대량이 아니라 "선단 내 최고 배출량 대비 비율" 이다. 그래서 항상 한 척은 100%가 된다 — 버그가 아니라 상대 비교용 지표다.

### 6.2 헤더 행
좌측 토글 버튼: Fuel 아이콘 + "운항 중 선박 연료·탄소 현황"(12px semibold 회색) + ChevronDown(접힘 상태에서는 -rotate-90). 클릭 시 카드 목록 펼침/접힘.
기본값은 접힘(fold) 이다.
우측(펼쳐졌을 때만 표시): 전체 선택(인디고) — | — 전체 해제(회색) — {n}/{total}개 지도 표시 중(회색).

### 6.3 선박 카드 (가로 스크롤)
펼침 시 flex gap-2 overflow-x-auto로 카드를 가로 나열. 각 카드 폭 320px 고정(w-80 shrink-0), rounded-lg border px-3 py-1.

선택 상태(해당 항차가 지도에 표시 중): 인디고 테두리 + 밝은 배경
비선택: 회색 테두리 + opacity-50 (hover 시 opacity-80)
카드 전체가 클릭 가능(role="button" tabIndex={0}) — 클릭 시 지도 표시 토글. Enter/Space 키도 동일하게 동작해야 한다(preventDefault 필수).

상단 행

선박명(14px semibold, truncate)
상태 배지(VoyageBadge, 아주 작게 — px-1.5 py-0 text-[9px])
LocateFixed 아이콘 버튼 — title="현재 위치로 이동". 지도를 그 선박 위치로 줌 8로 이동.
(우측) Knot 버튼 — Gauge 아이콘 + "Knot". 제안속도 전송(6.4장). 전송 중에는 Loader2 회전 + 비활성.
(우측) AI 버튼 — BrainCircuit 아이콘 + "AI". AI 리포트로 딥링크(10.1장).

두 번째 줄에 항로: {출발코드} → {도착코드}(9px 회색). 코드를 못 구하면 항구명 첫 토큰으로 폴백.

중첩 클릭 주의: 3·4·5번 버튼은 모두 카드 전체의 클릭 핸들러 안에 있으므로 반드시 e.stopPropagation() 을 호출해야 한다. 없으면 버튼을 눌렀는데 지도 표시가 토글된다.

하단 행 — 좌측에 가로 게이지 3개, 우측에 수치 3줄(폭 112px, 좌측 보더).


| 게이지 | 아이콘 | 라벨 | 값 표기 | percent | 색 |
| --- | --- | --- | --- | --- | --- |
| 1 | Fuel | 연료 소모 | {n}t/일 | fuelCapacityPercent | bg-[#6366f1] |
| 2 | Leaf | 탄소 배출 | {n}t/일 | co2FleetPercent | bg-orange-500 |
| 3 | TrendingDown | 연료 절감 | {n}% | fuelSavingPercent | bg-green-500 |



| 수치 | 라벨 | 값 |
| --- | --- | --- |
| 1 | 현재 속도 | {n}kt(소수 1자리) |
| 2 | ETA | MM/DD HH:mm (formatShortDateTime) |
| 3 | 권장 속도 | {n}kt (green-600) |


가로 게이지 컴포넌트 명세: 한 줄에 아이콘(12px) + 라벨(11px 회색, 폭 44px, truncate) + 트랙(flex-1, 높이 6px, 완전 둥근, 회색 배경) + 값(11px semibold, 폭 48px, 우측정렬, tabular-nums). 채움 바는 absolute inset-y-0 left-0에 width: {percent}%, transition-all duration-500. percent는 0~100으로 clamp한다.

### 6.4 제안속도 전송
Knot 버튼과 지도 팝업의 버튼이 같은 API를 호출한다.

POST /api/vessel-commands/speed-recommendation
body: { vesselId, vesselName, imo, voyageId, departurePort, arrivalPort,
        currentSpeedKnots, recommendedSpeedKnots, plannedSpeedKnots, eta }
res : { success: true, targetUrl, sentAt }

서버는 실제 외부 전송을 하지 않는다 — 900~1400ms의 인위적 지연 후 성공 응답을 돌려주는 데모용 시뮬레이션이다. targetUrl은 placeholder 문자열.
성공 시 window.alert로 아래 형식의 요약을 띄운다.

✅ 제안속도 전송 완료

선박: KSF PIONEER (IMO 9876543)
항로: 부산 (Busan) → 로테르담 (Rotterdam)
현재 속도: 13.5 kts
제안 속도: 13.5 kts
ETA: 2026. 8. 1. 오후 11:30:00
전송 시각: (응답의 sentAt)
전송처: (응답의 targetUrl)

실패 시 ❌ 제안속도 전송 실패.
전송 중인 선박 id를 Set으로 관리해 버튼별로 개별 로딩을 표시한다.



## 7. 필터 바
컨테이너 px-6 py-2.5 flex items-center gap-2, 흰 배경, 하단 보더.

### 7.1 빠른 필터 5종
좌측에 MapPin 아이콘 + "도착지 필터"(12px semibold 회색) 라벨을 두고, 그 뒤에 알약 버튼 5개. 모두 px-2.5 py-1 rounded-full text-xs font-medium border.


| 순서 | key | 라벨 | 아이콘 | 켜짐 색 | 꺼짐 색 |
| --- | --- | --- | --- | --- | --- |
| 1 | my | My | Sailboat | rose-500 배경 + 흰 글씨 | rose-50 배경 + rose-300 테두리 + rose-600 글씨 |
| 2 | weather | 기상 | CloudRain | 인디고 배경 + 흰 글씨 | 흰 배경 + 회색 테두리 |
| 3 | vessels | 선박 | Ship | 〃 | 〃 |
| 4 | issues | 이슈 | AlertTriangle | 〃 | 〃 |
| 5 | ports | 항구 | Anchor | 〃 | 〃 |


My만 색 계열이 다르다(rose). 자사 선단 강조라는 성격이 나머지와 달라, 꺼져 있을 때도 눈에 띄도록 의도적으로 구분한 것이다.

title 속성: 자사 선박만 지도에 표시 / 해상 기상 + 강수 레이더 지도에 표시 / 선박 마커 지도에 표시 / 지역 이슈 지도에 표시 (항구와 동시 선택 불가) / 항구 지도에 표시 (이슈와 동시 선택 불가)

그 뒤에 세로 구분선(w-px h-4).

### 7.2 필터 토글 로직
toggleQuickFilter(key):
  wasActive = activeFilters.has(key)          # ★ 업데이터 바깥에서 먼저 읽는다

  setActiveFilters(prev => {
    next = new Set(prev)
    if (wasActive) next.delete(key)
    else {
      next.add(key)
      if (key === 'issues') next.delete('ports')    # 이슈·항구 상호 배타
      if (key === 'ports')  next.delete('issues')
    }
    return next
  })

  if (key === 'my') {
    if (!wasActive) setSelectedVoyageIds(모든 활성 항차 id)   # 켤 때만 전체 선택
    setGaugesOpen(v => !v)                                    # 누를 때마다 게이지 접힘 반전
  }
  resetMapView()                                              # 항상 기본 시야로 복귀

이 구조를 그대로 지킬 것. wasActive를 업데이터 내부에서 계산하면서 다른 setter를 함께 호출하면, 업데이터가 재실행될 때 부수효과가 중복되어 "필터가 간헐적으로 안 먹는" 버그가 난다. 원본에서 이걸로 3라운드를 소모했다 (KNOWN_PITFALLS.md 1.3).

### 7.3 필터 → 지도 레이어 매핑
layersForFilters(filters):
  none      = filters.size === 0
  showW     = none || filters.has('weather')
  showI     = none || filters.has('issues')
  showP     = none || filters.has('ports')
  return { weather: showW, radar: showW,          # 기상 하나로 통합
           typhoon: showI, issues: showI, dangerZones: showI,   # 이슈 하나로 통합
           ports: showP }

showVessels = filters.size === 0 || filters.has('vessels') || filters.has('my')

개별 레이어 on/off 스위치는 없다. 태풍·위험구역은 "이슈"에, 강수 레이더는 "기상"에 편입되어 있다. My를 켜면 "선박"을 따로 켜지 않아도 선박이 보인다.

### 7.4 도착지 필터 (가로 스크롤)
showVessels === false면 이 영역 대신 안내 문구를 띄운다(이탤릭 회색 12px):

{선택된 필터 라벨들을 " · "로 연결} 보기 중에는 도착지 필터를 사용할 수 없습니다

showVessels === true면 가로 스크롤 목록을 렌더링한다.

목록 구성: 맨 앞에 전체 ({총 척수}), 그 뒤에 도착 항구별 {코드} · {한글명} ({건수}). 건수 내림차순 정렬.
집계 대상: My가 켜져 있으면 자사 활성 항차만, 아니면 자사 활성 + 타사 전체.
선택 시 인디고 배경 + 흰 글씨, 아니면 회색 배경. 같은 항목을 다시 누르면 해제.
스크롤바는 숨긴다([scrollbar-width:none], [&::-webkit-scrollbar]:hidden).
좌우 화살표 버튼: 스크롤 가능할 때만 나타난다.
판정: canScrollLeft = scrollLeft > 4, canScrollRight = scrollLeft + clientWidth < scrollWidth - 4
scroll 이벤트와 window.resize에 리스너를 걸어 갱신(스크롤은 { passive: true })
버튼은 24×24px 원형, 절대 위치(left-0/right-0, 세로 중앙), 흰 배경 + 그림자
버튼 옆에 그라디언트 페이드(폭 32px, pointer-events-none)를 깔아 잘린 느낌을 부드럽게 한다
화살표가 보이면 목록에 pl-7/pr-7 패딩을 더해 첫/마지막 항목이 가리지 않게 한다
클릭 시 scrollBy({ left: ±240, behavior: 'smooth' })

### 7.5 우측 요약 문구
ml-auto로 우측 끝에 12px 회색:

{n}척 · 기상 · 이슈 · 항구 표시 중

각 항목은 해당 조건일 때만 포함되며 " · "로 연결한다({n}척은 showVessels일 때만).

### 7.6 지도에 표시할 항차 확정
DESTINATIONS = 도착지 목록
effectiveDestinationFilter = 선택된 코드가 현재 목록에 있으면 그 값, 없으면 null
   # ★ "My"를 켜서 선택한 도착지가 목록에서 사라져도 상태를 초기화하지 않는다.
   #   그 시점부터 "유효하지 않은 선택"으로 취급해 자연히 전체 보기로 대체된다.

ownVisibleIds   = 도착지 필터가 있으면
                    (체크된 항차 ∩ 도착지 일치)
                  아니면 체크된 항차 전부
otherVisibleIds = My가 켜져 있으면 []                    # 타사는 전부 숨김
                  아니면 (도착지 필터 없거나 일치하는 타사 항차)

final = ownVisibleIds ∪ otherVisibleIds
지도에 넘기는 값 = showVessels ? final : 빈 Set

selectedVoyageIds 상태 자체는 필터가 바뀌어도 건드리지 않는다. 그래서 필터를 모두 해제하면 이전 선박 선택이 그대로 복원된다.



## 8. 이슈·항구 리스트 패널과 요약 팝업
"이슈" 또는 "항구" 필터가 켜져 있을 때만 컨테이너 전체를 렌더링한다(꺼져 있으면 빈 공백을 남기지 않는다). 둘 다 켜질 수는 없지만, 구조상 각각 독립적으로 렌더링된다.

### 8.1 지역 이슈 리스트
헤더: AlertTriangle + 지역 이슈 ({이슈 수 + 위험구역 수}건)(12px semibold 회색) + "요약" 버튼(Sparkles 아이콘, 10px, 알약형 아웃라인).
목록: flex flex-wrap gap-2 max-h-28 overflow-y-auto — 즉 최대 높이 112px, 넘치면 세로 스크롤.
이슈 항목 버튼: 유형 색 점(8px) + 제목(12px) + 유형 라벨(10px 회색) + 심각도 배지(RiskBadge). title은 {description} (클릭 시 지도에서 위치로 이동 후 상세 정보 표시). 클릭 → 지도를 그 좌표로 줌 6으로 이동 + 해당 마커 팝업 자동 오픈.
위험구역 항목도 같은 목록에 이어서 렌더링: zone.color 점 + label + "위험구역"(10px 회색). title은 {label} (클릭 시 지도에서 위치로 이동, 반경 {radiusKm}km). 클릭 → 줌 6 이동 (팝업 오픈은 없음).

유형 라벨·색


| type | 라벨 | 색 |
| --- | --- | --- |
| piracy | 해적 | #ef4444 |
| port_congestion | 항만 혼잡 | #f59e0b |
| geopolitical | 지정학적 리스크 | #8b5cf6 |
| canal_control | 운하 통제 | #6366f1 |


### 8.2 항구 현황 리스트
헤더: Anchor + 항구 현황 ({집계된 항구 수}곳) + "요약" 버튼.
항목 버튼: {항구 한글명} ({코드})(12px) + 정박 {n} · 출항 {n} · 입항예정 {n}(10px 회색). 클릭 → 지도를 항구 좌표로 줌 9로 이동 + 팝업 자동 오픈.
집계 로직은 9.6장의 aggregateByPort를 그대로 재사용한다(지도와 숫자가 반드시 일치해야 한다).

### 8.3 요약 팝업
"요약" 버튼을 누르면 모달이 뜬다. 오버레이 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm, 패널 max-w-sm rounded-xl p-5. 오버레이 클릭 시 닫히고, 패널 내부 클릭은 stopPropagation.

헤더: Sparkles(인디고) + 제목("지역 이슈 요약" 또는 "항구 현황 요약") + X 닫기 버튼.

이슈 요약 본문(12px)

현재 지도에 총 **{n}건**의 지역 이슈가 표시되고 있습니다.
심각도별 — RiskBadge 3종을 가로로 나열하고 각 뒤에 {n}건
유형별 — 유형마다 한 줄: 색 점 + 라벨 + (우측) {n}건
high 이슈가 있으면 "⚠ 심각도 높음 — 우선 확인 필요"(red-600 semibold) + 제목 불릿 목록

항구 요약 본문

현재 **{n}개** 항구에 선박이 집계되고 있습니다.
3칸 그리드(회색 박스): 정박 / 출항 / 입항예정 각각 큰 숫자(18px bold) + 라벨
가장 붐비는 항구: **{항구명} ({코드})** — 총 {n}척 (합계 최댓값 기준)



## 9. 지도 (MapView)
먼저 KNOWN_PITFALLS.md 2장을 읽을 것. 이 장의 설계 결정 대부분이 그 9건의 함정에서 나왔다.

### 9.1 로딩 방식
반드시 SSR을 끄고 동적 import 한다. Leaflet은 window에 의존한다.

const MapView = dynamic(() => import('@/features/dashboard/MapView'), { ssr: false })

컴포넌트는 Leaflet CSS를 <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">로 직접 로드하고, <div ref={containerRef} className="w-full h-full" /> 하나만 렌더링한다. 지도 생성은 전부 useEffect 안에서 명령형으로 수행한다(react-leaflet 컴포넌트를 쓰지 않는다).

Leaflet 모듈 자체도 effect 안에서 await import('leaflet')로 로드하며, StrictMode 이중 실행을 막기 위해 active 플래그를 둔다.

### 9.2 이음매(seam)와 좌표 랩핑
이 지도의 가장 특이한 설계다.

SEAM_LNG = -30        # 북대서양 한가운데에서 지도를 끊는다
MAX_LAT  = 85.0511287798
WORLD_BOUNDS = [[-MAX_LAT, SEAM_LNG], [MAX_LAT, SEAM_LNG + 360]]

wrapLng(lng) = lng < SEAM_LNG ? lng + 360 : lng      # 모든 단일 마커 좌표에 적용

왜 -30°인가: 지도 좌측 끝이 유럽/아프리카가 되어 좌→우로 유럽·아프리카 → 아시아 → 태평양 → 미주 순으로 이어진다. 이음매는 유럽(포르투갈 -9.5°)·아프리카(세네갈 -17.5°)보다 서쪽이면서 미주 동안(뉴욕 -74°, 서배너 -81°)보다는 동쪽인, 항구·항로가 없는 대서양 한복판이어야 한다.

왜 ±85.0511인가: Web Mercator는 위도 ±90°에서 발산한다. ±90을 쓰면 최소 줌 계산이 깨져 지도가 잘려 보인다(KNOWN_PITFALLS.md 2.3).

항로 폴리라인은 wrapLng를 쓰면 안 된다. 점마다 독립적으로 랩핑하면 이음매를 가로지르는 항로가 지도 폭 전체를 가로지르는 직선으로 끊겨 보인다. 아래 알고리즘으로 여러 선분으로 분할한다.

wrapRouteSegments(waypoints) -> [number,number][][]
  copyIndex(lng) = floor((lng - SEAM_LNG) / 360)

  # ① 인접 점 간 점프가 180°를 넘지 않도록 연속화(unwrap)
  contLngs[0] = waypoints[0].lng
  for i in 1..n-1:
    lng = waypoints[i].lng
    while (lng - contLngs[i-1] >  180) lng -= 360
    while (lng - contLngs[i-1] < -180) lng += 360
    contLngs[i] = lng

  # ② 표시 구간 경계를 넘는 지점에서 위도를 보간해 선을 끊는다
  각 구간에 대해 copyIndex가 바뀔 때마다:
      boundary = SEAM_LNG + (증가방향 ? k+1 : k) × 360
      t        = (boundary - prevLng) / (lng - prevLng)
      crossLat = prevLat + (lat - prevLat) × t
      현재 선분에 [crossLat, boundary - k×360] 추가 후 선분 종료
      새 선분을 [crossLat, boundary - k'×360]에서 시작

  점이 2개 미만인 선분은 버린다

이 알고리즘 덕분에 항로가 지도 좌우 끝을 넘나드는 두 개의 선분으로 자연스럽게 이어지고, 어느 구간도 화면 밖으로 사라지지 않는다.

### 9.3 지도 초기화 옵션
center: [20, 100],  zoom: 3,  zoomControl: true
maxZoom: 15                    # 해상 스케일용 — 고줌 타일 오류 여지를 원천 차단
worldCopyJump: false           # 세계지도 반복 금지
maxBoundsViscosity: 1.0
zoomAnimationThreshold: 20     # 기본 4로는 큰 줌 델타가 애니메이션 없이 순간 이동해버림

map.setMaxBounds(WORLD_BOUNDS)   # 지구 1개 범위 밖으로 패닝 불가

noWrap을 주지 않는다. 이음매를 표준 180°가 아닌 곳으로 옮기려면 타일 x인덱스가 랩핑되어야 한다. 중복 방지는 maxBounds + 최소 줌으로만 처리한다.

최소 줌 계산 — 가로 폭 기준으로만 계산한다.

applyMinZoom():
  width = 컨테이너 clientWidth
  if (width <= 0) return
  minZoom = ceil(log2(width / 256))
  map.setMinZoom(minZoom)
  if (map.getZoom() < minZoom) map.setZoom(minZoom)

호출 시점: 초기화 직후 + requestAnimationFrame 안 + window resize
(rAF와 resize에서는 map.invalidateSize()도 함께 호출)

세로(위도)까지 함께 맞추면 안 된다. 세계지도가 반복되는 건 가로 방향뿐이며, getBoundsZoom 같은 방식으로 세로까지 맞추면 화면 비율에 따라 과도한 최소 줌이 잡혀 좌우가 잘린다. 컨테이너가 레이아웃 확정 전이라 폭이 0일 수 있으므로 rAF에서 재계산하는 것이 핵심이다.

### 9.4 타일 레이어

| 레이어 | URL | 옵션 |
| --- | --- | --- |
| 기본 지도 | https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png | maxZoom: 18, maxNativeZoom: 17, errorTileUrl |
| 위성 | https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x} | 위와 동일(URL만 교체) |
| 해도(OpenSeaMap) | https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png | opacity: 0.7, maxZoom: 12, errorTileUrl |
| 강수 레이더(RainViewer) | 11.3장 | opacity: 0.45, maxZoom: 10, errorTileUrl |


errorTileUrl은 1×1 투명 PNG data URI를 쓴다: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=
타일 레이어에 bounds 옵션을 주면 안 된다 — 이음매를 옮겼기 때문에 랩핑된 타일 좌표가 표준 -180~180으로 재정규화되어 태평양 부근이 회색으로 빠진다 (KNOWN_PITFALLS.md 2.4).
해도·레이더의 maxZoom이 낮은 이유는 오류를 200 응답 이미지로 반환하기 때문이다 (KNOWN_PITFALLS.md 2.5).

지도 유형 전환: 위성/표준은 레이어를 추가·제거하지 않고 기본 타일의 setUrl()만 교체한다.

### 9.5 레이어 그룹과 pane
초기화 시 LayerGroup 3개를 만들어 용도를 분리한다.


| 그룹 | 내용 | 갱신 트리거 |
| --- | --- | --- |
| voyageLayer | 항로 폴리라인 + 선박 마커 | 선택 항차·항로·언어 변경 |
| portLayer | 항구 마커 | 항차·선박·layers.ports·언어 변경 |
| overlayLayer | 위험구역·태풍·이슈·기상 | 오버레이 데이터·layers·언어 변경 |


각 effect는 시작 시 clearLayers()로 전부 비우고 다시 그린다.

커스텀 pane: 기상 카드를 선박 마커 아래에 두기 위해 weatherPane을 만든다.

weatherPane.style.zIndex = '400'          # markerPane(600)보다 아래
weatherPane.style.pointerEvents = 'none'  # 마커 클릭 이벤트 투과

### 9.6 항구 레이어
선박 필터·선택과 무관하게 항상 전체 항차를 기준으로 집계한다.

aggregateByPort(voyages, vessels) -> Map<항구코드, { berthed, departing, arriving }>
  각 항차에 대해 (status === 'cancelled'면 건너뜀, 선박 못 찾으면 건너뜀):
    depCode = getPortCode(departurePort)
    arrCode = getPortCode(arrivalPort)

    depCode 있으면:
      status === 'preparing'              → depCode의 berthed에 추가
      status === 'underway' | 'delayed'   → depCode의 departing에 추가
    arrCode 있으면:
      status === 'completed'              → arrCode의 berthed에 추가
      status === 'underway' | 'delayed'   → arrCode의 arriving에 추가

마커: 30×30px 하늘색(#0ea5e9) 라운드 사각형(border-radius: 8px), 흰 2.5px 테두리, 가운데 ⚓ 이모지. 관련 선박이 1척 이상이면 우상단에 빨간 원형 배지로 총 척수를 표시한다.

팝업(폭 220~260px, 최대 높이 240px 스크롤):

제목: {한글명} ({영문명})(14px bold) + 그 아래 항구 코드(10px 회색)
섹션 3개(항목이 있을 때만 렌더링): 정박(초록 #16a34a) / 출항(호박 #f59e0b) / 입항 예정(인디고 #6366f1). 각 제목은 {라벨} ({n}).
각 선박 행: 좌측에 선박명(12px semibold), 우측에 자사면 "자사 선박"(인디고), 타사면 회사명(회색). 그 아래 상세(10px 회색):
정박 & preparing → 출항 예정: {etd 로케일 문자열}
정박 & 그 외 → ETA: {eta}
출항 → 목적지: {도착항 첫 토큰} · ETA {eta 날짜}
입항 예정 → 출발: {출발항 첫 토큰} · ETA {eta}
아무 선박도 없으면 이 항구에 등록된 선박이 없습니다 류의 안내 문구.

마커는 Map<코드, Marker>에 보관해 리스트 클릭 시 팝업을 열 수 있게 한다.

### 9.7 항차 레이어 (항로 + 선박 마커)
selectedVoyageIds가 비어 있으면 아무것도 그리지 않는다.

① 계획 항로 — wrapRouteSegments(displayRoute)로 그린 폴리라인. color: 상태색, weight: 2, dashArray: '8,6', opacity: 0.6 (displayRoute = 사전 계산 항로가 있으면 그것, 없으면 voyage.plannedRoute)

② 실제 항적 — 계획 항로를 현재 AIS 위치에서 가장 가까운 점까지 잘라서 그린다.

closestIdx = displayRoute 중 hypot(점.lat - pos.lat, 점.lng - pos.lng)가 최소인 인덱스
actualRoute = displayRoute.slice(0, closestIdx + 1)

weight: 2.5, opacity: 0.85(실선). 위치가 없으면 voyage.actualRoute를 그대로 쓴다.

단순 직선 보간을 쓰면 항적이 대륙을 통과한다 (KNOWN_PITFALLS.md 2.9).

③ 선박 마커 — 선체 실루엣 SVG를 divIcon으로 그린다. 기상·이슈의 원형 배지와 형태로 구분한다.

크기: 자사 34px / 타사 28px
회전: transform: rotate({position.cogDegrees}deg)     # 침로 방향
그림자: filter: drop-shadow(0 2px 3px rgba(15,23,42,0.4))
경로: <path d="M12 1.5 L17 9 L15 21.5 L9 21.5 L7 9 Z" />   (viewBox 0 0 24 24)
  fill        = 상태색
  fill-opacity= 자사 1 / 타사 0.4
  stroke      = 자사 white / 타사 상태색
  stroke-width= 자사 2 / 타사 1.5
중앙에 <circle cx=12 cy=9.5 r=1.6 fill=white opacity=자사 0.9 / 타사 0.7 />
iconSize: [size, size], iconAnchor: [size/2, size/2]

자사/타사는 점선이 아니라 "채움 진하기"로 구분한다. 점선은 태풍·위험구역의 반경 표현에 이미 쓰이고 있어 의미가 충돌한다.

팝업(폭 200px 이상): 선박명(14px semibold) → 회사명(11px, 자사는 인디고로 "자사 선박") → 표 4행(항차 출발→도착 / 현재 속도 {n} kts / ETA 날짜 / 상태 상태색 배지) → 자사 선박이면 맨 아래에 "제안속도 전송" 버튼(인디고 풀폭).

### 9.8 오버레이 레이어
① 위험구역 — L.circle, 반경 radiusKm × 1000, 색은 zone.color, fillOpacity: 0.08, weight: 2, dashArray: '8,4'. bindTooltip으로 라벨을 sticky 표시.

② 태풍 — 반경 원 + 마커.

원: fillOpacity: 0.07, weight: 2, dashArray: '10,5'
마커 36×36px: 3중 동심원(가장 바깥 opacity 0.25 → inset:5px, opacity 0.45 → inset:10px 불투명 + 흰 2px 테두리) 안에 강도별 아이콘.
강도별 색: TD #94a3b8 / TS #f59e0b / TY #ef4444 / STY #7c3aed
깜빡임 애니메이션(map-marker-alert)을 적용한다. 반드시 html 내부의 자식 div에 붙인다 — className 옵션은 Leaflet이 위치 이동(translate3d)에 쓰는 래퍼에 적용되어 마커가 엉뚱한 위치로 튄다(KNOWN_PITFALLS.md 2.6).
팝업: 🌀 {이름}(강도색 bold) + 표 4행(강도 / 최대 풍속 / 반경 / 이동 방향·속도).

③ 지역 이슈 — 36×36px 원형 배지(유형색 배경, 흰 2.5px 테두리) 안에 유형별 흰색 SVG 아이콘. 태풍과 동일하게 깜빡임 클래스는 자식 div에. 마커는 Map<id, Marker>에 보관.

팝업: {심각도 이모지} {제목}(13px bold) + 설명(11px) + 출처: {source}(10px 회색). 심각도 이모지는 high 🔴 / medium 🟡 / low 🟢.

④ 기상 카드 — weatherPane에 배치하는 카드형 마커.

iconSize: [0, 0], iconAnchor: [0, 0]
+ 내부 div에 transform: translate(-50%, -50%)      # ★ 클리핑 방지 정석 패턴
배경: rgba(248,250,252,0.48) + backdrop-filter: blur(6px)
테두리: 1px rgba(203,213,225,0.35), border-radius 8px, padding 5px 9px, min-width 72px

내용 3줄: ① 풍향 화살표 SVG(rotate({windDir}deg)) + 풍속(12px bold, 풍속별 색) ② 파고 {n}m(10px) ③ 지점명(8px 회색).

풍속별 색: ≥15 → #ef4444, ≥10 → #f59e0b, 그 외 #6366f1.

iconSize를 지정하지 않으면 Leaflet이 0×0 컨테이너를 만들어 하단 텍스트를 잘라낸다 (KNOWN_PITFALLS.md 2.1).

### 9.9 지도 이동(focus) 처리
외부(리스트·게이지 카드)에서 지도를 특정 위치로 이동시키는 인터페이스.

interface MapFocusTarget {
  lat: number; lng: number; zoom: number
  token: number                                  // 매 클릭마다 증가 — 같은 좌표 재클릭도 반응
  marker?: { kind: 'issue' | 'port'; id: string } // 이동 후 이 마커 팝업을 자동으로 연다
  direct?: boolean                                // true면 setView, false면 flyTo
}

effect(deps: [mapReady, focusTarget?.token]):     # ★ token만 의존 — 좌표가 같아도 재실행
  if (focusTarget.direct)
    map.setView([lat, wrapLng(lng)], zoom, { animate: true })
  else
    map.flyTo([lat, wrapLng(lng)], zoom, { duration: 0.8 })

  if (focusTarget.marker)
    map.once('moveend', () => 해당 마커.openPopup())

direct가 필요한 이유: flyTo의 곡선 궤적은 줌 델타가 클 때 "제자리 줌아웃 → 이동"의 두 동작으로 보인다. 필터 리셋처럼 델타가 큰 이동만 setView 로 처리한다 (KNOWN_PITFALLS.md 2.7).

호출 지점 정리


| 호출자 | 줌 | direct | 팝업 |
| --- | --- | --- | --- |
| 빠른 필터 토글(리셋) | 3 (중심 [20, 100]) | ✅ | — |
| 이슈 리스트 항목 | 6 | — | ✅ |
| 위험구역 리스트 항목 | 6 | — | — |
| 항구 리스트 항목 | 9 | — | ✅ |
| 게이지 카드 LocateFixed | 8 | — | — |


팝업을 닫는 로직은 필요 없다. Leaflet 팝업은 autoClose/closeOnClick 기본값이 true라 다른 마커를 열거나 빈 곳을 클릭하면 자동으로 닫힌다.

### 9.10 지도 위 오버레이 UI
지도 컨테이너에 relative를 주고 그 위에 절대 위치로 3개를 얹는다(모두 z-10).

① 언어 선택기(상단 중앙, top-3 left-1/2 -translate-x-1/2)

반투명 흰 배경(bg-white/95 backdrop-blur) + 테두리 + 그림자, 알약 버튼 4개.


| 값 | 라벨 | title |
| --- | --- | --- |
| ko | 한국어 | 지도 위 정보 표시 언어: 한국어 |
| en | English | Map info display language: English |
| zh | 中文 | 地图信息显示语言：中文 |
| ja | 日本語 | 地図上の情報表示言語：日本語 |


지도 타일 자체는 바뀌지 않는다. 이 선택은 팝업·툴팁 등 우리가 그리는 정보의 표시 언어만 바꾼다. 앱 전역 언어(사이드바·헤더)와는 별개다.

② 지도 유형(우상단 top-3 right-3): 기본 지도 / 위성(Satellite 아이콘) 세그먼트 2개.

③ 범례(좌하단 bottom-4 left-4): rounded-xl shadow-lg p-3, 12px.

컨테이너 전체가 클릭 가능 — 아무 곳이나 누르면 펼침/접힘.
헤더: "선박 상태" + 우측 ChevronDown(접힘 시 -rotate-90). 기본값은 접힘.
펼침 시 3개 섹션:
상태 색 4종 — 운항 중(#3b82f6) / 지연(#ef4444) / 준비 중(#94a3b8) / 완료(#22c55e)
(구분선) 마커 형태 — 자사 선박(꽉 찬 실루엣) / 타사 선박 (참고용)(옅은 실루엣) / 항구 (클릭 시 정박·출항·입항 정보)
(구분선) "오버레이" — 점선 색 3종: 해적/위협구역(#ef4444) / 충돌위험구역(#f59e0b) / 분쟁수역(#8b5cf6)

### 9.11 팝업 내 버튼 이벤트 위임
지도 팝업은 React 트리 밖의 raw HTML이므로 onClick을 붙일 수 없다. popupopen 이벤트로 위임한다.

map.on('popupopen', e => {
  btn = e.popup.getElement()?.querySelector('[data-send-speed-vessel-id]')
  if (!btn) return
  btn.onclick = async () => { ...전송... }      # 6.4장과 동일한 API
})

버튼 HTML에는 data-send-speed-vessel-id / data-send-speed-voyage-id 속성을 심어 대상을 식별한다. 전송 중에는 disabled + opacity 0.7 + 텍스트를 "전송 중..."으로 바꾸고, 끝나면 원래 HTML로 복원한다.



## 10. 외부 딥링크 연동 (선택)
세 가지 모두 sessionStorage 1회성 키 + router.push() 패턴이다. 대시보드만 단독 구현한다면 버튼을 두되 동작만 생략한다.


| # | 출발 | 키 | 값 | 목적지 |
| --- | --- | --- | --- | --- |
| 10.1 | 게이지 카드 AI 버튼 | ksf:ai-report-vessel-id | vesselId | /ai-report |
| 10.2 | 주간 캘린더 날짜 | ksf:schedule-calendar-date | 날짜 ISO | /schedule |
| 10.3 | 에코 랭킹 항목 | ksf:carbon-vessel-id | vesselId | /carbon |


받는 쪽은 마운트 시 1회 읽고 즉시 removeItem 한다 (SCHEDULE.md 8장에 수신 측 구현이 있다).



## 11. 외부 API 연동 (선택)
전부 생략 가능하다. 생략 시 기상은 3.5장 고정값, 태풍은 3.4장 mock을 그대로 쓰면 화면은 동일하게 완성된다.

### 11.1 해상 기상 (Open-Meteo)
API 키가 필요 없다 — 브라우저에서 직접 호출한다. 8지점을 병렬로 조회하되 Promise.allSettled로 일부 실패를 허용한다(성공한 지점만 표시).

GET https://api.open-meteo.com/v1/forecast
      ?latitude={lat}&longitude={lng}
      &current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms
GET https://marine-api.open-meteo.com/v1/marine
      ?latitude={lat}&longitude={lng}&current=wave_height

두 요청 모두 AbortSignal.timeout(8000)
결과: { windSpeed: current.wind_speed_10m ?? 0,
        windDir:   current.wind_direction_10m ?? 0,
        waveHeight: current.wave_height ?? 0 }

전부 실패하면 에러 플래그를 세우고 빈 배열을 반환한다. cleanup에서 cancelled 플래그를 세운다.

### 11.2 실시간 태풍 (GDACS)
CORS 때문에 서버 Route Handler를 경유한다.

서버 GET /api/typhoons:

GDACS RSS: https://www.gdacs.org/xml/rss.xml
  fetch 옵션: next: { revalidate: 900 }, timeout 10초, User-Agent 지정
  <item>…</item> 를 정규식으로 잘라 각각 파싱
  eventtype이 'TC'가 아니면 버림

  위치:  <georss:point>lat lng</georss:point> 우선, 없으면 <geo:lat>/<geo:long>
  이름:  <gdacs:eventname>,  id: <gdacs:eventid>  (없으면 'UNKNOWN' / 타임스탬프)
  풍속:  <gdacs:severity unit="km/h" value="111.1104">
           ★ 속성명은 units가 아니라 unit(단수), 값은 텍스트가 아니라 value 속성
           단위가 kph/km면 × 0.539957로 노트 변환

  강도: ≥100 STY / ≥64 TY / ≥34 TS / 그 외 TD
  반경: STY 400 / TY 300 / TS 200 / TD 120 (km)
  movingDir '—', movingSpeedKnots 0

  실패 시 빈 배열을 200으로 반환 (클라이언트가 mock으로 폴백)

unit vs units — 이 한 글자 때문에 태풍이 전혀 표시되지 않았다 (KNOWN_PITFALLS.md 6.1).

클라이언트: 12초 타임아웃으로 호출하고 15분마다 재조회한다. 성공 시 실시간 데이터 + mock을 병합([...data, ...MOCK_TYPHOONS])하고, 실패하면 mock만 쓴다.

왜 병합하는가: 실제 태풍이 동태평양 등 기본 뷰포트 밖에 있으면 화면에 아무것도 안 보인다. 서태평양 시나리오를 항상 함께 띄워 데모가 비지 않게 한다 (KNOWN_PITFALLS.md 6.2).

### 11.3 강수 레이더 (RainViewer)
1) GET https://api.rainviewer.com/public/weather-maps.json
2) data.radar.past 배열의 마지막 항목 path를 취해 타일 URL 구성
   https://tilecache.rainviewer.com{path}/256/{z}/{x}/{y}/6/1_1.png
3) opacity 0.45, maxZoom 10, errorTileUrl로 레이어 추가

layers.radar가 꺼지면 레이어를 제거한다. 실패는 조용히 무시한다.



## 12. 다국어 텍스트 전체 사전
t.dashboard.*


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 실시간 운항 대시보드 | Live Operations Dashboard |
| subtitle | 선박 위치 및 항로·해상 기상 현황 | Vessel positions, routes & weather overview |
| statVessels | 운항 중 선박 | Active Vessels |
| statDelayed | 지연 항차 | Delayed |
| statCompleted | 오늘 완료 | Completed Today |
| statFuelSaving | 평균 연료 절감 | Avg. Fuel Saved |
| statCo2Target | 목표 탄소배출량 | Target CO₂ Emissions |
| statCo2Current | 현재 탄소배출량 | Current CO₂ Emissions |
| statCiiGrade | CII 등급 | CII Grade |
| statEcoRanking | 이번 항차 에코 랭킹 | Voyage Eco Ranking |
| fleetGaugeTitle | 운항 중 선박 연료·탄소 현황 | Active Fleet Fuel & Carbon |
| gaugeFuelRate | 연료 소모 | Fuel Rate |
| gaugeFuelRateTooltip | 현재 속도 기준 일일 연료 소모량 (해당 선박 최대 소모량 대비 %) | Daily fuel consumption at current speed (% of this vessel's max rate) |
| gaugeCo2 | 탄소 배출 | CO₂ Emission |
| gaugeCo2Tooltip | 일일 CO₂ 배출량 (운항 중인 자사 선단 내 최고 배출량 대비 %) | Daily CO₂ emissions (% of the highest among currently active own-fleet vessels) |
| gaugeFuelSaving | 연료 절감 | Fuel Saved |
| gaugeFuelSavingTooltip | 계획 속도 대비 현재 속도의 연료 절감률 | Fuel savings at current speed vs. planned speed |
| perDay | /일 | /day |
| aiReportButton | AI 운항 리포트 보기 | View AI Voyage Report |
| selectAll | 전체 선택 | Select All |
| deselectAll | 전체 해제 | Deselect All |
| shownOnMap(n, total) | {n}/{total}개 지도 표시 중 | {n}/{total} shown on map |
| currentSpeed | 현재 속도 | Current Speed |
| recSpeed | 권장 속도 | Rec. Speed |
| vesselStatus | 선박 상태 | Vessel Status |
| overlay | 오버레이 | Overlay |
| standard | 기본 지도 | Standard |
| satellite | 위성 | Satellite |
| legendUnderway | 운항 중 | Underway |
| legendDelayed | 지연 | Delayed |
| legendPreparing | 준비 중 | Preparing |
| legendCompleted | 완료 | Completed |
| legendPiracy | 해적/위협구역 | Piracy/Threat |
| legendCollision | 충돌위험구역 | Collision Risk |
| legendDispute | 분쟁수역 | Disputed Waters |
| weatherLoading | 해상 기상 불러오는 중... | Loading weather data... |


필터 바·리스트 패널·요약 팝업의 문구는 다국어 사전을 거치지 않고 한국어로 하드코딩되어 있다 (도착지 필터, My, 기상, 선박, 이슈, 항구, 전체 ({n}척), 지역 이슈 ({n}건), 항구 현황 ({n}곳), 요약, 정박/출항/입항예정 등). 원본 그대로 재현하려면 하드코딩하고, 개선하려면 사전으로 빼도 무방하다.

지도 팝업 전용 사전(MAP_LABELS)은 앱 전역 언어와 별개로 ko/en/zh/ja 4개 언어를 가진다. 포함 키: ownFleet, voyage, currentSpeed, eta, status, statusLabel, intensity, typhoonIntensity, maxWind, radius, movingDir, windSpeed, windDir, waveHeight, marineWeather, source, vessel, recommendedSpeed, sendSpeedBtn, sendSpeedSending, sendSpeedSuccessTitle, sendSpeedFailTitle, route, sentAt, target, portBerthed, portDeparting, portArriving, portNoVessels, portEtd, portBoundFor, portFrom



## 13. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 — 선택된 필터·탭·게이지 1번·오늘 날짜·포커스 링. hover #4f46e5.

My 필터만 rose 계열(rose-500 켜짐 / rose-50+rose-300+rose-600 꺼짐).

항차 상태 마커 색(지도·캘린더·게이지 공통):


| status | 색 |
| --- | --- |
| underway | #3b82f6 |
| delayed | #ef4444 |
| preparing | #94a3b8 |
| completed | #22c55e |
| cancelled | #64748b |


태풍 강도색: TD #94a3b8 / TS #f59e0b / TY #ef4444 / STY #7c3aed

이슈 유형색: piracy #ef4444 / port_congestion #f59e0b / geopolitical #8b5cf6 / canal_control #6366f1

CII 등급색: A #16a34a / B #84cc16 / C #d97706 / D #ea580c / E #dc2626

항구 마커: 배경 #0ea5e9, 배지 #ef4444

게이지 바: 연료 #6366f1 / 탄소 orange-500 / 절감 green-500

카드: rounded-lg bg-white dark:bg-slate-800 border shadow-sm. 지도 위 오버레이만 bg-white/95 backdrop-blur + rounded-lg/rounded-xl.

타이포: 요약 카드 라벨 1011px / 값 1216px bold / CII 등급 문자 30px extrabold / 게이지 라벨 11px / 지도 팝업 제목 13~14px.

아이콘 세트: lucide-react — Ship, Sailboat, AlertTriangle, CheckCircle, TrendingDown, MapPin, Loader2, Satellite, CloudRain, ChevronLeft, ChevronRight, ChevronDown, Anchor, Fuel, Leaf, BrainCircuit, Gauge, Sparkles, X, LocateFixed, Award, Trophy, RefreshCw, CalendarRange



## 14. 엣지 케이스 및 불변식
빠른 필터의 부수효과는 반드시 업데이터 밖에서 처리한다(7.2장). 이걸 어기면 필터가 간헐적으로 동작하지 않는다.
My를 누를 때마다 함대 게이지가 접힘/펼침 반전된다. 켤 때만이 아니라 끌 때도 반전한다.
My를 켤 때만 자사 항차를 전체 선택한다(끌 때는 선택을 건드리지 않는다).
"이슈"와 "항구"는 상호 배타다. 하나를 켜면 다른 하나가 자동으로 꺼진다.
selectedVoyageIds는 필터 변경으로 초기화되지 않는다. 필터를 모두 해제하면 이전 선택이 그대로 복원되는 것이 정상이다.
선택된 도착지가 목록에서 사라져도 상태를 초기화하지 않는다. "유효하지 않은 선택"으로 취급해 전체 보기로 자연히 대체한다(7.6장).
카드 내부 버튼은 모두 stopPropagation 이 필요하다(6.3장). 지도 위 레이어 토글도 마찬가지다.
최초 진입 시 활성 항차를 전부 선택한다. 단 useRef 플래그로 1회만 실행해야 한다 — 그러지 않으면 사용자가 해제한 선택이 데이터 갱신 때마다 되살아난다.
함대 게이지·범례의 기본값은 모두 접힘(fold) 이다.
co2FleetPercent는 선단 내 상대값이라 항상 한 척이 100%다(버그 아님).
타사 선박은 통계에 절대 포함하지 않는다. 지도 표시 대상일 뿐이다.
지도 마커 좌표에는 항상 wrapLng를 적용한다. 단 항로 폴리라인은 예외로 wrapRouteSegments를 쓴다(9.2장).
focusTarget의 의존성은 token만이다. 좌표를 넣으면 같은 지점을 다시 클릭했을 때 반응하지 않는다.
최소 줌은 가로 폭 기준으로만 계산하고, rAF와 resize에서 재계산한다(9.3장).
타일 레이어에 bounds를 주지 않는다(9.4장).
깜빡임 애니메이션 클래스는 className이 아니라 html 내부 자식 div에 붙인다(9.8장).
기상 마커는 iconSize: [0,0] + CSS translate(-50%,-50%) 패턴을 쓴다(9.8장).
Leaflet 초기화 effect에 StrictMode 이중 실행 가드(active 플래그)를 둔다. cleanup에서 map.remove()와 모든 ref를 null로 정리한다.
날짜·숫자 포맷은 ko-KR 고정이다(지도 팝업만 선택된 지도 언어의 로케일을 따른다).
지도 영역은 min-h-[500px] 로 최소 높이를 보장한다.



## 15. 재구현 체크리스트
L1 — 필수

데이터 모델 + 샘플(선박 5 · 항차 8 · AIS 4 · 이슈 7 · 위험구역 5 · 태풍 2 · 기상 8지점) 입력
페이지 6블록 세로 레이아웃 + 지도 min-h-[500px]
페이지 헤더(타이틀·부제)
상단 요약 카드 ① 운항 지표 4종(2×2)
Leaflet 지도 초기화 — ssr:false 동적 import, maxZoom 15, maxBounds, 가로 폭 기준 최소 줌
이음매(-30°) + wrapLng + wrapRouteSegments
기본 타일 + 해도 타일(maxZoom 각각 지정, errorTileUrl)
항차 레이어 — 계획 항로(점선) + 실제 항적(슬라이싱) + 선박 마커(선체 SVG·침로 회전·자사/타사 구분)
선박 팝업(4행 표 + 자사면 전송 버튼)

L2 — 권장

상단 요약 카드 ②③④⑤ (탄소 2분할 · CII 등급 · 에코 랭킹 Top3 · 주간 캘린더)
함대 게이지 데이터 계산(2패스) + 가로 게이지 컴포넌트
함대 게이지 카드(가로 스크롤·선택 토글·키보드 지원·전체 선택/해제)
빠른 필터 5종 + 부수효과 분리 구조 + 이슈/항구 상호 배타
필터 → 레이어 매핑 + showVessels 판정
도착지 필터(집계·정렬·가로 스크롤·좌우 화살표·그라디언트 페이드)
지도 표시 항차 확정 로직 + 우측 요약 문구

L3 — 여유

항구 레이어(aggregateByPort + 배지 마커 + 3섹션 팝업)
이슈·항구 리스트 패널(스크롤·클릭 시 지도 이동)
요약 팝업 2종(심각도/유형 집계, 정박/출항/입항 집계 + 최다 항구)
오버레이 레이어(위험구역 원 · 태풍 3중 원 · 이슈 배지 · 기상 카드)
깜빡임 애니메이션(자식 div 적용)
지도 위 UI 3종(언어 선택 4종 · 지도 유형 · 범례 3섹션)
MapFocusTarget(token 기반, direct 분기, 팝업 자동 오픈)
제안속도 전송(게이지 버튼 + 팝업 이벤트 위임)

L4 — 선택

Open-Meteo 기상 8지점(allSettled 부분 실패 허용)
GDACS 태풍(Route Handler + unit 파싱 + mock 병합 + 15분 주기)
RainViewer 강수 레이더
자동 새로고침(슬라이딩 select + 회전 아이콘)
딥링크 3종(AI 리포트 · 물류 일정 · 탄소 배출)
타사 선단 배경 트래픽
다국어(ko/en) + 지도 팝업 4개 언어
다크 모드 대응

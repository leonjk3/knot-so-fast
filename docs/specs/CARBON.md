
# 탄소 배출 리포트 — 단독 기능 명세서 (Carbon Emissions Report)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "탄소 배출 리포트" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 원본 프로젝트의 다른 화면(대시보드·물류 일정·선박 관리·AI 운항 리포팅 등)에 의존하지 않고 탄소 배출 리포트만 별도로 구현하는 것을 전제로 작성되었습니다. 대시보드의 "이번 항차 에코 랭킹" 카드에서 이 화면으로 넘어오는 딥링크는 8장에서 선택 구현으로 분리했습니다.

이 문서는 ljo_md.md를 대체합니다. 기존 문서는 page.tsx 전문을 그대로 담은 소스 덤프형 이라 "명세만 반입 가능"이라는 해커톤 조건에 맞지 않았습니다. 이 문서는 동일한 화면을 타입·공식· 레이아웃 서술로만 재현할 수 있도록 다시 쓴 것입니다.

해커톤 원칙: 17장, 910장은 화면이 100% 정상 동작하기 위한 Must 항목입니다. 다만 이 화면은 블록 8개가 서로 독립적이므로, 시간이 부족하면 뒤쪽 블록(재미 요소·탄소 절약 캔)부터 잘라내도 앞쪽은 완전하게 동작합니다. 11장(엣지 케이스)은 시간이 남을 때 확인합니다.



## 목차
개요
접근 권한
데이터 모델
화면 구성
핵심 계산 로직
차트 명세
Scope 3 인증서
외부 딥링크 연동 (선택)
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
항차 1건을 선택해 그 항차의 CII 등급·연료·CO₂ 배출량을 분석하고, ① 과거 평균 ② 유사 선박 벤치마크와 3원 비교한다. 나아가 화주에게 제출할 수 있는 ESG Scope 3 탄소 절감 증명서를 발급하고, 절감량을 나무·자동차·치킨 등으로 환산해 보여주는 게이미피케이션 요소까지 포함한다.

### 1.2 핵심 개념
CII (Carbon Intensity Indicator): IMO의 선박 탄소집약도 지표. 점수가 낮을수록 좋다. A~E 5등급으로 환산하며, D·E 등급이 연속되면 운항 정지 리스크가 발생한다.

3원 비교: 이 화면의 뼈대. 모든 지표를 아래 3개 기준으로 나란히 보여준다.


| 기준 | 의미 | 산출 |
| --- | --- | --- |
| 현재 항차 | 선택된 항차의 실제 계산값 | 선박 연료 커브로 실계산 |
| 동일 선박 최근 5항차 평균 | 자기 자신과의 비교 | 현재값 × 과거 배수 |
| 유사 선박 동일 항로 평균 | 경쟁사·업계와의 비교 | 현재값 × 벤치마크 배수 |


Scope 3 절감량: 벤치마크 대비 절감한 CO₂. 이 화면의 거의 모든 게이미피케이션 요소 (증명서·랭킹·환산·캔·배지)가 이 값 하나에서 파생된다.

대기 탄소(Anchor CO₂): 선박은 정박 중에도 발전기를 돌려 연료를 태운다. 항만 정체를 예측해 감속 운항으로 정시 도착하면 대기 시간 자체가 사라져 탄소를 줄일 수 있다는 것이 이 화면의 핵심 메시지 중 하나다.

### 1.3 계산의 두 축 — 실계산 vs 목업
이 화면은 두 가지 성격의 값이 섞여 있다. 혼동하면 안 된다.


| 값 | 방식 |
| --- | --- |
| 연료·CO₂ 총량 | 선박 fuelCurve로 실계산 — 항차마다 정직하게 달라진다 |
| CII 점수 | 항차별 목업 기준값 — CII 계산식이 없어 대표값을 부여 |
| 과거·벤치마크 | 현재값에 고정 배수를 곱해 파생 |
| 대기 탄소 | 원본 예시(3,976.4t) 대비 비율로 환산 |




## 2. 접근 권한
RBAC가 있는 시스템이라면 ADMIN, LOGISTICS(물류 담당자) 역할만 접근 가능하도록 사이드바/라우팅에 노출한다. CAPTAIN, CLIENT에는 노출하지 않는다.
별도 프론트 전용 데모 앱으로 만든다면 이 제약은 생략해도 무방하다.



## 3. 데이터 모델

### 3.1 타입 정의
// 이 화면이 실제로 사용하는 필드만 표기
interface Vessel {
  id: string
  name: string
  fuelCurve: { speedKnots: number; fuelTonPerDay: number }[]
}

interface Voyage {
  id: string
  vesselId: string
  cargoDescription: string
  departurePort: string          // "부산 (Busan)" 형태
  arrivalPort: string
  status: 'preparing' | 'underway' | 'delayed' | 'completed' | 'cancelled'
  plannedSpeedKnots: number      // CII 시뮬레이터 "현재 속도 유지"
  recommendedSpeedKnots: number  // 배출량 계산의 기준 속도 + 시뮬레이터 "AI 최적"
  fuelType: 'HFO' | 'MGO' | 'LNG'
  distanceNm: number
}

type CiiGrade = 'A' | 'B' | 'C' | 'D' | 'E'

### 3.2 재현용 상수 (그대로 사용 권장)
// ── 항차별 CII 점수 목업 기준값 ─────────────────────────
MOCK_CII_SCORE_BY_VOYAGE = {
  voy001: 4.50,   // KSF PIONEER   · 부산→로테르담      · C
  voy002: 3.30,   // KSF NAVIGATOR · 상하이→LA          · A
  voy003: 4.70,   // KSF VENTURE   · 포트헤들랜드→광양   · C
  voy004: 5.35,   // KSF HORIZON   · 라스타누라→울산     · D
  voy005: 3.95,   // KSF PIONEER   · 함부르크→부산       · B
  voy006: 5.75,   // KSF NAVIGATOR · 오클랜드→부산       · E
}
없는 항차의 기본값 = 4.5

// ── 3원 비교 배수 ─────────────────────────────────────
CARBON_HIST_MULTIPLIER        = 1.1048    // 연료·CO₂ — 과거 평균
CARBON_BENCHMARK_MULTIPLIER   = 1.2145    // 연료·CO₂ — 벤치마크
CII_SCORE_HIST_MULTIPLIER     = 1.0711    // CII 점수 — 과거 평균
CII_SCORE_BENCHMARK_MULTIPLIER= 1.1378    // CII 점수 — 벤치마크

// ── 비교 라벨 (다국어 사전을 거치지 않는 고정 한국어) ──
CARBON_COMPARISON_LABELS = {
  historicalAvg: '동일 선박 최근 5항차 평균',
  benchmarkAvg:  '유사 선박 동일 항로 평균',
}

// ── 함대 에코 랭킹 목업 ────────────────────────────────
MOCK_FLEET_ECO_RANKING = [
  { vesselId: 'v001', co2SavedPct: 17.7, co2SavedTon:  852.8 },  // KSF PIONEER
  { vesselId: 'v005', co2SavedPct: 24.3, co2SavedTon: 1104.2 },  // KSF ASPIRE
  { vesselId: 'v004', co2SavedPct: 21.1, co2SavedTon:  612.5 },  // KSF HORIZON
  { vesselId: 'v002', co2SavedPct: 14.2, co2SavedTon:  588.3 },  // KSF NAVIGATOR
  { vesselId: 'v003', co2SavedPct:  9.8, co2SavedTon:  401.7 },  // KSF VENTURE
]

// ── 탄소 가격 ────────────────────────────────────────
CARBON_PRICE_KRW_PER_TON = 115_000   // EU ETS 참고 시세 €80/ton, 환율 ₩1,440/€ 가정

// ── CII 추이 월 ──────────────────────────────────────
CII_TREND_MONTHS = ['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08']

// ── 배지 임계값 ──────────────────────────────────────
CAN_BADGES = [ {0,'🌱'}, {10,'🌿'}, {20,'🌳'}, {30,'🌍'} ]

// ── 재미 요소 환산 계수 (참고용 근사값) ─────────────────
CO2_TREE_ABSORB_TON_PER_YEAR = 0.022     // 성목 1그루 연간 흡수량 ≈ 22kg
CO2_CAR_TON_PER_KM           = 0.00012   // 승용차 1km 배출량 ≈ 120g
EARTH_CIRCUMFERENCE_KM       = 40075
CO2_CHICKEN_TON              = 0.0025    // 치킨 1마리 조리 탄소발자국 ≈ 2.5kg

// ── 대기 탄소·컴플라이언스 환산 기준 ──────────────────
ANCHOR_REFERENCE_CO2_TON = 3976.4        // voy001의 원본 예시 CO₂ 총량
COMPLIANCE_BASE_KRW      = 1_500_000_000 // 월 손실 기준액

### 3.3 CII 등급 산출
CII_GRADES = ['A','B','C','D','E']       // 배열 순서 = 좋은 등급 → 나쁜 등급

ciiGradeFromScore(score):                // ★ 점수가 낮을수록 좋다
  score < 3.5   → 'A'
  score < 4.0   → 'B'
  score < 4.95  → 'C'
  score < 5.6   → 'D'
  그 외          → 'E'

CII_COLORS = { A: '#16a34a', B: '#84cc16', C: '#d97706', D: '#ea580c', E: '#dc2626' }

이 경계값은 목업 CII 트렌드(C: 4.504.92, D: 5.185.41)에서 역산한 것이다. 실제 IMO 기준과는 다르며, 샘플 데이터가 A~E를 모두 보여주도록 맞춘 값이다.

### 3.4 선박·항차 데이터
자사 선박 5척·항차 8건은 SCHEDULE.md 3.3~3.4장과 VESSEL.md 3.2장의 것을 그대로 쓴다. fuelCurve가 반드시 필요하다(배출량 실계산의 유일한 근거).

### 3.5 데이터 소스
SCHEDULE.md 3.5장과 동일 — mock 전용이 기본 권장. 3.2장의 상수들은 DB로 이관하지 않고 항상 정적 상수로 둔다.



## 4. 화면 구성
전체 페이지는 세로 flex(flex flex-col h-full). 상단 고정 헤더 + 스크롤 영역(flex-1 overflow-y-auto px-6 py-4 space-y-4) 구조이며, 스크롤 영역 안에 블록 7개가 세로로 쌓인다.


| # | 블록 | 폭 구성 | 장 |
| --- | --- | --- | --- |
| 0 | 페이지 헤더 | — | 4.1 |
| 1 | 항차 선택 | 좌측 정렬 | 4.2 |
| 2 | 스탯 카드 4종 + Scope 3 카드 | lg:grid-cols-2 | 4.3 · 4.4 |
| 3 | CII 게이지 · 월별 추이 · 시뮬레이터 | md:grid-cols-2 lg:grid-cols-3 | 4.5 ~ 4.7 |
| 4 | 대기 탄소 vs 운항 탄소 | lg:grid-cols-[1.3fr_1fr] | 4.8 |
| 5 | 3원 비교 분석 표 | 전체 폭 | 4.9 |
| 6 | 재미 요소 + 에코 랭킹 | lg:grid-cols-[580px_1fr] | 4.10 · 4.11 |
| 7 | 탄소 절약 캔 + 배지 | flex-col md:flex-row | 4.12 |


카드 공통 스타일: bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800. 블록 6·7만 그라디언트 배경을 쓴다(10장).

### 4.1 페이지 헤더
공용 PageHeader(높이 64px 고정). 타이틀 "탄소 배출 리포트", 부제는 선박명을 포함하는 함수 — CII 등급 및 탄소 배출량 분석 · {선박명} 기준. 우측 액션 버튼은 없다.

### 4.2 항차 선택
label(12px font-medium 회색) + <select>를 가로로 배치(gap-3).

라벨: "조회할 항차 선택"
옵션 문구: `${선박명} · ${출발항 첫 토큰} → ${도착항 첫 토큰}` (예: KSF PIONEER · 부산 → 로테르담)
전체 항차가 대상이다(상태로 거르지 않는다).
select 스타일: px-3 py-2 border rounded-lg text-sm, 포커스 시 인디고 2px 링.

### 4.3 스탯 카드 4종
좌측 절반을 다시 grid grid-cols-2 gap-2로 나눠 작은 카드 4장을 2×2 배치한다.

각 카드: rounded-xl border p-2.5 flex items-center gap-2. 좌측에 28×28px 회색 라운드 박스 + 아이콘(14px), 우측에 값(16px bold)과 그 아래 설명(10px 회색, truncate).


| # | 값 | 설명 줄 | 아이콘 | 아이콘 색 |
| --- | --- | --- | --- | --- |
| 1 | CII 점수 toFixed(2) | 현재 CII 점수 · 등급 {G} | Award | orange-600 |
| 2 | {CO₂/1000} k ton (소수 1) | 총 CO₂ 배출 · 현재 항차 | Leaf | green-600 |
| 3 | {연료/1000} k ton (소수 1) | 총 연료 소모 · HFO 기준 | Fuel | #6366f1 |
| 4 | -{n}% (소수 1) | vs 유사선박 평균 · CO₂ 절감 | TrendingDown | purple-600 |


설명 줄은 {라벨} · {부가설명} 형식으로 두 문구를 가운뎃점으로 이어 한 줄에 넣는다.

### 4.4 Scope 3 카드
우측 절반. p-4 flex flex-col gap-3.

상단 행: 32×32px 인디고 10% 배경 박스 + FileText(인디고) / 제목 "화주용 ESG Scope 3 인증서" (14px semibold) / 부제 "화주의 공급망 탄소 배출량(Scope 3) 산정에 활용할 수 있는 탄소 절감 증명서를 발급합니다."(11px 회색, truncate).

하단 행(좌우 배치):

좌: 보라 배경 알약(bg-purple-50 dark:bg-purple-500/10 px-3 py-2 flex-1) — Sparkles(purple-600) + **AI 계산 ·** Scope 3 절감량 {n} ton CO₂e (유사 선박 평균 대비 -{n}%) (12px, "AI 계산 ·" 부분만 purple-600 semibold)
우: 인디고 버튼(px-3 py-2 rounded-lg text-xs font-semibold) — FileText 아이콘 + "📄 화주용 ESG Scope 3 탄소 절감 증명서 발급". 클릭 시 7장 모달.

### 4.5 CII 등급 게이지
카드 p-5. 제목 "CII 등급 게이지"(14px semibold, 하단 여백 12px).

큰 등급 표시(가운데, baseline 정렬): 등급 문자(36px extrabold, 등급색) + · CII {점수}(14px 회색)
삼각 지시자 행: grid grid-cols-5. 현재 등급 칸에만 ▼(12px, 등급색)를 가운데 표시
등급 바: grid grid-cols-5 rounded-lg overflow-hidden h-11 shadow-inner. 각 칸은 등급색 배경 + 흰 글씨 bold로 A~E.
현재 등급 칸: opacity 1 + ring-2 ring-inset ring-white/70 + scale-y-110 + z-10
나머지 칸: opacity 0.35
안내 문구(가운데, 11px 회색, 위 여백 10px):
더 좋은 등급이 있으면 다음 목표 등급: {G}
이미 A등급이면 최고 등급을 달성했어요 🎉

### 4.6 CII 월별 추이
카드 p-5. 제목 "CII 점수 월별 추이". 아래에 높이 160px(h-40) 라인 차트(6.1장).

### 4.7 CII 등급 시뮬레이터
카드 p-5 flex flex-col.

상단: Trophy(amber-500) + 제목 "CII 등급 시뮬레이터" / 부제 "현재 속도 유지 시와 AI 최적 감속 운항 시, 이번 분기 말 예상 CII 등급을 비교합니다."(11px 회색).

2열 비교 카드(grid grid-cols-2 gap-2 my-2), 각 칸 가운데 정렬 p-2.5:


|  | 좌 (현재 속도 유지) | 우 (AI 최적 감속 운항) |
| --- | --- | --- |
| 테두리/배경 | 회색 테두리 + bg-slate-50 | #10B981 40% 테두리 + #10B981 5% 배경 |
| 라벨(11px 회색) | 현재 속도 유지 | AI 최적 감속 운항 |
| 등급(24px bold) | 현재 등급(등급색) | 최적화 등급(등급색) |
| 상태(10px semibold) | "등급 유지"(회색) | "우수"(#10B981) |
| 속도(10px 회색) | {계획 속도} kts | {권장 속도} kts |


하단 컴플라이언스 배너(mt-auto, bg-[#10B981]/10 p-2.5 rounded-lg): ShieldCheck(#10B981) + 11px 문구 —

본 감속 운항으로 이번 분기 CII {회피등급}등급 진입을 회피하여 선박 운항 정지 리스크(약 {금액}/월 손실)를 방지했습니다.

### 4.8 대기 탄소 vs 운항 탄소
전체 폭 카드 p-5.

상단: 36×36px 빨강 5% 배경 박스 + Anchor(red-500) / 제목 "대기 탄소 vs 운항 탄소" / 설명(12px 회색, max-w-2xl) —

선박은 정지해 있을 때도 발전기를 돌려 연료를 태웁니다 — 항만 대기(묘박) 중에도 탄소는 계속 배출됩니다. 항만 정체를 미리 예측해 감속 운항으로 정시 도착하면, 대기 시간 자체를 없애 탄소를 절감할 수 있습니다.

본문(grid lg:grid-cols-[1.3fr_1fr] gap-5):

좌: 높이 256px(h-64) 누적 막대 차트(6.2장)
우: 표 + 요약 바(self-start, rounded-lg border overflow-hidden)

표 4열(헤더 회색 배경, 12px semibold):


| 구분 | 운항 탄소 (ton) | 대기 탄소 (ton) | 총 탄소 (ton) |
| --- | --- | --- | --- |
| 기존 (풀악셀 + 3일 항만 대기) | toFixed(2) | toFixed(2) | toFixed(2) (모노스페이스 semibold) |
| AI 최적화 (감속 정시도착) | 〃 | 0.00 | 〃 |


두 번째 행은 bg-[#10B981]/5로 강조한다.

요약 바(표 아래, bg-[#10B981]/10 px-4 py-2.5, 좌우 배치): 좌측 기존 (풀악셀 + 3일 항만 대기) → AI 최적화 (감속 정시도착)(12px 회색), 우측 {n}톤 절감(14px bold #10B981).

### 4.9 3원 비교 분석 표
전체 폭 카드(overflow-hidden). 상단 제목 바(px-5 py-3, 회색 배경): "3원 비교 분석".

표 5열(헤더 12px semibold 회색):


| 구분 | CII 점수 | 등급 | 총 연료 (ton) | 총 CO₂ (ton) |
| --- | --- | --- | --- | --- |


행 3개를 현재 항차 → 과거 평균 → 벤치마크 순서로 렌더링한다.

1행(현재 항차) 배경: bg-[#6366f1]/5 — 나머지 행은 hover 시에만 배경
구분 열: 현재 항차 ({선박명}) / 동일 선박 최근 5항차 평균 / 유사 선박 동일 항로 평균
CII 점수: toFixed(2), 모노스페이스
등급: 등급색 배경 + 흰 글씨 bold 배지(px-2 py-0.5 rounded text-xs)
연료·CO₂: toLocaleString()

### 4.10 재미 요소
블록 6의 좌측(580px 고정). 배경은 인디고→퍼플 그라디언트.

제목 행: PartyPopper(amber-500) + "이만큼 아꼈어요! 🎉"(14px semibold)

부제(12px 회색): AI 에코스피드 최적화로 이번 항차에서 아낀 탄소 {n} ton, 이게 어느 정도냐면...

환산 카드 3장(space-y-2, 각 bg-white rounded-lg border p-2.5 flex items-center gap-2.5):


| 아이콘 | 색 | 문구 |
| --- | --- | --- |
| TreePine | green-600 | 나무 {n}그루가 1년 동안 흡수하는 CO₂ 양과 같아요 🌳 |
| Car | blue-500 | 자동차로 지구를 {n}바퀴 도는 것과 맞먹는 탄소예요 🚗 |
| UtensilsCrossed | amber-500 | 치킨 {n}마리를 튀길 때 나오는 탄소와 비슷해요 🍗 |


하단 면책(10px 회색): * 재미로 보는 참고용 환산치이며 실제 배출계수와 다를 수 있습니다

### 4.11 에코 랭킹
블록 6의 우측(1fr, lg:border-l lg:pl-5).

제목 행: Medal(amber-500) + "이번 항차 에코 랭킹"(14px semibold)
열 헤더(10px semibold 회색, px-3): 순위 자리(폭 20px 빈칸) / 선박(flex-1) / 벤치마크 대비 CO₂ 절감률(폭 128px, 우측정렬) / 환산 가치(폭 96px, 우측정렬)
행(space-y-1.5, 각 rounded-lg px-3 py-2 flex items-center gap-2):
순위: 1~3위는 🥇🥈🥉, 4위부터는 숫자
선박명: 현재 항차면 인디고 + (이 항차) 접미사, 아니면 회색
절감률: -{n}%(모노스페이스 semibold)
환산 가치: formatKrwCompact(...)(모노스페이스 semibold #10B981)
현재 항차 행은 bg-[#6366f1]/10 ring-1 ring-[#6366f1]/30으로 강조
하단 요약(11px 회색): 현재 항차는 전체 {total}척 중 {rank}위예요
면책(10px 회색): * 환산 가치는 EU ETS 해운 탄소배출권 참고 시세(약 €80/ton, ₩115,000/ton 가정)로 계산한 추정치입니다

### 4.12 탄소 절약 캔과 배지
전체 폭 카드. 배경은 에메랄드→인디고 그라디언트.

제목 행: Sparkles(emerald-500) + "탄소 절약 캔 🥫"
부제(12px 회색): 이번 항차에서 모은 탄소 절약량이 얼마나 찼는지 확인해보세요
본문: flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-10

① 캔 (좌측, 고정)

외곽: w-28 h-56 rounded-[2rem] border-4 border-slate-300 overflow-hidden shadow-inner, 배경 bg-slate-50
상단에 뚜껑 표현: absolute top-0 left-0 right-0 h-3 bg-slate-200
채움: absolute bottom-0 left-0 right-0, 높이 {clamp(절감률, 4, 100)}%, bg-gradient-to-t from-emerald-500 to-emerald-300, transition-all duration-1000 ease-out
채움 상단에 타원형 액체 표면: absolute -top-1.5 h-3 rounded-[50%] bg-emerald-300/90
거품 3개: 흰색 반투명 원(w-1.5 h-1.5 / w-1 h-1 ×2), animate-bounce, animationDelay 각각 0ms / 300ms / 600ms
캔 정중앙에 절감률 텍스트: {n}%(24px extrabold, drop-shadow-sm)
캔 아래: {n} ton 절약 · 캔에 콸콸 채우는 중(12px semibold) + 마일스톤 문구(11px emerald-600, 가운데 정렬)

마일스톤 문구(절감률 기준):


| 조건 | 문구 |
| --- | --- |
| ≥ 30% | 캔이 넘칠 기세예요! 지구가 감동했어요 🌍💚 |
| ≥ 20% | 거의 다 찼어요, 조금만 더 힘내요! 💪 |
| ≥ 10% | 절반 넘게 채웠어요, 이 페이스 좋아요! 👍 |
| 그 외 | 이제 막 채우기 시작했어요, 함께 채워봐요 🌱 |


② 배지 (우측, flex-1, md:border-l md:pl-8)

제목 행: Trophy(amber-500) + "달성 배지"(12px semibold)

4칸 그리드(grid-cols-2 sm:grid-cols-4 gap-2.5), 각 칸 rounded-lg border p-3 text-center:


| # | 이모지 | 라벨 | 임계값 |
| --- | --- | --- | --- |
| 1 | 🌱 | 새싹 항해사 | 0%+ |
| 2 | 🌿 | 그린 항해사 | 10%+ |
| 3 | 🌳 | 에코 마스터 | 20%+ |
| 4 | 🌍 | 지구 수호자 | 30%+ |


해금(절감률 ≥ 임계값): border-emerald-300 bg-emerald-50, 우상단 CheckCircle2(emerald-500), 라벨 emerald-700
잠김: bg-slate-50 opacity-50 grayscale, 우상단 Lock(회색), 라벨 회색
각 칸 구성(위→아래): 우상단 아이콘(절대 위치) / 이모지(24px) / 라벨(11px semibold) / {n}%+(10px 회색)

하단 문구(11px 회색):

다음 배지가 있으면 다음 배지 "{배지명}"까지 {n}%p 남았어요
전부 해금이면 모든 배지를 달성했어요! 진정한 지구 수호자예요 🏆



## 5. 핵심 계산 로직
이 장의 모든 값은 선택된 항차 1건에서 파생된다. 순서대로 계산하면 의존 관계가 자연히 맞는다.

### 5.1 기준 항차·선박 결정
selectedVoyage = voyages 중 id === voyageId 인 것 ?? voyages[0]
selectedVessel = vessels 중 id === selectedVoyage.vesselId 인 것

둘 중 하나라도 없으면 → "불러오는 중..." 텍스트만 렌더링하고 조기 반환

첫 진입 시 voyageId는 null 이므로 voyages[0]이 기본 선택된다.

### 5.2 배출량 실계산
baseCiiScore  = MOCK_CII_SCORE_BY_VOYAGE[voyage.id] ?? 4.5

dailyFuelRate = interpolateFuelRate(vessel.fuelCurve, voyage.recommendedSpeedKnots)
totalFuelTon  = dailyFuelRate × (voyage.distanceNm / voyage.recommendedSpeedKnots / 24)
totalCo2Ton   = totalFuelTon × fuelEmissionFactor(voyage.fuelType)

interpolateFuelRate: 연료 커브를 속도 오름차순 정렬한 뒤 선형 보간. 커브 범위를 벗어나면 가장 가까운 끝점으로 clamp.
fuelEmissionFactor: HFO 3.114 / MGO 3.206 / LNG 2.750 (기본 3.114)
distanceNm / speed / 24 = 항해 일수. 여기에 일일 소모량을 곱해 총량을 낸다.

기준 속도는 recommendedSpeedKnots 다(계획 속도가 아니다). "AI 권장 속도로 운항했을 때의 배출량"이 이 화면의 현재값이다.

### 5.3 3원 비교
현재 항차   = { avgCiiScore: baseCiiScore,
               totalFuelTon, totalCo2Ton,
               ciiGrade: ciiGradeFromScore(baseCiiScore) }

과거 평균   = { avgCiiScore: baseCiiScore × 1.0711,
               totalFuelTon: totalFuelTon × 1.1048,
               totalCo2Ton:  totalCo2Ton  × 1.1048,
               ciiGrade: ciiGradeFromScore(baseCiiScore × 1.0711) }

벤치마크    = { avgCiiScore: baseCiiScore × 1.1378,
               totalFuelTon: totalFuelTon × 1.2145,
               totalCo2Ton:  totalCo2Ton  × 1.2145,
               ciiGrade: ciiGradeFromScore(baseCiiScore × 1.1378) }

CII 점수와 연료·CO₂는 배수가 서로 다르다. 4개 상수를 헷갈리지 말 것.

### 5.4 Scope 3 절감량 — 모든 게이미피케이션의 원천
scope3SavedTon = 벤치마크.totalCo2Ton - 현재.totalCo2Ton
scope3SavedPct = (1 - 현재.totalCo2Ton / 벤치마크.totalCo2Ton) × 100

배수가 고정(1.2145)이므로 scope3SavedPct는 항상 약 17.66%로 일정하다. 항차를 바꿔도 퍼센트는 거의 그대로이고 톤 수만 달라진다 — 버그가 아니라 배수 방식의 필연적 결과다.

이 두 값이 4.4 카드, 7장 증명서, 4.10 환산, 4.11 랭킹, 4.12 캔·배지에 모두 재사용된다.

### 5.5 CII 월별 추이 데이터
7개월치를 현재 점수로 끝나도록 역산해 생성한다.

ciiTrendScores[i] = round2( baseCiiScore × (1.18 - 0.18 × (i / 6)) )     // i = 0..6

i = 0(2026-02) → baseCiiScore × 1.18 (가장 나쁨)
i = 6(2026-08) → baseCiiScore × 1.00 (현재 점수와 정확히 일치)

즉 7개월에 걸쳐 18% 개선된 것처럼 보이는 우하향 곡선이 항상 만들어진다.

### 5.6 CII 시뮬레이터
gradeIdx        = CII_GRADES.indexOf(현재등급)
nextBetterGrade = gradeIdx > 0 ? CII_GRADES[gradeIdx - 1] : null      // 게이지 안내 문구용

ciiSimOptimizedScore = round2(baseCiiScore × 0.85)                    // 15% 개선
현재 속도 유지 = { speedKts: voyage.plannedSpeedKnots,      grade: 현재등급 }
AI 최적 감속  = { speedKts: voyage.recommendedSpeedKnots,  grade: ciiGradeFromScore(ciiSimOptimizedScore) }

회피 등급 = gradeIdx < 4 ? CII_GRADES[gradeIdx + 1] : 현재등급        // 한 단계 나쁜 등급
complianceRiskKrw   = 1_500_000_000 × (totalCo2Ton / 3976.4)
complianceAmountLabel = `${(complianceRiskKrw / 1e8).toFixed(0)}억원`

"회피 등급"은 현재 등급보다 한 단계 나쁜 등급이다. "감속하지 않았다면 떨어졌을 등급"을 의미하며, 이미 E등급이면 그대로 E를 쓴다.

### 5.7 대기 탄소 시나리오
원본 예시(voy001의 CO₂ 3,976.4t)에서 잡은 비율을 선택 항차의 실제 총량에 맞춰 환산한다.

anchorScale = totalCo2Ton / 3976.4

기존   = { sailingCo2Ton: round1(100 × anchorScale),
          anchorCo2Ton:  round1(30  × anchorScale),  anchorDays: 3 }
최적화 = { sailingCo2Ton: round1(85  × anchorScale),
          anchorCo2Ton:  0,                          anchorDays: 0 }

baselineTotal  = 기존.sailing  + 기존.anchor
optimizedTotal = 최적화.sailing + 최적화.anchor
anchorSavedTon = baselineTotal - optimizedTotal

즉 운항 탄소 15% 감소 + 대기 탄소 100% 제거로 총 약 34.6% 절감이 되는 시나리오다.

표시 시 반드시 toFixed(2)를 적용한다. 곱셈·뺄셈 결과를 그대로 렌더링하면 364.29999999999995 같은 부동소수점 오차가 화면에 노출된다 (KNOWN_PITFALLS.md 4.5 — 원본에서 실제 발생).

### 5.8 함대 에코 랭킹
fleetRanking = [
  { vesselId: 선택선박.id, vesselName: 선택선박.name,
    co2SavedPct: scope3SavedPct, co2SavedTon: scope3SavedTon, isCurrent: true },
  ...MOCK_FLEET_ECO_RANKING
        .filter(r => r.vesselId !== 선택선박.id)      // ★ 중복 제거
        .map(r => ({ ...r, vesselName: 선박조회(r.vesselId) ?? r.vesselId, isCurrent: false }))
].sort((a, b) => b.co2SavedPct - a.co2SavedPct)      // 절감률 내림차순

fleetRank = fleetRanking.findIndex(r => r.isCurrent) + 1

선택된 선박은 목업 값 대신 실시간 계산값으로 대체된다. 그래서 목록에서 그 선박을 먼저 제거한 뒤 계산 결과를 앞에 끼워 넣는다. 결과 목록은 항상 5행이다.

환산 가치 포맷

formatKrwCompact(v):
  v >= 1e8  → `${(v / 1e8).toFixed(1)}억원`
  v >= 1e4  → `${round(v / 1e4).toLocaleString()}만원`
  그 외      → `${round(v).toLocaleString()}원`

환산 가치 = co2SavedTon × 115_000

### 5.9 재미 요소 환산
나무 그루수  = round(scope3SavedTon / 0.022)
지구 바퀴수  = scope3SavedTon / 0.00012 / 40075          // toFixed(1)로 표시
치킨 마리수  = round(scope3SavedTon / 0.0025)

그루수·마리수는 toLocaleString()으로 천단위 콤마를 넣는다.

### 5.10 배지 진행도
nextBadgeIdx = CAN_BADGES.findIndex(b => scope3SavedPct < b.threshold)
nextBadge    = nextBadgeIdx === -1 ? null : CAN_BADGES[nextBadgeIdx]
nextBadgeLabel = nextBadgeIdx === -1 ? '' : 배지라벨[nextBadgeIdx]

해금 여부(각 배지) = scope3SavedPct >= badge.threshold
캔 채움 높이(%)    = clamp(scope3SavedPct, 4, 100)      // ★ 최소 4% — 0%일 때도 액체가 보이게

절감률이 약 17.66%로 고정되므로, 샘플 데이터에서는 1·2번 배지만 해금되고 3·4번은 잠긴 상태로 보이는 것이 정상이다.



## 6. 차트 명세
두 차트 모두 Apache ECharts이며 반드시 SSR을 끄고 동적 import 한다 (dynamic(() => import('echarts-for-react'), { ssr: false })). notMerge를 켜서 항차를 바꿀 때 이전 옵션이 남지 않게 한다.

테마 연동 색상(두 차트 공통)


| 용도 | 라이트 | 다크 |
| --- | --- | --- |
| 축·격자선 | #e2e8f0 | #334155 |
| 축 라벨 | #64748b | #94a3b8 |
| 툴팁 배경 | #ffffff | #1e293b |
| 툴팁 테두리 | #e2e8f0 | #334155 |
| 툴팁 글자 | #334155 | #e2e8f0 |


### 6.1 CII 월별 추이 (라인 차트)
backgroundColor: 'transparent'
animation: true, animationDuration: 1200, animationEasing: 'cubicOut'
grid: { top: 16, right: 12, bottom: 24, left: 36 }

tooltip: trigger 'axis'
  formatter: `${월}<br/>CII: <b>${값.toFixed(2)}</b>`

xAxis: type 'category', data = 월 배열에서 앞 5자를 잘라낸 값     # '2026-02' → '02'
       axisTick 숨김, axisLabel 11px

yAxis: type 'value', scale: true                                 # ★ 0부터 시작하지 않음
       splitLine 점선, axisLabel 11px, formatter v.toFixed(1)

series[0]: type 'line', smooth: true
  symbol 'circle', symbolSize 7
  lineStyle { color '#6366f1', width 3 }
  itemStyle { color '#6366f1', borderColor 다크?'#1e293b':'#fff', borderWidth 2 }
  areaStyle: 세로 그라디언트
      offset 0 → rgba(99,102,241, 다크 0.35 / 라이트 0.18)
      offset 1 → rgba(99,102,241, 0)

yAxis.scale: true가 중요하다. 끄면 0부터 그려져 7개월간의 18% 개선폭이 거의 평평하게 보인다.

### 6.2 대기 탄소 (누적 막대 차트)
backgroundColor: 'transparent'
animation: true, animationDuration: 1200, animationEasing: 'cubicOut'
legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12, 11px }
grid: { top: 40, right: 12, bottom: 24, left: 16, containLabel: true }

tooltip: trigger 'axis', axisPointer { type: 'shadow' }
  formatter: 시나리오명 + 각 계열 `{마커} {계열명}: <b>{값}</b> ton` 줄 나열
             + 마지막 줄 `총 탄소 (ton): <b>{합계}</b> ton`

xAxis: type 'category', data = [기존 라벨, 최적화 라벨]
yAxis: type 'value', axisLabel formatter `${v}t`

series[0] — 운항 탄소:
  type 'bar', stack 'co2', barMaxWidth 72
  세로 그라디언트  #67e8f9 → #6366f1        (하늘 → 인디고)

series[1] — 대기 탄소 (묘박):
  type 'bar', stack 'co2', barMaxWidth 72
  세로 그라디언트  #fca5a5 → #dc2626        (연빨강 → 빨강)
  label: { show: true, position: 'top', 10px,
           formatter: 값 > 0 ? `${값}t` : '' }     # ★ 0이면 라벨 숨김

두 계열이 같은 stack 이름을 쓴다 — 누적 막대여야 "기존 총량 vs 최적화 총량"이 한눈에 비교된다. 대기 탄소 라벨은 최적화 시나리오에서 0이므로, 조건부로 빈 문자열을 반환해 0t가 찍히지 않게 한다.



## 7. Scope 3 인증서

### 7.1 모달 셸
오버레이: fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4, 가운데 정렬. 오버레이 자신을 직접 클릭했을 때만 닫는다(e.target === e.currentTarget).
패널: max-w-lg, 흰 배경, rounded-2xl shadow-2xl, 세로 flex, max-h-[90vh].
헤더(px-6 py-4, 하단 보더): 제목 "ESG Scope 3 탄소 절감 증명서"(14px semibold) + 부제 "AI가 항차 데이터를 기반으로 생성한 증명서 초안입니다"(11px 회색) + 우측 X 버튼.
본문(px-6 py-4 overflow-y-auto):
<pre> 블록 — whitespace-pre-wrap text-xs leading-relaxed, 회색 배경 카드 (bg-slate-50 rounded-lg p-4 border)에 증명서 전문
그 아래 면책(11px 회색): * AI가 기존 항차 데이터로 생성한 초안입니다. 실제 발급 전 검토가 필요하며, Gemini 등 외부 LLM API 연동은 백엔드 구성 후 지원됩니다.
푸터(px-6 py-4, 상단 보더, 우측 정렬): 닫기(고스트) + 다운로드 (.txt)(인디고, Download 아이콘).

### 7.2 증명서 본문 (한국어)
{} 부분만 치환한다. 줄바꿈을 그대로 유지해야 <pre>에서 형식이 살아난다.

ESG SCOPE 3 탄소 절감 실적 증명서

선박명: {선박명}
항로: {출발항} → {도착항} ({거리 천단위콤마} nm)
화물: {화물 내용}

본 증명서는 상기 항차에서 AI 에코스피드 최적 운항을 적용한 결과, 유사 선박·동일 항로 평균 대비 CO₂ 배출량 {절감톤 toFixed(1)} ton({절감률 toFixed(1)}%)을 절감하였음을 증명합니다.

본 절감 실적은 귀사의 Scope 3(공급망) 탄소 배출량 산정에 활용하실 수 있습니다.

발급일: {YYYY-MM-DD}
발급: KNOT SO FAST 운항 최적화 플랫폼

### 7.3 증명서 본문 (영문)
언어가 en이면 이 버전을 쓴다. 화살표를 ->로, CO₂를 CO2로 쓰는 점에 주의(ASCII 안전).

ESG SCOPE 3 CARBON REDUCTION CERTIFICATE

Vessel: {선박명}
Route: {출발항} -> {도착항} ({거리} nm)
Cargo: {화물 내용}

This certifies that AI-optimized eco-speed operation on the above voyage reduced CO2 emissions by {절감톤} ton ({절감률}%) versus the benchmark average of similar vessels on the same route.

This reduction record may be used toward your organization's Scope 3 (supply chain) carbon accounting.

Issued: {YYYY-MM-DD}
Issued by: KNOT SO FAST Voyage Optimization Platform

발급일은 new Date().toISOString().slice(0, 10).

### 7.4 텍스트 파일 다운로드
서버 왕복 없이 클라이언트에서 즉시 생성한다.

downloadText(filename, text):
  blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  url  = URL.createObjectURL(blob)
  a    = document.createElement('a')
  a.href = url;  a.download = filename;  a.click()
  URL.revokeObjectURL(url)          # ★ 메모리 누수 방지

파일명 = `scope3-certificate-${voyage.id}.txt`

charset=utf-8을 반드시 지정한다. 없으면 한국어 증명서가 일부 환경에서 깨진다.



## 8. 외부 딥링크 연동 (선택)
대시보드의 "이번 항차 에코 랭킹" 카드에서 선박을 클릭하면 이 화면으로 넘어와 해당 선박의 항차가 자동 선택된다. 탄소 화면만 단독 구현한다면 생략한다.

키: 'ksf:carbon-vessel-id'    값: vesselId

[받는 쪽 — 마운트 후 항차 로딩이 끝났을 때 1회]
  useEffect(() => {
    const vesselId = sessionStorage.getItem(KEY)
    if (!vesselId) return
    sessionStorage.removeItem(KEY)                      # ★ 1회성 소비
    const list   = voyages.filter(v => v.vesselId === vesselId)
    const voyage = list.find(v => ['underway','delayed'].includes(v.status)) ?? list[0]
    if (!voyage) return
    setVoyageId(voyage.id)
  }, [voyages.length])                                  # ★ 길이만 의존

같은 선박의 항차가 여러 건이면 운항 중(underway/delayed)을 우선하고, 없으면 첫 번째를 쓴다. 의존성을 voyages.length로 둔 것은 데이터 로딩 완료 시점에 딱 한 번만 반영하기 위함이다 (mock 전용이면 []로 두어도 된다).



## 9. 다국어 텍스트 전체 사전
t.carbon.* — 함수형 항목은 (인자) → 결과 형식으로 표기했다.


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 탄소 배출 리포트 | Carbon Emissions Report |
| subtitle(v) | CII 등급 및 탄소 배출량 분석 · {v} 기준 | CII rating & emissions analysis · {v} |
| voyageSelectLabel | 조회할 항차 선택 | Select voyage to view |
| ciiScore | 현재 CII 점수 | CII Score |
| totalCo2 | 총 CO₂ 배출 | Total CO₂ |
| totalFuel | 총 연료 소모 | Total Fuel |
| vsBenchmark | vs 유사선박 평균 | vs Benchmark |
| curVoyage | 현재 항차 | Current Voyage |
| hfoBase | HFO 기준 | HFO basis |
| co2Saving | CO₂ 절감 | CO₂ Saved |
| grade | 등급 | Grade |
| gaugeTitle | CII 등급 게이지 | CII Rating Gauge |
| gaugeNextGrade(g) | 다음 목표 등급: {g} | Next target grade: {g} |
| gaugeBestGrade | 최고 등급을 달성했어요 🎉 | Top grade achieved 🎉 |
| trendTitle | CII 점수 월별 추이 | CII Monthly Trend |
| comparison | 3원 비교 분석 | 3-Way Comparison |
| colCategory | 구분 | Category |
| colCiiScore | CII 점수 | CII Score |
| colGrade | 등급 | Grade |
| colFuel | 총 연료 (ton) | Total Fuel (ton) |
| colCo2 | 총 CO₂ (ton) | Total CO₂ (ton) |
| anchorTitle | 대기 탄소 vs 운항 탄소 | Anchor vs Sailing Carbon |
| anchorDesc | 선박은 정지해 있을 때도 발전기를 돌려 연료를 태웁니다 — 항만 대기(묘박) 중에도 탄소는 계속 배출됩니다. 항만 정체를 미리 예측해 감속 운항으로 정시 도착하면, 대기 시간 자체를 없애 탄소를 절감할 수 있습니다. | Vessels burn fuel to run generators even at a standstill — carbon keeps emitting during port waiting (anchorage). Predicting port congestion ahead of time and slow-steaming to arrive just-in-time eliminates the wait itself, cutting carbon. |
| anchorBaselineLabel | 기존 (풀악셀 + 3일 항만 대기) | Baseline (full speed + 3-day port wait) |
| anchorOptimizedLabel | AI 최적화 (감속 정시도착) | AI-optimized (slow steam, just-in-time) |
| sailingLegend | 운항 탄소 | Sailing CO₂ |
| anchorLegend | 대기 탄소 (묘박) | Anchor CO₂ |
| colScenario | 구분 | Scenario |
| colSailingCo2 | 운항 탄소 (ton) | Sailing CO₂ (ton) |
| colAnchorCo2 | 대기 탄소 (ton) | Anchor CO₂ (ton) |
| colTotalCo2 | 총 탄소 (ton) | Total CO₂ (ton) |
| savedLabel(t) | {t}톤 절감 | {t} ton saved |
| ciiSimTitle | CII 등급 시뮬레이터 | CII Rating Simulator |
| ciiSimDesc | 현재 속도 유지 시와 AI 최적 감속 운항 시, 이번 분기 말 예상 CII 등급을 비교합니다. | Compares projected end-of-quarter CII rating between maintaining current speed and AI-optimized slow steaming. |
| ciiSimCurrentLabel | 현재 속도 유지 | Maintain Current Speed |
| ciiSimOptimizedLabel | AI 최적 감속 운항 | AI-Optimized Slow Steaming |
| ciiSimBaseline | 등급 유지 | Grade maintained |
| ciiSimRiskGood | 우수 | Excellent |
| ciiSimCompliance(g, amt) | 본 감속 운항으로 이번 분기 CII {g}등급 진입을 회피하여 선박 운항 정지 리스크(약 {amt}/월 손실)를 방지했습니다. | This slow-steaming plan avoids entering CII grade {g} this quarter, preventing an estimated {amt}/month operational-suspension risk. |
| scope3Title | 화주용 ESG Scope 3 인증서 | ESG Scope 3 Certificate |
| scope3Desc | 화주의 공급망 탄소 배출량(Scope 3) 산정에 활용할 수 있는 탄소 절감 증명서를 발급합니다. | Issue a carbon reduction certificate your shippers can use for their Scope 3 (supply chain) emissions accounting. |
| scope3AiLabel | AI 계산 · | AI-computed · |
| scope3AiValue(t, p) | Scope 3 절감량 {t} ton CO₂e (유사 선박 평균 대비 -{p}%) | Scope 3 reduction {t} ton CO₂e (-{p}% vs. similar-vessel benchmark) |
| scope3Button | 📄 화주용 ESG Scope 3 탄소 절감 증명서 발급 | 📄 Issue ESG Scope 3 Certificate |
| scope3ModalTitle | ESG Scope 3 탄소 절감 증명서 | ESG Scope 3 Carbon Reduction Certificate |
| scope3ModalSub | AI가 항차 데이터를 기반으로 생성한 증명서 초안입니다 | AI-generated draft based on this voyage's data |
| scope3Download | 다운로드 (.txt) | Download (.txt) |
| scope3Close | 닫기 | Close |
| scope3Disclaimer | * AI가 기존 항차 데이터로 생성한 초안입니다. 실제 발급 전 검토가 필요하며, Gemini 등 외부 LLM API 연동은 백엔드 구성 후 지원됩니다. | * AI-generated draft from existing voyage data. Review before issuing formally; Gemini or other external LLM API integration requires a backend and is not yet connected. |
| funTitle | 이만큼 아꼈어요! 🎉 | Look what you saved! 🎉 |
| funSubtitle(t) | AI 에코스피드 최적화로 이번 항차에서 아낀 탄소 {t} ton, 이게 어느 정도냐면... | AI eco-speed optimization saved {t} ton of carbon on this voyage. Here's what that actually means... |
| funTrees(n) | 나무 {n}그루가 1년 동안 흡수하는 CO₂ 양과 같아요 🌳 | What {n} trees absorb in a year 🌳 |
| funEarthLaps(n) | 자동차로 지구를 {n}바퀴 도는 것과 맞먹는 탄소예요 🚗 | Same carbon as driving a car {n} laps around the Earth 🚗 |
| funChicken(n) | 치킨 {n}마리를 튀길 때 나오는 탄소와 비슷해요 🍗 | Roughly the carbon footprint of frying {n} chickens 🍗 |
| funDisclaimer | * 재미로 보는 참고용 환산치이며 실제 배출계수와 다를 수 있습니다 | * Rough, illustrative conversions for fun — actual emission factors may differ |
| rankTitle | 이번 항차 에코 랭킹 | This Voyage's Eco Rank |
| rankColVessel | 선박 | Vessel |
| rankColSaved | 벤치마크 대비 CO₂ 절감률 | CO₂ Saved vs. Benchmark |
| rankColValue | 환산 가치 | Est. Value |
| rankCurrentTag | 이 항차 | this voyage |
| rankSummary(r, t) | 현재 항차는 전체 {t}척 중 {r}위예요 | This voyage ranks #{r} of {t} vessels |
| rankValueDisclaimer | * 환산 가치는 EU ETS 해운 탄소배출권 참고 시세(약 €80/ton, ₩115,000/ton 가정)로 계산한 추정치입니다 | * Estimated using a reference carbon price (EU ETS, ~€80/ton, assumed ₩115,000/ton) |
| canTitle | 탄소 절약 캔 🥫 | Carbon Savings Can 🥫 |
| canSubtitle | 이번 항차에서 모은 탄소 절약량이 얼마나 찼는지 확인해보세요 | See how full your carbon savings can is for this voyage |
| canFillLabel(t) | {t} ton 절약 · 캔에 콸콸 채우는 중 | {t} ton saved · filling up the can |
| canMilestone(pct) | 4.12장 표 참조 | ≥30 The can is about to overflow! The planet is impressed 🌍💚 / ≥20 Almost full — keep it up! 💪 / ≥10 Over halfway there, great pace! 👍 / else Just getting started — let's fill it up 🌱 |
| badgesTitle | 달성 배지 | Achievement Badges |
| badge1~4 | 새싹 항해사 / 그린 항해사 / 에코 마스터 / 지구 수호자 | Sprout Sailor / Green Sailor / Eco Master / Earth Guardian |
| badgeNext(p, b) | 다음 배지 "{b}"까지 {p}%p 남았어요 | {p}pp to go until "{b}" |
| badgeAllDone | 모든 배지를 달성했어요! 진정한 지구 수호자예요 🏆 | All badges unlocked! You're a true Earth Guardian 🏆 |


canMilestone은 반환 타입을 명시적으로 : string으로 선언해야 한다. 여러 문자열 리터럴을 반환하면 타입이 한국어 리터럴 유니온으로 좁게 추론되어 영문 사전과 타입이 맞지 않아 CI 빌드가 깨진다(KNOWN_PITFALLS.md 7.2 — 원본에서 실제 발생).

CARBON_COMPARISON_LABELS(과거 평균·벤치마크 라벨)와 formatKrwCompact의 단위(억원·만원·원)는 다국어 사전을 거치지 않는 고정 한국어다. 원본 그대로 재현하려면 하드코딩한다.



## 10. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 — Scope 3 카드 아이콘·버튼, 3원 비교 1행 강조, 랭킹 현재 행, 차트 라인·그라디언트. hover #4f46e5.
에코 그린 #10B981 — 이 화면의 두 번째 주색. CII 시뮬레이터 최적화 카드, 컴플라이언스 배너, 대기 탄소 표 강조 행·요약 바, 랭킹 환산 가치.
CII 등급색: A #16a34a / B #84cc16 / C #d97706 / D #ea580c / E #dc2626
차트 그라디언트:
운항 탄소 #67e8f9 → #6366f1
대기 탄소 #fca5a5 → #dc2626
CII 추이 영역 rgba(99,102,241, 0.18/0.35) → 투명
블록 배경 그라디언트:
재미 요소·랭킹 — from-[#6366f1]/5 to-purple-500/5(다크는 /10)
탄소 절약 캔 — from-emerald-500/5 to-[#6366f1]/5(다크는 /10)
카드 기본: bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800, 내부 여백은 큰 카드 p-5 / 작은 카드 p-2.5.
타이포: 섹션 제목 14px semibold / 스탯 값 16px bold / CII 등급 문자 36px extrabold / 시뮬레이터 등급 24px bold / 캔 퍼센트 24px extrabold / 표 본문 14px / 보조 문구 10~12px.
모노스페이스(font-mono): 3원 비교표의 CII 점수, 대기 탄소표의 총합, 랭킹의 절감률·환산 가치.
아이콘 세트: lucide-react — Leaf, TrendingDown, Fuel, Award, Anchor, Trophy, ShieldCheck, FileText, Sparkles, X, Download, PartyPopper, TreePine, Car, UtensilsCrossed, Medal, CheckCircle2, Lock
다크 모드: 모든 배경/텍스트/테두리에 dark: variant를 정의하고, 차트 색은 6장 표대로 런타임에 스위칭한다.



## 11. 엣지 케이스 및 불변식
선택 항차 또는 선박을 찾지 못하면 조기 반환한다 — p-6에 회색 12px로 "불러오는 중..."만 렌더링한다. SWR을 쓰면 첫 렌더에 반드시 이 경로를 지나므로 생략하면 화면이 터진다.
CII는 점수가 낮을수록 좋다. 등급 경계, 게이지 안내("다음 목표 등급"), 시뮬레이터의 "회피 등급" 모두 이 방향을 전제로 한다.
배출량 계산의 기준 속도는 recommendedSpeedKnots 다(계획 속도가 아니다).
CII 점수 배수와 연료·CO₂ 배수는 서로 다르다(1.0711/1.1378 vs 1.1048/1.2145). 4개 상수를 혼동하면 3원 비교표가 미묘하게 어긋난다.
scope3SavedPct는 항차를 바꿔도 거의 일정(≈17.66%) 하다. 배수가 고정이라 생기는 필연적 결과이며 버그가 아니다. 따라서 배지도 항상 1·2번만 해금된 상태로 보인다.
모든 게이미피케이션은 scope3SavedTon/scope3SavedPct 하나에서 파생된다. 값을 여러 곳에서 따로 계산하지 말고 한 번 구해 재사용한다.
대기 탄소·총합 표시에 반드시 toFixed(2) 를 적용한다(5.7장 주의).
차트 라벨의 0값은 빈 문자열로 처리한다. 최적화 시나리오의 대기 탄소가 0인데 0t가 찍히면 지저분하다.
CII 추이 차트는 yAxis.scale: true 여야 개선 추세가 보인다(6.1장).
랭킹에서 선택 선박은 목업 목록에서 먼저 제거한 뒤 실계산 값을 끼워 넣는다. 안 그러면 같은 선박이 두 번 나온다.
캔 채움 높이는 최소 4% 로 clamp한다. 0%면 액체가 전혀 안 보여 UI가 고장난 것처럼 보인다.
증명서 언어는 앱 전역 언어(lang)를 따른다. 한국어/영문 두 벌을 모두 준비하고, 영문은 ->·CO2처럼 ASCII로 쓴다.
Blob에 charset=utf-8을 지정한다(7.4장).
URL.revokeObjectURL을 호출해 메모리 누수를 막는다.
canMilestone의 반환 타입을 : string으로 명시한다(9장 주의).
ECharts는 ssr:false 동적 import + notMerge 를 지킨다.
모달 오버레이는 자기 자신을 클릭했을 때만 닫는다.
딥링크 effect의 의존성은 voyages.length 다. voyages 자체를 넣으면 매 렌더마다 재실행된다.



## 12. 재구현 체크리스트
상수 7세트 입력(CII 점수 목업 · 3원 배수 4종 · 랭킹 목업 · 탄소 가격 · 배지 · 환산 계수 · 추이 월)
ciiGradeFromScore + CII_COLORS + CII_GRADES 배열
interpolateFuelRate · fuelEmissionFactor 유틸
페이지 셸(헤더 + 스크롤 영역 space-y-4) + 선택 항차/선박 없을 때 조기 반환
항차 선택 select(선박명 · 출발 → 도착)
배출량 실계산(연료율 보간 → 총 연료 → 총 CO₂)
3원 비교 3세트 파생(점수/연료/CO₂ 배수 구분 적용)
Scope 3 절감량(톤·퍼센트) — 이후 모든 블록이 이 값을 재사용
스탯 카드 4종(2×2)
Scope 3 카드(보라 알약 + 발급 버튼)
CII 등급 게이지(큰 등급 + ▼ 지시자 + 5칸 바 + 안내 문구)
CII 월별 추이 데이터 생성(7개월 역산) + 라인 차트(scale: true)
CII 시뮬레이터(2열 비교 카드 + 회피 등급·컴플라이언스 금액 배너)
대기 탄소 시나리오 계산 + 누적 막대 차트 + 4열 표 + 절감 요약 바
3원 비교 분석 표(5열, 현재 행 강조, 등급 배지)
재미 요소 3종 환산 + 카드 + 면책
에코 랭킹(중복 제거 → 정렬 → 순위 산출) + 메달 + 환산 가치(formatKrwCompact)
탄소 절약 캔(채움 애니메이션 · 액체 표면 · 거품 3개 · 최소 4% clamp) + 마일스톤 문구
배지 4종(해금/잠김 상태 · 자물쇠/체크 아이콘) + 다음 배지 안내
Scope 3 증명서 모달(ko/en 본문 + <pre> + 면책 + .txt 다운로드)
(선택) 대시보드 → 탄소 딥링크(sessionStorage 1회성 소비, 운항 중 항차 우선)
다국어(ko/en) 전체 적용 + canMilestone 반환 타입 명시
다크 모드 대응(차트 색 런타임 스위칭 포함)

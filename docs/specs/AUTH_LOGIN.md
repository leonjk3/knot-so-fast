
# 로그인 — 단독 기능 명세서 (Authentication / Sign In)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "로그인" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 화면(뷰)만 다룹니다. 인증 상태 관리(AuthContext)의 구현은 BOOTSTRAP.md 7.3장에 이미 정의되어 있으므로 여기서는 호출 규약만 명세하고 중복하지 않습니다.

선행 문서: BOOTSTRAP.md를 먼저 끝낸다 — 특히 7.3장(AuthContext) 과 6.2장(인증 가드) 이 이 화면의 전제다. 구현 중 막히면 KNOWN_PITFALLS.md의 증상 인덱스에서 찾는다.

데모에서 가장 먼저 보이는 화면이다. 심사위원이 처음 마주하는 첫인상이므로, 시간이 부족하더라도 좌측 히어로 패널(4.2장)만은 살리는 것을 권장한다. 우측 폼은 단순해서 빨리 만들 수 있다.



## 목차
개요
접근 권한
데이터 모델
화면 구성
핵심 로직
다국어 텍스트 전체 사전
색상·디자인 토큰 요약
엣지 케이스 및 불변식
재구현 체크리스트



## 1. 개요

### 1.1 목적
이메일·비밀번호로 로그인해 대시보드로 진입한다. 동시에 좌측 절반을 브랜드 히어로 패널로 써서 제품의 가치(누적 탄소·유류 절감량)를 숫자로 보여준다.

### 1.2 핵심 개념
좌우 2분할 레이아웃: 좌측은 브랜드·성과, 우측은 폼. 1024px 미만에서는 좌측이 통째로 사라지고 우측 폼만 전체 화면을 쓴다.
히어로 슬라이드쇼: 배경 사진 5장이 6초 간격으로 크로스페이드된다.
카운트업 통계: 누적 절감량 2종이 페이지 진입 시 0에서 목표값까지 1.8초간 애니메이션된다.
데모 계정 원클릭: 역할별 계정 4개를 버튼으로 제공하고, 클릭하면 이메일·비밀번호가 자동 입력된다(제출은 사용자가 직접).
레이아웃 없는 전체 화면: 이 화면은 (auth) 라우트 그룹에 있어 사이드바도 PageHeader도 없다.



## 2. 접근 권한
비로그인 상태에서 접근하는 유일한 화면이다. 경로는 /login.
(main) 그룹의 인증 가드가 비로그인 사용자를 이 화면으로 보낸다 (BOOTSTRAP.md 6.2장).
로그인 성공 시 /dashboard로 이동한다.

이미 로그인된 상태로 /login에 접근해도 리다이렉트하지 않는다(원본 그대로). 로그아웃 버튼이 명시적으로 이 화면으로 보내는 구조라 실무상 문제가 없다.



## 3. 데이터 모델

### 3.1 타입 정의
type UserRole = 'ADMIN' | 'LOGISTICS' | 'CAPTAIN' | 'CLIENT'

// 데모 계정 버튼용 — 화면이 직접 참조하는 유일한 데이터
interface DemoAccount {
  email: string
  password: string
  role: UserRole
  name: string
}

User 타입 전체와 MOCK_USERS는 이 화면이 직접 쓰지 않는다(AuthContext 내부에서만 사용). 정의는 BOOTSTRAP.md 7.3장에 있다.

### 3.2 재현용 샘플 데이터 — 데모 계정 4종
비밀번호는 4개 모두 demo 다.


| # | email | password | role | name |
| --- | --- | --- | --- | --- |
| 1 | admin@knotsofas.kr | demo | ADMIN | 관리자 |
| 2 | logistics1@knotsofas.kr | demo | LOGISTICS | 김물류 |
| 3 | captain1@knotsofas.kr | demo | CAPTAIN | 박선장 |
| 4 | client1@shipping.co.kr | demo | CLIENT | 화주A |


배열 순서가 곧 화면 표시 순서다(2×2 그리드에 좌→우, 위→아래). 역할 4종이 모두 한 번씩 등장하도록 구성되어 있으므로 그대로 사용한다. 특히 CLIENT 계정으로 로그인하면 사이드바에 메뉴가 1개만 보이므로, RBAC 데모용으로 유용하다.

### 3.3 재현용 샘플 데이터 — 히어로 통계
통계 2종은 함대 에코 랭킹 목업에서 집계한다(5.3장).

MOCK_FLEET_ECO_RANKING의 co2SavedTon 합계 = 3,559.5 ton
   852.8 + 1,104.2 + 612.5 + 588.3 + 401.7

연료 절감량 = 3,559.5 / 3.114 ≈ 1,143.1 ton

원본 데이터는 CARBON.md 3.2장에 있다. 탄소 화면을 만들지 않는다면 위 두 숫자를 상수로 박아 넣어도 무방하다.

### 3.4 히어로 이미지 5장
public/images/login/1.jpg ~ 5.jpg (경로 고정).

Track A — 반입한 public/images/login/ 5장을 그대로 배치하면 끝이다 (BOOTSTRAP.md 1.2장).
Track B — 이미지를 생략한다. 화면이 깨지는 것이 아니라 배경색(#0B192C)만 보인다. 오버레이와 텍스트 그림자가 이미 얹혀 있어 사진 없이도 읽을 수 있다. 여유가 생기면 해상·선박·항만 가로 사진 아무거나 5장을 채워 넣으면 된다(원본은 장당 200~530KB).

원본에는 이 이미지를 AI로 생성·교체하는 관리 기능이 있었으나 제거되었다. 현재는 정적 파일이다.



## 4. 화면 구성
최상위: min-h-screen flex bg-slate-50 dark:bg-slate-950.


| 패널 | 폭 | 표시 조건 |
| --- | --- | --- |
| 좌 — 히어로 | lg:w-1/2 | hidden lg:flex — 1024px 미만에서 완전히 숨김 |
| 우 — 로그인 폼 | flex-1 | 항상 |


### 4.1 페이지 셸
헤더·사이드바 없음. 페이지가 화면 전체를 차지한다.
우측 패널 배경: bg-[#f8f9ff] dark:bg-slate-950, 내부 여백 p-8, 콘텐츠는 가운데 정렬 (flex items-center justify-center)에 최대 폭 448px(max-w-md).

### 4.2 좌측 히어로 패널
컨테이너: hidden lg:flex lg:w-1/2 bg-[#0B192C] flex-col items-center justify-center p-12 relative overflow-hidden border-r border-white/10.

① 배경 슬라이드쇼 — 이미지 5장을 모두 동시에 렌더링하고 투명도로 전환한다.

각 이미지: fill 방식(부모를 꽉 채움), object-cover, sizes="50vw"
           transition-opacity duration-1000 ease-in-out
           현재 인덱스면 opacity-100, 아니면 opacity-0
첫 번째 이미지에만 priority (LCP 최적화)

DOM에서 넣고 빼지 않고 투명도만 바꾸는 것이 핵심이다. 그래야 크로스페이드가 매끄럽고 전환마다 이미지를 다시 로드하지 않는다.

② 가독성 오버레이 2겹(이미지 위, pointer-events-none)

1) 대각 그라디언트  bg-gradient-to-br
     from-[#0B192C]/55 → via-[#0B192C]/30 → to-[#0B192C]/65
2) 중앙 방사형      bg-[radial-gradient(ellipse_at_center,
                        rgba(11,25,44,0.45) 0%, rgba(11,25,44,0) 60%)]

③ 콘텐츠 블록(relative z-10 text-center)

폭을 w-[36rem](576px)로 고정한다(max-w-full과 함께).

고정 폭이 필수다. 카운트업 중 숫자 자릿수가 바뀔 때마다 통계 카드의 그리드 폭이 재계산되어 레이아웃이 흔들리는 문제가 있었다 (KNOWN_PITFALLS.md 4.1).

텍스트 그림자를 블록 전체에 건다(사진 위 가독성): [text-shadow:0_1px_4px_rgba(0,0,0,0.85),0_4px_18px_rgba(0,0,0,0.6)]

로고 행(가운데 정렬, 하단 여백 32px): 56×56px 인디고 rounded-2xl 박스 + Ship 아이콘(32px 흰색)

"KNOT SO FAST"(24px bold, tracking-tight, 흰색). 박스에 shadow-lg shadow-black/40.

타이틀: t.login.heroTitle(24px semibold 흰색, 하단 여백 16px, leading-tight)

부제: t.login.heroSub(14px, text-slate-200, max-w-sm mx-auto, leading-relaxed) — whitespace-pre-line으로 사전의 \n을 그대로 줄바꿈한다.

통계 3칸(위 여백 48px, grid grid-cols-3 gap-3)

각 칸: bg-black/35 backdrop-blur-sm rounded-xl px-2 py-4 border border-white/10 overflow-hidden


| # | 값 | 라벨 |
| --- | --- | --- |
| 1 | 카운트업 CO₂ → formatTonFixed() | 누적 탄소 절감량 |
| 2 | 카운트업 연료 → formatTonFixed() | 누적 유류 절감량 |
| 3 | 24/7(정적) | 실시간 모니터링 |


값: 20px bold, 색 #818cf8(밝은 인디고), tabular-nums whitespace-nowrap
라벨: 12px text-slate-200, 위 여백 4px

tabular-nums(고정폭 숫자)와 whitespace-nowrap이 4.2장 ③의 고정 폭과 함께 작동해야 카운트업 중 흔들림이 완전히 사라진다.

### 4.3 우측 상단 — 모바일 로고와 컨트롤
flex items-center justify-between mb-8 lg:mb-0

좌측(모바일 전용, lg:hidden): 36×36px 인디고 rounded-lg + Ship(20px) + "KNOT SO FAST"(16px bold)
우측(ml-auto, 항상 표시):
언어 토글: 회색 배경(bg-slate-100 dark:bg-slate-800 rounded-md p-0.5) 안에 KO/EN 알약 버튼. 선택된 쪽만 흰 배경 + shadow-sm.
테마 토글: 36×36px 버튼, 다크면 Sun 라이트면 Moon(16px).

BOOTSTRAP.md 8.3장의 PageHeader와 같은 컨트롤이지만 여기서는 직접 구현한다(이 화면은 PageHeader를 쓰지 않는다).

### 4.4 폼 헤더
제목: t.login.title(24px bold, 하단 여백 4px, mt-6 lg:mt-0)
부제: t.login.subtitle(14px 회색, 하단 여백 32px)

### 4.5 로그인 폼
<form onSubmit> + space-y-4.

입력 2종 — 공통 스타일: w-full px-4 py-2.5 border rounded-lg text-sm, 흰 배경(다크 slate-800), 포커스 시 인디고 2px 링 + focus:border-transparent.


| 필드 | type | 라벨 | placeholder | 필수 |
| --- | --- | --- | --- | --- |
| email | email | 이메일 | email@knotsofas.kr | ✅ required |
| password | password | 비밀번호 | •••••••• | ✅ required |


라벨은 14px font-medium, 하단 여백 6px.

검증은 브라우저 기본 required와 type="email"에만 의존한다. 자체 검증 로직이 없다.

에러 문구(조건부): 14px 빨강, 연빨강 배경 박스(bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg).

제출 버튼: 폭 100%, py-2.5, 인디고 배경(hover #4f46e5), 흰 텍스트 14px font-medium. 로딩 중이면 disabled + opacity-50 + 라벨이 t.login.loading으로 바뀐다.

### 4.6 데모 계정 블록
위 여백 32px.

구분선 행: 가로선 — "데모 계정 (비밀번호: demo)"(12px 회색) — 가로선 (flex items-center gap-2, 양쪽 선은 h-px flex-1 bg-slate-200)

계정 버튼 2×2(grid grid-cols-2 gap-2), 각 버튼 text-left px-3 py-2.5 rounded-lg border, 흰 배경(다크 slate-800), hover 시 border-[#6366f1]/60 bg-[#6366f1]/10.

버튼 내부(위→아래):

역할 배지 — 12px font-medium px-1.5 py-0.5 rounded, 역할별 색(7장)
이름 — 12px 회색, 위 여백 4px, truncate

버튼에는 이메일을 표시하지 않는다. 역할과 이름만 보여준다.



## 5. 핵심 로직

### 5.1 히어로 슬라이드쇼
HERO_IMAGES     = ['/images/login/1.jpg', ... , '/images/login/5.jpg']
HERO_INTERVAL_MS = 6000

useEffect(마운트 1회):
  id = setInterval(() => setHeroIndex(i => (i + 1) % HERO_IMAGES.length), 6000)
  cleanup: clearInterval(id)

함수형 업데이터(i => ...)를 써서 인터벌 콜백이 낡은 값을 붙잡지 않게 한다.
의존성 배열은 빈 배열이다. 이미지 배열이 상수이므로 재생성할 필요가 없다.

### 5.2 카운트업 애니메이션
useCountUp(target, durationMs = 1800) -> number
  value 상태를 0으로 시작

  useEffect([target, durationMs]):
    start = performance.now()
    tick(now):
      progress = min((now - start) / durationMs, 1)
      eased    = 1 - (1 - progress)⁴          # ★ quartic ease-out
      setValue(target × eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    raf = requestAnimationFrame(tick)
    cleanup: cancelAnimationFrame(raf)

4제곱 ease-out이라 초반에 빠르게 오르고 끝에서 부드럽게 멈춘다.
setInterval이 아니라 requestAnimationFrame 을 쓴다(프레임 동기화).
cleanup에서 반드시 cancelAnimationFrame 한다(언마운트 후 setState 방지).

표시 포맷: formatTonFixed(value, 1) — 소수 1자리 고정 + 천단위 콤마 +  ton 접미사.

formatTon이 아니라 formatTonFixed를 써야 한다. 자릿수가 고정되지 않으면 애니메이션 중 문자열 길이가 변해 레이아웃이 흔들린다(KNOWN_PITFALLS.md 4.1).

### 5.3 누적 절감량 집계
computeFleetSavings():
  totalCo2SavedTon  = Σ(MOCK_FLEET_ECO_RANKING의 co2SavedTon)      # = 3,559.5
  totalFuelSavedTon = totalCo2SavedTon / fuelEmissionFactor('HFO')  # = / 3.114 ≈ 1,143.1
  return { totalCo2SavedTon, totalFuelSavedTon }

CO₂에서 연료를 역산하는 구조다. 함대 랭킹 목업이 특정 항차·연료 종류에 묶여 있지 않아, 탄소 화면과 동일한 공식(CO₂ = 연료 × 배출계수)을 기본 연료(HFO, 3.114) 기준으로 뒤집어 쓴다.

### 5.4 로그인 처리
handleSubmit(e):
  e.preventDefault()
  loading = true;  error = ''
  ok = await login(email, password)          # AuthContext — BOOTSTRAP 7.3장
  if (ok) router.push('/dashboard')
  else  { error = t.login.error;  loading = false }

성공 시 loading을 되돌리지 않는다. 곧바로 화면을 벗어나므로 버튼이 비활성 상태로 남아 있는 편이 중복 제출을 막는다. 실패했을 때만 false로 되돌린다.

login()의 판정 규칙(참고 — 구현은 AuthContext에 있다):

DEMO_ACCOUNTS에서 email + password가 모두 일치하는 계정을 찾는다 → 없으면 false
MOCK_USERS에서 같은 email의 User를 찾는다               → 없으면 false
localStorage['ksf_user']에 저장 + 'ksf-auth-change' 이벤트 발행 → true

### 5.5 데모 계정 자동 입력
fillDemo(account):
  email    = account.email
  password = account.password
  error    = ''            # ★ 이전 에러 메시지도 함께 지운다

제출은 하지 않는다. 값만 채우고 사용자가 로그인 버튼을 누르게 한다.



## 6. 다국어 텍스트 전체 사전
t.login.*


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 로그인 | Sign In |
| subtitle | 계정에 로그인하여 시스템을 이용하세요. | Sign in to access the platform. |
| email | 이메일 | Email |
| password | 비밀번호 | Password |
| emailPlaceholder | email@knotsofas.kr | email@knotsofas.kr |
| submit | 로그인 | Sign In |
| loading | 로그인 중... | Signing in... |
| error | 이메일 또는 비밀번호가 올바르지 않습니다. | Invalid email or password. |
| demoLabel | 데모 계정 (비밀번호: demo) | Demo accounts (password: demo) |
| heroTitle | 해상 물류 최적화 플랫폼 | Maritime Logistics Optimization |
| heroSub | AI 기반 에코스피드 권장으로 연료 소모를 최소화하고\n탄소 배출량을 실시간으로 모니터링합니다. | Minimize fuel consumption with AI-powered\neco-speed recommendations and real-time carbon monitoring. |
| stat1Label | 누적 탄소 절감량 | Total CO₂ Saved |
| stat2Label | 누적 유류 절감량 | Total Fuel Saved |
| stat3Value | 24/7 | 24/7 |
| stat3Label | 실시간 모니터링 | Live Monitoring |


heroSub의 \n은 실제 줄바꿈 문자다. whitespace-pre-line으로 렌더링해야 두 줄로 보인다.

t.role.* (데모 계정 배지)


| 키 | 한국어 | English |
| --- | --- | --- |
| ADMIN | 시스템 관리자 | Admin |
| LOGISTICS | 물류 담당자 | Logistics |
| CAPTAIN | 선장·선원 | Captain |
| CLIENT | 화주 | Client |


브랜드명 "KNOT SO FAST"는 번역하지 않는다(양쪽 언어 공통, 사전을 거치지 않는 고정 문자열).



## 7. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 — 로고 박스, 제출 버튼, 포커스 링, 데모 버튼 hover. 버튼 hover는 #4f46e5.

히어로 패널 배경: #0B192C(Deep Ocean) — 사이드바 다크 모드와 같은 색.

히어로 통계 값 색: #818cf8(인디고 400 — 어두운 배경에서 #6366f1보다 잘 읽힌다).

역할 배지 색:


| role | 클래스 |
| --- | --- |
| ADMIN | bg-purple-100 text-purple-700 (다크 bg-purple-900/40 text-purple-300) |
| LOGISTICS | bg-[#6366f1]/15 text-[#6366f1] (다크 bg-[#6366f1]/20) |
| CAPTAIN | bg-green-100 text-green-700 (다크 bg-green-900/40 text-green-300) |
| CLIENT | bg-orange-100 text-orange-700 (다크 bg-orange-900/40 text-orange-300) |


우측 패널 배경: #f8f9ff(Surface) / 다크 slate-950

타이포: 히어로 로고 24px bold / 히어로 타이틀 24px semibold / 히어로 부제 14px / 통계 값 20px bold / 폼 제목 24px bold / 라벨·입력 14px / 데모 배지·이름 12px.

유리 효과: 통계 카드 bg-black/35 backdrop-blur-sm border border-white/10.

아이콘 세트: lucide-react — Ship, Sun, Moon (단 3개).

다크 모드: 우측 패널만 다크 대응이 필요하다. 좌측 히어로 패널은 항상 어두운 색이라 dark: variant가 없다.



## 8. 엣지 케이스 및 불변식
히어로 콘텐츠 블록은 폭 고정(w-[36rem])이 필수다. 없으면 카운트업 중 통계 카드 폭이 매 프레임 재계산되어 레이아웃이 흔들린다(KNOWN_PITFALLS.md 4.1).
formatTonFixed로 소수 자릿수를 고정한다. formatTon을 쓰면 문자열 길이가 변한다.
통계 값에 tabular-nums whitespace-nowrap 을 함께 준다. 1·2번과 3종 세트다.
큰 숫자가 카드 폭을 넘지 않는지 확인한다. 3,559.5 ton이 3칸 그리드에 들어가야 하며, 원본에서 폰트·패딩·gap을 조정해 해결한 이력이 있다 (KNOWN_PITFALLS.md 4.2).
슬라이드 이미지는 DOM에서 넣고 빼지 않는다. 5장을 모두 렌더링하고 opacity만 전환한다.
인터벌은 함수형 업데이터를 쓰고 cleanup에서 해제한다.
requestAnimationFrame은 cleanup에서 cancelAnimationFrame 한다. 언마운트 후 setState가 일어나면 경고가 뜬다.
로그인 성공 시 loading을 false로 되돌리지 않는다(5.4장).
데모 계정 클릭은 값만 채우고 제출하지 않는다. 이전 에러 메시지는 함께 지운다.
하이드레이션 불일치 주의. 이 화면은 AuthContext·ThemeContext를 함께 쓰므로 두 Context가 모두 BOOTSTRAP.md 7장의 패턴(기본값 시작 → effect 동기화 / useSyncExternalStore)을 지켜야 한다. 원본에서 이 화면에서만 두 번 재발한 문제다 (KNOWN_PITFALLS.md 1.1).
1024px 미만에서 좌측 패널이 완전히 사라진다(hidden). 숨김이 아니라 미렌더링이므로 이미지도 로드되지 않는다 — 모바일 성능에 유리하다.
모바일에서만 우측 상단에 로고가 나타난다(lg:hidden). 데스크톱에서는 좌측 히어로에 이미 로고가 있기 때문이다.
히어로 이미지가 없어도 화면은 동작한다(3.4장). 배경색과 오버레이만 보인다.
좌측 패널에는 dark: variant가 없다. 항상 어두운 톤이다.
폼 검증은 브라우저 기본 기능에만 의존한다. 자체 이메일 형식 검사 로직을 넣지 않는다.



## 9. 재구현 체크리스트
(auth)/login 라우트 생성(레이아웃 없음 — 사이드바·PageHeader 미사용)
데모 계정 4종 상수 입력
좌우 2분할 레이아웃 + hidden lg:flex(좌측)
히어로 이미지 5장 배치(public/images/login/1~5.jpg) — 없으면 생략 가능
슬라이드쇼(6초 인터벌, 전체 렌더링 + opacity 크로스페이드 1초)
가독성 오버레이 2겹(대각 그라디언트 + 중앙 방사형)
히어로 콘텐츠 — w-[36rem] 고정 폭 + 텍스트 그림자
로고 행(56px 인디고 박스 + Ship + 브랜드명)
히어로 타이틀 + 부제(whitespace-pre-line)
useCountUp 훅(rAF + 4제곱 ease-out + 1800ms + cleanup)
누적 절감량 집계(computeFleetSavings) — CO₂ 합계 → 연료 역산
통계 3칸(카운트업 2 + 24/7 정적, formatTonFixed + tabular-nums)
우측 상단 컨트롤(모바일 로고 + 언어 토글 + 테마 토글)
폼 헤더(제목 + 부제)
이메일·비밀번호 입력(required, 포커스 링) + 에러 박스 + 제출 버튼(로딩 상태)
handleSubmit — 성공 시 /dashboard, 실패 시 에러 + 로딩 해제
데모 계정 블록(구분선 + 2×2 버튼 + 역할 배지 색 4종 + 자동 입력)
다국어(ko/en) 전체 적용
다크 모드 대응(우측 패널만)


# 부트스트랩 — 0→1 세팅 명세서 (Project Bootstrap)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트를 빈 폴더에서 시작해, 개별 기능 스펙(SCHEDULE.md, VESSEL.md 등)을 구현할 수 있는 공통 셸 상태까지 만드는 절차를 정의한다. 기능 화면은 이 문서의 범위가 아니다 — 이 문서가 끝나는 지점은 "로그인해서 빈 페이지가 사이드바와 함께 뜨는 상태"다.
사용 순서: 이 문서를 가장 먼저, 한 사람이 단독으로 끝낸다. 완료 후 나머지 인원이 각자 기능 스펙을 병렬로 구현한다.

해커톤 원칙: 1~8장은 Must다. 9장(데이터 계층)은 mock 전용으로 갈지 DB까지 쓸지에 따라 갈리며, 기본 권장은 mock 전용이다. mock으로 먼저 만든 뒤 나중에 SWR·Prisma로 올리는 경로는 9.4장에 정리되어 있으므로, 처음부터 백엔드를 붙일지 고민하느라 시간을 쓰지 말 것. 11장(알려진 함정)은 구현 중 막혔을 때 찾아보는 참조용이다.



## 목차
사전 준비
프로젝트 생성 및 버전 고정
설정 파일
디렉터리 구조
전역 스타일 및 디자인 토큰
앱 셸 — 레이아웃과 Provider
전역 Context 3종
공통 컴포넌트
데이터 계층 (선택)
실행 및 검증
알려진 함정
부트스트랩 체크리스트



## 1. 사전 준비

| 항목 | 값 | 비고 |
| --- | --- | --- |
| Node.js | 20 이상 (원본 개발 환경은 24.x) | node -v로 확인 |
| 패키지 매니저 | npm | 원본이 package-lock.json 기준 |
| 에디터 | 무관 |  |


### 1.1 당일 반입물
반입 번들은 폴더 하나(ksf-kit/)로 들고 온다. 안은 성격이 다른 두 덩어리로 나뉜다.

ksf-kit/
├── specs/                   ← 읽는 것. 문서 20개
└── project-files/           ← 복사하는 것. 프로젝트 구조를 그대로 미러링
    ├── src/
    │   └── mocks/           샘플 데이터 .ts 10개 + 항로 JSON 2개
    ├── public/              히어로 이미지 5장, 한글 폰트 TTF
    └── scripts/             generate_routes.py

project-files/ 안이 프로젝트 구조와 똑같은 것이 핵심이다. 덕분에 배치가 명령 한 줄로 끝나고 "이 폴더를 어디에 둘지" 판단할 일이 없다(1.3장).

mocks/를 specs/ 하위에 두지 않는다. 성격이 달라서다 — specs/를 통째로 복사했을 때 데이터가 엉뚱한 위치로 딸려 들어가는 사고를 막는다.

specs/ 문서 20개 — 아래가 전부다.


| 문서 | 역할 |
| --- | --- |
| README.md | 가장 먼저 읽는다 — 당일 작업 순서와 문서 지도 |
| BOOTSTRAP_PROMPTS.md | 이 문서를 실행하기 위한 복붙용 프롬프트 8개 |
| 화면별 *_PROMPTS.md | 2단계 실행용 프롬프트 (화면당 1개, 총 8개) |
| BOOTSTRAP.md | 이 문서 — 0→1 세팅. 한 사람이 단독으로 |
| KNOWN_PITFALLS.md | 함정 38건 — 막혔을 때 증상으로 검색 |
| DASHBOARD.md · SCHEDULE.md · VESSEL.md | 화면 스펙 |
| AI_REPORT.md · CARBON.md · SIMULATION.md | 〃 |
| AUTH_LOGIN.md · ADMIN_USERS.md | 〃 |


docs/DESIGN_GUIDE.md는 반입하지 않아도 된다. 각 스펙에 "색상·디자인 토큰 요약" 장이 있어 내용이 중복된다.

### 1.2 Track A vs Track B

|  | Track A — 4개 폴더 반입 | Track B — specs/ 만 |
| --- | --- | --- |
| 샘플 데이터 | mocks/*.ts를 src/mocks/에 그대로 복사 | 각 스펙의 "재현용 샘플 데이터" 표를 보고 .ts로 작성 |
| 항로 좌표 | routes.json · port-pairs.json 그대로 사용 | SCHEDULE.md 6.3장의 haversine × 1.25 폴백 |
| 타사 선단 34척 | otherFleet.ts 그대로 사용 | 생략(DASHBOARD.md 3.7장) |
| 항구 혼잡도 | port-congestion.ts 12곳 | AI_REPORT.md 3.2장의 5곳 |
| 로그인 히어로 이미지 | public/images/login/*.jpg 5장 | 생략 — 배경색만으로도 동작 |
| PDF 한글 폰트 | public/fonts/NotoSansKR-Regular.ttf | AI 리포트 PDF를 영문 전용으로 |
| 추가 소요 | 0분 | 30~60분 (데이터 작성·검증) |


Track B에서도 기능은 전부 완결된다. 항로가 직선으로 보이고 배경 선박이 없어 지도가 다소 한산해지는 정도이며, 계산·인터랙션·화면 구성은 100% 동일하다.

스펙의 "재현용 샘플 데이터" 표는 Track A에서도 버리지 말 것 — 반입한 파일이 표와 일치하는지 대조하는 검증 자료로 쓴다. 특히 VESSEL.md 3.2장의 연료 커브와 SCHEDULE.md 3.4장의 항차 표가 여러 화면의 계산 기준이라 중요하다.

### 1.3 Track A — 반입 파일 배치
ksf-kit/은 프로젝트 안이 아니라 옆에 둔다 — 프로젝트를 만드는 시점에는 프로젝트가 아직 없어 명세를 ksf-kit/specs/에서 읽어야 하고, 안에 두면 src/mocks·public이 5MB 중복되며 tsconfig가 사본까지 타입 검사한다.

복사는 두 번, 시점이 다르다.

# ① 프로젝트 생성 직후 — 명세를 먼저 들여온다
New-Item -ItemType Directory -Force docs | Out-Null
Copy-Item -Recurse -Force ..\ksf-kit\specs docs\

# ③ 타입·상수를 만든 뒤 — 샘플 데이터와 자산
Copy-Item -Recurse -Force ..\ksf-kit\project-files\* .

# ① 프로젝트 생성 직후
mkdir -p docs && cp -r ../ksf-kit/specs docs/

# ③ 타입·상수를 만든 뒤
cp -r ../ksf-kit/project-files/* .

최종 배치 결과

knot-so-fast/
├── docs/specs/     ← 반입한 문서 20개
├── src/mocks/      ← project-files에서 복사됨
├── public/         ← 〃 (기본 svg와 병합됨 — 충돌 없음)
└── scripts/        ← 〃

문서를 프로젝트 밖에 두지 말 것. 안에 있어야 에디터에서 바로 열리고 전체 검색이 되며, 무엇보다 LLM에게 docs/specs/VESSEL.md 보고 만들어줘처럼 경로로 지시할 수 있다. 당일에는 이 차이가 크다.

복사 시점 주의 — mocks/*.ts는 @/shared/types와 @/shared/constants를 import한다. 4장의 타입·상수를 먼저 만든 뒤 복사해야 컴파일이 통과한다.

프로젝트 생성  →  specs 복사  →  타입·상수 작성  →  project-files 복사  →  나머지 셸 구축

먼저 복사해도 파일 자체는 멀쩡하고 타입 에러만 뜨다가 나중에 해소되지만, 빨간 줄을 보며 작업하면 진짜 오류를 놓치기 쉽다.

generate_routes.py는 당일에 실행할 일이 거의 없다. 이미 계산된 JSON 2개가 함께 오기 때문이다. 항구를 새로 추가하는 경우에만 pip install searoute 후 재생성한다(435개 조합 계산에 수 분 소요).



## 2. 프로젝트 생성 및 버전 고정

### 2.1 리포지터리 구조 결정
원본은 apps/web 아래에 앱이 있는 모노레포다. 하지만 해커톤 당일에는 모노레포를 쓰지 말 것을 강력히 권장한다 — 얻는 것이 없고, 실행 디렉터리 혼동으로 시간을 잃는다(11.1장).

knot-so-fast/          ← 저장소 루트가 곧 앱 루트
├── src/
├── package.json
└── next.config.ts

모노레포를 그대로 재현하려면 apps/web/을 앱 루트로 두되, 루트에는 package.json도 package-lock.json도 만들지 않는다.

### 2.2 프로젝트 생성
npx create-next-app@latest knot-so-fast \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd knot-so-fast

번들러는 Turbopack(Next 16 기본값)을 그대로 쓴다. 원본도 Turbopack으로 동작하며, 실행 시 배너에 ▲ Next.js 16.2.10 (Turbopack)이 찍히는 것이 정상이다. 끄지 말 것.

@latest의 위험: 당일 최신 버전이 원본(Next 16.2.10)과 다르면 이 문서의 설정이 안 맞을 수 있다. 생성 직후 반드시 2.3장대로 버전을 맞춘다. 확실하게 가려면 처음부터 npx create-next-app@16.2.10으로 고정한다.

### 2.3 의존성 버전 고정
생성된 package.json의 의존성 블록을 아래 값으로 덮어쓴 뒤 npm install을 실행한다.

dependencies


| 패키지 | 버전 | 용도 |
| --- | --- | --- |
| next | 16.2.10 | 프레임워크 (정확히 고정) |
| react | 19.2.4 | (정확히 고정) |
| react-dom | 19.2.4 | (정확히 고정) |
| lucide-react | ^1.25.0 | 아이콘 — 전 화면 필수 |
| clsx | ^2.1.1 | 조건부 className |
| tailwind-merge | ^3.6.0 | Tailwind 클래스 충돌 병합 |
| date-fns | ^4.4.0 | 날짜 유틸 |
| echarts | ^6.1.0 | 차트 — 선박/탄소/시뮬레이션 화면 |
| echarts-for-react | ^3.0.6 | ECharts React 래퍼 |
| leaflet | ^1.9.4 | 지도 — 대시보드 전용 |
| react-leaflet | ^5.0.0 | Leaflet React 래퍼 |
| @types/leaflet | ^1.9.21 |  |
| swr | ^2.5.0 | 데이터 페칭 (9장을 쓸 때만) |
| jspdf | ^4.2.1 | PDF 내보내기 (AI 리포트 전용) |
| @google/genai | ^2.15.0 | Gemini (AI 리포트 전용) |
| @prisma/client | ^7.9.1 | DB (9장 방식 B에서만) |
| @prisma/adapter-pg | ^7.9.1 | 〃 |
| prisma | ^7.9.1 | 〃 |
| ws / @types/ws | ^8.21.1 / ^8.18.1 | 〃 (Prisma 어댑터 의존) |


devDependencies


| 패키지 | 버전 |
| --- | --- |
| typescript | ^5 |
| @types/node | ^20 |
| @types/react / @types/react-dom | ^19 |
| tailwindcss | ^4 |
| @tailwindcss/postcss | ^4 |
| eslint | ^9 |
| eslint-config-next | 16.2.10 |
| tsx | ^4.23.7 (시드 스크립트용) |
| dotenv | ^17.4.2 (시드 스크립트용) |


mock 전용으로 갈 때의 최소 세트(권장) — 아래만 설치하면 SCHEDULE·VESSEL 화면을 완성할 수 있다:

npm i lucide-react clsx tailwind-merge date-fns echarts echarts-for-react

scripts

{ "dev": "next dev", "build": "next build", "start": "next start", "lint": "eslint" }

DB를 쓸 때만 "postinstall": "prisma generate"를 추가한다. 이 스크립트를 넣어두면 Docker 빌드에서 스키마 파일을 못 찾아 실패하는 함정이 있으니(11.9장) 필요할 때만 넣는다.



## 3. 설정 파일

### 3.1 next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: 'standalone',     // Docker 배포용 — 로컬 개발만 할 거면 없어도 됨
  devIndicators: false,     // 개발 중 좌하단 오버레이 배지 숨김
}

export default nextConfig

모노레포로 갈 경우, 루트에 lockfile이 생겨 워크스페이스 루트 경고가 뜨면 turbopack: { root: __dirname }을 추가해 억제한다(11.1장).

### 3.2 tsconfig.json — 핵심 설정만

| 옵션 | 값 | 이유 |
| --- | --- | --- |
| strict | true |  |
| paths | { "@/*": ["./src/*"] } | 필수 — 모든 스펙이 @/shared/... 형태 경로를 전제 |
| resolveJsonModule | true | 필수 — 항로 데이터를 JSON으로 import |
| moduleResolution | "bundler" |  |
| jsx | "react-jsx" |  |
| target | "ES2017" |  |


include에 .next/types/**/*.ts와 .next/dev/types/**/*.ts를 포함시킨다(Next가 생성하는 라우트 타입).

### 3.3 postcss.config.mjs
const config = { plugins: { "@tailwindcss/postcss": {} } }
export default config

Tailwind v4는 v3와 설정 방식이 완전히 다르다. tailwind.config.js가 없어도 되고, PostCSS 플러그인 이름도 tailwindcss가 아니라 @tailwindcss/postcss다.

### 3.4 eslint.config.mjs
flat config를 사용한다. eslint-config-next/core-web-vitals와 eslint-config-next/typescript를 전개한 뒤, globalIgnores로 .next/**, out/**, build/**, next-env.d.ts를 무시한다.

### 3.5 .gitignore — 놓치기 쉬운 두 줄
node_modules/
.next/
.env
.env.local
.env*.local
!.env.example          # ★ 아래 주의 참고
*.pem
*.key

주의: .env* 패턴을 쓰면 팀에 공유해야 할 .env.example까지 git에서 사라진다. 원본에서 실제로 발생했던 문제이니 !.env.example 예외를 반드시 넣는다.



## 4. 디렉터리 구조
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 — 폰트·Provider 중첩 (6.1장)
│   ├── page.tsx                # /  → /dashboard 리다이렉트
│   ├── globals.css             # 전역 스타일·디자인 토큰 (5장)
│   ├── (auth)/
│   │   └── login/page.tsx      # 로그인 화면 (별도 스펙)
│   ├── (main)/
│   │   ├── layout.tsx          # 인증 가드 + 사이드바 셸 (6.2장)
│   │   ├── dashboard/page.tsx
│   │   ├── schedule/page.tsx   # ← SCHEDULE.md
│   │   ├── vessel/page.tsx     # ← VESSEL.md
│   │   ├── ai-report/page.tsx
│   │   ├── carbon/page.tsx
│   │   ├── simulation/page.tsx
│   │   └── admin/users/page.tsx
│   └── api/                    # Route Handler (9장 방식 B에서만)
├── features/                   # 화면(도메인)별 컴포넌트·로직
│   ├── auth/AuthContext.tsx
│   ├── theme/ThemeContext.tsx
│   ├── i18n/{LanguageContext.tsx, translations.ts}
│   ├── schedule/{VoyageRegisterModal, ScheduleCalendar}.tsx
│   ├── vessel/VesselRegisterModal.tsx
│   └── dashboard/, ai-report/, ...
├── shared/                     # 도메인 무관 공용
│   ├── components/{Sidebar, PageHeader, StatusBadge}.tsx
│   ├── hooks/
│   ├── types/                  # 도메인별 타입 파일 + index.ts 재수출
│   ├── utils/{cn, format, port}.ts
│   └── constants.ts
└── mocks/                      # 샘플 데이터
    ├── {vessels,voyages,positions,users,reports,carbon,ports}.ts
    ├── {map-overlays,port-congestion,otherFleet}.ts
    └── {routes,port-pairs}.json    # 사전 계산 항로 (Track A에서만)

Track A라면 mocks/는 반입 파일을 그대로 복사하면 끝난다(1.3장). Track B라면 각 기능 스펙의 "재현용 샘플 데이터" 장을 보고 직접 작성한다.

배치 원칙: 한 화면에서만 쓰이면 features/{화면}/, 두 화면 이상이 공유하면 shared/. 타입은 도메인별 파일(vessel.ts, voyage.ts …)로 나누고 types/index.ts에서 한 번에 재수출해 import type { Vessel, Voyage } from '@/shared/types'로 쓸 수 있게 한다.



## 5. 전역 스타일 및 디자인 토큰
src/app/globals.css에 아래 순서로 작성한다.

### 5.1 Tailwind v4 임포트와 다크 모드 변형
@import "tailwindcss";

/* 클래스 기반 다크 모드 (Tailwind v4) */
@variant dark (&:where(.dark, .dark *));

v4 최대 함정: v3의 darkMode: 'class' 설정은 v4에 존재하지 않는다. 위 @variant 한 줄이 없으면 dark: 접두 클래스가 OS 설정만 따라가고 토글 버튼이 전혀 동작하지 않는다.

### 5.2 CSS 변수 (브랜드 팔레트)
:root {
  --bg: #f8f9ff;                    /* 페이지 배경 (라이트) */
  --fg: #0f172a;
  --color-brand-primary: #6366f1;   /* Indigo — 전역 강조색 */
  --color-brand-indigo:  #6366f1;
  --color-brand-eco:     #10B981;   /* 성공·절감 */
  --color-brand-amber:   #F59E0B;   /* 경고·지연 */
  --color-brand-red:     #EF4444;   /* 위험·오류 */
}

.dark {
  --bg: #020817;
  --fg: #f1f5f9;
}

@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--fg);
  --font-sans: var(--font-plus-jakarta-sans);
  --font-mono: ui-monospace, monospace;
}

전체 팔레트와 사용 규칙은 docs/DESIGN_GUIDE.md 2장 참조. 핵심만 옮기면:


| 역할 | HEX | 용도 |
| --- | --- | --- |
| Primary | #6366f1 | 활성 버튼·강조·포커스 링 |
| Primary Hover | #4f46e5 | 버튼 hover |
| Surface | #f8f9ff | 페이지 배경(라이트) |
| Sidebar Dark | #0B192C | 사이드바 배경(다크) |
| Success | #10B981 | 정상 운항·절감 |
| Warning | #F59E0B | 지연·주의·노후 경고 |
| Danger | #EF4444 | 위험·오류 |


### 5.3 기본 요소
html { background: var(--bg); }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

### 5.4 스크롤바 (전역 통일)
폭 6px, 트랙 투명, thumb #cbd5e1(다크 #334155), border-radius: 3px.

### 5.5 Leaflet 전용 (대시보드를 만들 때만)
.leaflet-container { width: 100%; height: 100%; z-index: 1; }
.leaflet-popup-content-wrapper { border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }

고위험 마커 강조용 펄스 애니메이션(map-marker-pulse, 1.3s 무한, scale 1→1.18, opacity 1→0.55)도 여기 둔다.



## 6. 앱 셸 — 레이아웃과 Provider

### 6.1 루트 레이아웃 (src/app/layout.tsx)
서버 컴포넌트다. 'use client'를 붙이지 않는다.

폰트: next/font/google의 Plus Jakarta Sans, subsets: ['latin'], variable: '--font-plus-jakarta-sans'. 이 variable 클래스를 <html>에 붙여야 5.2의 --font-sans가 실제로 연결된다.

metadata: title KNOT SO FAST — 해상 물류 최적화 플랫폼, description AI 기반 에코스피드 권장 및 탄소 배출 관리 시스템

<html lang="ko" className="{폰트variable} h-full" suppressHydrationWarning>, <body className="h-full antialiased">

suppressHydrationWarning은 테마 클래스(dark)를 클라이언트에서 붙이기 때문에 필요하다.

Provider 중첩 순서 (바깥 → 안쪽):

SWRProvider          (9장 방식 B에서만)
  └ LanguageProvider
      └ ThemeProvider
          └ AuthProvider
              └ {children}

순서가 중요한 이유: AuthProvider가 로그아웃 시 SWR 캐시를 비우므로 SWRProvider 안쪽에 있어야 한다. mock 전용이면 SWRProvider를 빼고 나머지 3개만 둔다.

### 6.2 메인 레이아웃 (src/app/(main)/layout.tsx)
클라이언트 컴포넌트('use client'). 인증 가드 + 사이드바 셸 역할.

const { user, loading } = useAuth()

useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

if (loading) → 전체 화면 가운데에 인디고 스피너
                 (24px 원, border-2, border-t-transparent, animate-spin)
if (!user)   → null 반환 (리다이렉트 대기)

정상 →
  <div className="flex h-screen overflow-hidden bg-[#f8f9ff] dark:bg-slate-950">
    <Sidebar />
    <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
  </div>

pt-14 lg:pt-0의 의미: 모바일에서는 사이드바가 상단 고정 헤더(높이 56px)로 바뀌므로 본문을 그만큼 밀어준다. 데스크톱에서는 사이드바가 좌측에 있으므로 패딩이 필요 없다.

### 6.3 루트 페이지 (src/app/page.tsx)
import { redirect } from 'next/navigation'
export default function RootPage() { redirect('/dashboard') }

### 6.4 라우트 그룹

| 그룹 | 경로 | 레이아웃 |
| --- | --- | --- |
| (auth) | /login | 없음(전체 화면) |
| (main) | 나머지 전부 | 6.2의 인증 가드 + 사이드바 |


괄호 그룹은 URL에 나타나지 않는다 — (main)/schedule/page.tsx → /schedule.



## 7. 전역 Context 3종

### 7.1 ThemeContext (features/theme/ThemeContext.tsx)
값: { theme: 'light' | 'dark', toggle: () => void }
저장소 키: 'ksf-theme'

초기화 규칙(하이드레이션 안전)

useState<Theme>('light')                    # ★ 항상 'light'로 시작

useEffect(마운트 1회):
  saved       = localStorage.getItem('ksf-theme')
  prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
  initial     = saved ?? (prefersDark ? 'dark' : 'light')
  if (initial !== 'light') setTheme(initial)

useEffect([theme]):
  document.documentElement.classList.toggle('dark', theme === 'dark')

toggle(): 반대 값으로 바꾸고 localStorage에 저장

useState의 초기화 함수에서 localStorage를 읽으면 안 된다. 서버에는 localStorage가 없어 서버 렌더와 클라이언트 첫 렌더 결과가 달라지고 하이드레이션 불일치가 발생한다. 반드시 'light'로 시작해 effect에서 1회 동기화한다.

### 7.2 LanguageContext (features/i18n/LanguageContext.tsx)
값: { lang: 'ko' | 'en', setLang: (l) => void, t: Translations }
기본값: 'ko'

translations = { ko, en } 객체를 두고 t = translations[lang]으로 노출한다.
타입은 type Translations = typeof ko로 두고 const en: typeof ko = { ... }로 선언하면, 영문 사전에 키가 빠졌을 때 컴파일 에러로 잡힌다. 이 패턴을 그대로 쓸 것.
사전 값은 문자열뿐 아니라 함수(moreEvents: (n: string) => \+${n}건 더보기`)와 **배열**(weekdays: ['일','월',...]`)도 가진다.
localStorage에 저장하지 않는다 — 새로고침하면 항상 한국어로 돌아간다(원본 동작).

사전 구조(최상위 키): nav, common, status, role, dashboard, schedule, vessel, aiReport, carbon, simulation, users, modal, login. 각 화면 스펙의 "다국어 텍스트 전체 사전" 장에서 자기 몫을 가져와 채운다.

공용 사전(모든 화면이 참조)


| 키 | 한국어 | English |
| --- | --- | --- |
| nav.dashboard | 실시간 운항 대시보드 | Live Operations Dashboard |
| nav.aiReport | AI 운항 리포트 | AI Operations Report |
| nav.carbon | 탄소 배출 리포트 | Carbon Emissions Report |
| nav.simulation | 물류 시뮬레이션 | Logistics Simulation |
| nav.schedule | 물류 일정 관리 | Logistics Schedule |
| nav.vessel | 선박 관리 | Fleet Management |
| nav.users | 사용자 관리 | User Management |
| nav.collapse | 접기 | Collapse |
| common.all | 전체 | All |
| common.search | 검색 | Search |
| common.cancel | 취소 | Cancel |
| common.save | 저장 | Save |
| common.loading | 불러오는 중... | Loading... |
| common.noResults | 검색 결과가 없습니다. | No results found. |
| common.error | 오류 | Error |
| common.demo | Demo | Demo |
| status.preparing | 준비 중 | Preparing |
| status.underway | 운항 중 | Underway |
| status.delayed | 지연 | Delayed |
| status.completed | 완료 | Completed |
| status.cancelled | 취소 | Cancelled |
| status.active | 운항 가능 | Available |
| status.maintenance | 정비 중 | Maintenance |
| status.idle | 대기 중 | Idle |
| status.high | 위험 | High |
| status.medium | 주의 | Medium |
| status.low | 정보 | Info |
| status.enabled | 활성 | Active |
| status.disabled | 비활성 | Inactive |
| role.ADMIN | 시스템 관리자 | System Admin |
| role.LOGISTICS | 물류 담당자 | Logistics Manager |
| role.CAPTAIN | 선장·선원 | Captain / Crew |


### 7.3 AuthContext (features/auth/AuthContext.tsx)
type UserRole = 'ADMIN' | 'LOGISTICS' | 'CAPTAIN' | 'CLIENT'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  assignedVesselIds?: string[]
  department?: string
  active: boolean
}

값: { user: User | null, loading: boolean,
      login(email, password): Promise<boolean>, logout(): void,
      hasRole(...roles): boolean }
저장소 키: 'ksf_user'

상태 구독 방식 — useState + effect가 아니라 useSyncExternalStore 를 쓴다.

subscribe(cb):
  window.addEventListener('storage', cb)          # 다른 탭의 변경
  window.addEventListener('ksf-auth-change', cb)  # 같은 탭의 로그인/로그아웃
  → 해제 함수 반환

getSnapshot()       = localStorage에서 읽어 파싱한 User | null
getServerSnapshot() = null                        # SSR에서는 항상 비로그인

login(email, password):
  DEMO_ACCOUNTS에서 email+password 일치 계정 탐색 → 없으면 false
  MOCK_USERS에서 같은 email의 User 탐색 → 없으면 false
  localStorage에 저장 후 'ksf-auth-change' 이벤트 발행 → true

logout():
  localStorage에서 사용자 제거
  (SWR 사용 시) 영속 캐시 키와 인메모리 캐시도 함께 비움
  'ksf-auth-change' 이벤트 발행

참조 안정화(필수): localStorage의 원본 문자열이 그대로인데 매번 새 객체를 반환하면 useSyncExternalStore가 "getSnapshot이 매번 다른 값을 반환한다"며 무한 리렌더 경고를 낸다. 모듈 스코프에 cachedRaw/cachedUser를 두고, 원본 문자열이 같으면 이전 파싱 결과를 재사용한다.

loading은 항상 false 다(useSyncExternalStore가 동기적으로 값을 주므로). 6.2의 로딩 분기는 실질적으로 실행되지 않지만, 나중에 실제 인증으로 교체할 때를 위해 인터페이스는 유지한다.

데모 계정 4종 (비밀번호는 전부 demo)


| email | role | 이름 |
| --- | --- | --- |
| admin@knotsofas.kr | ADMIN | 관리자 |
| logistics1@knotsofas.kr | LOGISTICS | 김물류 |
| captain1@knotsofas.kr | CAPTAIN | 박선장 |
| client1@shipping.co.kr | CLIENT | 화주A |


전체 사용자 7명 (사용자 관리 화면에서도 사용)


| id | name | email | role | department | assignedVesselIds | active |
| --- | --- | --- | --- | --- | --- | --- |
| u001 | 관리자 | admin@knotsofas.kr | ADMIN | 시스템 관리팀 | — | ✅ |
| u002 | 김물류 | logistics1@knotsofas.kr | LOGISTICS | 물류기획팀 | — | ✅ |
| u003 | 이담당 | logistics2@knotsofas.kr | LOGISTICS | 물류기획팀 | — | ✅ |
| u004 | 박선장 | captain1@knotsofas.kr | CAPTAIN | 운항팀 | v001 | ✅ |
| u005 | 최선장 | captain2@knotsofas.kr | CAPTAIN | 운항팀 | v002 | ✅ |
| u006 | 정선장 | captain3@knotsofas.kr | CAPTAIN | 운항팀 | v003, v004 | ❌ |
| u007 | 화주A | client1@shipping.co.kr | CLIENT | 외부 화주 | — | ✅ |


u006만 active: false인 것은 사용자 관리 화면에서 비활성 배지를 보여주기 위한 의도된 샘플이다.



## 8. 공통 컴포넌트

### 8.1 cn() 유틸 (shared/utils/cn.ts)
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

조건부 클래스 + Tailwind 충돌 병합. 모든 컴포넌트가 사용한다.

### 8.2 Sidebar (shared/components/Sidebar.tsx)
데스크톱(≥1024px) / 모바일 두 가지 형태를 한 컴포넌트에서 렌더링한다.

메뉴 정의 및 RBAC 매트릭스 — 배열 순서가 곧 화면 순서다.


| 순서 | 경로 | 라벨 키 | 아이콘 | ADMIN | LOGISTICS | CAPTAIN | CLIENT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | /dashboard | nav.dashboard | LayoutDashboard | ✅ | ✅ | ✅ | ✅ |
| 2 | /ai-report | nav.aiReport | BrainCircuit | ✅ | ✅ | ✅ | — |
| 3 | /carbon | nav.carbon | Leaf | ✅ | ✅ | — | — |
| 4 | /simulation | nav.simulation | FlaskConical | ✅ | ✅ | — | — |
| 5 | /schedule | nav.schedule | CalendarDays | ✅ | ✅ | — | — |
| 6 | /vessel | nav.vessel | Anchor | ✅ | ✅ | ✅ | — |
| 7 | /admin/users | nav.users | Users | ✅ | — | — | — |


메뉴는 user.role이 roles에 포함될 때만 렌더링한다. 비로그인 시 전부 숨김.

데스크톱 사이드바

hidden lg:flex, 높이 h-screen, 우측 보더, 배경 흰색(다크 #0B192C).
접기 상태: 폭 w-56(224px) ↔ w-16(64px), transition-all duration-200. 상태는 localStorage['ksf-sidebar-collapsed']에 'true'/'false'로 저장. ThemeContext와 마찬가지로 false로 시작해 effect에서 1회 동기화한다.
로고(하단 보더, hover 배경): 32×32px 인디고 라운드 박스 안 Ship 아이콘(흰색) + 텍스트 "KNOT SO FAST"(14px bold). 클릭 시 /dashboard로 이동. 접힘 상태에서는 아이콘만 가운데 정렬.
네비게이션: 각 항목 rounded-lg, 14px.
활성(pathname === href || pathname.startsWith(href + '/')): bg-[#f5f7ff] dark:bg-[#6366f1]/15 text-[#6366f1] font-semibold
비활성: text-slate-500, hover 시 text-slate-900 + 회색 배경
접힘 상태에서는 라벨 대신 hover 툴팁: 아이콘 오른쪽에 절대 위치로 어두운 배경 알약, opacity-0 → group-hover:opacity-100, z-50, pointer-events-none.
접기/펼치기 버튼(최하단, 상단 보더): 펼침 상태는 ChevronLeft + "접기", 접힘 상태는 ChevronRight만.

모바일 헤더 + 드로어 (lg:hidden)

상단 고정 바(fixed top-0 z-40, 높이 약 56px): 좌측 로고(딥링크 동일), 우측 햄버거(Menu/X 토글).
드로어 열림 시: fixed inset-0 z-30 flex — 좌측 폭 224px 메뉴 패널(pt-14), 우측은 반투명 검정 오버레이(클릭 시 닫힘). 메뉴 항목 클릭 시에도 닫힌다.

### 8.3 PageHeader (shared/components/PageHeader.tsx)
모든 기능 화면 최상단에 오는 공용 헤더. 높이 64px(h-16) 고정 — 화면마다 높이가 다르면 안 된다.

Props: { title: string, subtitle?: string, children?: ReactNode }

컨테이너: px-6 h-16, 흰 배경(다크 slate-900), 하단 보더, shrink-0, flex items-center.

좌측: 타이틀(16px bold, whitespace-nowrap) + 부제가 있으면 회색 가운뎃점 구분자 + 부제(14px 회색, truncate hidden sm:block).

우측(shrink-0, gap-3): children(페이지별 액션 버튼) → 그다음 로그인 사용자 블록. 사용자 블록은 좌측에 pl-4 border-l 구분선을 두고 아래 순서로 배치하며, 각 요소 사이에 세로 구분선(w-px h-4 bg-slate-200)을 넣는다.

언어 선택: 회색 배경 안 KO / EN 알약 토글(선택된 쪽만 흰 배경 + 그림자).
구분선
테마 토글: 28×28px 버튼, 다크면 Sun 라이트면 Moon(14px).
구분선
사용자: 28×28px 인디고 10% 원형 배경 안 이름 첫 글자(인디고 bold) + 이름 (14px, hidden md:block, max-w-40 truncate).
구분선
로그아웃: LogOut 아이콘 버튼, hover 시 빨강 + 연빨강 배경. 클릭 시 logout() 후 /login으로 이동.

### 8.4 StatusBadge (shared/components/StatusBadge.tsx)
배지 3종을 한 파일에서 내보낸다. 공통 클래스: inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium, 라벨은 t.status[...].

VoyageBadge (항차 상태)


| status | 클래스 |
| --- | --- |
| preparing | bg-slate-100 text-slate-600 |
| underway | bg-blue-100 text-blue-700 |
| delayed | bg-red-100 text-red-700 |
| completed | bg-green-100 text-green-700 |
| cancelled | bg-slate-100 text-slate-500 |


VesselBadge (선박 상태)


| status | 클래스 |
| --- | --- |
| active | bg-green-100 text-green-700 |
| maintenance | bg-yellow-100 text-yellow-700 |
| idle | bg-slate-100 text-slate-600 |


RiskBadge (리스크 등급)


| level | 클래스 |
| --- | --- |
| high | bg-red-100 text-red-700 |
| medium | bg-yellow-100 text-yellow-700 |
| low | bg-[#6366f1]/10 text-[#6366f1] |


### 8.5 포맷 유틸 (shared/utils/format.ts)
날짜·숫자 로케일은 UI 언어와 무관하게 항상 ko-KR 고정이다.


| 함수 | 반환 | 비고 |
| --- | --- | --- |
| formatDate(iso) | 2026. 08. 02. | toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'}) |
| formatDateTime(iso) | 2026. 08. 02. 06:00 | 위에 hour/minute 2-digit 추가 |
| formatShortDateTime(iso) | 08/02 06:00 | 직접 포맷(toLocaleString은 좁은 칸에서 줄바꿈·잘림 유발) |
| formatNumber(n, d=1) | 1,234.5 | maximumFractionDigits: d |
| formatKnots(n) | 13.5 kts |  |
| formatTon(n) | 1,234.5 ton |  |
| formatTonFixed(n, d=1) | 1,234.5 ton | 자릿수 고정 — 카운트업 애니메이션 중 레이아웃 흔들림 방지 |
| formatNm(n) | 11,200 nm | 소수점 없음 |
| fuelEmissionFactor(type) | HFO 3.114 / MGO 3.206 / LNG 2.750 (기본 3.114) | 연료→CO₂ 환산 계수 |
| interpolateFuelTonPerDay(curve, speed) | 선형 보간값 | 커브 범위 밖은 가장 가까운 끝점으로 clamp |




## 9. 데이터 계층 (선택)

### 9.1 방식 A — mock 전용 (해커톤 기본 권장)
각 기능 스펙의 "재현용 샘플 데이터"를 src/mocks/*.ts에 상수로 두고, 페이지에서 useState로 관리한다. 네트워크·DB·환경변수 의존이 전혀 없어 가장 빠르고 데모 중 실패 가능성이 없다.

### 9.2 방식 B — SWR + Route Handler
백엔드까지 보여줘야 할 때만 선택한다.

공용 fetcher

export const fetcher = (url: string) => fetch(url).then(res => res.json())

훅 패턴 — 모든 도메인 훅이 동일한 3줄 형태다.

export function useVessels() {
  const { data, isLoading, mutate } = useSWR<Vessel[]>('/api/vessels', fetcher)
  return { vessels: data ?? [], isLoading, mutate }   // ★ undefined가 아니라 빈 배열로
}

Route Handler — 도메인당 2파일. route.ts에 GET(findMany) / POST(create), [id]/route.ts에 PATCH(update). Next 16에서 params는 Promise이므로 await params로 푼다.

영속 캐시(선택): SWR 기본 캐시는 메모리에만 있어 새로고침 시 화면이 빈 값으로 깜빡인다. SWRConfig에 localStorage 기반 provider를 주면 직전 스냅샷을 즉시 보여줄 수 있다 (beforeunload에 저장, 부팅 시 복원, 로그아웃 시 삭제).

RSC 경계 주의: 루트 레이아웃(서버 컴포넌트)에서 SWRConfig에 함수 prop(provider)을 직접 넘기면 직렬화 에러가 난다. 'use client' 래퍼 컴포넌트(SWRProvider)를 만들어 그 안에서 감싼다.

### 9.3 방식 C — Prisma + PostgreSQL
원본이 실제로 쓰는 방식이지만 해커톤 당일에는 권장하지 않는다(접속 정보·네트워크·시드 의존). 필요하면 docs/cloud-deploy-setup.md 참조. 핵심 함정은 11.8에 정리했다.

### 9.4 나중에 A → B → C로 갈아타기
mock으로 먼저 만들고 나중에 백엔드를 붙여도 된다. 이 프로젝트는 그 전환 비용이 낮도록 설계되어 있으므로, 당일에는 A로 시작해 시간이 남으면 올리는 전략이 안전하다.

#### 9.4.1 바뀌지 않는 것 (그대로 둔다)

| 항목 | 비고 |
| --- | --- |
| next.config.ts · postcss.config.mjs · eslint.config.mjs | 전혀 손대지 않음 |
| tsconfig.json | 변경 없음 — 생성된 Prisma 클라이언트가 src/generated/prisma에 놓이므로 기존 @/* 별칭으로 그대로 잡힌다 |
| globals.css · 디자인 토큰 | 무관 |
| Sidebar · PageHeader · StatusBadge · cn · format 유틸 | 무관 |
| (main)/layout.tsx · (auth) 그룹 | 무관 |
| TypeScript 도메인 타입(Vessel, Voyage …) | 변경 없음 — 9.4.4의 스키마 설계 덕분 |
| 화면 컴포넌트의 렌더링 로직 | 데이터를 얻는 첫 줄만 바뀐다 |


#### 9.4.2 A → B (mock → SWR) 전환
패키지 추가: npm i swr

shared/utils/fetcher.ts 추가 — 9.2장

훅 추가 (shared/hooks/use{Vessels,Voyages,Positions,Reports,Users}.ts) — 도메인당 3줄

Route Handler 추가 (app/api/{도메인}/route.ts + [id]/route.ts)

페이지 수정 — 여기가 전부다. import 한 줄이 훅 호출로 바뀐다.

- import { MOCK_VOYAGES } from '@/mocks/voyages'
- const [voyages, setVoyages] = useState(MOCK_VOYAGES)
+ const { voyages, mutate: mutateVoyages } = useVoyages()

등록·수정 핸들러를 fetch + mutate()로 교체

await fetch('/api/voyages', { method: 'POST', body: JSON.stringify(voyage) })
mutateVoyages()

영속 캐시까지 쓸 경우 추가로 2곳 — 이 두 가지가 유일하게 "설정을 건드리는" 변경이다.

루트 레이아웃의 Provider 중첩에 SWRProvider를 최외곽으로 추가 (6.1장). 반드시 AuthProvider 바깥이어야 한다 — 로그아웃이 SWR 캐시를 비우기 때문이다.
AuthContext.logout() 수정 — useSWRConfig()의 cache/mutate를 받아 영속 스냅샷 키와 인메모리 캐시를 함께 비운다. 이걸 빼면 로그아웃 후 다른 계정으로 로그인했을 때 이전 사용자의 데이터가 잠깐 보인다.

#### 9.4.3 B → C (SWR → Prisma) 전환
패키지 추가: npm i @prisma/client @prisma/adapter-pg ws + npm i -D prisma tsx dotenv @types/ws

package.json에 스크립트 추가: "postinstall": "prisma generate"

생성 산출물이 .gitignore 대상이라, 이 훅이 없으면 clone·CI 환경에서 클라이언트가 없어 빌드가 깨진다. 대신 Docker 빌드 함정이 따라오므로 11.9장을 함께 볼 것.

prisma.config.ts 생성 (프로젝트 루트)

import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema",                    // ★ 파일이 아니라 디렉터리
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env["DATABASE_URL"] },
})

dotenv/config import가 필요하므로 dotenv는 devDependency로 반드시 설치한다.

prisma/schema/ 디렉터리에 멀티파일 스키마 작성 — 원본은 모델별로 파일을 나눈다 (schema.prisma에 generator·datasource만, 나머지는 vessel.prisma·voyage.prisma· aisPosition.prisma·ecoSpeedReport.prisma·user.prisma).

generator client {
  provider = "prisma-client"          // ★ prisma-client-js 아님
  output   = "../../src/generated/prisma"
}
datasource db {
  provider = "postgresql"             // ★ url은 prisma.config.ts에서 주입
}

.gitignore에 /src/generated/prisma 추가

shared/db.ts 추가 — PrismaClient 싱글턴

adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!,
                         ssl: { rejectUnauthorized: false } })
prisma  = globalThis.prisma ?? new PrismaClient({ adapter })
if (NODE_ENV !== 'production') globalThis.prisma = prisma

globalThis 캐시가 없으면 개발 모드 HMR마다 커넥션이 새로 생겨 곧 연결 수 상한에 걸린다.

Route Handler 본문 교체: mock 배열 조작 → prisma.{model}.findMany() / create() / update()

.env.local에 DATABASE_URL 설정 — sslmode 파라미터를 붙이지 않는다 (11.8장)

마이그레이션·시드 실행

npx prisma migrate deploy      # 또는 최초 1회 npx prisma migrate dev --name init
npx tsx prisma/seed.ts

#### 9.4.4 왜 전환이 싼가 — 스키마 설계 규칙 (중요)
이 프로젝트의 Prisma 스키마는 TypeScript 타입과 1:1로 대응하도록 두 가지 규칙을 지킨다. 새로 스키마를 쓸 때도 반드시 따를 것.


| TS 타입 | Prisma 컬럼 | ❌ 하면 안 되는 것 |
| --- | --- | --- |
| etd: string (ISO 문자열) | String | DateTime으로 잡으면 안 된다 |
| fuelCurve: FuelPoint[] | Json | 별도 테이블로 정규화하면 안 된다 |
| plannedRoute: Waypoint[] | Json | 〃 |
| risks: RiskItem[] | Json | 〃 |
| assignedVesselIds?: string[] | Json? | 〃 |


날짜를 DateTime으로 잡으면 안 되는 이유: Prisma가 Date 객체를 돌려주는 순간 Voyage.etd의 타입이 string에서 Date로 바뀌고, 날짜를 다루는 전 화면의 코드가 한꺼번에 깨진다 (formatDateTime(iso), new Date(iso), 문자열 비교로 하는 ETD/RTA 검증 등). 문자열로 두면 API 응답이든 mock이든 완전히 동일한 값이 흐른다.

배열을 Json으로 두는 이유: 이 두 규칙 덕분에 시드 스크립트가 mock 객체를 거의 그대로 createMany에 넘길 수 있다(타입 캐스트 한 번이면 끝). 정규화했다면 mock → DB 변환 코드를 도메인마다 따로 써야 한다.

#### 9.4.5 전환 시 깨지기 쉬운 지점
mock은 동기적으로 즉시 있지만 SWR 데이터는 첫 렌더에 비어 있다. mock 기준으로 작성한 화면이 전환 직후 깨지는 원인은 대부분 여기다.

훅은 반드시 빈 배열로 폴백한다(data ?? []). undefined를 그대로 반환하면 .filter()·.map() 에서 즉시 터진다.
.find() 결과는 항상 undefined일 수 있다고 가정한다. mock에서는 항상 찾아지던 vessels.find(v => v.id === voyage.vesselId)가 첫 렌더에는 undefined다 — 옵셔널 체이닝과 ?? '-' 폴백을 붙인다(SCHEDULE.md 목록 1열이 이미 그렇게 명세되어 있다).
파생 계산은 데이터가 없을 때 null을 반환하도록 한다(SCHEDULE.md의 준수 확률 계산이 리포트· 선박이 없으면 null → —를 표시하는 것과 동일한 패턴).
등록·수정 후 mutate() 호출을 빠뜨리지 않는다. 빼면 저장은 됐는데 목록이 그대로여서 "안 됐다"고 오인하게 된다.
로그아웃 시 캐시를 비운다(9.4.2 8번).



## 10. 실행 및 검증
npm run dev          # → http://localhost:3000

단계별 검증 — 아래 순서로 확인되면 부트스트랩 완료다.


| # | 확인 항목 | 기대 결과 |
| --- | --- | --- |
| 1 | / 접속 | /dashboard로 리다이렉트 → 비로그인이므로 /login으로 다시 이동 |
| 2 | 데모 계정(admin@knotsofas.kr / demo)으로 로그인 | /dashboard 진입, 사이드바 표시 |
| 3 | 사이드바 메뉴 개수 | ADMIN은 7개 전부 보임 |
| 4 | client1@shipping.co.kr로 재로그인 | 메뉴가 대시보드 1개만 보임 |
| 5 | 테마 토글 클릭 | 전체 배경/텍스트가 즉시 다크로 전환, 새로고침해도 유지 |
| 6 | 언어 토글 EN 클릭 | 사이드바 메뉴명이 영문으로 전환 |
| 7 | 사이드바 접기 버튼 | 폭이 224→64px로 줄고 hover 시 툴팁, 새로고침해도 유지 |
| 8 | 브라우저 폭 1024px 미만으로 축소 | 사이드바가 상단 바 + 햄버거 드로어로 전환 |
| 9 | 로그아웃 | /login으로 이동, 뒤로가기로 되돌아가도 다시 로그인 화면 |


Next.js 16 문법 확인 팁: 이 버전은 학습 데이터와 다를 수 있다. 막히면 node_modules/next/dist/docs/ 아래의 해당 문서를 직접 읽는 것이 가장 빠르다.



## 11. 알려진 함정
원본 개발 중 실제로 시간을 잃었던 항목들이다. 증상이 나타나면 여기부터 찾는다.

### 11.1 모노레포 실행 디렉터리 혼동
증상: 루트에서 npm run dev 실행 시 ENOENT: no such file or directory, open '.../package.json'

원인: 앱이 apps/web에 있는데 루트에서 실행함. 해결: cd apps/web && npm run dev. 애초에 2.1장대로 단일 앱으로 시작하면 발생하지 않는다.

연관 증상: 루트에 실수로 npm install을 하면 빈 package-lock.json이 생기고, Next가 "We detected multiple lockfiles" 경고와 함께 엉뚱한 디렉터리를 워크스페이스 루트로 추론한다. 루트 lockfile을 지우거나 next.config.ts에 turbopack.root를 명시한다.

### 11.2 의존성 누락 — Module not found
증상: Module not found: Can't resolve 'swr' 같은 에러가 여러 파일에서 동시에 발생.

원인: package.json에는 있는데 node_modules에 실제로 없음. 보통 다른 사람이 의존성을 추가한 커밋을 pull한 뒤 npm install을 다시 실행하지 않아서 생긴다. 해결: npm install. 팀 작업 중에는 pull 후 항상 npm install 을 습관화한다.

### 11.3 .next 캐시 손상 — 무한 컴파일
증상: dev 서버는 뜨는데 페이지가 응답하지 않고, node 프로세스가 CPU를 계속 소모. .next 폴더가 수백 MB로 비대해져 있음.

원인: dev 서버를 강제 종료(taskkill /F)해 Turbopack 영구 캐시가 손상됨. 해결: rm -rf .next 후 재시작. dev 서버는 항상 Ctrl+C로 정상 종료한다.

### 11.4 Tailwind v4에서 다크 모드 토글이 안 먹음
증상: 테마 토글을 눌러도 색이 안 바뀌고, OS 다크 모드 설정만 따라감.

원인: v3의 darkMode: 'class' 설정을 v4에 그대로 쓸 수 없다. 해결: globals.css에 @variant dark (&:where(.dark, .dark *)); 추가(5.1장).

### 11.5 하이드레이션 불일치 (테마·사이드바·로그인)
증상: 콘솔에 hydration mismatch 경고, 첫 렌더에서 화면이 깜빡임.

원인: useState 초기화 함수에서 localStorage/matchMedia를 읽음(서버에는 없음). 해결: 항상 서버와 동일한 기본값으로 시작하고 useEffect에서 1회 동기화한다 (7.1장). 로그인 상태처럼 외부 저장소를 구독해야 하면 useSyncExternalStore + getServerSnapshot을 쓴다(7.3장).

### 11.6 useSyncExternalStore 무한 리렌더
증상: "The result of getSnapshot should be cached" 경고와 함께 무한 렌더.

원인: 매 호출마다 JSON.parse로 새 객체를 반환. 해결: 원본 문자열이 바뀌지 않았으면 이전 파싱 결과를 재사용해 참조를 안정화한다.

### 11.7 클라이언트 전용 라이브러리의 SSR 오류
증상: window is not defined / document is not defined로 빌드·렌더 실패.

원인: ECharts·Leaflet은 브라우저 API에 의존한다. 해결: 반드시 동적 import + SSR 비활성화.

const EChart = dynamic(() => import('echarts-for-react'), { ssr: false })

Leaflet도 동일하며, 추가로 .leaflet-container에 명시적 높이가 없으면 지도가 보이지 않는다.

### 11.8 DATABASE_URL에 sslmode를 붙이면 안 된다 (방식 C)
증상: unable to verify the first certificate

원인: 코드에서 ssl: { rejectUnauthorized: false }를 명시하는데 연결 문자열에 sslmode=require가 섞이면 드라이버가 인증서 체인 검증을 다시 시도한다(Cloud SQL 인증서는 Google 관리 CA라 Node 기본 신뢰 저장소에 없음). 해결: DATABASE_URL에 sslmode 쿼리 파라미터를 넣지 않는다.

### 11.9 postinstall: prisma generate와 Docker 빌드
증상: Docker 빌드 중 스키마를 찾지 못하거나 생성된 클라이언트가 없어 Module not found.

원인: ① deps 스테이지가 package*.json만 복사하고 npm ci를 실행 → prisma/schema.prisma 없음. ② 생성 산출물 경로가 .gitignore 대상이라 빌드 컨텍스트에 없음. 해결: ① npm ci 전에 prisma/ 디렉터리도 COPY. ② npm run build 전에 prisma generate를 한 번 더 실행.

### 11.10 .env.example이 git에서 사라짐
증상: 팀원이 .env.example을 못 받음. 원인: .gitignore의 .env* 패턴이 예제 파일까지 삼킴. 해결: !.env.example 예외 추가(3.5장).



## 12. 부트스트랩 체크리스트
반입물 확인 (가장 먼저)

ksf-kit/specs/ 문서 20개 확인 → 프로젝트의 docs/specs/로 복사
ksf-kit/project-files/ 존재 여부 확인 → 있으면 Track A, 없으면 Track B (1.2장)
Track을 팀 전원에게 공유 — 데이터 작성 담당자가 있는지 없는지가 갈린다

환경

Node 20+ 확인
create-next-app 실행 (TypeScript · Tailwind · ESLint · App Router · src/ · @/* 별칭)
의존성 버전 고정 후 npm install — 최소 세트: lucide-react clsx tailwind-merge date-fns echarts echarts-for-react

설정

next.config.ts (output: 'standalone', devIndicators: false)
tsconfig.json — paths: { "@/*": ["./src/*"] }, resolveJsonModule: true
postcss.config.mjs — @tailwindcss/postcss
.gitignore — !.env.example 예외 포함

전역 스타일

@import "tailwindcss" + @variant dark (다크 모드 토글의 전제)
CSS 변수(브랜드 팔레트) + @theme inline 매핑
body 폰트·배경 연결, 스크롤바 스타일

샘플 데이터

Track A: mocks/* 를 src/mocks/ 에, public/* 를 public/ 에 복사 (타입·상수를 먼저 만든 뒤 복사해야 컴파일 통과 — 1.3장)
Track B: 각 기능 스펙의 "재현용 샘플 데이터" 표를 보고 src/mocks/*.ts 작성 + 항로 폴백(SCHEDULE.md 6.3장) 적용

앱 셸

루트 레이아웃 — Plus Jakarta Sans + Provider 4중첩 + suppressHydrationWarning
루트 페이지 — /dashboard 리다이렉트
(main)/layout.tsx — 인증 가드 + 로딩 스피너 + Sidebar + pt-14 lg:pt-0
(auth) 그룹 분리

Context

ThemeContext — 'light' 시작 + effect 동기화 + <html>에 dark 클래스 토글
LanguageContext — ko/en 사전, typeof ko 타입으로 키 누락 컴파일 검증
AuthContext — useSyncExternalStore + 참조 안정화 + 데모 계정 4종 + 사용자 7명

공통 컴포넌트

cn() 유틸
Sidebar — RBAC 메뉴 7종, 접기(localStorage), 접힘 툴팁, 로고 딥링크, 모바일 드로어
PageHeader — h-16 고정, 언어/테마/사용자/로그아웃 + 구분선
StatusBadge 3종(Voyage · Vessel · Risk)
format 유틸(ko-KR 고정)

검증

10장 9개 항목 전부 통과

완료 후: 각 담당자가 docs/specs/{기능}.md를 들고 (main)/{경로}/page.tsx부터 병렬로 시작한다.


# 부트스트랩 실행 프롬프트 (1단계용)
README.md 3장 1단계의 ①~⑤를 그대로 복사해 쓸 수 있는 프롬프트로 풀어놓은 것입니다. BOOTSTRAP.md와 나란히 놓고 위에서부터 순서대로 실행하세요.

이 문서는 전달 수단, BOOTSTRAP.md가 내용입니다. 프롬프트는 명세의 어느 장을 읽으라고 가리킬 뿐이며, 실제 구현 기준은 항상 BOOTSTRAP.md 쪽입니다.

전제: 프로젝트 폴더에서 파일을 읽고 쓸 수 있는 LLM 도구(Claude Code · Cursor · Copilot 등)를 사용합니다. 채팅형 LLM만 쓴다면 프롬프트의 "…/OO.md 를 읽고" 부분을 해당 문서 내용 붙여넣기로 바꾸면 됩니다.



## 시작 전 — 폴더 배치
ksf-kit/ 을 프로젝트 안이 아니라 옆에 둡니다. 프로젝트는 아직 없고, ①에서 만들 것입니다.

작업폴더/                 ← LLM 세션을 여기서 연다
└── ksf-kit/
    ├── specs/
    └── project-files/

(① 실행 후)
작업폴더/
├── ksf-kit/
└── knot-so-fast/        ← 여기가 프로젝트 루트가 된다

왜 프로젝트 안에 두지 않는가

①을 실행하는 시점에는 프로젝트가 아직 없다. LLM이 ksf-kit/specs/BOOTSTRAP.md 를 읽어야 한다.
프로젝트 안에 두면 src/mocks 와 public 이 5MB 중복되고, tsconfig 가 ksf-kit/project-files/**/*.ts 까지 타입 검사해 불필요한 에러가 뜬다.

이미 프로젝트 안에 넣었다면, 아래 명령의 ..\ksf-kit 를 .\ksf-kit 로 바꾸고 복사가 끝난 뒤 ksf-kit/ 을 삭제하세요.

프롬프트는 그대로 쓰지 않아도 됩니다. 결과가 어긋나면 명세의 장 번호를 더 좁혀 지시하세요. 명세가 정답이고 프롬프트는 전달 수단일 뿐입니다.



## 0. 세션 시작 시 한 번
새 LLM 세션을 열 때 가장 먼저 넣습니다. 이후 프롬프트에서 반복하지 않아도 됩니다.

지금부터 해상 물류 최적화 플랫폼 "KNOT SO FAST"를 재현한다.
명세 문서만이 유일한 기준이며, 명세에 없는 것은 임의로 추가하지 않는다.
명세는 지금 ksf-kit/specs/ 에 있고, 프로젝트를 만든 뒤에는 docs/specs/ 로 옮길 것이다.

중요:
- Next.js 16 + React 19 + Tailwind v4를 쓴다. 네가 학습한 것과 API가 다를 수 있으니,
  확신이 없으면 node_modules/next/dist/docs/ 의 실제 문서를 확인하고 진행해라.
- Tailwind v4에는 darkMode: 'class' 설정이 없다. globals.css의 @variant로 처리한다.
- 코드를 쓰기 전에 해당 명세 장을 먼저 읽어라.
- 명세와 다르게 구현해야 할 이유가 있으면, 만들기 전에 먼저 나에게 말해라.



## ① 프로젝트 생성 + 명세 반입
명세: BOOTSTRAP.md 23장 · 소요 1015분 작업폴더(ksf-kit/ 의 부모)에서 시작합니다.

ksf-kit/specs/BOOTSTRAP.md 의 2장과 3장을 읽고 프로젝트를 세팅해줘.

1. create-next-app으로 knot-so-fast 프로젝트를 만든다 (TypeScript, Tailwind, ESLint,
   App Router, src 디렉터리, @/* 임포트 별칭). 번들러는 Turbopack 기본값을 그대로 둔다.
2. package.json의 의존성을 2.3장 표의 버전으로 정확히 고정한다.
   지금은 mock 전용으로 가므로 "최소 세트"만 설치한다.
3. 3장의 설정 파일 4종(next.config.ts, tsconfig.json, postcss.config.mjs,
   eslint.config.mjs)을 명세대로 작성한다.
4. .gitignore에 3.5장의 항목을 넣는다. !.env.example 예외를 빠뜨리지 마라.

완료되면 npm run dev가 뜨는지 확인하고 결과를 알려줘.

이어서 명세를 프로젝트 안으로 옮깁니다. 이후 프롬프트는 전부 docs/specs/ 를 참조합니다.

# PowerShell — 생성된 프로젝트 루트(knot-so-fast/)에서
New-Item -ItemType Directory -Force docs | Out-Null
Copy-Item -Recurse -Force ..\ksf-kit\specs docs\

# bash
mkdir -p docs && cp -r ../ksf-kit/specs docs/

완료 확인 — npm run dev 배너에 ▲ Next.js 16.2.10 (Turbopack) 이 찍히고, docs/specs/BOOTSTRAP.md 가 에디터에서 열린다.

이 시점부터 LLM 세션의 작업 디렉터리를 프로젝트 루트로 옮기세요. 이후 모든 프롬프트가 docs/specs/… 상대 경로를 씁니다.



## ② 타입·상수 작성
명세: BOOTSTRAP.md 4장 · 소요 10분

docs/specs/BOOTSTRAP.md 4장의 디렉터리 구조를 만들고, 그중 타입과 상수를 먼저 작성해줘.

1. src/shared/types/ 아래에 도메인별 타입 파일을 만든다.
   각 타입의 정확한 필드는 아래 명세에서 가져와라:
   - Vessel, FuelPoint       → docs/specs/VESSEL.md 3.1장
   - Voyage, Waypoint        → docs/specs/SCHEDULE.md 3.1장
   - AisPosition             → docs/specs/DASHBOARD.md 3.1장
   - User, UserRole          → docs/specs/BOOTSTRAP.md 7.3장
   - EcoSpeedReport, RiskItem → docs/specs/AI_REPORT.md 3.1장
   - TyphoonWarning, RegionalIssue, DangerZone → docs/specs/DASHBOARD.md 3.1장
2. types/index.ts에서 전부 재수출해 @/shared/types 로 한 번에 import할 수 있게 한다.
3. src/shared/constants.ts를 만든다 (BOOTSTRAP.md 7장·8장에 등장하는 상수들:
   OWN_COMPANY_NAME, 딥링크용 sessionStorage 키 3종, SWR 캐시 키).

빈 폴더(app/features/shared/mocks)도 함께 만들어줘.

완료 확인 — import type { Vessel, Voyage } from '@/shared/types' 가 타입 에러 없이 해석된다.



## ③ 샘플 데이터·자산 복사
LLM이 아니라 직접 실행합니다. · 소요 2분 ①에서 specs/ 는 이미 옮겼으므로, 여기서는 project-files/ 만 복사합니다.

# PowerShell — 프로젝트 루트에서
Copy-Item -Recurse -Force ..\ksf-kit\project-files\* .

# bash
cp -r ../ksf-kit/project-files/* .

반드시 ②를 끝낸 뒤에 실행하세요. src/mocks/*.ts 가 @/shared/types 를 import하므로, 먼저 복사하면 타입 에러가 쏟아져 진짜 오류를 가립니다.

복사가 끝나면 ksf-kit/ 은 더 이상 필요 없습니다(명세는 이미 docs/specs/ 에 있음). 프로젝트 안에 두었다면 이제 삭제하세요.

복사 후 검증이 필요하면:

방금 ksf-kit/project-files 를 프로젝트에 복사했다.
src/mocks/ 의 파일들이 @/shared/types 와 @/shared/constants 를 정상적으로 참조하는지
확인하고, 타입 에러가 있으면 types 쪽을 명세에 맞게 고쳐줘.
mocks 파일 자체는 원본이므로 수정하지 마라.

Track B(번들에 project-files/ 가 없음)라면 이 프롬프트로 대체합니다.

src/mocks/ 아래에 샘플 데이터 파일을 만들어줘. 데이터는 아래 명세의
"재현용 샘플 데이터" 장에 있는 표를 그대로 옮긴다. 값을 임의로 바꾸지 마라.

- vessels.ts    → docs/specs/VESSEL.md 3.2장 (선박 5척, 연료 커브 포함)
- voyages.ts    → docs/specs/SCHEDULE.md 3.4장 (항차 8건)
- ports.ts      → docs/specs/SCHEDULE.md 3.2장 (항구 30곳) + findPort/formatPortLabel
- positions.ts, reports.ts → docs/specs/SCHEDULE.md 6.1장
- users.ts      → docs/specs/BOOTSTRAP.md 7.3장 (사용자 7명 + 데모 계정 4개)
- carbon.ts     → docs/specs/CARBON.md 3.2장
- map-overlays.ts → docs/specs/DASHBOARD.md 3.2~3.4장
- port-congestion.ts → docs/specs/AI_REPORT.md 3.2장



## ④ 전역 스타일
명세: BOOTSTRAP.md 5장 · 소요 10분

docs/specs/BOOTSTRAP.md 5장대로 src/app/globals.css 를 작성해줘.

5.1~5.5의 순서를 그대로 지킨다:
- @import "tailwindcss"
- @variant dark (&:where(.dark, .dark *))   ← 이 줄이 없으면 테마 토글이 동작하지 않는다
- CSS 변수(브랜드 팔레트) + @theme inline 매핑
- html/body 기본 스타일
- 스크롤바 스타일
- Leaflet 관련 스타일과 map-marker-pulse 애니메이션

지금은 대시보드를 안 만들었어도 Leaflet 부분까지 미리 넣어둬라.

완료 확인 — <html> 에 dark 클래스를 수동으로 붙여보면 배경색이 실제로 바뀐다.



## ⑤-a 레이아웃과 Provider
명세: BOOTSTRAP.md 6장 · 소요 10분

docs/specs/BOOTSTRAP.md 6장대로 앱 셸의 레이아웃을 만들어줘.

- src/app/layout.tsx  : 루트 레이아웃. Plus Jakarta Sans 폰트 변수 연결,
                        metadata, Provider 중첩 순서(6.1장 그대로), suppressHydrationWarning
- src/app/page.tsx    : /dashboard 로 리다이렉트
- src/app/(main)/layout.tsx : 인증 가드 + 로딩 스피너 + Sidebar + pt-14 lg:pt-0
- (auth) 라우트 그룹 폴더도 만들어둔다

지금은 mock 전용이라 SWRProvider는 넣지 않는다. Provider는 3중첩으로 한다.
Sidebar와 Context는 아직 없으니 다음 단계에서 만들 예정이라고 표시만 해둬라.

## ⑤-b Context 3종
명세: BOOTSTRAP.md 7장 · 소요 15~20분

docs/specs/BOOTSTRAP.md 7장대로 전역 Context 3개를 만들어줘.

- features/theme/ThemeContext.tsx    (7.1장)
- features/i18n/LanguageContext.tsx + translations.ts (7.2장)
- features/auth/AuthContext.tsx      (7.3장)

하이드레이션 규칙을 반드시 지켜라:
- Theme·Sidebar 접힘 상태는 서버와 같은 기본값으로 시작하고 useEffect에서 1회 동기화한다.
  useState 초기화 함수에서 localStorage를 읽으면 안 된다.
- AuthContext는 useSyncExternalStore + getServerSnapshot(null)을 쓰고,
  getSnapshot이 매번 새 객체를 반환하지 않도록 모듈 스코프에 파싱 결과를 캐시한다.

translations.ts는 지금은 7.2장의 공용 사전(nav, common, status, role)만 채운다.
화면별 사전은 각 화면 담당자가 나중에 자기 스펙에서 추가할 것이다.
타입은 const en: typeof ko = {...} 패턴으로 선언해 키 누락이 컴파일 에러가 되게 해라.

완료 확인 — 콘솔에 hydration 경고가 없다.

## ⑤-c 공통 컴포넌트
명세: BOOTSTRAP.md 8장 · 소요 20~25분

docs/specs/BOOTSTRAP.md 8장대로 공통 컴포넌트와 유틸을 만들어줘.

- shared/utils/cn.ts            (8.1장)
- shared/components/Sidebar.tsx (8.2장 — RBAC 메뉴 7종, 접기, 접힘 시 툴팁,
                                 로고 딥링크, 모바일 드로어)
- shared/components/PageHeader.tsx (8.3장 — h-16 고정, 언어/테마/사용자/로그아웃)
- shared/components/StatusBadge.tsx (8.4장 — VoyageBadge/VesselBadge/RiskBadge)
- shared/utils/format.ts        (8.5장 — 날짜·숫자는 ko-KR 고정)

Sidebar에서 주의할 점:
- 접힘 상태는 localStorage에 저장하되 false로 시작해 effect에서 동기화한다.
- nav 요소에 overflow-x-hidden을 명시한다. overflow-y-auto만 주면 CSS 스펙상
  overflow-x도 auto가 되어 하단에 가로 스크롤바가 생긴다.



## 완료 검증
docs/specs/BOOTSTRAP.md 10장의 검증 항목 9개를 하나씩 확인해줘.
직접 확인이 어려운 항목은 무엇을 눌러봐야 하는지 알려줘.

9개 항목 요약 — / 리다이렉트 → 데모 로그인 → ADMIN 메뉴 7개 → CLIENT 메뉴 1개 → 테마 토글 유지 → 언어 토글 → 사이드바 접기 유지 → 모바일 드로어 → 로그아웃.

4번(CLIENT로 로그인 시 메뉴가 1개만)이 통과하면 RBAC가 실제로 동작하는 것이다. 여기까지 되면 1단계 완료이며, 2단계에서 팀 전원이 병렬로 화면을 만들기 시작할 수 있다.



## 막혔을 때
지금 이런 증상이 있다: (증상을 구체적으로)

docs/specs/KNOWN_PITFALLS.md 의 0장 증상 인덱스에서 해당 항목을 찾아보고,
있으면 그 해결책을 적용해줘. 없으면 원인부터 분석해줘.

원본 개발에서 실제로 겪은 함정 38건이 증상별로 정리되어 있습니다. 1단계에서 자주 나오는 것:


| 증상 | 항목 |
| --- | --- |
| Hydration failed | 1.1 |
| getSnapshot should be cached / 무한 렌더 | 1.2 |
| 테마 토글이 안 먹음 | 11.4 |
| 사이드바 하단 가로 스크롤바 | 4.3 |
| Module not found | 11.2 |
| dev 서버가 응답 없음 | 11.3 |


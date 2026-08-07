
# 사용자 관리 — 단독 기능 명세서 (Admin / User Management)
문서 버전: 1.0.0
최종 수정일: 2026-08-06
목적: KNOT SO FAST(KSF Line) 프로젝트의 "사용자 관리" 화면 하나만을 대상으로, 소스 코드 없이도 구성·디자인·문구·처리 로직을 최대한 동일하게(≈99.9%) 재구현할 수 있도록 하는 완결형 명세서입니다.
범위: 이 문서는 원본 프로젝트의 다른 화면에 거의 의존하지 않습니다. 선박 이름 조회를 위해 선박 목록을 읽기 전용으로 참조하는 것이 전부이며, 딥링크도 없습니다.

선행 문서: BOOTSTRAP.md를 먼저 끝낸다 — 특히 7.3장(User 타입·사용자 7명) 이 이 화면의 데이터 원본이다. 구현 중 막히면 KNOWN_PITFALLS.md의 증상 인덱스에서 찾는다.

해커톤 원칙: 7개 화면 중 가장 작고 단순하다(원본 코드 약 170줄). 구조가 SCHEDULE.md 목록 뷰와 거의 같아, 그 화면을 먼저 만들었다면 30분 내에 복제할 수 있다. 시간이 가장 부족할 때 마지막으로 만들거나 통째로 생략해도 데모에는 영향이 적다(사이드바 메뉴에서 빼면 된다).



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
시스템 사용자 계정을 조회하고 활성/비활성 상태를 전환한다. 역할별 인원 수를 요약 카드로 보여주고, 검색·역할 필터로 목록을 좁힌다.

### 1.2 핵심 개념
역할 4종(RBAC): ADMIN(시스템 관리자) · LOGISTICS(물류 담당자) · CAPTAIN(선장·선원) · CLIENT(화주). 각 역할은 고유한 색과 아이콘을 가지며, 이 조합이 화면 전체에서 일관되게 쓰인다.
활성/비활성(active): 이 화면에서 유일하게 변경 가능한 필드다. 비활성 사용자는 행 전체가 흐리게(opacity-50) 표시된다.
선박 배정(assignedVesselIds): CAPTAIN 역할에만 의미가 있다. 선박 id 배열을 이름으로 바꿔 쉼표로 이어 표시한다.

읽기 + 상태 토글 전용 화면이다. 사용자 등록·수정·삭제 기능은 없다(4.2장 참고).



## 2. 접근 권한
ADMIN 역할만 접근 가능한 유일한 화면이다. 사이드바에서도 ADMIN에게만 노출된다 (BOOTSTRAP.md 8.2장의 RBAC 매트릭스 7번 항목).
경로는 /admin/users.
별도 프론트 전용 데모 앱으로 만든다면 이 제약은 생략해도 무방하다.

데모에서 admin@knotsofas.kr로 로그인해야만 이 메뉴가 보인다는 점이 RBAC를 보여주는 좋은 소재다.



## 3. 데이터 모델

### 3.1 타입 정의
type UserRole = 'ADMIN' | 'LOGISTICS' | 'CAPTAIN' | 'CLIENT'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  assignedVesselIds?: string[]   // CAPTAIN에만 의미 있음 (선택)
  department?: string             // 선택
  active: boolean
}

// 선박은 이름 조회에만 쓴다
interface Vessel { id: string; name: string }

### 3.2 재현용 샘플 데이터 — 사용자 7명
BOOTSTRAP.md 7.3장과 동일한 데이터다. 두 문서를 함께 쓴다면 한 곳에 두고 공유한다.


| id | name | email | role | department | assignedVesselIds | active |
| --- | --- | --- | --- | --- | --- | --- |
| u001 | 관리자 | admin@knotsofas.kr | ADMIN | 시스템 관리팀 | — | ✅ |
| u002 | 김물류 | logistics1@knotsofas.kr | LOGISTICS | 물류기획팀 | — | ✅ |
| u003 | 이담당 | logistics2@knotsofas.kr | LOGISTICS | 물류기획팀 | — | ✅ |
| u004 | 박선장 | captain1@knotsofas.kr | CAPTAIN | 운항팀 | v001 | ✅ |
| u005 | 최선장 | captain2@knotsofas.kr | CAPTAIN | 운항팀 | v002 | ✅ |
| u006 | 정선장 | captain3@knotsofas.kr | CAPTAIN | 운항팀 | v003, v004 | ❌ |
| u007 | 화주A | client1@shipping.co.kr | CLIENT | 외부 화주 | — | ✅ |


샘플 설계 의도

u006만 비활성이다 — 흐린 행과 "비활성" 배지, 그리고 "활성화" 버튼이 화면에서 실제로 보이도록 하기 위한 설정이다.
u006만 선박 2척을 배정받았다 — 쉼표로 이어 붙이는 표시(KSF VENTURE, KSF HORIZON)를 검증하기 위함이다.
역할별 인원이 1 / 2 / 3 / 1 로 서로 달라 요약 카드의 숫자가 전부 다르게 나온다.
LOGISTICS·CLIENT는 assignedVesselIds가 아예 없어 — 표시를 검증한다.

### 3.3 선박 데이터
선박 이름 조회에만 쓴다. VESSEL.md 3.2장의 5척을 그대로 쓰되, 이 화면에는 id와 name만 있으면 충분하다.


| id | name |
| --- | --- |
| v001 | KSF PIONEER |
| v002 | KSF NAVIGATOR |
| v003 | KSF VENTURE |
| v004 | KSF HORIZON |
| v005 | KSF ASPIRE |


### 3.4 데이터 소스
SCHEDULE.md 3.5장과 동일 — mock 전용이 기본 권장.

방식 B(SWR)를 택하는 경우의 API 계약은 아래가 전부다.


| 메서드 | 경로 | 용도 | 응답 |
| --- | --- | --- | --- |
| GET | /api/users | 전체 사용자 조회 | User[] |
| PATCH | /api/users/{id} | active 토글 전용 | User |
| GET | /api/vessels | 선박 목록(이름 조회용) | Vessel[] |


POST(등록) 엔드포인트가 없다. 이 화면은 사용자를 만들지 않는다.



## 4. 화면 구성
전체 페이지는 세로 flex(flex flex-col h-full). 위에서부터 4개 블록이 쌓이며, 마지막 목록만 스크롤된다(앞의 3개는 shrink-0).


| # | 블록 | 장 |
| --- | --- | --- |
| 1 | 페이지 헤더 (+ 사용자 추가 버튼) | 4.1 · 4.2 |
| 2 | 역할별 요약 카드 4장 | 4.3 |
| 3 | 검색 + 역할 필터 바 | 4.4 |
| 4 | 사용자 목록 테이블 | 4.5 |


### 4.1 페이지 헤더
공용 PageHeader(높이 64px 고정). 타이틀 "사용자 관리", 부제 "계정, 역할, 선박 배정 관리".

### 4.2 "사용자 추가" 버튼
우측 액션 영역에 인디고 버튼(px-4 py-2 rounded-lg text-sm font-medium, hover #4f46e5) — Plus 아이콘 + "사용자 추가".

이 버튼에는 클릭 핸들러가 없다. 원본에서 UI만 배치되어 있고 등록 모달이 구현되지 않은 상태다. 재구현 시 동일하게 비활성 버튼으로 두거나, 시간이 남으면 VESSEL.md 6장의 모달 패턴을 참고해 채워 넣어도 된다. 원본과 100% 동일하게 가려면 그대로 둔다.

### 4.3 역할별 요약 카드
px-6 py-3 블록(흰 배경, 하단 보더). 그리드는 grid-cols-2 md:grid-cols-4 gap-3.

각 카드: flex items-center gap-3 p-3 rounded-xl border shadow-sm, 흰 배경(다크 slate-800).

좌측: 32×32px rounded-lg 박스 — 배경·글자색은 역할별 색(7장), 안에 역할별 아이콘(16px)
우측: 인원 수(18px bold) 위, 역할명(12px 회색) 아래

역할별 아이콘


| role | 아이콘 |
| --- | --- |
| ADMIN | Shield |
| LOGISTICS | Users |
| CAPTAIN | Anchor |
| CLIENT | UserCheck |


카드는 항상 4장 모두 표시하며 순서는 ADMIN → LOGISTICS → CAPTAIN → CLIENT 고정이다.

### 4.4 검색과 역할 필터
px-6 py-3 블록(흰 배경, 하단 보더). 좁은 화면은 세로(flex-col), 640px 이상은 가로(sm:flex-row), 간격 12px.

검색 입력(flex-1): 왼쪽 안쪽에 Search 아이콘(16px 회색, 절대 위치), 좌측 패딩 36px. placeholder "이름, 이메일 검색". 포커스 시 인디고 2px 링.

역할 필터 세그먼트: 회색 배경(bg-slate-100 dark:bg-slate-800 p-1 rounded-lg) 안에 알약 버튼 5개(전체 + 역할 4종). 선택된 버튼만 흰 배경 + shadow-sm.

여기에는 건수가 표시되지 않는다. 건수는 위쪽 요약 카드가 담당한다 (SCHEDULE.md 4.2장의 상태 필터가 (n)을 붙이는 것과 다르다).

### 4.5 사용자 목록 테이블
바깥: 흰 카드(rounded-xl border overflow-hidden). 컨테이너는 flex-1 overflow-auto px-6 py-4.

헤더 행: 배경 bg-slate-50(다크 slate-800/60), 하단 보더, 셀 text-xs font-semibold text-slate-500, px-4 py-3. 본문 행 사이는 divide-y, hover 시 배경 slate-50(다크 slate-800/40).

열 구성 (총 6열)


| # | 헤더 | 정렬 | 내용 |
| --- | --- | --- | --- |
| 1 | 사용자 | 좌 | 32×32px 회색 원형 아바타(이름 첫 글자, 14px semibold) + 우측에 이름(font-medium) / 이메일(12px 회색) 2줄 |
| 2 | 역할 | 좌 | 역할 배지 — 아이콘(12px) + 역할명, px-2 py-0.5 rounded text-xs font-medium, 역할별 색 |
| 3 | 부서 | 좌 | department 또는 -(하이픈) |
| 4 | 배정 선박 | 좌 | 선박명을 , 로 이어 표시. 없으면 —(em-dash) |
| 5 | 상태 | 좌 | 활성이면 초록 배지 "활성", 비활성이면 회색 배지 "비활성" |
| 6 | 액션 | 우 | 상태 토글 버튼(4.6장) |


3열과 4열의 대시 문자가 다르다 — 부서는 ASCII 하이픈 -, 배정 선박은 em-dash — 를 쓴다. 원본 그대로이며, 통일하고 싶다면 둘 다 —로 맞춘다.

비활성 행: <tr> 전체에 opacity-50 을 준다(아바타·배지·버튼까지 함께 흐려진다).

빈 상태 처리가 없다. 필터 결과가 0건이면 헤더만 남은 빈 표가 보인다 (SCHEDULE.md 4.3장은 "검색 결과가 없습니다."를 표시하는 것과 다르다). 개선하고 싶다면 colSpan={6} 셀에 안내 문구를 넣는다.

### 4.6 상태 토글 버튼
inline-flex items-center gap-1 text-xs, 얇은 테두리 + rounded px-2 py-1, hover 시 회색 배경.


| 현재 상태 | 아이콘 | 라벨 |
| --- | --- | --- |
| 활성 | UserX | 비활성화 |
| 비활성 | UserCheck | 활성화 |


즉 버튼은 "지금 상태"가 아니라 "누르면 일어날 일"을 표시한다.



## 5. 핵심 로직

### 5.1 필터링
filtered = users.filter(u =>
  (roleFilter === 'all' || u.role === roleFilter)
  && (검색어 없음 || u.name.includes(검색어) || u.email.includes(검색어))
)

대소문자를 구분하는 단순 부분 문자열 포함이다(원본 그대로). 이메일이 소문자라 ADMIN으로 검색하면 걸리지 않는다.
정렬은 없다. 원본 데이터 배열 순서를 그대로 유지한다.

### 5.2 역할별 인원 집계
roleCounts = { all: users.length }
users.forEach(u => roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1)

항상 전체 사용자 기준으로 센다. 검색어를 입력하거나 역할 필터를 바꿔도 요약 카드의 숫자는 변하지 않는다.

### 5.3 배정 선박 이름 변환
assignedVessels = user.assignedVesselIds
    ?.map(id => vessels.find(v => v.id === id)?.name)
     .filter(Boolean)
  ?? []

표시 = assignedVessels.length > 0 ? assignedVessels.join(', ') : '—'

filter(Boolean)이 중요하다 — 선박 목록에 없는 id가 섞여 있으면 undefined가 되는데, 이를 걸러내지 않으면 KSF VENTURE, undefined 처럼 표시된다.
선박 데이터가 아직 로딩되지 않았으면 전부 걸러져 —가 표시된다(첫 렌더에 정상 동작).

### 5.4 활성 상태 토글
toggleActive(id):
  user = users.find(u => u.id === id)
  if (!user) return                                    # ★ 방어
  await PATCH /api/users/{id}  body: { active: !user.active }
  mutate()                                              # 목록 재검증

mock 전용이라면 배열 상태를 직접 갱신한다.

setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))

낙관적 업데이트(optimistic update)를 하지 않는다. 서버 응답을 기다린 뒤 재검증하므로, 느린 네트워크에서는 클릭 후 반영까지 약간의 지연이 있다. 원본 그대로 두어도 무방하다.



## 6. 다국어 텍스트 전체 사전
t.users.*


| 키 | 한국어 | English |
| --- | --- | --- |
| title | 사용자 관리 | User Management |
| subtitle | 계정, 역할, 선박 배정 관리 | Accounts, roles and vessel assignments |
| addUser | 사용자 추가 | Add User |
| searchPlaceholder | 이름, 이메일 검색 | Search name, email |
| colUser | 사용자 | User |
| colRole | 역할 | Role |
| colDept | 부서 | Department |
| colVessel | 배정 선박 | Assigned Vessel |
| colStatus | 상태 | Status |
| colAction | 액션 | Action |
| deactivate | 비활성화 | Deactivate |
| activate | 활성화 | Activate |


t.role.* (요약 카드 · 필터 · 배지 공통)


| 키 | 한국어 | English |
| --- | --- | --- |
| ADMIN | 시스템 관리자 | Admin |
| LOGISTICS | 물류 담당자 | Logistics |
| CAPTAIN | 선장·선원 | Captain |
| CLIENT | 화주 | Client |


t.status.* · t.common.* (공용)


| 키 | 한국어 | English |
| --- | --- | --- |
| status.enabled | 활성 | Active |
| status.disabled | 비활성 | Inactive |
| common.all | 전체 | All |


부서명(시스템 관리팀·물류기획팀·운항팀·외부 화주)은 데이터의 일부라 다국어 사전을 거치지 않는다. 영문 모드에서도 한국어로 표시되는 것이 원본 동작이다.



## 7. 색상·디자인 토큰 요약
브랜드 색: 인디고 #6366f1 — "사용자 추가" 버튼, 검색 포커스 링. hover #4f46e5.

역할별 색 — 요약 카드 아이콘 박스와 목록의 역할 배지에 동일하게 적용한다.


| role | 라이트 | 다크 |
| --- | --- | --- |
| ADMIN | bg-purple-100 text-purple-700 | dark:bg-purple-900/30 dark:text-purple-300 |
| LOGISTICS | bg-[#6366f1]/15 text-[#6366f1] | dark:bg-[#6366f1]/20 dark:text-[#6366f1] |
| CAPTAIN | bg-green-100 text-green-700 | dark:bg-green-900/30 dark:text-green-300 |
| CLIENT | bg-orange-100 text-orange-700 | dark:bg-orange-900/30 dark:text-orange-300 |


이 팔레트는 AUTH_LOGIN.md 7장의 데모 계정 배지와 거의 같다(다크 모드 투명도만 /40 vs /30으로 다르다). 두 화면을 함께 만든다면 상수를 공유하되 이 차이를 인지할 것.

상태 배지:


| 상태 | 클래스 |
| --- | --- |
| 활성 | bg-green-100 text-green-700 (다크 bg-green-900/30 text-green-300) |
| 비활성 | bg-slate-100 text-slate-500 (다크 bg-slate-800 text-slate-400) |


아바타: 32×32px 원형(rounded-full), bg-slate-200(다크 slate-700), 이름 첫 글자 14px semibold.

다른 화면의 아이콘 박스가 rounded-lg/rounded-xl인 것과 달리 여기만 완전한 원이다.

카드: 요약 카드는 rounded-xl border shadow-sm p-3, 목록 컨테이너는 rounded-xl border overflow-hidden.

타이포: 요약 카드 숫자 18px bold / 역할명 12px 회색 / 표 헤더 12px semibold / 이름 14px medium / 이메일·부서·선박 12px.

아이콘 세트: lucide-react — Plus, Search, UserCheck, UserX, Shield, Users, Anchor

다크 모드: 모든 배경/텍스트/테두리에 dark: variant를 함께 정의한다.



## 8. 엣지 케이스 및 불변식
요약 카드 숫자는 필터와 무관하게 전체 기준으로 집계한다(5.2장).
역할 카드는 인원이 0명이어도 4장 모두 표시한다(0으로 표기).
배정 선박 변환 시 filter(Boolean)을 반드시 적용한다. 없으면 undefined가 문자열에 섞인다 (5.3장).
부서는 -, 배정 선박은 — 로 대시 문자가 다르다(4.5장).
비활성 행은 <tr> 전체에 opacity-50 을 준다. 개별 셀이 아니다.
토글 버튼은 "누르면 일어날 일"을 표시한다 — 활성 사용자에게 "비활성화"가 보인다.
"사용자 추가" 버튼에 동작이 없다(4.2장). 의도된 미구현 상태다.
빈 결과 안내가 없다(4.5장). 헤더만 남은 표가 보인다.
검색은 대소문자를 구분한다. 이메일이 전부 소문자이므로 대문자로 검색하면 안 걸린다.
정렬 기능이 없다. 원본 배열 순서를 유지한다.
SWR을 쓴다면 users·vessels 모두 빈 배열로 폴백한다. 첫 렌더에 undefined면 .filter()에서 터진다(BOOTSTRAP.md 9.4.5장).
PATCH는 active 필드만 보낸다. 다른 필드를 함께 보내지 않는다.
역할 배지 색이 로그인 화면과 미묘하게 다르다(다크 모드 투명도 /30 vs /40) (7장).



## 9. 재구현 체크리스트
User 타입 + 샘플 사용자 7명 입력(BOOTSTRAP.md 7.3장과 공유)
선박 id→이름 조회용 최소 데이터(5척)
페이지 4단 레이아웃(헤더·요약·필터 고정 / 목록만 스크롤)
페이지 헤더 + "사용자 추가" 버튼(동작 없음)
역할 설정 상수(색 4종 + 아이콘 4종) — 요약 카드와 배지가 공유
역할별 요약 카드 4장(전체 기준 집계, 0명도 표시)
검색 입력 + 역할 필터 세그먼트 5개(건수 없음)
필터링(역할 AND 검색, 대소문자 구분)
목록 테이블 6열 — 원형 아바타 · 역할 배지 · 부서 · 배정 선박 · 상태 배지 · 액션
배정 선박 이름 변환(filter(Boolean) + ', ' 조인 + — 폴백)
비활성 행 opacity-50
상태 토글 버튼(아이콘·라벨이 반대 동작을 표시) + toggleActive 처리
다국어(ko/en) 전체 적용
다크 모드 대응

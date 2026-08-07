// AI_REPORT.md §6 — 순수 계산 함수. 화면 렌더링과 재분석 요청 컨텍스트(§7) 양쪽에서
// 반드시 이 모듈만 재사용한다 (KNOWN_PITFALLS §5.2: 화면마다 다른 공식을 쓰면 같은
// 항차가 다른 확률로 보이는 사고가 있었다).

// "부산 (Busan)" -> "부산"
export function portShortName(label: string): string {
  return label.split(' ')[0]
}

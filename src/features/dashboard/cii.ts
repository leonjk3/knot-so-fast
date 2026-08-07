export type CiiGrade = 'A' | 'B' | 'C' | 'D' | 'E'

// DASHBOARD.md 3.6장 — 점수가 낮을수록 좋은 등급
export function ciiGradeFromScore(score: number): { grade: CiiGrade; color: string } {
  if (score < 3.5) return { grade: 'A', color: '#16a34a' }
  if (score < 4.0) return { grade: 'B', color: '#84cc16' }
  if (score < 4.95) return { grade: 'C', color: '#d97706' }
  if (score < 5.6) return { grade: 'D', color: '#ea580c' }
  return { grade: 'E', color: '#dc2626' }
}

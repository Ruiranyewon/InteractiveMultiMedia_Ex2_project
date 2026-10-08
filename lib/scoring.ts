// 점수 규칙 (PRD 3.3). 부수효과 없는 순수 함수만 둔다.

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
export const STREAK_START = 3;
export const STREAK_STEP = 10;
export const MAX_STREAK_BONUS = 50;
export const TIME_LIMIT_MS = 20_000;

/** 연속 정답 보너스. streak은 이번 정답을 포함한 연속 횟수. 3연속부터 +10, 이후 +10씩, 최대 +50. */
export function streakBonus(streak: number): number {
  if (streak < STREAK_START) return 0;
  return Math.min(MAX_STREAK_BONUS, (streak - STREAK_START + 1) * STREAK_STEP);
}

/** 속도 보너스. 남은 시간 비율 × 50, 정수 반올림. 범위는 0~50으로 고정. */
export function speedBonus(elapsedMs: number, limitMs: number = TIME_LIMIT_MS): number {
  const elapsed = Math.max(0, elapsedMs);
  const ratio = Math.min(1, Math.max(0, (limitMs - elapsed) / limitMs));
  return Math.round(ratio * MAX_SPEED_BONUS);
}

export interface ScoreInput {
  isCorrect: boolean;
  elapsedMs: number;
  /** 이번 문제 이전까지의 연속 정답 수 */
  prevStreak: number;
  limitMs?: number;
}

export interface ScoreResult {
  points: number;
  base: number;
  speed: number;
  streakBonus: number;
  /** 이번 문제 반영 후 연속 정답 수 */
  streak: number;
}

export function scoreAnswer({ isCorrect, elapsedMs, prevStreak, limitMs = TIME_LIMIT_MS }: ScoreInput): ScoreResult {
  if (!isCorrect) return { points: 0, base: 0, speed: 0, streakBonus: 0, streak: 0 };
  const streak = prevStreak + 1;
  const speed = speedBonus(elapsedMs, limitMs);
  const bonus = streakBonus(streak);
  return { points: BASE_POINTS + speed + bonus, base: BASE_POINTS, speed, streakBonus: bonus, streak };
}

export const GRADES = [
  { min: 80, title: "지식왕" },
  { min: 60, title: "박사" },
  { min: 40, title: "탐험가" },
  { min: 0, title: "새싹" },
] as const;

/** 정답률(0~100)에 따른 등급 칭호 (PRD 3.5) */
export function gradeFor(accuracyPercent: number): string {
  return GRADES.find((g) => accuracyPercent >= g.min)!.title;
}

// 문제 추출: 순수 함수 (DB/시간 의존 없음). rng를 주입해 테스트한다.

export type Rng = () => number;

/** 난이도별 목표 개수 (PRD 6.1, 하 3 : 중 5 : 상 2) */
export const DIFFICULTY_QUOTA: Record<number, number> = { 1: 3, 2: 5, 3: 2 };
export const QUESTIONS_PER_CATEGORY = 10;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 한 카테고리에서 count개를 뽑는다. 난이도별 쿼터를 먼저 채우고,
 * 부족한 난이도는 가까운 난이도(거리 1 → 2)의 남은 문제로 보충한다. 결과 순서는 무작위.
 */
export function pickQuestions<T extends { id: string; difficulty: number }>(
  pool: readonly T[],
  rng: Rng = Math.random,
  count = QUESTIONS_PER_CATEGORY,
): T[] {
  if (pool.length < count) throw new Error(`문제가 부족합니다: ${pool.length} < ${count}`);

  const byDiff = new Map<number, T[]>();
  for (const d of [1, 2, 3]) byDiff.set(d, shuffle(pool.filter((q) => q.difficulty === d), rng));

  const picked: T[] = [];
  const deficits: number[] = []; // 부족분이 있는 난이도(부족한 개수만큼 반복)
  for (const d of [1, 2, 3]) {
    const want = DIFFICULTY_QUOTA[d];
    const have = byDiff.get(d)!;
    const take = have.splice(0, want);
    picked.push(...take);
    for (let i = take.length; i < want; i++) deficits.push(d);
  }

  for (const d of deficits) {
    const order = [1, 2, 3].filter((x) => x !== d).sort((a, b) => Math.abs(a - d) - Math.abs(b - d));
    for (const alt of order) {
      const next = byDiff.get(alt)!.shift();
      if (next) { picked.push(next); break; }
    }
  }
  return shuffle(picked, rng);
}

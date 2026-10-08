import { closeDb, CATEGORIES, listQuestions, openDb } from "../lib/db";
import { DIFFICULTY_QUOTA } from "../lib/game/selection";

openDb();
const qs = listQuestions();
const errors: string[] = [];

const ids = new Set<string>();
const texts = new Set<string>();
for (const q of qs) {
  if (ids.has(q.id)) errors.push(`${q.id}: id 중복`);
  ids.add(q.id);
  const key = q.question.replace(/\s+/g, "");
  if (texts.has(key)) errors.push(`${q.id}: 중복 문제 "${q.question}"`);
  texts.add(key);
  if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${q.id}: 보기가 4개가 아님`);
  else if (new Set(q.choices).size !== 4) errors.push(`${q.id}: 보기 중복`);
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) errors.push(`${q.id}: answerIndex 범위 오류`);
  if (![1, 2, 3].includes(q.difficulty)) errors.push(`${q.id}: 난이도 오류`);
  if (!q.explanation?.trim()) errors.push(`${q.id}: 해설 없음`);
  if (!CATEGORIES.includes(q.category)) errors.push(`${q.id}: 알 수 없는 카테고리`);
}
for (const cat of CATEGORIES) {
  const inCat = qs.filter((q) => q.category === cat);
  const counts = [1, 2, 3].map((d) => inCat.filter((q) => q.difficulty === d).length);
  console.log(`${cat}: ${inCat.length}문제 (난이도 1/2/3 = ${counts.join("/")})`);
  if (inCat.length < 30) errors.push(`${cat}: 30문제 미만`);
  [1, 2, 3].forEach((d, i) => {
    if (counts[i] < DIFFICULTY_QUOTA[d]) errors.push(`${cat}: 난이도 ${d} 문제가 쿼터(${DIFFICULTY_QUOTA[d]}) 미만`);
  });
}
closeDb();

if (errors.length) {
  console.error(`검증 실패 (${errors.length}건)`);
  errors.forEach((e) => console.error(" - " + e));
  process.exit(1);
}
console.log(`검증 통과: 총 ${qs.length}문제`);

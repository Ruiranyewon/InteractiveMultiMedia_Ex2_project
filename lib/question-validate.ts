import { CATEGORIES, type CategoryId, type QuestionRecord } from "@/lib/db";

export type QuestionInput = Pick<QuestionRecord, "category" | "difficulty" | "question" | "choices" | "answerIndex" | "explanation" | "source" | "status">;

/** 관리자 입력 검증. 오류 메시지 배열을 돌려준다(비어 있으면 통과). */
export function validateQuestionInput(b: Record<string, unknown>): { value?: QuestionInput; errors: string[] } {
  const errors: string[] = [];
  const category = b.category as CategoryId;
  if (!CATEGORIES.includes(category)) errors.push("카테고리가 올바르지 않습니다.");
  const difficulty = Number(b.difficulty);
  if (![1, 2, 3].includes(difficulty)) errors.push("난이도는 1~3이어야 합니다.");
  const question = typeof b.question === "string" ? b.question.trim() : "";
  if (!question) errors.push("문제를 입력하세요.");
  const choices = Array.isArray(b.choices) ? b.choices.map((c) => (typeof c === "string" ? c.trim() : "")) : [];
  if (choices.length !== 4 || choices.some((c) => !c)) errors.push("보기는 비어 있지 않은 4개여야 합니다.");
  else if (new Set(choices).size !== 4) errors.push("보기가 서로 달라야 합니다.");
  const answerIndex = Number(b.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) errors.push("정답 번호는 0~3이어야 합니다.");
  const explanation = typeof b.explanation === "string" && b.explanation.trim() ? b.explanation.trim() : null;
  if (!explanation) errors.push("해설을 입력하세요(출제 품질 정책).");
  const source = typeof b.source === "string" && b.source.trim() ? b.source.trim() : null;
  const status = typeof b.status === "string" ? b.status : "draft";
  if (!["published", "draft", "under_review"].includes(status)) errors.push("상태가 올바르지 않습니다.");
  if (errors.length) return { errors };
  return { errors, value: { category, difficulty, question, choices, answerIndex, explanation, source, status } };
}

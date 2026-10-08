// 서버/클라이언트 공용 (DB 의존 없음)
export const REPORT_REASONS_LIST = ["wrong_answer", "ambiguous", "typo", "offensive", "other"] as const;
export type ReportReasonId = (typeof REPORT_REASONS_LIST)[number];
export const REPORT_REASON_LABELS: Record<ReportReasonId, string> = {
  wrong_answer: "정답이 틀렸어요",
  ambiguous: "정답이 여러 개로 해석돼요",
  typo: "오탈자·표현 오류",
  offensive: "부적절한 내용",
  other: "기타",
};

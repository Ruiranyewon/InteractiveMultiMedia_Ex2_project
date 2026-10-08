import { addReport, getAnswer, getQuestion, getSession, REPORT_REASONS, type ReportReason } from "@/lib/db";
import { analytics } from "@/lib/analytics";
import { GameError } from "./errors";

/**
 * 문제 신고. 풀어 본 사람만 신고할 수 있도록 '본인 세션에서 이미 제출한 문제'만 허용한다
 * (익명 계정을 늘려 멀쩡한 문제를 내리는 악용을 줄이기 위함). 같은 플레이어의 중복 신고는 막는다.
 */
export function reportQuestion(playerId: string, questionId: string, body: { reason?: unknown; sessionId?: unknown }) {
  if (!REPORT_REASONS.includes(body.reason as ReportReason)) {
    throw new GameError(400, "INVALID_REASON", "신고 사유를 선택해 주세요.");
  }
  if (typeof body.sessionId !== "string") throw new GameError(400, "INVALID_SESSION", "sessionId가 필요합니다.");
  if (!getQuestion(questionId)) throw new GameError(404, "QUESTION_NOT_FOUND", "문제를 찾을 수 없습니다.");
  const s = getSession(body.sessionId);
  if (!s || s.playerId !== playerId || !getAnswer(body.sessionId, questionId)) {
    throw new GameError(403, "NOT_ALLOWED", "내가 푼 문제만 신고할 수 있어요.");
  }
  const res = addReport({ questionId, playerId, sessionId: body.sessionId, reason: body.reason as string, createdAt: Date.now() });
  if (!res) throw new GameError(409, "ALREADY_REPORTED", "이미 신고한 문제예요.");
  analytics.track("question_report", { playerId, sessionId: body.sessionId, props: { questionId, reason: body.reason } });
  return { reported: true, underReview: res.underReview };
}

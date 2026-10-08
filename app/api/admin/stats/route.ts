import { adminRespond } from "@/lib/admin-api";
import { eventCounts, listQuestionStats, overviewStats, recentErrors } from "@/lib/db";

export const dynamic = "force-dynamic";

const MIN_ANSWERS = 5;

export function GET(req: Request) {
  return adminRespond(req, () => {
    // 응답 수가 너무 적은 문제는 정답률이 의미 없으므로 순위에서 제외한다.
    const rated = listQuestionStats().filter((q) => q.answerCount >= MIN_ANSWERS && q.correctRate !== null);
    const slim = (q: (typeof rated)[number]) => ({ id: q.id, category: q.category, question: q.question, answerCount: q.answerCount, correctRate: q.correctRate });
    return {
      overview: overviewStats(),
      minAnswers: MIN_ANSWERS,
      easiest: [...rated].sort((a, b) => b.correctRate! - a.correctRate!).slice(0, 5).map(slim),
      hardest: [...rated].sort((a, b) => a.correctRate! - b.correctRate!).slice(0, 5).map(slim),
      events: eventCounts(),
      errors: recentErrors(),
    };
  });
}

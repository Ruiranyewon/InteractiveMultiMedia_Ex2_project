import { adminRespond } from "@/lib/admin-api";
import { getQuestion, listQuestionStats, listReports } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 신고가 1건 이상인 문제와 신고 내역 (신고 많은 순) */
export function GET(req: Request) {
  return adminRespond(req, () => {
    const reports = listReports();
    const byQ = new Map<string, typeof reports>();
    for (const r of reports) byQ.set(r.questionId, [...(byQ.get(r.questionId) ?? []), r]);
    const stats = new Map(listQuestionStats().map((s) => [s.id, s]));
    const items = [...byQ.entries()]
      .map(([qid, rs]) => ({ question: getQuestion(qid), stat: stats.get(qid), reports: rs.map((r) => ({ id: r.id, reason: r.reason, createdAt: r.createdAt })) }))
      .filter((i) => i.question)
      .sort((a, b) => b.reports.length - a.reports.length);
    return { items };
  });
}

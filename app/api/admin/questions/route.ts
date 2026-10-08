import { adminRespond } from "@/lib/admin-api";
import { readJson } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { insertQuestion, listQuestionStats, nextQuestionId, type QuestionRecord } from "@/lib/db";
import { validateQuestionInput } from "@/lib/question-validate";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return adminRespond(req, () => {
    const q = new URL(req.url).searchParams;
    const minRate = q.get("minRate") ? Number(q.get("minRate")) : null;
    const maxRate = q.get("maxRate") ? Number(q.get("maxRate")) : null;
    let items = listQuestionStats({
      category: q.get("category") || undefined, status: q.get("status") || undefined, search: q.get("search") || undefined,
    });
    // 정답률 필터: 응답이 없는 문제는 정답률 필터가 켜지면 제외한다.
    if (minRate !== null || maxRate !== null) {
      items = items.filter((i) => i.correctRate !== null && (minRate === null || i.correctRate >= minRate) && (maxRate === null || i.correctRate <= maxRate));
    }
    return { items };
  });
}

export function POST(req: Request) {
  return adminRespond(req, async () => {
    const { errors, value } = validateQuestionInput(await readJson(req));
    if (!value) throw new GameError(400, "INVALID_QUESTION", errors.join(" "), { errors });
    const rec: QuestionRecord = {
      ...value, id: nextQuestionId(value.category), image: null, createdAt: new Date().toISOString().slice(0, 10),
      reviewedBy: null, reports: 0,
    };
    insertQuestion(rec);
    return rec;
  });
}

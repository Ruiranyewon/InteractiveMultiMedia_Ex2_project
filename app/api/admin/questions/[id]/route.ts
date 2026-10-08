import { adminRespond } from "@/lib/admin-api";
import { readJson, type IdContext } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { clearReports, getQuestion, listReports, setQuestionStatus, updateQuestion } from "@/lib/db";
import { validateQuestionInput } from "@/lib/question-validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return adminRespond(req, () => {
    const q = getQuestion(id);
    if (!q) throw new GameError(404, "QUESTION_NOT_FOUND", "문제를 찾을 수 없습니다.");
    return { question: q, reports: listReports(id) };
  });
}

export async function PUT(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return adminRespond(req, async () => {
    const existing = getQuestion(id);
    if (!existing) throw new GameError(404, "QUESTION_NOT_FOUND", "문제를 찾을 수 없습니다.");
    const { errors, value } = validateQuestionInput(await readJson(req));
    if (!value) throw new GameError(400, "INVALID_QUESTION", errors.join(" "), { errors });
    const next = { ...existing, ...value };
    updateQuestion(next);
    return next;
  });
}

/** { status } 로 게시/비공개/검토 전환, { clearReports: true } 로 신고 초기화 */
export async function PATCH(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return adminRespond(req, async () => {
    if (!getQuestion(id)) throw new GameError(404, "QUESTION_NOT_FOUND", "문제를 찾을 수 없습니다.");
    const body = await readJson(req);
    if (body.clearReports === true) clearReports(id);
    if (body.status !== undefined) {
      if (!["published", "draft", "under_review"].includes(body.status as string)) throw new GameError(400, "INVALID_STATUS", "상태가 올바르지 않습니다.");
      setQuestionStatus(id, body.status as string);
    }
    return { question: getQuestion(id) };
  });
}

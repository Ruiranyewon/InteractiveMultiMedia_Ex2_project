import { readJson, respond, type IdContext } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { startQuestion } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(async () => {
    const { questionId } = await readJson(req);
    if (typeof questionId !== "string") throw new GameError(400, "INVALID_QUESTION", "questionId가 필요합니다.");
    return startQuestion(id, questionId);
  });
}

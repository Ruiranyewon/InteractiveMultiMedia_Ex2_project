import { readJson, respond, type IdContext } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { submitAnswer } from "@/lib/game/service";
import { allow, limits } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(async () => {
    if (!allow(`answer:${id}`, limits().answerPerSec, 1000)) {
      throw new GameError(429, "RATE_LIMITED", "너무 빨리 제출하고 있어요.");
    }
    // 점수 등 다른 필드는 읽지 않는다. 판정과 점수는 서버가 계산한다.
    const { questionId, selectedIndex } = await readJson(req);
    if (typeof questionId !== "string") throw new GameError(400, "INVALID_QUESTION", "questionId가 필요합니다.");
    if (selectedIndex !== null && typeof selectedIndex !== "number") {
      throw new GameError(400, "INVALID_SELECTION", "selectedIndex는 0~3 또는 null이어야 합니다.");
    }
    return submitAnswer(id, questionId, selectedIndex as number | null);
  });
}

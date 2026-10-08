import { adminRespond } from "@/lib/admin-api";
import { readJson, type IdContext } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { getSession, patchSession, setEntryStatusBySession } from "@/lib/db";

export const dynamic = "force-dynamic";

/** { action: 'approve' } 플래그 해제 + 보류 항목 노출, { action: 'reject' } 보류 항목 거부 */
export async function POST(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return adminRespond(req, async () => {
    const { action } = await readJson(req);
    if (!getSession(id)) throw new GameError(404, "SESSION_NOT_FOUND", "세션을 찾을 수 없습니다.");
    if (action === "approve") {
      patchSession(id, { flagged: false });
      return { updated: setEntryStatusBySession(id, ["pending", "rejected"], "visible") };
    }
    if (action === "reject") return { updated: setEntryStatusBySession(id, ["pending", "visible"], "rejected") };
    throw new GameError(400, "INVALID_ACTION", "action은 approve 또는 reject여야 합니다.");
  });
}

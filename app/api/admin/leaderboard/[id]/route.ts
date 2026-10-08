import { adminRespond } from "@/lib/admin-api";
import { readJson, type IdContext } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { deleteEntry, setEntryStatus, type EntryStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

/** { status: 'visible' | 'hidden' } 로 노출/숨김 */
export async function PATCH(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return adminRespond(req, async () => {
    const { status } = await readJson(req);
    if (status !== "visible" && status !== "hidden") throw new GameError(400, "INVALID_STATUS", "status는 visible 또는 hidden이어야 합니다.");
    if (!setEntryStatus(Number(id), status as EntryStatus)) throw new GameError(404, "ENTRY_NOT_FOUND", "항목을 찾을 수 없습니다.");
    return { ok: true };
  });
}

export async function DELETE(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return adminRespond(req, () => {
    if (!deleteEntry(Number(id))) throw new GameError(404, "ENTRY_NOT_FOUND", "항목을 찾을 수 없습니다.");
    return { ok: true };
  });
}

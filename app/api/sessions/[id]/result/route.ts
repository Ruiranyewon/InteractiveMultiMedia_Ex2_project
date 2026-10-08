import { respond, type IdContext } from "@/lib/api";
import { getResult } from "@/lib/game/service";
import { findPlayer } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: IdContext) {
  const { id } = await ctx.params;
  return respond(() => getResult(id, findPlayer(req)?.id ?? null));
}
